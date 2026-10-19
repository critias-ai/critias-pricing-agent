# Handoff audit — 9 October 2026

The repeated failures come from an incompletely specified boundary between the model's response and the controller's file handling. The latest analyst calculated correct values but produced a JSON package that satisfied its supplied schema and failed additional file-reference requirements. Repair feedback then encouraged an ineffective rewrite. More time does not fix this boundary.

The user requested a subagent audit. A **gpt-6-luna / maximum-reasoning** subagent inspected the actual source, saved stage prompts, failed packages and prior replay/tests. The parent independently reproduced the current failure against the real validator. This audit changes no application code, settings or model and makes no live product API calls.

## Transfer process

1. The coordinator returns a work order. The controller supplies the analyst with scope, context, sources, tasks, an `outputSchema`, deadlines and shared limits in a JSON prompt.
2. The analyst writes/runs a script. `execute_analysis` records the script/output hashes and independent source-access provenance. Successful execution does not itself register every final calculation file as a selectable output.
3. After the initial success and two revisions, the controller disables analyst tools and requests final JSON. The analyst must populate numerical claims and `code`, `results` and claim `evidence` arrays.
4. The controller parses JSON, checks the schema, then resolves paths, checks readable results, intersects claim evidence with the accepted result inventory, and requires unchanged successfully executed code.
5. Failure produces one same-session format-repair prompt. If that fails, the stage stops. If accepted, the controller canonicalizes metadata and sends the packet to an independent verifier; that verifier must execute source-backed comparisons before a checkpoint can be sealed.

The latest run stopped at step 5. Its verifier never started. The saved SQL repair and twenty-minute budget therefore did not get an opportunity to solve the prior final-verifier timeout.

## Findings

### 1. The supplied schema does not explain the path contract

`src/agent/workflow/output-contract.ts:4` defines a generic nonempty string. At lines 13–15, analyst `code`, `results` and claim `evidence` reuse it without path descriptions. Both actual failed packages pass `assertOutput`.

The schema is supplied as text in the stage prompt (`orchestrator.ts:33`, `worker.ts:74`); this stage path does not configure provider-enforced structured output. Merely including `outputSchema` in a prompt does not enforce file semantics or guarantee a conforming answer.

`src/agent/workflow/handoff.ts:29–44` requires more: existing safe file paths, readable result files, claim evidence resolving into the result set, and unchanged recorded script execution. These are useful requirements, but they are not sufficiently described at the producing boundary. The existing claim example in `bundled/harness-tools/data-analysis.md:17` shows a filename but does not give a complete package example or explicitly state the cross-field relationship.

The first package used:

```json
{"results":["quarterly_performance.csv: full quarterly table…","analysis_results.json: calculation diagnostics…"]}
```

Those strings are descriptions of files, not filenames. Claim evidence still included the real CSV name. A local probe changed **only** `results` to the two existing filenames; the real validator accepted **all 54 claims with unchanged values**, retaining execution/path guards. This isolates the latest failure to transport references, not a lost calculation or missing source context.

### 2. Repair feedback does not identify the required correction

`handoff.ts:17` asks the model to “Correct the rejected handoff using the supplied outputSchema” and says it may “repair files or checks if needed.” It provides no explicit path-only instruction, corrected field example or current valid file inventory.

The actual repair message was **5,168 characters**, including **54 repeated claim errors** inside a 4,908-character reason. Its leading explanation was “No claims with readable result evidence”. The repair then replaced filenames with paragraphs beginning “Readable result: …”, and put table summaries into `results`. That behavior is consistent with ambiguous feedback; the audit cannot establish the model's internal reasoning. The schema still accepted these strings, while file resolution produced `ENAMETOOLONG`.

### 3. Repair instructions and available capabilities disagree

`src/agent/workflow/worker.ts:42` disables all tools after the revision allowance. Line 60 also rejects any later tool call. The subsequent repair invitation to repair files/checks cannot be acted on in that state. No packaging-validation tool remains, and no file inventory is supplied when tools are removed.

The two-revision cap need not change. Calculation edits/reruns should remain bounded separately from a packaging-only repair. If tools stay disabled, that repair must receive everything it needs, including the exact valid paths. If a preflight tool is added, it should validate packaging without granting another calculation revision.

