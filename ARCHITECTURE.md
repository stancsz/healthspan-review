# Architecture

Status: current engineering boundary
Owner: project steward
Source of product intent: `docs/product-specs/PRODUCT_INTENT.md`
Source of execution acceptance: `GOAL.md` and `goals/active/*/GOAL.md`

## System shape

The project is a local-first, evidence-bounded research prototype with four
distinct layers:

1. **Measurement contract**: `src/frailty_engine/features.py` defines the
   canonical 35-feature input vector. `mvv.py` rejects incomplete requests
   before assessment.
2. **Deterministic assessment**: `fi.py`, `calibration.py`, `pipeline.py`,
   and `body_reports.py` calculate FI and measurement/category reports. Missing
   values remain missing and the denominator is exposed.
3. **Development prediction interface**: `model.py` exposes a deliberately
   withheld age-equivalent interface backed by a development surrogate. No
   committed survival model, approved reference panel, or clinical uncertainty
   estimate exists in this checkout.
4. **Evidence and delivery surfaces**: `src/frailty_engine/api.py` provides
   the local HTTP contract; `docs/` provides the synthetic public showcase,
   reports, release receipts, and evidence ledger.

## Dependency direction

```text
features / schemas
        ↓
      mvv → fi / calibration / seca
        ↓
     pipeline → model / body_reports / progress
        ↓
       api and docs showcase
```

Training and external-validation harnesses consume explicit manifests and
fixtures. They do not promote an artifact, panel, or clinical claim. Release
receipts and `/readyz` remain fail-closed when production controls are absent.

## Durable invariants

- Public examples contain synthetic data only.
- Unsupported biological-age and system-age claims stay withheld or nullable.
- `clinical_use: forbidden` and `E-005` remain explicit until qualified
  external evidence and approval exist.
- A passing software verifier proves software behavior only. It does not prove
  clinical validity, fairness, treatment effect, or production readiness.
- Local SECA files remain browser-local during the showcase workflow.
- PDF originals remain in the browser. The optional AI intake sends only
  bounded extracted text and rendered page images to a same-origin Vercel
  function and MiniMax after per-file disclosure and de-identification
  confirmation; it never stores source content in the app. MiniMax processing
  and retention remain governed by its current terms and privacy policy.
- AI-extracted values are untrusted candidates with page/evidence provenance.
  Source files are limited to 50 pages / 12 MiB; requests carry at most six
  pages / 3.7 MB. A per-tab PDF scheduler serializes batch starts with a
  12.2-second minimum gap, preserves upstream Retry-After cooldowns across
  manual restarts, and cancels fetches and waits when consent is withdrawn,
  the file changes, or the record resets. Two explicit 429 retries are allowed;
  automatic waits beyond 120 seconds fail with retry-later guidance.
  They enter the measurement ledger only after deterministic validation and
  explicit human confirmation; missing fields stay missing.
- Numeric PDF conversion is limited to explicit glucose (mmol/L to mg/dL),
  creatinine (μmol/L to mg/dL), and albumin (g/L to g/dL) rules. Preserve the
  printed value/unit with the normalized value; reject missing or unsupported
  units. Same-field, same-date disagreement requires one explicit selection,
  equivalent values are labeled duplicate sources, and ambiguous dates require
  explicit correction before entry. Generic glucose evidence cannot populate
  fasting glucose.
- MiniMax credentials are server-only. The public PDF function enforces
  same-origin request checks, bounded inputs, and a Vercel Firewall rate limit
  of five POST requests per minute per IP. Application code excludes request
  and response bodies from logs.
- Documentation must distinguish product intent, architecture, active execution
  work, and retained evidence. Historical receipts do not certify later edits.

## Change control

Product intent and durable invariants belong here or in the product spec.
Implementation progress and runtime evidence belong in the active `GOAL.md`.
Do not add a second planning database below the goal. A material product-intent
change requires steward or owner approval and a corresponding goal update.

## Verification anchors

- Software: `uv run python scripts/verify_project.py --json`
- Documentation: `uv run python scripts/verify_docs.py`
- Receipt: `uv run python scripts/build_test_receipt.py --check`
- Scientific and readiness status: `EVAL.md`, `GOAL.md`, and the dated evidence
  artifacts under `docs/reviews/`
