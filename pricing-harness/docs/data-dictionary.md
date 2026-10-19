# Data definitions

The application ships with no business definitions or column mappings. For each workspace, the analyst inspects the actual files, asks about anything unresolved, and records in `.pricing/context.md` only the definitions the user confirms. Those confirmed definitions override the defaults in the bundled knowledge cards.

## Test data

Python generators in `tests/evals/generators/` build synthetic eval datasets in `tests/evals/inputs/` (B2B, retail, SaaS, workbooks and deliberately messy files). Some cases also use three public datasets (UCI Online Retail II, AdventureWorks and Olist), which `tests/evals/real/fetch.py` downloads from pinned URLs and never commits. Their sources and licences are listed in [the evals README](../tests/evals/README.md#third-party-data-and-licences). Each case under `tests/evals/cases/` states its own definitions in the manager's turns or a starting `context.md` in `tests/evals/contexts/`. These definitions exist only to test the analyst. They are not defaults and must never be copied into a user's confirmed context.

## Before real-data use

Confirm with the data owner: transaction grain and identifiers, revenue and cost fields, signs, returns, credits and other adjustments, currency and precision, the fiscal calendar and reference date, date and number formats, historical product or group mappings, missing coverage, and whether thresholds are annual or cumulative.
