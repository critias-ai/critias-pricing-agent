# Minimal visual review — local validation

Workflow version: **1.0.17**. The visual reviewer now reads the verified facts, figure JSON and desktop/narrow chart captures, then returns approval or a specific visualizer correction. It receives only the read tool. Numerical verification remains separate and unchanged.

Removed from visual approval: raw-source recomputation, generated comparison scripts/JSON, visual execution identity, an exact checkpoint-file read, and mandatory duplicate screenshot inspection by the producer. The defective object-identity comparator is removed with that transport contract. Bundled guidance now describes the simpler review and uses supplied shared allowances.

Retained: final JSON and bounded repairs/corrections; canonical paths; recorded render/preview identity and figure inventory; report, figure, screenshot and checkpoint hashes; actual reviewer reads of every figure and each desktop/narrow chart capture; source and corrected-output protection; verified numerical partial results if presentation fails. Saved models, settings and budgets are unchanged.

## Local evidence

Evidence directory: `.cache/minimal-visual-review-2026-10-09T09-17-09Z-c8cf1944/` at the repository root.

- `tdd-red.log`, `prompt-red.log` and `schema-red.log` capture failing cases before their corresponding fixes; `tdd-green.log` captures the initial passing implementation.
- `focused-tests.log`: **112/112** checks across 11 files. Coverage includes read-only installed SDK lifecycle, successful publication without a generated visual execution, corrections/partial delivery, inspection, path and tampering guards, analyst handoff, numerical checkpoints and budgets.
- `typecheck.log`, `build.log`, `dry-run.log`: all pass (`npm run typecheck`, `npm run build`, `npm run eval:configured -- --dry-run`). The dry run uses the existing Lighting & Candles prompt with Luna/high evaluation override and saved workflow limits; **no paid calls**.
- `bundled-guidance-check.log`: 10/10 prompt and installed SDK checks pass after the guidance update. The SDK stream is synthetic; it verifies offered tools and lifecycle, not live model compliance with the rewritten guidance.
- `saved-presentation-replay.json`: the actual saved 1.0.16 presentation passes the compiled simplified validator with eight recorded chart captures and the final reviewer's recorded reads. The replay supplies the new minimal approval object; it does not rerun model judgment, publish historical artifacts or establish a fresh end-to-end result.
- `preservation-audit.json`: 375 baseline files checked; 361 unchanged, 14 deliberately modified, none missing or unexpectedly changed. Saved settings/credentials and all 14 saved presentation/checkpoint files are unchanged. Existing unrelated changes and historical evidence remain in place.

## Practical limit

Chart values, units, missing values and layout are assessed by the visual reviewer against verified facts. The controller enforces integrity and actual file inspection; it no longer independently computes chart-value equality. Fresh model output quality and completion remain unproven until a separately authorized live evaluation.

Stopped after local validation. No paid evaluation, full suite, model fallback, commit, push or deployment.
