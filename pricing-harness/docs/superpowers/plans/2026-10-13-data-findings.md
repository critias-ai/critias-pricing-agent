# Data Findings (Anomaly Detectors D1–D4, D7) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Code detects data anomalies in a workspace's CSV sources before every run. The agent sees them as facts, applies treatments the user has confirmed, and asks only about findings that would change its answer.

**Architecture:** One bundled Python module, `bundled/harness-tools/data_findings.py`, holds everything:
- five generic SQL detectors: parse (D1), shape (D2), domain (D3), uniqueness (D4) and peer ratio (D7)
- one findings list, plus a Parquet file of flagged row IDs
- `treated_view()`, which applies the treatments the user chose
- `sweep()`, which tests whether an untreated finding changes the answer

A small TypeScript adapter runs the module next to the existing source profiler and puts a bounded `dataFindings` field into every stage prompt. Treatments reuse the existing confirmation path: the analyst asks with a `definition` review reason, the harness asks the user, and the coordinator records the answer in `context.md`.

**Tech Stack:** Python 3 + DuckDB (already in `.venv`), TypeScript (Node ≥ 22), vitest, pytest.

---

## Context the engineer needs

All paths are relative to `pricing-harness/` unless they start with `/`. The git root is the parent folder.

**Agreed scope.** The design is in `docs/research/messy-data-determinism-2026-10-13/ANOMALIES.md`.
- **Build:** D1 parse, D2 shape, D3 domain, D4 uniqueness, D7 peer ratio.
- **Do not build:** D5 identities, D6 time, D8 labels.
- **Code never makes business assumptions.** It only flags rows and offers lossless rewrites. Every treatment that changes a number is chosen by the user. See the memory note "No business assumptions in cleaning code".

**Size rule from the user.** Use the simplest workflow and the most compact code. All code for this feature must pass `/anthropic-skills:ponytail` at **ultra** level. Budget: under 300 lines of feature code, tests excluded. The prototype is about 210 lines of Python plus about 50 lines of TypeScript wiring.

**Do not commit the research folder.** `docs/research/messy-data-determinism-2026-10-13/` stays uncommitted. Commit only on `feat/data-findings`, and do not push.

**The prototype is already proven.** It was run from the scratchpad on 2026-10-13. The unit tests below pass against it.
- On the seeded pack it catches 30 of the 37 plant types, including both traps that change the benchmark answer. It raises no false alarms, against 90 natural findings on the clean pack. Detection takes 15–20 s per pack, plus preparation the first time.
- `sweep` flags exactly the two answer-changing traps on the benchmark ranking.

**Existing code this plugs into (main at `4ae523f`):**
- `bundled/harness-tools/data_workspace.py`:
  - `prepare_source()` stages each CSV as an all-VARCHAR DuckDB table `raw`, cached by content hash.
  - `attach_source()` attaches a prepared source read-only.
  - `quote()` and `identifier()` quote SQL literals and identifiers.
  - The new module reuses all of these.
- `src/agent/workflow/source-profiles.ts` with `createSourceProfiler()` is the pattern to copy: run bundled Python with `execFile` and parse its JSON stdout.
- `src/agent/runs.ts:112` builds `WorkflowOrchestrator` with `profileSources: createSourceProfiler(config, paths.cache)`.
- `src/agent/workflow/orchestrator.ts`:
  - options type: `profileSources?` at line 52
  - `let sourceProfiles` at line 119
  - `buildStagePrompt({... sourceProfiles, ...})` at line 159
  - profiling block at lines 272–278
- `src/agent/workflow/stage-prompt.ts` builds the JSON envelope every stage receives.
- `src/agent/workflow/role-prompts.ts`: word caps are enforced by `tests/unit/workflow-coordinator.test.ts:125`, at most 110 words per role and 70 for the shared prompt. Current counts are coordinator 109, analyst 101, verifier 82 and shared 59. Additions must fit.
- Review routing (`harness.config.json` `workflow.review.askUser: ["definition"]`): an analyst review reason `{"kind": "definition", ...}` stops the run and asks the user. On the next turn, the coordinator writes the answer to `context.md` through `confirmedDefinitions` (`orchestrator.ts:295–304`). No new code is needed for asking or storing treatments.
- `tests/fixtures/workflow-flow.ts` has `createFlow()`. It runs the orchestrator with a scripted fake runner and records every stage envelope in `envelopes`.

**Test data.**
- The seeded pack is `workspace/northbridge-seeded/`. The clean pack is `workspace/northbridge-test/`. Both are git-ignored.
- The answer key is `.cache/seeded-pack/answer_key.csv`.
- The generator is `docs/research/messy-data-determinism-2026-10-13/prototype/seed_anomalies.py`.

**Commands.** All run from `pricing-harness/`.
- Python tests: `npm run test:python`, or `.venv/bin/python -m pytest tests/python/test_data_findings.py -q`.
- TypeScript tests: `npm test`. Typecheck: `npm run typecheck`. Format: `npm run format` and `npm run format:check`.

## File structure

| File | Change | Responsibility |
|---|---|---|
| `bundled/harness-tools/data_findings.py` | create | Detectors, findings cache, `treated_view`, `sweep`, CLI |
| `tests/python/test_data_findings.py` | create | Unit tests on a synthetic three-table pack |
| `src/agent/workflow/data-findings.ts` | create | Run the CLI; compact findings for the prompt |
| `tests/integration/data-findings.test.ts` | create | Prompt wiring, failure tolerance, real-Python round trip |
| `src/agent/workflow/stage-prompt.ts` | modify | Add the `dataFindings` envelope field |
| `src/agent/workflow/orchestrator.ts` | modify | Run detection once per run; log it; pass it to prompts |
| `src/agent/runs.ts` | modify | Wire `createFindingDetector` |
| `tests/fixtures/workflow-flow.ts` | modify | Pass the `findData` option through |
| `src/agent/workflow/role-prompts.ts` | modify | Two short prompt additions |
| `bundled/harness-tools/data-analysis.md` | modify | "Data findings" section the analyst follows |
| `docs/architecture.md` | modify | One paragraph |
| `tests/evals/seed_anomalies.py` | create (copy) | Seeded test pack generator |
| `tests/evals/score_findings.py` | create | Score findings against the answer key |

---

### Task 0: Branch setup

**Files:** none changed. The experiment diff is saved to the research folder.

- [ ] **Step 1: Save the uncommitted experiment changes as a patch**

The current branch, `experiment/workspace-index`, has five modified `src/` files from the index experiment. They are not part of this feature.

```bash
cd pricing-harness
git diff > docs/research/messy-data-determinism-2026-10-13/prototype/experiment-workspace-index.patch
wc -l docs/research/messy-data-determinism-2026-10-13/prototype/experiment-workspace-index.patch
```

Expected: a non-empty patch of about 60 lines covering `checkpoints.ts`, `orchestrator.ts`, `role-prompts.ts`, `stage-prompt.ts` and `worker.ts`.

- [ ] **Step 2: Restore the files and branch from main**

```bash
git restore src/agent/workflow/checkpoints.ts src/agent/workflow/orchestrator.ts src/agent/workflow/role-prompts.ts src/agent/workflow/stage-prompt.ts src/agent/workflow/worker.ts
git apply --check docs/research/messy-data-determinism-2026-10-13/prototype/experiment-workspace-index.patch
git switch -c feat/data-findings main
git status --short
```

Expected: `git apply --check` prints nothing, which means the patch can be re-applied later. Status shows only `?? docs/research/...` and `?? docs/superpowers/plans/2026-10-13-data-findings.md`.

- [ ] **Step 3: Baseline the suites**

```bash
npm run typecheck && npm test && npm run test:python
```

Expected: everything passes, including 336 vitest tests. If anything fails, stop and report: it isn't caused by this feature.

- [ ] **Step 4: Commit the plan on the feature branch**

```bash
git add docs/superpowers/plans/2026-10-13-data-findings.md
git commit -m "docs: plan data findings detectors"
```

---

### Task 1: Module core, findings cache and CLI

**Files:**
- Create: `bundled/harness-tools/data_findings.py`
- Test: `tests/python/test_data_findings.py`

- [ ] **Step 1: Write the test helpers and the first two tests**

