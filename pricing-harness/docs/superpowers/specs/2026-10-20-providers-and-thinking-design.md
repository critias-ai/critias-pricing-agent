# Providers from .env and a thinking-level control

Date: 2026-10-20. Approved by the owner in chat the same day.

## Goal

Anthropic and Gemini (AI Studio) work next to OpenAI and OpenRouter. Which one answers is decided only by `.env`. The user picks the thinking level in the UI.

## Providers

- `PROVIDERS` gains `anthropic` and `google`. Pi already ships both with model catalogues.
- `.env` holds a key and a model per provider.

| Provider | Key | Model |
|---|---|---|
| openai | `OPENAI_API_KEY` or a stored ChatGPT login | `OPENAI_MODEL` |
| openrouter | `OPENROUTER_API_KEY` | `OPENROUTER_MODEL` |
| google | `GEMINI_API_KEY` | `GEMINI_MODEL` |
| anthropic | `ANTHROPIC_API_KEY` | `ANTHROPIC_MODEL` |

- A provider is configured when its model variable is set and Pi reports credentials for it (`hasConfiguredAuth`).
- The first configured provider in the order openai, openrouter, google, anthropic is used.
- `PRICING_PROVIDER` and `PRICING_MODEL` override the choice (evals, scripted runs).
- `harness.config.json` no longer holds `model`. Provider and model come only from the environment. The `evaluation` block is unchanged.
- With nothing configured, the health message names the variables to set.
- `/api/status` reports the chosen provider and model. Costs: OpenRouter keeps its live price lookup, the others use Pi's catalogue.

## Thinking level

- Default is `medium`. When the model does not support it, the nearest supported level is used (searching down first, then up).
- `PRICING_THINKING_LEVEL` stays as an optional override for scripted runs.
- `/api/status` adds `thinkingLevels` (the model's supported levels, from its `thinkingLevelMap`) and `defaultThinkingLevel`.
- The composer gets a selector beside Send. The choice is remembered per conversation in the browser and sent with each question as `thinkingLevel`.
- The server accepts only levels the model supports, uses the level for that run's sessions and records it on the run.

## Tests

Unit: provider choice (order, one configured, none, override), default level mapping, request validation. Browser: the selector shows the supported levels and the chosen level reaches the request. No live provider calls are made in tests; the owner checks Anthropic and Gemini live with real keys.

## Docs

`.env.example`, README, `docs/local-setup.md`, and the install page on critias.ai.
