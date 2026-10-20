# Latency and Verification Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut analysis latency and make waiting visible: record infra-vs-model timing, give every role a deterministic data profile, let scripts hand off results in one executed document, route self-check findings to repair / targeted / full review by configuration, and show self-checked answers early while targeted verification runs.

**Architecture:** All changes live in the Fastify/Pi workflow (`src/agent/workflow/*`), the bundled Python helpers (`bundled/harness-tools/*`) and a small UI badge. Review routing is a pure function (`review-policy.ts`) fed by typed triggers thrown from the existing self-check gate (`checkpoints.ts`). Targeted review reuses the existing checkpoint chaining (`sealCheckpoint` with `previous`) to produce a `mixed` checkpoint. Background delivery updates the already-sent chat message in place.

**Tech Stack:** TypeScript (Node 22, NodeNext ESM), Vitest, TypeBox, Pi agent SDK 1.0.4, Python 3.12 + DuckDB 1.5.6 + pandas, pytest, React 19.

---

## Read this first

**Working directory.** Every command below runs from `pricing-harness` unless stated. The git root is the parent folder.

**Code style.** Source files use a dense style: no spaces around operators, several statements per line, two-space or one-space indentation, single quotes, very few comments. Match it. Many `old_string` anchors below are substrings of very long lines; use the Edit tool with the exact anchor text given. If an anchor is not found, `grep -n` for a distinctive fragment of it, read that line, and adapt; do not guess.

**Commits.** The project owner requires explicit permission before commits, and the working tree already contains uncommitted baseline work. In Task 0 ask once whether per-task commits on a feature branch are authorized. If not, skip every "Commit" step. When committing, `git add` only the files listed in that task, never `git add -A`.

**Paid model calls.** Nothing in Tasks 0–15 calls a model. The optional live check at the end of Task 15 costs money and needs the user's explicit approval first.

**Test commands.**
- One TS test file: `npx vitest run tests/unit/<file>.test.ts`
- All TS tests: `npx vitest run` (baseline: 35 files, 202 tests passing)
- Typecheck: `npx tsc --noEmit` (baseline: clean)
- Python tests: `.venv/bin/python -m pytest tests/python -q` (baseline: 6 passed)

**Background for the reviewer.** Measured runs spend ~90% of wall time inside model requests; wall time ≈ output tokens ÷ ~100 tok/s. Analysts make 23–29 model calls with 7–8 failed tool calls; the verifier added 75–228 s and was triggered in every recent trial, usually by soft uncertainty. See `docs/research/query-latency-diagnosis-2026-10-09.md` and `docs/releases/self-check-workflow-evaluation-2026-10-09.md`.

## File map

| File | Responsibility | Tasks |
|---|---|---|
| `src/agent/workflow/event-log.ts` (new) | Serialized, truncated, redacted `events.jsonl` writer | 1 |
| `src/workspace.ts` | `hashFile` memoized by file identity | 2 |
| `bundled/harness-tools/data_workspace.py` | Hash index, source profiler, typed view helper | 3, 5, 8 |
| `src/agent/workflow/model-timing.ts` (new) | Per-request first-token / generation timing | 4 |
| `scripts/latency-report.mjs` (new) | Summarize timing from one run's `events.jsonl` | 4 |
| `tests/fixtures/workflow-flow.ts` (new) | Reusable fake-runner orchestrator fixture | 4, 6, 10, 13 |
| `bundled/harness-tools/profile_source.py` (new) | CLI printing source profiles as JSON | 5 |
| `src/agent/workflow/source-profiles.ts` (new) | Run the profiler, memoize, compact for prompts | 6 |
| `src/agent/workflow/read-policy.ts` (new) | Planner may not read tabular files | 7 |
| `bundled/harness-tools/harness_output.py` (new) | `emit_handoff` / `emit_checks`: one marked JSON document | 9 |
| `src/agent/workflow/recorded-output.ts` (new) | Parse marked stdout, detect/load `handoff.json` | 10 |
| `src/agent/workflow/review-policy.ts` (new) | Trigger types, policy parsing, `routeReview` | 11 |
| `src/agent/workflow/targeted-review.ts` (new) | Split packet, seal provisional + targeted checkpoints, correction notes | 12, 13 |
| `src/agent/workflow/checkpoints.ts` | Typed triggers, deferred/note kinds, reply override | 10, 11 |
| `src/agent/workflow/orchestrator.ts` | Wire everything into the run | 1, 4, 6, 12, 13 |
| `src/agent/workflow/worker.ts` | Timing events, read policy, handoff detection | 4, 7, 10 |
| `src/agent/workflow/handoff.ts`, `output-contract.ts`, `role-prompts.ts`, `contracts.ts` | Contracts and prompts | 4, 7, 10, 11, 12 |
| `src/settings.ts`, `src/runtime.ts` | `workflow.review` config | 11 |
| `src/contracts.ts`, `src/agent/events.ts`, `src/agent/runs.ts` | Message assurance + in-place update | 6, 13 |
| `src/ui/AssuranceBadge.tsx` (new), `src/ui/Chat.tsx`, `src/ui/styles.css` | Badge | 14 |
| `bundled/harness-tools/data-analysis.md`, `docs/local-setup.md`, `harness.config.json`, `bundled/versions.json` | Docs and switch-on | 7, 8, 10, 11, 15 |

---

### Task 0: Setup

**Files:** none

- [x] **Step 1: Confirm baseline**

Run: `npx tsc --noEmit && npx vitest run 2>&1 | tail -4 && .venv/bin/python -m pytest tests/python -q 2>&1 | tail -2`
Expected: no typecheck output; `Tests  202 passed (202)`; `6 passed`.

- [x] **Step 2: Ask about commits**

Ask the user: "May I create branch `perf/latency-verification` and commit after each task (only that task's files)? Your existing uncommitted changes would stay uncommitted on the branch." Record the answer. If yes:

```bash
git -C .. switch -c perf/latency-verification
```

If no, skip all Commit steps.

---

### Task 1: Serialized event log

Unawaited concurrent `appendFile` calls interleave at Node's 512 KiB write chunks; one saved `events.jsonl` is corrupted at exactly character 524,290. Tool results are also logged whole.

**Files:**
- Create: `src/agent/workflow/event-log.ts`
- Modify: `src/agent/workflow/orchestrator.ts` (line 1 import, line 19 `execute`, line 27 `redact`, lines 37, 49, 93 appends)
- Test: `tests/unit/event-log.test.ts`

- [x] **Step 1: Write the failing test**

Create `tests/unit/event-log.test.ts`:

```ts
import {expect,it} from 'vitest';
import {mkdtemp,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {EventLog,truncateLarge,redactSecrets,MAX_EVENT_STRING_CHARS} from '../../src/agent/workflow/event-log.js';
it('keeps every line parseable and ordered when large records are appended concurrently',async()=>{
 const path=join(await mkdtemp(join(tmpdir(),'event-log-')),'events.jsonl');const log=new EventLog(path);
 const big='x'.repeat(700_000);
 for(let i=0;i<20;i++)void log.append({i,result:big});
 await log.flush();
 const lines=(await readFile(path,'utf8')).trim().split('\n');
 expect(lines).toHaveLength(20);
 const parsed=lines.map(line=>JSON.parse(line));
 expect(parsed.map(r=>r.i)).toEqual([...Array(20).keys()]);
 expect(parsed[0].result.length).toBeLessThan(MAX_EVENT_STRING_CHARS+100);
});
it('truncates nested strings and leaves other values unchanged',()=>{
 expect(truncateLarge({a:['ok',{b:'y'.repeat(10)}],n:3},5)).toEqual({a:['ok',{b:'yyyyy…[truncated 5 chars]'}],n:3});
 expect(truncateLarge(42)).toBe(42);
});
it('redacts configured secrets from serialized records',()=>{
 process.env.TEST_EVENT_API_KEY='super-secret-value';
 try{expect(redactSecrets({note:'super-secret-value'})).toBe('{"note":"[REDACTED]"}');}finally{delete process.env.TEST_EVENT_API_KEY;}
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/event-log.test.ts`
Expected: FAIL — cannot resolve `../../src/agent/workflow/event-log.js`.

- [x] **Step 3: Implement `event-log.ts`**

Create `src/agent/workflow/event-log.ts`:

```ts
import {appendFile} from 'node:fs/promises';
export const MAX_EVENT_STRING_CHARS=8000;
// Large tool outputs already live in stage files; the event log keeps bounded, parseable lines.
export function truncateLarge(value:unknown,limit=MAX_EVENT_STRING_CHARS):unknown{
 if(typeof value==='string')return value.length>limit?`${value.slice(0,limit)}…[truncated ${value.length-limit} chars]`:value;
 if(Array.isArray(value))return value.map(item=>truncateLarge(item,limit));
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,truncateLarge(item,limit)]));
 return value;
}
export function redactSecrets(value:unknown):string{let text=JSON.stringify(value);for(const [key,secret] of Object.entries(process.env))if(/API_KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(key)&&secret&&secret.length>8)text=text.replaceAll(secret,'[REDACTED]');return text;}
// Node writes large appends in chunks; unserialized concurrent appends interleave lines.
export class EventLog{
 private chain:Promise<void>=Promise.resolve();
 constructor(private path:string,private serialize:(record:unknown)=>string=JSON.stringify){}
 append(record:Record<string,unknown>):Promise<void>{const line=this.serialize(truncateLarge(record))+'\n';const next=this.chain.then(()=>appendFile(this.path,line));this.chain=next.catch(()=>{});return next;}
 flush(){return this.chain;}
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/event-log.test.ts`
Expected: 3 passed.

- [x] **Step 5: Wire it into the orchestrator**

In `src/agent/workflow/orchestrator.ts`:

1. Line 1: replace `import {appendFile,mkdir,readFile,writeFile} from 'node:fs/promises';` with:
```ts
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {EventLog,redactSecrets} from './event-log.js';
```
2. Line 19: replace
```ts
 async execute(run:RunRecord,question:string,sources:SourceFile[],signal:AbortSignal):Promise<{outcome:NonNullable<RunRecord['outcome']>;checkpoint?:FileRef;workflow:NonNullable<RunRecord['workflow']>}>{
```
with
```ts
 async execute(run:RunRecord,question:string,sources:SourceFile[],signal:AbortSignal){
  const log=new EventLog(join(this.options.paths.analyses,run.id,'events.jsonl'),redactSecrets);
  try{return await this.executeWithLog(run,question,sources,signal,log);}finally{await log.flush();}
 }
 private async executeWithLog(run:RunRecord,question:string,sources:SourceFile[],signal:AbortSignal,log:EventLog):Promise<{outcome:NonNullable<RunRecord['outcome']>;checkpoint?:FileRef;workflow:NonNullable<RunRecord['workflow']>}>{
```
3. Delete the whole statement starting `const redact=(x:unknown)=>{let text=JSON.stringify(x);` and ending `return text;};` (line 27).
4. Replace `void appendFile(join(dir,'events.jsonl'),redact({at:new Date().toISOString(),role,operation,...event})+'\n');` with `void log.append({at:new Date().toISOString(),role,operation,...event});`
5. Replace `catch(error){await appendFile(join(dir,'events.jsonl'),redact({type:'candidate-retention-error',message:(error as Error).message})+'\n');}` with `catch(error){await log.append({type:'candidate-retention-error',message:(error as Error).message});}`
6. Replace `await appendFile(join(dir,'events.jsonl'),redact({type:'self_check_assessment',assurance:reviewReasons.length?'independently-reviewed':'self-checked',reviewReasons})+'\n');` with `await log.append({type:'self_check_assessment',assurance:reviewReasons.length?'independently-reviewed':'self-checked',reviewReasons});`

Then: `grep -n "appendFile\|redact(" src/agent/workflow/orchestrator.ts` → expected: no output.

- [x] **Step 6: Verify**

Run: `npx tsc --noEmit && npx vitest run 2>&1 | tail -4`
Expected: clean typecheck; all tests pass (205 = 202 + 3).

- [x] **Step 7: Commit**

```bash
git add src/agent/workflow/event-log.ts src/agent/workflow/orchestrator.ts tests/unit/event-log.test.ts
git commit -m "fix: serialize and bound workflow event log writes"
```

---

### Task 2: Memoize TypeScript file hashing

`hashFile` streams the whole file every call; sources are hashed before and after every stage and on every `stableRefs` check. At the 2 GB upload limit that is tens of seconds per run.

**Files:**
- Modify: `src/workspace.ts` (the `hashFile` line, imports)
- Test: `tests/unit/hash-cache.test.ts`

- [x] **Step 1: Write the failing test**

Create `tests/unit/hash-cache.test.ts`:

```ts
import {beforeEach,expect,it} from 'vitest';
import {mkdtemp,writeFile,utimes,stat,rename} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {hashFile,hashCacheStats,clearHashCache} from '../../src/workspace.js';
beforeEach(()=>clearHashCache());
const file=async(content:string)=>{const path=join(await mkdtemp(join(tmpdir(),'hash-cache-')),'a.csv');await writeFile(path,content);return path;};
it('reuses an unchanged file hash and recomputes after a same-size edit',async()=>{
 const path=await file('amount\n10\n');
 const first=await hashFile(path);const second=await hashFile(path);
 expect(second).toEqual(first);expect(hashCacheStats()).toEqual({computed:1,cached:1});
 await writeFile(path,'amount\n20\n');
 const third=await hashFile(path);
 expect(third.sha256).not.toBe(first.sha256);expect(hashCacheStats().computed).toBe(2);
});
it('recomputes when content changes and mtime is restored',async()=>{
 const path=await file('a\n1\n');const original=await stat(path);await hashFile(path);
 await writeFile(path,'a\n2\n');await utimes(path,original.atime,original.mtime);
 const again=await hashFile(path);
 expect(hashCacheStats().computed).toBe(2);expect(again.bytes).toBe(4);
});
it('recomputes when a file is replaced by rename',async()=>{
 const path=await file('a\n1\n');const first=await hashFile(path);
 const temp=path+'.tmp';await writeFile(temp,'a\n9\n');await rename(temp,path);
 const second=await hashFile(path);
 expect(second.sha256).not.toBe(first.sha256);expect(hashCacheStats().computed).toBe(2);
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/hash-cache.test.ts`
Expected: FAIL — `hashCacheStats` / `clearHashCache` are not exported.

- [x] **Step 3: Implement the cache**

In `src/workspace.ts`, add after the existing imports:

```ts
import type {BigIntStats} from 'node:fs';
```

Replace the whole line

```ts
export async function hashFile(path:string){const hash=createHash('sha256');for await(const chunk of createReadStream(path))hash.update(chunk);return {sha256:hash.digest('hex'),bytes:(await stat(path)).size};}
```

with

```ts
type HashEntry={dev:bigint;ino:bigint;size:bigint;mtimeNs:bigint;ctimeNs:bigint;sha256:string};
const hashCache=new Map<string,HashEntry>();const hashCounters={computed:0,cached:0};
export function hashCacheStats(){return {...hashCounters};}
export function clearHashCache(){hashCache.clear();hashCounters.computed=0;hashCounters.cached=0;}
const sameIdentity=(a:Omit<HashEntry,'sha256'>,b:BigIntStats)=>a.dev===b.dev&&a.ino===b.ino&&a.size===b.size&&a.mtimeNs===b.mtimeNs&&a.ctimeNs===b.ctimeNs;
// A content hash is reused only while device, inode, size, mtime and ctime are unchanged.
// ctime cannot be set by user tools, so touch-and-restore edits still force a fresh hash.
export async function hashFile(path:string){
 const key=resolve(path),before=await stat(key,{bigint:true}),cached=hashCache.get(key);
 if(cached&&sameIdentity(cached,before)){hashCounters.cached++;return {sha256:cached.sha256,bytes:Number(before.size)};}
 const hash=createHash('sha256');for await(const chunk of createReadStream(key))hash.update(chunk);const sha256=hash.digest('hex');hashCounters.computed++;
 const after=await stat(key,{bigint:true});
 if(hashCache.size>10000)hashCache.clear();
 if(sameIdentity({dev:before.dev,ino:before.ino,size:before.size,mtimeNs:before.mtimeNs,ctimeNs:before.ctimeNs},after))hashCache.set(key,{dev:after.dev,ino:after.ino,size:after.size,mtimeNs:after.mtimeNs,ctimeNs:after.ctimeNs,sha256});else hashCache.delete(key);
 return {sha256,bytes:Number(after.size)};
}
```

(`resolve`, `stat`, `createHash`, `createReadStream` are already imported in this file.)

- [x] **Step 4: Run tests**

Run: `npx vitest run tests/unit/hash-cache.test.ts && npx tsc --noEmit && npx vitest run 2>&1 | tail -4`
Expected: 3 passed; clean typecheck; full suite passes (208). Source-change detection tests (for example `changed-source` in `tests/unit/workflow-self-check.test.ts`) must still pass. If one fails, the file was rewritten without changing identity; stop and report.

- [x] **Step 5: Commit**

```bash
git add src/workspace.ts tests/unit/hash-cache.test.ts
git commit -m "perf: reuse file hashes while file identity is unchanged"
```

---

### Task 3: Memoize Python source hashing

`prepare_source` hashes the whole source on every call, including cache hits, and every analysis script calls it.

**Files:**
- Modify: `bundled/harness-tools/data_workspace.py` (add `cached_source_hash`, use it in `prepare_source`)
- Test: `tests/python/test_data_workspace.py`

- [x] **Step 1: Write the failing tests**

Append to `tests/python/test_data_workspace.py`:

```python
def test_source_hash_is_reused_until_file_identity_changes(tmp_path,monkeypatch):
    m=helper();source=tmp_path/'sales.csv';source.write_text('product,amount\nA,1\n')
    calls=[];original=m.source_hash
    monkeypatch.setattr(m,'source_hash',lambda path:(calls.append(path),original(path))[1])
    first=m.cached_source_hash(source,tmp_path/'cache');second=m.cached_source_hash(source,tmp_path/'cache')
    assert first==second==original(source) and len(calls)==1
    source.write_text('product,amount\nB,2\n')
    assert m.cached_source_hash(source,tmp_path/'cache')!=first and len(calls)==2

def test_prepare_source_cache_hit_does_not_rehash(tmp_path,monkeypatch):
    m=helper();source=tmp_path/'sales.csv';source.write_text('product,amount\nA,1\n')
    options=m.ImportOptions(format='csv');m.prepare_source(source,tmp_path/'cache',options)
    calls=[];original=m.source_hash
    monkeypatch.setattr(m,'source_hash',lambda path:(calls.append(path),original(path))[1])
    m.prepare_source(source,tmp_path/'cache',options)
    assert calls==[]
```

- [x] **Step 2: Run tests to verify they fail**

Run: `.venv/bin/python -m pytest tests/python/test_data_workspace.py -q`
Expected: 2 failed (`AttributeError: ... has no attribute 'cached_source_hash'`, and `calls` not empty).

- [x] **Step 3: Implement**

In `bundled/harness-tools/data_workspace.py`, add after the `source_hash` function:

```python
def cached_source_hash(path,cache_root):
    """Reuse a content hash while device, inode, size, mtime and ctime are unchanged."""
    path=Path(path).resolve(strict=True);index=Path(cache_root)/'.hash-index';index.mkdir(parents=True,exist_ok=True)
    entry=index/(hashlib.sha256(str(path).encode()).hexdigest()+'.json')
    def identity():
        s=path.stat();return [s.st_dev,s.st_ino,s.st_size,s.st_mtime_ns,s.st_ctime_ns]
    before=identity()
    try:
        saved=json.loads(entry.read_text())
        if saved.get('identity')==before and isinstance(saved.get('sha256'),str):return saved['sha256']
    except (OSError,ValueError):pass
    digest=source_hash(path)
    if identity()==before:
        temp=index/(entry.name+'.'+str(uuid.uuid4())+'.partial')
        temp.write_text(json.dumps({'identity':before,'sha256':digest}));os.replace(temp,entry)
    return digest
```

In `prepare_source`, replace `sha=source_hash(source)` with `sha=cached_source_hash(source,cache_root)`. Keep the later `if source_hash(source)!=sha:` check unchanged (it runs only when a new cache is built).

- [x] **Step 4: Run tests**

Run: `.venv/bin/python -m pytest tests/python -q`
Expected: 8 passed.

- [x] **Step 5: Commit**

```bash
git add bundled/harness-tools/data_workspace.py tests/python/test_data_workspace.py
git commit -m "perf: reuse source hashes across prepare_source calls"
```

---

### Task 4: Model request timing, latency report and the flow fixture

Record, per model request: wait at the budget gate, time to first token (provider queue + prompt processing), generation time, output tokens and tokens/second. This separates infrastructure latency from model latency.

**Files:**
- Create: `src/agent/workflow/model-timing.ts`
- Create: `scripts/latency-report.mjs`
- Create: `tests/fixtures/workflow-flow.ts`
- Modify: `src/agent/workflow/worker.ts` (stream wrapper, `session.subscribe`)
- Modify: `src/agent/workflow/contracts.ts` (`StageMetrics`)
- Modify: `src/agent/workflow/orchestrator.ts` (stage `onEvent`)
- Test: `tests/unit/model-timing.test.ts`, `tests/unit/latency-report.test.ts`, `tests/integration/workflow-timing.test.ts`