Create `tests/python/test_data_findings.py`:

```python
import importlib.util
import json
import sys
from pathlib import Path

import duckdb
import pytest

TOOLS = Path(__file__).resolve().parents[2] / 'bundled/harness-tools'


def load(name):
    spec = importlib.util.spec_from_file_location(name, TOOLS / f'{name}.py')
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


df, dw = load('data_findings'), load('data_workspace')
LINE = 'line_id,invoice_id,product_id,customer_id,quantity,price,sold_at'


def line(i, **change):
    row = dict(line_id=f'L{i:05d}', invoice_id=f'INV{i // 4:04d}', product_id=f'P{i % 200:03d}', customer_id=str(1000 + i % 37),
               quantity=str(2 + i % 3), price=f'{(i % 200 + 1) * 0.1:.2f}', sold_at=f'2024-01-{1 + i % 28:02d} 10:00:00')
    return ','.join({**row, **change}.values())


def pack(tmp_path, lines=None, products=None):
    """Write a clean three-table pack (200 products, 50 customers, 2000 lines); pass lists to plant anomalies."""
    files = {'products.csv': ['product_id,name', *(products or [f'P{i:03d},Item {i}' for i in range(200)])],
             'customers.csv': ['customer_id,customer_name', *[f'{1000 + i},Shop {i}' for i in range(50)]],
             'lines.csv': [LINE, *(lines or [line(i) for i in range(2000)])]}
    for name, rows in files.items():
        (tmp_path / name).write_text('\n'.join(rows) + '\n')
    return df.detect([str(tmp_path / n) for n in files], tmp_path / 'cache')


def issues(result, source):
    return {(f['column'], f['issue']): f for f in result[1]['findings'] if f['source'].endswith(source)}


def test_clean_pack_has_no_findings(tmp_path):
    assert pack(tmp_path)[1]['findings'] == []


def test_findings_are_cached_by_source_content(tmp_path):
    first = pack(tmp_path)
    (first[0] / 'findings.json').write_text(json.dumps({'findings': ['cached']}))
    assert df.detect([str(tmp_path / n) for n in ('products.csv', 'customers.csv', 'lines.csv')], tmp_path / 'cache')[1] == {'findings': ['cached']}
```

The clean pack is the main false-alarm guard. Each later task re-runs it after adding a detector.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `.venv/bin/python -m pytest tests/python/test_data_findings.py -q`
Expected: collection error, `FileNotFoundError` for `data_findings.py`.

- [ ] **Step 3: Write the module core**

Create `bundled/harness-tools/data_findings.py`. Every detector constant is defined here. Tasks 2–6 insert detector blocks immediately **before** the line `    out.mkdir(parents=True, exist_ok=True)`, in task order.

```python
"""Generic data-anomaly detectors over prepared CSV sources. Facts only: code flags rows, the user picks treatments."""
import argparse
import hashlib
import json
import math
import re
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import duckdb
from data_workspace import ImportOptions, identifier as q, prepare_source, quote

VERSION = '1'
DOMINANT, RARE, KEYLIKE, RATIO, MAX_SHAPES, UNSTABLE = 0.95, 0.001, 0.99, 5, 30, 0.02
INT, DEC = r'^[+-]?[0-9]+$', r'^[+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)([eE][+-]?[0-9]+)?$'
INVISIBLE = r'[\x{200B}\x{00A0}\x{FEFF}]'
LOG = 'log10(greatest(r, 1e-12))'
RATIO_LABEL = f"""CASE WHEN r < 0 THEN 'negative'
    WHEN round({LOG}) <> 0 AND abs({LOG} - round({LOG})) < 0.15 THEN 'x1e' || CAST(round({LOG}) AS INT)
    WHEN abs(r / 12 - 1) < 0.1 THEN 'x12' ELSE 'outlier' END"""
# D1 issue labels for values that fail the column's dominant parse, with a lossless rewrite where one exists.
FORMATS = [
    ('decimal-comma', r'^[+-]?[0-9]+,[0-9]{1,2}$', "replace({c}, ',', '.')"),
    ('thousands-separator', r'^[+-]?[0-9]{1,3}(,[0-9]{3})+([.][0-9]+)?$', "replace({c}, ',', '')"),
    ('currency-symbol', r'^[£$€]', "regexp_replace({c}, '^[£$€]', '')"),
    ('parenthesised-negative', r'^\(.*\)$', "'-' || trim({c}, '()')"),
    ('unit-text', r'^[0-9.]+ *[A-Za-z]+$', "regexp_extract({c}, '^[0-9.]+')"),
    ('slash-date', r'^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}', None),
    ('serial-date', r'^[0-9]{5}([.][0-9]+)?$', "(TIMESTAMP '1899-12-30' + to_seconds(CAST(round(CAST({c} AS DOUBLE) * 86400) AS BIGINT)))::VARCHAR"),
    ('invalid-date', r'^[0-9]{4}-[0-9]{2}-[0-9]{2}', None),
    ('mixed-text', r'[0-9]', None),
]


def detect(paths, cache):
    prepared = [prepare_source(Path(p), Path(cache), ImportOptions(format='csv')) for p in paths]
    key = hashlib.sha256(json.dumps([VERSION, *sorted(p.source_sha256 for p in prepared)]).encode()).hexdigest()[:16]
    out = Path(cache) / f'findings-{key}'
    if (out / 'findings.json').is_file():
        return out, json.loads((out / 'findings.json').read_text())
    db = duckdb.connect()
    db.execute('CREATE TABLE flags (finding VARCHAR, rid BIGINT)')
    src = {}
    for i, (path, p) in enumerate(zip(paths, prepared)):
        db.execute(f'ATTACH {quote(p.database_path)} AS s{i} (READ_ONLY)')
        src[path] = {'t': f's{i}.raw', 'rows': p.row_count, 'cols': [r[0] for r in db.execute(f'DESCRIBE s{i}.raw').fetchall()]}
    findings = []

    def add(path, column, detector, issue, rowids, fix=None, exact=True):
        s, fid = src[path], 'F-' + hashlib.sha1(f'{detector}|{path}|{column}|{issue}'.encode()).hexdigest()[:6]
        db.execute(f'INSERT INTO flags SELECT {quote(fid)}, rid FROM ({rowids})')
        flagged = f"FROM {s['t']} WHERE rowid IN (SELECT rid FROM flags WHERE finding = {quote(fid)})"
        rows, = db.execute(f'SELECT count(*) {flagged}').fetchone()
        if not rows:
            return
        value = db.execute(f"SELECT sum(abs(TRY_CAST({q(s['value'])} AS DOUBLE))) {flagged}").fetchone()[0] if s['value'] else None
        examples = [r[0] for r in db.execute(f"SELECT DISTINCT {q(s['cols'][0] if column == '*' else column)} {flagged} LIMIT 3").fetchall()]
        findings.append({'id': fid, 'detector': detector, 'source': path, 'column': column, 'issue': issue, 'rows': rows,
                         'valueAtStake': None if value is None else round(value, 2), 'valueColumn': s['value'],
                         'examples': examples, 'fix': fix and fix.replace('{c}', q(column)), 'exact': exact})

    # Column facts shared by every detector: parse shares, uniqueness, code-likeness.
    for path, s in src.items():
        s['facts'] = {}
        for c in s['cols']:
            v = f"NULLIF(trim({q(c)}), '')"
            present, ints, decs, stamps, distinct, codey, total = db.execute(f"""SELECT count({v}),
                count(*) FILTER (WHERE regexp_matches({v}, {quote(INT)})), count(*) FILTER (WHERE regexp_matches({v}, {quote(DEC)})),
                count(TRY_CAST({v} AS TIMESTAMP)), count(DISTINCT {v}),
                count(*) FILTER (WHERE length({v}) <= 20 AND NOT regexp_matches({v}, ' ')), sum(abs(TRY_CAST({v} AS DOUBLE)))
                FROM {s['t']}""").fetchone()
            s['facts'][c] = dict(present=present, ints=ints, decs=decs, stamps=stamps, distinct=distinct, total=total or 0,
                                 numeric=bool(present) and decs >= DOMINANT * present,
                                 stamp=bool(present) and decs < DOMINANT * present and stamps >= DOMINANT * present,
                                 unique=present >= 0.5 * s['rows'] and distinct >= KEYLIKE * present,
                                 code=bool(present) and decs < DOMINANT * present and stamps < DOMINANT * present and codey >= 0.99 * present and distinct >= 10)
        decimals = [c for c, f in s['facts'].items() if f['numeric'] and f['ints'] < f['decs'] and not f['unique']]
        s['value'] = max(decimals, key=lambda c: s['facts'][c]['total'], default=None)

    out.mkdir(parents=True, exist_ok=True)
    db.execute(f"COPY flags TO {quote(out / 'flags.parquet')} (FORMAT parquet)")
    result = {'schemaVersion': 1, 'version': VERSION, 'findings': sorted(findings, key=lambda f: -(f['valueAtStake'] or 0))}
    (out / 'findings.json').write_text(json.dumps(result, indent=1))
    return out, result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Detect data anomalies across CSV sources; output JSON only')
    parser.add_argument('--cache', type=Path, required=True)
    parser.add_argument('--source', action='append', required=True)
    args = parser.parse_args()
    folder, result = detect(args.source, args.cache)
    print(json.dumps({'findingsDir': str(folder), **result}))
```

