# Publication recovery, 2026-10-08

Feature 5f332e5 passed Linux/Windows verification and Pages publication. Live
review found Vercel /docs/index.html redirecting to /docs without a slash,
causing relative evidence assets/navigation to use the root. Commit cfc87c7
adds a conditional directory base before assets; independent live review passes.
Root aliases for site.css, site.js and intake-form.js also handle speculative
browser preloads while the dynamic base is applied.

Pages run37811386351 passed verification, then deployment initially found zero
artifacts. The API later exposed one. A failed-job rerun uploaded another and
lookup found two. After these two failed attempts, repeated reruns were stopped.
The reviewed repair uses github-pages-${{ github.run_attempt }} consistently
for upload/deploy and a bounded five-check visibility gate requiring exactly one
non-expired artifact, with read-only Actions permission. Independent source
review verified the actual gh/jq query and three navigation regressions.

Upstream action inputs were verified from [upload-pages-artifact v4](https://raw.githubusercontent.com/actions/upload-pages-artifact/v4/action.yml)
and [deploy-pages v4](https://raw.githubusercontent.com/actions/deploy-pages/v4/action.yml).
Recovery complete: new Pages run [37812128310](https://github.com/stancsz/healthspan-review/actions/runs/37812128310) passed verification, artifact visibility and deployment for `55722fc`. Linux/Windows verification [37812128667](https://github.com/stancsz/healthspan-review/actions/runs/37812128667) passed. The Vercel evidence route loads three demo choices with no browser errors or failed responses; deployed assets/source and Pages build SHA match. See publication.json. No clinical/user-study gate advances.