- [x] **Step 1: Write the failing unit test**

Create `tests/unit/model-timing.test.ts`:

```ts
import {expect,it} from 'vitest';
import {ModelTiming} from '../../src/agent/workflow/model-timing.js';
it('separates gate wait, first-token latency and generation',()=>{
 const t=new ModelTiming();
 t.start(1000,15);t.token(3000);t.token(3500);
 expect(t.end(7000,400)).toEqual({requestIndex:1,gateWaitMs:15,timeToFirstTokenMs:2000,generationMs:4000,totalMs:6000,outputTokens:400,outputTokensPerSecond:100});
});
it('reports null first-token values when no token streamed',()=>{
 const t=new ModelTiming();t.start(0,0);
 expect(t.end(500,undefined)).toMatchObject({requestIndex:1,timeToFirstTokenMs:null,generationMs:null,outputTokens:null,outputTokensPerSecond:null,totalMs:500});
 expect(t.end(600,1)).toBeUndefined();
});
```

- [x] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/unit/model-timing.test.ts`
Expected: FAIL — module not found.

- [x] **Step 3: Implement `model-timing.ts`**

Create `src/agent/workflow/model-timing.ts`:

```ts
export type ModelTimingRecord={requestIndex:number;gateWaitMs:number;timeToFirstTokenMs:number|null;generationMs:number|null;totalMs:number;outputTokens:number|null;outputTokensPerSecond:number|null};
// Time to first token covers provider queueing, transport and prompt processing; generation covers streamed output.
export class ModelTiming{
 private index=0;private current?:{startedAt:number;gateWaitMs:number;firstTokenAt?:number};
 start(now:number,gateWaitMs:number){this.current={startedAt:now,gateWaitMs};}
 token(now:number){if(this.current&&this.current.firstTokenAt===undefined)this.current.firstTokenAt=now;}
 end(now:number,outputTokens:unknown):ModelTimingRecord|undefined{
  const c=this.current;if(!c)return undefined;this.current=undefined;
  const ttft=c.firstTokenAt!==undefined?c.firstTokenAt-c.startedAt:null,generation=c.firstTokenAt!==undefined?now-c.firstTokenAt:null;
  const tokens=typeof outputTokens==='number'&&Number.isFinite(outputTokens)?outputTokens:null;
  return {requestIndex:++this.index,gateWaitMs:c.gateWaitMs,timeToFirstTokenMs:ttft,generationMs:generation,totalMs:now-c.startedAt,outputTokens:tokens,outputTokensPerSecond:tokens!==null&&generation?Math.round(tokens/(generation/1000)*10)/10:null};
 }
}
```

Run: `npx vitest run tests/unit/model-timing.test.ts` → 2 passed.

- [x] **Step 4: Emit timing from the worker**

In `src/agent/workflow/worker.ts`:

1. After `import {AnalystRevisions} from './revisions.js';` add `import {ModelTiming} from './model-timing.js';`
2. Replace `session.agent.streamFunction=async(...args)=>{await gate('model');return stream(...args);};` with
```ts
const timing=new ModelTiming();session.agent.streamFunction=async(...args)=>{const waitStarted=Date.now();await gate('model');timing.start(Date.now(),Date.now()-waitStarted);return stream(...args);};
```
3. Replace the line
```ts
  if(event.type==='message_end'&&event.message.role==='assistant')send({type:'event',event:{type:'usage',usage:event.message.usage,stopReason:event.message.stopReason}});
```
with
```ts
  if(event.type==='message_update'&&['text_delta','thinking_delta','toolcall_start','toolcall_delta'].includes(event.assistantMessageEvent.type))timing.token(Date.now());
  if(event.type==='message_end'&&event.message.role==='assistant'){send({type:'event',event:{type:'usage',usage:event.message.usage,stopReason:event.message.stopReason}});const record=timing.end(Date.now(),event.message.usage?.output);if(record)send({type:'event',event:{type:'model_timing',...record}});}
```

- [x] **Step 5: Aggregate per stage**

In `src/agent/workflow/contracts.ts`, replace `usageComplete:boolean;error?:string};` (end of `StageMetrics`) with:

```ts
usageComplete:boolean;error?:string;modelTiming?:{requests:number;timeToFirstTokenMs:number;maxTimeToFirstTokenMs:number;generationMs:number;outputTokens:number}};
```

In `src/agent/workflow/orchestrator.ts`, replace `if(event.type==='execution')executions.push(event.record);` with:

```ts
if(event.type==='execution')executions.push(event.record);
    if(event.type==='model_timing'){const t=metrics.modelTiming??={requests:0,timeToFirstTokenMs:0,maxTimeToFirstTokenMs:0,generationMs:0,outputTokens:0};t.requests++;t.timeToFirstTokenMs+=event.timeToFirstTokenMs??0;t.maxTimeToFirstTokenMs=Math.max(t.maxTimeToFirstTokenMs,event.timeToFirstTokenMs??0);t.generationMs+=event.generationMs??0;t.outputTokens+=event.outputTokens??0;}
```

- [x] **Step 6: Create the shared flow fixture**

Create `tests/fixtures/workflow-flow.ts`. Later tasks extend it; keep the structure.

```ts
import {mkdtemp,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,relative} from 'node:path';
import {hashFile,openWorkspace} from '../../src/workspace.js';
import {loadConfig,type HarnessConfig} from '../../src/runtime.js';
import {WorkflowOrchestrator} from '../../src/agent/workflow/orchestrator.js';
import type {Runner} from '../../src/agent/workflow/contracts.js';
const kinds=['source-coverage','parsing','join-integrity','period-coverage','reconciliation','eligibility'];
export type FlowClaim={id:string;label:string;value:number|null;unit:string};
export type FlowOptions={
 claims?:FlowClaim[]|((attempt:number)=>FlowClaim[]);
 analystFacts?:(facts:any,attempt:number)=>void;
 analystData?:(data:any,attempt:number)=>void;
 verifier?:(input:any,attempt:number)=>{checks?:any[];data?:any}|undefined;
 extraEvents?:(role:string)=>Record<string,any>[];
 configure?:(config:HarnessConfig)=>void;
};
// Orchestrator with a fake stage runner: real controller gates, scripted stage outputs.
export async function createFlow(options:FlowOptions={}){
 const paths=await openWorkspace(await mkdtemp(join(tmpdir(),'flow-'))),root=paths.root;
 await writeFile(join(paths.files,'source.csv'),'amount\n10\n');
 const source={id:'source',name:'source.csv',relativePath:'files/source.csv',kind:'csv' as const,addedAt:'',...(await hashFile(join(paths.files,'source.csv')))};
 const scope={population:'all',period:'Q3',basis:'GBP'};
 const claimsFor=(attempt:number)=>typeof options.claims==='function'?options.claims(attempt):options.claims??[{id:'revenue',label:'Revenue',value:10,unit:'GBP'}];
 const checkFor=(c:FlowClaim)=>c.value===null?{claimId:c.id,status:'held',reason:'Missing cost in source',sourcePaths:['files/source.csv']}:{claimId:c.id,status:'approved',actual:c.value,sourcePaths:['files/source.csv']};
 const calls:string[]=[],messages:{id:string;text:string;options?:any}[]=[],inputs:{role:string;operation:string;input:any}[]=[],envelopes:any[]=[];
 let analystAttempt=0,verifierAttempt=0;
 const runner:Runner={activeCount:0,execute:async(r,b,_signal,event)=>{
  calls.push(r.role);b.debit('model');b.usage({input:1,output:1,cost:{total:0.01}});
  const envelope=JSON.parse(r.prompt);envelopes.push(envelope);inputs.push({role:r.role,operation:r.operation,input:envelope.input});
  for(const extra of options.extraEvents?.(r.role)??[])event(extra);
  let data:any,executions:any[]=[];
  if(r.role==='coordinator')data={schemaVersion:1,originalRequest:envelope.originalRequest,scope,depth:'analysis',operations:['revenue'],visualize:false,confirmedDefinitions:[]};
  else{
   const ref=async(path:string)=>({path:relative(root,path),...(await hashFile(path))});
   const script=join(r.stageDir,'code.py'),output=join(r.stageDir,'output.txt'),provenance=join(r.stageDir,'provenance.json');
   await writeFile(script,r.role==='analyst'?'# analysis source.csv':'# separate raw-source source.csv computation');
   let stdout:any;let claims:FlowClaim[]=[];
   if(r.role==='analyst'){
    analystAttempt++;claims=claimsFor(analystAttempt);
    stdout={scope,reply:'Analyst reply.',completedOperations:['T1'],reviewReasons:[],checks:claims.map(checkFor),diagnostics:kinds.map(kind=>({id:kind,kind,actual:1,expected:1,reason:'Computed control',sourcePaths:['files/source.csv']}))};
    options.analystFacts?.(stdout,analystAttempt);
   }else{
    verifierAttempt++;
    const custom=options.verifier?.(envelope.input,verifierAttempt);
    stdout={checks:custom?.checks??(envelope.input.analysisPacket.claims as FlowClaim[]).map(checkFor)};
    data=custom?.data;
   }
   await writeFile(output,JSON.stringify(stdout));
   await writeFile(provenance,JSON.stringify({schemaVersion:1,success:true,reads:['files/source.csv'],queries:[]}));
   const execution={id:`${r.role}-${r.role==='analyst'?analystAttempt:verifierAttempt}`,role:r.role,success:true,script:await ref(script),output:await ref(output),provenance:await ref(provenance),accessed:[await ref(join(paths.files,'source.csv'))]};
   executions=[execution];event({type:'execution',record:execution});
   if(r.role==='analyst'){data={claims:claims.map(c=>({...c,evidence:[relative(root,output)]})),code:[relative(root,script)],results:[relative(root,output)],coverage:[],holds:[]};options.analystData?.(data,analystAttempt);}
   else data??={reply:'Verifier reply.',completedOperations:['T1']};
  }
  return {schemaVersion:1,role:r.role,sessionId:r.role,text:JSON.stringify(data),data,executions,readPaths:[]};
 }};
 const config=loadConfig({PRICING_WORKSPACE:root,PRICING_PROVIDER:'openrouter',PRICING_MODEL:'explicit',PRICING_THINKING_LEVEL:'medium',PRICING_PYTHON:'/usr/bin/python3',PRICING_CONFIG_FILE:''});
 options.configure?.(config);
 const orchestrator=new WorkflowOrchestrator({config,paths,bundle:{fingerprint:'x',pricingVersion:'',pricingCommit:'',visualizationVersion:'',skillPaths:[],skillNames:[]},runner,onMessage:(text,opts)=>{const id='m'+messages.length;messages.push({id,text,options:opts});return id;},onProgress:()=>{},history:()=>[]});
 let n=0;
 const run=async(question='Review revenue')=>orchestrator.execute({schemaVersion:1,id:'run'+ ++n,sessionId:'chat',requestId:'request'+n,startedAt:new Date().toISOString(),inputs:[source],modelId:'explicit',provider:'openrouter',bundleFingerprint:'x',state:'running'} as any,question,[source],new AbortController().signal);
 return {root,paths,run,calls,messages,inputs,envelopes,config};
}
```

`PRICING_CONFIG_FILE:''` isolates tests from `harness.config.json`.

- [x] **Step 7: Write the aggregation test**

Create `tests/integration/workflow-timing.test.ts`:

```ts
import {expect,it} from 'vitest';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createFlow} from '../fixtures/workflow-flow.js';
it('aggregates model timing per stage and keeps timing lines in events.jsonl',async()=>{
 const f=await createFlow({extraEvents:()=>[{type:'model_timing',requestIndex:1,gateWaitMs:2,timeToFirstTokenMs:1500,generationMs:3000,totalMs:4502,outputTokens:300,outputTokensPerSecond:100}]});
 const result=await f.run();
 expect(result.outcome.kind).toBe('complete');
 const analyst=result.workflow.stages.find(s=>s.role==='analyst')!;
 expect(analyst.modelTiming).toEqual({requests:1,timeToFirstTokenMs:1500,maxTimeToFirstTokenMs:1500,generationMs:3000,outputTokens:300});
 const lines=(await readFile(join(f.paths.analyses,'run1','events.jsonl'),'utf8')).trim().split('\n').map(l=>JSON.parse(l));
 expect(lines.filter(l=>l.type==='model_timing')).toHaveLength(2);
});
```

Run: `npx vitest run tests/integration/workflow-timing.test.ts`
Expected: 1 passed (coordinator + analyst each emit one timing line).

- [x] **Step 8: Latency report script and test**

Create `scripts/latency-report.mjs`:

```js
#!/usr/bin/env node
// Summarise one analysis directory: provider wait (first token) versus generation, per role.
// Usage: node scripts/latency-report.mjs <workspace>/analyses/<run-id>
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const dir=process.argv[2];
if(!dir){console.error('Usage: node scripts/latency-report.mjs <analysis directory>');process.exit(2);}
const rows=[];let skipped=0;
for(const line of readFileSync(join(dir,'events.jsonl'),'utf8').split('\n')){if(!line.trim())continue;try{rows.push(JSON.parse(line));}catch{skipped++;}}
const roles=new Map();
for(const r of rows){
 if(!r.role||!r.at)continue;
 const s=roles.get(r.role)??{first:r.at,last:r.at,requests:0,firstToken:0,generation:0,gate:0,tokens:0,noFirstToken:0};
 if(r.at<s.first)s.first=r.at;if(r.at>s.last)s.last=r.at;
 if(r.type==='model_timing'){s.requests++;s.gate+=r.gateWaitMs??0;s.generation+=r.generationMs??0;s.tokens+=r.outputTokens??0;if(r.timeToFirstTokenMs==null)s.noFirstToken++;else s.firstToken+=r.timeToFirstTokenMs;}
 roles.set(r.role,s);
}
const sec=ms=>(ms/1000).toFixed(1);
console.log('role         wall_s  requests  first_token_s  generation_s  output_tokens  tokens_per_s');
for(const [role,s] of roles){const wall=Date.parse(s.last)-Date.parse(s.first);console.log(`${role.padEnd(11)} ${sec(wall).padStart(7)} ${String(s.requests).padStart(9)} ${sec(s.firstToken).padStart(14)} ${sec(s.generation).padStart(13)} ${String(s.tokens).padStart(14)} ${(s.generation?s.tokens/(s.generation/1000):0).toFixed(1).padStart(13)}`);}
if(skipped)console.log(`${skipped} unparseable line(s) skipped`);
```

Create `tests/unit/latency-report.test.ts`:

```ts
import {expect,it} from 'vitest';
import {mkdtemp,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
it('prints first-token and generation totals per role and skips corrupt lines',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'latency-'));
 const lines=[{at:'2026-10-10T10:00:00.000Z',role:'analyst',type:'configuration'},{at:'2026-10-10T10:00:10.000Z',role:'analyst',type:'model_timing',gateWaitMs:1,timeToFirstTokenMs:2000,generationMs:5000,outputTokens:500}].map(l=>JSON.stringify(l));
 await writeFile(join(dir,'events.jsonl'),lines.join('\n')+'\n{"broken\n');
 const out=execFileSync(process.execPath,['scripts/latency-report.mjs',dir],{encoding:'utf8'});
 expect(out).toMatch(/analyst\s+10\.0\s+1\s+2\.0\s+5\.0\s+500\s+100\.0/);
 expect(out).toContain('1 unparseable line(s) skipped');
});
```

Run: `npx vitest run tests/unit/latency-report.test.ts` → 1 passed.

- [x] **Step 9: Verify**

Run: `npx tsc --noEmit && npx vitest run 2>&1 | tail -4`
Expected: clean; all pass.

- [x] **Step 10: Commit**

```bash
git add src/agent/workflow/model-timing.ts src/agent/workflow/worker.ts src/agent/workflow/contracts.ts src/agent/workflow/orchestrator.ts scripts/latency-report.mjs tests/fixtures/workflow-flow.ts tests/unit/model-timing.test.ts tests/unit/latency-report.test.ts tests/integration/workflow-timing.test.ts
git commit -m "feat: record first-token and generation timing per model request"
```

---

### Task 5: Deterministic source profiler (Python)

Every role currently rediscovers columns, types and coverage by reading files and running probe SQL. A profile built once per source (cached by content hash) replaces that. It must work for any user's CSV/XLSX: no column-name assumptions, facts only (cast results, counts, samples), never business meanings.

**Files:**
- Modify: `bundled/harness-tools/data_workspace.py` (add `profile_prepared`)
- Create: `bundled/harness-tools/profile_source.py`
- Test: `tests/python/test_profile.py`

- [x] **Step 1: Write the failing tests**

Create `tests/python/test_profile.py`:

```python
import importlib.util
import json
import subprocess
import sys
from pathlib import Path

TOOLS=Path(__file__).resolve().parents[2]/'bundled/harness-tools'

def helper():
    spec=importlib.util.spec_from_file_location('data_workspace',TOOLS/'data_workspace.py')
    module=importlib.util.module_from_spec(spec);sys.modules[spec.name]=module;spec.loader.exec_module(module)
    return module

def prepared(m,tmp_path,text,name='s.csv'):
    source=tmp_path/name;source.write_text(text)
    return m.prepare_source(source,tmp_path/'cache',m.ImportOptions(format='csv'))

def test_profile_reports_cast_facts_without_business_meaning(tmp_path):
    m=helper()
    p=prepared(m,tmp_path,'id,amount,when,at,label,big,code,flag\n1,10.5,2024-01-01,2024-01-01 10:00:00,A,"1,200.50",007,true\n2,3,2024-02-01,2024-02-01 11:30:00,B,"2,000",008,false\n3,,2024-03-01,2024-03-01 09:15:00,A,3,009,TRUE\n')
    profile=m.profile_prepared(p);cols={c['name']:c for c in profile['columns']}
    assert profile['rowCount']==3 and profile['columnCount']==8 and profile['profiledColumns']==8
    assert cols['id']['inferredType']=='integer' and cols['id']['min']=='1' and cols['id']['max']=='3'
    assert cols['amount']['inferredType']=='decimal' and cols['amount']['nonNull']==2
    assert cols['when']['inferredType']=='date' and cols['at']['inferredType']=='timestamp'
    assert cols['label']['inferredType']=='text' and cols['label']['topValues'][0]=={'value':'A','count':2}
    assert cols['big']['inferredType']=='text' and cols['big']['thousandsSeparatorValues']==2
    assert cols['code']['inferredType']=='code' and cols['code']['leadingZeroValues']==3
    assert cols['flag']['inferredType']=='boolean'

def test_mostly_numeric_columns_report_cast_failures(tmp_path):
    m=helper()
    rows='\n'.join([str(i) for i in range(1,40)]+['n/a'])
    p=prepared(m,tmp_path,'qty\n'+rows+'\n')
    col=m.profile_prepared(p)['columns'][0]
    assert col['inferredType']=='mostly-numeric' and col['castFailures']==1

def test_wide_sources_are_truncated_and_profiles_cached(tmp_path):
    m=helper();p=prepared(m,tmp_path,'a,b,c\n1,2,3\n')
    first=m.profile_prepared(p,max_columns=2)
    assert first['columnCount']==3 and first['profiledColumns']==2
    assert list(p.database_path.parent.glob('profile-v1-*.json'))
    assert m.profile_prepared(p,max_columns=2)==first

def test_cli_profiles_every_excel_sheet(tmp_path):
    from openpyxl import Workbook
    book=Workbook();book.active.title='sales';book.active.append(['amount']);book.active.append([5])
    other=book.create_sheet('costs');other.append(['cost']);other.append([2.5])
    source=tmp_path/'book.xlsx';book.save(source)
    out=subprocess.run([sys.executable,str(TOOLS/'profile_source.py'),'--source',str(source),'--cache',str(tmp_path/'cache'),'--format','xlsx'],capture_output=True,text=True,check=True)
    profiles=json.loads(out.stdout)['profiles']
    assert [p['sheet'] for p in profiles]==['sales','costs']
    assert profiles[1]['columns'][0]['inferredType']=='decimal'
```

- [x] **Step 2: Run to verify they fail**

Run: `.venv/bin/python -m pytest tests/python/test_profile.py -q`
Expected: 4 failed (`profile_prepared` missing; CLI file missing).

- [x] **Step 3: Implement `profile_prepared`**

Append to `bundled/harness-tools/data_workspace.py` (before the `if __name__=='__main__':` block):

```python
PROFILE_VERSION='1'
_INTEGER=r'^[+-]?[0-9]+$'
_DECIMAL=r'^[+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)([eE][+-]?[0-9]+)?$'
_THOUSANDS=r'^[+-]?[0-9]{1,3}(,[0-9]{3})+([.][0-9]+)?$'
_LEADING_ZERO=r'^[+-]?0[0-9]+'
_TIME=r'[ T][0-9]{1,2}:[0-9]{2}'
_PROFILE_SQL_TYPES={'integer':'BIGINT','decimal':'DOUBLE','mostly-numeric':'DOUBLE','date':'DATE','timestamp':'TIMESTAMP'}

