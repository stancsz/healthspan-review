# Independent production supplement, 2026-10-08

Reviewer: Codex `release_review`; no product/release authorship.
Target: https://healthspan-review-gules.vercel.app/ . Integrator reports deployment `dpl_BpHtzfm8iKnAEr7YDX3JjDcahwyf`, source `5f332e540908756e48786998af8077b2067f2b56`; exact asset identity is integrator-owned evidence.
Environment: installed Chrome through CUA extension, separate agent-created tab. IAB was unavailable on this continuation. Only fictional built-in samples were used; no external AI submission was sent.

## Verdict

**READY for the observed production synthetic app/navigation scope.** The evidence clean-URL blocker below was repaired and independently rechecked. The local synthetic-app acceptance remains valid, and live main workflows pass. This supplement does not close clinical/user-study gates; exact repaired deployment identity is recorded by the integrator.

## Observed live passes

- Root returns HTTP 200 and loads `/clinic-companion.css`, `/app-nav.js` and `/clinic-companion.js` with HTTP 200. Root initializes a future review date and no app runtime error was observed.
- Root → Measurements navigates to `/workbench`. Save draft → approve v1 → completed check-in → follow-up download works live. Read back [live-followup-packet.json](live-followup-packet.json): current v1, HSR-042 revision 1, exact action, approval/check-in timestamps, no participant name or source document.
- Published synthetic measurement sample reaches 35/35 fields, explicit no-missing state, withheld numeric ages/FI and descriptive comparison. Read back [live-synthetic-measurement-packet.json](live-synthetic-measurement-packet.json): 35 fields, empty estimated ages, `not_computed_in_browser_review`, clinical use forbidden.
- Measurements → Manual navigates to `/manual`. Fill synthetic → Age 60 invalidates old review and disables Download; Review then exports. Read back [live-manual-edited-packet.json](live-manual-edited-packet.json): Age 60, years unit, 35 fields and empty age outputs.
- Published measurement Review at emulated 320px measured document client/scroll widths **320/320**. Temporary metrics were cleared afterward.

## Live evidence clean-URL blocker

Manual's Evidence & limits link `/docs/index.html#evidence` redirects to **`/docs#evidence` without a trailing slash**. The evidence page loads its relative stylesheet and JavaScript from the origin root: `/site.css?v=reviewer-first-2`, `/site.js?v=e104`, `/intake-form.js?v=e104`. Each returned **HTTP 404** in independent read-only HTTP checks. Its Evidence self-navigation resolves `/index.html#evidence`, which redirects to the root companion rather than the evidence archive. Other relative evidence documents/data links are at risk for the same path resolution.

Expected: the evidence archive has a canonical base that resolves its assets, data, document links and self-navigation under `/docs/` while preserving GitHub Pages repository-prefix behavior. The integrator was notified for repair; the following paragraphs record targeted recheck evidence.

**Repair verified:** the integrator added a conditional `/docs/` base before relative assets only for the Vercel `/docs` or `/docs/` evidence route (repair commit reported `cfc87c7`). On the updated production alias, the live DOM at `/docs#evidence` reports base `https://healthspan-review-gules.vercel.app/docs/`; `site.css`, `site.js` and `intake-form.js` resolve under `/docs/` and independently return HTTP 200. Evidence self-navigation retains the evidence title. Actual live cycle evidence → companion → measurements → manual reaches the expected page titles at `/docs/clinic-companion`, `/docs/workbench`, `/docs/manual`. No remaining observed navigation/asset blocker.

**GitHub Pages verified:** the API-reported Pages host is `https://stancsz.github.io/healthspan-review/`. Actual browser traversal companion.html → workbench.html → manual.html → index.html#evidence → companion.html works under that repository prefix. No Vercel base is injected there; its `site.css`, `site.js` and `intake-form.js` independently return HTTP 200.

## Unverified/capability limits

- Live PDF chooser opened, but Chrome extension `setFiles` required its disabled “Allow access to file URLs” permission. Reviewer did not expand extension permissions; production picker/worker behavior is unverified by this tool route. Local IAB picker/worker pre-consent check passed in the primary review; integrator can supply separately isolated installed-Chrome live evidence.
- Live mobile screenshot capture timed out at 5 seconds and again at 15 seconds. DOM containment was measured successfully; accepted local visual evidence remains separate. The retained [live-companion-followup.png](live-companion-followup.png) shows the actual desktop production follow-up.
- Exact repaired candidate metadata/asset hash comparison and remote Actions identities remain integrator-owned release receipts rather than assertions of this browser review.

Learning: Vercel's index clean-URL redirect can remove the final slash and change every relative URL's base. A live main-route smoke is insufficient; exercise the evidence destination's canonical URL and asset responses after navigation.

The conditional base repair closes the observed failure while leaving Pages-relative routes intact. Native browser navigation can finish after a tool's navigation expectation times out; final live DOM/URL observations were used to distinguish actual page readiness from the expectation's timeout. No extra product changes or permission expansion were performed by this reviewer.
