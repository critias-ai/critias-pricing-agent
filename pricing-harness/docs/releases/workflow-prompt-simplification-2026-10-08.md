# Lighter workflow prompts — 8 October 2026

Reduced the workflow's shared and role-specific instructions from 644 to 274 words (57%). The model chooses its investigation sequence and uses the existing pricing/visualization skills for detailed methods. The coordinator now requests outcomes needed to answer the user, leaving analytical methods to the analyst rather than prescribing an audit checklist.

| Instruction | Before | After |
|---|---:|---:|
| Shared | 168 words | 60 words |
| Coordinator | 104 | 55 |
| Analyst | 130 | 65 |
| Verifier | 132 | 56 |
| Visualizer | 110 | 38 |

The analyst receives 125 shared-plus-role words, down from 298. Its revised role instruction is:

> Use the relevant pricing skills and supplied data helper. Generate or adapt the code needed for the work order and run it with execute_analysis. Return useful claims with result-file evidence in an AnalysisPacket; values are numbers, strings, null or string arrays, with tables in result files. Account for completed and pending operations. Choose your own investigation sequence and keep the work proportional to the question.

Detailed financial guidance already exists in the pinned pricing skills and data-helper documentation; it was removed from the role prompts without adding another skill or query library. Integration details remain short: execution tool, result contract, independent verification and presentation tools. Claim value types are explicit because prior tests exposed malformed nested claims.

No fixed script length, mandatory inspection sequence, extra fallback or retry was added. The existing source/context handoff, stage isolation, checkpoint verification, scope continuity and cumulative budgets remain intact. The 24-file inventory and SDK skill catalogue are still supplied; this change reduces task instructions, not the entire request payload. The saved model/reasoning and 100-call caps are unchanged.

Thirty focused tests in five files passed, covering work-order scope and routing, packet/checkpoint evidence, budget accounting, staged delivery, continuation and cancellation. Typechecking and the updated app build passed. The compiled prompts match their source, and bundle validation confirms the same eight skills. Workflow version is 1.0.3.

No new paid evaluation, full suite, commit, push or deployment was run. Actual work-order simplicity, script length, result correctness, latency and cost need a subsequent live evaluation; local checks do not establish a performance improvement.

- [Current prompts](../../src/agent/workflow/role-prompts.ts)
- [Before/after counts](../../../.cache/prompt-simplification-2026-10-08/prompt-counts.json)
- [Checks and compiled prompt hashes](../../../.cache/prompt-simplification-2026-10-08/checks.json)
