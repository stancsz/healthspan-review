# Explicit estimated age signals in the clinician workspace

## Decision

The complete synthetic profile produces one deterministic age-signal estimate,
currently `Joint age: 35 years`. The Vercel workspace renders this beside the
current measurement metrics in a separate `Estimated age signals` panel and
labels it `Estimated · unvalidated`.

## Boundary

This is not a validated biological age, system age, diagnosis, prognosis, or
treatment recommendation. The heuristic uses whatever of the declared fields
are present, records the fields used and coverage, and has no validated
uncertainty interval. JSON export and the local MCP adapter preserve the
computed estimate without claiming clinical validation.

## Evidence

The parser, workbench, manual-entry surface, and MCP regression tests cover the
metadata path. Live browser verification must confirm the complete synthetic
case displays `Joint age: 35 years`, while a partial input displays a
coverage-labelled heuristic estimate. These are software checks only; E-005
remains blocked.
