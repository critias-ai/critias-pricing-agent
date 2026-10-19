# Security policy

## Supported versions

Only the latest release on `main` receives fixes.

## Reporting a vulnerability

Please do not open a public issue.

- Preferred: [report it privately on GitHub](https://github.com/critias-ai/critias-pricing-agent/security/advisories/new).
- Or email **hello@critias.ai** with "Security" in the subject.

Include what you found, how to reproduce it and the impact you expect. We aim to reply within five working days and will keep you updated until it is resolved. We credit reporters who want to be named.

## Scope

In scope:

- The local server (it binds to `127.0.0.1`), its HTTP API and file uploads.
- The SQL session, the analyst's tools, and anything that lets a file, a prompt or model output read or write outside the workspace.
- Leaks of credentials from `.env`, or of workspace data to anywhere other than the configured model provider.
- The setup and launch scripts.

Known limit: the analyst's shell is not a sandbox. It runs with your user's permissions, as [architecture](pricing-harness/docs/architecture.md) explains. Reports that show a way round the documented guards are welcome.

Out of scope: how your model provider handles prompts and data, which its own policy governs.
