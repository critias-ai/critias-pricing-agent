# Fresh-session implementation prompt

Copy the text below into a fresh session opened in the repository root.

```text
Implement the approved minimal analyst handoff plan in:
the repository root

Read, in order:
1. PROJECT_GUIDE.md and applicable AGENTS.md instructions.
2. pricing-harness/docs/superpowers/specs/2026-10-09-minimal-analyst-handoff-design.md
3. pricing-harness/docs/superpowers/plans/2026-10-09-minimal-analyst-handoff.md
4. pricing-harness/docs/releases/presentation-path-live-evaluation-2026-10-09.md

This prompt authorizes implementation of the minimal plan inline in this fresh session. Follow superpowers:executing-plans and work ticket-by-ticket, using the plan's acceptance criteria. The approved choice is to remove analyst preflight and retain final JSON plus the existing bounded repair path. Do not reopen the broader submit_result design or add infrastructure.

Preserve all existing dirty changes, historical/live evidence, fixture sources and model settings. Record a baseline before editing. Work in the current checkout; do not reset, clean or overwrite unrelated work.

Scope:
- Remove the analyst validate_handoff tool and every active instruction requiring it.
- After analyst calculation revisions are exhausted, expose zero executable tools and steer to the actual final JSON using the existing schema and canonical file inventory. Block stale/batched tool attempts after that transition.
- Retain finishHandoff, existing path canonicalization, controller metadata, source/execution guards, parent worker-result/stop/check/save sequence, independent verification, checkpoints and verified-partial delivery.
- Keep role prompts short (existing <=80-word checks). Keep detailed methods in bundled guidance.
- Prove the handoff transition through deterministic tests using the real installed SDK or the plan's narrow production-used seam. Fake Runner results alone do not prove tool availability or transition behavior. Test the bounded final repair and unchanged revision accounting. Retain existing cancellation, evidence and partial-delivery regressions.

No submit_result tool, new IPC/ack protocol, generic workflow engine, state-machine layer, schema redesign, placeholder blacklist, restart/exactly-once guarantee, early evidence remapping, dependency upgrade or unrelated rendering fix. Do not change completion semantics for other roles.

Preserve saved deepseek/deepseek-v4.1-flash/high and configured openai/gpt-6-luna/high evaluation override. Preserve 1,200s total/360s finalisation reserve, 100 model/150 tool calls, two analyst revisions, four shared final-format repairs with max one/stage, one correction, and 30-minute/USD1 batch limits. Do not add retries, automatic recovery or fallback.

Run only focused tests from the plan, typecheck and a build to refresh changed compiled code as needed. From pricing-harness/, run npm run eval:configured -- --dry-run and confirm exactly one selected message:
“Review how Lighting & Candles performed over the last five complete quarters.”

Do not run a paid evaluation, submit another prompt to OpenRouter, run the full suite, commit, push or deploy. The previous paid-test authorization was consumed. A paid live evaluation requires a separate new explicit user request after implementation.

Save unique local verification evidence and a dated implementation report; update PROJECT_GUIDE.md concisely (<2,000 words). Distinguish deterministic lifecycle checks from unproven fresh-model behavior. If a check fails, diagnose it within this minimal scope; do not compensate by relaxing verification or increasing limits. Report any expansion that would be required instead of introducing it silently.

Finish with a brief summary of changes, focused verification results, preserved configuration and remaining live-evaluation uncertainty. Stop after local verification and the dry run.
```
