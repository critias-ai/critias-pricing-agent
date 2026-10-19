# 04. Harness design for small and fast models

Date: 2026-10-13. Workstream 4 (wave 2). Builds on files 01 to 03; does not repeat them.

Tags used below: **[measured]** = reported experiment or ablation in a paper or benchmark; **[vendor]** = vendor docs or vendor-run claim; **[anecdote]** = engineering blog or experience, no ablation; **[secondary]** = I saw only a search-engine summary, not the primary text.

## 1. Summary

- **Small and fast models mostly fail at the protocol, not at the analysis.** On the Data Agent Benchmark (DAB), Gemini-2.5-Flash returned no tool call in 63.4% of its failed trials, and Kimi-K2 had 6.6% runtime errors ([DAB, arXiv 2603.20576](https://arxiv.org/html/2603.20576v1)) [measured]. In KramaBench, code that broke the required function contract crashed 40% of GPT-4o runs and 31.7% of Gemini 2.5 Pro runs, against 0% for DeepSeek-3.2 ([ADP-MA, arXiv 2602.00307](https://arxiv.org/html/2602.00307)) [measured]. A harness for cheap models should treat "malformed or missing action" as its main failure class and design the interface around it.
- **More scaffolding does not reliably help small models, and sometimes hurts.** In DSBench, wrapping models in AutoGen helped GPT-4o (+6.0 points) but hurt Llama3-8b (-6.2); OpenAI's Code Interpreter wrapper lowered GPT-4o-mini by 6.0 ([DSBench, arXiv 2409.07703](https://arxiv.org/html/2409.07703v3)) [measured]. Lightweight harnesses had the best cost-performance in AgenticDataBench ([arXiv 2607.01647](https://arxiv.org/html/2607.01647)) [measured]. The cheapest wins come from removing work, not adding agents.
- **The best-evidenced fix for "chases its own diagnostics" is to take the stopping decision away from the model.** In the one ablation I found that removes a critique loop, dropping the LLM critique raised pass rate from 61% to 68% and cut time from 357 s to 133 s; dropping critique and refinement together gave 64% in 25 s (a 14x speedup) ([ADP-MA](https://arxiv.org/html/2602.00307)) [measured, single-table queries, one model]. The opposite failure exists too: weaker or low-effort models stop early (58% of DDR-Bench errors were insufficient exploration; [arXiv 2602.02039](https://arxiv.org/html/2602.02039)) [measured]. So stopping must be rule-based, not left to model mood in either direction.
- **Typed operations beat free code in the one controlled comparison I could find, but that comparison is on table QA, not dirty pricing data.** AutoPrep's tool-augmented programmer scored 66.1 / 87.9 / 50.1 on WikiTQ / TabFact / TabBench against 62.8 / 82.0 / 47.3 for free code generation, with error rate falling from about 4.5% to 0.05-1.5% ([AutoPrep, arXiv 2412.10422](https://arxiv.org/html/2412.10422)) [measured]. The CodeAct paper points the other way for strong models, and its gain "widens as the capabilities of the LLMs increase" ([CodeAct, arXiv 2402.01030](https://arxiv.org/html/2402.01030)) [measured, 2024 models]. No source tests either on defects like ours.
- **Interface details move scores by several points each.** In SWE-agent's ablations (GPT-4 Turbo, SWE-bench Lite, 18.0% baseline): a 100-line file window beat the full file by 5.3 points and 30 lines by 3.7; summarized search beat iterative search by 6.0; keeping only the last 5 observations beat full history by 3.0; a syntax-checking edit tool added 3.0 ([SWE-agent, arXiv 2405.15793](https://arxiv.org/html/2405.15793v3)) [measured]. These map directly onto tool-result shaping.
- **Thinking effort is not a free dial.** Longer reasoning helps up to a point, then hurts: one study saw 82.2% to 87.3% as average thinking grew from 385 to 1,100 tokens, then 70.3% at 15,980 ([arXiv 2506.04210](https://arxiv.org/pdf/2506.04210)) [measured, math]. In agentic tasks, higher overthinking scores tracked lower resolution, and adding native function calling lifted o1 from 29.1% to 47.7% while overthinking fell ([arXiv 2502.08235](https://arxiv.org/html/2502.08235)) [measured, SWE-bench]. Effort should be set per stage and held constant to keep the prompt cache.
- **Latency has two separate levers.** Prompt caching cuts input processing and cost (reads at 0.1x or less of base input price) but "does not change output generation" ([Anthropic prompt caching docs](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)) [vendor]. Wall time dominated by model inference (our 96%) is mostly decoding thinking and code, which only effort, shorter outputs and fewer turns reduce. This split is my inference from the docs; no source measures it for our workload.
- **Benchmark numbers for scaffolds are fragile.** An audit of tau-bench found scaffold choice moved one model's reward by up to 0.267 and reordered models, with a larger effect than model choice ([arXiv 2609.09218](https://arxiv.org/html/2609.09218)) [measured, n=15 per cell, exploratory]. Our own six-turn comparison needs the same care: fix the harness, vary one thing.

## 2. Systems and sources examined

| Source | Date | What it shows | Type |
|---|---|---|---|
| [SWE-agent ACI](https://arxiv.org/html/2405.15793v3) | 2024 | Ablations of edit, search, window size, history | measured |
| [Anthropic, Building effective agents](https://www.anthropic.com/engineering/building-effective-agents) | 2024 | Simplest workable design; ACI deserves effort; absolute paths fixed a class of errors; max-iteration stops | vendor/anecdote |
| [Anthropic, Writing tools for agents](https://www.anthropic.com/engineering/writing-tools-for-agents) | 2025 | Few, consolidated tools; concise vs detailed responses (72 vs 206 tokens in their example); actionable errors; 25k-token tool-result cap in Claude Code | vendor, anecdote |
| [Anthropic, Effective context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) | 2025 | Minimal tool sets, just-in-time retrieval, tool-result clearing; no own numbers | vendor |
| [Manus context engineering](https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus) | 2025 | KV-cache hit rate as top metric; stable prefix; do not change tools mid-run; keep errors visible | anecdote (only the 10x cached-price gap is a number) |
| [LangChain, Context engineering](https://www.langchain.com/blog/context-engineering-for-agents) | 2025 | Write/select/compress/isolate taxonomy; cites a "3-fold" tool-selection gain from retrieving tool descriptions | secondary survey |
| [CodeAct](https://arxiv.org/html/2402.01030) | 2024 | Code vs JSON vs text actions on 17 LLMs | measured |
| [AutoPrep](https://arxiv.org/html/2412.10422) | 2024 | Typed tool operations vs free code for table prep | measured |
| [DABstep](https://arxiv.org/html/2506.23719) | 2025 | Hard multi-step tasks; best base model 14.55% Hard; small models far lower | measured |
| [DAB](https://arxiv.org/html/2603.20576v1) | 2026 | Failure taxonomy over 1,147 wrong trajectories; cost and latency per model | measured |
| [DSBench](https://arxiv.org/html/2409.07703v3) | 2024 | Plain model vs AutoGen vs Code Interpreter across model sizes | measured |
| [ADP-MA / KramaBench](https://arxiv.org/html/2602.00307) | 2026 | Deterministic monitor; critique/refinement ablation; crash rates by model | measured |
| [AgenticDataBench](https://arxiv.org/html/2607.01647) | 2026 | Four harnesses x three large models; general lightweight harnesses beat the specialised one | measured |
| [DDR-Bench](https://arxiv.org/html/2602.02039) | 2026 | Qwen3-4B 24.97, Qwen3-30B-A3B 28.13, GPT-5-mini 34.61; premature termination; memory scaffold did not help | measured |
| [Overthinking in agentic tasks](https://arxiv.org/html/2502.08235) | 2025 | Overthinking score vs resolve rate; function calling effect | measured (paper has internal numeric inconsistencies) |
| [Chroma, Context rot](https://trychroma.com/research/context-rot) | 2025 | 18 models degrade with input length even on simple tasks | measured (vendor with retrieval product) |
| [Claude effort docs](https://platform.claude.com/docs/en/build-with-claude/effort) | 2026 | Effort changes tool-call count and thinking; per-model starting points | vendor |
| [OpenAI prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching) | 2026 | Automatic; stable prefix first; keep tool order stable | vendor |

## 3. Patterns

### P1. Code-owned stopping and bounded repair
- **Moves from LLM to code:** the decision "is this good enough, should I check more?". Rule-based thresholds on execution metadata decide to stop, retry or escalate.
- **Evidence:** ADP-MA's monitor and early-stop validator are deterministic, "zero-cost" and make no LLM calls; its ablation shows critique cost 7 points and 224 s on simple queries ([ADP-MA](https://arxiv.org/html/2602.00307)) [measured]. Anthropic recommends a maximum-iteration stop and checkpoints ([Building effective agents](https://www.anthropic.com/engineering/building-effective-agents)) [vendor]. The agentic overthinking paper names "analysis paralysis" and "rogue actions" as the failure patterns ([arXiv 2502.08235](https://arxiv.org/html/2502.08235)) [measured].
- **Cost:** low. A turn cap, a repair-round cap and a "claims pass controller checks, so deliver" rule. Risk: stopping too early on hard questions, so gate by complexity as the ADP-MA authors suggest.

### P2. Shrink and shape what the model sees each turn
- **Moves:** retrieval and summarisation from the model's reading to code.
- **Evidence:** SWE-agent's 100-line window, summarized search and last-5-observations results (above) [measured]. Chroma: models did far better with a focused ~300-token prompt than the full ~113k-token one on LongMemEval, and one distractor already lowered accuracy ([Chroma](https://trychroma.com/research/context-rot)) [measured]. Anthropic: concise vs detailed response mode, pagination and truncation with a hint on how to narrow, actionable error text ([Writing tools](https://www.anthropic.com/engineering/writing-tools-for-agents)) [vendor/anecdote]. "Lost in the middle" reports a U-shaped position effect ([Liu et al., arXiv 2307.03172](https://arxiv.org/abs/2307.03172)) [secondary: I saw only summaries; some quoted numbers conflict].
- **Cost:** low to moderate. Row caps, column caps, a standard result summary (shape, nulls, top rows), error messages that say what to do next.

### P3. Few, non-overlapping tools; poka-yoke arguments
- **Moves:** tool-selection and argument-format burden.
- **Evidence:** Anthropic calls bloated tool sets "the most common failure mode" they see [vendor, unquantified]. RAG-MCP reports selection accuracy 43.13% against 13.62% when retrieving a tool subset instead of listing all ([arXiv 2505.03275](https://arxiv.org/html/2505.03275v1)) [secondary, large catalogs only]. OpenAI's data-agent lesson (about 40 tools conflicted, 13 worked) is already in file 01. With 3 to 6 tools we are far below any published degradation range; StackOne notes nobody has published a break point ([StackOne](https://www.stackone.com/blog/agent-tool-count-ceiling/)) [anecdote].
- **Cost:** none to low. The risk to remove is a model emitting a full program in prose instead of a tool call; ConDABench found open models "prefer generating programs" over calling tools ([ConDABench, Microsoft Research PDF](https://www.microsoft.com/en-us/research/wp-content/uploads/2025/10/ADA__Benchmark___Evaluation.pdf)) [secondary].

### P4. Typed operations for the common path, free code as escape hatch
- **Moves:** operator choice, join/group-by correctness and cleaning steps into tested library functions.
- **Evidence:** AutoPrep tool-augmented vs code generation (above) plus per-operation ablations where removing "normalize" cost up to 5.7 points on TabBench [measured]. Wave 1 found a semantic layer at 100% in scope but 0% on multi-hop questions outside it ([file 03](03-semantic-layers-text-to-sql.md)) [measured, vendor-run]. CodeAct shows free code is stronger for capable models and for composing many steps ([CodeAct](https://arxiv.org/html/2402.01030)), and Hugging Face's smolagents makes the same argument without numbers ([HF blog](https://huggingface.co/blog/smolagents)) [anecdote]. DAB agents also wrote inefficient nested loops instead of group-by on harder tasks ([DABstep](https://arxiv.org/html/2506.23719)) [measured].
- **Cost:** moderate (an operation library and compiler). The evidence supports a hybrid, not a replacement. No source tests this on dirty data.

### P5. Set reasoning effort per stage, keep it constant within a stage
- **Moves:** nothing to code, but it removes decoding time and reduces self-inflicted diagnostics.
- **Evidence:** non-monotonic accuracy vs thinking length [measured, math] ([arXiv 2506.04210](https://arxiv.org/pdf/2506.04210)); on basic math, GPT-5 and O3 held about 97% across effort levels while using more tokens ([arXiv 2507.04023](https://arxiv.org/html/2507.04023)) [secondary]. A 2026 study found negligible accuracy effects of low/medium/high on five of six tasks for GPT-OSS ([arXiv 2605.16938](https://arxiv.org/pdf/2605.16938v1)) [secondary]. Anthropic: lower effort means fewer, terser tool calls; Haiku 5.5 at low is "more likely to skip a search, stop early, or skip a check"; start agentic work at medium; changing top-level effort mid-conversation invalidates the cache ([effort docs](https://platform.claude.com/docs/en/build-with-claude/effort)) [vendor]. DDR-Bench saw raising the reasoning budget cut turns but make accuracy fluctuate [measured].
- **Cost:** none. A per-stage, per-model config and an eval to find the plateau.

### P6. Cache-friendly prompt layout
- **Moves:** repeated prefix processing from the model to the provider cache.
- **Evidence:** Anthropic: prefix order is tools, system, messages; reads cost 0.1x (0.05x on Sonnet 5.5); 5-minute default TTL; changing tool definitions invalidates everything; caching "reduces time-to-first-token, especially for long prompts" but does not change outputs ([docs](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)) [vendor]. OpenAI: automatic, 1,024-token minimum, put stable content first, keep tool order stable ([docs](https://developers.openai.com/api/docs/guides/prompt-caching)) [vendor]. Secondary reports quote up to 85% latency reduction and a 100k-token test going from 11.5 s to 2.4 s ([SD Times](https://sdtimes.com/ai/anthropic-introduces-prompt-caching-to-reduce-latency-and-costs)) [vendor claim via secondary]. Manus calls hit rate the top production metric [anecdote].
- **Cost:** low. The catch for our design: "each stage is a cold session" with a different system prompt, so stages share no prefix. Cache hits need byte-identical content up to the breakpoint, and the first call pays a 1.25x write.

### P7. Plan-then-execute with a fixed skeleton
- **Moves:** step ordering and what-to-check decisions from per-turn model reasoning to a plan made once (our `WorkOrder`).
- **Evidence:** ReWOO reports about 2k vs 9.8k tokens against ReAct on HotpotQA at similar accuracy ([ReWOO, arXiv 2305.18323](https://arxiv.org/pdf/2305.18323)) [secondary; figures inconsistent across summaries]. A LangChain tutorial reportedly saw small executors trigger frequent replanning [secondary]. DAB attributes 40% of failures to a wrong plan and 45% to wrong implementation ([DAB](https://arxiv.org/html/2603.20576v1)) [measured]. DDR-Bench found complex agent scaffolds did not help small models and sometimes shortened exploration [measured].
- **Cost:** low where it exists already. The lesson is to make the plan structured and bounded, and to forbid the analyst from adding unrequested checks.

### P8. Constrained decoding and strict JSON for the model's reasoning
- **Evidence is conflicting.** "Let Me Speak Freely?" reports reasoning declines under format restrictions, worse with stricter formats ([arXiv 2408.02442](https://arxiv.org/abs/2408.02442)) [measured, abstract only]; JSONSchemaBench summaries report modest gains for constrained decoding on GSM8K and sharply varying schema coverage across frameworks ([arXiv 2501.10868](https://arxiv.org/abs/2501.10868)) [secondary]. Over OpenRouter we do not control decoding anyway. Keep outputs structured at the edges (tool arguments, claims), free in the middle.

## 4. Relevance to the pricing harness

| Slow-run finding or symptom | Patterns | Why |
|---|---|---|
| Chases reconciliation residuals after a correct answer | P1, P5 | Controller owns "good enough" with a tolerance rule; cap repair rounds; lower effort on analyst stage |
| Planner adds unrequested validation | P1, P7 | A `WorkOrder` with a closed list of allowed checks; critique only when the controller flags a risk |
| Large prompts raise time to first token (37 KB profiles, re-read docs) | P2, P6 | Replace with a 1-3 KB register plus lookup tool (file 02); put static material first in a shared prefix |
| 96% inference time | P5, P1, P4 | Output tokens and turns dominate; fewer turns via typed ops, less thinking via effort. Caching alone will not fix this |
| Different judgements on the same data across runs | P4 | Handling encoded in operations and stored decisions, not in free Python |
| Flash-class model fails mysteriously | P3, P2 | Expect missing tool calls and contract breaks; add a lenient parser and a one-shot nudge |
| Cold sessions per stage | P6 | Share a tools+system prefix across stages; accept stage-specific tail |

## 5. Recommendations (simplest first)

1. **Adopt: code-owned stopping rules.** A hard cap on analyst turns and repair rounds. Deliver as soon as claims, coverage and a tolerance-based reconciliation check pass. Treat a residual below a stated tolerance as "noted", not "investigate". Critique/verification only when the controller flags a defect or high stakes. Evidence: ADP-MA ablation, agentic overthinking study. Expected: large wall-time cut and fewer divergent runs.
2. **Adopt: explicit effort per stage and per model, held constant inside a stage.** Start the analyst and coordinator at medium-class effort, the verifier targeted. Sweep on the six-turn conversation for each of Luna, Sonnet-class and Flash-class. Do not trust any published plateau for our task, since the evidence is mostly math.
3. **Adopt: tool-result shaping.** Default concise output, row and character caps with a "how to narrow" message, summaries instead of raw frames, actionable error text, ids that the model can paste back. Cap prior tool results kept in history (SWE-agent's last-5 result is the best-evidenced version).
4. **Adopt: a robust action protocol for cheap models.** Few tools (single digits), strict argument schemas, absolute or opaque ids, a parser that accepts a code block as well as a tool call, and an automatic one-shot nudge when no action is emitted. This targets the dominant measured failure (no tool call, contract break).
5. **Adopt: cache-aware layout.** One stable prefix (tools, then the shared system text, then reference notes) across stages; per-question material last; never reorder tools; do not change effort mid-stage. Check `cache_read_input_tokens` to confirm hits. Gain is on input time and cost; do not expect it to fix decode time.
6. **Try: typed operations for the common path (measure, group-by, filter, period, basis), with a Python fallback over the same prepared view.** This matches files 01 and 03 and the AutoPrep result. Gate on a comparison: same questions, typed path vs free Python, measuring correctness, run-to-run agreement and seconds.
7. **Try: a lighter scaffold profile for small models.** DSBench and DDR-Bench suggest extra agent layers can cost small models accuracy. Run Flash-class with the minimal profile (no critique, no memory), then add pieces back one at a time.
8. **Try: a planning step that lists risks to the answer, not checks to run** (file 01's DiscRun-Bench suggestion) only after item 1 is in place.
9. **Skip: tool retrieval (RAG over tools), multi-agent fan-out, fine-tuning for function calling, grammar-constrained decoding.** Our tool count is too small for retrieval to matter, fan-out adds latency, and the rest add cost without a measured payoff here.
10. **Skip: relying on published "scaffold X beats Y" numbers.** Per [arXiv 2609.09218](https://arxiv.org/html/2609.09218) scaffold effects can exceed model effects and reverse rankings. Decide by own eval.

## 6. Open questions and weak evidence

- **No source compares typed operations with free Python on dirty data.** AutoPrep is the nearest, on benchmark tables with 70B-class models, not Flash-class models, and the operations are query-prep steps rather than pricing logic. The CodeAct paper's open-source models in 2024 scored far below closed ones; the direction for 2026 small models is unknown.
- **No published ablation for Flash/Luna/Haiku-class models on data-analysis scaffolds.** DDR-Bench has Qwen3-4B/30B-A3B and GPT-5-mini; DAB has GPT-5-mini and Gemini-2.5-Flash; AgenticDataBench uses only large models. The DDR-Bench appendix on complex-vs-ReAct frameworks was not in the part of the paper I could read, so the "complex agents degrade" claim comes from a search summary [secondary].
- **Critique ablation is narrow.** ADP-MA ablated on 100 single-table DBBench tasks with one model; a pricing question with fan-out risk may need verification. The saving is in gating, not removal.
- **Reasoning-effort evidence is mostly math.** I found no controlled study of effort vs accuracy vs wall time on tabular analysis. Our own sweep is the real evidence.
- **Prefill vs decode split is inferred.** I could not find a source that quantifies it for tool-using agents; the diagnosis that 96% is inference does not say how much is input processing. Measure TTFT and output tokens per stage before choosing between P5 and P6.
- **Paper reliability.** The agentic overthinking paper has internal inconsistencies (trajectory counts, "35%" vs the table's about 14%); treat its direction as credible and its percentages loosely. Chroma sells retrieval infrastructure. Several figures here (RAG-MCP, ReWOO, Lost in the Middle, JSONSchemaBench, ConDABench) I saw only through search summaries and should be checked against the papers before being quoted externally.
- **PDF-only papers I could not read.** DABstep's own text was read via the arXiv HTML version, but the "Data Agents: Agentic Data Systems" ablation figures (arXiv 2609.24137) were not in the extractable text, so they are not used.
