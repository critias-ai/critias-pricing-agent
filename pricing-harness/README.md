# Pricing Harness

A local browser application for AI-assisted pricing and gross margin analysis, built with Pi, DuckDB, React and Fastify. Add CSV, Excel, text or Markdown files, ask questions in chat, and get answers whose figures are checked against the code that produced them, with native tables and Plotly charts. Seven pricing skills and one visualization skill are bundled at fixed versions.

**Status: experimental.** Component, Python and browser tests pass locally, and the single-analyst workflow has been run live on synthetic and public datasets (see [the thin-analyst records](docs/releases/)). Real-business-data validation and native scale testing are still pending.

## Install with npm

You need Node.js 22.19 or later and Python 3.12 (Windows also needs Git for Windows).

```bash
npm install -g critias
```

Create `~/.critias/.env` (on Windows, `%USERPROFILE%\.critias\.env`) with a key and a model for one provider. For example:

```text
ANTHROPIC_API_KEY=your-key
ANTHROPIC_MODEL=claude-sonnet-5-5
```

The other providers are `OPENAI_*`, `OPENROUTER_*` and `GEMINI_*`; `critias models anthropic` lists model IDs. Then start the app with a folder for your business files:

```bash
critias ~/CritiasWorkspace
```

The first start creates a Python environment in `~/.critias/venv`, which takes a minute and needs a network. Open the link it prints. `npx critias` works without a global install. To update, run `npm install -g critias` again.

## Run on macOS from a clone

Install Node.js 22.19 or later and Python 3.12. From this application directory:

```bash
bash scripts/setup-macos.sh
cp .env.example .env
```

Set a key and a model for the provider you use in `.env`: `OPENAI_API_KEY` and `OPENAI_MODEL`, `OPENROUTER_API_KEY` and `OPENROUTER_MODEL`, `GEMINI_API_KEY` and `GEMINI_MODEL`, or `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL`. The app uses the first provider that has both, in that order. With a stored ChatGPT login (Pi's `~/.pi/agent/auth.json`), set only `OPENAI_MODEL`. Never commit credentials. Limits live in `harness.config.json`. Any model ID works, including ones newer than Pi's catalogue. The thinking level is chosen in the interface, beside Send. Then launch with a workspace folder outside this repository:

```bash
bash scripts/start-macos.sh "$HOME/PricingHarnessWorkspace"
```

Open the link the launcher prints (`http://127.0.0.1:4317/#token=…`). The token is new at each launch and stops other programs and accounts on the computer from using the app; a plain `http://127.0.0.1:4317` page cannot load your data. An optional second launcher argument overrides the model for that launch. Restart after changing `harness.config.json` or `.env`; stop with Ctrl+C. Model requests can incur provider charges. For a direct Node launch or headless use, see [local setup](docs/local-setup.md).

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

Apache License 2.0; see [LICENSE](LICENSE). The bundled Pricing Plugin keeps its [original MIT license](bundled/pricing-plugin/LICENSE). See [third-party notices](THIRD_PARTY_NOTICES.md) and [bundle provenance](bundled/versions.json). Some eval cases are derived from public datasets under CC BY 4.0 and MIT; their attribution is in the [third-party notices](THIRD_PARTY_NOTICES.md#evaluation-data).
