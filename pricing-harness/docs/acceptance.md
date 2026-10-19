# Test protocol and limits

## Free local checks

After macOS setup, install the pinned test dependencies and Chromium for the browser tests:

```bash
.venv/bin/python -m pip install -r requirements-dev.txt
export PLAYWRIGHT_BROWSERS_PATH="$PWD/.cache/browsers"
node node_modules/playwright/cli.js install chromium
```

Then run `npm run build`, `npm run typecheck`, `npm test`, `npm run test:python` and `npm run test:browser` from the application directory. Build first, because the packaging tests inspect the compiled app. Install Chromium with the same `PLAYWRIGHT_BROWSERS_PATH` the tests use. The browser suite drives the UI with a labelled offline fixture that runs a script against a CSV. It checks the UI, HTTP and event stream, not live model quality.

## Eval loop

How cases are written, run and graded, and what the results can and cannot show, is in [the evals README](../tests/evals/README.md). In short, `npm run eval:oracle` runs each case's solution script and grades it against its key, at no cost. It must pass before any paid run. `PRICING_MODEL=<id> npm run eval` runs the real analyst through `src/headless.ts`. Expected answers stay outside the analyst's workspace.

## Scale checks (synthetic, opt-in)

```bash
PRICING_SCALE_ROWS=3000000 PRICING_SCALE_OUTPUT=.cache/scale-3m.json npm run test:scale
PRICING_SCALE_ROWS=30000000 PRICING_SCALE_OUTPUT=.cache/scale-30m.json npm run test:scale
```

Run these natively on macOS before claiming capacity on a Mac. The fixture writes repeated patterns, prepares DuckDB storage, checks every row and independently computed totals, exports an aggregated CSV and reuses caches. Record the source width and size, host, version, timings, peak Python and DuckDB memory, and disk use. Repeated synthetic patterns compress better than real data, so results are not a promise for arbitrary customer files. Source rows are never loaded whole into pandas.

## Updating the bundled skills

Replace `bundled/pricing-plugin/` with a reviewed full tree, its licence and a matching version in `bundled/versions.json`. Startup checks that every skill and card has metadata and that every relative link resolves. Confirm that the bundle fingerprint changed (it starts a fresh analyst session in every conversation), run the free checks and the oracle, then run a paid eval wave if the change is material. There is no automatic update.

## Operating limits

- The analyst has a real shell with the user's permissions. Running the app is not an operating-system sandbox, and the write limits apply only to its file-editing tools.
- Prompts and tool results, including file excerpts, go to the configured model provider.
- The server binds to `127.0.0.1` and has no login. It refuses requests from other hosts and origins.
- A source that changes during a question fails that question. The app doesn't restore changed sources.

## Before real-data acceptance

Agree mappings and the accounting, calendar, currency, returns and group-history definitions with the data owner. Prepare a representative non-sensitive smoke case and derive its expected totals independently. Definitions used in the test data never apply to the owner's business automatically.
