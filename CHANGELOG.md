# Changelog

All notable changes to Critias are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [0.5.1] - 2026-10-27

### Changed

- Pricing Plugin 0.4.13: the implausible-value check flags unit prices or costs at five times, or a fifth of, the item's median, the same threshold the harness checks.
- When a provider fails, the chat shows the provider's own message (wrong key, unknown model, usage limit).
- Before the first query, the analyst reads the intake skill when `.pricing/context.md` is empty or an uploaded file is a pricing context file; facts in an uploaded context file stay unconfirmed until you confirm them.

### Added

- `tests/evals/RESULTS.md`: the October 2026 benchmark, with a difficulty rating from 1 to 5 on every case.

## [0.5.0] - 2026-10-20

First public release: an experimental research preview.

### Added

- One continuing analyst session per conversation, working in DuckDB SQL over typed views of your files and in recorded Python scripts.
- Checked replies: every substantial number must appear in the output of a query or script that ran, and tables and charts come only from frozen result files.
- Seven pricing skills (Pricing Plugin 0.4.12): intake, margin analysis, opportunity scan, recommendations, pricing design, rollout planning and triage, with knowledge and method cards.
- Data findings: seven code-based detectors flag suspect rows in CSV and XLSX files before the first question. Nothing is cleaned automatically.
- Confirmed business context in `.pricing/context.md`, written only for facts you confirm.
- Conversation history in a sidebar.
- Anthropic, Gemini (Google AI Studio), OpenAI and OpenRouter. A key and a model in `.env` choose the provider, and the app never switches model by itself.
- A thinking-level selector beside Send, remembered per conversation.
- Install with `npm install -g critias` (or `npx critias`): the first start creates the Python environment in `~/.critias`.
- Setup and launch scripts for macOS and Windows.
- A headless interface and a graded evaluation suite on synthetic and public data, published with its results.
