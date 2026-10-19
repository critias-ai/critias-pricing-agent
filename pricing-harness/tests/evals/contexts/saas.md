# Pricing context: Corvid Cloud (fictional test data)
Scope: all files in this folder
Last updated: 2026-10-01

## Data
- Corvid Cloud is a fictional SaaS company; this data is synthetic. All amounts are in GBP. [confirmed 2026-10-01; finance]
- subscriptions.csv has one row per customer per month billed; mrr is the monthly recurring revenue for that month (annual plans are shown as their monthly equivalent). churn_month in customers.csv is the last month billed. [confirmed 2026-10-01; finance]
- MRR movements between two consecutive months: new = MRR of customers billed this month and not last month; churn = last month's MRR of customers billed last month and not this month; expansion and contraction = the rise or fall in MRR of customers billed in both. A year's bridge sums its twelve months. [confirmed 2026-10-01; finance]
- NRR for a year = December MRR of the customers billed the previous December ÷ their MRR that previous December. GRR is the same with each customer's December MRR capped at their previous December MRR. [confirmed 2026-10-01; finance]
- Subscription gross margin is 80%. CAC for a group of customers = acquisition.csv spend for their channel over every month of the period they signed up in, months with no sign-ups included, ÷ the customers acquired. [confirmed 2026-10-01; finance]
- price_test.csv is a random assignment made on 2025-03-15: the "holdout" arm kept the old price until 2025-10-01. [confirmed 2026-10-01; product]

## Change log
- 2026-10-01: added the data facts.
