# Critias

## Summary

Critias is an experimental, local-first pricing analyst: an application for pricing and gross-margin analysis. A React and assistant-ui chat interface on a Fastify server drives one continuing analyst session per conversation, built on the Pi agent SDK. The analyst works on uploaded CSV and XLSX files through DuckDB SQL and recorded Python scripts, follows seven bundled pricing skills (Pricing Plugin 0.4.12) and a visualization skill, and answers in chat with checked figures, tables and charts. It runs on macOS and Windows. Setup and usage are in the [README](README.md); the workflow is in [architecture](pricing-harness/docs/architecture.md).

## Key Decisions & Patterns

- **Local first.** Calculation runs locally and the server binds to `127.0.0.1`. Prompts and tool results go to the configured model provider (OpenAI, OpenRouter, Gemini or Anthropic, chosen in `.env`).
- **One analyst, checked output.** Each conversation has a single analyst session; there is no planner, verifier or assurance label. The harness checks that every substantial number in a reply appears in the output of a query or script that ran, and gives the analyst one chance to fix any that don't. Tables and charts come only from result files that executed code wrote, frozen with their hashes.
- **Code flags, people decide.** Seven detectors (parse, shape, domain, uniqueness, identity, time, peer ratio) flag suspect rows in CSV and XLSX sources, cached by content. SQL-level checks note mixed populations, outlier rows and offsetting returns. None of them changes data. The user chooses treatments, and the analyst records only confirmed facts in `.pricing/context.md`.
- **Constrain behaviour in code where possible.** Per-question limits on time, model calls and tool calls, hooks that hold calculation until the method has been read, an append-only rule for confirmed context, and a locked-down SQL session. The analyst's shell is not a sandbox; the docs say so.
- **Any model, never a silent switch.** `.env` sets the provider and model, and the interface sets the reasoning level per question. IDs newer than Pi's catalogue are accepted. A model that can't be selected fails the run instead of falling back.
- **Fixed skills.** The bundled skills are pinned and fingerprinted; provenance is in `bundled/versions.json`. Changing them starts a fresh analyst session.
- **Public evals.** Graded cases use synthetic data and three public datasets with credited licences. Answer keys come from solution scripts and are checked for free before any paid run.
- **No secrets or business data in Git.** Credentials stay in a local `.env`; committed data is synthetic or derived from public sources.

## Resources & Files

| Topic                           | Location                                                                                                                           |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Setup and launch                | [README](README.md), [local setup](pricing-harness/docs/local-setup.md)                                                            |
| Architecture                    | [architecture](pricing-harness/docs/architecture.md)                                                                               |
| Data definitions                | [data dictionary](pricing-harness/docs/data-dictionary.md)                                                                         |
| Test protocol and limits        | [acceptance](pricing-harness/docs/acceptance.md)                                                                                   |
| Evaluations                     | [evals README](pricing-harness/tests/evals/README.md)                                                                              |
| Verification records            | [releases](pricing-harness/docs/releases/)                                                                                         |
| Known open items                | [open items](pricing-harness/docs/open-items.md)                                                                                   |
| Release history                 | [changelog](CHANGELOG.md)                                                                                                          |
| Contributing and security       | [contributing](CONTRIBUTING.md), [security policy](SECURITY.md)                                                                    |
| Design history                  | [design](pricing-harness/docs/design/)                                                                                             |
| Third-party notices and license | [notices](pricing-harness/THIRD_PARTY_NOTICES.md), [Apache License 2.0](LICENSE); the bundled Pricing Plugin keeps its MIT licence |