Notes:
- `source` in each finding is the path exactly as passed. The TypeScript adapter passes workspace-relative paths, with the workspace root as the working directory.
- `rowid` is the row's position in the prepared `raw` table. It equals data row number − 1 of the CSV.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `.venv/bin/python -m pytest tests/python/test_data_findings.py -q`
Expected: `2 passed`.

- [ ] **Step 5: Commit**

```bash
git add bundled/harness-tools/data_findings.py tests/python/test_data_findings.py
git commit -m "feat: add data findings module core with content-hash cache"
```

---

### Task 2: D1 parse detector

**Files:**
- Modify: `bundled/harness-tools/data_findings.py`, inserting before `    out.mkdir(parents=True, exist_ok=True)`
- Test: `tests/python/test_data_findings.py`

- [ ] **Step 1: Write the failing test**

Append to `tests/python/test_data_findings.py`:

```python
def test_parse_labels_failures_by_format_and_offers_lossless_fixes(tmp_path):
    lines = [line(i) for i in range(2000)]
    lines[10], lines[11], lines[12] = line(10, price='"1,10"'), line(11, sold_at='01/12/2024 10:00'), LINE
    found = issues(pack(tmp_path, lines), 'lines.csv')
    assert found[('price', 'decimal-comma')]['rows'] == 1
    assert found[('price', 'decimal-comma')]['fix'] == "replace(\"price\", ',', '.')"
    assert found[('sold_at', 'slash-date')]['fix'] is None
    assert found[('price', 'header-text')]['rows'] == 1
```

- [ ] **Step 2: Run it to verify it fails**

Run: `.venv/bin/python -m pytest tests/python/test_data_findings.py -q -k parse`
Expected: FAIL with `KeyError: ('price', 'decimal-comma')`.

- [ ] **Step 3: Insert the D1 block**

```python
    # D1 parse: values failing the column's dominant parse, labelled by the format they do match.
    for path, s in src.items():
        for c, f in s['facts'].items():
            v, t = f"NULLIF(trim({q(c)}), '')", s['t']
            if f['numeric'] or f['stamp']:
                ok = f"regexp_matches({v}, {quote(DEC)})" if f['numeric'] else f'TRY_CAST({v} AS TIMESTAMP) IS NOT NULL'
                label = ' '.join(f"WHEN regexp_matches({v}, {quote(rx)}) THEN {quote(name)}" for name, rx, _ in FORMATS)
                label = f"CASE WHEN {v} = {quote(c)} THEN 'header-text' {label} ELSE 'text' END"
                bad = f'FROM {t} WHERE {v} IS NOT NULL AND NOT {ok}'
                for issue, in db.execute(f'SELECT DISTINCT {label} {bad}').fetchall():
                    fix = next((fx for name, _, fx in FORMATS if name == issue), None)
                    add(path, c, 'parse', issue, f'SELECT rowid AS rid {bad} AND {label} = {quote(issue)}', fix)
            if f['numeric'] and f['decs'] > f['ints'] >= 0.999 * f['decs']:  # an integer column holding a few decimals
                add(path, c, 'parse', 'float-formatted', f"SELECT rowid AS rid FROM {t} WHERE regexp_matches({v}, '^[+-]?[0-9]+[.]0+$')",
                    r"regexp_replace({c}, '[.]0+$', '')")
                add(path, c, 'parse', 'non-integer', f"SELECT rowid AS rid FROM {t} WHERE regexp_matches({v}, {quote(DEC)}) AND NOT regexp_matches({v}, {quote(INT)}) AND NOT regexp_matches({v}, '^[+-]?[0-9]+[.]0+$')")

```

- [ ] **Step 4: Run all module tests**

Run: `.venv/bin/python -m pytest tests/python/test_data_findings.py -q`
Expected: `3 passed`. The clean pack must still have no findings.

- [ ] **Step 5: Commit**

```bash
git add bundled/harness-tools/data_findings.py tests/python/test_data_findings.py
git commit -m "feat: detect values failing a column's dominant parse"
```

---

### Task 3: D2 shape detector

**Files:**
- Modify: `bundled/harness-tools/data_findings.py`, inserting before `    out.mkdir(parents=True, exist_ok=True)`
- Test: `tests/python/test_data_findings.py`

- [ ] **Step 1: Write the failing test**

```python
def test_shape_finds_case_and_invisible_variants_of_codes(tmp_path):
    lines = [line(i) for i in range(2000)]
    lines[7], lines[207] = line(7, product_id='p007'), line(207, product_id='P007​')
    found = issues(pack(tmp_path, lines), 'lines.csv')
    assert found[('product_id', 'variant-of-common-value')]['rows'] == 2
```

- [ ] **Step 2: Run it to verify it fails**

Run: `.venv/bin/python -m pytest tests/python/test_data_findings.py -q -k shape`
Expected: FAIL with `KeyError: ('product_id', 'variant-of-common-value')`.

- [ ] **Step 3: Insert the D2 block**

```python
    # D2 shape: in code-like columns, near-duplicates of common values and rare character shapes.
    for path, s in src.items():
        for c in (c for c, f in s['facts'].items() if f['code']):
            t, norm = s['t'], f"upper(trim(regexp_replace({q(c)}, {quote(INVISIBLE)}, '', 'g')))"
            add(path, c, 'shape', 'variant-of-common-value',
                f'SELECT rowid AS rid FROM {t} WHERE {q(c)} <> {norm} AND {norm} IN (SELECT {q(c)} FROM {t} WHERE {q(c)} = {norm})',
                "upper(trim(regexp_replace({c}, '" + INVISIBLE + "', '', 'g')))")
            shape = f"regexp_replace(regexp_replace({q(c)}, '[0-9]', '9', 'g'), '[A-Za-z]', 'A', 'g')"
            shapes = db.execute(f"SELECT {shape} sh, count(*) n FROM {t} WHERE {q(c)} IS NOT NULL GROUP BY sh").fetchall()
            for sh, n in shapes if len(shapes) <= MAX_SHAPES else []:  # many shapes means free-form values, not codes
                if n >= RARE * s['facts'][c]['present']:
                    continue
                add(path, c, 'shape', f'rare-shape {sh}', f'SELECT rowid AS rid FROM {t} WHERE {shape} = {quote(sh)}')

```

- [ ] **Step 4: Run all module tests**

Run: `.venv/bin/python -m pytest tests/python/test_data_findings.py -q`
Expected: `4 passed`.

- [ ] **Step 5: Commit**

```bash
git add bundled/harness-tools/data_findings.py tests/python/test_data_findings.py
git commit -m "feat: detect code variants and rare shapes in code-like columns"
```

---

### Task 4: D3 domain detector

**Files:**
- Modify: `bundled/harness-tools/data_findings.py`, inserting before `    out.mkdir(parents=True, exist_ok=True)`
- Test: `tests/python/test_data_findings.py`

- [ ] **Step 1: Write the failing test**

