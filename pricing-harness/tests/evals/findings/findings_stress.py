"""D0-2 stress run: how data findings behave on one pack of sources, with no model calls (plan section 3k).

Usage: python -I findings_stress.py <name> <clean dir> [--seeded DIR --key CSV [--natural CSV] [--files CSV]] [--out DIR]
Run one pack per process, so peak memory is that pack's own. Reports the script's coverage per source (read or not, value
columns, what each detector did) with its findings by detector, then cold wall time and peak memory. With a seeded copy
and its answer key, recall per plant comes from score_findings.py.
"""
import argparse
import collections
import json
import os
import resource
import subprocess
import sys
import tempfile
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / 'bundled/harness-tools'))
import data_findings  # noqa: E402

KINDS = {'.csv', '.xlsx'}  # what the harness passes to data findings


def sources(folder):  # relative to the pack root, as the harness passes them; a workspace's uploads live in files/
    scan = Path(folder) / 'files' if (Path(folder) / 'files').is_dir() else Path(folder)
    return sorted(str(p.relative_to(folder)) for p in scan.rglob('*') if p.suffix.lower() in KINDS and p.is_file())


def report(folder, cache):
    folder = Path(folder).resolve()
    os.chdir(folder)
    paths, start = sources(folder), time.perf_counter()
    found, result = data_findings.detect(paths, cache)
    by = collections.defaultdict(collections.Counter)
    for f in result['findings']:
        by[f['source']][f['detector']] += 1
    rows = [{**c, 'findings': dict(by[c['source']])} for c in result['coverage']]
    return {'seconds': round(time.perf_counter() - start, 2), 'findings': len(result['findings']), 'sources': rows}, {'findingsDir': str(found), **result}


def main():
    a = argparse.ArgumentParser()
    a.add_argument('name'), a.add_argument('clean'), a.add_argument('--seeded'), a.add_argument('--key'), a.add_argument('--natural'), a.add_argument('--files'), a.add_argument('--out', default='.')
    args = a.parse_args()
    for k in ('clean', 'seeded', 'key', 'natural', 'files'):  # report() changes directory, so pin every path first
        setattr(args, k, getattr(args, k) and str(Path(getattr(args, k)).resolve()))
    out = Path(args.out).resolve()
    out.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as cache:  # a fresh cache: cold timings
        clean, clean_result = report(args.clean, Path(cache) / 'clean')
        summary = {'name': args.name, 'clean': clean}
        if args.seeded:
            summary['seeded'], seeded_result = report(args.seeded, Path(cache) / 'seeded')
            if args.key:
                files = []
                for tag, r in (('seeded', seeded_result), ('clean', clean_result)):
                    files.append(out / f'{args.name}-{tag}-findings.json')
                    files[-1].write_text(json.dumps(r))
                scorer = Path(__file__).with_name('score_findings.py')
                summary['recall'] = subprocess.run([sys.executable, '-I', str(scorer), *map(str, files), args.key,
                                                    *[x for k in ('natural', 'files') if getattr(args, k) for x in (f'--{k}', getattr(args, k))]], cwd=args.seeded,
                                                   capture_output=True, text=True).stdout.splitlines()
    summary['peakMemoryMB'] = round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / (1 << 20 if sys.platform == 'darwin' else 1 << 10))
    (out / f'{args.name}.json').write_text(json.dumps(summary, indent=1))
    print(json.dumps(summary, indent=1))


if __name__ == '__main__':
    main()
