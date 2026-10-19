# Context handoff and script-writing inspection — 8 October 2026

Inspected the actual saved Luna/high run. Each stage receives a fresh session, the same confirmed workspace context and a file inventory. The coordinator transfers a structured work order, not its conversation/tool transcript. No confirmed context was lost in this run. The analyst's script is 393 lines and was never executed.

## Transfers

| Transition | What the receiving stage gets |
|---|---|
| User → coordinator | Original request, confirmed context, 24-file inventory, compact public history, prior scope/code index, work-order output example and remaining budget |
| Coordinator → analyst | Original request and confirmed context again; work order, scope, compatible code references, prior checkpoint reference, checked claims, pending operations, analysis output example and remaining budget |
| Analyst → numerical verifier | Original request/context/inventory again; work order and validated analysis packet containing claims, result paths and code paths. Verifier writes and executes its own checks |
| Verifier → checkpoint | Harness checks successful execution evidence, source/path hashes, claim approvals and requested-operation coverage; seals and publishes the supported result |
| Checkpoint → visualizer → visual verifier | Work order and immutable verified checkpoint; then presentation metadata and actual render/preview ledger. Visual verifier checks chart values and screenshots |

Every stage has a new model session and its own write directory. Readable files remain in the workspace. Previous tool histories are not automatically appended. One cumulative request budget spans every stage; numerical verification must complete before charts can be published. There is at most one shared correction and up to three analysis/verification groups. In this run only coordinator and analyst started.

## Analyst's intended process

1. Read relevant definitions/helper documentation and inspect compatible generated code if available.
2. Generate Python/SQL in its own stage directory using the configured DuckDB staging helper.
3. Invoke `execute_analysis` with the script's absolute path. The harness runs it with the configured Python, records successfully accessed source paths and hashes, and retains stdout/script evidence.
4. Return an AnalysisPacket JSON with claims, units, result evidence, code/result paths, completed/pending operations, coverage and holds.
5. Harness validates packet shape and scope, then launches independent verification. The handoff waits for the final JSON response; writing a script or result file alone does not start the verifier.

There is no enforced early schema/value inspection or small initial execution. The prompt asks for a useful claim group promptly, but allows arbitrary read/write/edit cycles until the budget expires. The planner's operations are natural-language instructions, not resolved field/value bindings or executable checks. `confirmedDefinitions: []` here means no newly confirmed facts; the original confirmed context is still passed separately.

## Exact prompts

The following preamble is copied from the actual saved analyst system message. The SDK also appends a skill-name/description/location catalogue and the current directory, and supplies tool definitions separately.

```text
Use only the supplied request, confirmed definitions, scoped history and workspace evidence. Use the supplied inventory; avoid rediscovering files. Read only relevant definitions, mappings and metric references; visualization guidance belongs to the visualizer. Sources, confirmed context, controller metadata and prior stage files are immutable. Write only in your stage directory. Generate general-purpose analysis code as needed; inspect compatible workspace-generated code before adapting. Use executed Python/SQL and the configured DuckDB helper; never load large raw sources into model context. Preserve signed observations, source repeats, missing numeric costs, units, currencies and documented event cardinality. Hold unsupported measures explicitly. Never infer commercial causes or authorizations from accounting patterns. Do not install packages or expose credentials. Every role shares one request budget; stop once your assigned operation is complete. Quick user replies normally use 50–120 words; ask one blocking clarification. Finish with only the required JSON object, without a fence. Do not write a report unless assigned visualization. All numerical replies require independent executed evidence. Tools are native, not an OS sandbox.
Execute the requested analysis and produce an AnalysisPacket. Inspect available generated code for reuse; adapted code needs fresh execution. Use execute_analysis with filePath set to the absolute generated Python script path; this records its successful execution and output. Include material numerical claims with IDs, values, units and result-file evidence. Return a useful claim group promptly. Account for exact assigned operations in completedOperations and pendingOperations; omit none. Save complete bounded results and code; packet code/results use workspace-relative paths. Check financial coverage, numeric cost presence, unique joins and comparable currency. Distinguish supported populations from full-population measures and preserve no-activity cells. Do not claim independent verification or create HTML. For a new ranking include resolvedRanking and a rank-array claim. Continue remainingOperations without repeating checked claim IDs. If clarification is indispensable return blockingInput instead.
```

