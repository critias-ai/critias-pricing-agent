# Roadmap research briefing (2026-10-18)

Shared context for three research agents. Goal: decide which features Pricing Harness needs to be of realistic use to a professional, whether there is demand, and what else the architecture can be reused for.

## What the product is

Pricing Harness (public site name: critias.ai) is an open-source (Apache-2.0), local-first desktop-browser app for pricing and gross-margin analysis.

- **Interface:** React + assistant-ui chat, Fastify server bound to 127.0.0.1. One continuing analyst session per conversation; sidebar conversation history.
- **Agent:** Pi agent SDK; any model reachable through OpenRouter (user picks the model ID; no silent fallback). Single analyst session, no planner/verifier agents.
- **Data:** user uploads CSV, XLSX (explicit sheet), Markdown. DuckDB (disk-backed) via a `query` tool with typed views; Python scripts run through `execute_analysis`, which records hashes and file reads. Files up to 2 GiB.
- **Method:** 7 pinned pricing skills (intake, margin analysis, opportunity scan, recommendations, pricing design, rollout planning, question triage) + an exploration/visualisation skill. Skills are Markdown "plugin" files the model chooses to read.
- **Trust mechanism ("checked figures"):** every number in a reply (3+ significant digits) must match output printed by a script that actually ran; unmatched figures trigger one retry, then are flagged. Handoff figures are sealed into hash-bound checkpoints. Charts/tables (Plotly, native tables) bind only to executed result files.
- **Data findings:** deterministic detectors (parse, shape, domain, uniqueness, peer-ratio) flag anomalous rows; code never applies business treatments — the analyst asks the user and records confirmed treatments in `.pricing/context.md` (persistent business context).
- **Hooks/nudges:** SQL error hints, blocked package installs, append-only context, pacing.
- **Evals:** graded eval suite with synthetic datasets (106+ cases), oracle + LLM judge.
- **Platforms:** macOS and Windows (CI green on both).

## What it does NOT have today

No data connectors (no MCP, no database/warehouse/SaaS connections — files only); no export (PDF, PPTX, Excel with live formulas); no Excel formula recalculation; single user, no auth, no hosting; no scheduled/recurring runs or alerts; no sharing/collaboration; no audit-trail UI beyond internal run records; never validated on real business data; no OS sandbox for the agent's shell.

## Constraints

Solo developer. Strong preference for the simplest design that works and for reusing existing open-source pieces rather than building. Local-first and "numbers you can audit" are the current differentiators. Owner already believes an MCP connector is a high priority — **test that assumption, don't just confirm it.**

## Report format (all agents)

Write Markdown. For every finding: claim, evidence (URLs/quotes), confidence (high/medium/low). For every feature candidate:

| Field | Meaning |
|---|---|
| Feature | short name |
| Why | evidence it matters, for whom |
| Priority | P0 (blocks professional use) / P1 (strong differentiator or common ask) / P2 (later) |
| Effort | S / M / L for a solo dev |
| **Ease of integration** | existing templates, open-source libraries, MCP servers, SDKs or reference implementations that could be wired in (name, URL, licence, maturity, how it would plug into this stack: Node/TypeScript server, Python scripts, DuckDB, Pi SDK skills) |

End with: top 10 features ranked, and assumptions of the owner you found to be wrong or weak.
