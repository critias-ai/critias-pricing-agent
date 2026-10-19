# Code-owned data findings check: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Code, not the model, decides which data findings matter. The analyst passes its calculation to `emit_handoff`, which re-runs it with each unconfirmed finding excluded or fixed, holds the claims that change, and asks the user one fixed-wording question.

**Architecture:** Three pieces. `data_findings.py` gains `findings_views` (CSV sources as views with confirmed treatments applied) and `check_findings` (per-claim sweep over every unconfirmed finding on the claims' `sourcePaths`). `harness_output.emit_handoff` gains `conn=` and `answer=` and runs the check whenever the stage folder has a `data-findings.json`. The orchestrator writes that file into every analyst and verifier stage folder: findings location, cache, workspace root, CSV sources and the treatments confirmed in `context.md`.

**Tech stack:** Python 3 with DuckDB (bundled harness tools), TypeScript (orchestrator), pytest, vitest.

**Why (evidence):** in Experiment 3 (`docs/research/messy-data-determinism-2026-10-13/EXPERIMENT.md`, local and uncommitted) both findings-branch runs ran out of time writing sweep code. Luna's guide-scoped sweep also skipped the `unit_price_gbp` pence finding, because it filtered findings by column. A scratch prototype of this plan on `workspace/northbridge-seeded` held the top-SKU claim and named both traps: pence `x1e2` and the product-master `duplicate-key conflicting`. The check took 13 s for 82 findings at 0.08 s per answer.

**Decisions already made with the user (do not revisit):**
- Option B: the check is enforced at `emit_handoff`, not left to the guide.
- Hold only the claims that change, not every claim.
- Scope is every unconfirmed finding on the claims' `sourcePaths`, with no column filter. Checking `sourcePaths` against actual reads is out of scope.
- **No** "keep the last good answer on timeout": the user rejected it because it adds quality variation.
- Code makes no business decisions. A natural finding that changes a claim is asked about once; the confirmed treatment then stops the question.

**Branch:** continue on `feat/data-findings` (HEAD `b5a53f5` at plan time). Never push. Never stage `docs/research/messy-data-determinism-2026-10-13/`. Tasks 8 and 9 spend money: ask the user first.

**Baseline before starting:** `npm run typecheck`, `npm test` (343 passed), `npm run test:python` (48 passed), `npm run format:check`. Run them all from `pricing-harness/`.

---

## File map

| File | Change | Responsibility |
|---|---|---|
| `bundled/harness-tools/data_findings.py` | modify | `sweep` returns per-key changes; new `_context`, `findings_views`, `check_findings` |
| `bundled/harness-tools/harness_output.py` | modify | `emit_handoff(..., conn=, answer=)` runs the check, holds changed claims, adds the question |
| `src/agent/workflow/data-findings.ts` | modify | `findingsContext()` builds the stage file contents |
| `src/agent/workflow/orchestrator.ts` | modify | Writes `data-findings.json` into analyst and verifier stage folders and protects it with the controller refs |
| `bundled/harness-tools/data-analysis.md` | modify | Data findings section shrinks to the `answer` recipe |
| `src/agent/workflow/role-prompts.ts` | modify | Analyst and verifier sentences point at the new helpers |
| `tests/python/test_data_findings.py` | modify | Sweep tests use dicts; new check and handoff tests |
| `tests/integration/data-findings.test.ts` | modify | Stage file test |

Expected size: `data_findings.py` 215 to about 261 lines, `harness_output.py` 86 to about 97, TypeScript about +20.

---

### Task 1: `sweep` reports which result keys each finding changes

**Files:**
- Modify: `bundled/harness-tools/data_findings.py` (the `sweep` function, about lines 249-256)
- Test: `tests/python/test_data_findings.py` (three sweep tests)

- [ ] **Step 1: Rewrite the three sweep tests to the dict form**

In `tests/python/test_data_findings.py`, replace `test_sweep_reports_findings_that_change_the_answer_alone_or_once_others_are_excluded` with:

```python
def test_sweep_maps_findings_to_the_keys_they_change_alone_or_once_others_are_treated():
    answer = lambda ids: {'top': 'A' if 'dup' not in ids else ('B' if 'pence' not in ids else 'C'), 'rows': 3}
    assert df.sweep(answer, ['dup', 'pence', 'noise']) == {'dup': ['top'], 'pence': ['top']}
```

In `test_pending_sweep_retains_confirmed_treatments`, replace the end of `run` and the three assertions with:

```python
            return {'top': conn.execute('SELECT product FROM probe GROUP BY product ORDER BY sum(amount::DOUBLE) DESC LIMIT 1').fetchone()[0]}

        assert df.sweep(run, ['F-pending']) == {'F-pending': ['top']}
        assert run([]) == {'top': 'B'}
        assert run(['F-pending']) == {'top': 'A'}
```

Replace `test_sweep_accepts_a_one_shot_iterable` with:

```python
def test_sweep_accepts_a_one_shot_iterable():
    answer = lambda ids: {'top': 'A' if 'dup' not in ids else ('B' if 'pence' not in ids else 'C')}
    assert df.sweep(answer, (i for i in ['dup', 'pence', 'noise'])) == {'dup': ['top'], 'pence': ['top']}
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `.venv/bin/python -m pytest tests/python/test_data_findings.py -q -k sweep`
Expected: 6 failed. The old `sweep` returns a list.

- [ ] **Step 3: Replace `sweep`**

Replace the whole `def sweep(...)` function in `bundled/harness-tools/data_findings.py` with:

```python
def sweep(run, finding_ids):
    """Map each finding ID to the keys of run's result that change when it alone is treated, or when every other
    finding is. run(ids) recomputes the answer as a dict.
    shortcut: no other combinations are tried; add them if a workspace needs them."""
    finding_ids = list(finding_ids)
    keep, every = run(frozenset()), run(frozenset(finding_ids))
    changed = {}
    for i in finding_ids:
        one, rest = run(frozenset({i})), run(frozenset(finding_ids) - {i})
        if keys := sorted(k for k in keep.keys() | every.keys() if one.get(k) != keep.get(k) or rest.get(k) != every.get(k)):
            changed[i] = keys
    return changed
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `.venv/bin/python -m pytest tests/python/test_data_findings.py -q`
Expected: all pass (30).

- [ ] **Step 5: Commit**

```bash
git add bundled/harness-tools/data_findings.py tests/python/test_data_findings.py
git commit -m "refactor: report which result keys each data finding changes"
```

---

### Task 2: `findings_views` and `check_findings`

**Files:**
- Modify: `bundled/harness-tools/data_findings.py` (imports at the top; new functions after `sweep`, before `if __name__ == '__main__':`)
- Test: `tests/python/test_data_findings.py` (append)

- [ ] **Step 1: Write the failing tests**

Add `import io` to the imports at the top of `tests/python/test_data_findings.py`, above `import json`. Then append:

```python
ho = load('harness_output')


def staged(tmp_path, monkeypatch, lines, confirmed=None):
    """A workspace with files/products.csv and files/lines.csv, findings detected, and the controller's stage file."""
    monkeypatch.chdir(tmp_path)
    (tmp_path / 'files').mkdir()
    (tmp_path / 'files/products.csv').write_text('\n'.join(['product_id,name', *[f'P{i:03d},Item {i}' for i in range(200)]]) + '\n')
    (tmp_path / 'files/lines.csv').write_text('\n'.join([LINE, *lines]) + '\n')
    sources = ['files/lines.csv', 'files/products.csv']
    folder, result = df.detect(sources, tmp_path / 'cache')
    context = tmp_path / 'stage/data-findings.json'
    context.parent.mkdir()
    context.write_text(json.dumps({'findingsDir': str(folder), 'cacheRoot': str(tmp_path / 'cache'), 'workspaceRoot': str(tmp_path),
                                   'sources': sources, 'confirmed': confirmed or {}}))
    return context, {f['issue']: f['id'] for f in result['findings']}


def top_product(conn):
    def answer(views):
        top = conn.execute(f"""SELECT product_id, round(sum(TRY_CAST(quantity AS DOUBLE) * TRY_CAST(price AS DOUBLE)), 2) v
            FROM {views['files/lines.csv']} GROUP BY 1 ORDER BY v DESC NULLS LAST LIMIT 1""").fetchone()
        return {'top': top[0], 'top_value': top[1]}
    return answer


def planted():
    lines = [line(i) for i in range(2000)]
    lines[7], lines[10] = line(7, price='8000.00'), line(10, price='"1,10"')
    return lines


CLAIMS = [{'id': 'top', 'sourcePaths': ['files/lines.csv']}, {'id': 'top_value', 'sourcePaths': ['files/lines.csv']}]


def test_check_findings_names_the_findings_that_change_each_claim(tmp_path, monkeypatch):
    context, ids = staged(tmp_path, monkeypatch, planted())
    with duckdb.connect() as conn:
        answer = top_product(conn)
        assert answer(df.findings_views(conn, context)) == {'top': 'P007', 'top_value': 24021.6}
        changed, pending = df.check_findings(conn, CLAIMS, answer, context)
    assert changed == {ids['x1e4 vs product_id median']: ['top', 'top_value']}
    assert {f['id'] for f in pending} == set(ids.values())


def test_check_findings_keeps_confirmed_treatments_and_skips_them(tmp_path, monkeypatch):
    context, ids = staged(tmp_path, monkeypatch, planted())
    scale = ids['x1e4 vs product_id median']
    context.write_text(json.dumps({**json.loads(context.read_text()), 'confirmed': {scale: 'exclude'}}))
    with duckdb.connect() as conn:
        assert top_product(conn)(df.findings_views(conn, context))['top'] == 'P197'
        changed, pending = df.check_findings(conn, CLAIMS, top_product(conn), context)
    assert changed == {} and scale not in {f['id'] for f in pending}


def test_check_findings_needs_an_answer_only_when_claimed_sources_have_findings(tmp_path, monkeypatch):
    context, _ = staged(tmp_path, monkeypatch, planted())
    assert df.check_findings(None, [{'id': 'n', 'sourcePaths': ['files/products.csv']}], None, context) == ({}, [])
    with pytest.raises(ValueError, match='pass conn= and answer='):
        df.check_findings(None, CLAIMS, None, context)
    with duckdb.connect() as conn, pytest.raises(ValueError, match='keyed by claim ids'):
        df.check_findings(conn, CLAIMS, lambda views: {'other': 1}, context)


def test_check_findings_accepts_absolute_source_paths(tmp_path, monkeypatch):
    context, ids = staged(tmp_path, monkeypatch, planted())
    claims = [{'id': 'top', 'sourcePaths': [str(tmp_path / 'files/lines.csv')]}]
    with duckdb.connect() as conn:
        changed, _ = df.check_findings(conn, claims, lambda views: {'top': top_product(conn)(views)['top']}, context)
    assert changed == {ids['x1e4 vs product_id median']: ['top']}
```

What the fixture plants: line 7 sets P007's price 10,000 times its peers (the `x1e4` ratio finding), which makes P007 the top product. Line 10 has a decimal comma on P010 (`decimal-comma`, fixable), which changes neither claim. With the scale finding excluded, the clean top product is P197.

- [ ] **Step 2: Run them and confirm they fail**

Run: `.venv/bin/python -m pytest tests/python/test_data_findings.py -q -k check_findings`
Expected: 4 failed with `AttributeError: module 'data_findings' has no attribute 'findings_views'` (or `check_findings`).

- [ ] **Step 3: Implement**

In `bundled/harness-tools/data_findings.py`, add `import os` after `import math`, and change the `data_workspace` import to:

```python
from data_workspace import ImportOptions, attach_source, identifier as q, prepare_source, quote
```

Insert after `sweep`, before `if __name__ == '__main__':`:

```python
def _context(path):
    ctx = json.loads(Path(path).read_text())
    return ctx, json.loads((Path(ctx['findingsDir']) / 'findings.json').read_text())['findings']


def findings_views(conn, context='data-findings.json', treatments=()):
    """Map each detected CSV source to a view of its rows with the user's confirmed treatments, plus the given ones, applied."""
    ctx, found = _context(context)
    owner, attached = {f['id']: f['source'] for f in found}, {r[0] for r in conn.execute('SELECT database_name FROM duckdb_databases()').fetchall()}
    views = {}
    for i, source in enumerate(ctx['sources']):
        alias = f'findings_s{i}'
        if alias not in attached:
            attach_source(conn, prepare_source(Path(ctx['workspaceRoot']) / source, Path(ctx['cacheRoot']), ImportOptions(format='csv')), alias)
        mine = {k: t for k, t in {**ctx['confirmed'], **dict(treatments)}.items() if owner.get(k) == source}
        views[source] = treated_view(conn, alias, source, ctx['findingsDir'], mine, view=f'{alias}_view')
    return views


def check_findings(conn, claims, answer, context='data-findings.json'):
    """Return ({finding id: claim ids it changes}, pending findings) for unconfirmed findings on the claims' sourcePaths.
    answer(views) recomputes {claim id: value} from findings_views; each finding is excluded, and fixed when it can be."""
    ctx, found = _context(context)
    paths = {p for c in claims for p in c.get('sourcePaths') or []}
    paths = {os.path.relpath(p, ctx['workspaceRoot']) if os.path.isabs(p) else p for p in paths}
    pending = [f for f in found if f['source'] in paths and f['id'] not in ctx['confirmed']]
    if not pending:
        return {}, []
    if conn is None or answer is None:
        raise ValueError(f'{len(pending)} unconfirmed data findings on the claimed sources: pass conn= and answer= to emit_handoff')
    if not set(answer(findings_views(conn, context))) <= {str(c['id']) for c in claims}:
        raise ValueError('answer() must return a dict keyed by claim ids')
    changed = {}
    for treatment in ('exclude', 'fix'):
        ids = [f['id'] for f in pending if treatment == 'exclude' or f['fix']]
        run = lambda chosen: answer(findings_views(conn, context, {i: treatment for i in chosen}))
        for i, keys in (sweep(run, ids) if ids else {}).items():
            changed[i] = sorted({*changed.get(i, []), *keys})
    return changed, pending
```

Notes for the implementer:
- `findings_views` attaches each source under its own alias (`findings_s0`, ...). DuckDB allows the same database file to be attached twice, read-only, under different aliases, and row IDs match the detector's flags because `prepare_source` returns the same content-addressed database.
- `treated_view` already rejects unknown IDs per source, which is why treatments are filtered by `owner`.
- Do not bump `VERSION`: `findings.json` is unchanged.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `.venv/bin/python -m pytest tests/python/test_data_findings.py -q`
Expected: all pass (34).

- [ ] **Step 5: Commit**

```bash
git add bundled/harness-tools/data_findings.py tests/python/test_data_findings.py
git commit -m "feat: check which unconfirmed data findings change each claim"
```

---

### Task 3: `emit_handoff` runs the check

**Files:**
- Modify: `bundled/harness-tools/harness_output.py` (`emit_handoff` signature and the start of its body)
- Test: `tests/python/test_data_findings.py` (append; it reuses the `staged` fixture)

- [ ] **Step 1: Write the failing test**

Append to `tests/python/test_data_findings.py`:

```python
def test_emit_handoff_holds_claims_that_change_with_an_unconfirmed_finding(tmp_path, monkeypatch):
    context, ids = staged(tmp_path, monkeypatch, planted())
    scale = ids['x1e4 vs product_id median']
    claims = [{'id': 'top', 'label': 'Top product', 'value': 'P007', 'unit': 'product', 'sourcePaths': ['files/lines.csv']},
              {'id': 'products', 'label': 'Products', 'value': 200, 'unit': 'count', 'sourcePaths': ['files/products.csv']}]
    diagnostics = [{'id': k, 'kind': k, 'actual': 1, 'expected': 1, 'reason': 'computed', 'sourcePaths': ['files/lines.csv']} for k in ho.DIAGNOSTIC_KINDS]
    args = dict(scope={}, reply='', claims=claims, diagnostics=diagnostics, completed_operations=[], results=[],
                handoff_path=str(context.with_name('handoff.json')))
    with pytest.raises(ValueError, match='pass conn= and answer='):
        ho.emit_handoff(**args, stream=io.StringIO())
    ho._emitted = False
    with duckdb.connect() as conn:
        facts = ho.emit_handoff(**args, stream=io.StringIO(), conn=conn,
                                answer=lambda views: {'top': top_product(conn)(views)['top']})
    assert [c['status'] for c in facts['checks']] == ['held', 'approved']
    assert scale in facts['checks'][0]['reason']
    reason, = facts['reviewReasons']
    assert reason['kind'] == 'definition' and reason['claimIds'] == ['top']
    assert scale in reason['question'] and ids['decimal-comma'] not in reason['question']
    handoff = json.loads(context.with_name('handoff.json').read_text())
    assert handoff['claims'][0]['value'] is None
    assert handoff['coverage'] == [f"Checked {len(ids)} unconfirmed data findings on the claimed sources; 1 change a claim."]
```

`ho._emitted = False` resets the module's one-emit guard after the refused call. The refusal happens before anything is printed.

- [ ] **Step 2: Run it and confirm it fails**

Run: `.venv/bin/python -m pytest tests/python/test_data_findings.py -q -k emit_handoff`
Expected: FAIL. With no `conn`/`answer` parameters, `emit_handoff` raises `TypeError: emit_handoff() got an unexpected keyword argument 'conn'`, or does not raise in the first block.

- [ ] **Step 3: Implement**

In `bundled/harness-tools/harness_output.py`, replace the `emit_handoff` signature line and docstring with the following, keeping the file's compact style:

```python
def emit_handoff(*,scope,reply,claims,diagnostics,completed_operations,results,pending_operations=None,review_reasons=None,coverage=None,holds=None,supporting_checks=None,exploration=None,resolved_ranking=None,handoff_path='handoff.json',stream=None,conn=None,answer=None):
    """claims: dicts with id, label, value, unit, sourcePaths, optional status ('approved'|'held') and reason.
    When the run has data findings, answer(views) recomputes {claim id: value} and claims that change with an unconfirmed finding are held."""
    context=Path(handoff_path).with_name('data-findings.json')
    if context.is_file():
        sys.path.insert(0,str(Path(__file__).resolve().parent))
        from data_findings import check_findings
        changed,pending=check_findings(conn,claims,answer,context)
        held={k for keys in changed.values() for k in keys}
        claims=[{**c,'status':'held','reason':'Changes with unconfirmed data findings '+', '.join(i for i,keys in changed.items() if str(c['id']) in keys)} if str(c['id']) in held and c.get('status','approved')=='approved' else c for c in claims]
        byid={f['id']:f for f in pending}
        if changed:review_reasons=[*(review_reasons or []),{'kind':'definition','claimIds':sorted(held),'question':'Data findings: keep, exclude or fix?\n'+'\n'.join(f"{i}: {byid[i]['issue']} in {byid[i]['source']} {byid[i]['column']}, {byid[i]['rows']} rows{' (fixable)' if byid[i]['fix'] else ''}; changes {', '.join(keys)}" for i,keys in changed.items())}]
        if pending:coverage=[*(coverage or []),f'Checked {len(pending)} unconfirmed data findings on the claimed sources; {len(changed)} change a claim.']
```

The existing body continues unchanged from `ids=set();checks=[];packet_claims=[]`. Importing inside the `if` means scripts without findings never import DuckDB through this module.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npm run test:python`
Expected: all pass (53 = 48 + 5 new). The existing `test_harness_output.py` tests still pass because their stage folder has no `data-findings.json`.

- [ ] **Step 5: Commit**

```bash
git add bundled/harness-tools/harness_output.py tests/python/test_data_findings.py
git commit -m "feat: hold claims that change with unconfirmed data findings at handoff"
```

---

### Task 4: The controller writes `data-findings.json` into analyst and verifier stages

**Files:**
- Modify: `src/agent/workflow/data-findings.ts` (append `findingsContext`)
- Modify: `src/agent/workflow/orchestrator.ts` (inside `const stage = async (...)`, about lines 138-170)
- Test: `tests/integration/data-findings.test.ts` (append)

- [ ] **Step 1: Write the failing test**

Append to `tests/integration/data-findings.test.ts`, adding `readFile` to the `node:fs/promises` import:

```ts
it('gives analyst and verifier stages the findings context with confirmed treatments', async () => {
  const f = await createFlow({findData: async () => ({findingsDir: '/c', findings: [finding(0)]})});
  const confirmed = `F-${'a'.repeat(40)}`;
  await writeFile(f.paths.context, `# Confirmed business context\n\n- Data finding ${confirmed}: exclude\n`);
  await f.run();
  const roles = f.inputs.map(i => i.role);
  expect(roles).toContain('analyst');
  for (const [i, envelope] of f.envelopes.entries()) {
    const file = join(envelope.stageDir, 'data-findings.json');
    if (roles[i] === 'coordinator') {
      expect(existsSync(file)).toBe(false);
      continue;
    }
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({
      findingsDir: '/c',
      cacheRoot: f.paths.cache,
      workspaceRoot: f.paths.root,
      sources: ['files/source.csv'],
      confirmed: {[confirmed]: 'exclude'},
    });
  }
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run tests/integration/data-findings.test.ts`
Expected: the new test fails with `ENOENT` on `data-findings.json`.

- [ ] **Step 3: Implement `findingsContext`**

Append to `src/agent/workflow/data-findings.ts`:

```ts
// Stage file read by data_findings.py: where findings live and which treatments the user confirmed in context.md.
export function findingsContext(
  found: CompactFindings,
  context: string,
  paths: {root: string; cache: string},
  sources: SourceFile[],
) {
  const confirmed = Object.fromEntries(
    [...context.matchAll(/Data finding (F-[0-9a-f]{40}): (keep|exclude|fix)\b/g)].map(m => [m[1], m[2]]),
  );
  return {
    findingsDir: found.findingsDir,
    cacheRoot: paths.cache,
    workspaceRoot: paths.root,
    sources: sources.filter(s => s.kind === 'csv').map(s => s.relativePath),
    confirmed,
  };
}
```

`CompactFindings` is already exported further up the same file. It is declared after `compactFindings`, so place this function at the end of the file.

- [ ] **Step 4: Write the file in the orchestrator**

In `src/agent/workflow/orchestrator.ts`, change the import to:

```ts
import {compactFindings, findingsContext, type CompactFindings, type DataFindings} from './data-findings.js';
```

Inside `const stage = async (...)`, replace:

```ts
      const stageDir = join(dir, `${stageMetrics.length + 1}-${role}`);
      await mkdir(stageDir, {recursive: true});
```

with:

```ts
      const stageDir = join(dir, `${stageMetrics.length + 1}-${role}`);
      await mkdir(stageDir, {recursive: true});
      const context = await readFile(paths.context, 'utf8');
      // emit_handoff and findings_views read this to apply confirmed treatments and check the rest.
      const findingsFile = join(stageDir, 'data-findings.json');
      if (role !== 'coordinator' && dataFindings)
        await writeFile(findingsFile, JSON.stringify(findingsContext(dataFindings, context, paths, sources)));
```

Add `findingsFile,` as the last entry of the `for (const path of [...])` list that builds `controllerRefs`, right after `statePath,`. The stage then fails if the model edits the file, and a missing file is already tolerated (`ENOENT`). In the `buildStagePrompt({...})` call, replace `context: await readFile(paths.context, 'utf8'),` with `context,`.

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `npm run typecheck && npx vitest run tests/integration/data-findings.test.ts && npm test`
Expected: typecheck clean; all vitest pass (344).

- [ ] **Step 6: Commit**

```bash
git add src/agent/workflow/data-findings.ts src/agent/workflow/orchestrator.ts tests/integration/data-findings.test.ts
git commit -m "feat: give analyst and verifier stages the data findings context"
```

---

### Task 5: Guide and role prompts

**Files:**
- Modify: `bundled/harness-tools/data-analysis.md` (section `## Data findings`)
- Modify: `src/agent/workflow/role-prompts.ts` (last sentence of `analyst` and of `verifier`)

- [ ] **Step 1: Replace the guide's treatment and sweep text**

In `bundled/harness-tools/data-analysis.md`, keep the `## Data findings` intro, the field list and the sentence "Findings are facts, not decisions. Never drop or rewrite flagged rows on your own judgement." Replace everything from "Treatments come from the user and appear in confirmed context" through step 4 (the line ending "Only findings with a non-null `fix` can be fixed.") with:

````markdown
Treatments come from the user and appear in confirmed context as `Data finding <id>: keep|exclude|fix`. Code applies them and checks every finding not yet confirmed. Read CSV sources through `findings_views`, write the calculation as a function, and pass it to `emit_handoff`:

```python
import sys; sys.path.insert(0, HARNESS_TOOLS)  # the directory containing this file
from data_findings import findings_views

def answer(views):  # views maps each CSV source path to a view with the confirmed treatments applied
    top = conn.execute(f"SELECT product_id, round(sum(TRY_CAST(line_value_gbp AS DOUBLE)), 2) FROM {views['files/data/sales.csv']} GROUP BY 1 ORDER BY 2 DESC LIMIT 1").fetchone()
    return {'top_product': top[0], 'top_product_value': top[1]}

result = answer(findings_views(conn))  # build the claims from this
emit_handoff(..., conn=conn, answer=answer)
```

View columns are VARCHAR, so TRY_CAST them yourself. `create_typed_view` and `<alias>.raw` ignore treatments; use them only to explore. `answer` returns `{claim id: value}` for the claims computed from CSV sources, rounded to the reported precision. `emit_handoff` re-runs it with each unconfirmed finding on the claims' `sourcePaths` excluded, and fixed when it has a `fix`. It holds each claim that changes and asks the user one question naming the findings, so do not add data-finding holds or questions yourself. It refuses the handoff when such findings exist and `answer` is missing.
````

- [ ] **Step 2: Update the role prompts**

In `src/agent/workflow/role-prompts.ts`:
- In `analyst`, replace `Treat dataFindings as data-analysis.md describes before approving claims.` with `With dataFindings, pass answer= to emit_handoff (data-analysis.md).`
- In `verifier`, replace `Apply dataFindings treatments confirmed in confirmedContext using treated_view from data_findings.py.` with `With dataFindings, read CSV sources through findings_views from data_findings.py so confirmed treatments apply.`

Both prompts stay under the 110-word cap that `tests/unit/workflow-coordinator.test.ts` enforces. The analyst sentence gets shorter; the verifier one stays the same length.

- [ ] **Step 3: Run the full suites**

Run: `npm run typecheck && npm test && npm run test:python && npm run format:check`
Expected: all pass (344 vitest, 53 pytest).

- [ ] **Step 4: Commit**

```bash
git add bundled/harness-tools/data-analysis.md src/agent/workflow/role-prompts.ts
git commit -m "docs: let code check data findings at handoff"
```

---

### Task 6: Deterministic acceptance on both packs (no model calls)

**Files:** none committed. Write evidence to `.cache/findings-check-acceptance.json` (git-ignored).

- [ ] **Step 1: Run the reference answer through `emit_handoff` on both packs**

Save this as `.cache/findings-check-acceptance.py` and run it once per pack:

```python
import glob, io, json, sys, time
from pathlib import Path
app, pack = Path(sys.argv[1]), Path(sys.argv[2])
sys.path.insert(0, str(app / 'bundled/harness-tools'))
import data_findings as d, data_workspace as w, harness_output as h
stage, cache = app / f'.cache/findings-check-{pack.name}', app / f'.cache/findings-check-{pack.name}/cache'
stage.mkdir(parents=True, exist_ok=True)
sources = sorted(f'files/data/{Path(p).name}' for p in glob.glob(str(pack / 'files/data/*.csv')))
import os; os.chdir(pack)
folder, _ = d.detect(sources, cache)
(stage / 'data-findings.json').write_text(json.dumps({'findingsDir': str(folder), 'cacheRoot': str(cache), 'workspaceRoot': str(pack), 'sources': sources, 'confirmed': {}}))
conn = w.connect_analysis(stage / 'run', stage / 'tmp', fresh=True)
S, PM, C = 'files/data/sales_transactions.csv', 'files/data/product_master.csv', 'files/data/product_cost_history.csv'
def answer(v):
    top = conn.execute(f'''SELECT s.product_id, round(sum(try_cast(s.line_value_gbp AS DOUBLE) - try_cast(s.quantity AS DOUBLE) * c.unit_cost_gbp::DOUBLE), 2)
        FROM {v[S]} s JOIN {v[PM]} USING (product_id) JOIN {v[C]} c ON c.product_id = s.product_id
        AND c.cost_status <> 'PROPOSED' AND c.currency = 'GBP' AND c.cost_uom = 'EA'
        AND try_cast(s.transaction_timestamp AS TIMESTAMP) >= c.valid_from::DATE AND try_cast(s.transaction_timestamp AS TIMESTAMP) < c.valid_to::DATE
        GROUP BY 1 ORDER BY 2 DESC LIMIT 1''').fetchone()
    return {'top_sku': top[0], 'top_sku_gp': top[1]}
base = answer(d.findings_views(conn, stage / 'data-findings.json'))
claims = [{'id': k, 'label': k, 'value': v, 'unit': 'x', 'sourcePaths': [S, PM, C]} for k, v in base.items()]
diags = [{'id': k, 'kind': k, 'actual': 1, 'expected': 1, 'reason': 'x', 'sourcePaths': [S]} for k in h.DIAGNOSTIC_KINDS]
t = time.time()
facts = h.emit_handoff(scope={}, reply='', claims=claims, diagnostics=diags, completed_operations=[], results=[],
                       handoff_path=str(stage / 'handoff.json'), stream=io.StringIO(), conn=conn, answer=answer)
print(json.dumps({'pack': pack.name, 'base': base, 'seconds': round(time.time() - t, 1), 'checks': facts['checks'], 'reviewReasons': facts['reviewReasons']}, indent=1))
```

Run from `pricing-harness/`:

```bash
.venv/bin/python -I .cache/findings-check-acceptance.py $PWD $PWD/workspace/northbridge-seeded > .cache/findings-check-seeded.json
.venv/bin/python -I .cache/findings-check-acceptance.py $PWD $PWD/workspace/northbridge-test > .cache/findings-check-clean.json
```

- [ ] **Step 2: Check the expected outcomes (measured with the plan prototype)**

Seeded pack:
- base `{'top_sku': '47566', 'top_sku_gp': 165596.19}`. This is wrong because of the traps.
- `top_sku` is held, and its reason names both the pence finding (`x1e2 vs product_id median` on `sales_transactions.csv` `unit_price_gbp`) and the `duplicate-key conflicting` finding on `product_master.csv`.
- The question lists 7 findings. The check takes about 13 s.

Clean pack:
- base `{'top_sku': '22423', 'top_sku_gp': 139548.15}`. This is correct.
- `top_sku` is approved.
- `top_sku_gp` is held by one natural finding: `parse` `mixed-text` on `sales_transactions.csv` `invoice_id` (about 19,500 rows of text-bearing invoice IDs, most likely credit notes). The check takes about 6 s.

If an outcome differs, stop and report it. Do not tune detectors or thresholds.

---

### Task 7: Review and record

- [ ] **Step 1: Whole-change review.** Dispatch a reviewer over `git diff b5a53f5..HEAD`. Use the same reviewer-fix policy as the previous plan: a concrete repro, a violated stated invariant, a fix of a few lines, a regression test, and a separate commit, reported as a deviation.
- [ ] **Step 2: Record.** Append a section "Code-owned findings check (2026-10-14 plan)" to `docs/research/messy-data-determinism-2026-10-13/DATA-FINDINGS-EXECUTION.md` (local, not committed). Include the commits, suite counts, Task 6 outputs, line counts and any deviations.

---

### Task 8 (ticket): Live run on the seeded pack: what improved?

Spends money. **Ask the user first:** "Run the seeded benchmark on this branch: Luna and DeepSeek 4.1 Flash at high reasoning, $0.20 total ($0.10 each)?" Do not continue without a yes.

The runner is the research script `docs/research/messy-data-determinism-2026-10-13/prototype/run_experiment.py`. It already reads `TEMPLATE` from the environment, and `workspace/northbridge-seeded/.pricing/` already has `context.md`, `files.json` and `data-cache/`.

- [ ] **Step 1: Run**

```bash
Q="what sku had the highest absolute gross margin"
P=docs/research/messy-data-determinism-2026-10-13/prototype/run_experiment.py
TEMPLATE=$PWD/workspace/northbridge-seeded .venv/bin/python -I $P $PWD $PWD/.cache/seeded-run-v2/findings baseline 0.2 "$Q" openai/gpt-6-luna:0.1 deepseek/deepseek-v4.1-flash:0.1
```

- [ ] **Step 2: Compare against Experiment 3** (same pack, same question):

| Variant | Luna | DeepSeek |
|---|---|---|
| main | 80 s, $0.006, asked about rebates | 361 s, $0.103, cap hit, draft 85123A (pence trap) |
| findings v1 | 851 s, $0.068, time budget, no answer | 851 s, $0.063, time budget, no answer |

For each model record wall time, cost, stages, output tokens and outcome. Use the Experiment 3 outcome vocabulary: correct (22423, £139,548.15), wrong (name the trap), asked (name the finding IDs), or failed (reason). Also record:
- whether `top_sku` was held with the pence and duplicate-key findings named;
- how long the analyst spent before the final `execute_analysis`, against 787 s and 770 s in v1;
- whether the analyst used `findings_views` and `answer=`, or tried to write its own sweep.

Success means the runs finish inside the time budget, with the traps named in the question rather than reported as the answer.

### Task 9 (ticket): Live run on the clean pack: does it still answer?

Spends money. **Ask the user first:** "Run the clean pack on this branch, Luna and DeepSeek at high, twice: as is, and with the credit-note finding pre-confirmed as keep, $0.40 total?" Do not continue without a yes.

- [ ] **Step 1: As is**

```bash
TEMPLATE=$PWD/workspace/northbridge-test .venv/bin/python -I $P $PWD $PWD/.cache/clean-run-v2/as-is baseline 0.2 "$Q" openai/gpt-6-luna:0.1 deepseek/deepseek-v4.1-flash:0.1
```

Expected from Task 6: the agent answers the top SKU and asks once about the `invoice_id` `mixed-text` finding for the profit amount.

- [ ] **Step 2: With that finding confirmed as keep**, simulating a user who has answered once:

```bash
T=$PWD/.cache/clean-confirmed-template; rm -rf $T; cp -Rc workspace/northbridge-test $T
ID=$(.venv/bin/python -I -c "import hashlib,json;print('F-'+hashlib.sha1(json.dumps(['parse','files/data/sales_transactions.csv','invoice_id','mixed-text']).encode()).hexdigest())")
printf '\n- Data finding %s: keep\n' "$ID" >> $T/.pricing/context.md
TEMPLATE=$T .venv/bin/python -I $P $PWD $PWD/.cache/clean-run-v2/confirmed baseline 0.2 "$Q" openai/gpt-6-luna:0.1 deepseek/deepseek-v4.1-flash:0.1
```

Check that `$ID` appears in `findings.json` under the run's `.pricing/data-cache/findings-*/`. If it doesn't, the ID encoding changed: stop and report.

- [ ] **Step 3: Compare against the clean-pack baselines in Experiments 1 and 2**:
- current harness: Luna 70 s asked / 746 s held / 822 s held; DeepSeek 270 s correct / 371 s stopped at cap;
- best code-side variant (`code_checks`): Luna 190 s correct, DeepSeek 341 s correct.

Record the same fields as Task 8. Success for the confirmed run means a correct, verified answer with no data-finding question, in time comparable to the baselines.

### Task 10: Write up

- [ ] **Step 1:** Append "Experiment 4: code-owned findings check" to `docs/research/messy-data-determinism-2026-10-13/EXPERIMENT.md` (local, not committed). Include the Task 8 and 9 tables, total spend, and what improved or did not, one run per cell with that caveat stated.
- [ ] **Step 2:** Update the auto-memory file `data-findings-execution-2026-10-13.md` with the outcome and next step. Do not push. Do not open a PR unless the user asks.
