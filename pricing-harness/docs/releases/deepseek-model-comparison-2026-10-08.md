# DeepSeek versus Luna: focused evaluation — 8 October 2026

**Switching to DeepSeek V4.1 Flash did not improve useful delivery.** The same five prompts produced zero verified answers, checkpoints or charts. Submitted time fell only 3.0%, while SDK-estimated cost increased 3.20 times. Faster failure is not an improvement.

The selected local model is now **OpenRouter `deepseek/deepseek-v4.1-flash`**, as explicitly requested. Reasoning remains **high**; no fallback was used. Earlier Luna manifests, results and existing checkout changes were preserved. No commit, push or deployment occurred.

## Before/after

The baseline is the immediately preceding five-message delivery-repair run on `openai/gpt-6-luna`/high. Times below include the whole submitted request, not just inference.

| Prompt | Luna seconds | DeepSeek seconds | Luna SDK USD | DeepSeek SDK USD | DeepSeek outcome |
|---|---:|---:|---:|---:|---|
| Group review | 242.639 | 132.541 | 0.017486 | 0.046512 | Model-call budget exhausted |
| Top ten | 242.632 | 166.734 | 0.017705 | 0.070372 | Model-call budget exhausted |
| Q2 diagnosis | 242.773 | 242.741 | 0.015598 | 0.067839 | Verification/finalization time reserve reached |
| Following-quarter recovery | 192.706 | 242.524 | 0.015332 | 0.022284 | Same time reserve reached |
| Detailed pricing scenario | 369.436 | 466.658 | 0.027935 | 0.094368 | Model-call budget exhausted; one transient retry |
| **Total submitted** | **1,290.186** | **1,251.198** | **0.094057** | **0.301375** | **0/5 verified answers** |

Batch wall time, including workspace preparation and evidence copying, was **1,256.992 seconds (20.95 minutes)** versus Luna's **1,296.435 seconds (21.61 minutes)**. The first two failures arrived sooner; recovery and the detailed scenario took longer. Time to first verified answer is null for every prompt in both runs.

| Measure | Luna | DeepSeek |
|---|---:|---:|
| Verified answers / checkpoints / charts | 0 / 0 / 0 | 0 / 0 / 0 |
| Model attempts | 76 | 106 |
| Tool calls | 102 | 140 |
| Transient retries | 0 | 1 |
| Structural/visual corrections | 0 | 0 |
| Reply words, all failure notices | 90 | 88 |

Response brevity does not count as improved quality. Historical 7 October originals delivered three supported numerical replies for these same five questions; neither bounded run restored that delivery.

## What caused the waits

DeepSeek spent **92–98%** of each request inside recorded model-call intervals. These intervals include generation/reasoning and provider waiting; the traces cannot separate them or establish queue priority.

Five planning stages took **198.201 seconds**, 23 model calls and 29 tool calls. Five analyst stages took **1,046.443 seconds**, 83 model calls and 111 tool calls. No independent verifier or visualizer stage started.

The initial group planner consumed **15 of the shared 24 model calls**, including repeated product-master reads, before analysis began. The top-ten analyst used the remaining 23 calls without returning its packet. Diagnosis/recovery used their time allowance before producing a checkable result. The detailed request exhausted 36 calls after profiling, repairs and scenario generation. Its SDK `Connection error.` triggered the existing single bounded retry; it subsequently continued, but still delivered no result.

Thus the model switch did not fix excessive preparation or the handoff from executed calculations to a result the controller can verify. Missing checkpoints also prevented the recovery question from becoming a short checked lookup.

## Independent quality review

Evaluator code and controls remained outside all tested workspaces. All **42 independent raw-data controls** reproduced successfully.

The unpublished top-ten draft passed **177 numeric comparisons**: ranking, item revenue/COGS, supported margins and observed quarterly values agree with independent calculations. It nevertheless unnecessarily held SKU 85123A's margin despite the confirmed EA convention, and omitted the no-activity 22969/Q3 2010 cell from its quarter table. It never became a delivered or product-verified answer.

