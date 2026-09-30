# Goal: Local Measurement Review Pack with AI-assisted PDF entry

Status: active
Created: 2026-09-12
Goal ID: LOCAL-REVIEW-1
Steward: project owner; contract prepared by Codex
Builder: Codex

## Steward-owned contract

### Outcome

Deliver a printable, exportable measurement-review packet for longevity/
wellness clinics, body-composition services, and clinical research teams. Keep
the existing SECA CSV path browser-local, and add a MiniMax-assisted PDF intake
that stages measured values as traceable, human-reviewed candidates in the
existing 35-field record workflow without becoming a clinical assessment.

### Why

The strongest defensible value is reducing ambiguity during measurement review.
The product should make what was observed, derived, missing, comparable, and
withheld obvious enough to support the prespecified five-user IR1 study. PDF
entry should reduce transcription work while preserving the printed source,
unit, date, page, and human confirmation for every value.

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
| L7 | Deterministic age estimates for all major categories appear alongside current metrics for complete and partial inputs, record the fields used, and survive JSON/MCP export. | Synthetic browser/MCP evidence shows all 17 category estimates, including `Joint age: 35 years`; partial-input evidence shows coverage for each estimate. |
| L8 | A PDF can be opened in the browser and mapped by an AI service to candidates in the existing 35-field schema, including selectable-text and scanned-page input, for source files up to 24 pages. | Synthetic text and scanned PDFs exercise extraction, page rendering, bounded same-origin API requests, and safe handling of malformed/encrypted/oversized inputs. A live synthetic 24-page test exercised four sequential API batches and retained candidates from original pages 1, 7, 13, and 19; the 24-page file-picker-to-export browser flow remains unverified. |
| L9 | Each candidate retains its source page, short supporting excerpt, printed value/unit/date, and normalized candidate; ambiguous, unsupported, conflicting, or out-of-range values remain visibly flagged. | Review UI and exported packet preserve field-level evidence and warnings; live PDF/API checks verify supported conversions, source conflict flags, and ambiguous-date warnings. The live browser corrected an ambiguous date, cleared the warning, recalculated edited-value conflicts, and reached packet-ready state. A read-only parse of the downloaded 15,281-byte JSON confirmed the corrected ISO date, retained printed date, confirmed provenance, and absence of PDF/image payloads. |
| L10 | AI suggestions never silently become record values: the user can edit, confirm, or dismiss candidates individually before they enter the review ledger. | Browser workflow proves unconfirmed candidates do not alter the record; accepted values retain AI-extracted plus human-confirmed provenance. |
| L11 | The PDF itself stays in the browser; only bounded, minimized extracted text/page images are sent to the same-origin AI function after the user reviews a disclosure and confirms de-identification. No PDF, text, candidate response, API key, or identifier is persisted or body-logged by the app. | Function/API inspection and live runtime review verify consent gating, a 12 MiB / 24-page document limit, six-page / 3.7 MB client-preflight batches, server-only credentials, a 5-request/minute/IP Vercel Firewall rule, body-free application logs, no browser storage, and fail-closed behavior. |
| L12 | The reviewed app is deployed at `https://healthspan-review.vercel.app/` and the PDF-to-confirmed-record path is deeply exercised on that live endpoint. | Deployment identity, live routes, synthetic text/scanned PDF walkthroughs, API behavior, failure cases, and regression of manual/CSV/sample/export routes are recorded. The current app-level flow is deeply exercised at the generated alias; exact-hostname ownership remains unresolved. |

### Constraints / invariants

- Research and wellness measurement review only.
- Keep E-005 blocked and clinical use forbidden.
- No diagnosis, treatment advice, validated biological/system age, patient-data hosting, production-readiness, paid-pilot, real-user, or token-savings claim.
- Keep original SECA/clinical CSVs in the browser; do not upload or retain them.
- Keep the original PDF in the browser. AI submission is opt-in per PDF and
  transmits only bounded extracted text and rendered page images to Vercel and
  MiniMax. The UI describes an external AI service without naming the
  implementation provider, links its privacy policy, and requires the user to
  confirm the source is de-identified. The app does not claim that it can
  de-identify a document automatically or govern provider retention.
- Require user de-identification before sending any PDF content; never persist
  submitted PDF-derived content in the app. Keep the MiniMax key server-side,
  enforce same-origin requests and Vercel Firewall rate limiting, and never log
  request or response bodies in application code.

