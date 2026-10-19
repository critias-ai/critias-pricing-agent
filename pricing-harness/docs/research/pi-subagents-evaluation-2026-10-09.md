# pi-subagents fit for Pricing Harness

Date: 2026-10-09. Quick source/document review of upstream `main`; no installation, execution, model calls, or integration testing. Upstream `main` includes unreleased changes, so these capabilities must be checked against a pinned release before adoption.

## Recommendation

**Useful as a possible child-agent execution layer; not a replacement for this application's pricing workflow controller.** The extension already addresses much of the generic work involved in launching, observing, cancelling, and collecting multiple agents. A small integration experiment is warranted before writing more generic orchestration infrastructure. A rewrite now would risk exchanging working application controls for a new integration problem.

The present reliability bottleneck is evidence handoff and domain verification, including the visual verifier's checkpoint-read requirement. A different launcher does not itself make financial analysis correct or resolve those contracts. This conclusion is an inference from the project's recorded evaluations and controller implementation.

## What it could replace

- Scripted JavaScript workflows support explicit sequencing (`runs.run`), parallel fanout (`runs.all`), branching and bounded review loops. Adoption need not let a model improvise the stage order. It still requires workflow code; the reusable layer is child execution and coordination. Older top-level chain interfaces have been replaced in the current public API. [Workflows](https://github.com/nicobailon/pi-subagents/blob/main/docs/workflows.md)
- Structured outputs and typed command gates provide useful machinery around stage contracts. Lifecycle artifacts, retained children, streaming progress, stop/resume and usage reporting could reduce custom infrastructure. [Tool reference](https://github.com/nicobailon/pi-subagents/blob/main/docs/tool-reference.md), [Extension APIs](https://github.com/nicobailon/pi-subagents/blob/main/docs/extension-api.md)

## What stays application-owned

Pricing scope/period continuity, source hashes, independent executed numerical checks, latest-execution identity, immutable evidence, verified checkpoints, partial publication, protected output paths and browser downloads remain domain requirements. JSON matching a schema is not evidence that its numbers are right. The existing controller should continue deciding what can be published and approved.

The extension's workflow usage budget counts completed children and rejects subsequent launches after exhaustion; it does **not** interrupt already-running children. Timeout and tool controls exist, but equivalence to the harness's request-wide model-call limits, finalization reserve, shared repair budgets and cancellation accounting is unproven. [Workflow controls](https://github.com/nicobailon/pi-subagents/blob/main/docs/workflows.md#scripted-workflows)

## Integration and maturity risks

The harness embeds Pi SDK `1.0.4`, deliberately disables general extension loading, and supplies custom stage tools. Upstream declares broad Pi peers but its checked-in development dependencies target `0.87.0`. This establishes neither incompatibility nor tested compatibility with the harness. [Package metadata](https://github.com/nicobailon/pi-subagents/blob/main/package.json)

Integration APIs exist: event-bus RPC handles detached async execution, while structured delegation handles foreground leaves with correlated identities, cancellation, usage and schema-validated results. Delegation requires an active extension context and configured agents; it is not a standalone orchestration-library call. Custom tool discovery and event translation into the React/Fastify UI need proof. Capability restrictions are not an operating-system sandbox. [Extension APIs](https://github.com/nicobailon/pi-subagents/blob/main/docs/extension-api.md)

The project is substantial and ships unit/integration tests, but current workflow migrations and unreleased result-consumption race fixes indicate integration churn. Pin a release and test lifecycle behavior; popularity alone does not establish production suitability. [Package scripts](https://github.com/nicobailon/pi-subagents/blob/main/package.json), [Changelog](https://github.com/nicobailon/pi-subagents/blob/main/CHANGELOG.md)

## Small decision experiment

Keep `WorkflowOrchestrator`, validators, budgets and publication unchanged. Prototype a replaceable stage-runner adapter with two synthetic stages. Check exact model/thinking preservation, custom tool availability, structured results, usage events, cancellation during a tool and timeout/failure cleanup. Adopt only if this demonstrably deletes meaningful generic code without weakening evidence or budget controls. Do not run paid live evaluations without new authorization.

## Local evidence reviewed

- `PROJECT_GUIDE.md`
- `pricing-harness/package.json`
- `pricing-harness/src/agent/session.ts`
- `pricing-harness/src/agent/runs.ts`
- `pricing-harness/src/agent/workflow/orchestrator.ts`
