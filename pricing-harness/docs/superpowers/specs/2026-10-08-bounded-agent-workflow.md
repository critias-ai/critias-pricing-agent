# Bounded agent workflow — implementation brief

Date: 8 October 2026. Scope approved for planning in this conversation; execution is intended for a fresh session. This is a general-purpose pricing analysis workflow, not a library of predefined commercial queries.

## Intended outcome

Keep a Luna-level model as the acceptance baseline while reducing unanswered runs, repeated code generation and unnecessary report production. Brief follow-ups should receive brief answers. Substantial questions should receive checked calculations and useful complementary charts. A stage failure must not discard a previously verified, still-applicable result. Expose a short verified numerical summary/checkpoint to the user before optional report work; do not repeat the entire summary when the report is ready.

## Product workflow

One logical user conversation is owned by the controller. The coordinator makes a short work order, identifying requested scope, confirmed metric/basis, output depth, needed roles and unresolved input. The analyst creates or adapts workspace analysis code. A verifier independently checks the material numerical claims against source evidence and records an immutable verified checkpoint. An optional visualizer builds charts from the numerical packet; the same verifier checks the added visual claims/renders without repeating the entire numerical audit. The verifier can supply the concise final response, avoiding a mandatory extra synthesis agent.

This adds a numerical gate before presentation to preserve a useful answer if plotting later fails. It is a sequential v1 pipeline with four roles, not four mandatory agents on every request. A compatible, already verified result can take a quick response route. A clarification invokes no analyst/visualizer. Fresh analytical claims require verification; reuse must not invent new calculations or treat an old approval as verification of changed data.

Each role gets the original question, relevant confirmed definitions, scoped artifacts and a compact handoff. Do not forward every preceding agent's chat/tool history. SDK sessions are role-specific; the visible conversation and request ID remain stable. Stage transitions must not clear chat, reopen confirmed definitions or reset a fixed ranking. Stages run in separate directories and do not modify source files or another stage's published artifacts.

## Lightweight instructions and reuse

New role instructions: at most 150 words per role; shared workflow guidance at most 200 words. Keep detailed pricing knowledge in existing progressively read references. Add only short, explicit scope/stopping rules to bundled visualization guidance. Preserve plugin licensing/provenance; make intentional harness-bundle revisions reproducible rather than upgrading upstream skills automatically.

Do not ship domain-specific query functions, sample-data special cases or a first-run snippet library. Discover scripts produced in this workspace through a small analysis index. Entries identify code/result paths, source and artifact hashes, calculation version, scope, confirmed basis, coverage/holds and verification references. Results are reusable only when all dependencies match. Code may be adapted for a new period or source schema, but adapted/new results require execution and verification. Keep derived results separate from confirmed company facts.

## Execution policy

Provisional defaults, configurable and recorded on each run:

| Class | Whole-request deadline | Model attempts | Tool calls |
| --- | ---: | ---: | ---: |
| Quick answer / clarification | 120 seconds | 12 | 20 |
| Ordinary analysis / review | 300 seconds | 24 | 60 |
| Explicit detailed report / scenario | 600 seconds | 36 | 90 |

The budget covers all roles, retries, corrections and final delivery; it is never reset by a handoff. Reserve 20% of the deadline for verification/finalization and stop optional work before consuming that reserve. One cumulative transient-provider retry is allowed if it fits the remaining budget. Configure nested SDK/provider retries so they cannot bypass this limit. A provider retry is distinct from a semantic correction.

Allow one semantic correction round per request, addressed to the owning stage. A visual repair consumes that allowance. Maximum two render attempts and two previews for one report, including verifier-requested repairs. Count these through controller wrappers around the existing generic helpers; unrecorded rendering cannot authorize visual approval. Stop a repeated step after three identical normalized operation/result pairs without new evidence; retain a diagnostic reason rather than pretending the result is correct. Deadline enforcement and fallback cannot depend on another model call succeeding.

Retain existing run lifecycle states. Add an optional outcome identifying complete, verified partial, needs input or no verified answer; a full answer containing legitimate source-related holds is different from a budget-truncated answer. Cancellation stops every active stage and settles once, with a two-second grace before supervised work is force-stopped. Restart does not automatically replay paid work. Only controller-validated, hash-stable checkpoint artifacts can be exposed as verified; draft files remain explicitly unverified.

## Response policy

Choose depth silently from the actual question and inherited context, not prompt length alone. A narrow follow-up defaults to 50–120 words and no compulsory headings/report; a clarification asks only the blocking question. An ordinary review defaults to a short finding plus necessary table/chart and material qualifications. A requested detailed report may carry methods/audit detail as an artifact, with a concise chat summary. Word ranges are guidance, not permission to omit necessary qualifications. Match the graph to the question; prefer no graph over a redundant one. Verify actual desktop/narrow chart renders, avoiding repeated full-page screenshot-reading loops.

## First evaluation

All product roles use explicit `openai/gpt-6-luna` with reasoning `high`, through OpenRouter. No stronger fallback or lower-reasoning experiment in this pass. Run five specified scenarios/nine messages sequentially. The first three share one fresh workspace; the other two use separate fresh workspaces. Start without historical analysis scripts or evaluator answers. Reuse code generated during these conversations. Historical baseline comparisons are descriptive because prior runs had concurrency and provider interruptions; do not claim isolated causal speedup.

Run affected deterministic checks, typecheck and a build needed to exercise updated compiled code. Do not run the full live/acceptance/browser/Python/scale suites. Preserve source hashes, all returned responses, errors, role/model attempts, stage metrics, numerical verification and actual chart captures. No commit, push, publication, deployment or real pricing action is included.