def profile_prepared(prepared:PreparedSource,*,max_columns=200,top_values=5,max_value_chars=60):
    """Describe parsing facts per column: counts, cast results, ranges and frequent values.
    inferredType reports which parse succeeded for every present value; it is not a business meaning."""
    cached=prepared.database_path.parent/f'profile-v{PROFILE_VERSION}-{max_columns}-{top_values}.json'
    if cached.is_file():return json.loads(cached.read_text())
    conn=duckdb.connect(str(prepared.database_path),read_only=True)
    try:
        names=[row[0] for row in conn.execute('DESCRIBE raw').fetchall()];columns=[]
        for name in names[:max_columns]:
            col=identifier(name);v=f"NULLIF(trim({col}),'')"
            non_null,blank,present,distinct,integers,decimals,stamps,times,booleans,thousands,zeros,exponents=conn.execute(f"""SELECT count({col}),
              count(*) FILTER (WHERE {col} IS NOT NULL AND trim({col})=''), count({v}), approx_count_distinct({v}),
              count(*) FILTER (WHERE regexp_matches({v},{quote(_INTEGER)})), count(*) FILTER (WHERE regexp_matches({v},{quote(_DECIMAL)})),
              count(TRY_CAST({v} AS TIMESTAMP)), count(*) FILTER (WHERE regexp_matches({v},{quote(_TIME)})),
              count(*) FILTER (WHERE regexp_matches({v},'^(true|false)$','i')), count(*) FILTER (WHERE regexp_matches({v},{quote(_THOUSANDS)})),
              count(*) FILTER (WHERE regexp_matches({v},{quote(_LEADING_ZERO)})), count(*) FILTER (WHERE regexp_matches({v},'[eE]') AND regexp_matches({v},{quote(_DECIMAL)}))
              FROM raw""").fetchone()
            failures=0
            if present==0:inferred='empty'
            elif integers==present:inferred='code' if zeros else 'integer'
            elif decimals==present:inferred='decimal'
            elif stamps==present:inferred='timestamp' if times else 'date'
            elif booleans==present:inferred='boolean'
            elif decimals>=0.95*present:inferred='mostly-numeric';failures=present-decimals
            else:inferred='text'
            low=high=None;sql_type=_PROFILE_SQL_TYPES.get(inferred)
            if sql_type:low,high=conn.execute(f'SELECT min(TRY_CAST({v} AS {sql_type}))::VARCHAR, max(TRY_CAST({v} AS {sql_type}))::VARCHAR FROM raw').fetchone()
            top=conn.execute(f'SELECT {v} AS value, count(*) AS n FROM raw WHERE {v} IS NOT NULL GROUP BY value ORDER BY n DESC, value LIMIT {int(top_values)}').fetchall()
            columns.append({'name':name,'inferredType':inferred,'nonNull':non_null,'blank':blank,'distinctApprox':distinct,'castFailures':failures,'thousandsSeparatorValues':thousands,'leadingZeroValues':zeros,'exponentValues':exponents,'min':low,'max':high,'topValues':[{'value':str(value)[:max_value_chars],'count':n} for value,n in top]})
        profile={'schemaVersion':1,'profileVersion':PROFILE_VERSION,'sourceSha256':prepared.source_sha256,'format':prepared.import_options.format,'sheet':prepared.import_options.sheet,'rowCount':prepared.row_count,'columnCount':len(names),'profiledColumns':len(columns),'columns':columns}
    finally:conn.close()
    temp=cached.parent/(cached.name+'.'+str(uuid.uuid4())+'.partial');temp.write_text(json.dumps(profile,indent=2));os.replace(temp,cached)
    return profile
```

- [x] **Step 4: Implement the CLI**

Create `bundled/harness-tools/profile_source.py`:

```python
"""Print parsing profiles for one CSV/XLSX source as JSON. Facts only; no business meanings."""
import argparse
import json
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from data_workspace import ImportOptions,prepare_source,profile_prepared

def sheet_names(path):
    from openpyxl import load_workbook
    book=load_workbook(path,read_only=True)
    try:return list(book.sheetnames)
    finally:book.close()

def main():
    parser=argparse.ArgumentParser(description='Profile one raw source; output JSON only')
    parser.add_argument('--source',type=Path,required=True);parser.add_argument('--cache',type=Path,required=True)
    parser.add_argument('--format',choices=['csv','xlsx'],required=True);parser.add_argument('--max-columns',type=int,default=200);parser.add_argument('--max-sheets',type=int,default=10)
    args=parser.parse_args()
    targets=[None] if args.format=='csv' else sheet_names(args.source)[:args.max_sheets]
    profiles=[]
    for sheet in targets:
        try:profiles.append(profile_prepared(prepare_source(args.source,args.cache,ImportOptions(format=args.format,sheet=sheet)),max_columns=args.max_columns))
        except Exception as error:profiles.append({'schemaVersion':1,'sheet':sheet,'error':str(error)[:300]})
    print(json.dumps({'schemaVersion':1,'profiles':profiles}))

if __name__=='__main__':main()
```

- [x] **Step 5: Run tests**

Run: `.venv/bin/python -m pytest tests/python -q`
Expected: 12 passed. If the `date`/`timestamp` assertion fails, run `.venv/bin/python -c "import duckdb;print(duckdb.sql(\"SELECT TRY_CAST('2024-01-01' AS TIMESTAMP)\"))"` and report the output rather than weakening the test.

- [x] **Step 6: Commit**

```bash
git add bundled/harness-tools/data_workspace.py bundled/harness-tools/profile_source.py tests/python/test_profile.py
git commit -m "feat: add deterministic cached source profiles"
```

---

### Task 6: Give every stage the source profiles

**Files:**
- Create: `src/agent/workflow/source-profiles.ts`
- Modify: `src/agent/workflow/orchestrator.ts` (options type, prompt envelope, start of `try`)
- Modify: `src/agent/runs.ts` (pass the profiler)
- Modify: `tests/fixtures/workflow-flow.ts` (option pass-through)
- Test: `tests/unit/source-profiles.test.ts`, `tests/integration/source-profiles.test.ts`

- [x] **Step 1: Write the failing tests**

Create `tests/unit/source-profiles.test.ts`:

```ts
import {expect,it} from 'vitest';
import {compactProfiles,type SourceProfile} from '../../src/agent/workflow/source-profiles.js';
const column=(i:number)=>({name:'c'+i,inferredType:'text',nonNull:1,blank:0,distinctApprox:1,castFailures:0,thousandsSeparatorValues:0,leadingZeroValues:0,exponentValues:0,min:null,max:null,topValues:[{value:'v'.repeat(50),count:1},{value:'w',count:1},{value:'x',count:1}]});
it('drops detail before columns to stay inside the prompt budget',()=>{
 const profiles:SourceProfile[]=[{path:'files/a.csv',sha256:'s',kind:'csv',profiles:[{schemaVersion:1,rowCount:1,columnCount:300,profiledColumns:300,columns:[...Array(300).keys()].map(column)}]}];
 const small=compactProfiles(profiles,1_000_000);expect(small[0]).toEqual(profiles[0]);
 const compact=compactProfiles(profiles,20000) as any;
 expect(JSON.stringify(compact).length).toBeLessThan(JSON.stringify(profiles).length);
 expect(compact[0].profiles[0].columns.length).toBe(50);
 expect(compact[0].profiles[0].columns[0].topValues).toEqual([]);
});
```

Create `tests/integration/source-profiles.test.ts`:

```ts
import {expect,it} from 'vitest';
import {existsSync} from 'node:fs';
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createSourceProfiler} from '../../src/agent/workflow/source-profiles.js';
import {createFlow} from '../fixtures/workflow-flow.js';
const python=resolve('.venv/bin/python');
it('passes profiles to every stage prompt',async()=>{
 const f=await createFlow({profileSources:async()=>[{path:'files/source.csv',sha256:'s',kind:'csv',profiles:[{schemaVersion:1,rowCount:1,columnCount:1,profiledColumns:1,columns:[]}]}]});
 await f.run();
 expect(f.envelopes.length).toBeGreaterThan(1);
 for(const envelope of f.envelopes)expect(envelope.sourceProfiles[0].path).toBe('files/source.csv');
});
it.skipIf(!existsSync(python))('profiles a real CSV with the bundled Python helper',async()=>{
 const root=await mkdtemp(join(tmpdir(),'profiles-'));await mkdir(join(root,'files'));await writeFile(join(root,'files/s.csv'),'amount,label\n1.5,A\n2,B\n');
 const profile=createSourceProfiler({pythonPath:python,bundledRoot:resolve('bundled'),workspaceRoot:root},join(root,'cache'));
 const [result] =await profile([{id:'1',name:'s.csv',relativePath:'files/s.csv',bytes:1,sha256:'abc',addedAt:'',kind:'csv'}]) as any;
 expect(result.profiles[0].columns.map((c:any)=>c.inferredType)).toEqual(['decimal','text']);
});
```

- [x] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/unit/source-profiles.test.ts tests/integration/source-profiles.test.ts`
Expected: FAIL — module not found.

- [x] **Step 3: Implement `source-profiles.ts`**

Create `src/agent/workflow/source-profiles.ts`:

```ts
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {join} from 'node:path';
import type {HarnessConfig} from '../../runtime.js';
import type {SourceFile} from '../../contracts.js';
import {analysisEnvironment} from '../session.js';
const exec=promisify(execFile);
export type ColumnProfile={name:string;inferredType:string;nonNull:number;blank:number;distinctApprox:number;castFailures:number;thousandsSeparatorValues:number;leadingZeroValues:number;exponentValues:number;min:string|null;max:string|null;topValues:{value:string;count:number}[]};
export type SheetProfile={schemaVersion:1;sheet?:string|null;error?:string;rowCount?:number;columnCount?:number;profiledColumns?:number;columns?:ColumnProfile[]};
export type SourceProfile={path:string;sha256:string;kind:SourceFile['kind'];profiles:SheetProfile[]}|{path:string;sha256:string;kind:SourceFile['kind'];error:string};
const memo=new Map<string,SourceProfile>();
// Profiles are parsing facts keyed by content hash; a failed profile never blocks analysis.
export function createSourceProfiler(config:Pick<HarnessConfig,'pythonPath'|'bundledRoot'|'workspaceRoot'>,cacheRoot:string){
 return async(sources:SourceFile[]):Promise<SourceProfile[]>=>{
  const results:SourceProfile[]=[];
  for(const source of sources){
   if(source.kind!=='csv'&&source.kind!=='xlsx')continue;
   const key=`${source.sha256}:${source.kind}`,known=memo.get(key);if(known){results.push({...known,path:source.relativePath});continue;}
   try{const {stdout}=await exec(config.pythonPath,[join(config.bundledRoot,'harness-tools/profile_source.py'),'--source',join(config.workspaceRoot,source.relativePath),'--cache',cacheRoot,'--format',source.kind],{timeout:300000,maxBuffer:16*1024*1024,env:analysisEnvironment(process.env)});const profile:SourceProfile={path:source.relativePath,sha256:source.sha256,kind:source.kind,profiles:(JSON.parse(stdout) as {profiles:SheetProfile[]}).profiles};memo.set(key,profile);results.push(profile);}
   catch(error){results.push({path:source.relativePath,sha256:source.sha256,kind:source.kind,error:String((error as Error).message).slice(0,300)});}
  }
  return results;
 };
}
// Keep prompt size bounded for wide sources: drop sample values before dropping columns.
export function compactProfiles(profiles:SourceProfile[],maxChars=40000):SourceProfile[]{
 const current=structuredClone(profiles);const size=()=>JSON.stringify(current).length;
 const each=(fn:(column:ColumnProfile)=>void)=>{for(const p of current)if('profiles' in p)for(const sheet of p.profiles)for(const column of sheet.columns??[])fn(column);};
 if(size()>maxChars)each(c=>{c.topValues=c.topValues.slice(0,2);});
 if(size()>maxChars)each(c=>{c.topValues=[];});
 if(size()>maxChars)for(const p of current)if('profiles' in p)for(const sheet of p.profiles)if(sheet.columns&&sheet.columns.length>50){sheet.columns=sheet.columns.slice(0,50);sheet.profiledColumns=50;}
 return current;
}
```

- [x] **Step 4: Wire into the orchestrator**

In `src/agent/workflow/orchestrator.ts`:

1. After `import {EventLog,redactSecrets} from './event-log.js';` add `import {compactProfiles,type SourceProfile} from './source-profiles.js';`
2. In the constructor options type, replace `history:()=>ChatMessage[];explorationEnabled?:boolean}` with `history:()=>ChatMessage[];explorationEnabled?:boolean;profileSources?:(sources:SourceFile[])=>Promise<SourceProfile[]>}`
3. Replace `let firstVerifiedAnswerAt:string|undefined;const visible:string[]=[];` with `let firstVerifiedAnswerAt:string|undefined;const visible:string[]=[];let sourceProfiles:SourceProfile[]=[];`
4. In the prompt envelope, replace `sources:sources.map(s=>({path:s.relativePath,absolutePath:join(paths.root,s.relativePath),sha256:s.sha256,kind:s.kind})),history:` with `sources:sources.map(s=>({path:s.relativePath,absolutePath:join(paths.root,s.relativePath),sha256:s.sha256,kind:s.kind})),sourceProfiles,history:`
5. At the start of the `try{` block, replace `   const entries=await index.list();const compatible=new Set<string>();` with
```ts
   if(this.options.profileSources){this.options.onProgress('planning','Profiling data sources');sourceProfiles=compactProfiles(await this.options.profileSources(sources));await log.append({type:'source_profiles',sources:sourceProfiles.map(p=>({path:p.path,...('error' in p?{error:p.error}:{})}))});}
   const entries=await index.list();const compatible=new Set<string>();
```

In `src/agent/runs.ts`:

1. After `import {WorkflowOrchestrator} from './workflow/orchestrator.js';` add `import {createSourceProfiler} from './workflow/source-profiles.js';`
2. Replace `const workflow=new WorkflowOrchestrator({config,paths,bundle:this.handle.bundle,` with `const workflow=new WorkflowOrchestrator({config,paths,bundle:this.handle.bundle,profileSources:createSourceProfiler(config,paths.cache),`

In `tests/fixtures/workflow-flow.ts`:

1. In `FlowOptions`, after `configure?:(config:HarnessConfig)=>void;` add `profileSources?:(sources:any[])=>Promise<any[]>;`
2. In the `new WorkflowOrchestrator({...})` call, after `history:()=>[]` add `,profileSources:options.profileSources`

- [x] **Step 5: Run tests**

Run: `npx tsc --noEmit && npx vitest run 2>&1 | tail -4`
Expected: clean; all pass, including the real-Python test when `.venv` exists.

- [x] **Step 6: Commit**

```bash
git add src/agent/workflow/source-profiles.ts src/agent/workflow/orchestrator.ts src/agent/runs.ts tests/fixtures/workflow-flow.ts tests/unit/source-profiles.test.ts tests/integration/source-profiles.test.ts
git commit -m "feat: supply cached source profiles to every workflow stage"
```

---

### Task 7: Planner reads profiles, not tabular files

**Files:**
- Create: `src/agent/workflow/read-policy.ts`
- Modify: `src/agent/workflow/worker.ts` (`beforeToolCall`)
- Modify: `src/agent/workflow/role-prompts.ts` (coordinator, analyst prompts)
- Modify: `bundled/harness-tools/data-analysis.md`
- Test: `tests/unit/read-policy.test.ts`

- [x] **Step 1: Write the failing test**

Create `tests/unit/read-policy.test.ts`:

```ts
import {expect,it} from 'vitest';
import {assertStageReadAllowed} from '../../src/agent/workflow/read-policy.js';
it('blocks tabular reads for the planner only',()=>{
 for(const path of ['files/a.csv','files/B.XLSX','x/y.parquet','cache/source.duckdb','t.tsv'])expect(()=>assertStageReadAllowed('coordinator',path)).toThrow(/sourceProfiles/);
 expect(()=>assertStageReadAllowed('coordinator','files/policy.md')).not.toThrow();
 expect(()=>assertStageReadAllowed('analyst','files/a.csv')).not.toThrow();
});
```

Run: `npx vitest run tests/unit/read-policy.test.ts` → FAIL (module not found).

- [x] **Step 2: Implement**

Create `src/agent/workflow/read-policy.ts`:

```ts
import {extname} from 'node:path';
const tabular=new Set(['.csv','.tsv','.xlsx','.xls','.parquet','.duckdb']);
// Planning works from sourceProfiles; paging raw rows into the planner cost minutes in measured runs.
export function assertStageReadAllowed(role:string,path:string){if(role==='coordinator'&&tabular.has(extname(path).toLowerCase()))throw Error('The planner cannot read tabular files. Use sourceProfiles in the prompt for columns, inferred types, coverage and sample values.');}
```

In `src/agent/workflow/worker.ts`:
1. After `import {ModelTiming} from './model-timing.js';` add `import {assertStageReadAllowed} from './read-policy.js';`
2. Replace `if(['write','edit'].includes(context.toolCall.name))await writablePath(String(args.path));` with `if(context.toolCall.name==='read')assertStageReadAllowed(role,String(args.path));\n  if(['write','edit'].includes(context.toolCall.name))await writablePath(String(args.path));`

- [x] **Step 3: Update prompts**

In `src/agent/workflow/role-prompts.ts`:
1. Replace `record only newly confirmed definitions.\`` with `record only newly confirmed definitions. Use sourceProfiles for columns, inferred types, coverage and sample values; tabular files are not readable while planning.\``
2. Replace `Pass useful results with limitations.\`` with `Pass useful results with limitations. Start from sourceProfiles: inferredType is a parsing fact, not a business meaning.\``

In `bundled/harness-tools/data-analysis.md`, insert this section directly before the line `## Executed self-checks and conditional review`:

```markdown
## Source profiles

Each prompt includes `sourceProfiles`: per CSV/XLSX source (and per Excel sheet) the row and column counts and, per column, `inferredType`, non-null and blank counts, approximate distinct count, cast failures, thousands-separator, leading-zero and exponent counts, min/max for parsed types and frequent values. `inferredType` means every present value parsed that way (`integer`, `decimal`, `date`, `timestamp`, `boolean`); `code` is integer-looking text with leading zeros; `mostly-numeric` has at least 95% numeric values with `castFailures` listing the rest; `text` and `empty` are otherwise. These are parsing facts, not business meanings: confirm financial mappings from context or the user. Use profiles instead of re-reading sources to discover columns; probe only for facts the profile lacks. Profiles cover at most 200 columns and 10 sheets; a profile `error` means inspect that source directly.
```

- [x] **Step 4: Verify**

Run: `npx vitest run tests/unit/read-policy.test.ts && npx tsc --noEmit && npx vitest run 2>&1 | tail -4`
Expected: all pass.

- [x] **Step 5: Commit**

```bash
git add src/agent/workflow/read-policy.ts src/agent/workflow/worker.ts src/agent/workflow/role-prompts.ts bundled/harness-tools/data-analysis.md tests/unit/read-policy.test.ts
git commit -m "feat: plan from source profiles instead of raw tabular reads"
```

---

### Task 8: Typed view helper

Measured analysts lost round trips to cast errors and reserved-word aliases. A helper creates a typed view from the profile, refusing any cast that would silently null out values.

**Files:**
- Modify: `bundled/harness-tools/data_workspace.py` (add `create_typed_view`)
- Modify: `bundled/harness-tools/data-analysis.md`
- Test: `tests/python/test_profile.py`

- [x] **Step 1: Write the failing tests**

Append to `tests/python/test_profile.py`:

```python
import pytest

def test_typed_view_casts_profiled_types_and_keeps_text(tmp_path):
    m=helper();p=prepared(m,tmp_path,'id,amount,when,label,code\n1,10.5,2024-01-01,A,007\n2,,2024-02-01,B,008\n')
    profile=m.profile_prepared(p);conn=m.connect_analysis(tmp_path/'run',tmp_path/'tmp',fresh=True)
    try:
        m.attach_source(conn,p,'sales');made=m.create_typed_view(conn,'sales',profile)
        assert made=={'view':'sales_typed','textColumns':['label','code']}
        types=dict((r[0],r[1]) for r in conn.execute('DESCRIBE sales_typed').fetchall())
        assert types['id']=='BIGINT' and types['amount'].startswith('DECIMAL') and types['when']=='DATE' and types['code']=='VARCHAR'
        assert float(conn.execute('SELECT sum(amount) FROM sales_typed').fetchone()[0])==pytest.approx(10.5)
    finally:conn.close()

def test_typed_view_overrides_and_refuses_lossy_casts(tmp_path):
    m=helper();p=prepared(m,tmp_path,'id,label\n1,A\n2,B\n');profile=m.profile_prepared(p)
    conn=m.connect_analysis(tmp_path/'run',tmp_path/'tmp',fresh=True)
    try:
        m.attach_source(conn,p,'sales')
        assert m.create_typed_view(conn,'sales',profile,overrides={'id':'VARCHAR'})['textColumns']==['id','label']
        with pytest.raises(ValueError,match='NULL'):m.create_typed_view(conn,'sales',profile,view_name='bad',overrides={'label':'BIGINT'})
        with pytest.raises(ValueError,match='SQL type'):m.create_typed_view(conn,'sales',profile,overrides={'id':'BIGINT; DROP TABLE x'})
        with pytest.raises(ValueError,match='not in source'):m.create_typed_view(conn,'sales',profile,overrides={'missing':'BIGINT'})
    finally:conn.close()
```

