# Goal: Local Measurement Review Pack v0.1

Status: active
Created: 2026-09-12
Goal ID: LOCAL-REVIEW-1
Steward: project owner; contract prepared by Codex
Builder: Codex

## Steward-owned contract

### Outcome

Deliver a local-first, printable and exportable measurement-review packet for
longevity/wellness clinics, body-composition services, and clinical research
teams. A SECA TableView CSV must become an auditable source ledger and a safe
next-input checklist without becoming a clinical assessment.

### Why

The strongest defensible initial value is reducing ambiguity during measurement
review. The product should make what was observed, derived, missing, comparable,
and withheld obvious enough to support the prespecified five-user IR1 study.

### Source of truth

- `docs/product-specs/PRODUCT_INTENT.md`
- `ARCHITECTURE.md`
- `docs/CLINICIAN_WORKFLOW_STUDY.md`
- This contract

### Acceptance criteria

| ID | Required outcome | Evidence required to pass |
|---|---|---|
| L1 | The local SECA path shows source label/format, date, value, unit, and observed-versus-derived provenance. | Browser parser test and visible review surface. |
| L2 | Parsing/unmapped/unit warnings and the missing-input/MVV checklist are retained. | Deterministic packet assertions and visible review surface. |
| L3 | FI numerator/denominator are transparent and safely withheld before MVV completion, with the missing-item denominator caveat. | Packet contract test and visible copy. |
| L4 | Comparison is descriptive only when two dated scans exist and unavailable otherwise. | Two-scan and single-scan tests; no health-improvement claim. |
| L5 | The packet can be downloaded as deterministic JSON and printed locally without raw CSV or patient identifiers. | UI contract tests and scoped print mode. |
| L6 | Governance surfaces agree and the pack is ready for the five-user IR1 comparison. | GOAL, ROADMAP, Wiki, EVAL/evidence, protocol, and Project #4 reconciliation. |
| L7 | Explicitly supplied illustrative age signals appear alongside current metrics without being invented for incomplete inputs, and survive JSON/MCP export. | Synthetic browser/MCP evidence shows `Joint age: 35 years` with an unvalidated label; inputs without age-signal metadata show no fabricated estimate. |

### Constraints / invariants

- Research and wellness measurement review only.
- Keep E-005 blocked and clinical use forbidden.
- No diagnosis, treatment advice, validated biological/system age, patient-data hosting, production-readiness, paid-pilot, real-user, or token-savings claim.
- Do not upload or retain a local CSV or patient identifier.

### Non-goals

This goal does not complete IR1 sessions, validate a clinical construct, deploy
a patient-data service, publish the checkout, or prove commercial value.

### Escalation conditions

Escalate when real intended-user participation, clinical/statistical approval,
patient-data governance, or release authorization is required.

## Builder-owned execution record

### Current approach

Extend the existing browser-local parser and preview with one shared packet
schema, a visible review region, JSON download, and isolated print mode.

### Progress

- [x] Add deterministic review-packet schema.
- [x] Render source, measurement, warning, MVV, FI, comparison, and boundary details.
- [x] Add local JSON download and scoped printing.
- [x] Add focused parser/UI safety tests.
- [x] Run canonical verification and reconcile all governance surfaces.
- [x] Synchronize GitHub Project #4.
- [x] Publish an owner-private fixed-synthetic interaction prototype for
  clinician-flow discussion; it rejects all non-demo AI-drafting payloads.
- [x] Add a Vercel-ready clinician workspace at the site root, with a focused
  import → review → export workflow over the existing browser-local parser.
- [x] Complete the synthetic SECA sample with observed height, phase angle,
  ECW/TBW, regional readings, units, and segment provenance in the review
  surface and exported packet.
- [x] Add a complete 35/35 synthetic clinical profile, a separate clinical
  `Field,Value,Unit` CSV path, and explicit source conflict handling.
- [x] Add a manual-entry page at `/manual` with the same 35-field contract and
  a local JSON export.
- [x] Add a dependency-free local stdio MCP adapter for SECA parsing, clinical
  CSV parsing, and provenance-aware completeness review.
- [x] Add explicitly supplied illustrative age-signal output to the synthetic
  review, including `Joint age: 35 years`, while keeping validated biological
  and system ages withheld.

### Validation

Focused Node verification passed 35/35 tests, including the new Vercel workspace
route, complete synthetic parser, second CSV input, manual-entry surface,
safety-boundary, accessibility-action, print-style, and illustrative-age-signal
checks. The focused MCP Python tests also pass. The refreshed receipt records
179 Python tests and 29 Node tests. The canonical verifier passed all 20 checks,
including documentation and loopback serving, and reported `E-005 blocked`.

### Runtime evidence

The local workspace was exercised in a headed browser with the complete
synthetic case: 2 dated SECA scans, 10 equipment fields, 5 regional readings,
separate clinical source ledger, 35/35 canonical fields, 0 open minimum-input
items, explicit provenance, an illustrative `Joint age: 35 years` card marked
`Estimated · unvalidated`, descriptive deltas, and a ready deterministic
packet. The estimated signal is preserved in the JSON packet and optional MCP
metadata; SECA-only, clinical-CSV-only, and manual values without such metadata
do not receive a fabricated age. The `/manual` page filled the same synthetic
profile and reported 35/35 present. The MCP dispatcher returned the three local
review tools and the combined synthetic review returned 35/35 with no raw CSV
or patient identifier.
The newest slice is deployed at `https://frailty-index-deficit-accumulation.vercel.app/`.
Live `/`, `/workbench`, and `/manual` walkthroughs show the complete synthetic
case and manual 35/35 state. These checks verify local and static-host software
behavior, not clinical validation, patient-data
governance, user sessions, or production clinical runtime.
E-005 remains blocked.
The separate owner-private interaction prototype is deployed from its own
Sites project and exposes only fixed synthetic record HR-042 to its
MiniMax-assisted documentation draft. Deployment success and non-demo HTTP 400
rejection are implementation evidence, not a clinical or intended-user result.

### Remaining gap

The implementation slice is verified and Project #4 is synchronized. The goal
remains active through the externally run IR1 comparison: five intended users,
including the manual-workflow comparison and preregistered interpretation
thresholds, are not yet available and no user-value result is claimed.
