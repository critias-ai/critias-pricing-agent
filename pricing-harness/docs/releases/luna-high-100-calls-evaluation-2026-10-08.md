# Luna/high, fresh workspace, 100 calls — 8 October 2026

The single high-reasoning rerun delivered no verified answer or chart. It stopped at the verification/finalization time reserve after 242.846 seconds, using only 10 of 100 calls. The analyst wrote and edited a calculation script but never executed it.

## Controlled setup

Exactly one prompt was submitted through OpenRouter `openai/gpt-6-luna`, reasoning `high`:

> Review how Lighting & Candles performed over the last five complete quarters.

A new workspace and conversation were created at `/private/tmp/pricing-focused-2026-10-08T15-11-21.677Z-862724a2/lighting`. Only the same raw fixture files and confirmed context were loaded; no historical analysis code or evaluator references were seeded. All workflow classes retained the saved 100-call cap. Analysis retained its 300-second/60-tool budget and 20% finalization reserve; retry, correction and rendering allowances were unchanged. The batch admission limits remained 30 minutes/USD1, with no recovery messages.

The compiled application, bundle, role instructions, source hashes and time/tool limits match the preceding medium-reasoning run. Only the run's reasoning level changed. Saved DeepSeek/high model settings remain unchanged; this test explicitly overrides the model to Luna/high.

## Medium versus high

| Measure | Medium, 100 calls | High, 100 calls |
|---|---:|---:|
| Prompt latency | 204.021s | 242.846s |
| Estimated SDK cost | $0.016941485 | $0.018143180 |
| Model / tool calls | 20 / 26 | 10 / 15 |
| Planning time | 9.411s | 31.243s |
| Analysis time | 193.441s | 210.171s |
| Public response length | 19 words | 17 words |
| Verified answers / charts | 0 / 0 | 0 / 0 |
| Stopping condition | Invalid claim values | Verification/finalization reserve |

The full high-reasoning batch took 244.778 seconds. At stop, 90 calls, 45 tools and 57.426 seconds remained; that time was reserved for finalization. No retry, correction, render or preview was used. Verification and visualization never started. High was 19.0% slower and 7.1% more expensive in this single trial. Neither result satisfied the request; this is not a reliable causal estimate of reasoning-level performance. Conversation continuity remains unassessed because only the initial message was submitted.

Complete public response:

> I could not independently verify an answer within this request: verification/finalization reserve. Retained analysis files are drafts.

## Independent review and failures

- The retained script uses `TRIM(p.category) = 'Lighting & Candles'`. Independent source inspection finds zero matching master rows; the actual code is `LIGHTING_AND_CANDLES` (478 source master records). That filter would omit the entire requested category. The independent requested population contains 41,684 observations and £931,065.10 revenue.
- The script parses as Python, but no calculation execution, numerical output or analysis packet was produced. No arithmetic pass is claimed. Independent controls were regenerated outside the product workspace; the draft was not repaired or executed on the model's behalf.
- One tool read failed because the analyst looked for `pricing-plugin/knowledge/metric-verification.md`; the bundled file is under `pricing-plugin/skills/knowledge/`. Most work involved reading context/helpers and writing/editing the script before the reserve stop.
- No rendered chart exists to inspect. Result-format compatibility also remains unassessed for this run because the analyst never returned a packet.

## Verification and evidence

Sixteen focused checks across three files passed. All 36 integrity checks passed, including fresh conversation/workspace, unchanged compiled files, actual high reasoning, exact prompt, source hashes, evaluator exclusion and reconciliation of all ten usage records. No application code changed, so the existing compiled app was reused. No full suite, additional live prompt, commit, push or deployment was run.

- [Complete response and run evidence](../../../.cache/luna-high-100-calls-2026-10-08/2026-10-08T15-11-21.677Z-862724a2/responses.md)
- [Independent draft review](../../../.cache/luna-high-100-calls-2026-10-08/2026-10-08T15-11-21.677Z-862724a2/evaluator/draft-review.json)
- [Integrity checks](../../../.cache/luna-high-100-calls-2026-10-08/2026-10-08T15-11-21.677Z-862724a2/evaluator/integrity.json)
- [Previous medium-reasoning report](luna-medium-100-calls-evaluation-2026-10-08.md)
