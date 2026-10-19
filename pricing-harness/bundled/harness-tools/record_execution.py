"""Generic execution provenance, with no financial queries or analytical templates.

Records Python file reads and DuckDB statements made by generated workspace code.
This is evidence of execution/dependencies, not a sandbox or a proof of business truth.
"""
import argparse
import json
import os
import re
import runpy
import sys
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--script', type=Path, required=True)
    parser.add_argument('--root', type=Path, required=True)
    parser.add_argument('--record', type=Path, required=True)
    args = parser.parse_args()
    root = args.root.resolve()
    reads, queries = set(), []
    identities, renames = {}, []

    def record_path(raw):
        if not isinstance(raw, (str, os.PathLike)):
            return
        try:
            path = Path(raw).resolve()
            if path.is_relative_to(root) and path.is_file():
                name = str(path.relative_to(root))
                reads.add(name)
                stat = path.stat()
                identities[name] = (stat.st_dev, stat.st_ino)
        except (OSError, ValueError):
            pass

    def audit(event, values):
        if event == 'os.rename' and all(fd in (-1, None) for fd in values[2:]):
            try:
                source, target = Path(values[0]).resolve(), Path(values[1]).resolve()
                if source.is_relative_to(root) and target.is_relative_to(root):
                    renames.append((source, target))
            except (OSError, ValueError, TypeError):
                pass
        if event == 'open':
            path, mode, flags = values
            if (isinstance(mode, str) and ('r' in mode or '+' in mode)) or (mode is None and not flags & (os.O_WRONLY | os.O_RDWR)):
                record_path(path)

    sys.addaudithook(audit)
    import duckdb
    original_connect = duckdb.connect

    class TrackedConnection:
        def __init__(self, connection):
            self.connection = connection

        def __getattr__(self, name):
            method = getattr(self.connection, name)
            if name not in ('execute', 'executemany', 'sql', 'query', 'read_csv', 'read_parquet') or not callable(method):
                return method

            def tracked(*values, **kwargs):
                result = method(*values, **kwargs)
                text = str(values[0]) if values else ''
                queries.append(text)
                # SQL string/parameter file inputs are native reads, outside Python's open audit.
                for raw in re.findall(r"['\"]([^'\"]+)['\"]", text):
                    record_path(raw)
                for value in values[1:]:
                    if isinstance(value, (list, tuple)):
                        for raw in value:
                            record_path(raw)
                if name in ('read_csv', 'read_parquet') and values:
                    record_path(values[0])
                return self if result is self.connection else result
            return tracked

        def __enter__(self):
            self.connection.__enter__()
            return self

        def __exit__(self, *values):
            return self.connection.__exit__(*values)

    def connect(*values, **kwargs):
        result = original_connect(*values, **kwargs)
        if values:
            record_path(values[0])
        return TrackedConnection(result)

    duckdb.connect = connect
    success = False
    try:
        sys.argv = [str(args.script)]
        sys.path.insert(0, str(args.script.parent))
        runpy.run_path(str(args.script), run_name='__main__')
        success = True
    finally:
        # An imported cache can move from an atomic staging directory to its
        # final key. Attribute the read to its final path only when the file
        # identity matches; failed renames/replacement files cannot authorize it.
        for name in list(reads):
            original = root / name
            candidate = original
            for source, target in renames:
                if candidate.is_relative_to(source):
                    candidate = target / candidate.relative_to(source)
            if candidate != original:
                try:
                    stat = candidate.stat()
                    if candidate.is_file() and (stat.st_dev, stat.st_ino) == identities[name]:
                        reads.remove(name)
                        reads.add(str(candidate.relative_to(root)))
                except (OSError, KeyError, ValueError):
                    pass
        args.record.write_text(json.dumps({'schemaVersion': 1, 'success': success, 'reads': sorted(reads), 'queries': queries, 'renames': [{'from': str(a.relative_to(root)), 'to': str(b.relative_to(root))} for a, b in renames]}, indent=2))


if __name__ == '__main__':
    main()
