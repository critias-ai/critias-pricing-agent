# Fresh-session implementation prompt: in-chat exploration

Copy the following prompt into a new session.

```text
Work in:
the repository root

Read PROJECT_GUIDE.md, then these documents in order:
1. pricing-harness/docs/superpowers/specs/2026-10-09-in-chat-exploration-design.md
2. pricing-harness/docs/superpowers/plans/2026-10-09-in-chat-exploration.md

Execute IC-01–IC-06 inline, using superpowers:executing-plans. The design is ready for implementation; do not restart the design interview or dispatch subagents. Inspect the actual current files before editing. Work in the existing checkout and preserve all pre-existing changes; do not reset/stash or replace it with a clean baseline. Record initial status and file hashes in a unique ignored evidence directory.

Replace standalone report generation with interactive charts/tables inside assistant messages. Use native React components and exactly pinned plotly.js-basic-dist-min@4.1.2; defer OpenUI and exports. V1 supports local chart hover/zoom/pan/legend/reset and table search/sort/pagination only. Interactions must not invoke a model, submit a message, execute analysis or create a run.

Keep coordinator → analyst → independent numerical verifier → immutable checkpoint. Bind every numeric cell/point to independently approved scalar claim IDs. Held values remain unavailable with executed reasons. Preserve scope/ranking, source/execution/checkpoint integrity, independent checks, verified partial results and the existing final-JSON/bounded-repair path. Optional view failures must preserve the numerical answer without consuming format repairs or creating a UI repair/model stage. Add no analyst preflight or submission tool.

Remove active report production, visualizer/screenshot-review/correction stages, render/preview tools and report product UI as specified. Retain internal calculation/check evidence, historical outputs and read-only historical download APIs. Retire explicit legacy execution with an actionable startup error; do not silently substitute modes. Keep report-named budget keys and historical counters readable, inactive where retired. Preserve the pricing plugin's content, license and provenance.

Preserve source data, historical evidence, credentials, saved model/reasoning settings, budgets, repair ceilings, evaluation manifest and Python dependency/environment files. Do not fix unrelated DeepSeek verifier packaging failures or change provider/model settings. Set only the planned workflow/visualization versions and add the one browser dependency. Treat intentionally removed report code as explicit migrations and record each deletion/replacement.

Follow each task's focused RED/GREEN checks. Finish with the exact focused unit/integration and browser commands in IC-06, npm run typecheck, npm run build, and npm run eval:configured -- --dry-run. Use offline synthetic provider/browser fixtures; the dry run must make zero paid calls. Inspect actual desktop/narrow rendered output and chart values/units, verify controls make no additional requests/model/tool calls, and test persistence/reconnect/restart/cancellation/source-change behavior.

Save command outputs, exit codes, screenshots/traces and preservation fingerprints in the unique ignored evidence directory. Write the local-validation release record, mark only completed plan steps, and update PROJECT_GUIDE.md concisely (<2,000 words). Report what passed, remaining limitations and evidence paths. Do not claim live latency savings or a full acceptance pass from local checks.

Stop after local validation. No paid evaluation, full suite, scale benchmark, fallback model, commit, push, publishing or deployment. No new report/export subsystem or unrelated refactoring.
```

References: [design spec](../specs/2026-10-09-in-chat-exploration-design.md), [implementation plan](2026-10-09-in-chat-exploration.md).
