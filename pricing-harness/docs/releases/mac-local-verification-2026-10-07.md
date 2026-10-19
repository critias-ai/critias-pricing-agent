# Native Mac local verification — 7 October 2026

Local installation, offline tests and a live synthetic analysis passed the checks described below. **The selected luna model now works with high reasoning; full release acceptance remains pending.** This supplements the original Linux acceptance record without replacing its pending gates.

## Environment and launch

- Apple Silicon arm64; macOS 27.0.1 (26A434).
- Node 22.23.0; Python 3.12.13 in the application's `.venv`.
- Pi SDK 1.0.4; DuckDB 1.5.6, pandas 2.3.3, openpyxl 3.1.5, Plotly 6.9.0, Jinja2 3.1.6.
- Explicit owner-selected model: `openai/gpt-6-luna`, `PRICING_THINKING_LEVEL=high`. Model catalog match, image capability, local key presence and the actual Pi session's `high` reasoning entry were checked. No key was displayed.
- Pricing 0.2.0; visualization 0.1.0; exactly eight bundled skills. Bundle fingerprint: `4a375d8c128c97de8d5cedbdaf45a4fc60abe4bbbae99b7bc708ebc59d0c14b2`. No skills were updated.
- Running URL: `http://127.0.0.1:4317`.
- Test-only workspace: `pricing-harness/workspace/mac-smoke-2026-10-07`. Its synthetic definitions do not apply to real business data.

From the application directory, restart with:

```bash
bash scripts/start-macos.sh "$PWD/workspace/mac-smoke-2026-10-07" openai/gpt-6-luna
```

The launch reads the local `.env`. Restart after editing credentials, model or reasoning settings. Stop the current server before launching another on the same port.

## Executed checks

| Check | Result |
|---|---|
| Existing `scripts/setup-macos.sh` | Passed: Python/npm dependencies, Chromium installation, production build. Sandbox network access initially failed; authorized installation outside the sandbox succeeded. |
| Pinned development requirements | Installed `requirements-dev.txt`; normal setup installs runtime requirements only. |
| `npm run build` / `npm run typecheck` | Passed after the reasoning configuration change. |
| `PLAYWRIGHT_BROWSERS_PATH="$PWD/.cache/browsers" npm test` | 17 tests passed across 13 files after focused corrections. Includes package installation outside the working directory, actual Chromium preview, bundled resources, session resume, cancellation/deduplication and idle/active headless shutdown. |
| `npm run test:python` | 7 passed: independent arithmetic oracle, DuckDB staging/cache/read-only source behavior, explicit Excel sheet selection, missing formula caches and offline report/companion contracts. |
| `PLAYWRIGHT_BROWSERS_PATH="$PWD/.cache/browsers" npm run test:browser` | 3 passed: upload, streaming, real SSE disconnect/reconnect with one submission, new conversation, Stop, isolated preview, complete CSV download, percentage hover and legend toggling. This is a labelled transport fixture, not live model evidence. |
| Native running app | Opened in the in-app browser; selected model and chat/run state visible. Uploaded CSV via the UI, Markdown and XLSX via the existing local HTTP API. Live chat completed with the selected CSV/context. |
| Original-byte preservation | CSV (90 bytes), Markdown (668 bytes), XLSX (4,942 bytes): saved bytes and registered SHA-256 hashes independently matched the originals. |
| Live calculations | Two complete product/year rows matched the existing evaluator-only Decimal/Fraction oracle, including amounts, margins, basis-point deviations and both independent flags. Zero numeric failures; formal evaluation remains `PENDING_REVIEW` without owner approval. |
| Executable companion | Executed an unmodified copy of the published `analysis.py` in a separate verification folder. DuckDB reconciliation reported zero mismatches; reproduced `results.csv` matched the published bytes exactly. |
| Native preview and downloads | Opened the actual live HTML in the UI's `allow-scripts` sandboxed iframe. Toggled and restored its benchmark legend. All three HTTP downloads returned attachment headers and bytes matching registered SHA-256 hashes; the UI Download link also saved HTML to the Mac, with a matching hash. |
| Native active-request Stop | Submitted a small cancellation-only question through the UI, observed running/Stop, then clicked Stop. Run became `cancelled`, app became idle, and all three successful artifacts remained available. |
| Visual review | Inspected final live desktop/narrow screenshots and native preview. Chart labels/legend are readable; the desktop table includes every field. Narrow table requires horizontal scrolling, disclosed in the report. Fixture desktop/narrow screenshots also inspected. |

