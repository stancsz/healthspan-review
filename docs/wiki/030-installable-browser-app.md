# Install the Healthspan Review browser app

**Status (2026-10-19):** Done for this installable-shell increment. The feature
is live in the [Vercel app](https://healthspan-review-gules.vercel.app/workbench)
and [GitHub Pages app](https://stancsz.github.io/healthspan-review/workbench.html).
The authoritative status is in
[`ROADMAP.md`](../../ROADMAP.md) under PWA-1.

The app places an **Install app** button in its header. Chromium browsers that
expose the web install prompt open it from that button. Safari on iPhone/iPad
and browsers without that prompt show instructions to use the browser's own
Add to Home Screen or Install app menu. The installed app opens at the
measurement workbench.

The web app manifest supplies the app name, standalone display mode, theme, and
192/512 pixel icons. A same-origin service worker maintains a small shell cache
for app documents and static assets. It bypasses all API requests and all
non-GET requests; uploaded files and generated reports are not cached. Offline
analysis and offline AI processing are not promised.

This installation option does not change the research-use-only boundary. Use
synthetic or de-identified content only, and follow each feature's consent and
external-processing notice. Numeric category ages remain withheld until their
models and reference evidence are approved.

## Acceptance

The header control and browser-menu fallback were exercised in-browser on both
hosts. Manifest, 192/512 PNG icons, and service-worker endpoints returned HTTP
200 with expected MIME types. Vercel serves `Service-Worker-Allowed: /` for the
root worker; Pages serves the worker within the repository prefix. Source
commit `a005515ef6dcb84782d28d9511ad4aea83f82c5b` passed Pages run
`39339457917` and is served by Vercel deployment
`dpl_Bj9F2Mh36fGK3j8u784buMSDgBtW`. The service-worker source excludes API,
non-GET, range, and cross-origin requests from its cache. The embedded browser
did not expose `beforeinstallprompt`; the native browser prompt path therefore
was not exercised, while the menu-instruction fallback was verified.

See PWA-1 in
[`ROADMAP.md`](../../ROADMAP.md) for release evidence.
