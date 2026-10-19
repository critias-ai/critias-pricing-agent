# Solo runs: gpt-6.1-sol low and gpt-6-luna max, 2026-10-16

Same scenario as the solo Haiku high run (z-haiku-high, see the y-haiku report): product ranking, six turns, lazy
follow-ups, one session alone on the machine, snapshot 31, OpenAI provider, run one after the other.
Cost is API-equivalent. The user's answers followed what each model asked (I did not hint at the heart-holder or
keying-error lines unless the model raised them).

| | Haiku 5.5 high | Sol low | Luna max |
|---|---|---|---|
| Sum of turn time | 203 s | 1,260 s | 2,418 s |
| Turn range | 19-50 s | 89-358 s | 197-796 s |
| Cost (API-equivalent) | $0.034 | $1.51 | $0.152 |
| Model calls | 28 | 96 | 70 |
| Avg first token | 2-3 s | 5-10.5 s | 5.4-7.0 s |
| Output tokens (sum) | 28k | 43.6k | 118.7k |
| Context peak | 64k | 155k | 150k |
| Compaction | none | none | once (turn 5) |
| Python scripts | none | 3 files (shared module + 2) | 1 file |
| Tool-hook blocks | 1 (skill-read) | 5 (skill-read) | 6 (skill-read) |
| Charts in turns | when asked | every turn 1-5 | every turn |

## Behaviour that matters
- **Same answers, very different effort.** All three agree on the top five (£139,548, £94,148, £85,527, £82,723, £64,801)
  and the no-ID premium (£86.6k). Haiku got there in 203 s.
- **Speed.** Solo Sol's first-token wait is 5-10 s and rose to 9-10.5 s from turn 4 (99k to 155k context), the same as
  the parallel Sol runs. So Sol's slower, rising wait is the model or provider path, not parallel load and not
  specific to this scenario. Luna max's wait is 5.4-7.0 s and nearly flat; its time is generation: 24-40k output tokens
  in turns 4-5 (reasoning), versus Sol's 12-14k.
- **Cost.** Luna max is 10x cheaper than Sol low for similar output despite 2.7x the output tokens, because of price
  per token. Time is the cost to the user: Luna max turn 5 took 796 s.
- **Compaction (first seen).** Luna max compacted in turn 5 (context 150k to 90k). Turn 6, asked about competitor prices
  and stock, still cited the cakestand price figures and the internal list prices correctly. This is the first
  evidence that facts survive a compaction in a live session; it is one sample.
- **Unprompted data-quality catches.** Sol: raised the heart-holder unit question in turn 1 and the keying-error
  products in turn 2, named the "3,557 zero-price units carrying cost" in turn 4, listed all 22 excluded line ids in
  turn 5. Haiku high: found the keying errors in turn 2, removed the zero-price line silently. **Luna max: neither**.
  Its top-10 chart shows Silver Angels and Picnic Basket as recorded with no remark, and no reply in the six
  turns mentions the heart-holder, zero-price lines on it, or the £649.50 lines (turn 5 says only that 19 lines with
  price <= 0 were left out of the price comparison). The ranking it gave is therefore the unchecked one.
- **Hallucination.** None in either. Both said competitor prices and stock are unknown (Sol: "unknown, not zero"), cited
  what the data does hold (internal price lists), and declined to recommend a blanket price move.
- **Asks.** Luna max asked one question per turn (POST, "main" definition, order-size definition); Sol asked 4 of 6
  turns; both were answerable by assumption.

## Hooks
`skill-read` blocked 2 calls in turn 1 on both, and again on Luna turns 2 and 3 (and Sol turns 2 and 3), the re-fire
reported before. `brake-40` fired 3 times on Luna max (long turns) and never on Sol.

## Read-across
- For this kind of question Haiku high gives the same figures 10-60x faster. Its gap is thoroughness of disclosure
  (needs a nudge on the zero-price line) rather than numbers.
- Luna max spends more generation than Sol on the same questions but misses what Sol's low setting catches; more
  reasoning did not improve data-quality detection.
- Open: whether the Luna miss is thinking level or model (a Luna high or low solo run on the same script).

## Luna high (s-luna-high), same script, run after the two above

6 turns, 1,667 s of turn time, $0.108, 68 calls, context 35k to 133k, no compaction. First token 5.3-7.0 s.

| Turn | Wall s | Calls | $ | Output tokens |
|---|---|---|---|---|
| 1 | 246 | 17 | 0.015 | 9.2k |
| 2 | 105 | 9 | 0.008 | 4.3k |
| 3 | 67 | 5 | 0.004 | 2.6k |
| 4 | 406 | 11 | 0.020 | 20.5k |
| 5 | 706 | 20 | 0.045 | 35.3k |
| 6 | 138 | 6 | 0.017 | 6.2k |

**Unprompted catches (the point of the run).**
- Keying-error products: turn 2 showed the top 10 both ways, said 84347 and 22502 "fall out of the top 10" under a 10x
  median screen, and charted both treatments. Not asked.
- Heart-holder zero-price line: **turn 4 named it** ("4,005 no-ID units recorded at zero price"), gave both prices
  (£1.69 and £4.44 per unit) and both scenario values, and asked whether they are free units or errors. When the user
  did not answer, it asked again in turn 5 and showed the effect on the largest order-size band (£0.81 vs £3.79).
  This is the first of the five runs to raise it explicitly without a nudge (Sol raised the unit question in turn 1 and
  named the zero-price units in turn 4 too, but only after the user had answered its turn-1 question about units).
- Luna max on the same script mentioned neither. Same model, different thinking level: high caught it, max did not.

**Hallucination.** None seen. Competitor prices and stock reported as unavailable; it cited the operations brief for "no
blanket increase approved" and noted that open orders and accepted quotes exist for the item (present in the data),
and advised an account-by-account review.

**Defects seen.**
- Turn 5: "Table line-exclusions: row key column product_id is blank or repeats", a table dropped by `present`
  with a notice (the known row-key defect; the notice is working).
- Turn 6 quoted a cakestand figure (£239,207, order-size matched) that had not appeared before; it is a
  subset of earlier work, not a contradiction, but the first time that number is visible.
- `skill-read` blocked twice in turn 1 only (it did not re-fire on turns 2-3 as it did on Sol and Luna max).

## Five solo runs, same script
| | Haiku high | Sol low | Luna max | Luna high |
|---|---|---|---|---|
| Time | 203 s | 1,260 s | 2,418 s | 1,667 s |
| Cost | $0.034 | $1.51 | $0.152 | $0.108 |
| Keying errors flagged unprompted | yes (turn 2) | yes (turn 2) | no | yes (turn 2) |
| Heart-holder zero-price line named | no (silent) | yes (turn 4) | no | yes (turn 4) |
| Invented a source | no | no | no | no |
| Compaction | none | none | turn 5, facts kept | none |

Ordered by what a user gets for the time: Haiku high for speed with a nudge needed, Luna high for disclosure at a
fraction of Sol's cost (about 7% of it).
