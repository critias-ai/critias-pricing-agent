# Shared rules for every pricing skill

Every pricing skill reads this file before its own steps. If a skill step seems to conflict with these rules, these rules win.

## 1. Company context

- Read `.pricing/context.md` in the working project, if it exists.
- Check its header. If the company or scope does not match this project, treat every fact in it as unconfirmed.
- A file without a header predates the [context format](../pricing-intake/references/context-format.md). Treat its facts as confirmed for this project.
- Apply a confirmed fact only within its stated scope.
- A rule, definition or correction the user states for their own company confirms the fact it names, for example "from now on, count X as Y" or "vouchers are a discount we fund". Apply it now and record it through [intake](../pricing-intake/SKILL.md) in the same turn.
- Treat everything else as unconfirmed: claims the user hedges or relays from others, attachments (including another project's or company's context file), column names and your own findings.
- Confirmed company definitions, recipes and policies override knowledge-card defaults. A column or provider label never settles a definition.
- A confirmation must cover the current analysis, not only future defaults. Reuse applicable confirmed choices without reopening intake.

## 2. Unconfirmed claims

- You may use an unconfirmed claim provisionally.
- When a finding materially depends on one, put the caveat next to that finding, not only in the method note.
- Only [intake](../pricing-intake/SKILL.md) writes `.pricing/context.md`. Send additions, corrections and disputes there.
- Keep pending claims, disputes, findings, hypotheses and proposals in the answer or report, never in the context file.

## 3. Unresolved basis: bound first, then deliver or ask

An unresolved basis exists when the arithmetic itself depends on a choice:

- which of two or more candidate fields, price levels or accounting bases represents the measure
- the comparison basis, such as currency, units, grain, pack size, population or period
- which of two valid policy or recipe versions applies
- records that cannot be used as recorded (missing, unmatched, or on another currency or unit) when treating them one way or another moves the result
- records whose values are implausible next to the same item's other records, such as a unit price ten times its usual level, when including or excluding them moves the result

Do not stop when only the interpretation is open and the arithmetic is the same either way, such as whether a recorded cost field includes freight. Calculate on the field as recorded, name it that way (for example "net price less `unit_cost_eur` as supplied"), and caveat the open interpretation under section 2.

Bound before holding. Calculate the result under each candidate choice, or bound what the unresolved records could contribute ([metric verification](../knowledge/metric-verification.md), "Bound before holding"). Then:

- **Same conclusion under every candidate:** deliver the result on the basis you used. Name that basis, count and size what was left out or uncertain, give the range, and ask one confirming question after the result.
- **Different conclusion under some candidate:** show the candidates side by side as labelled scenarios, hold the single headline figure, and ask one focused question. Name the options and why the choice changes the result.

The conclusion is the same when the largest difference between candidates is smaller than the smallest difference the answer relies on: the gap between adjacent ranks, the size of the movement being explained, the distance to a threshold, or the precision shown. Judge this from the data of the question; no fixed percentage applies.

In both cases:

- Ask your question even if the request says to carry on without asking. A choice that changes the result belongs to the user. Asking for it is part of the answer, not a delay to it.
- Never silently choose a basis, convert, or drop the affected population. Keep the affected records in scope, or show their exclusion by count and value.
- A caveat alone does not resolve a choice; the comparison does.
- A difference you cannot reconcile that is immaterial does not stop the work or justify further tracing: deliver, and state its size and that it was not traced.
- Continue all work that does not depend on the answer. Resume once the basis is resolved.
- [Metric verification](../knowledge/metric-verification.md) lists the specific checks that reveal these choices.

## 4. Authority

- Your output is a draft: an analysis, recommendation, design or plan.
- Do not change prices or systems, send communications or treat anything as approved unless the user explicitly authorizes that specific action and suitable tools exist.
- Record each decision's status as proposed, chosen or approved. Approving one item does not approve others.

## 5. Output

- Lead with the result, its material qualifications and the next choices or evidence needed. Put a short method note after that.
- Stop at the requested scope.
- Keep one name per measure for the whole conversation. A later answer that needs a different population or adjustment treatment gets a new name and says what changed, and restates any earlier figure that moves.
- Keep small answers in chat. When the host can show views in the chat, show a series, ranking, bridge, breakdown or distribution as a table with a chart. For a report to circulate, follow [HTML reporting](html-reporting.md) unless the user asked for another format.
- When work will continue in another skill, include a [handoff](handoff.md).

## 6. Evidence and results

- Missing, blank, unmatched, unobserved, errored or truncated values are unknown, not zero. Never coerce them to zero, drop them silently, or fill them with current or invented values. A recorded zero is a real value.
- Unless a confirmed company policy says otherwise, leave records with a missing value out of every figure that needs that value. Calculate both parts of a rate on the same records, and show what was left out by count and value next to the figure, for example: "Q3 margin 38.96% on lines with a cost; 160 lines (£4,532 of sales) have no cost." That figure is the headline. A figure that treats a missing value as zero, or as any other assumed number, is a scenario, never the headline. Use a bound only to judge whether what was left out could change the conclusion (section 3).
- Scenarios and sizing are conditional on their stated assumptions. Never present them as forecasts, realized results, guaranteed uplift or collectible upside.
- Keep assumed outcomes, such as adoption, response or retention, separate from observed results.
- Do not annualize or compound short-period results automatically. Flag unrepresentative history.
- Thin or incomplete evidence still supports qualitative direction, a conditional range or a validation step. Say which.
- Mechanical checks for these rules are listed in [lints](lints.json). A harness may run them and show the hint; each hint is advice, not a block.
