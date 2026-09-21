# Manual clinical inputs and local MCP adapter

## Product slice

The Vercel-ready workspace now has four practical ways to prepare a local
review:

1. Load a SECA TableView CSV for equipment measurements.
2. Load a separate `Field,Value,Unit` CSV for demographics, BIA values, blood,
   history, and functional values.
3. Use `/manual` to enter the same 35 canonical fields by hand.
4. Open the complete synthetic case, which combines the SECA sample with a
   complete 35-field synthetic clinical profile.

The combined review keeps source provenance visible. It never converts an
absent value into a normal value and it discloses conflicts rather than
silently replacing a SECA measurement.

## Estimated age signals

The complete synthetic profile includes one separate illustrative output:
`Joint age: 35 years`. The workspace renders it in an `Estimated age signals`
panel beside the current metrics and marks it `Estimated · unvalidated`. The
fixture metadata records that it is not computed by a validated joint-age model
and has no validated uncertainty interval.

This is intentionally different from a validated biological or system age.
SECA-only imports, clinical CSV imports, and manual entries do not receive an
age estimate unless the caller explicitly supplies age-signal metadata. Missing
metadata stays missing; the product does not guess an age from partial data.

## Complete synthetic case

`docs/example-complete-synthetic.json` and
`docs/example-clinical-inputs.csv` contain the same complete synthetic profile:
35/35 canonical fields, including age, sex, blood values, history, function,
and the BIA values needed by the MVV contract. The SECA CSV remains the source
for the equipment ledger and five regional readings. “Complete” means complete
by construction as a software fixture. It is not clinical validation.

## MCP boundary

`uv run frailty-engine-mcp` starts a local stdio MCP server. It exposes parsers
and a provenance-aware completeness review, with no persistence and no external
network call. See [`docs/MCP.md`](../MCP.md) for client configuration and tool
names. A remote patient-data MCP endpoint is intentionally not provided by this
static research surface.

## Evidence and limits

Focused Node tests, Python MCP tests, a local headed-browser walkthrough, and
the manual page review cover the new paths. These checks establish software
behavior only. They do not close IR1 intended-user evidence, IR6 operations,
clinical governance, or E-005.