Evidence is in `.cache/mac-verification/`: `live-retry-accepted.json`, `live-result.json`, `expected-decimal.json`, `live-final-checks.json`, `native-final-checks.json`, `reproduction-checks.json`, `uploads.json`, downloaded companions and `report-live.jpg`. The original failed attempt is retained in `live-accepted.json`; fixture screenshots are in `test-results/app-{desktop,narrow}.png`. These are local verification files, excluded from distribution.

The in-app browser's automated file chooser and HTML Download handling incurred substantial delays despite successful results. Direct localhost uploads/downloads completed promptly. No claim about normal-browser transfer timing or large-file performance follows from these checks.

## Focused corrections

- Packaging test compares the actual canonical installation path. macOS `/var/...` aliases `/private/var/...`; the former text comparison falsely failed despite correct installed-path resolution.
- Shutdown test sends SIGTERM once. Its accumulated-output condition previously sent another signal on the final output, sometimes after the shutdown handler was removed. Instrumented reproduction confirmed two signals; the corrected individual and full-suite checks passed.
- Added optional, validated `PRICING_THINKING_LEVEL`, passed explicitly to Pi. A regression check first demonstrated the previous implicit `medium` behavior, then verified explicit reasoning on fresh and resumed sessions. Unsupported requested levels fail rather than being silently changed. Local configuration uses the owner's requested `high`.
- Documented test dependencies, the browser path, reasoning configuration and restart behavior.

## Live analysis and remaining gaps

After the owner reported that luna was available, fresh run `9d9a7a27-9eb1-440f-b19d-0f137b556487` completed in session `01a1177c-91b0-7569-bfeb-1f8e45296c55` with `openai/gpt-6-luna` and explicit high reasoning. It used only the selected fictional CSV/context; the equivalent XLSX was deliberately excluded. The original source hashes remained unchanged, and the fixture's financial definitions were not persisted as reusable business context.

Independent totals: revenue USD 100,000.00; COGS USD 72,500.00; gross profit USD 27,500.00; revenue-weighted group margin 27.5%. Product `high`: 25% margin, −250 bps, outlier false, detail true (USD 90,000 revenue). Product `low`: 50% margin, +2,250 bps, outlier true, detail false (USD 10,000 revenue). Both complete CSV rows matched the independent oracle. Both chart series' populations and values matched the CSV. The generated script used the bundled DuckDB helper and full-population reconciliation; the offline HTML embeds Plotly without external asset references.

Published companions are under `workspace/mac-smoke-2026-10-07/outputs/9d9a7a27-9eb1-440f-b19d-0f137b556487/`: `report.html` (4,864,704 bytes), `analysis.py` (19,579 bytes), `results.csv` (272 bytes) and `manifest.json`. The manifest lists the same three downloadable companions. Actual Chromium preview produced desktop, narrow and six section screenshots with no reported errors. Its `visuallyInspected:false` remains the helper's automation field; model screenshot inspection and this verification's manual visual review are separate evidence.

Cancellation run `fb68254e-fbb4-4798-ae28-f0f1ee73c1cb`, submitted through the UI, changed from active to `cancelled` after Stop. The localhost session reported `busy:false`, retained the completed run's three artifacts, and kept the selected model/reasoning settings.

Earlier run `7622b1d4-9213-44a7-811c-c98c70847624` failed before tools/calculations with OpenRouter HTTP 404 `model-ignored-by-guardrail`; every endpoint was excluded by the owner's workspace policy. This blocker was resolved before the successful retry. No provider policy or model selection was changed automatically, and no alternate model was used.

No 3m or 30m scale benchmark, full isolated 15-case Docker live acceptance matrix, repeated critical model cases, visualization baseline comparison, or real-data acceptance was run. The small-case verifier reports zero failures but remains `PENDING_REVIEW` for owner review criteria. No capacity or accepted-release claim is made. Real data still requires confirmed mappings, currency/calendar/returns/cost definitions and independent expectations.

`npm audit` reported four dependency findings: two critical, one high and one moderate. They affect the Vitest/tinypool/mocker test stack and `@fastify/static`. Suggested fixes require major version changes; these were not applied during local setup. Advisory records include [Fastify static](https://github.com/advisories/GHSA-8pvw-jcv7-9cmj), [Vitest mocker](https://github.com/advisories/GHSA-82fw-gwwq-j7x9), and [tinypool](https://github.com/advisories/GHSA-85c8-ppgw-ccpr). Passing functional tests does not resolve these advisories.

No push, publication, Docker installation, automatic skill updates or enterprise features were performed.
