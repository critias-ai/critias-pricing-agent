# Contributing to Critias

Thank you for helping. Critias is an open-source pricing analyst; this repository holds the application. The pricing skills it bundles live in [critias-pricing-plugin](https://github.com/critias-ai/critias-pricing-plugin).

## Before you start

- Open an issue or a [discussion](https://github.com/critias-ai/critias-pricing-agent/discussions) before a large change, so we can agree the approach first.
- Never attach real business data to an issue, pull request, test or screenshot. Use synthetic or redacted figures.
- Skill and knowledge-card changes belong in the plugin repository. `pricing-harness/bundled/pricing-plugin/` is a pinned copy.

## Set up

Follow the [README](README.md) quick start for macOS or Windows. All commands below run from `pricing-harness/`.

## Checks

Run these before opening a pull request:

```bash
npm run typecheck
npm run format:check
npm test
npm run test:python
```

`npm run test:browser` runs the Playwright tests and needs Chromium. `npm run eval:oracle` checks the evaluation answer keys without calling a model. Live evaluations call a model and cost money; they are not required for a pull request.

## Rules

- **Test the harness as it is.** When a test fails, fix the code or the test's assumptions about the data, but do not change the harness or the skills just to make one test pass.
- **Code flags, people decide.** Cleaning and data-findings code detects and counts; it never applies a business treatment on its own.
- **No figures without a source.** Anything the analyst reports must come from code that ran.
- Keep changes small and readable. One change per pull request.
- British spelling in prose (`analyse`, `behaviour`, `realisation`).
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `test:`, `chore:`).

## Licence

By contributing, you agree that your contribution is licensed under the [Apache License 2.0](LICENSE).