The unpublished detailed draft has material basis failures, independently investigated from raw sources:

- The selected scenario export contains **350,626 rows for 350,573 distinct source lines**, while the raw selected population contains exactly 350,573 rows: **53 extra rows introduced by joins**.
- Its reported 1,001 positive lines without usable cost disagrees with the independent selected-source count of **903**. Contribution levels nevertheless subtract partial COGS rather than hold unsupported levels.
- The service pool combines **EUR29.4824** with **GBP415,002.4903** in a field treated as GBP. Removing repeated service payloads leaves **GBP414,818.3503**, a further GBP184.14 difference. Product attribution of the invoice-level pool was not established.
- Agreement matching uses historic transaction dates for the January 2012 scenario. Independent controls find **zero executed agreements active on 1 January 2012**; current January quote/order rights need separate supported mapping.
- The historical master-based merchandise basket of GBP8,650,054.98 and finance baseline GBP8,590,935.13 reproduce, but that arithmetic agreement alone does not validate scenario mappings or full net-pocket reconciliation.

The financial draft review deliberately records the failed cost-count comparison; it is not an all-pass result. Alternative scenario methods are allowed when their scope and mappings are justified. The critique concerns unsupported assumptions and join/currency/cost handling, not forcing the previous evaluator's chosen scenario totals.

**No rendered charts exist to inspect.** Visual quality is unassessed, not passed. Conversation history carried the Lighting/SKU questions, but no verified ranking cohort, successful code adaptation or checked lookup was recorded. All codeReuse arrays are empty.

## Scope, checks and limitations

The run submitted exact F01-1, F02-1/2/3 and F05-1 prompts once, sequentially. F01/F02 shared one fresh conversation; F05 used a fresh workspace. Same source files, confirmed definitions, role prompts, high reasoning and request caps: analysis 300s/24 model/60 tool; report 600s/36 model/90 tool; 20% time reserve; one shared transient retry/correction; maximum two renders/previews. Batch admission cap remained **30 minutes / estimated USD1**, with no supplemental recovery messages. Final usage was complete and costs reconcile to all recorded SDK usage events; estimates are not billing guarantees.

Eight focused tests, typecheck, app build and dry-run manifest validation passed. **84 integrity checks** passed for actual DeepSeek/high settings, unchanged input hashes, matching fixtures/limits, unseeded workspaces, excluded evaluator paths and unchanged compiled app during the batch. All 1,294 historical files remain unchanged. A configured-credential scan found zero matches across 373 evidence files. The full test suite was not run.

This is a descriptive comparison, not an isolated model A/B experiment: the current checkout includes the previously documented post-Luna cache-provenance and connection-retry fixes. Provider conditions can also vary. Both model tests used OpenRouter; no paired direct-OpenAI run or queue telemetry was collected. The result neither proves nor disproves preferential treatment of direct OpenAI customers. It does show that this alternative model, under the same bounds, does not solve the observed delivery problem.

## Evidence and remaining failures

[Complete responses](../../../.cache/deepseek-model-comparison-2026-10-08/2026-10-08T13-50-05.313Z-affe9180/responses.md); [per-message metrics](../../../.cache/deepseek-model-comparison-2026-10-08/2026-10-08T13-50-05.313Z-affe9180/metrics.csv); [independent financial review](../../../.cache/deepseek-model-comparison-2026-10-08/2026-10-08T13-50-05.313Z-affe9180/evaluator/financial-draft-review.json).

[Approved comparison manifest](../superpowers/plans/2026-10-08-deepseek-model-comparison-evaluation.json); [comparison entrypoint](../../scripts/eval-deepseek-comparison.mjs). Complete stage traces, model settings, pre-turn snapshots, generated drafts, immutable source copies and cost reconciliation remain under the same evidence directory.

Remaining failures: no delivered calculations; planning consumes analysis capacity; scripts finish without prompt packet delivery; follow-ups lack checked continuity; financial drafts have material basis errors; chart delivery remains unproven. No further live replay or workflow tuning was performed in this phase.
