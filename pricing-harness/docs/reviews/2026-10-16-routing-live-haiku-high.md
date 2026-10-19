# Routing cases live: Haiku 5.5 high, plugin 0.4.9 against 0.4.8

Date: 2026-10-16. Model `anthropic/claude-haiku-5.5`, thinking high, through OpenRouter. Judge
`deepseek/deepseek-v4.1-flash`. Harness and data findings at `dbe6ea2`, with the plugin as the only difference: 0.4.8
from `066fc50`, in a separate checkout. One run per case, so a single case flipping is within noise.

Runs: `.cache/evals/live-2026-10-16T19-23-05-440Z` in each checkout.

## Result

|                                      | 0.4.9         | 0.4.8         |
| ------------------------------------ | ------------- | ------------- |
| Passed, as reported live             | 8 of 11       | 7 of 11       |
| Passed, after the grader fixes below | **9 of 11**   | **9 of 11**   |
| Model calls per case                 | 10.3          | 10.7          |
| Seconds per case                     | 40            | 43            |
| Output tokens, all 11 cases          | 63.7k         | 72.6k         |
| Cache reads / writes                 | 2.10M / 0.40M | 2.29M / 0.42M |

The harness priced every run at $0: Haiku 5.5 is newer than Pi's bundled price list, so `--max-usd` could not stop a
run. The token counts above are the cost record. The OpenRouter dashboard has the actual charge.

| Case                 | 0.4.9    | 0.4.8    | Why it failed                                                                                                                                                               |
| -------------------- | -------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| rt-intake-setup      | pass     | pass     |                                                                                                                                                                             |
| rt-intake-remember   | pass     | pass     |                                                                                                                                                                             |
| rt-intake-correct    | pass     | **fail** | 0.4.8 never opened pricing-intake and saved nothing.                                                                                                                        |
| rt-intake-negative   | pass     | pass     |                                                                                                                                                                             |
| rt-triage-vague      | pass     | pass     | 0.4.8 was first scored a fail for not opening pricing-triage, which is preloaded (fix 4).                                                                                   |
| rt-triage-definition | **fail** | **fail** | Both queried the data to work out the company's own margin and markup, which made them open pricing-analyze. The definitions themselves were right and labelled as general. |
| rt-scan              | pass     | pass     |                                                                                                                                                                             |
| rt-recommend         | **fail** | pass     | 0.4.9 read only price-change-economics: no pricing-recommend, no evidence-ranking.                                                                                          |
| rt-design            | pass     | pass     |                                                                                                                                                                             |
| rt-execute           | pass     | pass     |                                                                                                                                                                             |
| rt-visualize         | pass     | pass     |                                                                                                                                                                             |

0.4.9 fixed one case and lost one. With one run each, the versions are level.

**Decision after this run:** the plugin stays as it is, and applying a definition to the company's own figures is
allowed. rt-triage-definition is now graded by its rubric only, which both runs pass, so both versions score 10 of 11.
The only remaining failures are 0.4.9 rt-recommend and 0.4.8 rt-intake-correct.

## What the runs show about the plugin

- **The triage skill is never opened, because it is preloaded.** `src/agent/workflow/stage-prompt.ts` puts
  pricing-triage, the shared rules and metric verification into context at the start. Routing happens from there.
- **pricing-analyze is opened because of a harness hook.** It was read in 15 of the 22 runs, including the design,
  intake and visualize cases. The `skill-read` hook in `nudges.ts` blocks the first query until a task skill and a
  knowledge card have been read, so whenever the model decides to calculate, it opens a skill first, and analyze fits
  most calculations.
- **Definition questions get calculated anyway.** In both definition runs, the model answered with the general
  definitions and then worked out the company's own margin and markup from the data. Triage's step 2 says to keep
  factual answers short, but nothing says not to calculate. That is the one plugin change this run supports.
- **Intake is reached when the user confirms something.** It was opened in 5 of the 6 runs that needed it. The one miss
  (0.4.8, "K07 is a clearance line") treated the correction as an analysis point.

## How the model worked

- **Step size:** short. 5 to 23 model calls per case, most of them a single query or read. No case came near the 900 s
  or 150-tool limits.
- **Tool pattern:**
  - read the skill, then query, then answer;
  - the knowledge index is opened before a card in 6 of 22 runs;
  - definitions still trigger a query of the data.
- **Cards per case:** 0 to 3, so no bulk-reading.

## Grader fixes this run exposed

1. **`keep` counted the context header's `Last updated:` date as a reworded fact.** The intake format requires that
   date to change. It now ignores that line. This turned a correct 0.4.9 intake-correct, and a correct 0.4.8
   intake-remember, from fail to pass.
2. **Judge quotes failed to match on Markdown and "...".** The judge quoted correctly but dropped list bullets and
   bold marks, or shortened its quote with "...". Quotes are now compared as plain words, part by part. Re-judging
   both triage-definition replies gave a pass on both rubric items. Those cases still fail on routing and on the
   query.
3. **The judge's raw answer is now saved with each run,** so a later grading fix can re-score it without another call.

The paid judge oracle (`--oracle --judge`) has still not been run. It would have caught fix 2 before a live run. 4. **A must-read on a preloaded file can never pass.** The triage cases required opening pricing-triage, which is
already in context. Those assertions are removed, and `tests/unit/eval-cases.test.ts` now rejects a must-read of
any preloaded file.