### Non-goals

This goal does not complete IR1 sessions, validate a clinical construct, approve
identifiable patient-data processing, make a clinical service, or prove
commercial value. The Vercel publication is a research/wellness tool with an
opt-in AI feature for de-identified records only.

### Escalation conditions

Escalate when real intended-user participation, clinical/statistical approval,
patient-data governance, or release authorization is required.

## Builder-owned execution record

### Current approach

Extend the existing measurement-review workflow with browser PDF.js text
extraction/page rendering, a same-origin MiniMax-M3 extraction function, and
a source-cited candidate review step. Only confirmed, validated candidates may
enter the existing ledger and packet. Preserve the current CSV/manual paths,
provenance rules, and research-only boundary.

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
- [x] Add deterministic age-signal heuristics for all 17 major categories to
  the synthetic, CSV, manual, and MCP review paths, including `Joint age: 35
  years`, while keeping the existing research/wellness boundary visible.
- [x] Extend the active contract with bounded, consent-gated PDF-to-record
  extraction while preserving the CSV-local and clinical-use boundaries.
- [x] Build PDF selection, text extraction/scanned-page rendering, and a
  page-cited candidate review/confirm/edit/dismiss workflow.
- [x] Add the server-only MiniMax function, request limits, and explicit
  de-identification and third-party processing disclosure.
- [x] Exercise the live app's PDF picker → local text/render → consent →
  MiniMax candidate review → page preview → edit/select → confirmed ledger →
  packet export workflow with selectable and scanned synthetic PDFs.
- [x] Verify malformed, password-protected, and over-12 MB synthetic files fail
  locally with extraction disabled and no additional API request.
- [x] Exercise a multi-value PDF for supported unit conversions and same-date
  conflicting sources; verify that the user must choose one candidate and that
  the exported ledger keeps printed and normalized values with provenance.
- [x] Classify equivalent same-field/same-date values as duplicate sources and
  flag non-ISO or impossible printed dates; provide a date control that
  requires explicit correction before entry. Deterministic tests cover these
  rules, and the live API flags an ambiguous date. Corrected dates recompute
  same-field/date duplicate and conflict groups. Selected entries are prepared
  transactionally, so a later invalid selection cannot leave partial ledger
  entries or provenance; blank/invalid edits do not create false zero-value
  duplicate warnings.
- [x] Extend PDF intake from eight to 24 pages while keeping the 12 MiB file
  limit. Send sequential batches of up to six pages with a 3.7 MB UTF-8
  preflight; preserve original source-page citations and keep full-resolution
  page previews in the browser. Test batch boundaries, size limits, malformed
  citations, and cross-batch same-date conflict classification.
- [ ] Repeat the complete production 24-page browser picker → consent → four
  sequential extraction batches → candidate review → page preview → confirmed
  packet-export workflow. The current live synthetic test exercised the four
  production API batches directly; prior live picker-to-export evidence covers
  single-page PDFs.
- [x] Complete a browser file-picker → ambiguous-date correction → confirmed
  entry → packet-export run using a synthetic PDF in Codex's isolated browser.
  The valid ISO correction cleared the warning, edited glucose values
  recalculated duplicate status into a conflict, two selected values entered
  the record, and the app reported the JSON packet downloaded locally. The
  browser download event did not initially expose JSON bytes; a follow-up
  read-only parse of the downloaded 15,281-byte file confirmed printed and
  corrected dates, human-confirmed provenance, and absence of PDF/image data.
- [x] Remove provider and deployment-brand names from user-facing PDF copy
  while retaining a clear third-party processing notice, consent gate, and
  direct link to the AI service privacy policy.
- [x] Hide the clinical CSV file input and remove its observed horizontal
  overflow from the live import surface.
- [ ] Assign the requested `healthspan-review.vercel.app` hostname after its
  currently live deployment is transferred or released by its owner. The new
  project is live at `https://healthspan-review-gules.vercel.app/`; its root,
  `/workbench`, `/manual`, PDF.js assets, and serverless extraction route work.
- [x] Reconcile ROADMAP, product/architecture docs, GitHub Wiki, and Project #4.

### Validation