Run: `.venv/bin/python -m pytest tests/python/test_profile.py -q` → 2 new failures.

- [x] **Step 2: Implement**

Append to `bundled/harness-tools/data_workspace.py` (before the `__main__` block):

```python
_VIEW_SQL_TYPES={'integer':'BIGINT','decimal':'DECIMAL(38,10)','date':'DATE','timestamp':'TIMESTAMP','boolean':'BOOLEAN'}

def create_typed_view(conn,alias,profile,*,view_name=None,overrides=None):
    """Create a view casting columns whose every present value parsed as one type; others stay VARCHAR.
    Raises instead of creating a view where a cast would turn present values into NULL."""
    view=view_name or f'{alias}_typed';overrides=dict(overrides or {})
    for name in (alias,view):
        if not re.fullmatch(r'[A-Za-z][A-Za-z0-9_]*',name):raise ValueError(f'invalid identifier: {name}')
    for sql_type in overrides.values():
        if not re.fullmatch(r'[A-Z]+(\([0-9]+(,[0-9]+)?\))?',str(sql_type)):raise ValueError(f'invalid SQL type override: {sql_type}')
    names=[row[0] for row in conn.execute(f'DESCRIBE {identifier(alias)}.raw').fetchall()]
    unknown=sorted(set(overrides)-set(names))
    if unknown:raise ValueError(f'override columns not in source: {unknown}')
    columns={c['name']:c for c in profile.get('columns',[])};parts=[];cast=[];text=[]
    for name in names:
        info=columns.get(name,{});sql_type=overrides.get(name)
        if sql_type is None:
            sql_type=_VIEW_SQL_TYPES.get(info.get('inferredType'))
            if sql_type and sql_type.startswith('DECIMAL') and info.get('exponentValues'):sql_type='DOUBLE'
        value=f"NULLIF(trim({identifier(name)}),'')"
        if sql_type and sql_type!='VARCHAR':parts.append(f'TRY_CAST({value} AS {sql_type}) AS {identifier(name)}');cast.append(name)
        else:parts.append(identifier(name));text.append(name)
    conn.execute(f'CREATE OR REPLACE VIEW {identifier(view)} AS SELECT '+', '.join(parts)+f' FROM {identifier(alias)}.raw')
    if cast:
        typed=conn.execute('SELECT '+', '.join(f'count({identifier(n)})' for n in cast)+f' FROM {identifier(view)}').fetchone()
        raw=conn.execute('SELECT '+', '.join(f"count(NULLIF(trim({identifier(n)}),''))" for n in cast)+f' FROM {identifier(alias)}.raw').fetchone()
        lost=[name for name,a,b in zip(cast,typed,raw) if a!=b]
        if lost:
            conn.execute(f'DROP VIEW {identifier(view)}')
            raise ValueError(f'casting would turn present values into NULL for columns {lost}; cast them explicitly or override as VARCHAR')
    return {'view':view,'textColumns':text}
```

- [x] **Step 3: Document**

In `bundled/harness-tools/data-analysis.md`, append to the "Source profiles" section added in Task 7:

```markdown
`create_typed_view(conn, 'sales', profile)` (after `attach_source`) creates `sales_typed` with `TRY_CAST` for profiled `integer`, `decimal` (DECIMAL(38,10), or DOUBLE when exponents occur), `date`, `timestamp` and `boolean` columns; all other columns stay VARCHAR and are listed in `textColumns`. Pass `overrides={'column': 'VARCHAR'}` or another SQL type to change a column. It raises rather than letting a cast turn present values into NULL. Get the profile with `profile_prepared(prepared)`. Recreate the view in each script after attaching; do not rely on a view persisted from another run.
```

- [x] **Step 4: Verify and commit**

Run: `.venv/bin/python -m pytest tests/python -q` → 14 passed.

```bash
git add bundled/harness-tools/data_workspace.py bundled/harness-tools/data-analysis.md tests/python/test_profile.py
git commit -m "feat: add lossless typed view helper from source profiles"
```

---

### Task 9: Single-document output helper (Python)

The DeepSeek run failed because a script printed two JSON documents; others failed on NaN serialization; and the model rewrites every claim as final JSON after the script already printed it. `emit_handoff` prints exactly one marked document and writes `handoff.json` so the controller can build the packet itself (Task 10).

**Files:**
- Create: `bundled/harness-tools/harness_output.py`
- Test: `tests/python/test_harness_output.py`

- [x] **Step 1: Write the failing tests**

Create `tests/python/test_harness_output.py`:

```python
import decimal
import importlib.util
import io
import json
import math
import sys
from pathlib import Path
import pytest

TOOLS=Path(__file__).resolve().parents[2]/'bundled/harness-tools'
KINDS=['source-coverage','parsing','join-integrity','period-coverage','reconciliation','eligibility']

def output_module():
    spec=importlib.util.spec_from_file_location('harness_output',TOOLS/'harness_output.py')
    module=importlib.util.module_from_spec(spec);sys.modules[spec.name]=module;spec.loader.exec_module(module)
    return module

def diagnostics():
    return [{'id':k,'kind':k,'actual':1,'expected':1,'reason':'computed','sourcePaths':['files/s.csv']} for k in KINDS]

def emit(m,tmp_path,**overrides):
    stream=io.StringIO()
    args=dict(scope={'population':'all','period':'Q3','basis':'GBP'},reply='Revenue was 10.',claims=[{'id':'revenue','label':'Revenue','value':decimal.Decimal('10.00'),'unit':'GBP','sourcePaths':['files/s.csv']},{'id':'margin','label':'Margin','value':None,'unit':'%','status':'held','reason':'Missing cost','sourcePaths':['files/s.csv']}],diagnostics=diagnostics(),completed_operations=['T1'],results=['results.csv'],handoff_path=str(tmp_path/'handoff.json'),stream=stream)
    args.update(overrides)
    return m.emit_handoff(**args),stream.getvalue()

def test_emits_one_marked_document_and_handoff_file(tmp_path):
    m=output_module();facts,text=emit(m,tmp_path,review_reasons=[{'kind':'metadata','question':'Blank unit label','claimIds':['revenue']}])
    body=text.split(m.BEGIN)[1].split(m.END)[0]
    assert text.count(m.BEGIN)==1 and json.loads(body)==facts
    assert facts['checks']==[{'claimId':'revenue','status':'approved','sourcePaths':['files/s.csv'],'actual':10.0},{'claimId':'margin','status':'held','sourcePaths':['files/s.csv'],'reason':'Missing cost'}]
    handoff=json.loads((tmp_path/'handoff.json').read_text())
    assert handoff['claims'][0]=={'id':'revenue','label':'Revenue','value':10.0,'unit':'GBP','evidence':['results.csv',str(tmp_path/'handoff.json')]}
    assert handoff['claims'][1]['value'] is None
    assert handoff['reviewReasons']==[{'kind':'metadata','question':'Blank unit label','claimIds':['revenue']}]

def test_rejects_structural_mistakes_before_printing(tmp_path):
    m=output_module()
    with pytest.raises(ValueError,match='missing diagnostics'):emit(m,tmp_path,diagnostics=diagnostics()[:5])
    with pytest.raises(ValueError,match='duplicate claim id'):emit(m,tmp_path,claims=[{'id':'a','label':'A','value':1,'unit':'GBP','sourcePaths':['f']}]*2)
    with pytest.raises(ValueError,match='approved claims need a value'):emit(m,tmp_path,claims=[{'id':'a','label':'A','value':math.nan,'unit':'GBP','sourcePaths':['f']}])
    with pytest.raises(ValueError,match='held claims need'):emit(m,tmp_path,claims=[{'id':'a','label':'A','value':None,'unit':'GBP','status':'held','sourcePaths':['f']}])
    with pytest.raises(ValueError,match='review reason'):emit(m,tmp_path,review_reasons=[{'kind':'vibes','question':'x'}])

def test_refuses_a_second_emit(tmp_path):
    m=output_module();emit(m,tmp_path)
    with pytest.raises(RuntimeError,match='already emitted'):m.emit_checks([{'claimId':'x','status':'approved','actual':1,'sourcePaths':['f']}],stream=io.StringIO())

def test_converts_numpy_and_pandas_values():
    numpy=pytest.importorskip('numpy');pandas=pytest.importorskip('pandas');m=output_module()
    assert m.to_jsonable({'a':numpy.int64(3),'b':numpy.float64('nan'),'c':pandas.NA,'d':pandas.NaT,'e':[numpy.float32(1.5)]})=={'a':3,'b':None,'c':None,'d':None,'e':[1.5]}
```

Run: `.venv/bin/python -m pytest tests/python/test_harness_output.py -q` → 4 failed (module missing).

- [x] **Step 2: Implement**

Create `bundled/harness-tools/harness_output.py`:

```python
"""Single-document output for executed analysis scripts.

emit_handoff prints exactly one marked JSON document on stdout and writes handoff.json for the
controller. emit_checks does the same for verifier checks. Structure only; no financial judgement."""
import datetime as _dt
import decimal
import json
import math
import os
import sys
import uuid
from pathlib import Path

BEGIN='<<<HARNESS_JSON_BEGIN>>>'
END='<<<HARNESS_JSON_END>>>'
DIAGNOSTIC_KINDS=('source-coverage','parsing','join-integrity','period-coverage','reconciliation','eligibility')
REASON_KINDS=('metadata','definition','calculation','coverage','eligibility')
_emitted=False

def to_jsonable(value):
    """Convert analysis values to strict JSON; NaN, infinities and missing markers become None."""
    if value is None or isinstance(value,(bool,str)):return value
    if isinstance(value,int):return value
    if isinstance(value,float):return value if math.isfinite(value) else None
    if isinstance(value,decimal.Decimal):return float(value) if value.is_finite() else None
    if isinstance(value,dict):return {str(k):to_jsonable(v) for k,v in value.items()}
    if isinstance(value,(list,tuple)):return [to_jsonable(v) for v in value]
    try:
        import pandas
        if pandas.isna(value) is True:return None
    except (ImportError,TypeError,ValueError):pass
    if isinstance(value,(_dt.datetime,_dt.date)):return value.isoformat()
    item=getattr(value,'item',None)
    if callable(item):return to_jsonable(item())
    raise TypeError(f'value is not JSON serializable: {type(value).__name__}')

def _print(document,stream):
    global _emitted
    if _emitted:raise RuntimeError('harness output already emitted; call emit_handoff or emit_checks once per script')
    text=json.dumps(to_jsonable(document),allow_nan=False)
    stream.write(f'\n{BEGIN}\n{text}\n{END}\n');stream.flush();_emitted=True

def _reason(reason):
    if isinstance(reason,str) and reason.strip():return reason
    if isinstance(reason,dict) and reason.get('kind') in REASON_KINDS and str(reason.get('question','')).strip():
        out={'kind':reason['kind'],'question':str(reason['question'])}
        if reason.get('claimIds'):out['claimIds']=[str(x) for x in reason['claimIds']]
        return out
    raise ValueError(f'review reason must be text or {{kind, question, claimIds}} with kind in {REASON_KINDS}')

def emit_handoff(*,scope,reply,claims,diagnostics,completed_operations,results,pending_operations=None,review_reasons=None,coverage=None,holds=None,supporting_checks=None,exploration=None,resolved_ranking=None,handoff_path='handoff.json',stream=None):
    """claims: dicts with id, label, value, unit, sourcePaths, optional status ('approved'|'held') and reason."""
    ids=set();checks=[];packet_claims=[]
    for claim in claims:
        cid=str(claim['id'])
        if cid in ids:raise ValueError(f'duplicate claim id: {cid}')
        ids.add(cid);status=claim.get('status','approved');value=to_jsonable(claim.get('value'))
        if status not in ('approved','held'):raise ValueError(f'{cid}: status must be approved or held')
        if status=='approved' and value is None:raise ValueError(f'{cid}: approved claims need a value; hold unavailable measures with a reason')
        if status=='held' and not str(claim.get('reason','')).strip():raise ValueError(f'{cid}: held claims need a source-supported reason')
        paths=[str(p) for p in claim.get('sourcePaths') or []]
        if not paths:raise ValueError(f'{cid}: sourcePaths must name the raw sources read')
        check={'claimId':cid,'status':status,'sourcePaths':paths}
        if status=='approved':check['actual']=value
        else:check['reason']=str(claim['reason'])
        checks.append(check);packet_claims.append({'id':cid,'label':str(claim['label']),'value':value if status=='approved' else None,'unit':str(claim['unit'])})
    for support in supporting_checks or []:
        if support['claimId'] in ids:raise ValueError(f"supporting check reuses claim id: {support['claimId']}")
        checks.append(to_jsonable(support))
    missing=[k for k in DIAGNOSTIC_KINDS if k not in {d.get('kind') for d in diagnostics}]
    if missing:raise ValueError(f'missing diagnostics: {missing}')
    reasons=[_reason(r) for r in review_reasons or []]
    evidence=[*[str(p) for p in results],str(handoff_path)]
    handoff={'schemaVersion':1,'claims':[{**c,'evidence':evidence} for c in packet_claims],'results':evidence,'coverage':list(coverage or []),'holds':list(holds or []),'reviewReasons':reasons}
    if exploration is not None:handoff['exploration']=exploration
    if resolved_ranking is not None:handoff['resolvedRanking']=resolved_ranking
    target=Path(handoff_path);temp=target.with_name(f'.{target.name}.{uuid.uuid4()}.partial')
    temp.write_text(json.dumps(to_jsonable(handoff),allow_nan=False,indent=2));os.replace(temp,target)
    facts={'scope':scope,'reply':reply,'completedOperations':list(completed_operations),'reviewReasons':reasons,'checks':checks,'diagnostics':diagnostics}
    if pending_operations:facts['pendingOperations']=list(pending_operations)
    _print(facts,stream or sys.stdout)
    return to_jsonable(facts)

def emit_checks(checks,*,stream=None):
    """Verifier output: exactly one marked document with the checks array."""
    _print({'checks':checks},stream or sys.stdout)
```

- [x] **Step 3: Verify and commit**

Run: `.venv/bin/python -m pytest tests/python -q` → 18 passed.

```bash
git add bundled/harness-tools/harness_output.py tests/python/test_harness_output.py
git commit -m "feat: add single-document handoff output helper"
```

---

### Task 10: Controller reads marked output and executed handoffs

**Files:**
- Create: `src/agent/workflow/recorded-output.ts`
- Modify: `src/agent/workflow/checkpoints.ts` (stdout parse)
- Modify: `src/agent/workflow/contracts.ts` (`Execution.handoff`)
- Modify: `src/agent/workflow/worker.ts` (`execute_analysis`)
- Modify: `src/agent/workflow/output-contract.ts` (`fromExecution`)
- Modify: `src/agent/workflow/handoff.ts` (`validateStageOutput`, steering instruction)
- Modify: `src/agent/workflow/role-prompts.ts`, `bundled/harness-tools/data-analysis.md`
- Test: `tests/unit/recorded-output.test.ts`, `tests/unit/workflow-self-check.test.ts`

- [x] **Step 1: Write the failing tests**

Create `tests/unit/recorded-output.test.ts`:

```ts
import {expect,it} from 'vitest';
import {mkdtemp,mkdir,writeFile,utimes} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,relative} from 'node:path';
import {hashFile} from '../../src/workspace.js';
import {parseRecordedOutput,detectHandoff,loadExecutionHandoff,OUTPUT_BEGIN,OUTPUT_END} from '../../src/agent/workflow/recorded-output.js';
import {validateStageOutput} from '../../src/agent/workflow/handoff.js';
it('prefers the last marked document and falls back to whole-stdout JSON',()=>{
 expect(parseRecordedOutput(`progress\n${OUTPUT_BEGIN}\n{"a":1}\n${OUTPUT_END}\nmore\n${OUTPUT_BEGIN}\n{"a":2}\n${OUTPUT_END}\n`)).toEqual({a:2});
 expect(parseRecordedOutput('{"checks":[]}')).toEqual({checks:[]});
 expect(()=>parseRecordedOutput(`x\n${OUTPUT_END}`)).toThrow(/begin marker/);
 expect(()=>parseRecordedOutput('{"a":1}\n{"b":2}')).toThrow();
});
async function stage(){
 const root=await mkdtemp(join(tmpdir(),'handoff-exec-'));const stageDir=join(root,'analyses/run/2-analyst');await mkdir(stageDir,{recursive:true});
 await writeFile(join(stageDir,'analysis.py'),'# emits handoff');await writeFile(join(stageDir,'results.csv'),'quarter,revenue\nQ3,10\n');await writeFile(join(stageDir,'out.txt'),'{}');
 await writeFile(join(stageDir,'handoff.json'),JSON.stringify({schemaVersion:1,claims:[{id:'revenue',label:'Revenue',value:10,unit:'GBP',evidence:['results.csv','handoff.json']}],results:['results.csv','handoff.json'],coverage:['Q3 only'],holds:[],reviewReasons:[]}));
 const ref=async(name:string)=>({path:relative(root,join(stageDir,name)),sha256:(await hashFile(join(stageDir,name))).sha256});
 return {root,stageDir,ref};
}
it('detects a handoff written during the execution only',async()=>{
 const s=await stage();
 expect(await detectHandoff(s.stageDir,s.root,Date.now()-1000)).toEqual(await s.ref('handoff.json'));
 const old=new Date(Date.now()-60_000);await utimes(join(s.stageDir,'handoff.json'),old,old);
 expect(await detectHandoff(s.stageDir,s.root,Date.now())).toBeUndefined();
 expect(await detectHandoff(join(s.root,'missing'),s.root,0)).toBeUndefined();
});
it('builds the analyst packet from the executed handoff when fromExecution is returned',async()=>{
 const s=await stage();
 const execution:any={id:'e1',role:'analyst',success:true,script:await s.ref('analysis.py'),output:await s.ref('out.txt'),handoff:await s.ref('handoff.json')};
 const request:any={schemaVersion:1,role:'analyst',operation:'analyse',stageDir:s.stageDir,runId:'run',conversationId:'c',config:{workspaceRoot:s.root},prompt:JSON.stringify({input:{workOrder:{scope:{population:'all',period:'Q3',basis:'GBP'}},checkedClaims:[],checkedHeld:[]}})};
 const packet:any=await validateStageOutput(request,{fromExecution:true,coverage:['Model note']},[execution],[],[]);
 expect(packet.claims.map((c:any)=>c.id)).toEqual(['revenue']);
 expect(packet.code).toEqual([execution.script.path]);
 expect(packet.coverage).toEqual(['Q3 only','Model note']);
 await expect(loadExecutionHandoff(s.root,[{...execution,handoff:undefined}])).rejects.toThrow(/emit_handoff/);
 await writeFile(join(s.stageDir,'handoff.json'),'{}');
 await expect(loadExecutionHandoff(s.root,[execution])).rejects.toThrow(/changed/);
});
```

Append to `tests/unit/workflow-self-check.test.ts`:

```ts
it("parses marked self-check output even when the script printed progress lines first", async () => {
  const f = await fixture();
  await writeFile(join(f.root, "analyst/output.txt"), "loaded 1 row\n<<<HARNESS_JSON_BEGIN>>>\n" + JSON.stringify(f.output) + "\n<<<HARNESS_JSON_END>>>\n");
  f.options.executions[0].output = await f.ref("analyst/output.txt");
  const sealed = await sealCheckpoint(f.options);
  expect(sealed.checkpoint.verification.approved).toEqual(["revenue"]);
});
```

(The existing file uses Prettier-style formatting, so this test matches it.)

Run: `npx vitest run tests/unit/recorded-output.test.ts tests/unit/workflow-self-check.test.ts`
Expected: FAIL — module missing; the new self-check test fails with a JSON parse error.

- [x] **Step 2: Implement `recorded-output.ts`**

Create `src/agent/workflow/recorded-output.ts`:

```ts
import {readFile,stat} from 'node:fs/promises';
import {join,relative} from 'node:path';
import {hashFile,safePath} from '../../workspace.js';
import {stableRefs} from './analysis-index.js';
import type {Execution,FileRef} from './contracts.js';
export const OUTPUT_BEGIN='<<<HARNESS_JSON_BEGIN>>>',OUTPUT_END='<<<HARNESS_JSON_END>>>';
// Scripts may print progress lines; the last marked document wins, otherwise stdout must be one JSON document.
export function parseRecordedOutput(text:string):unknown{
 const end=text.lastIndexOf(OUTPUT_END);if(end<0)return JSON.parse(text);
 const begin=text.lastIndexOf(OUTPUT_BEGIN,end);if(begin<0)throw Error('Recorded output has an end marker without a begin marker');
 return JSON.parse(text.slice(begin+OUTPUT_BEGIN.length,end));
}
// handoff.json counts for an execution only when written after that execution started.
export async function detectHandoff(stageDir:string,root:string,startedAt:number):Promise<FileRef|undefined>{
 const file=join(stageDir,'handoff.json');
 try{const info=await stat(file);if(info.mtimeMs<startedAt-50)return undefined;return {path:relative(root,file),sha256:(await hashFile(file)).sha256};}
 catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return undefined;throw error;}
}
// The latest successful execution that wrote handoff.json owns the packet; prose cannot substitute it.
export async function loadExecutionHandoff(root:string,executions:Execution[]){
 const execution=executions.filter(e=>e.success&&e.handoff).at(-1);
 if(!execution?.handoff)throw Error('fromExecution needs a successful execute_analysis run whose script called emit_handoff');
 if(!await stableRefs(root,[execution.handoff,execution.script]))throw Error('handoff.json or its script changed after execution; rerun the final script');
 const data=JSON.parse(await readFile(await safePath(root,execution.handoff.path),'utf8'));
 return {...data,code:[execution.script.path]} as Record<string,any>;
}
```

- [x] **Step 3: Use it in checkpoints**

In `src/agent/workflow/checkpoints.ts`:
1. After the line `import {createHash,randomUUID} from 'node:crypto';` add `import {parseRecordedOutput} from './recorded-output.js';`
2. Replace `const output=JSON.parse(await readFile(await safePath(root,execution.output.path),'utf8'))` with `const output=parseRecordedOutput(await readFile(await safePath(root,execution.output.path),'utf8'))`

- [x] **Step 4: Record handoffs on execution**

In `src/agent/workflow/contracts.ts` replace
`export type Execution={id:string;role:Role;script:FileRef;output:FileRef;success:boolean;accessed?:FileRef[];provenance?:FileRef};`
with
`export type Execution={id:string;role:Role;script:FileRef;output:FileRef;success:boolean;accessed?:FileRef[];provenance?:FileRef;handoff?:FileRef};`

