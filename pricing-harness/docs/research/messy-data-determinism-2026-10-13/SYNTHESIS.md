# Synthesis: messy data and deterministic work

Date: 2026-10-13. Inputs: workstream files `01` to `06` in this folder, `CONTEXT.md`, the 2026-10-13 slow-run diagnosis, and the bundled `pricing-intake` skill. This is research only; no harness code has changed.

## The answer in one paragraph

The surveyed systems that work well do not ask the model to discover the data. They prepare it in advance: keys, grain, joins, defined measures, known problems and agreed handling, all built or confirmed once and then retrieved. The model's job shrinks to choosing what to compute and explaining it. Code then checks the arithmetic and decides when the work is finished. Our harness does the opposite. Every cold stage gets 37 KB of column statistics and rediscovers the defects in ad hoc Python. It decides by itself when to stop, and a second LLM recomputes the result. The research supports moving three jobs into code: **data preparation at upload**, **checking figures**, and **deciding when to stop**. It also supports a short, pre-filled onboarding step that records what code cannot infer. These changes are general-purpose because they are driven by profiling results, not by dataset-specific rules.

## How strong the evidence is

The direction is consistent across all six workstreams, but most numbers are thin:

- Accuracy gains from prepared context come from vendor-run studies with 11 to 13 questions (Databricks 0 → 54 → 77 → 100 %; dbt 64.5 → 90 % from modelled tables, `01`, `03`).
- Three measured results bear directly on our symptoms:
  - Models miss silent defects about 60 % of the time regardless of model tier (SARC-DQ, `01`).
  - Removing an LLM critique loop raised pass rate from 61 to 68 % and cut time from 357 s to 133 s (ADP-MA, `04`).
  - Self-correction without external feedback lowers numeric accuracy (Huang et al., `06`).
- Several 2026 preprints were read only as abstracts or search summaries. Each file's section 6 lists them.
- No source compares typed operations with free Python on dirty data. No source measures an onboarding interview for data agents. No source splits our latency into prompt processing and decoding.

So the ranking below is a hypothesis to test on our own benchmark, not a settled result (`04`: scaffold effects can exceed model effects and reverse rankings).

## Target split: what code does, what the model does

| When | Code (deterministic) | Model |
|---|---|---|
| **Upload / file change** | Profile each file in one scan. Infer keys, grain and joins, tolerating dirty keys. Run the defect checks and write the **issue register** with stable IDs, value at stake, severity and default handling. Build the **prepared view**: exact repeats removed, dimension keys made unique, an as-of cost with a status column, and a row-count ledger. Record a hash on every entry. | One-line descriptions of notes, cached by hash (optional). |
| **Onboarding (once per workspace)** | Pre-fill proposed answers from the profile: candidate revenue and cost fields, currencies, units, sign conventions, period coverage, and sources that disagree. | `pricing-intake` asks at most five confirmations and records them. |
| **Plan** | Give the coordinator a 1–2 KB index: sources, grain/join map, register headlines and note titles. Resolve periods ("last five complete quarters", partial-period labels). | Choose the requested results and name the source, note and issue IDs they need. |
| **Analyse** | Send only the chosen slices. Apply stored decisions and defaults in the prepared view. Shape tool output (caps, summaries, "how to narrow" hints). | Write the query or Python over the prepared view and state the claims. |
| **Check** | Run identities, partition and ledger sums, and figure binding. Classify any residual against the register. Certify a ranking with bounds ("leader's worst case beats every rival's best case"). Decide when the work is done. | — |
| **Exception** | Route to the LLM verifier only for semantic-fit risk: a claim with no compiled check, an unexplained residual, an unresolved high-severity issue with no decision, or a question outside the confirmed definitions. | Narrow brief: definition, filter, period and scope. No re-doing the arithmetic. |
| **Ask the user** | Recompute under each candidate handling. Same answer → assume and disclose. Bounded difference → give a bounded answer. Material difference with no stored decision → ask once and store the answer. | Phrase the question with a pre-selected default. |

## Defect classes in the sample pack, and where each is handled

