# Complete research app revamp, 2026-10-08

Status: implementation and independent local acceptance complete; publication pending.
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

The prepared snapshot passes the 20-check canonical verifier and the full app Node
suite. Independent local review is READY; live source/asset readback will be retained in
`docs/reviews/app-revamp-2026-10-08/`; software checks cannot establish clinical validity.
