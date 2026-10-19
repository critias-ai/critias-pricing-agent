# Local setup on macOS and Windows

## Install

Install Node 22.19 or later (Node 24 works) and Python 3.12, for example `brew install node python@3.12`. From the application directory, run:

```bash
bash scripts/setup-macos.sh
```

Setup creates `.venv` from `requirements.txt`, installs the locked JavaScript packages and builds the app. Set `PRICING_BOOTSTRAP_PYTHON` to an absolute Python 3.12 path if `python3.12` isn't on your `PATH`. Chromium is only needed for the development browser tests. The running app never installs packages or updates its bundled skills, and the analyst is blocked from installing packages.

## Credentials

Copy `.env.example` to `.env` and set `OPENROUTER_API_KEY`, or export it in your shell. Pi's stored credentials (`~/.pi/agent/auth.json`) also work; the harness reads them but doesn't change them. For OpenAI directly, set `OPENAI_API_KEY` and use the direct launch below with `PRICING_PROVIDER=openai`. Never paste a key into chat or commit it. The harness removes variables named like keys, tokens, secrets, passwords or credentials before starting the analyst's shell and Python processes.

## Choose a model

Set `model.id` in `harness.config.json`. Any OpenRouter ID works. An ID that isn't in Pi's bundled catalogue borrows connection settings from a catalogue model of the same vendor (the part before `/`), and its price comes from OpenRouter's public model list. If that list can't be reached, cost estimates read zero. To list the catalogue without making a model request:

```bash
node --input-type=module -e 'import { ModelRuntime } from "@earendil-works/pi-coding-agent"; const r=await ModelRuntime.create({modelsPath:null,allowModelNetwork:false}); console.log(r.getModels("openrouter").map(m=>m.id).join("\n"));'
```

