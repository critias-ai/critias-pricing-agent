# Luna medium after ranking-window repair — 8 October 2026

**The null-field validation bug is fixed, but the single rerun still delivered no verified answer.** The analyst exhausted the shared model-call budget after 216.007 seconds. Its saved draft also has invalid claim shapes and incorrect missing-cost coverage.

The authorized change is one normalization in `validateWorkOrder`: remove `scope.rankingWindow` only when its value is null. Valid text and inherited ranking windows are preserved; other malformed types remain rejected. The input plan is not mutated. The regression reproduced the previous failure before the change and passes afterward. The previously saved null-valued response now passes the rebuilt validator.

The new live planner returned a valid text window, so this live run passed planning without exercising the null branch. Deterministic regression and saved-response checks establish the null repair; the live run establishes progress into analysis.

## Same prompt, observed results

“Review how Lighting & Candles performed over the last five complete quarters.”

| Configuration | Request seconds | SDK USD | Outcome |
|---|---:|---:|---|
| Luna/high, prior repair phase | 242.639 | 0.017486 | No answer: time reserve |
| DeepSeek/high | 132.541 | 0.046512 | No answer: model-call budget |
| Luna/medium, before this repair | 9.263 | 0.000844 | No answer: invalid work order |
| **Luna/medium, repaired rerun** | **216.007** | **0.021343** | **No answer: model-call budget** |

Compared with the Luna/high observation, the repaired medium run stopped about 11% sooner at about 22% greater cost. There is no useful-delivery improvement. Single-trial variation, a different generated work order and the documented mechanical fixes since the older Luna/high batch prevent attributing the difference solely to reasoning level.

Actual model/reasoning was **OpenRouter openai/gpt-6-luna / medium** in both stages. Planning: 13.306s, one model call, no tools. Analysis: 201.413s, 23 model calls and 27 tools. Total: 24 model calls, 27 tools, zero retries/corrections/renders/previews. SDK usage is complete and reconciles to **USD0.021342635**. Batch wall time including setup/copying was 218.048s. The 18-word reply is a failure notice; first verified answer time is null. No verifier or visualizer started, checkpoint or artifact was registered, or chart was rendered.

## Independent draft review

The analyst wrote `AnalysisPacket.json` but did not complete its stage response. Offline validation rejects it as `Invalid analysis packet claim`: several claim values are arrays of objects or objects, whereas the contract accepts scalar values or arrays of strings. This did not cause the live stop; it is an additional problem in the retained draft.

Fresh raw-source controls remained outside the tested workspace. Of 35 selected quarterly comparisons, **32 pass and three fail**. Revenue, quantity, recorded partial COGS and first-four-quarter margins agree. For Q3 2011:

- Draft reports zero unsupported cost rows; independent control finds **53** with missing numeric costs.
- Draft calls GBP154,877.51 fully supported revenue; supported subset revenue is **GBP154,714.18**.
- Draft uses partial COGS against full revenue to report 41.0718% margin. Full-population margin must be held. The separately supported subset margin is **41.0096%**.

The draft's full five-quarter margin and full-population endpoint margin change therefore also lack the necessary cost coverage. These are unpublished evaluator findings, not approved answers. No chart exists to inspect; visual quality remains unassessed.

## Verification and scope

**24 focused checks across four files, typecheck and app build passed.** Tests cover removal of null, input immutability, inherited scope, malformed values, work-order routing and workflow integration. **32 evidence-integrity checks passed** for exact prompt/context, actual model/reasoning, stable sources, fresh unseeded workspace, unchanged request limits/compiled app and excluded evaluator paths. Full suite not run.

Exactly **one new live submission**, using the existing single-prompt manifest, fresh source-only workspace and unchanged 300s/24-model/60-tool analysis cap and reserve/retry/repair limits. No historical analysis code or expected answers were seeded. No extra live retries, product tuning, commit, push or deployment. This remains a one-off model override; saved DeepSeek/high selection is unchanged.

[Full response/run record](../../../.cache/luna-medium-single-2026-10-08/2026-10-08T14-46-03.155Z-d12d178e/F01-1.json); [independent draft review](../../../.cache/luna-medium-single-2026-10-08/2026-10-08T14-46-03.155Z-d12d178e/evaluator/draft-numeric-review.json); [contract checks](../../../.cache/luna-medium-single-2026-10-08/2026-10-08T14-46-03.155Z-d12d178e/evaluator/contract-review.json).

Remaining failures: the analyst uses its call allowance without completing a checkable stage result; retained claims do not follow the value contract; numeric cost presence is missed despite explicit instructions. The null-field repair removes the specific earlier blocker and does not resolve these separate failures.
