# Initial-build acceptance record — 7 October 2026

**Decision: initial implementation available; release acceptance is pending.** Do not advertise verified native macOS or live-business capacity yet.

Implemented: local Fastify/React app, explicit OpenRouter model configuration, Pi session factory with exactly eight packaged skills and no updater, original-byte file registry/hashes, single-run lifecycle/deduplication/cancellation, SSE snapshot recovery, headless JSON-lines turns, raw disk-backed CSV/XLSX helpers, offline Plotly/Jinja reports and companion manifest, actual Chromium preview evidence, isolated iframe/downloads, independent evaluator arithmetic, 15 fresh test cases, staged input-only Docker evaluation tooling and opt-in scale runner.

Executed on this managed Linux x86_64 environment: Node 24.19.0, Python 3.12.14, Pi SDK 1.0.4, DuckDB 1.5.6, pandas 2.3.3, openpyxl 3.1.5, Plotly 6.9.0, Jinja2 3.1.6. Pricing plugin 0.2.0 at `2da2b3f0257aeaa7f386bfeb828692dc95d7b8d7`; visualization/data helper 0.1.0. Lockfile records exact JavaScript dependency versions. Python requirements are pinned.

Final checked counts: 16 unit/integration tests and 7 Python tests passed; build/typecheck and package installation-root checks passed. Headless SIGTERM regression checks verified both idle and active processes with stdin still open. Browser suite: three tests (separate transport evidence).

Local evidence: configuration, atomic source/artifact storage, path escape rejection, bundle resources/install-location/fingerprint mutation, actual SDK ambient-skill suppression/session resume, controller dedup/preflight/cancel lifecycle, browser reducer, structured API errors, offline escaped reports/full companions/failure preservation, independent numeric tolerances/populations, and staged evaluator image allowlist. Browser transport fixture exercised upload → stream → actual SSE disconnect/reconnect with one submission → new conversation → isolated report preview → complete download, Stop, percent hover and legend toggling. Desktop/narrow screenshots were read and showed usable layout. The fixture does not demonstrate live model analysis.

Synthetic data-path measurements:

| Rows | Source bytes | Import | Query/export | Peak process RSS | Checks |
|---|---:|---:|---:|---:|---|
| 3,000,000 | 57,000,033 | 2.31 s | 0.65 s | 214,220,800 bytes | All rows, exact independent totals, 100 product-year groups, complete export, cache reuse |
| 30,000,000 | 570,000,033 | 25.27 s | 4.79 s | 370,921,472 bytes | Same checks |

These are narrow repeated synthetic rows on Linux; compression, hardware, wider rows, joins and query shape can materially change performance. See adjacent JSON records for timings/disk/version details. DuckDB query budget was 4GB/four threads; RSS is measured process memory, not a claimed hard budget. Native macOS validation remains pending.

Visualization reference application: a fresh `gpt-6-luna` at maximum reasoning retrieved the packaged reference and executed its renderer on two-year synthetic values, producing HTML/CSV/script companions. A no-visualization baseline had no verified packaged renderer contract. This validates reference usability, not behavior of the owner's chosen OpenRouter model or full five-year analysis. Screenshot unavailability was disclosed honestly.

Pending gates:

- Select and configure the owner's explicit OpenRouter model/API key locally; run the live headless/browser question and all isolated cases. No cloud model request was made in this build session.
- Verify the Docker runtime image and actual input-only filesystem sentinel test, then run live acceptance; current tests cover staging/allowlist/contracts, not a built-container filesystem proof.
- Supply representative owner data, confirm mappings, currency, calendar, returns/cost eligibility and historical grouping; create independent real-data expectations and verify a smoke analysis.
- Run installation and 3m/30m checks natively on the target Mac.
- Review all critical explanations/clarifications/figures, compare visualization absent/present and repeat critical live cases three times. No live verdict has been marked PASS.

Known limits: ordinary agent tools are not an operating-system sandbox; source mutation is detected and fails the run, without restoring files. Credential variables are removed from analysis shell environments, but local filesystem/shell startup files are not isolated from ordinary tools. Keep only intended data accessible and use a separate user/workspace if stronger isolation is later needed. Caches are replaceable and have no automatic eviction; with the app stopped, delete stale `.pricing/data-cache` entries if disk space is needed. Formula recalculation, automatic cleaning, linked cross-chart queries, PDF and an update mechanism are outside this build. A failed/reportless analysis can retain valid calculation evidence; automation does not assert visual approval.

Final review: `gpt-6-luna` at maximum reasoning identified loopback Host/Origin validation and headless termination as material changes; these were corrected with focused checks. Credential environment exposure was reduced using Pi's Bash spawn hook. Source detection and cache retention were retained as documented lightweight design limits. No push, publication or accepted release was performed.
