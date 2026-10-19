# OpenCode research file workspace

**Status (2026-10-19):** deployed at the production app. Current provider-backed
synthetic checks, deployment, and repository status are recorded in
[`ROADMAP.md`](../../ROADMAP.md) OCA-1 and the active [goal](../../GOAL.md).

The `/agent` workspace uses the actual OpenCode runtime with MiniMax M3 through
OpenRouter. It is separate from the existing measurement workbench; that
workbench continues to parse CSVs in the browser. The new workspace accepts
bounded PDF, image, CSV/TSV, and text/Markdown/JSON files. The API enforces
explicit consent before accepting files.

Each run uses a one-CPU Vercel Sandbox with network egress limited to OpenRouter.
A Vercel firewall transform injects the server-side OpenRouter key into
requests, so it is not sent to the browser or placed in the agent VM. Sandbox
stop is requested after each run; its maximum lifetime is 90 seconds and the
function limit is 120 seconds. Public use is free for now, with request-size/
runtime limits and an active per-IP Vercel Firewall rule.

Use synthetic or de-identified material only. The app does not approve
identifiable health data, clinical decisions, diagnosis, or treatment. Content
processing/retention by OpenRouter and its model providers is governed by their
policies. Users should verify summaries against their sources.

## Verification

Production deployment `dpl_FWWst1FSjvuiEaCFvcf2RnQuS2fs` serves
https://healthspan-review-gules.vercel.app/agent. Fourteen API tests pass.
Synthetic CSV, PDF-only, screenshot-only, and combined PDF/screenshot uploads
returned useful results; the test PDF's instruction-like string was handled as
untrusted data. The browser file-picker → consent → submit flow was verified,
and workspace tools extracted PDF text. Missing or false consent returned HTTP 400. The source-matched
public page, CSS, and JS contain no OpenRouter key; API GET returns 405 without
key exposure. The 5 requests/minute/IP Vercel Firewall rule covers both AI POST
routes. Production deployment and commit state are tracked in `GOAL.md` and
`ROADMAP.md`.

The OpenRouter key is configured as a sensitive Production environment variable
and is brokered to egress by Vercel; it does not enter the sandbox. E-005, IR1,
identifiable health data governance, and clinical use remain unchanged.

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
