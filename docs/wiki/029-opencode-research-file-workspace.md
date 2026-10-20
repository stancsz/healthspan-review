# OpenCode research file workspace

**Status (2026-10-19):** deployed at the production app. Current provider-backed
synthetic checks, deployment, and repository status are recorded in
[`ROADMAP.md`](../../ROADMAP.md) OCA-1 and the active [goal](../../GOAL.md).

The `/agent` workspace uses the actual OpenCode runtime with MiniMax M3 through
OpenRouter. It is separate from the existing measurement workbench; that
workbench continues to parse CSVs in the browser. The agent has been verified
on bounded PDF, image, CSV/TSV, TXT, DOCX, and XLSX fixtures; it accepts other
file extensions inside the same request bounds but may report them unreadable.
The API enforces explicit consent before accepting files.

Each run uses a one-CPU Vercel Sandbox with network egress limited to OpenRouter.
A Vercel firewall transform injects the server-side OpenRouter key into
requests, so it is not sent to the browser or placed in the agent VM. Sandbox
stop is requested after each run. The final PDF repair uses a 150-second
sandbox cap and a 180-second function limit. Public use is free for now, with
request-size/runtime limits and an active per-IP Vercel Firewall rule.

Use synthetic or de-identified material only. The app does not approve
identifiable health data, clinical decisions, diagnosis, or treatment. Content
processing/retention by OpenRouter and its model providers is governed by their
policies. Users should verify summaries against their sources.

## Verification

Production deployment `dpl_8KaLS7mtzUMXQyEXRqvWxUpk5vBP` serves
https://healthspan-review-gules.vercel.app/agent. Fourteen API tests pass.
Synthetic CSV, PDF-only, screenshot-only, and combined PDF/screenshot uploads
returned useful results; the test PDF's instruction-like string was handled as
untrusted data. The browser file-picker → consent → submit flow was verified,
and workspace tools extracted PDF text. Missing or false consent returned HTTP 400. The source-matched
public page, CSS, and JS contain no OpenRouter key; API GET returns 405 without
key exposure. The prior handler failed before request validation because
CommonJS loaded an ESM-only dependency. Commit `ca9e350` loads the Sandbox SDK's
ESM entry; current CI passes on Linux and Windows. A post-deploy synthetic CSV
request returned HTTP 200, three rows, and mean 20 without key exposure. The
5 requests/minute/IP Vercel Firewall rule covers both AI POST
routes. A bounded production pressure run across two five-request windows
tested DOCX, PDF, PNG, CSV, and TXT fixtures: 9 of 10 returned HTTP 200. A
51-page synthetic PDF hit the old 90-second sandbox cap and returned 502;
sanitized Vercel logs confirmed exit 143 near that cap. The local repair streams
`pdftotext` output into a 120,000-character limit, labels every extracted page
with its original number (including blank leading pages), and uses a 150-second
sandbox cap with a 180-second function cap. Local verification passed 118 Node
tests plus the canonical and docs verifiers. Commit `b711b4c` is deployed as
`dpl_7mxwzXFcbycZ9gtD4haCv6B3NpWF`, and Vercel metadata confirms the
180-second function timeout. A targeted production 51-page retry returned a
bounded 502 after 106.6 seconds. Sanitized logs show a tool call but no valid
measurement JSON after the single schema retry. The timeout increase did not
fix this case. Follow-up commit `850be97` omits successfully extracted source
PDFs from OpenCode's workspace list and directs it to the numbered text
companion only. It is deployed as `dpl_9UACvM5CzGJWs8fEuvRnJsrk5LLj`, with the
180-second function timeout confirmed. A targeted production rerun of the
synthetic 51-page PDF returned HTTP 200 in 100.9 seconds with six candidates,
source locations/evidence, exact filename, zero unreadable files, and no
OpenRouter-key pattern. The original two-window sample remains 9/10 and is not
a general reliability estimate. Full local verification passes 121 Node
tests, the canonical verifier, and docs verification. Independent review found
that `850be97` hid the original PDF path in instructions but left the file
accessible in the sandbox, and found a duplicate-filename fallback edge case.
Commit `5d8fe7b` uses the Vercel SDK's `sandbox.fs.unlink` only after the text
companion is written and identifies the source by exact workspace path. If
deletion fails, the original stays listed and the companion is not advertised;
PDFs without meaningful extracted text remain available for visual inspection.
The fix is deployed as `dpl_84BNxkZmNr9VZT7cZpbbQRbSnuSq`, with the 180-second
function timeout confirmed. The targeted synthetic 51-page rerun returned HTTP
200 in 109.4 seconds with six candidates, source locations/evidence, exact
filename, zero unreadable files, and no key pattern. A second detail rerun
returned the same six values and page citations as the known synthetic fixture
(pages 1, 7, 13, 19, 49, and 50) in 87.2 seconds, but marked one item
unreadable. Full local verification
passes 121 Node tests, the canonical verifier, and docs verification. A fresh
five-request production window on the final deployment then tested synthetic
DOCX, the same 51-page PDF, screenshot, CSV, and TXT fixtures. All five
returned HTTP 200 in 33.3, 66.4, 14.0, 11.8, and 14.9 seconds respectively,
with source locations/evidence and no key pattern. The PDF returned six
candidates and zero unreadable files. This adds a successful current-deployment
mixed-format sample; the earlier 9/10 sample is retained and neither window
establishes sustained reliability. The full candidate-confirmation and PDF
download flow has been verified for synthetic DOCX and small-text inputs, but
not yet for the 51-page PDF. The independent reviewer found no concrete defect
in the final cleanup flow. The
initial pressure sample remains 9/10; this targeted case is not a general
reliability guarantee. OCA-2 is complete for the bounded
synthetic/de-identified scope; age-model and clinical gates remain open.
Deployment and commit state are tracked in `GOAL.md` and `ROADMAP.md`.

