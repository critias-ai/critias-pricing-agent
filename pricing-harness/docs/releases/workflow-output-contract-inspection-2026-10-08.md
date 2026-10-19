# Workflow output contracts — 8 October 2026

The latest rejection is an interface-format failure with correct retained calculations. It is not evidence that the category, dates or financial basis disappeared between stages. Earlier trials include both format failures and substantive analysis defects; treating all failures as formatting would hide real inaccuracies.

Every stage starts a fresh Pi session. Its system prompt combines the short shared instructions, its role instructions and bundled skill availability. Its user prompt is a JSON envelope containing the original question, confirmed business context, source paths/hashes, working directories, Python/helper locations, current scope, remaining budget and stage-specific input. Coordinator input includes compact public history and the analysis index. Analyst input includes the full work order, compatible generated-code references, previous checkpoint, checked claims and remaining operations. Verifier input includes the work order and analysis packet; visual stages receive the immutable checkpoint and presentation evidence.

The envelope's `outputSchema` is an example object with English placeholders, **not a formal JSON Schema**. The model is asked to return JSON in its final assistant text. The worker strips an optional code fence, calls `JSON.parse`, and sends the parsed object to the controller. There is no dedicated result-submission tool that validates the handoff during the producing stage, and no provider-level final-response schema enforcement in this path. Analytical skills teach methods; they do not define the harness-specific WorkOrder/AnalysisPacket interfaces.

The latest contradictory example is literal:

```json
{"scope": "exact work order scope"}
```

But `validatePacket` requires:

```json
{"scope": {"population": "...", "period": "...", "basis": "..."}}
```

The correct object is already supplied in the stage's scope and `input.workOrder.scope`. The analyst instead summarized it as prose, matching the example's type. The coordinator example has other ambiguities: `depth` is shown as the string `quick | analysis | report`, and optional fields appear with phrases such as `omit unless blocked`. These are descriptions to interpret rather than valid outputs to copy.

A successful JSON parse does not establish correctness. The controller separately checks field types, unique claim IDs, allowed claim-value types, evidence paths, scope equality, completed work, successful independent executions, source access, numerical agreement and presentation evidence. Many of these rules live in TypeScript validators and are not represented in the examples. Packet validation failures usually exit the run with a generic message; they are not returned to the analyst for repair. The existing correction allowance applies to targeted verifier findings after a valid packet has already passed admission. Increasing that allowance therefore does not repair this latest malformed packet.

Saved evidence separates the failure classes:

| Trial | Failure class | Evidence |
|---|---|---|
| Initial Luna/medium | Representation | `rankingWindow: null` rejected where an optional string was expected; omission alone passed offline. |
| Later Luna/medium | Both | Malformed claim values and omitted products/missing costs. |
| Lightweight Luna/high, five minutes | Incomplete delivery | Executed numerical drafts passed 97 checks, but no final packet arrived before the reserve. |
| Luna/high, ten minutes | Representation at admission | Packet scope was a string; 163 numerical comparisons passed. Replacing only scope in an offline copy passed structural/scope/work-accounting validation. Verification never started. |

The ten-minute draft also contains `NaN` in its internal checks JSON for withheld measures. That is an interoperability defect, distinct from the correctly blank CSV cells and explicit missing-cost holds. It is not the immediate packet rejection.

A small next repair should align the example with the actual contract and use one executable contract for both model guidance and validation. A result-submission tool can return a precise field error to the same agent while budget remains. Authoritative controller metadata, such as unchanged work-order scope, should be copied by the harness where appropriate. The model still needs to supply evidence and conclusions; independent verification must continue to catch wrong populations, costs or arithmetic. These repairs do not require longer analytical instructions. No output-contract repair or paid replay was performed in this inspection.

Configuration was implemented separately in [harness.config.json](../../harness.config.json). It contains app/test model selections, reasoning, cumulative class budgets, reserve times, shared retry/correction/render/preview ceilings, repeat cutoff, group ceiling and batch time/cost limits. Effective settings are captured by the new configured evaluator. Credentials remain local in `.env`; machine workspace/Python paths remain launcher inputs. Unknown keys and invalid settings fail validation. File edits require a restart/new run, not a rebuild.

Validation: **38 focused checks across seven files**, typecheck and app build passed. The configured dry run confirmed the exact one-message Luna/high experiment with 600/180 seconds and 100 calls, without paid calls. Workflow version 1.0.5. Existing changes were preserved; no full suite, commit, push or deployment.

- [Current output examples](../../src/agent/workflow/orchestrator.ts:15)
- [Role instructions](../../src/agent/workflow/role-prompts.ts:1)
- [JSON parsing](../../src/agent/workflow/worker.ts:64)
- [Packet and independent verification checks](../../src/agent/workflow/checkpoints.ts:8)
- [Ten-minute offline contract evidence](../../../.cache/luna-high-ten-minutes-2026-10-08/2026-10-08T15-59-14.724Z-388875da/evaluator/contract-review.json)
- [Settings and launch instructions](../local-setup.md)