Previous verification passed 35/35 workspace tests and the canonical verifier
passed all 20 checks; the committed test receipt recorded 179 Python and 29
canonical Node tests. On 2026-09-29, the expanded workspace/parser/API suite
passed 43/43 Node tests, `python scripts/verify_docs.py` passed, and
`uv run python scripts/verify_project.py --json` passed all 20 checks after the
locked `dev`, `ml`, and `data` extras were installed. The canonical receipt
still verifies at 179 Python tests and 29 Node tests. Every verifier run
reports `E-005 blocked`.

After the latest candidate-review changes, the focused parser/API/workbench
suite passed 49/49 Node tests, `python scripts/verify_docs.py` passed, and
`uv run python scripts/verify_project.py --json` passed all 20 checks with
`clinical_gate: E-005 blocked`. `git diff --check` passed. Production deploy
the preceding production deployment `dpl_3w1E8orAprPUKZc2cV2MRoLGBqYZ` was
Ready. Live GET checks returned 200 for
`/`, `/workbench`, `/manual`, and `/docs/pdf-candidate-review.js`; the expected
GET method guard returned 405 for `/api/extract-pdf`. A new synthetic live API
request confirmed duplicate classification after supported unit conversion
and ambiguous-date flagging. A browser E2E run then covered local inspection,
user consent, live extraction, date correction with warning removal, value
editing and conflict recomputation, selected human confirmation, packet-ready
state, and a positive local-download status. The isolated browser did not
expose the downloaded JSON bytes during that run; the exact download was
read back and parsed in the follow-up below.

On 2026-09-29, the live generated-alias workbench completed selectable-text
and scanned-image PDF workflows. For selectable text, the app extracted three
source-cited candidates, opened the rendered source page, allowed fasting
glucose to be edited from the printed 98 to 99, accepted two explicitly
selected fields, and exported a 15,004-byte JSON packet. The exported ledger
retained edited and printed values, page, excerpt, date, and
`user_confirmed_pdf_measurement` provenance; it contained no PDF/image payload.
The scanned PDF returned the same three candidates and a rendered 980 x 1268
source-page preview. On this live page, malformed, encrypted, and 12 MiB+ files
were rejected before extraction; the MiniMax request count remained at the two
successful test requests. These are synthetic engineering checks only.

The latest production deployment was exercised with a synthetic one-page PDF
containing two same-date glucose values plus creatinine and albumin. MiniMax
returned both glucose candidates, marked their disagreement, and conversion
normalized 7.2 mmol/L to 129.7296 mg/dL, 88.4 μmol/L to 1 mg/dL, and 42 g/L
to 4.2 g/dL. The UI required one glucose source to be selected; the exported
packet retained the printed value/unit, normalized value/unit, page excerpt,
date, and user-confirmed provenance for all three selected fields. The packet
contained no PDF or rendered image payload. This was a synthetic engineering
check only.

The prior production API review used synthetic data and caught a MiniMax
misread (`99.089` against printed `99.099`), which stayed visibly conflicting
for source-page review. The preceding deployment
`dpl_3w1E8orAprPUKZc2cV2MRoLGBqYZ` was Ready and aliased at
`https://healthspan-review-gules.vercel.app/`. A fresh
synthetic live API request returned two equivalent glucose candidates after
unit conversion as duplicates and flagged/preserved the ambiguous HbA1c date.
The live browser flow then changed the ambiguous date to `2026-02-01` and
cleared the warning while retaining the printed `01/02/2026` source form;
changing one glucose value recalculated both same-date rows from duplicate to
conflict. The user selected one glucose source and HbA1c, confirmed them into
the ledger, and reached the packet-ready screen. The app reported the JSON
packet downloaded locally, but the browser tool did not provide file bytes in
that initial run. A follow-up read-only parse of the downloaded file is
recorded below.

### Runtime evidence

On 2026-09-29, the PDF interface copy was revised to remove model and hosting
brand names while retaining a clear external-processing notice, per-document
consent, de-identification reminder, and direct link to the service privacy
policy. Visual review also found and fixed an exposed clinical CSV chooser
that caused horizontal overflow. The previous live production deployment for
this copy review was `dpl_1ouEib2kDnGuxcG4amcGyxeY7Gjb` at the existing
generated alias. Live root
and `/workbench` return 200; the rendered page exposes generic external AI
wording, and the user-visible page text and client script no longer contain
provider or function-brand copy. The same-origin PDF GET method guard returns
405 as expected. At that checkpoint, the full canonical verifier passed
20/20, focused PDF/UI checks passed 49/49, docs verification passed, and
`git diff --check` passed.

