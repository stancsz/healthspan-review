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

Parsing is performed in the browser. There is no upload endpoint, account
database, or remote processing path in this static workspace. The generated
packet does not include the original CSV or a patient identifier. A local
pseudonym may be used in a clinic's surrounding workflow, but the workspace
does not retain or export one.

The workspace is research and wellness measurement review only. It does not
diagnose, prescribe treatment, estimate lifespan, display a validated
biological or system age, or provide clinical decision support. The FI remains
withheld from a SECA-only preview, and two-scan changes are labeled descriptive
equipment deltas only. E-005 remains blocked.

## Verification

The focused checks are:

```powershell
node --test tests/workbench.test.cjs tests/site_parser.test.cjs
python -m http.server 4179 --directory .
```

The local headed-browser review on 2026-09-21 loaded the complete synthetic
case, rendered 2 dated scans, 10 mapped equipment fields, 5 regional readings,
the separate clinical ledger, 35/35 canonical fields, 0 open minimum-input
items, descriptive deltas, and the `Review packet ready` state. The `/manual`
page filled the same 35 fields and reported 35/35. The public alias is
`https://frailty-index-deficit-accumulation.vercel.app/`; the newest deployment
contains the complete synthetic, separate clinical CSV, and manual-entry slice.

## What this does not prove

Local tests and a successful live browser walkthrough prove the static review
workflow is reachable and usable with the synthetic fixture. They do not prove
intended-user value, clinical validity, security or governance for patient
data, or permission to use the tool in clinical care. Those remain separate
IR1, IR6, and E-005 gates.
