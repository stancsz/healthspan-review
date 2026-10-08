# Complete research app revamp, 2026-10-08

Status: published; independent local and live acceptance READY for the synthetic research workflow.
Owner: Codex integrator. Ordered delivery: APP-REVAMP-1 in ROADMAP.md.

The synthetic clinic companion is the Vercel entry point. Its four steps connect
an explicitly fictional measurement snapshot to a saved clinician-authored draft,
version-bound demonstration approval, a participant Today card and follow-up.
Edits, expiry and revocation close access and prevent stale follow-up export.
The default review date is 28 days ahead; this is a demo setting, not a care protocol.

Measurements opens the local CSV/PDF workspace; Manual entry supports the 35-field
form; Evidence & limits opens the existing review archive. Navigation works with
clean Vercel routes and the GitHub Pages repository prefix. The pages share a
cream/teal visual family with readable disclosures, compact headings, keyboard
focus and narrow-screen layouts. Evidence citations and existing contracts remain.

Manual edits now invalidate previous review and download state. Synthetic fill
includes canonical units. Workspace reset closes review/export until another
record is opened. PDF worker assets resolve relative to their module so local,
Pages and Vercel paths use the same parser implementation.

CSV and manual values stay in the browser; the companion is synthetic and tab-local.
Optional PDF extraction transmits bounded page content only after consent. No
clinical or patient-data approval is implied. Browser FI is not computed, numeric
system ages remain withheld, E-005 remains blocked, and LOCAL-REVIEW-1 stays active.
The five-user study, patient-data governance, scanned-only 50-page/429 checks and
ownership of healthspan-review.vercel.app remain open.

The published snapshot passes the 20-check canonical verifier and 85 app Node
tests. Python execution passed 176 tests with three external-data skips; the
collection receipt retains its separate 179 Python / 29 Pages-parser counts.

Published checkpoint `55722fcfbb529c625226cc305875224f891f9191`: Linux/Windows verification [37812128667](https://github.com/stancsz/healthspan-review/actions/runs/37812128667) and Pages [37812128310](https://github.com/stancsz/healthspan-review/actions/runs/37812128310) passed. Ready Vercel deployment `dpl_77LCnpVdFSno4q9norVLXoe1q3CL` reports that source SHA; live routes/assets and evidence navigation passed readback with no browser errors or failed responses.

Open [the app](https://healthspan-review-gules.vercel.app/),
[measurements](https://healthspan-review-gules.vercel.app/workbench),
[manual entry](https://healthspan-review-gules.vercel.app/manual), or
[the evidence archive](https://healthspan-review-gules.vercel.app/docs/index).
GitHub Pages retains the [companion](https://stancsz.github.io/healthspan-review/clinic-companion.html)
and [evidence entry](https://stancsz.github.io/healthspan-review/).

Independent review, JSON download readbacks, hashes and recovery evidence are in
[the publication receipt](../reviews/app-revamp-2026-10-08/publication.json).
Software checks cannot establish clinical validity. Native mobile keyboards and
human screen-reader acceptance remain unverified.