The OpenRouter key is configured as a sensitive Production environment variable
and is brokered to egress by Vercel; it does not enter the sandbox. E-005, IR1,
identifiable health data governance, and clinical use remain unchanged.

Additional production acceptance (2026-10-19): a single request containing
synthetic DOCX, small PDF, PNG, CSV, and TXT returned 17 evidence-bearing
candidates across all five files, with zero unreadable files. A separate
synthetic XLSX request returned glucose 98 mg/dL from row 2/cells A2:C2 and
HbA1c 5.6% from row 3/cells A3:C3, with sheet/cell citations. Both were served
by MiniMax M3 via OpenRouter without a key-pattern exposure. This confirms
these formats and mixed-file batching for the tested fixtures, not universal
file compatibility or the untested 51-page PDF UI flow.

## Per-domain age output status

The downloadable measurement-review PDF reports domain coverage, but it does
not currently run a validated per-domain age algorithm. A 2026 paper reports
NHANES KDM models for body, heart, liver, and kidney age; its exact biomarker
panels exceed the app's current 35 fields. The paper does not publish fitted
coefficients or analysis code and does not provide patient-level uncertainty
or age/sex-specific reference intervals. Joint age is not supported by that
paper. The compatibility audit lists the exact missing inputs and model
limits: [domain-age compatibility matrix](https://github.com/stancsz/healthspan-review/blob/main/docs/DOMAIN_AGE_MODEL_COMPATIBILITY_2026-10-19.md).
The app therefore leaves numeric category ages and age/sex-matched ranges
unscored rather than calculating a partial or relabeled age.

Production batch acceptance (2026-10-19): two separate synthetic text files
for fasting glucose (92 mg/dL) and grip strength (29 kg) each produced one
grounded OpenCode candidate with source-line evidence. Each candidate was
individually confirmed into the ledger. The resulting PDF was downloaded and
reopened as a six-page letter-size report (42,932 bytes); its full field table
included both confirmed values, and the category pages clearly showed the
supplied 45-year context, recorded-measurement coverage, withheld ages, and
unavailable matched ranges. This closes batch-merge UI acceptance, not
model validity. A later live burst sent five synthetic research requests
simultaneously; all returned HTTP 200 from MiniMax M3 via OpenRouter within 14
seconds. This is one five-way burst under the five-requests/minute firewall,
not sustained-load evidence.

Follow-up production acceptance (2026-10-19): deployment
`dpl_G1AidvYzRZisKpJQWnvjMDPDfTZW` processed a synthetic DOCX and intentionally
opaque binary in one request. Four DOCX candidates included source locations
and evidence; the opaque file was explicitly marked unreadable; no file was
left unaccounted and no provider-key pattern appeared. The API now flags any
upload omitted from both candidates and unreadable entries for manual review,
canonicalizes numbered workspace aliases consistently, and rejects filename
collisions after normalization. Declined same-field candidates remain visible
in the workbench and PDF as unselected evidence but do not enter confirmed
measurements or calculations. Local PDF tests cover this status and confirm
repeated confirmation does not duplicate history. The production workbench
header visibly includes **Install app**. `npm test` passes 124/124 and the
canonical verifier passes 20/20 with E-005 blocked. This bounded sample does
not establish universal file compatibility, sustained provider reliability,
or numeric category-age validity. The 51-page synthetic PDF UI path passed
once end to end: six candidates were returned, a page-7 HbA1c of 5.6% was
confirmed, and the page-49 6.0% alternative remained evidence-only. The
seven-page letter-size report (42,958 bytes) reopened and rendered with clear
cover, source-evidence, alternative-status, and withheld-age sections. This is
one bounded UI acceptance, not sustained-load evidence.