The user-facing request is:

> Review how Lighting & Candles performed over the last five complete quarters.

The exact coordinator-assigned operations, repeated in `remainingOperations`, are:

- Review quarterly revenue, signed units, and weighted invoice margin; describe quarter-to-quarter and full-window patterns.
- Validate category and item eligibility, source repeats and event cardinality, and cost-history effective dates, unique matches, gaps/overlaps, units, and currencies. Preserve missing or unsupported costs rather than resolving them silently.
- Hold adjusted net-sales margin and off-invoice or service-cost effects; do not infer commercial causes or approvals.

The full recorded JSON prompt also contains the 2,074-character confirmed context, scope twice (top-level and work order), all 24 source paths/hashes, Python/DuckDB paths and limits, output-shape example and remaining budget. At analyst start, 268,170ms, 99 calls and 60 tools remained. The 60-second finalization reserve further limited analysis time.

- [Exact analyst system text including SDK catalogue](../../../.cache/luna-high-100-calls-2026-10-08/2026-10-08T15-11-21.677Z-862724a2/evaluator/prompt-inspection/2-analyst-system-prompt.txt)
- [Exact analyst JSON user prompt, readable formatting](../../../.cache/luna-high-100-calls-2026-10-08/2026-10-08T15-11-21.677Z-862724a2/evaluator/prompt-inspection/2-analyst-user-prompt-readable.json)
- [Original compact JSON message bytes](../../../.cache/luna-high-100-calls-2026-10-08/2026-10-08T15-11-21.677Z-862724a2/evaluator/prompt-inspection/2-analyst-user-prompt.json)
- [System message including actual tool definitions](../../../.cache/luna-high-100-calls-2026-10-08/2026-10-08T15-11-21.677Z-862724a2/evaluator/prompt-inspection/2-analyst-system-message.json)
- [Actual tool sequence](../../../.cache/luna-high-100-calls-2026-10-08/2026-10-08T15-11-21.677Z-862724a2/evaluator/prompt-inspection/2-analyst-tool-sequence.json)

## Observed process and design weaknesses

The analyst made ten read calls, two shell calls, one script write and two edits. Reads included pricing guidance, four company/data documents, the helper documentation and helper implementation, a failed metric-reference lookup, and its own script. The shell calls inspected directories. No raw-file schema/category query or calculation execution occurred.

The 393-line script includes field-name discovery, master-payload checks, invoice and repeat diagnostics, cost interval diagnostics, row-level cost audits, quarterly/full-window measures and JSON/CSV exports. Some coverage checks are necessary, but a reusable validation framework and unrelated diagnostics need not precede the first useful result for this request. The analyst used the display category label `Lighting & Candles`, which matches zero source rows, instead of `LIGHTING_AND_CANDLES`.

Specific weaknesses:

- The work order expands a simple review into a broad audit operation. Relevant checks are not staged into a small first execution followed by material exceptions.
- The packet has file paths/hashes but lacks resolved column/value mappings. The planner cannot resolve these from the catalogue alone; the analyst needs a small source inspection before generating the main calculation.
- The displayed output schema is an example object rather than a complete typed contract. In the medium run, nested claim values caused rejection before the verifier could request correction.
- Prompts say to return promptly, but the controller cannot verify progress from an unexecuted draft. It starts the next stage only after final JSON and validation.
- All stages receive the full inventory and skill catalogue. Context and scope are repeated in the analyst packet; subsequent reads and self-review inflated the session to 39,220 reported input tokens.

These are orchestration/interface design weaknesses and observed model mistakes. The evidence does not establish lost or corrupted context. No product changes, new live requests or script repairs were made for this inspection.
