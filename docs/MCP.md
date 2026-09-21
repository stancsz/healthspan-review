# Local MCP measurement review

The repository includes a small dependency-free MCP server for clients that
need to call the measurement-review workflow as tools. It runs over stdio and
does not persist data, call a network service, store identifiers, or return the
raw CSV.

## Start it

From the repository root:

```powershell
uv run frailty-engine-mcp
```

Configure the local MCP client to start that command in this repository. The
server implements the MCP JSON-RPC methods `initialize`, `tools/list`, and
`tools/call`.

## Tools

- `parse_seca_csv`: parses a SECA TableView CSV and returns the latest observed
  measurements, units, dated-scan count, regional readings, derivations, and
  warnings.
- `parse_clinical_csv`: parses the separate `Field,Value,Unit` CSV contract for
  all 35 canonical fields across demographics, BIA/SECA, blood, history, and
  function.
- `build_measurement_review`: merges SECA and clinical inputs with explicit
  provenance and reports `present_count`, `missing_fields`, and the MVV input
  gate. A conflicting SECA value is retained and disclosed as a warning. It
  also returns deterministic `estimated_ages` results for all major categories
  based on whatever canonical measurements are present. Each estimate includes
  the input fields used and coverage. A caller may provide `estimated_ages`
  metadata when it already has estimates, but the local adapter otherwise
  computes the category estimates rather than omitting the output.

The MCP surface is an integration adapter for local measurement review. It is
not a diagnosis tool, treatment recommender, patient-data service, or validated
clinical decision-support system. E-005 remains blocked.
