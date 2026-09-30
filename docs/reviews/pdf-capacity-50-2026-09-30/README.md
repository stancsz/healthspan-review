# PDF capacity acceptance — 2026-09-30

All source and exported values here are synthetic test data, not a patient.

- Production alias: https://healthspan-review-gules.vercel.app/
- Prepared-snapshot deployment: `dpl_AtSVJq3KXqnZmmv3uxNfy9zDHNtR`.
- `network-batches.json` contains sanitized CDP observations of the nine
  actual browser requests: source spans, byte counts, timing, and HTTP status.
  No request image/text bodies or headers are retained.
- `50-page-candidates.jpg` shows all six candidates and original page citations.
- `page-50-preview.jpg` shows the actual original source preview.
- `50-page-packet-ready.jpg` shows the export UI reached by the live run.
- `synthetic-confirmed-packet.json` is the actual recovered browser download,
  independently parsed. Its confirmed ledger cites pages 1, 49, and 50.
- `51-page-rejection.jpg` shows the local limit rejection before any POST.
- `receipt.json` records counts, acceptance outcomes, and remaining limits.

The download-event API timed out; the new file saved in Downloads was recovered
and parsed. Screenshots alone are not proof of exported bytes. The live run
had no throttling responses; 429 recovery is covered by deterministic tests.
Scanned single-page behavior has prior evidence, but a 50-page scanned-only
document was not independently run. E-005 remains blocked.