| Defect | Detected by (`02`) | Default handling (code) | User decision needed? |
|---|---|---|---|
| Duplicate master keys → join fan-out | `key_dup`, `fanout` | Collapse identical payloads; refuse a fan-out join | Only if the duplicate payloads differ |
| Identical repeated source rows | `row_dup` | Report; keep them unless the user confirms they are repeats (the readiness note says not to delete silently) | Yes, once: "dedupe exact repeats?" |
| Missing customer IDs | `required_null` | Keep the rows; show them as "unidentified" in per-customer views | No |
| Credit / negative lines | `sign_mix` | Keep them signed | No |
| Sales with no effective cost | `interval_gap` + coverage | `bound_uncovered`: report coverage and bound the missing value | Only if the bound changes the answer |
| Blank cost values | `required_null` on the cost table | Status `no_cost`; then as above | As above |
| Overlapping cost intervals | `interval_overlap` | Status `overlap`; hold the affected lines and bound | Yes if material: a selection rule |
| PACK units / EUR in a GBP field | `unit_conflict` (heuristic) | Status `unusable_unit`; exclude and bound | Yes if material: the conversion meaning |
| Duplicate business events | `row_dup` on business key | Count once if the payload is identical | Only if the payloads differ |
| Rebates at `product_id=ALL` | Grain mismatch against the product grain | Use the invoice-margin basis and name it as such | Yes, when a net-margin SKU or category view is asked for: the allocation rule |
| Ledger vs `finance_monthly` mismatch | `no_tie` (heuristic) | Classify the residual; listed as "ok" in the register when within tolerance | No, unless unexplained and material |
| Partial last period | `partial_period` | Label it partial; exclude it from "complete" windows | No |
| Classification conflict (`POST` as merchandise) | Cross-source conflict (heuristic, `no_tie`-related) | Run the relevance gate. If the answer depends on it, ask once | Yes, once; it is a business call |

Most defects need no user input. The few that do are asked once and stored, so every later run handles them the same way. This addresses the "different judgement on the same data" finding.

## Your onboarding question

**Recommendation: yes, but as "code builds the map, the interview confirms it", not as an open conversation.**

What `05` found, together with the other files:

- Products split context into a small always-on part and on-demand notes found by short trigger descriptions (Hex, Devin, Cursor, Claude Code). We should copy that routing.
- Prose overviews do not help. The one measured study found generic AGENTS.md overviews added more than 20 % cost with no gain. The map should be structured facts and pointers, not a summary.
- Reviewing is the expensive part. Snowflake reported that 50 separate suggestions caused decision fatigue. The interview should therefore be short and pre-filled, and most questions about individual defects should wait until a question actually runs into them.

**How this compares with today's `pricing-intake`:**

| | Today | Proposed |
|---|---|---|
| Trigger | The model chooses to read the skill | Automatic on first upload, and again when a file hash changes |
| What it asks | Open questions: "which field represents each measure" | Up to five pre-filled confirmations: measures; currency and units; credits and rebates; period conventions; which source wins on conflict |
| Where facts come from | The model reads the profiles and docs | Code proposes candidates from the profile and register |
| What it stores | Prose facts in `.pricing/context.md` | Business facts stay in `context.md`. Data-handling decisions go in a small machine-readable file keyed by issue ID, so code can apply them |
| Map of the workspace | None; each stage starts cold | Code-built index (sources, grain, joins, register, notes) with hashes; 1–2 KB reaches the coordinator |
| Defect handling | Rediscovered per run | Default per defect class. Asked once at first contact when material. Stored |
| Staleness | No tracking | An entry is invalidated when the hash of its source changes. A decision is flagged for reconfirmation, not silently reused |

The existing confirmation rules in `pricing-intake` (save nothing until confirmed; documents and silence confirm nothing) stay as they are. They match what every surveyed product does.

## Ranked change list (simplest first)

Each item has its expected effect and how we would see it. All measurements use one benchmark (item 0).