```python
def test_domain_says_where_missing_keys_come_from(tmp_path):
    lines = [line(i) for i in range(2000)]
    lines[3], lines[4] = line(3, customer_id='Shop 3'), line(4, customer_id='9999')
    found = issues(pack(tmp_path, lines), 'lines.csv')
    assert found[('customer_id', f'value-of {tmp_path}/customers.csv:customer_name')]['rows'] == 1
    assert found[('customer_id', f'missing-from {tmp_path}/customers.csv')]['rows'] == 1
```

- [ ] **Step 2: Run it to verify it fails**

Run: `.venv/bin/python -m pytest tests/python/test_data_findings.py -q -k domain`
Expected: FAIL with a `KeyError` on the `value-of` key.

- [ ] **Step 3: Insert the D3 block**

A column shared by two or more sources is a key wherever it is at least 99% unique. The largest such source is its master. D7 reuses `masters`.

```python
    # D3 domain: values of a shared column missing from the source where that column is a key, and where they do occur.
    masters = {}
    for c in {c for s in src.values() for c in s['cols']}:
        keyed = [p for p, s in src.items() if c in s['facts'] and s['facts'][c]['unique']]
        if keyed and sum(c in s['cols'] for s in src.values()) > 1:
            masters[c] = max(keyed, key=lambda p: src[p]['rows'])
    lookups = [(p, c) for p in set(masters.values()) for c, f in src[p]['facts'].items() if not (f['numeric'] or f['stamp'])]
    for c, master in masters.items():
        keys = f"(SELECT {q(c)} FROM {src[master]['t']} WHERE {q(c)} IS NOT NULL)"
        for path, s in src.items():
            if path == master or c not in s['cols']:
                continue
            missing = f"FROM {s['t']} WHERE NULLIF(trim({q(c)}), '') IS NOT NULL AND {q(c)} NOT IN {keys}"
            if not db.execute(f'SELECT count(*) {missing}').fetchone()[0]:
                continue
            values = f'(SELECT DISTINCT {q(c)} {missing})'
            best = max(((db.execute(f"SELECT count(DISTINCT {q(oc)}) FROM {src[op]['t']} WHERE {q(oc)} IN {values}").fetchone()[0], op, oc)
                        for op, oc in lookups if (op, oc) != (master, c)), default=(0, None, None))
            if best[0]:
                found = f"(SELECT {q(best[2])} FROM {src[best[1]]['t']})"
                add(path, c, 'domain', f'value-of {best[1]}:{best[2]}', f'SELECT rowid AS rid {missing} AND {q(c)} IN {found}')
                missing += f' AND {q(c)} NOT IN {found}'
            add(path, c, 'domain', f'missing-from {master}', f'SELECT rowid AS rid {missing}')

```

- [ ] **Step 4: Run all module tests**

Run: `.venv/bin/python -m pytest tests/python/test_data_findings.py -q`
Expected: `5 passed`.

- [ ] **Step 5: Commit**

```bash
git add bundled/harness-tools/data_findings.py tests/python/test_data_findings.py
git commit -m "feat: detect missing keys and the column they really come from"
```

---

### Task 5: D4 uniqueness detector

**Files:**
- Modify: `bundled/harness-tools/data_findings.py`, inserting before `    out.mkdir(parents=True, exist_ok=True)`
- Test: `tests/python/test_data_findings.py`

- [ ] **Step 1: Write the failing test**

```python
def test_uniqueness_finds_repeats_conflicts_and_rekeyed_documents(tmp_path):
    lines = [line(i) for i in range(2000)] + [line(100)] + [line(i, line_id=f'L9{i:04d}', invoice_id='INV9999') for i in range(4, 8)]
    products = [f'P{i:03d},Item {i}' for i in range(200)] + ['P001,Other item']
    result = pack(tmp_path, lines, products)
    assert issues(result, 'lines.csv')[('*', 'repeated-row')]['rows'] == 1
    assert issues(result, 'lines.csv')[('invoice_id', 'repeated-document')]['examples'] == ['INV9999']
    assert issues(result, 'products.csv')[('product_id', 'duplicate-key conflicting')]['rows'] == 2
```

- [ ] **Step 2: Run it to verify it fails**

Run: `.venv/bin/python -m pytest tests/python/test_data_findings.py -q -k uniqueness`
Expected: FAIL with `KeyError: ('*', 'repeated-row')`.

- [ ] **Step 3: Insert the D4 block**

A "document" column is a non-unique column whose name ends in `id`, `no`, `num` or `number`, with at least 1% distinct values (an invoice ID, for example). A document whose set of lines exactly repeats an earlier document's lines is flagged. The comparison ignores key and document columns. This check is heuristic (`exact=False`).

```python
    # D4 uniqueness: repeated rows, conflicting duplicate keys, and whole documents repeated under new keys.
    for path, s in src.items():
        t, every = s['t'], ', '.join(q(c) for c in s['cols'])
        add(path, '*', 'uniqueness', 'repeated-row', f'SELECT rid FROM (SELECT rowid AS rid, row_number() OVER (PARTITION BY {every} ORDER BY rowid) n FROM {t}) WHERE n > 1')
        for c in (c for c, f in s['facts'].items() if f['unique'] and f['distinct'] < f['present']):
            add(path, c, 'uniqueness', 'duplicate-key conflicting',
                f'SELECT rowid AS rid FROM {t} WHERE {q(c)} IN (SELECT {q(c)} FROM {t} GROUP BY 1 HAVING count(DISTINCT hash({every})) > 1)')
        docs = [c for c, f in s['facts'].items() if not f['unique'] and f['distinct'] >= 0.01 * f['present'] > 0 and re.search(r'(^|_)(id|no|num|number)$', c, re.I)]
        for d in docs:
            rest = ', '.join(q(c) for c, f in s['facts'].items() if not f['unique'] and c not in docs) or 'NULL'
            add(path, d, 'uniqueness', 'repeated-document', f"""SELECT rowid AS rid FROM {t} WHERE {q(d)} IN (
                SELECT doc FROM (SELECT doc, fp, min(doc) OVER (PARTITION BY fp) earliest FROM (
                    SELECT {q(d)} doc, string_agg(hash({rest})::VARCHAR, ',' ORDER BY hash({rest})) fp FROM {t} GROUP BY 1)) WHERE doc <> earliest)""",
                exact=False)

```

- [ ] **Step 4: Run all module tests**

Run: `.venv/bin/python -m pytest tests/python/test_data_findings.py -q`
Expected: `6 passed`.

- [ ] **Step 5: Commit**

```bash
git add bundled/harness-tools/data_findings.py tests/python/test_data_findings.py
git commit -m "feat: detect repeated rows, conflicting keys and re-keyed documents"
```

---

### Task 6: D7 peer-ratio detector

**Files:**
- Modify: `bundled/harness-tools/data_findings.py`, inserting before `    out.mkdir(parents=True, exist_ok=True)`
- Test: `tests/python/test_data_findings.py`

- [ ] **Step 1: Write the failing test**

```python
def test_ratio_finds_scale_and_sign_errors_against_the_best_fitting_key(tmp_path):
    lines = [line(i) for i in range(2000)]
    lines[7], lines[8] = line(7, price='80.00'), line(8, price='-0.90')
    found = issues(pack(tmp_path, lines), 'lines.csv')
    assert found[('price', 'x1e2 vs product_id median')]['rows'] == 1
    assert found[('price', 'negative vs product_id median')]['rows'] == 1
```

- [ ] **Step 2: Run it to verify it fails**

Run: `.venv/bin/python -m pytest tests/python/test_data_findings.py -q -k ratio`
Expected: FAIL with a `KeyError` on the `x1e2` key.

- [ ] **Step 3: Insert the D7 block**

