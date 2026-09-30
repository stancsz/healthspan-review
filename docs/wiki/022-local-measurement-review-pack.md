# Local Measurement Review Pack with AI-assisted PDF entry

Status: active LOCAL-REVIEW-1 work; In Progress in GitHub Project #4.
Last reviewed: 2026-09-29.

The local-first review workflow turns a SECA TableView CSV into an auditable
packet without uploading the source file. The visible and downloaded packet
records the source format and measurement date, each mapped value and unit,
observed-versus-derived provenance, unmapped rows, unit warnings, derivations,
and the remaining minimum-viable-vector inputs.

The packet does not calculate an FI from a SECA scan alone. It displays null
numerator and denominator fields until the existing MVV-gated assessment path
is completed, and explains that missing FI items are excluded rather than
imputed. When two dated scans exist, deltas are descriptive matched-label
equipment measurements only. They are not evidence of improved health or an
action effect.

Users can download deterministic JSON or print the packet locally. The packet
does not contain the raw CSV or a patient identifier. It is for research and
wellness measurement review only, with no diagnosis, treatment advice, or
validated biological/system age. E-005 remains blocked.

This implementation prepares the frozen workflow surface for the five-user IR1
comparison in `docs/CLINICIAN_WORKFLOW_STUDY.md`. No participant sessions or
real-user results have been completed.

## Clinician-flow interaction prototype, 2026-09-19

An owner-private interaction prototype tests one end-user sequence: clinicians
start with a synthetic measurement ledger, inspect units, provenance and a
missing-input warning, read the FI numerator/denominator caveat, then request a
clinician-edited documentation draft. Its AI endpoint accepts only the fixed
synthetic demo record and rejects every other payload. It is not a
patient-data service, clinical deployment, usability study, or evidence of
clinical utility. The five-user IR1 comparison remains required.

## PDF entry extension

The active LOCAL-REVIEW-1 contract now adds optional AI extraction from PDFs
into the same canonical 35-field review. The PDF stays in the browser; after a
per-file notice and de-identification confirmation, bounded text and rendered
page images are sent to an external AI service for processing. The workbench
links to the service privacy policy without naming implementation providers.
This is external processing, not a local-only path. AI results remain
page-cited candidates and require deterministic validation plus individual
human confirmation before entering the record. The new Vercel project is live
at `healthspan-review-gules.vercel.app`; selectable and scanned synthetic PDFs
both returned source-cited candidates through the live function. The live
workbench completed local inspection, consent, candidate review, page preview,
edit/confirm, and packet export for selectable input; the scanned path also
returned candidates and a rendered page preview. A live multi-value case
verified supported glucose, creatinine, and albumin conversions, same-date
conflict marking and exclusive user choice, with both printed and normalized
values preserved in the export. Malformed, encrypted, and oversized PDFs were
rejected locally. Vercel rejected assignment of the
requested `healthspan-review.vercel.app` alias because it is already in use, so
the existing deployment remains intact. Deterministic tests cover equivalent
duplicates and ambiguous dates, and the live API flags an ambiguous printed
date. The current worktree also recomputes duplicate/conflict groups after
date edits, prepares selected entries transactionally, and excludes blank or
invalid edits from duplicate warnings; 56 Node tests and all 20
canonical checks pass, with E-005 blocked. These safeguards are live in Ready
deployment at `https://healthspan-review-gules.vercel.app/`; the workbench and helper assets
return 200. A synthetic live API request returned equivalent converted glucose
sources as duplicates and flagged/preserved the ambiguous HbA1c date. The live
browser completed extraction, date correction with warning removal,
edited-value conflict recomputation, human confirmation, and packet-ready
status. A read-only parse of the 15,281-byte downloaded JSON packet confirmed
the corrected and printed HbA1c dates, confirmed measurement provenance, and
absence of PDF/image payloads. A live browser visual check also confirmed the
provider-generic processing notice and no horizontal overflow after hiding the
clinical CSV file input. Exact-hostname assignment remains open. This
feature does not establish patient-data governance, intended-user value,
clinical validity, or E-005 approval.

### PDF page capacity, 2026-09-29

At this historical checkpoint, the source file limit was 24 pages and 12 MiB. The browser sent at most six
pages per sequential request, preflights each UTF-8 request size, retains
full-resolution source-page previews locally, and keeps each candidate's
original PDF page citation. A synthetic 24-page production API run completed
four batches and returned source-cited candidates on pages 1, 7, 13, and 19;
the same-date glucose values on pages 1 and 13 were included in cross-batch
conflict-classification tests. The run exercised the production extraction
endpoint directly, not the complete 24-page browser picker-to-export flow;
that live UI sequence remains open. This change is engineering evidence only
and does not affect E-005 or intended-use boundaries.

### Source publication checkpoint, 2026-09-30

Feature commit `b03b5fc` includes the PDF intake source, synthetic fixtures,
pinned upstream PDF.js/license, binary PDF handling, deployment exclusions,
and 27 PDF/workbench checks in Linux/Windows CI and the Pages publication
gate. The full local Node suite passes 56/56 and the canonical verifier passes
20/20. Missing or malformed Origin headers now fail closed in source. The
existing manual Vercel deployment is independent of this source checkpoint;
the Vercel project has no connected Git repository. Source publication does
not close the 24-page browser-flow gap, the IR1 comparison, or E-005.
Remote CI at `74e91af` omitted the `data` extra. The dependency repair at
`f56dba8` exposed workstation-specific raw-file paths in six receipt tests.
Portable synthetic builder checks now always run; three exact raw-data
comparisons require `HEALTHSPAN_NHANES_DATA_ROOT` and explicitly skip if their
external files are absent. Scientific receipts are unchanged; those skips
are not evidence of exact raw-data regeneration.

### 50-page capacity acceptance, 2026-09-30

The current limit is 50 pages / 12 MiB, sent in nine six-page-or-smaller
batches with at least 12.2 seconds between request starts. Throttling permits
two automatic retries, honors Retry-After across manual restarts, and limits
automatic waits to 120 seconds. Consent withdrawal, file replacement, or
reset cancels requests and waits. Larger documents can take several minutes.

Ready deployment `dpl_AtSVJq3KXqnZmmv3uxNfy9zDHNtR` completed the live synthetic
50-page picker → consent → nine HTTP-200 batches → six cited candidates →
page-50 preview → confirmation → JSON export workflow. Candidates retained
source pages 1, 7, 13, 19, 49, and 50; the downloaded 15,721-byte packet retained
three human-confirmed values from pages 1/49/50 without PDF/image payloads.
Consent withdrawal stopped a pacing wait; a 51-page file was rejected locally
with no POST. This supersedes the historical multi-page browser gap for this
selectable-text fixture. Scanned-only 50-page input and live 429 recovery were
not separately exercised. Deterministic tests cover retry/cooldown behavior.
The prepared snapshot passes 68 Node tests, 176 Python tests with three
external-data skips, and all 20 canonical checks. Screenshots and receipts are
in `docs/reviews/pdf-capacity-50-2026-09-30/`. The broader goal remains active;
IR1 participation and E-005 are unchanged.