On 2026-09-29, the source-file cap increased to 24 pages / 12 MiB. The browser
preflights UTF-8 payloads at 3.7 MB and sends up to six pages sequentially per
request, at most four requests per document. A synthetic 24-page production
API run returned candidates on original pages 1, 7, 13, and 19. Its first run
revealed that later-batch citations could be mistaken for local batch page
numbers; the request now carries the original page alongside each batch-local
index, and the corrected run preserved every citation. The exact 24-page
file-picker-to-export browser flow remains unverified; the 24-page integration
test exercised the live endpoint directly. The latest deployment is Ready at
`https://healthspan-review-gules.vercel.app/`. The full Node suite passed 56/56, docs
verification passed, the canonical verifier passed 20/20, and E-005 remains
blocked.

The local workspace was exercised in a headed browser with the complete
synthetic case: 2 dated SECA scans, 10 equipment fields, 5 regional readings,
separate clinical source ledger, 35/35 canonical fields, 0 open minimum-input
items, explicit provenance, all 17 major category age cards including `Joint
age: 35 years`, descriptive deltas, and a ready deterministic packet. Each estimate
records the inputs used and coverage. The `/manual` page filled the same
synthetic profile and reported 35/35 present. The MCP dispatcher returned the
three local review tools and the combined synthetic review returned 35/35 with
17 category estimates, no raw CSV, and no patient identifier.
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

The new `healthspan-review` Vercel project is deployed at
`https://healthspan-review-gules.vercel.app/`. A live synthetic selectable-text
PDF produced page-cited fasting glucose, HbA1c, and albumin candidates with
source excerpts and validated numeric values. A live scanned image PDF with no
embedded text produced the same three candidates through MiniMax image reading.
The prompt-injection sentence in the synthetic source did not produce a
diagnosis or extra fields. The original PDF remained in the browser; only
rendered page content was sent after explicit synthetic-data consent. The
endpoint rejects missing consent, malformed page envelopes, oversized payloads,
and cross-origin requests in focused Node tests; MiniMax credentials are a
sensitive Vercel production environment variable. A 5-request/minute/IP
Vercel Firewall rule is published. Live synthetic sample regression still
shows the 35/35 record and the root/workbench/manual routes return 200.
The first alias root smoke found a 404 due to `cleanUrls` rewrite targets; the
targets were corrected and the redeployed root and `/workbench` now return the
workspace. The exact requested `healthspan-review.vercel.app` hostname is
already in use; Vercel rejected alias assignment with `The chosen alias ... is
already in use.` The existing deployment was left intact. The feature is
deployed and the full interactive PDF file-picker-to-packet-ready sequence is
exercised at the generated alias, including live date correction and conflict
recomputation. Exact-hostname assignment remains open. Independent JSON
artifact readback is complete for the synthetic run described above. Same-date source conflicts and supported unit
conversions were verified in live runs;
duplicate classification and date correction rules pass deterministic tests,
and ambiguous-date flagging was confirmed through the live API. These checks are engineering
evidence only, not clinical approval or patient-data governance.

### Remaining gap

The 2026-09-30 source checkpoint is feature commit `b03b5fc`, including the
strict Origin guard, preserved deployment exclusions, synthetic fixtures,
pinned upstream PDF.js/license, and PDF checks in Linux/Windows CI and the
Pages gate. The full local Node suite passes 56/56 and the canonical verifier
passes 20/20. The earlier manual Vercel deployment is independent of this
source checkpoint; no connected Git repository is configured for Vercel.
Remote runs for `74e91af` failed at Python test collection because CI omitted
the declared `data` extra needed by three pandas receipt tests. The dependency
setup is corrected; the failed runs are retained as failure evidence and do
not verify the PDF checks that had not yet executed.
The dependency repair at `f56dba8` then exposed six receipt tests tied to
external NHANES files in a workstation path. Synthetic builder checks now run
without those files; three exact raw-data comparisons remain conditional on
`HEALTHSPAN_NHANES_DATA_ROOT`. CI without those inputs must report three skips
and cannot claim exact raw-data receipt regeneration.

The extraction API and single-page browser slices are verified, while the
complete 24-page production browser flow remains open. The goal also
remains active through the externally run IR1 comparison: five intended users,
including the manual-workflow comparison and preregistered interpretation
thresholds, are not yet available and no user-value result is claimed.
