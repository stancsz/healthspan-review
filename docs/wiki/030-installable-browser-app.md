# Install the Healthspan Review browser app

**Status (2026-10-19):** local implementation is in progress; browser and
deployment acceptance are pending. The authoritative status is in
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

The feature is ready only after the header control and browser-menu fallback
are exercised in-browser; the manifest and both icons load; the service worker
controls the app route on Vercel and the repository-prefixed Pages deployment;
and API requests remain outside the cache. See PWA-1 in
[`ROADMAP.md`](../../ROADMAP.md) for release evidence.