On Windows install Node, Python 3.12 and Git for Windows (the analyst's shell commands run in Git Bash). In PowerShell run `powershell -ExecutionPolicy Bypass -File scripts\setup-windows.ps1`, then launch with `powershell -ExecutionPolicy Bypass -File scripts\start-windows.ps1 "C:\absolute\workspace" [model-id]`. For a direct launch set `PRICING_PYTHON` to `pricing-harness\.venv\Scripts\python.exe`.

The harness never substitutes another model. If the configured model or reasoning level can't be selected, startup or the question fails.

## Launch

```bash
bash scripts/start-macos.sh "/absolute/path/to/Business workspace"
bash scripts/start-macos.sh "/absolute/path/to/Business workspace" "vendor/model-id"
```

Open http://127.0.0.1:4317. The workspace is created if needed. The optional second argument overrides the model for that launch. The launcher always sets the provider to OpenRouter. Restart after changing configuration; no rebuild is needed.

For a direct Node launch, another provider, or headless use:

```bash
export PRICING_WORKSPACE="/absolute/path/to/workspace"
export PRICING_PROVIDER=openrouter   # or openai
export PRICING_MODEL="vendor/model-id"
export PRICING_PYTHON="/absolute/path/to/pricing-harness/.venv/bin/python"
node --env-file-if-exists=.env dist/server.js
node --env-file-if-exists=.env dist/headless.js --question "Your question"
node --env-file-if-exists=.env dist/headless.js --status
```

Without `--question` or `--status`, the headless app reads JSON lines from standard input: a question as `{"text": "..."}` or `{"type": "submit", "request": {...}}`, plus `{"type": "cancel"}` and `{"type": "close"}`. It prints every event as JSON. `--pricing-only` turns off tables and charts.

## Settings

`harness.config.json` is the one editable settings file. It is validated at launch: unknown keys, invalid numbers and malformed JSON stop startup. Environment variables override file values, so remove stale model or limit variables from `.env`. `PRICING_CONFIG_FILE` selects another file; an empty value means environment variables only.

| Setting                         | Environment override              | Saved value                                                                                             |
| ------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `model.provider`                | `PRICING_PROVIDER`                | `openrouter` (`openai` also accepted)                                                                   |
| `model.id`                      | `PRICING_MODEL`                   | `deepseek/deepseek-v4.1-flash`                                                                          |
| `model.thinkingLevel`           | `PRICING_THINKING_LEVEL`          | `high` (`off`, `minimal`, `low`, `medium`, `xhigh` and `max` also accepted, if the model supports them) |
| `runtime.port`                  | `PRICING_PORT`                    | `4317`                                                                                                  |
| `runtime.maxUploadBytes`        | `PRICING_MAX_UPLOAD_BYTES`        | 2 GiB                                                                                                   |
| `runtime.duckdbMemory`          | `PRICING_DUCKDB_MEMORY`           | `4GB` (a DuckDB budget, not a cap on total memory)                                                      |
| `runtime.duckdbThreads`         | `PRICING_DUCKDB_THREADS`          | `4`                                                                                                     |
| `workflow.limits.seconds`       | `PRICING_ANALYSIS_SECONDS`        | `900` per question; the analyst is told to finish a minute early                                        |
| `workflow.limits.modelAttempts` | `PRICING_ANALYSIS_MODEL_ATTEMPTS` | `100` per question                                                                                      |
| `workflow.limits.toolCalls`     | `PRICING_ANALYSIS_TOOL_CALLS`     | `150` per question                                                                                      |

`evaluation` holds settings for the evaluation runner only: scenario manifest, evidence folder, batch time and cost limits, and an optional model used only for evaluations. The app ignores it.

Other environment-only settings:

| Variable                    | Effect                                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------------------- |
| `PRICING_MAX_OUTPUT_TOKENS` | Output cap per model call, reasoning included (default 32,000).                                         |
| `PRICING_HOOKS_OFF`         | Comma-separated hook names to switch off, for experiments (see [architecture](architecture.md)).        |
| `PRICING_FOCUS_THINKING`    | Reasoning level after the first analysis in a conversation (default `low`; `keep` leaves it unchanged). |

A provider error such as a rate limit or timeout is retried in the same session with a request to continue, at most twice per question. Usage and an estimated cost for each question are recorded in `analyses/<run>/run.json`.

## Using the app

- **Files.** Upload CSV, XLSX, TXT or MD files from the composer, or copy them into `<workspace>/files/` before launch; startup registers them without moving them. Uploads keep their original bytes. Every registered file is used for every question. Each workbook sheet becomes its own SQL table. Formula cells without saved values stay unknown, because there is no recalculation engine.
- **Definitions.** Confirm column meanings, currency, returns and cost treatment, calendar and comparison scope when asked. Confirmed facts go into `.pricing/context.md` and apply to later conversations. Guesses and findings are not saved.
- **Conversations.** The sidebar lists saved conversations, newest first; opening one resumes its analyst. Adding or changing a source, or updating the bundled skills, starts a fresh analyst session in that conversation, while the chat history stays.
- **Answers.** Tables and charts support hover, zoom, pan, legend toggles, reset, label search, numeric sort and 25-row pages, without any model requests. Blank result cells are shown as unavailable. When a conversation is reopened, tables and charts are rebuilt from their frozen files. If those files or the sources changed, a notice asks you to rerun.
- **One question at a time.** Stop cancels the question and waits for the analyst to stop. A lost connection recovers without resubmitting. A question interrupted by a restart is marked interrupted and isn't rerun automatically. Changing a source during a question fails that question.

Not included: accounts, hosted or multi-user operation, an update service, report or PDF export, automatic data cleaning, and a chart editor. Docker isn't needed.

## Evaluation runner

```bash
npm run eval:configured -- --dry-run
npm run eval:configured                       # paid: run only when intended
npm run eval:configured -- --config /absolute/path/to/experiment.json --dry-run
npm run eval:configured -- --manifest /absolute/path/to/manifest.json --dry-run
```

The runner creates a fresh workspace with only the sources, snapshots the effective settings and manifest, and keeps full responses and usage. Batch cost is checked between prompts from SDK estimates; it can't cap a request already in flight. The graded eval loop (`npm run eval`) is described in [the evals README](../tests/evals/README.md).

`node scripts/latency-report.mjs <workspace>/analyses/<run-id>` compares provider wait time (time to first token) with generation time.
