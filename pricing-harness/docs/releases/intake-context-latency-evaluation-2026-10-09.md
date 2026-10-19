# Intake context latency evaluation — 9 October 2026

Expanded intake reduced planning substantially in one live trial, but did not solve overall latency or pass financial correctness review. Same original question, DeepSeek V4.1 Flash, high reasoning for every role, unchanged budgets, source inventory, role prompts and bundle fingerprint.

## Context created

Portable manifest: `sample_data_1/user_pack/.context.md`. Test workspace: `/private/tmp/pricing-intake-latency-sXp4kp/`, with identical copies at `.context.md` and `.pricing/context.md`. The harness reads the latter and supplies its contents to every role; root `.context.md` alone is not an auto-discovered input.

The earlier manual workspace already contained `.pricing/context.md` with confirmed evaluator-owned accounting definitions. This experiment therefore compares **expanded intake/schema context against existing basic context**, not presence against absence. The original definitions were retained verbatim. Added observed category vocabulary, the Lighting category token, core source schemas, declared grains, source inventory and unavailable catalog location. All 15 catalog source hashes and headers matched the files before creation. No business result, expected answer, prior generated analysis code or evaluator control was included. All facts remain scoped to the fictional fixture, not real-company confirmation.

## Live comparison

Question: “Review how Lighting & Candles performed over the last five complete quarters.”

| Measure | Existing context baseline | Expanded context |
| --- | ---: | ---: |
| Run elapsed | 383.547s | 339.977s |
| Planner | 101.734s | 15.221s |
| Analyst | 196.901s | 187.722s |
| Verifier | 82.026s | 134.414s |
| Model requests | 50 | 41 |
| Tool calls | 72 | 43 |
| Planner model/tool calls | 6 / 20 | 2 / 2 |
| Planner maximum context tokens | 84,614 | 7,794 |
| Time inside model requests | 344.840s | 310.006s |
| SDK cost | USD 0.157824288 | USD 0.065783244 |
| Handoff repairs | 0 | 1 |

Elapsed time improved **11.36%**, planning **85.04%**, and recorded cost **58.32%**. The new run still spent **91.18%** of elapsed time inside model requests. This includes network/provider waiting, prompt processing, reasoning and response generation. No first-token instrumentation separates them.

The coordinator read two skills and no raw CSV. Its work order had three requested-outcome/check operations rather than the prior nine technical operations and top-ten expansion. The analyst returned 18 candidates versus 25 in the prior run. Consequently, this is a useful single-trial comparison for the same question, not a controlled identical-output workload or reliability benchmark. Provider variation and changed output scope limit causal attribution to intake alone. No new caches or historical calculations were seeded.

The evaluator used a fresh workspace and the currently installed compiled application. Before/after compiled and bundled file hashes match. Source inventory hashes, bundle fingerprint, role prompt hashes and budget limits match the baseline. Every actual role configuration event records the selected DeepSeek/high settings. There was one analyst revision, no provider retry or numerical correction request, and one verifier format repair because its first final response was prose rather than JSON.

## Independent correctness review: failed

Fresh evaluator-only source computation uses exact decimal monetary arithmetic and stays outside the tested workspace. It establishes five quarter controls, 41,684 signed lines and 53 lines with missing cost values, representing GBP 163.33 of Q3 2011 revenue.

Fourteen supported approved claims reproduce within display precision. The verifier correctly holds the two Q3 2011 margin candidates. It nevertheless approves the two full-window margin candidates, despite the same unavailable COGS. The full-window margin cannot be established on the claimed complete basis. SQL `SUM` ignoring unavailable COGS does not make that amount known. **16/18 claim-status/value comparisons pass; financial delivery fails.**

The reply repeats held Q3 draft margin values and gives incorrect alternative cost-available rates: it states 41.12% for Q3 versus independent 41.01%, and 42.94% for the window versus independent 42.92%. Checkpoint integrity passes, with 16 approved and two held IDs; integrity proves evidence consistency, not the correctness of the verifier's business judgment. The response contains one table and three chart descriptors; no browser rendering inspection was performed for this trial.

These findings prevent treating a transport `complete` outcome or a modest time reduction as acceptance. Intake helps discovery, but does not remove the need for independent numerical and eligibility checking.

## Batching change after the experiment

Added one paragraph to `pricing-harness/bundled/harness-tools/data-analysis.md`: batch related measures and applicable parsing/eligibility/join/coverage checks, return bounded diagnostics together, and use additional probes when observed gaps require them. The verifier still performs its own calculation. No fixed analytical query library, budget change or reasoning change was introduced.

This guidance was changed **after** evidence capture and preservation checks. It cannot explain the timings above. Focused validation: `npm test -- tests/unit/bundle.test.ts tests/unit/workflow-handoff.test.ts`, **25/25 passed**. No additional paid batching trial, full suite, build, plugin install, commit or push followed. Handoff/routing interfaces remain unchanged; their proposed future work is not reported as implemented.

## Evidence

- Live result, complete response and run metrics: `.cache/intake-latency-2026-10-09/2026-10-09T14-45-05.636Z-954ca210/result.json`.
- Experiment settings/context and before hashes: same folder, `experiment.json`.
- Source controls and assessment: `independent-source-controls.json`, `independent-delivery-review.json`.
- Preserved role sessions/executions: `analysis/`; checkpoints: `workflow/`; source/code preservation: `preservation.json`.
- Reproduction scripts: `.scratch/intake-latency-2026-10-09/{run.mjs,reference.py}`; derived timing: `timing.json`; source-manifest verification: `source-manifest-check.json`.
- Timing replay: `python3 .scratch/latency-audit-2026-10-09/audit.py /private/tmp/pricing-intake-latency-sXp4kp/analyses/370bdb62-8754-4270-bc6c-ee953cf434c6`.
- Initial sandbox connection attempt: `.cache/intake-latency-2026-10-09/2026-10-09T14-44-47.354Z-6b9a4a04/`; zero tokens/cost and no tools. A reviewed network-enabled retry produced the live result above; the failed attempt is preserved and excluded from speed comparison.

Plugin assessment: `pricing-harness/docs/research/pi-subagents-assessment-2026-10-09.md`. It may simplify orchestration/structured results but has no demonstrated inference-speed benefit. Our provenance tools, shared budget enforcement and checkpoint checks would require an integration adapter.