### 4. Local tests covered clean packages, not the recurring producer mistake

`tests/unit/workflow-handoff.test.ts` tests malformed JSON, numerical types, missing files, safe paths, path normalization and repair limits. Its successful repair callbacks insert an already-correct package.

`.scratch/fact-handoff/replay.mjs:22–28` synthesizes numerical claims and correct filename arrays before calling validation. It verifies compatibility and safety for a reconstructed package; it does not reproduce the model's original handoff or response to the actual repair feedback. That limitation explains why local replay success did not predict live handoff success.

The broader history contains several different defects: scope/execution metadata, prose-versus-scalar verification, repair accounting, generated SQL and file-reference packaging. Fixes to one did not establish correctness across the whole transfer. The latest file-reference issue was left unresolved by normalizing relative path prefixes.

The subagent checked earlier saved sessions as well. In the **21:26** trial, analyst path rejection was followed by a verifier check-output schema rejection; its analysis events record these at lines 113 and 177. In the **21:45** trial, the initial analyst put “Successful execution …; results in …” into a result reference (events line 193), then corrected packaging progressed to the final verifier deadline. The recurring pattern is a late packaging gate after useful work, although each run's final stop differs.

### 5. Internal validation detail becomes the public answer

`src/agent/workflow/orchestrator.ts:100–102` inserts the raw exception into the user-visible response. The latest rejection became a **990-word error dump** containing absolute paths and unapproved values. Detailed reasons belong in diagnostic evidence; the public response needs a short failure category and retained-work status.

## Recommended minimal repair

Keep numerical verification, source immutability, safe-path checks and bounded revisions. Tighten the interface and feedback:

1. **Describe the actual contract once.** Use a shared path-reference schema with brief descriptions for `code`, `results` and `evidence`: existing file paths only; no captions; claim result evidence must refer to a listed result. Add one complete fictional package example to the existing helper guide. Keep methods in skills and role prompts short.
2. **Expose controller-known artifacts.** At the handoff transition, provide a small safe file inventory plus the recorded successful script/output references. The agent selects existing paths rather than reconstructing an inventory from memory. If references become opaque registered IDs later, resolve them in the controller; do not guess arbitrary prose into filenames.
3. **Repair only the rejected fields.** Return compact structured feedback naming the field, expected meaning, a few offending entries and exact valid candidates. Preserve claim IDs/values and executed calculations. For this actual first package, only the two `results` entries require change. Keep one bounded packaging repair; increasing retries is not the first fix.
4. **Make packaging preflight possible.** Either supply the inventory and complete correction directly, or retain a validation-only submission tool after calculation tools are disabled. Neither option permits extra analytical revisions or bypasses independent verification.
5. **Separate diagnostics from public failure messages.** Preserve full rejection evidence privately and return a concise user-facing reason.

Do not make arbitrary text acceptable evidence or automatically attach unrelated files to claims. A path is a reference to a concrete artifact; financial correctness is still checked independently afterward.

## Focused acceptance before another paid test

- Replay both original failed packages unchanged: demonstrate schema-versus-semantic behavior and identify the precise invalid fields.
- Apply the targeted first-package repair: all 54 values survive and the existing execution/hash/path checks still pass.
- Verify that repair feedback contains the real safe file inventory, path-only instructions and bounded field errors, and remains usable after the revision cap.
- Continue rejecting traversal, nonexistent files, stale scripts, changed sources, unsupported approvals and numerical disagreements. Never infer a file from ambiguous prose.
- Check that failures expose no internal path/error dump to the public conversation.
- Treat a local callback that substitutes a perfect package as a deterministic regression, not proof that a live model will follow the prompt. One fresh bounded live test is needed after implementation to establish producer behavior.

Evidence: `.scratch/handoff-audit/{probe.mjs,probe.json}` and `.cache/configured-agent-evaluations/2026-10-08T22-23-28.775Z-f74d94df/evaluator/failed-packages.json`. The trial's independent numerical review passed 352 comparisons; there was no live checkpoint/chart. No implementation or additional live test was performed for this audit.
