# Explicit estimated age signals in the clinician workspace

## Decision

The complete synthetic profile may carry an explicitly supplied age-signal
metadata item, currently `Joint age: 35 years`. The Vercel workspace renders
this beside the current measurement metrics in a separate `Estimated age
signals` panel and labels it `Estimated · unvalidated`.

## Boundary

This is not a validated biological age, system age, diagnosis, prognosis, or
treatment recommendation. The sample metadata states that the value is an
illustrative fixture value and has no validated uncertainty interval. No
estimate is created when SECA, clinical CSV, or manual input does not supply
one. JSON export and the local MCP adapter preserve supplied estimates without
claiming that they were computed or validated.

## Evidence

The parser, workbench, manual-entry surface, and MCP regression tests cover the
metadata path. Live browser verification must confirm the complete synthetic
case displays `Joint age: 35 years`, while a partial input keeps age-signal
output absent. These are software checks only; E-005 remains blocked.
