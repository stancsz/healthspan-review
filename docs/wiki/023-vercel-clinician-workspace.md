# Vercel clinician workspace

## What changed

The repository now includes a focused static workspace at
[`docs/workbench.html`](../workbench.html). `vercel.json` routes the Vercel
root (`/`) and `/workbench` to that workspace. The original evidence showcase
remains available at [`docs/index.html`](../index.html).

The workspace follows the clinician's first review sequence:

1. Load a local SECA TableView CSV, add a separate canonical clinical CSV, or
   open the complete synthetic sample.
2. Review the latest source ledger, including units and observed-versus-derived
   provenance, plus the regional segment readings retained by the export.
3. Check missing inputs, FI withholding, parser warnings, and descriptive
   deltas before exporting a JSON packet or printing the review.
4. Use the linked manual-entry page when values are available without a CSV.

## Privacy and safety boundary

CSV and manual parsing are performed in the browser; CSV files are not uploaded.
The optional PDF AI feature keeps the source PDF in the browser and sends only
bounded extracted text and rendered page images to an external AI service
after a per-document disclosure and confirmation that direct identifiers have
been removed. The workbench links to the service privacy policy without naming
the implementation provider. The application does not claim to detect all
identifiers, does not persist submitted content, and does not control service
retention. The generated packet omits source files and patient
identifiers.

PDF extraction produces candidates only. Every candidate must preserve its
page, supporting excerpt, printed value/unit/date, normalized value, and
validation state; the user reviews, edits, confirms, or dismisses each before
it changes the record. The AI service credential is server-side. The PDF
endpoint is bounded, enforces same-origin requests, and has a Vercel Firewall
limit of five POST requests per minute per IP. Application code does not log request or
response bodies. The new Vercel project is live at
`https://healthspan-review-gules.vercel.app/`. The requested
`healthspan-review.vercel.app` alias is already in use; Vercel rejected
assignment and its existing deployment remains intact. The generated-alias
workbench has passed live selectable/scanned PDF candidate review, edit,
confirmation, and packet-export flows, plus local rejection of malformed,
encrypted, and oversized PDFs. A live multi-value PDF also verified supported
glucose, creatinine, and albumin unit conversions, same-date conflict flags,
exclusive candidate selection, and an export retaining printed and normalized
values with provenance. Equivalent duplicate and ambiguous/non-ISO date
classification is covered by deterministic tests; the live API flags and
preserves an ambiguous printed date, while the UI requires an ISO-date
correction before entry. The current worktree recomputes duplicate/conflict
groups after date edits, prepares confirmation transactionally, and excludes
blank or invalid edits from duplicate warnings; 56 Node tests and all
20 canonical checks pass, with E-005 blocked. These safeguards are live in
Ready deployment at `https://healthspan-review-gules.vercel.app/`; the workbench and helper
assets return 200. A synthetic live API request returned equivalent converted
glucose sources as duplicates and flagged/preserved the ambiguous HbA1c date.
The live browser completed extraction, corrected-date warning removal,
conflict recomputation, confirmation, and packet-ready state. The app reported
local download completion. A read-only parse of the 15,281-byte downloaded
JSON confirmed the corrected and printed HbA1c dates, human-confirmed
provenance, and absence of PDF/image payloads. A live visual check confirmed
the generic external-processing notice and no horizontal overflow after the
clinical CSV picker was hidden. Live release evidence belongs in
the active LOCAL-REVIEW-1 contract. Exact-hostname assignment remains open.

PDF files are limited to 24 pages / 12 MiB. The browser processes documents in
sequential six-page batches, with a 3.7 MB UTF-8 preflight per request, and
preserves original page numbers in candidate provenance. A synthetic
24-page production API run completed four batches and returned candidates on
original pages 1, 7, 13, and 19. The production picker-to-export flow for a
24-page document remains unverified; prior interactive live evidence covers
single-page PDFs.

The workspace is research and wellness measurement review only. It does not
diagnose, prescribe treatment, estimate lifespan, display a validated
biological or system age, or provide clinical decision support. The FI remains
withheld from a SECA-only preview, and two-scan changes are labeled descriptive
equipment deltas only. E-005 remains blocked.

## Verification

Feature commit `b03b5fc` records the 2026-09-30 source checkpoint, including
the strict Origin guard, deployment exclusions, synthetic fixtures, and
pinned PDF.js/license. Vercel currently has no connected Git repository, so
a source push does not update its manual production deployment. The 27
PDF/workbench checks run in Linux/Windows CI and the Pages publication gate.
The complete local Node suite passes 56/56 and the canonical verifier passes
20/20. These source checks do not establish same-SHA live Vercel verification.

The focused checks are:

```powershell
node --test tests/workbench.test.cjs tests/site_parser.test.cjs
python -m http.server 4179 --directory .
```

The local headed-browser review on 2026-09-21 loaded the complete synthetic
case, rendered 2 dated scans, 10 mapped equipment fields, 5 regional readings,
the separate clinical ledger, 35/35 canonical fields, 0 open minimum-input
items, descriptive deltas, and the `Review packet ready` state. The `/manual`
page filled the same 35 fields and reported 35/35. On the new project, `/`,
`/workbench`, and `/manual` return the workspace. Live synthetic selectable,
scanned, and multi-value PDFs were locally parsed/rendered in the browser;
after consent, the API returned page-cited candidates, and the interactive
flow was completed through edit/selection and packet export. Malformed,
encrypted, and oversized PDFs were rejected before an API request. This is
synthetic engineering evidence only.

## What this does not prove

Local tests and a successful live browser walkthrough prove the static review
workflow is reachable and usable with the synthetic fixture. They do not prove
intended-user value, clinical validity, security or governance for patient
data, or permission to use the tool in clinical care. Those remain separate
IR1, IR6, and E-005 gates.
