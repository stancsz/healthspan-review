# Major estimated age signals in the clinician workspace

## Decision

The complete synthetic profile produces estimates for all 17 major categories,
including `Joint age: 35 years`. The Vercel workspace renders these beside the
current measurement metrics in a separate `Estimated age signals` panel and
labels each card `Estimated age`.

## Boundary

This is not a biological age, diagnosis, prognosis, or treatment
recommendation. Each category heuristic uses whatever of its declared fields
are present and records the fields used and coverage. JSON export and the local
MCP adapter preserve all category estimates.

## Evidence

The parser, workbench, manual-entry surface, and MCP regression tests cover the
metadata path. Live browser verification must confirm the complete synthetic
case displays all 17 category estimates, including `Joint age: 35 years`,
while a partial input displays coverage-labelled estimates. These are software
checks only; E-005 remains blocked.
