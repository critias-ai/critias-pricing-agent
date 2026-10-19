# Minimal path handoff repair — 9 October 2026

Implemented workflow **1.0.12** in the existing modules. The analyst gets explicit file-reference semantics, a controller-generated file inventory and a read-only packaging validator that remains available after calculation revisions end. Public failures no longer echo internal path/validation dumps. No additional agent layer or analytical query library was added.

## Changes

- `output-contract.ts` describes `code` and `results` entries as exact existing workspace/stage-relative paths, without captions. Claim evidence must reference files listed in `results`. Numerical types and independent verification requirements are unchanged.
- `handoff.ts` builds a stage-file inventory, excludes sessions/provenance metadata and symlinks, and lists only unchanged successfully executed scripts under `code`. The inventory is guidance, not numerical approval or automatic evidence attachment. File safety/execution checks remain authoritative.
- Semantic errors identify fields such as `/results/0` and `/claims/0/evidence`. Feedback shows at most four field errors plus a remaining count, rather than repeating every claim error. The analyst repair includes valid filenames and instructions to preserve valid IDs, values and calculations; it does not invite further file edits or reruns.
- `worker.ts` registers `validate_handoff` for analysts. When revisions run out, only that tool remains active. It checks the same semantic validator as final submission, reads existing evidence and returns validity/errors; it does not edit files, execute analysis or seal a checkpoint. Calls still consume the shared model/tool budget and deadline. Final JSON still passes the controller's normal validation and one bounded final-format repair.
- The analyst prompt adds four words to request preflight validation. A complete fictional package example and brief field guidance live in the existing data helper guide.
- `orchestrator.ts` sends short failure/partial messages while retaining detailed diagnostic reasons. A genuine blocking question is sent explicitly before preserving an existing checked partial result. `runs.ts` also uses a short public error alert, closing the separate recent-analyses UI route for the same internal dump.

Saved app model, Luna/high evaluation override and all budgets are unchanged: **1,200 seconds / 360-second reserve, 100 models / 150 tools for analysis/report; two revisions, four shared final-format repairs with one per stage, and one numerical correction**. No commit, push or deployment occurred.

## Verification

The new schema/repair and public-error regressions failed before implementation. Final checks passed:

- **71 focused TypeScript checks in 11 files**, including handoff/checkpoint guards, revisions, limits, controller cancellation/recovery, short role prompts and public errors;
- **one focused browser test**, covering checked partial results, reload/reconnect, follow-up, narrow layout and safe failure messages in chat/recent analyses;
- typecheck and updated app build;
- configured evaluation dry run, confirming unchanged model and budgets with no paid calls.

The browser fixture needed permission to open its local IPC/server socket after sandbox `EPERM`; it uses synthetic fixtures and calls no external model. No full suite was run.

The actual saved failed producer packages were replayed **unchanged** through the updated validator. Both are correctly rejected, with bounded field feedback. A single deterministic repair changes only the original package's `results` array to exact filenames from the controller inventory. All **54 claim IDs/values survive**, and read-only preflight reports valid. Source files, saved sessions/packages, executed script and outputs retain their hashes.

Repair feedback shrank from **5,168 to 1,354 characters**, including the actual file inventory. This replay does not synthesize a new set of numerical claims or substitute another analysis. It also does not demonstrate that a live model will follow the repair instructions: its callback applies the known path correction deterministically, and final independent numerical approval remains separate.

Replay: `.scratch/handoff-audit/repair-replay.mjs`. Final evidence: `.cache/path-handoff-repair-2026-10-09/2026-10-09T05-15-27.780Z/`, including the untouched-package rejection feedback, corrected candidate and hash/claim preservation result. Audit: `handoff-subagent-audit-2026-10-09.md`.

No paid live evaluation was run in this implementation phase. Fresh model compliance and complete live verification/chart delivery remain unproven.
