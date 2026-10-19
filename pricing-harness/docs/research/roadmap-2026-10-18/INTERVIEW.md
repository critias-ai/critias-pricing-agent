# Practitioner interview script (Gate 0)

About 30 minutes. Ask about the last real project, not hypotheticals ("last time you did X, what happened?"). Don't show the harness until section 8, so it doesn't steer the answers. Each question names the roadmap item it tests.

## 1. Role and context (3 min)

1. What is your role, and what kind of company or client do you price for (B2B, SaaS, retail; size)?
2. Over the last month, roughly what share of your time went to pricing and margin analysis, and what share to everything else?

## 2. Data in (5 min): tests connectors vs files

3. Think of the last analysis you did. Where did the data come from, and how did it reach you (ERP export, BI extract, data room, CRM report, someone's spreadsheet)?
4. How big was it (rows, files, sheets), and how messy? What did you have to fix before you could trust it?
5. If a tool could connect straight to the source system, would you be allowed to use it? Who would have to approve that? *(MCP and database connectors)*

## 3. The analysis (5 min): tests templates

6. Which analyses do you run again and again (waterfall, PVM bridge, leakage, discount discipline, customer margin, price-increase tracking)?
7. For the PVM bridge or waterfall: which convention do you use, and has anyone ever challenged it?
8. Which parts are judgement calls (exclusions, credit notes, FX, cost allocation)? Where do you write those decisions down?

## 4. Output and handover (7 min): tests Excel export, the most important section

9. What exactly do you hand over, and to whom? (Excel, deck, memo, dashboard)
10. If Excel: does it have to be *your* workbook format (a client or house template, fixed tabs, named ranges), or is any clean layout fine?
11. Which parts must be live formulas, and which can be values? For example: the totals and bridge only, every derived column, or the whole calculation down to the row data.
12. How big does the workbook get? Do you work on raw transactions in Excel, or on an aggregated table?
13. When someone reviews your workbook, what do they click on first? What makes them distrust it?
14. If a tool gave you a workbook with a "Checks" tab (tie-outs that must equal zero) and a "Run record" tab (source file hashes, the query, the date), would a reviewer value that, or ignore it?

## 5. Trust and review (4 min): tests the audit view and SQL beside figures

15. Have you ever used ChatGPT, Claude or Copilot on pricing data? What happened? Where did it go wrong?
16. What would you need to see before you quoted an AI-produced number to a client or your CFO?
17. Would seeing the SQL or script behind each number help you, or only the analysts on your team?

## 6. Confidentiality (2 min): tests local-first and local models

18. Are you allowed to upload client or company data to a cloud AI? Which ones, under what terms?
19. Would "runs on your laptop, but the model is in the cloud" pass your rules? What about "runs entirely on your laptop, with a weaker model"?

## 7. Recurring work and value (2 min): tests re-runs, scheduling and willingness to pay

20. Which analyses repeat monthly or quarterly with the same structure and only new data?
21. What do you pay for tools today? What would a tool have to do to justify spending, say, $50–100 a month?

## 8. Reaction (2 min, after a demo or the roadmap)

22. Looking at this roadmap, what is missing that would stop you using it next week?
23. What would you drop?
24. Who else should I talk to?

## Notes for the interviewer

- Listen for workbook format requirements in questions 10–12. They decide whether the Excel export generates its own layout or fills the user's template.
- Write down exact words where you can. "My director clicks into the bridge total first" is worth more than a summary.
