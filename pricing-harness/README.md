# Pricing Harness

A local browser application for AI-assisted pricing and gross margin analysis, built with Pi, DuckDB, React and Fastify. Add CSV, Excel, text or Markdown files, ask questions in chat, and get answers whose figures are checked against the code that produced them, with native tables and Plotly charts. Seven pricing skills and one visualization skill are bundled at fixed versions.

**Status: experimental.** Component, Python and browser tests pass locally, and the single-analyst workflow has been run live on synthetic and public datasets (see [the thin-analyst records](docs/releases/)). Real-business-data validation and native scale testing are still pending.

## Run on macOS

Install Node.js 22.19 or later and Python 3.12. From this application directory:

```bash
bash scripts/setup-macos.sh
cp .env.example .env
```

Set `OPENROUTER_API_KEY` in `.env`, or use Pi's stored credentials. Never commit credentials. Set the model ID, reasoning level and limits in `harness.config.json`. Any OpenRouter model ID works, including ones newer than Pi's catalogue. Then launch with a workspace folder outside this repository:

```bash
bash scripts/start-macos.sh "$HOME/PricingHarnessWorkspace"
```

Open [the local application](http://127.0.0.1:4317). An optional second launcher argument overrides the model for that launch. Restart after changing `harness.config.json` or `.env`; stop with Ctrl+C. Model requests can incur provider charges. The macOS launcher always uses OpenRouter. To use OpenAI directly, launch Node yourself as described in [local setup](docs/local-setup.md), which also covers headless use.

## How an answer is checked

Each conversation has one analyst session, so later questions keep the population, period and basis agreed earlier. The analyst calculates with SQL over the sources and with Python scripts, and every run is recorded. Before a reply is delivered:

- every number in it with three or more significant digits must appear in the output of a query or script that ran. If one doesn't, the analyst gets one chance to fix it, and any figure still unmatched is named in a notice;
- tables and charts are read from result files that an executed query or script wrote. Those files are frozen with their hashes, so a chart shows exactly what was computed;
- if a source changes during the run, the answer is withdrawn.

There is no second model reviewing the answer. Figures are checked against executed output, not recomputed independently, so they can still rest on a mistaken assumption. Ask a follow-up to double-check. Before the first question on a set of files, code-based checks flag suspect rows (bad formats, duplicates, missing keys, values far from their peers). The analyst reports those that affect its answer and asks how to treat them; nothing is cleaned automatically. See [architecture](docs/architecture.md) for the full workflow, state files and settings.

## Data and access

Each workspace keeps original files in `files/` (never modified), confirmed business context, conversations and caches in `.pricing/`, and run records in `analyses/`. Large CSVs can be copied into `files/` before launch. Every sheet of a workbook becomes its own table; formula cells without saved values stay unknown.

Confirm business definitions before relying on results. The analyst records a definition in `.pricing/context.md` only after you confirm it.

Calculations and charts run locally, but prompts and tool results contain business data and go to your model provider. The analyst has a real shell with your user's permissions. Running the app is not an operating-system sandbox, so use a workspace and an account you're comfortable with. The server binds to `127.0.0.1`, accepts only local requests and has no login. Review [the test protocol and limits](docs/acceptance.md) before using real data.

## Verify a source checkout

After setup, run from this directory:

```bash
.venv/bin/python -m pip install -r requirements-dev.txt
export PLAYWRIGHT_BROWSERS_PATH="$PWD/.cache/browsers"
node node_modules/playwright/cli.js install chromium
npm run build
npm run typecheck
npm test
npm run test:python
npm run test:browser
```

These tests make no paid model requests. Browser tests use a labelled offline fixture and check the UI and transport, not model quality. Live evaluations are separate, opt-in and paid; see [the evals README](tests/evals/README.md). Dependency advisories recorded in [local verification](docs/releases/mac-local-verification-2026-10-07.md) remain open.

## License

Apache License 2.0; see [LICENSE](LICENSE). The bundled Pricing Plugin keeps its [original MIT license](bundled/pricing-plugin/LICENSE). See [third-party notices](THIRD_PARTY_NOTICES.md) and [bundle provenance](bundled/versions.json).