| # | Change | Source | Expected effect | Status |
|---|---|---|---|---|
| 0 | **Benchmark first.** Use the six-turn Lighting & Candles conversation plus about 10 short questions with reference answers from the readiness note. Run each on Luna, a Sonnet-class and a Flash-class model, 2–3 runs each. Record wall time, time to first token and output tokens per stage, turns, cost, correctness and run-to-run agreement. | 01, 04, 06 | Establishes whether our time is prompt processing or decoding, which decides the priority of items 2 and 5 | Adopt |
| 1 | **Code-owned stopping and residual classification.** Deliver once claims pass the checks. Classify residuals as rounding, explained by an issue, trivial, disclosed or escalate. Only "escalate" goes to review. Hard cap on analyst rounds. | 04, 06 | Removes the "chases its own diagnostics" minutes and most verifier passes | Adopt |
| 2 | **Effort per stage, stable prompt prefix, tool-output shaping, and a nudge when a model emits no action.** | 04 | Fewer output tokens; better cache hits; fewer protocol failures on Flash-class models | Adopt |
| 3 | **Profiler and issue register at upload**, replacing the 37 KB profiles in prompts with the register plus a grain/join map (about 2–3 KB) and an `issue_detail` lookup. Include "ok" lines for checks that passed. | 02 | Shorter prompts; the model starts from known defects instead of rediscovering them | Adopt |
| 4 | **Prepared view** that applies defaults and decisions: unique dimensions, an as-of cost with a status column, a row-count ledger. Repeats are kept unless a decision is stored. | 03, 02 | The biggest measured accuracy lever (dbt 64.5 → 90 %); the same handling every run | Adopt |
| 5 | **Workspace map plus pre-filled onboarding plus a decision store**, with each WorkOrder naming the source, note and issue IDs it needs. Stages see only those slices. | 05, 01 | Less context per stage; consistent handling across runs; questions asked once | Adopt |
| 6 | **Deterministic checks in the controller.** Identities, partition and ledger sums, top-N equals the table order, and figure binding (delivery already binds figures to claim IDs; extend this to every numeric token). The LLM verifier runs only on the risk triggers listed above. | 06 | Most runs skip the 100–180 s verifier pass | Adopt |
| 7 | **Bound-before-hold in code.** Certify top-1/top-N rankings with worst-case bounds and record the cost-range assumption as a decision. The 0.4.1 skill already says this in prose; code makes it the same every run. | 05 | No more holding answers that are provable | Adopt |
| 8 | **Relevance gate for ask / assume / bound.** Start with ranking stability only. | 05 | Fewer, better clarification questions | Try |
| 9 | **Typed query object** (measure, group-by, filters, period, basis) compiled over the prepared view, with free Python as a fallback. It also provides a compiled reference plan for checking. | 03, 04, 06 | Consistency and speed on common questions. Gate it on a typed-vs-Python comparison on the benchmark | Try |
| 10 | **Period resolver and value matcher** for categories and SKUs. | 03 | Removes recurring drift on "last N complete quarters" and name matching | Try |
| 11 | **Minimal scaffold profile for Flash-class models** (no critique, no extra planning). Add pieces back one at a time. | 04 | Small models may do better with less | Try |
| 12 | **One preventive "what could invalidate this answer" planning line**, only after item 1. | 01 | Better caveats on small models (single workshop paper) | Try |

Items to skip, agreed across files: adopting dbt, Cube, Looker, Malloy, Wren, Great Expectations, Soda or ydata-profiling as dependencies; LLM-written data-quality rules at runtime; self-updating memory; multi-candidate generation, voting and multi-LLM committees; LLM judges for arithmetic; asking about every defect up front; prose workspace overviews.

## Where the workstreams disagree

- **Typed operations.** `03` says adopt; `04` says try and gate it on a comparison. I side with `04`. The prepared view (item 4) gets most of the measured gain without changing the action space, and the dbt study shows a hard 0 % outside the typed scope. Build the view first, then compare.
- **Where decisions live.** `02` suggests `.pricing/context.md` keyed by issue ID; `05` suggests a separate decision store. Code has to read and apply decisions, so I recommend one small machine-readable file next to `context.md`, written only by `pricing-intake`. `context.md` stays the prose record of business facts. This is the simplest form that code can apply reliably.
- **Repeats.** `02`'s sketch defaults exact repeats to `dedupe_exact`. The readiness note says not to delete repeat candidates silently. I recommend keeping them by default and making deduplication a one-time decision.
- **Upfront planning vs no planning.** `01` suggests a preventive risk-listing step; `04` warns that extra scaffolding hurts small models. They are compatible if planning is one line and comes after code-owned stopping, which is why it is ranked last.

## Open questions to settle by measurement

1. How our 96 % inference time splits between prompt processing and decoding, per stage and per model (item 0).
2. Whether typed operations beat free Python on our data for each model tier (item 9).
3. The precision of the heuristic checks (unit/currency conflicts, tie-out discovery, classification conflicts) on a second, differently shaped data pack, so they are not tuned to Northbridge.
4. What residual tolerance to use. Audit standards give an ordering (trivial < tolerable < material) but no number. A per-workspace setting confirmed at onboarding is the simplest option.
5. Whether DuckDB sums are identical across thread counts for our column types (`06`; test once).

## Suggested next step

Item 0 (benchmark) and item 1 (code-owned stopping and residual classification) are small and independent. They would show quickly how much time is left to win. Items 3–5 are the larger structural change: register, prepared view and onboarding. They deserve their own design doc before any code. Nothing here is approved for implementation yet.