In `src/agent/workflow/worker.ts`:
1. After `import {assertStageReadAllowed} from './read-policy.js';` add `import {detectHandoff} from './recorded-output.js';`
2. Replace ``const auditPath=join(stageDir,`provenance-${randomUUID()}.json`);const result=await exec(`` with ``const auditPath=join(stageDir,`provenance-${randomUUID()}.json`);const startedAt=Date.now();const result=await exec(``
3. Replace `const record:Execution={` with `const handoff=await detectHandoff(stageDir,config.workspaceRoot,startedAt);const record:Execution={`
4. Replace `output:{path:relative(config.workspaceRoot,output),sha256:(await hashFile(output)).sha256},success:true};` with `output:{path:relative(config.workspaceRoot,output),sha256:(await hashFile(output)).sha256},success:true,...(handoff?{handoff}:{})};`
5. Replace `return {details:{},content:[{type:'text',text:JSON.stringify({executionId:id,output:record.output.path,` with `return {details:{},content:[{type:'text',text:JSON.stringify({executionId:id,output:record.output.path,handoff:record.handoff?.path,`

- [x] **Step 5: Accept `{"fromExecution":true}`**

In `src/agent/workflow/output-contract.ts`:
1. After `const blocked=object({schemaVersion:version,blockingInput:text()});` add
```ts
const fromExecution=object({fromExecution:Type.Literal(true),coverage:Type.Optional(strings()),holds:Type.Optional(strings())});
```
2. Replace `if(role==='analyst')return Type.Union([analysis,blocked]);` with `if(role==='analyst')return Type.Union([analysis,fromExecution,blocked]);`
3. Replace `role==='coordinator'?workOrder:role==='analyst'?analysis:numerical;` (end of the `const schema=` expression in `assertOutput`) with `role==='coordinator'?workOrder:role==='analyst'?(p?.fromExecution!==undefined?fromExecution:analysis):numerical;`

In `src/agent/workflow/handoff.ts`:
1. After `import {assertOutput} from './output-contract.js';` add `import {loadExecutionHandoff} from './recorded-output.js';`
2. Replace `assertOutput(request.role,request.operation,raw);const data=raw as any;` with `assertOutput(request.role,request.operation,raw);let data=raw as any;`
3. Replace `if(data.blockingInput||data.correction)return data;` with
```ts
if(data.blockingInput||data.correction)return data;
 if(request.role==='analyst'&&data.fromExecution===true){const loaded=await loadExecutionHandoff(root,executions);data={...loaded,coverage:[...(loaded.coverage??[]),...(data.coverage??[])],holds:[...(loaded.holds??[]),...(data.holds??[])]};assertOutput('analyst',request.operation,data);}
```
4. In `handoffContext`, replace `instruction:'Return final JSON now matching outputSchema.` with `instruction:'If the last successful execute_analysis script called emit_handoff, return exactly {"fromExecution":true}. Otherwise return final JSON now matching outputSchema.`

- [x] **Step 6: Prompts and docs**

In `src/agent/workflow/role-prompts.ts`:
1. Replace `inferredType is a parsing fact, not a business meaning.\`` with `inferredType is a parsing fact, not a business meaning. End the final script with emit_handoff from harness_output.py, then return {"fromExecution":true}.\``
2. Replace `Request targeted numerical corrections.\`` with `Request targeted numerical corrections. Print checks with emit_checks from harness_output.py.\``

In `bundled/harness-tools/data-analysis.md`, insert directly before `## Bounded workflow handoff`:

````markdown
## Script output helper

Import `harness_output.py` from this directory. Analysts end the final script with one `emit_handoff(...)` call and then return `{"fromExecution": true}` as the final reply; the controller builds the handoff from the executed `handoff.json`, so do not restate claims. Verifiers print with `emit_checks(checks)`. Each helper prints exactly one marked JSON document, converts NaN/NA/NaT to null and rejects a second emit, so earlier progress prints are harmless.

```python
import sys; sys.path.insert(0, HARNESS_TOOLS)  # the directory containing this file
from harness_output import emit_handoff
emit_handoff(
    scope=work_order_scope, reply="Q3 revenue was GBP 10.",
    claims=[{"id": "q3_revenue", "label": "Q3 revenue", "value": revenue, "unit": "GBP", "sourcePaths": ["files/sales.csv"]},
            {"id": "q3_margin", "label": "Q3 margin", "value": None, "unit": "%", "status": "held", "reason": "53 lines lack cost", "sourcePaths": ["files/sales.csv"]}],
    diagnostics=diagnostics, completed_operations=["T1"], results=["results.csv"], coverage=[], review_reasons=[])
```

`handoff.json` is written beside the script and listed as evidence automatically. Supporting checks that are not delivered claims go in `supporting_checks`.
````

- [x] **Step 7: Verify and commit**

Run: `npx vitest run tests/unit/recorded-output.test.ts tests/unit/workflow-self-check.test.ts && npx tsc --noEmit && npx vitest run 2>&1 | tail -4`
Expected: all pass.

```bash
git add src/agent/workflow/recorded-output.ts src/agent/workflow/checkpoints.ts src/agent/workflow/contracts.ts src/agent/workflow/worker.ts src/agent/workflow/output-contract.ts src/agent/workflow/handoff.ts src/agent/workflow/role-prompts.ts bundled/harness-tools/data-analysis.md tests/unit/recorded-output.test.ts tests/unit/workflow-self-check.test.ts
git commit -m "feat: build analyst handoff from executed single-document output"
```

---

### Task 11: Review policy, typed triggers and structured reasons

Today any self-check problem, including a one-line uncertainty note, runs the full verifier. This task makes the gate report *typed triggers* and adds a configurable routing function. Without a `workflow.review` block, behaviour is unchanged (`legacyReviewPolicy`: everything goes to the full verifier).

**Files:**
- Create: `src/agent/workflow/review-policy.ts`
- Modify: `src/agent/workflow/checkpoints.ts` (replace `validateNumericalEvidence`; `sealCheckpoint` reply override)
- Modify: `src/agent/workflow/output-contract.ts` (structured `reviewReasons`)
- Modify: `src/agent/workflow/contracts.ts` (`AnalysisPacket.reviewReasons`)
- Modify: `src/settings.ts`, `src/runtime.ts` (`workflow.review`)
- Modify: `bundled/harness-tools/data-analysis.md`
- Test: `tests/unit/review-policy.test.ts`, `tests/unit/workflow-self-check.test.ts`

- [x] **Step 1: Write the failing policy tests**

Create `tests/unit/review-policy.test.ts`:

```ts
import {expect,it} from 'vitest';
import {mkdtemp,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {routeReview,parseReviewPolicy,legacyReviewPolicy,reasonTrigger,triggersFromError,ReviewTriggers} from '../../src/agent/workflow/review-policy.js';
import {readHarnessSettings} from '../../src/settings.js';
const policy=parseReviewPolicy({note:['metadata'],repair:['packaging'],targeted:['calculation','coverage','eligibility','join-integrity'],full:['reconciliation','scope','unclassified'],askUser:['definition'],escalateToFullWhen:{claimsAffectedOver:2,shareOfClaimsOver:0.5}});
const ids=['a','b','c','d'];
it('routes by precedence: user request, full, ask-user, repair, targeted, note',()=>{
 expect(routeReview([],ids,policy,false)).toEqual({outcome:'none',triggers:[],targetClaimIds:[]});
 expect(routeReview([],ids,policy,true).outcome).toBe('full');
 expect(routeReview([{kind:'calculation',detail:'x',claimIds:['a']},{kind:'reconciliation',detail:'y'}],ids,policy,false).outcome).toBe('full');
 expect(routeReview([{kind:'definition',detail:'gross or net?'},{kind:'packaging',detail:'p'}],ids,policy,false).outcome).toBe('ask-user');
 expect(routeReview([{kind:'packaging',detail:'p'},{kind:'calculation',detail:'x',claimIds:['a']}],ids,policy,false).outcome).toBe('repair');
 expect(routeReview([{kind:'calculation',detail:'x',claimIds:['a']},{kind:'metadata',detail:'m'}],ids,policy,false)).toMatchObject({outcome:'targeted',targetClaimIds:['a']});
 expect(routeReview([{kind:'metadata',detail:'m',claimIds:['a']}],ids,policy,false).outcome).toBe('note');
});
it('escalates targeted review to full when scope is unknown or too wide',()=>{
 expect(routeReview([{kind:'calculation',detail:'x'}],ids,policy,false).outcome).toBe('full');
 expect(routeReview([{kind:'calculation',detail:'x',claimIds:['a','b','c']}],ids,policy,false).outcome).toBe('full');
 expect(routeReview([{kind:'coverage',detail:'x',claimIds:['a','b']}],['a','b','c'],policy,false).outcome).toBe('full');
 expect(routeReview([{kind:'calculation',detail:'x',claimIds:['supporting_only']}],ids,policy,false).outcome).toBe('full');
 expect(routeReview([{kind:'mystery',detail:'x',claimIds:['a']}],ids,policy,false).outcome).toBe('full');
});
it('keeps legacy behaviour when no policy is configured',()=>{
 for(const kind of ['packaging','metadata','calculation','definition'])expect(routeReview([{kind,detail:'x',claimIds:['a']}],ids,legacyReviewPolicy,false).outcome).toBe('full');
});
it('maps reasons and errors to triggers',()=>{
 expect(reasonTrigger('Ambiguous mapping')).toEqual({kind:'calculation',detail:'Ambiguous mapping'});
 expect(reasonTrigger({kind:'metadata',question:'Blank label',claimIds:['a']})).toEqual({kind:'metadata',detail:'Blank label',claimIds:['a']});
 expect(triggersFromError(new ReviewTriggers([{kind:'scope',detail:'s'}]))).toEqual([{kind:'scope',detail:'s'}]);
 expect(triggersFromError(new Error('boom'))).toEqual([{kind:'unclassified',detail:'boom'}]);
});
it('validates review settings strictly',async()=>{
 expect(()=>parseReviewPolicy({targeted:['calculation'],full:['calculation']})).toThrow(/more than once/);
 expect(()=>parseReviewPolicy({targeted:['vibes']})).toThrow(/workflow.review.targeted/);
 expect(()=>parseReviewPolicy({extra:true})).toThrow(/Unknown settings key/);
 expect(()=>parseReviewPolicy({escalateToFullWhen:{shareOfClaimsOver:2}})).toThrow(/shareOfClaimsOver/);
 expect(parseReviewPolicy({background:true}).background).toBe(true);
 const path=join(await mkdtemp(join(tmpdir(),'settings-')),'config.json');
 await writeFile(path,JSON.stringify({schemaVersion:1,workflow:{review:{targeted:['vibes']}}}));
 expect(()=>readHarnessSettings(path)).toThrow(/workflow.review/);
});
```

Run: `npx vitest run tests/unit/review-policy.test.ts` → FAIL (module missing).

- [x] **Step 2: Implement `review-policy.ts`**

Create `src/agent/workflow/review-policy.ts`:

```ts
export const reasonKinds=['metadata','definition','calculation','coverage','eligibility'] as const;
export type ReasonKind=typeof reasonKinds[number];
export type ReviewReason=string|{kind:ReasonKind;question:string;claimIds?:string[]};
export const triggerKinds=['source-coverage','parsing','join-integrity','period-coverage','reconciliation','eligibility','metadata','definition','calculation','coverage','packaging','scope','unclassified'] as const;
export type ReviewTrigger={kind:string;detail:string;claimIds?:string[]};
export class ReviewTriggers extends Error{constructor(public triggers:ReviewTrigger[]){super('Independent review requested: '+triggers.map(t=>`${t.kind}: ${t.detail}`).join('; '));}}
export type ReviewOutcome='none'|'note'|'repair'|'targeted'|'full'|'ask-user';
export type ReviewPolicy={note:string[];repair:string[];targeted:string[];full:string[];askUser:string[];escalateToFullWhen:{claimsAffectedOver:number;shareOfClaimsOver:number};background:boolean};
export type RouteDecision={outcome:ReviewOutcome;triggers:ReviewTrigger[];targetClaimIds:string[]};
// Without workflow.review every trigger runs the full verifier, blocking: the pre-2.2 behaviour.
export const legacyReviewPolicy:ReviewPolicy={note:[],repair:[],targeted:[],full:[...triggerKinds],askUser:[],escalateToFullWhen:{claimsAffectedOver:1,shareOfClaimsOver:1},background:false};
export function reasonTrigger(reason:ReviewReason):ReviewTrigger{return typeof reason==='string'?{kind:'calculation',detail:reason}:{kind:reason.kind,detail:reason.question,...(reason.claimIds?.length?{claimIds:reason.claimIds}:{})};}
export function triggersFromError(error:unknown):ReviewTrigger[]{return error instanceof ReviewTriggers?error.triggers:[{kind:'unclassified',detail:(error as Error)?.message??String(error)}];}
// Precedence: user request > full > ask-user > repair > targeted > note. Unlisted kinds are full.
export function routeReview(triggers:ReviewTrigger[],claimIds:string[],policy:ReviewPolicy,userRequestedIndependent:boolean):RouteDecision{
 const all=[...claimIds];
 if(userRequestedIndependent)return {outcome:'full',triggers:[{kind:'user-request',detail:'User requested independent review'},...triggers],targetClaimIds:all};
 if(!triggers.length)return {outcome:'none',triggers,targetClaimIds:[]};
 const outcomeOf=(kind:string):ReviewOutcome=>policy.full.includes(kind)?'full':policy.askUser.includes(kind)?'ask-user':policy.repair.includes(kind)?'repair':policy.targeted.includes(kind)?'targeted':policy.note.includes(kind)?'note':'full';
 const outcomes=triggers.map(t=>outcomeOf(t.kind));
 if(outcomes.includes('full'))return {outcome:'full',triggers,targetClaimIds:all};
 for(const outcome of ['ask-user','repair'] as const)if(outcomes.includes(outcome))return {outcome,triggers,targetClaimIds:[]};
 const targeted=triggers.filter((_,i)=>outcomes[i]==='targeted');
 if(!targeted.length)return {outcome:'note',triggers,targetClaimIds:[]};
 if(targeted.some(t=>!t.claimIds?.length))return {outcome:'full',triggers,targetClaimIds:all};
 const targets=[...new Set(targeted.flatMap(t=>t.claimIds!))].filter(id=>claimIds.includes(id)),limits=policy.escalateToFullWhen;
 if(!targets.length||targets.length>=claimIds.length||targets.length>limits.claimsAffectedOver||targets.length/claimIds.length>limits.shareOfClaimsOver)return {outcome:'full',triggers,targetClaimIds:all};
 return {outcome:'targeted',triggers,targetClaimIds:targets};
}
export function parseReviewPolicy(raw:unknown):ReviewPolicy{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Invalid settings object: workflow.review');
 const o=raw as Record<string,unknown>,keys=['note','repair','targeted','full','askUser','escalateToFullWhen','background'];
 for(const key of Object.keys(o))if(!keys.includes(key))throw Error(`Unknown settings key: workflow.review.${key}`);
 const list=(key:string)=>{const value=o[key]??[];if(!Array.isArray(value)||value.some(k=>typeof k!=='string'||!(triggerKinds as readonly string[]).includes(k)))throw Error(`Invalid settings workflow.review.${key}: use ${triggerKinds.join(', ')}`);return value as string[];};
 const policy:ReviewPolicy={note:list('note'),repair:list('repair'),targeted:list('targeted'),full:list('full'),askUser:list('askUser'),escalateToFullWhen:{claimsAffectedOver:10,shareOfClaimsOver:0.3},background:false};
 const seen=new Set<string>();for(const kind of [...policy.note,...policy.repair,...policy.targeted,...policy.full,...policy.askUser]){if(seen.has(kind))throw Error(`workflow.review lists ${kind} more than once`);seen.add(kind);}
 if(o.escalateToFullWhen!==undefined){
  const e=o.escalateToFullWhen as Record<string,unknown>;
  if(!e||typeof e!=='object'||Array.isArray(e)||Object.keys(e).some(k=>!['claimsAffectedOver','shareOfClaimsOver'].includes(k)))throw Error('Invalid settings workflow.review.escalateToFullWhen');
  if(e.claimsAffectedOver!==undefined){if(!Number.isSafeInteger(e.claimsAffectedOver)||(e.claimsAffectedOver as number)<1)throw Error('Invalid settings workflow.review.escalateToFullWhen.claimsAffectedOver');policy.escalateToFullWhen.claimsAffectedOver=e.claimsAffectedOver as number;}
  if(e.shareOfClaimsOver!==undefined){const share=e.shareOfClaimsOver;if(typeof share!=='number'||!(share>0&&share<=1))throw Error('Invalid settings workflow.review.escalateToFullWhen.shareOfClaimsOver');policy.escalateToFullWhen.shareOfClaimsOver=share;}
 }
 if(o.background!==undefined){if(typeof o.background!=='boolean')throw Error('Invalid settings workflow.review.background');policy.background=o.background;}
 return policy;
}
```

- [x] **Step 3: Wire settings and runtime**

In `src/settings.ts`:
1. After `import {resolve} from 'node:path';` add `import {parseReviewPolicy,type ReviewPolicy} from './agent/workflow/review-policy.js';`
2. Replace `policy?:WorkflowPolicy};` with `policy?:WorkflowPolicy;review?:unknown};`
3. Replace `const w=object(s.workflow,'workflow',['mode','limits','policy']);` with `const w=object(s.workflow,'workflow',['mode','limits','policy','review']);if(w.review!==undefined)parseReviewPolicy(w.review);`
4. Replace `return {env:{...values,...env},policy:settings?.workflow?.policy,configFile:settings?path:undefined};` with `const review:ReviewPolicy|undefined=settings?.workflow?.review!==undefined?parseReviewPolicy(settings.workflow.review):undefined;return {env:{...values,...env},policy:settings?.workflow?.policy,review,configFile:settings?path:undefined};`

In `src/runtime.ts`:
1. After `import {settingsForRuntime,type WorkflowPolicy} from './settings.js';` add `import type {ReviewPolicy} from './agent/workflow/review-policy.js';`
2. Replace `workflowPolicy?:WorkflowPolicy;` with `workflowPolicy?:WorkflowPolicy;reviewPolicy?:ReviewPolicy;`
3. Replace `workflowPolicy:settings.policy,` with `workflowPolicy:settings.policy,reviewPolicy:settings.review,`

Run: `npx vitest run tests/unit/review-policy.test.ts` → 5 passed.

- [x] **Step 4: Structured reasons in the schema**

In `src/agent/workflow/output-contract.ts`:
1. After the `fromExecution` const added in Task 10, add
```ts
const reviewReason=Type.Union([text(),object({kind:Type.Union(['metadata','definition','calculation','coverage','eligibility'].map(k=>Type.Literal(k))),question:text(),claimIds:Type.Optional(ids())})],{description:'Text, or {kind, question, claimIds}. metadata: a label/attribute gap that confirmed context already resolves (state that fact). definition: needs the user. calculation, coverage, eligibility: doubt about named claims. claimIds name affected claims; omit only when every claim is affected.'});
```
2. Replace both occurrences of `reviewReasons:Type.Optional(strings())` with `reviewReasons:Type.Optional(Type.Array(reviewReason))` (use replace_all).
3. Replace `reviewReasons:strings()` with `reviewReasons:Type.Array(reviewReason)`.

In `src/agent/workflow/contracts.ts`:
1. Add at the top: `import type {ReviewReason} from './review-policy.js';`
2. In `AnalysisPacket`, replace `reviewReasons?:string[];` with `reviewReasons?:ReviewReason[];`

- [x] **Step 5: Write the failing trigger tests**

Append to `tests/unit/workflow-self-check.test.ts` (add `import { ReviewTriggers } from "../../src/agent/workflow/review-policy.js";` to the imports at the top):

```ts
it.each([
  ["missing-kind", "packaging"],
  ["failed-control", "source-coverage"],
  ["uncertain", "calculation"],
  ["wrong-scope", "scope"],
  ["structured", "metadata"],
])("reports %s as a typed %s trigger", async (mode, kind) => {
  const f = await fixture();
  if (mode === "missing-kind") f.output.diagnostics.pop();
  if (mode === "failed-control") f.output.diagnostics[0].actual = 2;
  if (mode === "uncertain") f.output.reviewReasons = ["Ambiguous mapping"];
  if (mode === "wrong-scope") f.output.scope.period = "Q2";
  if (mode === "structured") f.output.reviewReasons = [{ kind: "metadata", question: "Blank unit label", claimIds: ["revenue"] }];
  await f.update();
  const error = await sealCheckpoint(f.options).catch((e) => e);
  expect(error).toBeInstanceOf(ReviewTriggers);
  expect(error.triggers.map((t: any) => t.kind)).toContain(kind);
});
it("seals when every trigger is an accepted note or a deferred trigger on claims outside the packet", async () => {
  const f = await fixture();
  f.output.reviewReasons = [{ kind: "metadata", question: "Blank unit label", claimIds: ["revenue"] }];
  await f.update();
  expect((await sealCheckpoint({ ...f.options, noteKinds: new Set(["metadata"]) })).checkpoint.verification.approved).toEqual(["revenue"]);
  const g = await fixture();
  g.output.reviewReasons = [{ kind: "calculation", question: "Margin basis", claimIds: ["margin"] }];
  await g.update();
  g.options.packet.claims = g.options.packet.claims.filter((c: any) => c.id === "revenue");
  expect((await sealCheckpoint({ ...g.options, deferredKinds: new Set(["calculation"]) })).checkpoint.claims.map((c) => c.id)).toEqual(["revenue"]);
  const h = await fixture();
  h.output.reviewReasons = [{ kind: "calculation", question: "Revenue basis", claimIds: ["revenue"] }];
  await h.update();
  await expect(sealCheckpoint({ ...h.options, deferredKinds: new Set(["calculation"]) })).rejects.toBeInstanceOf(ReviewTriggers);
});
it("stores a reply override on the checkpoint", async () => {
  const f = await fixture();
  expect((await sealCheckpoint({ ...f.options, reply: "Display reply" })).checkpoint.reply).toBe("Display reply");
});
```

Run: `npx vitest run tests/unit/workflow-self-check.test.ts` → the new tests FAIL (plain `Error`, unknown options).

- [x] **Step 6: Replace `validateNumericalEvidence`**

In `src/agent/workflow/checkpoints.ts`:

1. After `import {parseRecordedOutput} from './recorded-output.js';` add `import {ReviewTriggers,reasonTrigger,type ReviewReason,type ReviewTrigger} from './review-policy.js';`
2. Replace the entire function from `export async function validateNumericalEvidence(` up to (not including) `export async function sealCheckpoint(` with:

```ts
export async function validateNumericalEvidence(options:{root:string;packet:AnalysisPacket;verification:Partial<VerificationRecord>&Pick<VerificationRecord,'reply'>;executions:Execution[];sources:FileRef[];runId:string;conversationId:string;evidenceMode?:Assurance;tasks?:string[];previous?:{checkpoint:Checkpoint;ref:FileRef};noteKinds?:ReadonlySet<string>;deferredKinds?:ReadonlySet<string>}){
 const {root,verification:producer,sources,conversationId}=options;
 const packet=validatePacket(structuredClone(options.packet));
 const assurance=options.evidenceMode??'independently-reviewed',self=assurance==='self-checked';
 // Self-check findings are typed triggers the controller routes; verifier failures stay plain errors.
 function raise(kind:string,detail:string,claimIds?:string[]):never{throw new ReviewTriggers([{kind,detail,...(claimIds?.length?{claimIds}:{})}]);}
 function fail(message:string,claimIds?:string[]):never{if(self)raise('packaging',message,claimIds);throw new Error(message);}
 if(!self&&(typeof producer.reply!=='string'||!producer.reply.trim()))throw new Error('Invalid verification record');
 // Execution identity belongs to the controller ledger, not producer prose.
 // Check the latest successful execution for the selected assurance; never fall back to older facts.
 const execution=options.executions.filter(e=>e.role===(self?'analyst':'verifier')&&e.success).at(-1);
 if(!execution)throw new Error('Recorded verification execution evidence is required; execute checks before returning a numerical handoff');
 if(!execution.provenance||!execution.accessed?.length||!await stableRefs(root,[execution.provenance,...execution.accessed]))throw new Error('Recorded independent source access is required');
 const accessRecord=JSON.parse(await readFile(await safePath(root,execution.provenance.path),'utf8'));
 if(accessRecord.schemaVersion!==1||!accessRecord.success||!Array.isArray(accessRecord.reads)||execution.accessed.some(r=>!accessRecord.reads.includes(r.path)))throw new Error('Invalid source-access provenance');
 const refs=await Promise.all([...packet.code,...packet.results].map(async path=>({path,sha256:(await hashFile(await safePath(root,path))).sha256})));
 if(!await stableRefs(root,[...sources,execution.script,execution.output]))throw new Error('Verification source/script/output changed');
 const script=await readFile(await safePath(root,execution.script.path),'utf8');
 if(!self&&packet.code.some(path=>refs.find(r=>r.path===path)?.sha256===execution.script.sha256||script.includes(path)||script.includes(basename(path))))throw new Error('Independent verification cannot rerun/import analyst code');
 type Check={claimId:string;status:string;actual?:unknown;tolerance?:number;sourcePaths?:string[];reason?:string};
 let output:{checks:Check[]}={checks:[]};
 try{output=parseRecordedOutput(await readFile(await safePath(root,execution.output.path),'utf8')) as {checks:Check[]};}catch(error){fail('Recorded check output is not one JSON document: '+(error as Error).message);}
 if(!Array.isArray(output.checks))fail('Independent execution lacks checks');
 try{assertSchema(numericalChecksSchema,output);}catch(error){fail((error as Error).message);}
 if(new Set(output.checks.map(c=>c.claimId)).size!==output.checks.length)fail('Duplicate independent check claimId');
 let completion=producer;const triggers:ReviewTrigger[]=[];
 if(self){
  try{assertSchema(selfChecksSchema,output);}catch(error){raise('packaging','Self-check output does not match checkOutputSchema: '+(error as Error).message);}
  const facts=output as typeof output&{scope:Scope;reply:string;completedOperations:string[];pendingOperations?:string[];reviewReasons:ReviewReason[];diagnostics:{id:string;kind:string;actual:number|null;expected:number|null;reason:string;sourcePaths:string[];claimIds?:string[]}[]};
  if(!sameScope(facts.scope,packet.scope))raise('scope','Self-check scope differs from requested scope');
  if(!packet.code.includes(execution.script.path))raise('packaging','Self-check script must be in the executed calculation package');
  // The controller binds recorded facts; the producer need not repeat its stdout path.
  packet.results=[...new Set([...packet.results,execution.output.path])];if(!refs.some(ref=>ref.path===execution.output.path))refs.push(execution.output);
  for(const claim of packet.claims)claim.evidence=[...new Set([...claim.evidence,execution.output.path])];
  for(const reason of [...(packet.reviewReasons??[]),...facts.reviewReasons])triggers.push(reasonTrigger(reason));
  const knownSources=new Map(sources.map(s=>[s.path,s.sha256]));
  if(new Set(facts.diagnostics.map(d=>d.id)).size!==facts.diagnostics.length)raise('packaging','Duplicate diagnostic ID');
  for(const kind of diagnosticKinds)if(!facts.diagnostics.some(d=>d.kind===kind))raise('packaging','Missing self-check diagnostic: '+kind);
  for(const d of facts.diagnostics){
   const affected=d.claimIds?.length?{claimIds:d.claimIds}:{};
   if(d.sourcePaths.some(path=>!knownSources.has(path)||!execution.accessed!.some(r=>r.path===path&&r.sha256===knownSources.get(path))))raise('packaging','Diagnostic lacks recorded source access: '+d.id);
   if(d.claimIds?.some(id=>!output.checks.some(c=>c.claimId===id)))raise('packaging','Unknown diagnostic claim ID: '+d.id);
   // Null/null means explicitly inapplicable, with the schema-required explanation.
   if(d.actual===null&&d.expected===null){if(!['join-integrity','period-coverage'].includes(d.kind))triggers.push({kind:d.kind,detail:'Required numeric diagnostic is inapplicable: '+d.id,...affected});continue;}
   if(typeof d.actual!=='number'||typeof d.expected!=='number'||!Number.isFinite(d.actual)||!Number.isFinite(d.expected)){triggers.push({kind:d.kind,detail:'Non-finite diagnostic: '+d.id,...affected});continue;}
   if(Math.abs(d.actual-d.expected)>Math.max(1e-9,Math.abs(d.expected)*1e-9)){
    const coveredHold=d.kind==='eligibility'&&d.claimIds?.length&&d.claimIds.every(id=>packet.claims.some(c=>c.id===id)&&output.checks.some(check=>check.claimId===id&&check.status==='held'&&check.reason?.trim()));
    if(!coveredHold)triggers.push({kind:d.kind,detail:`Self-check diagnostic failed: ${d.id}; actual=${d.actual}, expected=${d.expected}`,...affected});
   }
  }
  if(!options.tasks||[...facts.completedOperations,...(facts.pendingOperations??[])].some(id=>!options.tasks!.includes(id))||facts.completedOperations.some(id=>facts.pendingOperations?.includes(id)))raise('packaging','Self-check completion must name supplied task IDs without conflicts');
  // Notes are accepted as coverage; deferred (targeted) triggers are accepted only when they name claims outside this packet.
  const accepted=(t:ReviewTrigger)=>!!options.noteKinds?.has(t.kind)||!!options.deferredKinds?.has(t.kind)&&!!t.claimIds?.length&&!t.claimIds.some(id=>packet.claims.some(c=>c.id===id));
  if(triggers.some(t=>!accepted(t)))throw new ReviewTriggers(triggers);
  completion=facts;
 }
 // Supporting self-check calculations need not all appear in the delivered subset.
 const selectedChecks=self?output.checks.filter(check=>packet.claims.some(c=>c.id===check.claimId)):output.checks;
 // Executed check facts own approvals and holds; producer prose is not an ID list.
 const v:VerificationRecord={schemaVersion:1,assurance,reply:completion.reply,checkExecution:execution.id,approved:selectedChecks.filter(c=>c.status==='approved').map(c=>c.claimId),held:selectedChecks.filter(c=>c.status==='held').map(c=>c.claimId),...(completion.completedOperations?{completedOperations:completion.completedOperations}:{}),...(completion.pendingOperations?{pendingOperations:completion.pendingOperations}:{})};
 const known=new Set(sources.map(s=>s.path));const claims=packet.claims.filter(c=>v.approved.includes(c.id));
 for(const id of [...v.approved,...v.held])if(!packet.claims.some(c=>c.id===id))fail('Unknown verification claim');
 for(const c of claims){
  const check=output.checks.find(x=>x.claimId===c.id);
  if(c.value===null||!check||check.status!=='approved'||!check.sourcePaths?.length||check.sourcePaths.some(path=>!known.has(path)||!execution.accessed!.some(ref=>ref.path===path&&ref.sha256===sources.find(s=>s.path===path)?.sha256)))fail('Unsupported claim approval',[c.id]);
  if(typeof c.value==='number'){const tolerance=Math.max(0.01,Math.abs(c.value)*Number.EPSILON*8);if(typeof check!.actual!=='number'||!Number.isFinite(check!.actual)||Math.abs(check!.actual-c.value)>tolerance)fail(`${c.id}: Analyst/verifier disagree; candidate=${c.value}, actual=${check!.actual}, allowedTolerance=${tolerance}`,[c.id]);}
  else if(JSON.stringify(check!.actual)!==JSON.stringify(c.value))fail(`${c.id}: Analyst/verifier disagree`,[c.id]);
 }
 if(packet.resolvedRanking){const ranking=packet.resolvedRanking;const rankClaim=claims.find(c=>c.id===ranking.claimId);if(!rankClaim||!Array.isArray(rankClaim.value)||JSON.stringify(rankClaim.value)!==JSON.stringify(ranking.cohort)||new Set(ranking.cohort).size!==ranking.cohort.length||!ranking.window)fail('Ranking cohort lacks independent approval');packet.scope={...packet.scope,rankingWindow:ranking.window,cohort:ranking.cohort};}
 const held=packet.claims.filter(c=>!v.approved.includes(c.id)).map(c=>c.id);
 if(held.some(id=>!v.held.includes(id)))fail('Unreviewed claims require explicit holds',held.filter(id=>!v.held.includes(id)));
 for(const id of held){const check=output.checks.find(c=>c.claimId===id);if(!check||check.status!=='held'||!check.reason?.trim()||/budget|deadline|timeout|not checked|not completed/i.test(check.reason)||!check.sourcePaths?.length||check.sourcePaths.some(path=>!known.has(path)||!execution.accessed!.some(ref=>ref.path===path)))fail('Hold lacks independently executed source evidence',[id]);}
 if(!claims.length&&!held.length)fail('No verified claims or source-related holds');
 const previous=options.previous;
 if(previous){
  if(!await loadCheckpoint(root,previous.ref,conversationId,previous.checkpoint.scope)||!sameScope(previous.checkpoint.scope,packet.scope))throw new Error('Previous checkpoint changed or scope differs');
  if(packet.claims.some(c=>previous.checkpoint.claims.some(p=>p.id===c.id)||previous.checkpoint.held.includes(c.id)))fail('Continuation reused a checked claim ID');
 }
 packet.holds=[...new Set([...packet.holds,...selectedChecks.filter(c=>c.status==='held').map(c=>c.reason!)])];
 const heldDetails=selectedChecks.filter(c=>c.status==='held').flatMap(check=>{const claim=packet.claims.find(item=>item.id===check.claimId);return claim&&typeof check.reason==='string'&&check.reason.trim()?[{id:claim.id,label:claim.label,unit:claim.unit,reason:check.reason}]:[];});
 return {packet,claims,held,heldDetails,refs,verification:v,execution:execution as Execution&{provenance:FileRef},deferredTriggers:triggers};
}
```

3. Replace `export async function sealCheckpoint(options:Parameters<typeof validateNumericalEvidence>[0]){` with `export async function sealCheckpoint(options:Parameters<typeof validateNumericalEvidence>[0]&{reply?:string}){`
4. Replace `reply:v.reply,` with `reply:options.reply??v.reply,`

- [x] **Step 7: Document structured reasons**

In `bundled/harness-tools/data-analysis.md`:
1. Replace the sentence `Unresolved definitions, assumptions or conflicting data belong in \`reviewReasons\`, which activates independent review.` with:
```markdown
Unresolved definitions, assumptions or conflicting data belong in `reviewReasons`. Prefer the structured form `{"kind": ..., "question": ..., "claimIds": [...]}`: `definition` when only the user can decide; `metadata` for a label or attribute gap that confirmed context already resolves (state that context fact in `question`); `calculation`, `coverage` or `eligibility` for doubt about named claims. Name affected `claimIds` so review can target them; omit them only when every claim is affected. Plain-text reasons are treated as affecting every claim.
```
2. Replace `Complete valid checks deliver a **self-checked** answer without another model stage. Failed/missing checks or explicit review requests activate the independent verifier.` with:
```markdown
Complete valid checks deliver a **self-checked** answer without another model stage. Otherwise the harness routes by configuration: packaging faults get one repair turn, definition questions go to the user, notes become coverage, doubts about a few named claims get a targeted independent check of only those claims, and failed reconciliation, scope differences or explicit review requests run the full independent verifier.
```

- [x] **Step 8: Verify and commit**

Run: `npx vitest run tests/unit/review-policy.test.ts tests/unit/workflow-self-check.test.ts && npx tsc --noEmit && npx vitest run 2>&1 | tail -4`
Expected: all pass. The orchestrator still uses the old routing; integration tests must be unchanged.

```bash
git add src/agent/workflow/review-policy.ts src/agent/workflow/checkpoints.ts src/agent/workflow/output-contract.ts src/agent/workflow/contracts.ts src/settings.ts src/runtime.ts bundled/harness-tools/data-analysis.md tests/unit/review-policy.test.ts tests/unit/workflow-self-check.test.ts
git commit -m "feat: type self-check findings and add configurable review policy"
```

---

### Task 12: Route self-check findings in the orchestrator

Implements repair, ask-user, note, targeted (blocking) and full routes. Background delivery comes in Task 13.

**Files:**
- Create: `src/agent/workflow/targeted-review.ts`
- Modify: `src/agent/workflow/orchestrator.ts`
- Modify: `src/agent/workflow/role-prompts.ts` (verifier)
- Test: `tests/unit/targeted-review.test.ts`, `tests/integration/review-routing.test.ts`

- [x] **Step 1: Write the failing unit test**

Create `tests/unit/targeted-review.test.ts`:

```ts
import {expect,it} from 'vitest';
import {splitPacket,correctionNotes} from '../../src/agent/workflow/targeted-review.js';
const packet:any={schemaVersion:1,scope:{population:'all',period:'Q3',basis:'GBP'},claims:[{id:'a',label:'A',value:1,unit:'GBP',evidence:['r']},{id:'rank',label:'Top',value:['x','y'],unit:'products',evidence:['r']}],coverage:['c'],holds:[],code:['s.py'],results:['r'],calculationVersion:'1',resolvedRanking:{window:'Q3',cohort:['x','y'],claimId:'rank'},exploration:{schemaVersion:1}};
it('splits claims and keeps ranking and exploration with the targeted side',()=>{
 const {remainder,targeted}=splitPacket(packet,['rank']);
 expect(remainder.claims.map(c=>c.id)).toEqual(['a']);expect(remainder.resolvedRanking).toBeUndefined();expect(remainder.exploration).toBeUndefined();
 expect(targeted.claims.map(c=>c.id)).toEqual(['rank']);expect(targeted.resolvedRanking?.claimId).toBe('rank');expect(targeted.exploration).toEqual({schemaVersion:1});
 expect(targeted.coverage).toEqual(['c']);
});
it('describes changed and withheld values',()=>{
 const before:any=[{id:'m',label:'Margin',value:40,unit:'%'},{id:'r',label:'Revenue',value:10,unit:'GBP'},{id:'c',label:'Cost',value:6,unit:'GBP'}];
 const after:any=[{id:'m',label:'Margin',value:38,unit:'%'},{id:'r',label:'Revenue',value:10,unit:'GBP'}];
 expect(correctionNotes(before,after,['c'])).toEqual(['Margin: 40 → 38 %','Cost: withheld after review']);
});
```

Run: `npx vitest run tests/unit/targeted-review.test.ts` → FAIL (module missing).

- [x] **Step 2: Implement `targeted-review.ts`**

Create `src/agent/workflow/targeted-review.ts`:

```ts
import {sealCheckpoint} from './checkpoints.js';
import type {AnalysisPacket,Checkpoint,Claim,Execution,FileRef,StageResult,VerificationRecord} from './contracts.js';
export type Sealed={checkpoint:Checkpoint;ref:FileRef};
export type TargetedOutcome={kind:'sealed';provisional:Sealed;final:Sealed}|{kind:'fallback';reason:string;provisional?:Sealed;verifier?:StageResult};
// Exploration stays with the targeted side: it is bound once against the merged final checkpoint.
export function splitPacket(packet:AnalysisPacket,targetIds:string[]){
 const targets=new Set(targetIds);const {resolvedRanking,exploration,explorationIssues,...base}=packet;
 const remainder:AnalysisPacket={...base,claims:packet.claims.filter(c=>!targets.has(c.id)),...(resolvedRanking&&!targets.has(resolvedRanking.claimId)?{resolvedRanking}:{})};
 const targeted:AnalysisPacket={...base,claims:packet.claims.filter(c=>targets.has(c.id)),...(resolvedRanking&&targets.has(resolvedRanking.claimId)?{resolvedRanking}:{}),...(exploration?{exploration}:{}),...(explorationIssues?{explorationIssues}:{})};
 return {remainder,targeted};
}
const show=(value:unknown)=>Array.isArray(value)?value.join(', '):value===null?'unavailable':String(value);
export function correctionNotes(before:Claim[],after:Claim[],held:string[]){
 const changed=after.flatMap(c=>{const old=before.find(b=>b.id===c.id);return old&&JSON.stringify(old.value)!==JSON.stringify(c.value)?[`${c.label}: ${show(old.value)} → ${show(c.value)} ${c.unit}`]:[];});
 const withheld=before.filter(b=>b.value!==null&&held.includes(b.id)&&!after.some(c=>c.id===b.id)).map(b=>`${b.label}: withheld after review`);
 return [...changed,...withheld];
}
// Seal unaffected claims as self-checked, independently check only the targets, then chain both into one mixed checkpoint.
export async function runTargetedReview(deps:{sealOptions:{root:string;sources:FileRef[];runId:string;conversationId:string;tasks:string[];previous?:Sealed};packet:AnalysisPacket;analystExecutions:Execution[];targetClaimIds:string[];noteKinds:ReadonlySet<string>;deferredKinds:ReadonlySet<string>;runVerifier:(targeted:AnalysisPacket,provisional:Sealed)=>Promise<StageResult>;onProvisional?:(provisional:Sealed,pendingLabels:string[])=>Promise<void>}):Promise<TargetedOutcome>{
 const {remainder,targeted}=splitPacket(deps.packet,deps.targetClaimIds);
 if(!remainder.claims.length||!targeted.claims.length)return {kind:'fallback',reason:'targeted review needs both self-checked and targeted claims'};
 let provisional:Sealed;
 try{provisional=await sealCheckpoint({...deps.sealOptions,packet:remainder,executions:deps.analystExecutions,evidenceMode:'self-checked',verification:{reply:''},noteKinds:deps.noteKinds,deferredKinds:deps.deferredKinds});}
 catch(error){return {kind:'fallback',reason:'provisional self-check failed: '+(error as Error).message};}
 await deps.onProvisional?.(provisional,targeted.claims.map(c=>c.label));
 const verifier=await deps.runVerifier(targeted,provisional);
 const data=verifier.data as VerificationRecord&{blockingInput?:string};
 if(data?.correction||data?.blockingInput)return {kind:'fallback',reason:data.correction?'verifier requested a correction':'verifier needs input',provisional,verifier};
 try{const final=await sealCheckpoint({...deps.sealOptions,previous:provisional,packet:targeted,executions:verifier.executions,evidenceMode:'independently-reviewed',verification:data,reply:provisional.checkpoint.reply});return {kind:'sealed',provisional,final};}
 catch(error){return {kind:'fallback',reason:'targeted verification failed: '+(error as Error).message,provisional,verifier};}
}
```

Run: `npx vitest run tests/unit/targeted-review.test.ts` → 2 passed.

- [x] **Step 3: Write the failing routing tests**

Create `tests/integration/review-routing.test.ts`:

```ts
import {expect,it} from 'vitest';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {parseReviewPolicy} from '../../src/agent/workflow/review-policy.js';
import {createFlow,type FlowClaim} from '../fixtures/workflow-flow.js';
const recommended=(background=false)=>parseReviewPolicy({note:['metadata'],repair:['packaging'],targeted:['calculation','coverage','eligibility','join-integrity','parsing','period-coverage','source-coverage'],full:['reconciliation','scope','unclassified'],askUser:['definition'],escalateToFullWhen:{claimsAffectedOver:10,shareOfClaimsOver:0.3},background});
const four:FlowClaim[]=[{id:'revenue',label:'Revenue',value:10,unit:'GBP'},{id:'cost',label:'Cost',value:6,unit:'GBP'},{id:'profit',label:'Profit',value:4,unit:'GBP'},{id:'margin_pct',label:'Margin',value:40,unit:'%'}];
const checkpoint=async(f:{root:string},ref:{path:string})=>JSON.parse(await readFile(join(f.root,ref.path),'utf8'));
it('keeps legacy full review when no policy is configured',async()=>{
 const f=await createFlow({analystFacts:(facts,attempt)=>{if(attempt===1)facts.reviewReasons=[{kind:'metadata',question:'Blank label',claimIds:['revenue']}];}});
 const result=await f.run();
 expect(f.calls).toEqual(['coordinator','analyst','verifier']);
 expect((await checkpoint(f,result.checkpoint!)).assurance).toBe('independently-reviewed');
});
it('gives packaging faults one repair turn before review',async()=>{
 const f=await createFlow({configure:c=>{c.reviewPolicy=recommended();},analystFacts:(facts,attempt)=>{if(attempt===1)delete facts.diagnostics;}});
 const result=await f.run();
 expect(f.calls).toEqual(['coordinator','analyst','analyst']);
 expect(f.inputs[2].operation).toBe('correct');
 expect(f.inputs[2].input.correction.detail).toMatch(/Self-check evidence was rejected/);
 expect((await checkpoint(f,result.checkpoint!)).assurance).toBe('self-checked');
});
it('escalates to the full verifier when the repair does not fix packaging',async()=>{
 const f=await createFlow({configure:c=>{c.reviewPolicy=recommended();},analystFacts:facts=>{delete facts.diagnostics;}});
 await f.run();
 expect(f.calls).toEqual(['coordinator','analyst','analyst','verifier']);
});
it('asks the user for definition questions',async()=>{
 const f=await createFlow({configure:c=>{c.reviewPolicy=recommended();},analystFacts:facts=>{facts.reviewReasons=[{kind:'definition',question:'Is revenue gross or net of returns?'}];}});
 const result=await f.run();
 expect(result.outcome.kind).toBe('needs-input');expect(f.calls).toEqual(['coordinator','analyst']);
 expect(f.messages.at(-1)!.text).toBe('Is revenue gross or net of returns?');
});
it('turns notes into coverage without review',async()=>{
 const f=await createFlow({configure:c=>{c.reviewPolicy=recommended();},analystFacts:facts=>{facts.reviewReasons=[{kind:'metadata',question:'One product has a blank unit label; confirmed context sets units to EA.',claimIds:['revenue']}];}});
 const result=await f.run();
 expect(f.calls).toEqual(['coordinator','analyst']);
 const cp=await checkpoint(f,result.checkpoint!);
 expect(cp.assurance).toBe('self-checked');expect(cp.coverage.join(' ')).toContain('blank unit label');
});
it('checks only the targeted claims and delivers a mixed checkpoint',async()=>{
 const f=await createFlow({claims:four,configure:c=>{c.reviewPolicy=recommended();},analystFacts:(facts,attempt)=>{if(attempt===1)facts.reviewReasons=[{kind:'calculation',question:'Margin uses invoice or net revenue?',claimIds:['margin_pct']}];}});
 const result=await f.run();
 expect(result.outcome.kind).toBe('complete');
 expect(f.calls).toEqual(['coordinator','analyst','verifier']);
 const verifierInput=f.inputs.find(i=>i.role==='verifier')!.input;
 expect(verifierInput.reviewMode).toBe('targeted');
 expect(verifierInput.analysisPacket.claims.map((c:any)=>c.id)).toEqual(['margin_pct']);
 const cp=await checkpoint(f,result.checkpoint!);
 expect(cp.assurance).toBe('mixed');expect(cp.claims).toHaveLength(4);expect(cp.reply).toBe('Analyst reply.');
 expect(f.messages.at(-1)!.text).toContain('Analyst reply.');
});
it('escalates targeted review to full when too large a share is affected',async()=>{
 const f=await createFlow({claims:four.slice(0,2),configure:c=>{c.reviewPolicy=recommended();},analystFacts:facts=>{facts.reviewReasons=[{kind:'calculation',question:'Cost basis?',claimIds:['cost']}];}});
 await f.run();
 expect(f.inputs.find(i=>i.role==='verifier')!.input.analysisPacket.claims).toHaveLength(2);
});
it('falls back to the full correction loop when the targeted verifier requests a correction',async()=>{
 const f=await createFlow({claims:four,configure:c=>{c.reviewPolicy=recommended();},analystFacts:(facts,attempt)=>{if(attempt===1)facts.reviewReasons=[{kind:'calculation',question:'Margin basis?',claimIds:['margin_pct']}];},verifier:(_input,attempt)=>attempt===1?{data:{schemaVersion:1,correction:{role:'analyst',detail:'Recheck margin'}}}:undefined});
 const result=await f.run();
 expect(result.outcome.kind).toBe('complete');
 expect(f.calls).toEqual(['coordinator','analyst','verifier','analyst','verifier']);
 expect((await checkpoint(f,result.checkpoint!)).assurance).toBe('independently-reviewed');
});
```

Run: `npx vitest run tests/integration/review-routing.test.ts`
Expected: the first test passes; the others FAIL.

- [x] **Step 4: Rewrite the group verification block**

In `src/agent/workflow/orchestrator.ts`:

1. After `import {compactProfiles,type SourceProfile} from './source-profiles.js';` add:
```ts
import {routeReview,triggersFromError,legacyReviewPolicy,type ReviewTrigger} from './review-policy.js';
import {runTargetedReview} from './targeted-review.js';
```
2. Replace `const assuranceNote=(cp:Checkpoint)=>` with `const reviewPolicy=config.reviewPolicy??legacyReviewPolicy;\n  const assuranceNote=(cp:Checkpoint)=>`
3. Replace every line from the line beginning `    const reviewReasons:string[]=requireIndependent?` (inside the group loop) through the line beginning `    await say(checkpoint.reply+assuranceNote(checkpoint),` (inclusive) with the block below. Keep the `while(verification.correction){...}` line exactly as it is in the current file. It is quoted in full here for reference and must stay unchanged:

```ts
    const claimIds=()=>packet.claims.map(c=>c.id);
    const previousRef=()=>checkpoint&&checkpointRef?{checkpoint,ref:checkpointRef}:undefined;
    const selfCheck=(p:AnalysisPacket,kinds:{noteKinds?:ReadonlySet<string>;deferredKinds?:ReadonlySet<string>}={})=>({root:paths.root,packet:p,verification:{reply:''},executions:analyst.executions,sources:sourceRefs,runId:run.id,conversationId:conversation,evidenceMode:'self-checked' as const,tasks:tasks.map(t=>t.id),previous:previousRef(),...kinds});
    const assess=async()=>{try{await validateNumericalEvidence(selfCheck(packet));return [] as ReviewTrigger[];}catch(error){return triggersFromError(error);}};
    let route=routeReview(await assess(),claimIds(),reviewPolicy,requireIndependent);
    // One repair turn for packaging faults; a second fault escalates to the full verifier.
    for(let repairs=0;route.outcome==='repair';repairs++){
     if(repairs>=1){route={outcome:'full',triggers:route.triggers,targetClaimIds:claimIds()};break;}
     const detail=route.triggers.map(t=>t.detail).join('; ');await log.append({type:'self_check_repair',detail});
     analyst=await stage('analyst','correct',{workOrder:order,analysisPacket:packet,tasks,correction:{role:'analyst',detail:`Self-check evidence was rejected before review: ${detail}. Fix the script output, rerun execute_analysis once, then hand off.`},remainingOperations:pending,checkedClaims:checkpoint?.claims??[],checkedHeld:checkpoint?.held??[]});
     if(await blocked(analyst.data,'analysis'))return finalize();
     packet=validatePacket(analyst.data);await saveCandidate();protectedRefs.push(...await refs([...packet.code,...packet.results]));
     route=routeReview(await assess(),claimIds(),reviewPolicy,requireIndependent);
    }
    await log.append({type:'self_check_assessment',outcome:route.outcome,targetClaimIds:route.targetClaimIds,triggers:route.triggers});
    if(route.outcome==='ask-user'&&await blocked({blockingInput:route.triggers.filter(t=>reviewPolicy.askUser.includes(t.kind)).map(t=>t.detail).join(' ')},'analysis'))return finalize();
    const noteKinds=new Set(reviewPolicy.note),deferredKinds=new Set(reviewPolicy.targeted);
    let sealed:{checkpoint:Checkpoint;ref:FileRef}|undefined;let completion:VerificationRecord|undefined;
    let verification:VerificationRecord|undefined;const evidenceMode:Assurance='independently-reviewed';let verificationExecutions=analyst.executions;
    if(route.outcome==='none'||route.outcome==='note'){
     if(route.outcome==='note')packet.coverage=[...new Set([...packet.coverage,...route.triggers.map(t=>t.detail)])];
     if(signal.aborted)throw new Error('cancelled');
     sealed=await sealCheckpoint(selfCheck(packet,{noteKinds}));
    }
    if(route.outcome==='targeted'){
     const targetIds=route.targetClaimIds,reasons=route.triggers.map(t=>t.detail);
     const targeted=await runTargetedReview({sealOptions:{root:paths.root,sources:sourceRefs,runId:run.id,conversationId:conversation,tasks:tasks.map(t=>t.id),previous:previousRef()},packet,analystExecutions:analyst.executions,targetClaimIds:targetIds,noteKinds,deferredKinds,runVerifier:(targetPacket,provisional)=>stage('verifier','numerical',{workOrder:order,tasks,analysisPacket:targetPacket,reviewMode:'targeted',targetClaimIds:targetIds,reviewReasons:reasons,previousCheckpoint:provisional.checkpoint,previousCheckpointRef:provisional.ref})});
     await log.append({type:'targeted_review',result:targeted.kind,targetClaimIds:targetIds,...(targeted.kind==='fallback'?{reason:targeted.reason}:{})});
     if(targeted.kind==='sealed'){sealed=targeted.final;completion=targeted.provisional.checkpoint.verification;}
     else{
      if(targeted.verifier&&await blocked(targeted.verifier.data,'verification'))return finalize();
      const data=targeted.verifier?.data as VerificationRecord|undefined;
      if(data?.correction){verification=data;verificationExecutions=targeted.verifier!.executions;}
      route={outcome:'full',triggers:route.triggers,targetClaimIds:claimIds()};
     }
    }
    if(!sealed){
     if(!verification){
      const verified=await stage('verifier','numerical',{workOrder:order,tasks,analysisPacket:packet,reviewReasons:route.triggers.map(t=>t.detail),previousCheckpoint:checkpoint,previousCheckpointRef:checkpointRef});verification=verified.data as VerificationRecord;verificationExecutions=verified.executions;
      if(await blocked(verification,'verification'))return finalize();
     }
     while(verification.correction){if(verification.correction.role!=='analyst')throw new Error('Numerical correction must target analyst');budget.debit('correction');analyst=await stage('analyst','correct',{workOrder:order,analysisPacket:packet,tasks,correction:verification.correction,remainingOperations:pending,checkedClaims:checkpoint?.claims??[],checkedHeld:checkpoint?.held??[]});if(await blocked(analyst.data,'analysis'))return finalize();packet=validatePacket(analyst.data);await saveCandidate();protectedRefs.push(...await refs([...packet.code,...packet.results]));const verified=await stage('verifier','numerical',{workOrder:order,tasks,analysisPacket:packet,previousCheckpoint:checkpoint,previousCheckpointRef:checkpointRef});verification=verified.data as VerificationRecord;verificationExecutions=verified.executions;if(await blocked(verification,'verification'))return finalize();}
     if(signal.aborted)throw new Error('cancelled');
     sealed=await sealCheckpoint({root:paths.root,packet,verification,executions:verificationExecutions,evidenceMode,tasks:tasks.map(t=>t.id),sources:sourceRefs,runId:run.id,conversationId:conversation,previous:previousRef()});
    }
    if(signal.aborted)throw new Error('cancelled');
    // Targeted reviews confirm values; task completion comes from the analyst's executed self-check.
    const nextPending=remainingWork(tasks.map(task=>task.id),completion??sealed.checkpoint.verification).map(id=>tasks.find(task=>task.id===id)!.description);
    checkpoint=sealed.checkpoint;checkpointRef=sealed.ref;scope=checkpoint.scope;packet.scope=checkpoint.scope;protectedRefs.push(sealed.ref,...checkpoint.files);
    run.checkpoint=checkpointRef;firstVerifiedAnswerAt??=new Date().toISOString();run.workflow=finalize().workflow;await this.options.onCheckpoint?.();
    let rich:ReturnType<typeof bindExploration>={issues:[]};if(this.options.explorationEnabled!==false&&order.visualize){try{rich=bindExploration(checkpoint,checkpointRef,true);}catch{rich={issues:['Optional views could not be assembled']};}}
    const notice=rich.issues.length?'Some optional charts or tables could not be shown because their checked fact bindings were unavailable.':undefined;
    await say(checkpoint.reply+assuranceNote(checkpoint),{runId:run.id,...(rich.result?{exploration:rich.result}:{}),...(notice?{explorationNotice:notice}:{})});
```

Note: the old code computed `nextPending` before sealing; it now runs after. `index.put(...)` (the next line in the file) is unchanged.

4. In `src/agent/workflow/role-prompts.ts`, replace `Print checks with emit_checks from harness_output.py.\`` with `Print checks with emit_checks from harness_output.py. When input.reviewMode is targeted, input.analysisPacket holds only the claims under review: recompute only those claims with their IDs.\``

- [x] **Step 5: Run tests**

Run: `npx vitest run tests/integration/review-routing.test.ts tests/integration/workflow-self-check.test.ts && npx tsc --noEmit && npx vitest run 2>&1 | tail -4`
Expected: all pass. `tests/integration/workflow-self-check.test.ts` still reads `harness.config.json`, which has no `review` block yet, so legacy routing applies and its expectations are unchanged. If another existing test fails, read its expectation: tests that assert old event fields (`assurance`/`reviewReasons` on `self_check_assessment`) should assert `outcome`/`triggers` instead. Report any other failure before changing it.

- [x] **Step 6: Commit**

```bash
git add src/agent/workflow/targeted-review.ts src/agent/workflow/orchestrator.ts src/agent/workflow/role-prompts.ts tests/unit/targeted-review.test.ts tests/integration/review-routing.test.ts
git commit -m "feat: route self-check findings to repair, user, note, targeted or full review"
```

---

### Task 13: Background verification with in-place message updates

When the route is `targeted` and `background` is true, the self-checked claims are delivered at once with a "verifying" state. The targeted check runs, and the same message is then updated to `mixed`, to a corrected answer, or to "could not be independently verified".

**Files:**
- Modify: `src/contracts.ts` (`ChatMessage`, `AssistantMessageOptions`)
- Modify: `src/agent/events.ts` (`updateLogical`)
- Modify: `src/agent/runs.ts` (`onMessage` returns id, `onUpdateMessage`)
- Modify: `src/agent/workflow/orchestrator.ts`
- Modify: `tests/fixtures/workflow-flow.ts`
- Test: `tests/unit/event-view.test.ts`, `tests/integration/background-verification.test.ts`

- [x] **Step 1: Message contract and EventView**

In `src/contracts.ts` replace:
```ts
export type ChatMessage={id:string;role:'user'|'assistant';text:string;complete:boolean;runId?:string;exploration?:ExplorationResult;explorationNotice?:string};
export type AssistantMessageOptions=Pick<ChatMessage,'runId'|'exploration'|'explorationNotice'>;
```
with
```ts
export type ChatMessage={id:string;role:'user'|'assistant';text:string;complete:boolean;runId?:string;exploration?:ExplorationResult;explorationNotice?:string;assurance?:'self-checked'|'verifying'|'independently-reviewed'|'mixed';pendingClaims?:string[];corrections?:string[]};
export type AssistantMessageOptions=Pick<ChatMessage,'runId'|'exploration'|'explorationNotice'|'assurance'|'pendingClaims'|'corrections'>;
```

Create `tests/unit/event-view.test.ts`:

```ts
import {expect,it} from 'vitest';
import {EventView} from '../../src/agent/events.js';
const handle:any={session:{sessionId:'s',subscribe:()=>()=>{},messages:[]},manager:{getBranch:()=>[]},bundle:{}};
it('updates an assistant message in place and drops stale verifying fields',()=>{
 const view=new EventView(handle,{runs:[],artifacts:[]});const events:any[]=[];view.subscribe(e=>events.push(e));
 const first=view.appendLogical('assistant','Revenue 10. Verifying: Margin.',{runId:'r',assurance:'verifying',pendingClaims:['Margin']});
 view.appendLogical('user','next');
 view.updateLogical(first.id,'Revenue 10. Margin 40%.',{runId:'r',assurance:'mixed'});
 const messages=view.snapshot().messages;
 expect(messages.map(m=>m.id)[0]).toBe(first.id);
 expect(messages[0]).toMatchObject({text:'Revenue 10. Margin 40%.',assurance:'mixed'});
 expect(messages[0].pendingClaims).toBeUndefined();
 expect(events.at(-1)).toMatchObject({type:'message',payload:{id:first.id,assurance:'mixed'}});
});
```

Run: `npx vitest run tests/unit/event-view.test.ts` → FAIL (`updateLogical` missing).

In `src/agent/events.ts`, replace ` invalidateExplorations(runId:string` (the method start, keep its leading space) with:

```ts
 updateLogical(id:string,text:string,options:AssistantMessageOptions={}){const index=this.state.messages.findIndex(m=>m.id===id);if(index<0)return this.appendLogical('assistant',text,options);const {exploration:_exploration,explorationNotice:_notice,pendingClaims:_pending,corrections:_corrections,assurance:_assurance,...base}=this.state.messages[index]!;const message:ChatMessage={...base,text,complete:true,...options};this.state.messages[index]=message;this.emit({type:'message',payload:message});return message;}
 invalidateExplorations(runId:string
```

Run: `npx vitest run tests/unit/event-view.test.ts` → 1 passed.

- [x] **Step 2: Run controller callbacks**

In `src/agent/runs.ts` replace
`onMessage:async(text,options)=>{view.appendLogical('assistant',text,options);await this.persistConversation();},`
with
`onMessage:async(text,options)=>{const message=view.appendLogical('assistant',text,options);await this.persistConversation();return message.id;},onUpdateMessage:async(id,text,options)=>{view.updateLogical(id,text,options);await this.persistConversation();},`

- [x] **Step 3: Extend the fixture**

In `tests/fixtures/workflow-flow.ts`:
1. Replace `const calls:string[]=[],messages:{id:string;text:string;options?:any}[]=[],` with `const calls:string[]=[],updates:{id:string;text:string;options?:any}[]=[],messages:{id:string;text:string;options?:any}[]=[],`
2. Replace `,profileSources:options.profileSources` with `,profileSources:options.profileSources,onUpdateMessage:(id,text,opts)=>{updates.push({id,text,options:opts});}`
3. Replace `return {root,paths,run,calls,messages,inputs,envelopes,config};` with `return {root,paths,run,calls,messages,updates,inputs,envelopes,config};`

- [x] **Step 4: Write the failing integration tests**

Create `tests/integration/background-verification.test.ts`:

```ts
import {expect,it} from 'vitest';
import {parseReviewPolicy} from '../../src/agent/workflow/review-policy.js';
import {createFlow,type FlowClaim} from '../fixtures/workflow-flow.js';
const policy=()=>parseReviewPolicy({note:['metadata'],repair:['packaging'],targeted:['calculation','coverage','eligibility'],full:['reconciliation','scope','unclassified'],askUser:['definition'],escalateToFullWhen:{claimsAffectedOver:10,shareOfClaimsOver:0.3},background:true});
const four=(margin=40):FlowClaim[]=>[{id:'revenue',label:'Revenue',value:10,unit:'GBP'},{id:'cost',label:'Cost',value:6,unit:'GBP'},{id:'profit',label:'Profit',value:4,unit:'GBP'},{id:'margin_pct',label:'Margin',value:margin,unit:'%'}];
const doubt=(facts:any,attempt:number)=>{if(attempt===1)facts.reviewReasons=[{kind:'calculation',question:'Margin basis?',claimIds:['margin_pct']}];};
it('shows self-checked claims first and upgrades the same message after targeted review',async()=>{
 const f=await createFlow({claims:four(),analystFacts:doubt,configure:c=>{c.reviewPolicy=policy();}});
 const result=await f.run();
 expect(result.outcome.kind).toBe('complete');
 expect(f.messages).toHaveLength(1);
 expect(f.messages[0].options).toMatchObject({assurance:'verifying',pendingClaims:['Margin']});
 expect(f.messages[0].text).toContain('Verifying independently: Margin');
 expect(f.updates).toHaveLength(1);expect(f.updates[0].id).toBe(f.messages[0].id);
 expect(f.updates[0].options.assurance).toBe('mixed');expect(f.updates[0].text).not.toContain('Verifying');
});
it('reports corrected values when targeted review falls back to a correction',async()=>{
 const f=await createFlow({claims:attempt=>four(attempt===1?40:38),analystFacts:doubt,configure:c=>{c.reviewPolicy=policy();},verifier:(_input,attempt)=>attempt===1?{data:{schemaVersion:1,correction:{role:'analyst',detail:'Recheck margin'}}}:undefined});
 await f.run();
 expect(f.updates[0].text).toContain('Corrected after independent review: Margin: 40 → 38 %');
 expect(f.updates[0].options.corrections).toEqual(['Margin: 40 → 38 %']);
 expect(f.updates[0].options.assurance).toBe('independently-reviewed');
});
it('keeps the self-checked answer and flags unverified claims when the verifier fails',async()=>{
 const f=await createFlow({claims:four(),analystFacts:doubt,configure:c=>{c.reviewPolicy=policy();},verifier:()=>{throw new Error('provider down');}});
 const result=await f.run();
 expect(result.outcome.kind).toBe('verified-partial');
 expect(f.updates[0]).toMatchObject({id:f.messages[0].id,options:{assurance:'self-checked'}});
 expect(f.updates[0].text).toContain('Could not be independently verified: Margin');
});
it('does not deliver early when the user asked for independent review',async()=>{
 const f=await createFlow({claims:four(),analystFacts:doubt,configure:c=>{c.reviewPolicy=policy();}});
 await f.run('Review revenue and independently verify it');
 expect(f.updates).toHaveLength(0);
 expect(f.messages[0].options.assurance).toBe('independently-reviewed');
});
```

Run: `npx vitest run tests/integration/background-verification.test.ts` → FAIL.

- [x] **Step 5: Implement background delivery in the orchestrator**

In `src/agent/workflow/orchestrator.ts`:

1. Constructor options: replace `onMessage:(text:string,options?:AssistantMessageOptions)=>unknown;` with `onMessage:(text:string,options?:AssistantMessageOptions)=>unknown;onUpdateMessage?:(id:string,text:string,options?:AssistantMessageOptions)=>unknown;`
2. Replace `import {runTargetedReview} from './targeted-review.js';` with `import {runTargetedReview,correctionNotes} from './targeted-review.js';`
3. Replace `const visible:string[]=[];let sourceProfiles:SourceProfile[]=[];` with `const visible:string[]=[];let sourceProfiles:SourceProfile[]=[];let early:{id:string;provisional:{checkpoint:Checkpoint;ref:FileRef};labels:string[]}|undefined;`
4. Make `say` return the message id. Replace `await this.options.onMessage(text,options);};` with `const id=await this.options.onMessage(text,options);return typeof id==='string'?id:undefined;};`
5. Snapshot claims before review. Replace `    const noteKinds=new Set(reviewPolicy.note),deferredKinds=new Set(reviewPolicy.targeted);` with
```ts
    const noteKinds=new Set(reviewPolicy.note),deferredKinds=new Set(reviewPolicy.targeted);const preliminaryClaims=structuredClone(packet.claims);
```
6. Add early delivery. Replace `previousCheckpoint:provisional.checkpoint,previousCheckpointRef:provisional.ref})});` with
```ts
previousCheckpoint:provisional.checkpoint,previousCheckpointRef:provisional.ref}),onProvisional:reviewPolicy.background&&this.options.onUpdateMessage?async(provisional,labels)=>{
      protectedRefs.push(provisional.ref,...provisional.checkpoint.files);run.checkpoint=provisional.ref;firstVerifiedAnswerAt??=new Date().toISOString();run.workflow=finalize().workflow;await this.options.onCheckpoint?.();
      const id=await say(provisional.checkpoint.reply+`\n\nVerifying independently: ${labels.join(', ')}. These values may change.`,{runId:run.id,assurance:'verifying',pendingClaims:labels});
      if(id)early={id,provisional,labels};this.options.onProgress('verification',`Independently checking ${labels.join(', ')}`);
     }:undefined});
```
7. Replace the delivery line at the end of the new block:
```ts
    await say(checkpoint.reply+assuranceNote(checkpoint),{runId:run.id,...(rich.result?{exploration:rich.result}:{}),...(notice?{explorationNotice:notice}:{})});
```
with
```ts
    const corrections=early?correctionNotes(preliminaryClaims,checkpoint.claims,checkpoint.held):[];
    const text=checkpoint.reply+assuranceNote(checkpoint)+(corrections.length?`\n\nCorrected after independent review: ${corrections.join('; ')}.`:'');
    const messageOptions:AssistantMessageOptions={runId:run.id,assurance:checkpoint.assurance??'independently-reviewed',...(corrections.length?{corrections}:{}),...(rich.result?{exploration:rich.result}:{}),...(notice?{explorationNotice:notice}:{})};
    if(early){await this.options.onUpdateMessage!(early.id,text,messageOptions);early=undefined;}else await say(text,messageOptions);
```
8. Keep the early answer when later work fails. Replace
`}catch(error){const reason=(error as Error).message;const applicable=checkpointRef&&scope?await loadCheckpoint(paths.root,checkpointRef,conversation,scope):null;`
with
```ts
}catch(error){const reason=(error as Error).message;
   if(early&&await loadCheckpoint(paths.root,early.provisional.ref,conversation,early.provisional.checkpoint.scope)){
    checkpoint=early.provisional.checkpoint;checkpointRef=early.provisional.ref;scope=checkpoint.scope;run.checkpoint=checkpointRef;
    await this.options.onUpdateMessage?.(early.id,checkpoint.reply+`\n\nCould not be independently verified: ${early.labels.join(', ')}. Treat these values as unconfirmed; the other figures are self-checked.`,{runId:run.id,assurance:'self-checked'});
    early=undefined;run.outcome={kind:'verified-partial',reason};return finalize();
   }
   const applicable=checkpointRef&&scope?await loadCheckpoint(paths.root,checkpointRef,conversation,scope):null;
```

Known limitation, accepted for this round: if the fallback verifier returns `blockingInput` after an early delivery, the early message keeps its "verifying" note while the question is asked.

- [x] **Step 6: Run tests**

Run: `npx vitest run tests/integration/background-verification.test.ts tests/integration/review-routing.test.ts tests/unit/event-view.test.ts && npx tsc --noEmit && npx vitest run 2>&1 | tail -4`
Expected: all pass.

- [x] **Step 7: Commit**

```bash
git add src/contracts.ts src/agent/events.ts src/agent/runs.ts src/agent/workflow/orchestrator.ts tests/fixtures/workflow-flow.ts tests/unit/event-view.test.ts tests/integration/background-verification.test.ts
git commit -m "feat: deliver self-checked answers early and update them after targeted review"
```

---

### Task 14: Assurance badge in the current UI

A minimal badge so the states are visible before the assistant-ui rebuild. Messages already update by id through the existing reducer.

**Files:**
- Create: `src/ui/AssuranceBadge.tsx`
- Modify: `src/ui/Chat.tsx`, `src/ui/styles.css`
- Test: `tests/unit/assurance-badge.test.ts`, `tests/unit/browser-state.test.ts`

- [x] **Step 1: Write the failing tests**

Create `tests/unit/assurance-badge.test.ts`:

```ts
import {expect,it} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {AssuranceBadge} from '../../src/ui/AssuranceBadge.js';
it('labels each assurance state and renders nothing without one',()=>{
 expect(renderToStaticMarkup(createElement(AssuranceBadge,{assurance:'verifying'}))).toContain('Verifying…');
 expect(renderToStaticMarkup(createElement(AssuranceBadge,{assurance:'mixed'}))).toContain('Partly independently verified');
 expect(renderToStaticMarkup(createElement(AssuranceBadge,{assurance:'independently-reviewed'}))).toContain('Independently verified');
 expect(renderToStaticMarkup(createElement(AssuranceBadge,{assurance:'self-checked'}))).toContain('Self-checked');
 expect(renderToStaticMarkup(createElement(AssuranceBadge,{}))).toBe('');
});
```

Append to `tests/unit/browser-state.test.ts` (add `import {reduceEvent} from '../../src/ui/state.js';` if not already imported):

```ts
it('replaces an updated message in place by id', () => {
  const base: any = { serverInstanceId: 'i', sessionId: 's', sequence: 1, busy: true, activeRun: null, runs: [], artifacts: [], messages: [{ id: 'm', role: 'assistant', text: 'Verifying', complete: true, assurance: 'verifying' }, { id: 'u', role: 'user', text: 'next', complete: true }] };
  const next = reduceEvent(base, { serverInstanceId: 'i', sessionId: 's', sequence: 2, runId: null, type: 'message', payload: { id: 'm', role: 'assistant', text: 'Done', complete: true, assurance: 'mixed' } } as any);
  expect(next.messages.map((m) => m.id)).toEqual(['m', 'u']);
  expect(next.messages[0]).toMatchObject({ text: 'Done', assurance: 'mixed' });
});
```

Run: `npx vitest run tests/unit/assurance-badge.test.ts tests/unit/browser-state.test.ts`
Expected: badge test FAILs (module missing); the reducer test passes already, which confirms no reducer change is needed.

- [x] **Step 2: Implement**

Create `src/ui/AssuranceBadge.tsx`:

```tsx
import type {ChatMessage} from '../contracts.js';
const labels:Record<NonNullable<ChatMessage['assurance']>,string>={'self-checked':'Self-checked','verifying':'Verifying…','independently-reviewed':'Independently verified','mixed':'Partly independently verified'};
export function AssuranceBadge({assurance}:{assurance?:ChatMessage['assurance']}){return assurance?<span className={`assurance ${assurance}`} role="status">{labels[assurance]}</span>:null;}
```

In `src/ui/Chat.tsx`:
1. After `import {Exploration} from './exploration/Exploration.js';` add `import {AssuranceBadge} from './AssuranceBadge.js';`
2. Replace `<span className="message-role">{message.role==='user'?'You':'Pricing assistant'}</span>` with `<span className="message-role">{message.role==='user'?'You':'Pricing assistant'}</span><AssuranceBadge assurance={message.assurance}/>`

Append to `src/ui/styles.css`:

```css
.assurance{display:inline-block;margin-left:8px;padding:1px 8px;border-radius:999px;font-size:12px;line-height:18px;background:#eef1f5;color:#3b4a5e}.assurance.verifying{background:#fff4dc;color:#7a5200}.assurance.independently-reviewed{background:#e3f4ec;color:#1d6b47}.assurance.mixed{background:#e8f0fb;color:#24508f}
```

- [x] **Step 3: Verify and commit**

Run: `npx vitest run tests/unit/assurance-badge.test.ts && npx tsc --noEmit && npx vitest run 2>&1 | tail -4 && npm run build 2>&1 | tail -3`
Expected: all pass; build succeeds.

```bash
git add src/ui/AssuranceBadge.tsx src/ui/Chat.tsx src/ui/styles.css tests/unit/assurance-badge.test.ts tests/unit/browser-state.test.ts
git commit -m "feat: show answer assurance state in chat"
```

---

### Task 15: Switch on, document, verify

**Files:**
- Modify: `harness.config.json`, `tests/integration/workflow-self-check.test.ts`, `bundled/versions.json`, `docs/local-setup.md`
- Create: `docs/releases/latency-verification-local-validation-<date>.md`

- [x] **Step 1: Enable the recommended policy**

In `harness.config.json`, add inside `"workflow"` after the `"policy"` object (add a comma after the policy's closing brace):

```json
    "review": {
      "note": ["metadata"],
      "repair": ["packaging"],
      "targeted": ["calculation", "coverage", "eligibility", "join-integrity", "parsing", "period-coverage", "source-coverage"],
      "full": ["reconciliation", "scope", "unclassified"],
      "askUser": ["definition"],
      "escalateToFullWhen": {"claimsAffectedOver": 10, "shareOfClaimsOver": 0.3},
      "background": true
    }
```

- [x] **Step 2: Pin legacy routing where tests document it**

Run: `npx vitest run 2>&1 | tail -15`
Expected: `tests/integration/workflow-self-check.test.ts` fails for `missing` (it now gets a repair turn because tests read `harness.config.json`). That file documents the legacy routing. In its `setup` function, after the `const config = loadConfig({...});` statement, add:

```ts
  config.reviewPolicy = legacyReviewPolicy;
```

and add `import { legacyReviewPolicy } from "../../src/agent/workflow/review-policy.js";` to its imports. Re-run the full suite. If any other test fails, check whether it exercises self-check routing. If so, pin it the same way and list it in the release note; otherwise stop and report the failure.

- [x] **Step 3: Versions and setup docs**

In `bundled/versions.json` change `"workflowVersion":"2.1.1"` to `"workflowVersion":"2.2.0"`. Leave `dataToolVersion` unchanged: the prepared DuckDB cache format did not change, so cache keys must not change.

Append to `docs/local-setup.md`:

```markdown
## Review routing (`workflow.review`)

After the analyst's executed self-check, the harness routes any finding by kind. Kinds: the six diagnostics (`source-coverage`, `parsing`, `join-integrity`, `period-coverage`, `reconciliation`, `eligibility`), analyst reason kinds (`metadata`, `definition`, `calculation`, `coverage`), `packaging` (malformed or incomplete self-check output), `scope` (wrong scope) and `unclassified`.

| Key | Effect |
|---|---|
| `note` | Accept; add the reason to coverage. No review. |
| `repair` | One correction turn for the analyst; a repeat fault runs the full verifier. |
| `targeted` | Independently check only the named claims; others stay self-checked (`mixed`). Without named claims, or above `escalateToFullWhen` (`claimsAffectedOver` claims or `shareOfClaimsOver` share), the full verifier runs. |
| `full` | Full independent verifier (also for unlisted kinds and explicit user requests). |
| `askUser` | Ask the user the reason's question and stop. |
| `background` | For targeted review, show self-checked claims immediately marked "Verifying…", then update the same message. |

Each kind may appear in one list. Omitting `workflow.review` keeps the previous behaviour: every finding runs the full verifier before delivery. Use `node scripts/latency-report.mjs <workspace>/analyses/<run-id>` to compare first-token (provider) time with generation time per role.
```

- [x] **Step 4: Full verification**

Run each and record the outputs:

```bash
npx tsc --noEmit
```
```bash
npx vitest run 2>&1 | tail -4
```
```bash
.venv/bin/python -m pytest tests/python -q 2>&1 | tail -2
```
```bash
npm run build 2>&1 | tail -3
```
```bash
npm run test:browser 2>&1 | tail -6
```

Expected: clean typecheck; all Vitest tests pass; 18 Python tests pass; build succeeds; the Playwright browser specs pass. If a browser spec fails on chat markup (badge text), update its selector or text expectation and note it.

- [x] **Step 5: Release note**

Create `docs/releases/latency-verification-local-validation-<YYYY-MM-DD>.md` (use today's date) with these sections, filled from the actual command outputs in Step 4:
1. **Delivered behaviour.** One bullet per Task 1–14 outcome.
2. **Checks run.** Each command from Step 4 with its exact pass/fail counts.
3. **Configuration.** The `workflow.review` block and the workflow version 2.2.0.
4. **Pinned tests.** Every test pinned to `legacyReviewPolicy` in Step 2, and why.
5. **Not verified.** No live model run unless Step 6 happened; latency gains are unmeasured until then; the background-limitation note from Task 13.

- [x] **Step 6 (optional, paid — ask first): Live check**

Ask the user: "May I run one live analysis (about USD 0.05–0.15 on OpenRouter, roughly 3–7 minutes) to measure the change?" Only if they say yes:
1. Start the app the way `docs/local-setup.md` describes (`scripts/start-macos.sh`).
2. In a fresh workspace with the Lighting & Candles evaluation data and context from `docs/sample-data-1-readiness-2026-10-07.md`, ask: "Review how Lighting & Candles performed over the last five complete quarters."
3. Run `node scripts/latency-report.mjs <workspace>/analyses/<run-id>` and add the table, the time to the first visible answer (`run.json` → `workflow.firstVerifiedAnswerAt` minus `startedAt`), total time, model requests and route outcome (from `events.jsonl` `self_check_assessment`) to the release note. Compare with the 437 s / 49-request baseline in `docs/releases/self-check-workflow-evaluation-2026-10-09.md`. Report it as one stochastic observation, not a benchmark.

- [x] **Step 7: Commit**

```bash
git add harness.config.json tests/integration/workflow-self-check.test.ts bundled/versions.json docs/local-setup.md docs/releases/latency-verification-local-validation-*.md
git commit -m "chore: enable review routing and document workflow 2.2.0"
```

---

## Self-review record

- **Spec coverage.** Timing/tokens per second (Task 4); data profile that works for any dataset (5–8: no column-name assumptions, facts only, lossless typed views, cached by content hash); output helper (9–10); configurable verifier routing (11–12); background verification (13–14); event log fix (1); reduced rehashing (2–3). Provider routing, per-role reasoning, a quick path and parallel verification are excluded as agreed.
- **Behaviour without config.** `legacyReviewPolicy` reproduces the old routing; existing integration tests keep their expectations until Task 15 switches the policy on.
- **Type consistency.** `ReviewTrigger{kind,detail,claimIds?}`, `RouteDecision{outcome,triggers,targetClaimIds}`, `noteKinds`/`deferredKinds` (`ReadonlySet<string>`), `Sealed{checkpoint,ref}`, `onUpdateMessage(id,text,options)` and `AssistantMessageOptions.assurance` are used with the same names in every task.
