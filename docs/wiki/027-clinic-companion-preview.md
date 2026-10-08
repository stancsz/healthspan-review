# 027 — Synthetic clinic companion preview

Updated: 2026-10-08. The local `/clinic-companion` page demonstrates a clinic workflow around the existing measurement-first product.

## Workflow

1. Inspect a small, clearly synthetic record with source and date labels; numeric system-age outputs remain withheld.
2. Enter a clinician-authored wellness action and save a private draft.
3. Explicitly approve the plan. The approved snapshot binds to case HSR-042 revision 1 and the plan version.
4. Show only the current approved version in the participant Today view; collect a bounded synthetic check-in.
5. Return the check-in and plan version to follow-up and download a small JSON summary.

Changing a field invalidates approval and closes patient access. Revocation clears access and check-in. A past review date cannot be approved. The prototype stores state only in the current tab; it imports no user records, has no service calls, and provides no automated advice.

This is a local product-research prototype. It does not authorize patient-data hosting, real patient coaching, medication/supplement recommendations, clinical use, commercial value, or deployment. E-005 and intended-user value remain open. See the ordered FRM-0–4 stages in [ROADMAP.md](../../ROADMAP.md) and the [MyForme comparison](026-forme-product-reshape-2026-10-07.md).

The 2026-10-08 browser checkpoint verified the visible measurement and draft screens, draft save, version-bound approval, patient check-in, follow-up state, and edit invalidation at the desktop width. Mobile overflow measurement reports no horizontal scrolling at 390 CSS pixels. Independent desktop/mobile QA, version re-approval, expiry/revocation checks, and JSON download readback passed. Mobile viewport at 390 CSS pixels measured 390 wide with no horizontal overflow.