The detector:
1. For each numeric column, picks the key column (from D3's `masters`) whose group medians leave the fewest rows more than 5× away from their median.
2. Skips the column if even that best fit leaves 2% or more of rows far from the median. Values in such a column vary naturally (quantities, line values).
3. Reports only scale labels: powers of ten, ×12, and negative values. Plain outliers are dropped.

```python
    # D7 peer ratio: values a power of ten, twelve or a sign away from their key group's median, in columns those
    # medians describe well (the best-fitting key leaves under UNSTABLE of rows far from the median).
    for path, s in src.items():
        groups = [c for c in s['cols'] if c in masters and masters[c] != path]
        numbers = [c for c, f in s['facts'].items() if f['numeric'] and not f['unique'] and c not in masters]
        for m in numbers:
            fits = []
            for g in groups:
                ratio = f"""SELECT rowid AS rid, val / med AS r FROM (SELECT rowid, {q(g)} g, TRY_CAST({q(m)} AS DOUBLE) val FROM {s['t']}) x
                    JOIN (SELECT {q(g)} g, median(TRY_CAST({q(m)} AS DOUBLE)) med FROM {s['t']} GROUP BY 1 HAVING count({q(m)}) >= 3 AND med > 0) USING (g)
                    WHERE val <> 0 AND (val / med < {1 / RATIO} OR val / med > {RATIO})"""
                fits.append((db.execute(f'SELECT count(*) FROM ({ratio})').fetchone()[0], g, ratio))
            far, g, ratio = min(fits, default=(math.inf, None, None))
            if far >= UNSTABLE * s['facts'][m]['present']:
                continue
            for label, in db.execute(f"SELECT DISTINCT {RATIO_LABEL} FROM ({ratio}) WHERE {RATIO_LABEL} <> 'outlier'").fetchall():
                add(path, m, 'ratio', f'{label} vs {g} median', f'SELECT rid FROM ({ratio}) WHERE {RATIO_LABEL} = {quote(label)}', exact=False)

```

- [ ] **Step 4: Run all module tests**

Run: `.venv/bin/python -m pytest tests/python/test_data_findings.py -q`
Expected: `7 passed`.

- [ ] **Step 5: Commit**

```bash
git add bundled/harness-tools/data_findings.py tests/python/test_data_findings.py
git commit -m "feat: detect scale and sign errors against key-group medians"
```

---

### Task 7: Treatments and materiality helpers

**Files:**
- Modify: `bundled/harness-tools/data_findings.py`, inserting before `if __name__ == '__main__':`
- Test: `tests/python/test_data_findings.py`

- [ ] **Step 1: Write the failing tests**

```python
def test_treated_view_excludes_and_fixes_flagged_rows_only(tmp_path):
    lines = [line(i) for i in range(2000)]
    lines[10], lines[7] = line(10, price='"1,10"'), line(7, price='80.00')
    folder, result = pack(tmp_path, lines)
    found = issues((folder, result), 'lines.csv')
    comma, scale = found[('price', 'decimal-comma')]['id'], found[('price', 'x1e2 vs product_id median')]['id']
    conn = duckdb.connect()
    dw.attach_source(conn, dw.prepare_source(tmp_path / 'lines.csv', tmp_path / 'cache', dw.ImportOptions(format='csv')), 'l')
    source = str(tmp_path / 'lines.csv')
    df.treated_view(conn, 'l', source, folder, {comma: 'fix', scale: 'exclude'})
    assert conn.execute('SELECT count(*), sum(price::DOUBLE) FILTER (WHERE line_id = \'L00010\') FROM l_treated').fetchone() == (1999, 1.1)
    with pytest.raises(ValueError, match='unknown finding'):
        df.treated_view(conn, 'l', source, folder, {scale: 'fix'})


def test_sweep_reports_findings_that_change_the_answer_alone_or_once_others_are_excluded():
    answer = lambda excluded: 'A' if 'dup' not in excluded else ('B' if 'pence' not in excluded else 'C')
    assert df.sweep(answer, ['dup', 'pence', 'noise']) == ['dup', 'pence']
```

The sweep test copies the real benchmark case. The duplicate master row changes the answer on its own. The pence prices change it only once the duplicate is excluded, so a one-at-a-time check would miss them.

- [ ] **Step 2: Run them to verify they fail**

Run: `.venv/bin/python -m pytest tests/python/test_data_findings.py -q -k "treated or sweep"`
Expected: FAIL with `AttributeError: module 'data_findings' has no attribute 'treated_view'`.

- [ ] **Step 3: Insert the helpers before `if __name__ == '__main__':`**

```python
def treated_view(conn, alias, source, findings_dir, treatments, view=None):
    """Create <alias>_treated over <alias>.raw: drop rows of 'exclude' findings, rewrite the column of 'fix' findings."""
    known = {f['id']: f for f in json.loads((Path(findings_dir) / 'findings.json').read_text())['findings'] if f['source'] == source}
    bad = {i: t for i, t in treatments.items() if i not in known or t not in ('keep', 'exclude', 'fix') or (t == 'fix' and not known[i]['fix'])}
    if bad:
        raise ValueError(f'unknown finding, treatment or missing fix for {source}: {bad}')
    flags = f"read_parquet({quote(Path(findings_dir) / 'flags.parquet')})"
    rows = lambda ids: f"rowid IN (SELECT rid FROM {flags} WHERE finding IN ({', '.join(map(quote, ids))}))"
    cols = []
    for c, *_ in conn.execute(f'DESCRIBE {q(alias)}.raw').fetchall():
        expr = q(c)
        for i in (i for i, t in treatments.items() if t == 'fix' and known[i]['column'] == c):
            expr = f"CASE WHEN {rows([i])} THEN {known[i]['fix']} ELSE {expr} END"
        cols.append(f'{expr} AS {q(c)}')
    dropped = [i for i, t in treatments.items() if t == 'exclude']
    view = view or f'{alias}_treated'
    conn.execute(f"CREATE OR REPLACE VIEW {q(view)} AS SELECT {', '.join(cols)} FROM {q(alias)}.raw" + (f' WHERE NOT {rows(dropped)}' if dropped else ''))
    return view


def sweep(run, finding_ids):
    """Return the finding IDs whose exclusion changes run's result, starting from keeping every finding and from
    excluding all the others. run(excluded_ids) recomputes the answer.
    shortcut: no other combinations are tried; add them if a workspace needs them."""
    every = frozenset(finding_ids)
    keep, drop = run(frozenset()), run(every)
    return [i for i in finding_ids if run(frozenset({i})) != keep or run(every - {i}) != drop]


```

- [ ] **Step 4: Run the module tests and the whole Python suite**

Run: `.venv/bin/python -m pytest tests/python/test_data_findings.py -q && npm run test:python`
Expected: `9 passed` for the module, then the full Python suite passes.

- [ ] **Step 5: Commit**

```bash
git add bundled/harness-tools/data_findings.py tests/python/test_data_findings.py
git commit -m "feat: apply confirmed treatments and test which findings matter"
```

---

### Task 8: TypeScript adapter

**Files:**
- Create: `src/agent/workflow/data-findings.ts`
- Test: `tests/integration/data-findings.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/integration/data-findings.test.ts`:

```ts
import {expect, it} from 'vitest';
import {existsSync} from 'node:fs';
import {mkdtemp, mkdir, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {compactFindings, createFindingDetector, type DataFinding} from '../../src/agent/workflow/data-findings.js';
const python = resolve('.venv/bin/python');
const finding = (i: number): DataFinding => ({
  id: `F-${i}`,
  detector: 'parse',
  source: 'files/s.csv',
  column: 'amount',
  issue: 'decimal-comma',
  rows: 1,
  valueAtStake: 100 - i,
  valueColumn: 'amount',
  examples: ['1,5'],
  fix: null,
  exact: true,
});
it('keeps the largest findings within the prompt bound and reports the total', () => {
  const all = Array.from({length: 100}, (_, i) => finding(i));
  const compact = compactFindings({findingsDir: '/c', findings: all}, 2000);
  expect(compact.total).toBe(100);
  expect(compact.findings[0].id).toBe('F-0');
  expect(compact.findings.length).toBeLessThan(100);
  expect(JSON.stringify(compact.findings).length).toBeLessThanOrEqual(2000);
});
it.skipIf(!existsSync(python))('detects findings in a real CSV with the bundled Python helper', async () => {
  const root = await mkdtemp(join(tmpdir(), 'findings-'));
  await mkdir(join(root, 'files'));
  const rows = Array.from({length: 40}, (_, i) => `${i + 1}.5,x`);
  await writeFile(join(root, 'files/s.csv'), ['amount,label', ...rows, '"1,5",x'].join('\n') + '\n');
  const detect = createFindingDetector(
    {pythonPath: python, bundledRoot: resolve('bundled'), workspaceRoot: root},
    join(root, 'cache'),
  );
  const result = await detect([
    {id: '1', name: 's.csv', relativePath: 'files/s.csv', bytes: 1, sha256: 'abc', addedAt: '', kind: 'csv'},
  ]);
  expect(result?.findings.map(f => [f.source, f.column, f.issue])).toEqual([['files/s.csv', 'amount', 'decimal-comma']]);
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/integration/data-findings.test.ts`
Expected: FAIL, failing to resolve `../../src/agent/workflow/data-findings.js`.

- [ ] **Step 3: Write the adapter**

Create `src/agent/workflow/data-findings.ts`:

```ts
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {join} from 'node:path';
import type {HarnessConfig} from '../../runtime.js';
import type {SourceFile} from '../../contracts.js';
import {analysisEnvironment} from '../session.js';
const exec = promisify(execFile);
export type DataFinding = {
  id: string;
  detector: string;
  source: string;
  column: string;
  issue: string;
  rows: number;
  valueAtStake: number | null;
  valueColumn: string | null;
  examples: (string | null)[];
  fix: string | null;
  exact: boolean;
};
export type DataFindings = {findingsDir: string; findings: DataFinding[]};
// Python caches findings by source content, so repeat runs are cheap; sources are passed workspace-relative.
export function createFindingDetector(
  config: Pick<HarnessConfig, 'pythonPath' | 'bundledRoot' | 'workspaceRoot'>,
  cacheRoot: string,
) {
  return async (sources: SourceFile[]): Promise<DataFindings | undefined> => {
    // shortcut: CSV only; add explicit XLSX sheets when a workspace needs them.
    const csv = sources.filter(s => s.kind === 'csv');
    if (!csv.length) return undefined;
    const {stdout} = await exec(
      config.pythonPath,
      [
        join(config.bundledRoot, 'harness-tools/data_findings.py'),
        '--cache',
        cacheRoot,
        ...csv.flatMap(s => ['--source', s.relativePath]),
      ],
      {
        cwd: config.workspaceRoot,
        timeout: 600000,
        maxBuffer: 64 * 1024 * 1024,
        env: analysisEnvironment(process.env),
      },
    );
    const {findingsDir, findings} = JSON.parse(stdout) as DataFindings;
    return {findingsDir, findings};
  };
}
// Prompt form: findings arrive largest value at stake first; keep a prefix within maxChars. The full list stays on disk.
export function compactFindings(result: DataFindings, maxChars = 12000) {
  const findings = [...result.findings];
  while (findings.length && JSON.stringify(findings).length > maxChars) findings.pop();
  return {findingsDir: result.findingsDir, total: result.findings.length, findings};
}
export type CompactFindings = ReturnType<typeof compactFindings>;
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/integration/data-findings.test.ts && npm run typecheck`
Expected: 2 tests pass and the typecheck is clean.

- [ ] **Step 5: Commit**

```bash
npx prettier --write src/agent/workflow/data-findings.ts tests/integration/data-findings.test.ts
git add src/agent/workflow/data-findings.ts tests/integration/data-findings.test.ts
git commit -m "feat: run data findings from the harness and bound them for prompts"
```

---

### Task 9: Wire findings into the orchestrator and stage prompt

**Files:**
- Modify: `src/agent/workflow/stage-prompt.ts`
- Modify: `src/agent/workflow/orchestrator.ts`
- Modify: `src/agent/runs.ts`
- Modify: `tests/fixtures/workflow-flow.ts`
- Test: `tests/integration/data-findings.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `tests/integration/data-findings.test.ts`, and add `import {createFlow} from '../fixtures/workflow-flow.js';` to its imports:

```ts
it('passes findings to every stage prompt', async () => {
  const f = await createFlow({findData: async () => ({findingsDir: '/c', findings: [finding(0)]})});
  await f.run();
  expect(f.envelopes.length).toBeGreaterThan(1);
  for (const envelope of f.envelopes) expect(envelope.dataFindings).toMatchObject({total: 1, findingsDir: '/c'});
});
it('runs without findings when detection fails', async () => {
  const f = await createFlow({
    findData: async () => {
      throw new Error('detector crashed');
    },
  });
  await f.run();
  expect(f.envelopes.length).toBeGreaterThan(1);
  for (const envelope of f.envelopes) expect(envelope.dataFindings).toBeUndefined();
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/integration/data-findings.test.ts`
Expected: the typecheck inside vitest fails, or the first new test fails with `dataFindings` undefined. `createFlow` doesn't accept `findData` yet.

- [ ] **Step 3: Pass the option through the test fixture**

In `tests/fixtures/workflow-flow.ts`, add to `FlowOptions`, after `profileSources?: ...;`:

```ts
  findData?: (sources: any[]) => Promise<any>;
```

In the `new WorkflowOrchestrator({...})` call, after `profileSources: options.profileSources,`:

```ts
    findData: options.findData,
```

- [ ] **Step 4: Add the envelope field**

In `src/agent/workflow/stage-prompt.ts`, add the import after the `PromptProfile` import:

```ts
import type {CompactFindings} from './data-findings.js';
```

In `StagePromptInput`, after `sourceProfiles: PromptProfile[];`:

```ts
  dataFindings?: CompactFindings;
```

In the object passed to `JSON.stringify`, after `sourceProfiles: p.sourceProfiles,`:

```ts
    dataFindings: p.dataFindings,
```

- [ ] **Step 5: Run detection in the orchestrator**

In `src/agent/workflow/orchestrator.ts`, add the import after the `source-profiles.js` import:

```ts
import {compactFindings, type CompactFindings, type DataFindings} from './data-findings.js';
```

In the constructor options type, after `profileSources?: (sources: SourceFile[]) => Promise<SourceProfile[]>;`:

```ts
      findData?: (sources: SourceFile[]) => Promise<DataFindings | undefined>;
```

After `let sourceProfiles: PromptProfile[] = [];`:

```ts
    let dataFindings: CompactFindings | undefined;
```

In the `buildStagePrompt({...})` call, after `sourceProfiles,`:

```ts
        dataFindings,
```

Right after the profiling block, which ends with the `await log.append({type: 'source_profiles', ...});` call and its closing `}`, insert:

```ts
      if (this.options.findData) {
        // Findings are advisory facts: a detector failure is logged and the run continues without them.
        try {
          const found = await this.options.findData(sources);
          dataFindings = found && compactFindings(found);
          await log.append({type: 'data_findings', total: found?.findings.length ?? 0});
        } catch (error) {
          await log.append({type: 'data_findings', error: String((error as Error).message).slice(0, 300)});
        }
      }
```

- [ ] **Step 6: Wire the real detector**

In `src/agent/runs.ts`, add after the `createSourceProfiler` import:

```ts
import {createFindingDetector} from './workflow/data-findings.js';
```

After `profileSources: createSourceProfiler(config, paths.cache),`:

```ts
        findData: createFindingDetector(config, paths.cache),
```

- [ ] **Step 7: Run the tests, typecheck and full vitest suite**

Run: `npx vitest run tests/integration/data-findings.test.ts && npm run typecheck && npm test`
Expected: 4 data-findings tests pass and the full suite passes, 336 existing tests plus the new ones. Detection only runs when `findData` is supplied, so existing flows are unaffected.

- [ ] **Step 8: Commit**

```bash
npm run format
git add src/agent/workflow/stage-prompt.ts src/agent/workflow/orchestrator.ts src/agent/runs.ts tests/fixtures/workflow-flow.ts tests/integration/data-findings.test.ts
git commit -m "feat: give every stage the run's data findings"
```

---

### Task 10: Prompt and guide changes

**Files:**
- Modify: `src/agent/workflow/role-prompts.ts`
- Modify: `bundled/harness-tools/data-analysis.md`
- Modify: `docs/architecture.md`
- Test: existing `tests/unit/workflow-coordinator.test.ts`, which enforces the word caps

- [ ] **Step 1: Add the analyst and verifier sentences**

In `src/agent/workflow/role-prompts.ts`, edit only these two prompts. The coordinator is at 109 of 110 words and needs no change: it already records newly confirmed definitions.

Analyst (101 → 110 words). Append before the closing backtick, after `then return {"fromExecution":true}.`:

```
 Treat dataFindings as data-analysis.md describes before approving claims.
```

Verifier (82 → 93 words). Append before the closing backtick:

```
 Apply dataFindings treatments confirmed in confirmedContext using treated_view from data_findings.py.
```

- [ ] **Step 2: Add the guide section**

In `bundled/harness-tools/data-analysis.md`, insert this section after the "## Source profiles" section and before "## Executed self-checks and conditional review":

````markdown
## Data findings

`dataFindings` lists anomalies code found in the CSV sources. The largest value at stake comes first. `total` counts all of them, and the full list is `findingsDir/findings.json`. Each finding has:
- `id`
- `detector`: `parse`, `shape`, `domain`, `uniqueness` or `ratio`
- `source` and `column`
- `issue`
- `rows`
- `valueAtStake`, summed from `valueColumn`
- `examples`
- `fix`: a lossless SQL rewrite, or null
- `exact`: false for heuristic detectors

Findings are facts, not decisions. Never drop or rewrite flagged rows on your own judgement.

Treatments come from the user and appear in confirmed context as `Data finding <id>: keep|exclude|fix`. Apply them to the source's raw table:

```python
from data_findings import treated_view, sweep
treated_view(conn, 'sales', 'files/data/sales.csv', findings_dir, {'F-1a2b3c': 'exclude', 'F-4d5e6f': 'fix'})
# then read sales_treated instead of sales.raw
```

For pending findings (those with no confirmed treatment) on the sources and columns your answer uses:
1. Write the calculation as `run(excluded_ids)`. It should return the conclusion you would report, such as the ranked IDs or a value rounded to the reported precision.
2. Call `sweep(run, ids)`. It returns the IDs that change that conclusion.
3. If it returns none, approve as usual and list the pending IDs in coverage.
4. If it returns some, hold the affected claims and add one review reason: `{"kind": "definition", "question": "Data findings F-…: keep, exclude or fix? <one line per finding on what changes>"}`. Only findings with a non-null `fix` can be fixed.
````

- [ ] **Step 3: Add the architecture paragraph**

In `docs/architecture.md`, after the paragraph that begins "Every stage prompt carries the source profiles", add:

```markdown
Every stage prompt also carries `dataFindings` (`data-findings.ts`, `bundled/harness-tools/data_findings.py`). Before each run, five generic detectors (parse, shape, domain, uniqueness, peer ratio) flag anomalous rows in the CSV sources. Results are cached by source content and capped at 12,000 characters in the prompt. Code only flags rows. The user chooses treatments through the existing `definition` question, and they are stored as confirmed context. The analyst applies them with `treated_view` and asks only about findings that `sweep` shows would change the answer. A detector failure is logged and never blocks a run.
```

- [ ] **Step 4: Run the prompt caps and the whole suite**

Run: `npx vitest run tests/unit/workflow-coordinator.test.ts tests/integration/analyst-handoff-lifecycle.test.ts && npm test`
Expected: PASS. If a cap fails, shorten the added sentence; don't raise the cap.

- [ ] **Step 5: Commit**

```bash
git add src/agent/workflow/role-prompts.ts bundled/harness-tools/data-analysis.md docs/architecture.md
git commit -m "docs: tell analyst and verifier how to treat data findings"
```

---

### Task 11: Verification ticket: score against the seeded pack

**Files:**
- Create: `tests/evals/seed_anomalies.py`, copied unchanged from the research prototype
- Create: `tests/evals/score_findings.py`

- [ ] **Step 1: Copy the generator into the repo**

```bash
cp docs/research/messy-data-determinism-2026-10-13/prototype/seed_anomalies.py tests/evals/seed_anomalies.py
```

- [ ] **Step 2: Create the scorer**

Create `tests/evals/score_findings.py`:

```python
"""Score data findings against a seeded pack's answer key.

Usage: python -I score_findings.py <seeded findings.json output> <clean findings.json output> <answer key csv>
A plant is caught when findings flag at least 90% of its rows. A seeded finding is unexplained when it flags no planted
row and its ID does not occur on the clean pack.
"""
import json
import sys
from pathlib import Path

import duckdb

seeded, clean, key = (json.loads(Path(sys.argv[1]).read_text()), json.loads(Path(sys.argv[2]).read_text()), sys.argv[3])
db = duckdb.connect()
flags = f"read_parquet('{seeded['findingsDir']}/flags.parquet')"
db.execute(f"CREATE TABLE f AS SELECT * FROM read_json_auto('{sys.argv[1]}', maximum_object_size=100000000)")
db.execute("CREATE TABLE findings AS SELECT unnest(findings, recursive := true) FROM f")
db.execute(f"CREATE TABLE plants AS SELECT plant, 'files/data/' || tbl || '.csv' AS source, row_no - 1 AS rid FROM read_csv('{key}')")
db.execute(f"CREATE TABLE hits AS SELECT x.rid, g.* FROM {flags} x JOIN findings g ON g.id = x.finding")
caught = db.execute("""SELECT plant, count(DISTINCT p.rid) AS n, count(DISTINCT h.rid) AS flagged,
    string_agg(DISTINCT h.detector || ':' || h.issue, '; ') AS by_findings
    FROM plants p LEFT JOIN hits h ON h.rid = p.rid AND h.source = p.source GROUP BY 1 ORDER BY flagged / n, 1""").fetchall()
for plant, rows, flagged, by in caught:
    print(f"{'CAUGHT' if flagged >= 0.9 * rows else 'missed'} {plant:32} {flagged}/{rows}  {by or ''}"[:220])
print(f'caught {sum(f >= 0.9 * r for _, r, f, _ in caught)}/{len(caught)} plants')
natural = {f['id'] for f in clean['findings']}
unexplained = db.execute("""SELECT id, detector, source, "column", issue, "rows" FROM findings WHERE id NOT IN (SELECT unnest(?::VARCHAR[]))
    AND id NOT IN (SELECT h.id FROM hits h JOIN plants p USING (source, rid))""",
                         [sorted(natural)]).fetchall()
print(f'findings: seeded {len(seeded["findings"])}, clean {len(natural)}, unexplained {len(unexplained)}')
for u in unexplained:
    print('  unexplained', u)
```

- [ ] **Step 3: Rebuild the seeded pack if it is missing**

```bash
test -d workspace/northbridge-seeded/files/data || .venv/bin/python -I tests/evals/seed_anomalies.py workspace/northbridge-test/files workspace/northbridge-seeded/files .cache/seeded-pack/answer_key.csv
```

Expected: either nothing, because the pack exists, or `2544 rows planted across 37 plants`.

- [ ] **Step 4: Run the detectors on both packs and score**

```bash
APP=$PWD; CACHE=$APP/.cache/findings-score
for W in northbridge-seeded northbridge-test; do
  (cd workspace/$W && time $APP/.venv/bin/python -I $APP/bundled/harness-tools/data_findings.py --cache $CACHE $(for f in files/data/*.csv; do echo --source $f; done) > $APP/.cache/findings-$W.json)
done
.venv/bin/python -I tests/evals/score_findings.py .cache/findings-northbridge-seeded.json .cache/findings-northbridge-test.json .cache/seeded-pack/answer_key.csv
```

Acceptance (this is what the prototype achieved):
- `caught 30/37 plants` or better. `price_in_pence` and `product_duplicate_key` must both be CAUGHT, because they flip the benchmark answer.
- The only misses are the known ones:
  - `cost_dates_reversed`, `cost_interval_overlap` and `date_future_year`: these need D6, which is deferred.
  - `quantity_extra_zeros` and `value_not_quantity_times_price`: these need D5, which is deferred.
  - `silent_currency`: no detector covers ×1.17.
  - `price_decimal_shift`: partly caught, about 11 of 15 rows, because tier pricing blurs the ×0.1 ratio.
- `unexplained 0`, with about 90 natural findings on the clean pack.
- Each pack takes 60 s or less cold on this Mac. A second run takes a few seconds, because results are cached.

If a result differs, investigate before changing thresholds. Thresholds are generic and must not be tuned to this pack's tables.

- [ ] **Step 5: Check materiality on the benchmark trap**

```bash
cd workspace/northbridge-seeded && ../../.venv/bin/python -I -c "
import sys, json; sys.path.insert(0, '../../bundled/harness-tools')
import data_findings as d, data_workspace as w
from pathlib import Path
r = json.load(open('../../.cache/findings-northbridge-seeded.json')); fd = r['findingsDir']
F = {(f['source'].split('/')[-1], f['issue']): f['id'] for f in r['findings']}
conn = w.connect_analysis(Path('../../.cache/findings-score-run'), Path('../../.cache/findings-score-tmp'), fresh=True)
for a, n in [('s', 'sales_transactions'), ('pm', 'product_master'), ('pc', 'product_cost_history')]:
    w.attach_source(conn, w.prepare_source(Path(f'files/data/{n}.csv'), Path('../../.cache/findings-score'), w.ImportOptions(format='csv')), a)
dup, pence = F[('product_master.csv', 'duplicate-key conflicting')], F[('sales_transactions.csv', 'x1e2 vs product_id median')]
neg = F[('sales_transactions.csv', 'negative vs product_id median')]
def run(ex):
    d.treated_view(conn, 's', 'files/data/sales_transactions.csv', fd, {i: 'exclude' for i in ex if i != dup})
    d.treated_view(conn, 'pm', 'files/data/product_master.csv', fd, {i: 'exclude' for i in ex if i == dup})
    return conn.execute('''SELECT s.product_id FROM s_treated s JOIN pm_treated USING (product_id) JOIN pc.raw c ON c.product_id = s.product_id
        AND c.cost_status <> 'PROPOSED' AND c.currency = 'GBP' AND c.cost_uom = 'EA'
        AND try_cast(s.transaction_timestamp AS TIMESTAMP) >= c.valid_from::DATE AND try_cast(s.transaction_timestamp AS TIMESTAMP) < c.valid_to::DATE
        GROUP BY 1 ORDER BY sum(try_cast(s.line_value_gbp AS DOUBLE) - try_cast(s.quantity AS DOUBLE) * c.unit_cost_gbp::DOUBLE) DESC LIMIT 1''').fetchone()[0]
print('kept:', run(frozenset()), '| both excluded:', run(frozenset({dup, pence})), '| material:', d.sweep(run, [dup, pence, neg]) == [dup, pence])
"
```

Expected: `kept: 47566 | both excluded: 22423 | material: True`.

- [ ] **Step 6: Commit the eval tools**

```bash
cd pricing-harness
git add tests/evals/seed_anomalies.py tests/evals/score_findings.py
git commit -m "test: seeded anomaly pack generator and findings scorer"
```

---

### Task 12: Verification ticket: suites, size budget and ponytail ultra

**Files:** none new. Fixes go into the files above.

- [ ] **Step 1: Full suites and formatting**

```bash
npm run typecheck && npm test && npm run test:python && npm run format:check
```

Expected: all pass. Run `npm run format` if the format check fails, then commit.

- [ ] **Step 2: Size budget**

```bash
wc -l bundled/harness-tools/data_findings.py src/agent/workflow/data-findings.ts
git diff main --stat -- src bundled ':!*.md'
```

Expected: `data_findings.py` is 215 lines or fewer and `data-findings.ts` is 60 or fewer. The total non-test, non-doc diff should be under 300 lines.

- [ ] **Step 3: Run `/anthropic-skills:ponytail ultra` on the feature diff**

Invoke the skill with arguments `ultra` and the files from Step 2. Apply only changes that:
1. keep all tests and the Task 11 acceptance results unchanged
2. make the code shorter or remove something the need doesn't justify

Re-run Task 11 Step 4 after any change to `data_findings.py`.

- [ ] **Step 4: Commit**

```bash
git add -A src bundled tests docs/architecture.md
git commit -m "refactor: ponytail ultra pass on data findings"
```

Skip the commit if ponytail changed nothing.

---

### Task 13: Verification ticket: live agent comparison (requires user approval before spending)

**Files:** research tooling only, uncommitted: `docs/research/messy-data-determinism-2026-10-13/prototype/run_experiment.py`, `EXPERIMENT.md`.

- [ ] **Step 1: Ask the user to approve the budget**

Ask: "Run the seeded benchmark: Luna and DeepSeek 4.1 Flash at high reasoning, the main branch against feat/data-findings, $0.20 per variant ($0.40 total)?" Do not continue without a yes.

- [ ] **Step 2: Let the runner take the template workspace from the environment**

In `run_experiment.py`, replace:

```python
template = app / 'workspace/northbridge-test'
```

with:

```python
template = Path(os.environ.get('TEMPLATE', app / 'workspace/northbridge-test'))
```

Create the seeded template's `.pricing` folder, because the runner copies `context.md` and `files.json` from it:

```bash
mkdir -p workspace/northbridge-seeded/.pricing/data-cache
cp workspace/northbridge-test/.pricing/context.md workspace/northbridge-seeded/.pricing/
echo '[]' > workspace/northbridge-seeded/.pricing/files.json
```

An empty `files.json` makes the harness adopt the files on first open (`src/files.ts` `adopt`).

- [ ] **Step 3: Make a main-branch worktree for the baseline**

```bash
git -C .. worktree add /tmp/pricing-main main
ln -s $PWD/node_modules /tmp/pricing-main/pricing-harness/node_modules
ln -s $PWD/.venv /tmp/pricing-main/pricing-harness/.venv
cp .env /tmp/pricing-main/pricing-harness/.env
```

- [ ] **Step 4: Run both variants**

Use the same question and models as experiments 1 and 2.

```bash
Q="what sku had the highest absolute gross margin"
P=docs/research/messy-data-determinism-2026-10-13/prototype/run_experiment.py
TEMPLATE=$PWD/workspace/northbridge-seeded .venv/bin/python -I $P /tmp/pricing-main/pricing-harness .cache/seeded-run/main baseline 0.2 "$Q" openai/gpt-6-luna:0.1 deepseek/deepseek-v4.1-flash:0.1
TEMPLATE=$PWD/workspace/northbridge-seeded .venv/bin/python -I $P $PWD .cache/seeded-run/findings baseline 0.2 "$Q" openai/gpt-6-luna:0.1 deepseek/deepseek-v4.1-flash:0.1
```

The variant name `baseline` only means that no index is used. The two app roots are what differ.

- [ ] **Step 5: Record the results**

Append "Experiment 3: seeded pack, main vs data findings" to `EXPERIMENT.md`. For each model and variant, record wall time, cost, stages and the outcome. The outcome is one of:
- correct: 22423, £139,548.15
- wrong: name the trap it fell for
- asked: name the finding IDs it asked about

Also record whether the asked question named the material findings `F-…` (the duplicate key and the pence prices).

- [ ] **Step 6: Remove the worktree**

```bash
git -C .. worktree remove /tmp/pricing-main
```

---

### Task 14: Wrap-up

- [ ] **Step 1: Update the design note status**

In `docs/research/messy-data-determinism-2026-10-13/ANOMALIES.md`, change the status line to say D1–D4 and D7 are implemented on `feat/data-findings`. Add the Task 11 scores and, if Task 13 ran, the outcome. The note stays uncommitted.

- [ ] **Step 2: Report to the user**

Report:
- commits on `feat/data-findings`
- the Task 11 score table
- the line counts
- the ponytail result
- Task 13 results, or that they await approval
- any deviations from this plan

Do not push or open a PR unless asked.

---

## Self-review notes

- **Spec coverage:**
  - D1–D4 and D7: Tasks 2–6.
  - D5, D6 and D8 are not built, as agreed.
  - Wiring into existing code: Tasks 8–10.
  - Treatments use the existing `definition` → ask-user → `confirmedDefinitions` path. No new storage or UI.
  - Verification and testing tickets: Tasks 7, 11, 12 and 13.
  - Compactness and ponytail ultra: Task 12.
- **Known limits, documented in code as `shortcut:` comments:**
  - CSV only, no XLSX.
  - `sweep` tests each finding alone and with all the others excluded, not other combinations.
  - The D3 `fix` is null: remapping a name to a key through the master is left to a user-confirmed manual step.
- **Type consistency:**
  - `DataFinding` and `DataFindings` match the Python JSON keys.
  - `CompactFindings` is `{findingsDir, total, findings}` everywhere.
  - `findData` is the orchestrator option name, both in `runs.ts` and in the fixture.
