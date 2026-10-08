# 026 — MyForme comparison and recommended product reshape

Reviewed: 2026-10-07. Source baseline: `5c505e9e319f1f1dd50230fb5d6b84264e649526`.
Refreshed: 2026-10-08 against the live public site and the same source baseline.
Status: strategy study completed; FRM-1 age-output correction verified; FRM-2 synthetic clinic companion core workflow implemented and independently reviewed.
Author/decision integrator: Codex. Product owner: repository owner.
Execution authority: LOCAL-REVIEW-1 remains the single active goal. The current
research/wellness boundary and E-005 blocker remain in force.

## Recommendation

Develop a clinic companion that connects **traceable measurement review,
clinician-owned wellness plans, patient follow-through, and next-visit review**.
Start with our musculoskeletal measurement workflow. Preserve the measurement
engine as the foundation; make the product's value the completion of a useful
clinic workflow. Our defensible differentiator is inspectable source values,
units, dates, missingness and comparison limits connected to a versioned plan.
Whether clinics value and pay for this remains a hypothesis.

The first deliverable should be a complete synthetic/local workflow prototype.
This proposal is not approval to host patient data, coach actual patients,
generate treatment recommendations, deploy a new service, or change intended use.
Any material intended-use expansion requires the corresponding steward-approved
product/architecture/goal update and scope-specific review.

## What MyForme publicly describes

Its [methodology](https://www.myforme.ai/how-it-works) describes intake into
structured values, clinician approval of plans and protocol rules, deterministic
rule execution, daily coaching, and practitioner corrections. It claims a
reviewed library of over 600 studies. These are vendor descriptions, not audited
capabilities or independently verified efficacy.

The [clinic offer](https://www.myforme.ai/clinics) lists CAD $349/month for
30 patients, CAD $5 per additional patient, and unlimited practitioners/staff.
Walkthrough-led acquisition and clinic invitation position the clinic as buyer
and supervising operator. Its staffing-savings claim is not measured ROI for us.

The [patient page](https://www.myforme.ai/patients) presents daily goals,
wearables and follow-up through a clinic. Biological-age displays include an
illustrative example. Its RLHF and intervention-attribution language does not
establish model-training methods or causal effects.

The October 7 review of the [privacy policy](https://www.myforme.ai/privacy), dated March 2026, recorded
retained account/coaching data, AI processing of summaries by two named providers,
and wearable integration through Vital. This policy observation is historical:
the October 8 web/HTTP reader returned only `Loading...`, and the hidden browser
open timed out. The policy contents were not freshly verified. Deleting uploaded originals does not
mean deleting structured health information; account deletion allows up to
30 days and legal exceptions. Processor behavior was not independently tested.

At the October 7 checkpoint we directly read the rendered home, clinic, patient,
methodology and privacy pages. Search initially returned an older homepage; several new routes failed
in the web reader but loaded in the browser. The live clinic/methodology pages
take precedence. We did not create an account, access the portal, submit forms,
contact the company, inspect private implementation, or verify integrations.
The October 8 refresh read the home, clinic, patient, methodology and FAQ pages
through their public links; independent public HTML readback also recovered the
clinic, patient and methodology text. Private product behavior remains unknown.

### How the product and buying loop fit together

Forme's public description is a clinic-supervised service:

1. A clinic books a walkthrough and subscribes; staff share a clinic invite.
2. A patient completes intake, uploads reports and optionally connects devices.
3. Structured measurements, approved evidence and clinic protocols inform a
   draft plan; a practitioner reviews it before the patient can see it.
4. Approved protocol rules execute deterministically. The coach explains the
   plan, turns goals into daily actions, answers from clinic instructions and
   uses check-ins/device context within that scope.
5. Progress, questions and alerts return to the practitioner; corrections
   become clinic-specific rules. New plan versions require review.

Steps 1–5 summarize the [clinic offer](https://www.myforme.ai/clinics),
[FAQ](https://www.myforme.ai/faq) and
[methodology](https://www.myforme.ai/how-it-works). Version review in the last
sentence is our proposed explicit control, not a publicly verified Forme
implementation detail. The clinic is buyer and supervisor; daily patient use
is the engagement loop. The proposed business benefit is extending follow-up
capacity and adherence. Neither staffing savings nor clinical outcomes have
been independently established by this review. The FAQ says the EMR remains
the source of care records; an equivalent companion should preserve that boundary.

The evidence library is described as grounding cited recommendations; it is not evidence
of a proprietary trained longevity model. Similarly, clinic corrections becoming
rules do not demonstrate weight-level RLHF, online learning or causal inference.
The public pages do not reveal private architecture, model evaluations, support
performance, integration reliability or patient outcomes.

There are material tensions in the public copy. The patient page says a
supplement stack updates automatically, while the methodology routes medication
and supplement changes back to the prescribing clinician. It also associates
an LDL reduction with cardio adherence without establishing causality. Use the
more restrictive clinician-controlled contract in our proposal; report measured
change and reported adherence separately. Copy neither automated supplement
changes nor intervention-attribution claims. Source:
[patient page](https://www.myforme.ai/patients),
[methodology](https://www.myforme.ai/how-it-works).

## Our actual starting point

| Equivalent capability | What exists here | What we need |
|---|---|---|
| Structured intake | 35 canonical fields; SECA/clinical CSV and manual entry; bounded PDF extraction with source-page review and explicit confirmation | Broader documents require explicit schemas and validation; current PDF extraction does not interpret arbitrary imaging/genetics |
| Measurement baseline | Source/unit/date/missingness review, local JSON/print; canonical Python FI engine | Browser workbench does not compute FI; preserve the distinction between preview, complete assessment and validated output |
| Plan review | Measurement packet and wellness discussion context | Clinician-authored plan, draft/review/approval states, approved versions, expiry/revocation and review ownership |
| Between-visit work | No patient coaching or check-in workflow evidenced | Approved-plan explanation, bounded actions, check-ins and escalation ownership |
| Follow-up | Stateless descriptive two-scan SECA deltas | Versioned plan/check-in history and comparable measurement timeline; no causal attribution |
| Evidence-backed advice | Scientific methodology/evidence records | A separately reviewed intervention catalog with study applicability, quality, provenance and review dates |
| Clinic service | Browser-local review and a bounded extraction endpoint | Authentication, clinic isolation, role authorization, consent, retention/deletion, auditable approval and operations |
| Wearables | No live connectors evidenced | One consented connector with units, timezone, freshness, gaps and disconnect/deletion behavior after workflow value is established |

Source anchors: [product intent](../product-specs/PRODUCT_INTENT.md),
[architecture](../../ARCHITECTURE.md), [packet implementation](../workbench.js),
[clinical parser](../clinical-parser.js), and
[active contract](../../goals/active/local-measurement-review-pack/GOAL.md).
The Python development predictor is an integration fixture, not a validated
longevity model. It can return development numeric point estimates while
category reports withhold ages; this differs from the browser/MCP heuristic
age path described below. Anchors: `src/frailty_engine/model.py`,
`pipeline.py`, and `body_reports.py`. No layer supplies validated age parity.
The external AI feature extracts candidate fields; it is not a plan generator.
The firewall is an abuse control, not patient authentication or governance.

## First equivalent workflow

Use one fixed synthetic case and a clinician-entered wellness plan. Demonstrate
four screens and an exportable end-to-end result:

1. **Review measurements.** Reuse import, source-page confirmation, ledger and
   missingness. Show observed values first. Surface data conflicts and avoid
   invented measurements, scores or ages.
2. **Review a plan.** A practitioner enters a three-month goal, a weekly action,
   limits, patient instructions and a review date. Optional later AI drafting
   must cite approved material and remain a draft. Approval binds the reviewed
   measurement snapshot, plan version and reviewer; editing invalidates it.
3. **Follow today's approved actions.** A synthetic patient sees only the
   approved plan and its explanation, then records completion or difficulty.
   Start with structured check-ins and clinic-authored FAQs. New symptoms,
   contraindications and medication/supplement changes require the clinician;
   unsupported questions produce an explicit handoff, never invented advice.
4. **Prepare the next review.** The practitioner sees missed actions, questions,
   descriptive comparable measurements and any unresolved review requests.
   Separate reported adherence from observed measurements. Export the same
   plan version, approvals, check-ins and provenance for independent readback.

Prototype approvals demonstrate software state transitions only. A synthetic
reviewer name is not actual qualified approval. Until a hosted service is
governed, use local synthetic packets; no automatic reminders or communications.

An initial plan record needs the measurement snapshot identity, plan ID/version,
author, reviewer, status, approved scope, dates, expiry/revocation, source
instructions/evidence and action limits. A check-in needs its plan version,
time, action, reported result and unresolved question. A rule needs approved
conditions, permitted effect, precedence, version and reviewer. The language
model may explain approved content; deterministic code enforces eligibility
and state. Clinical corrections should become reviewed, scoped versioned rules,
not silently retrain a model or change other clinics' behavior.

### Product modules to build around the existing engine

These are proposed boundaries, not a description of Forme's private stack or
an implemented architecture change. Keep the measurement parser, provenance
ledger, deterministic FI engine and PDF candidate review as the foundation.
Build the synthetic loop locally before choosing a hosted stack.

| Module / surface | Responsibility | First acceptance evidence |
|---|---|---|
| Measurement workspace | Existing sources and human-confirmed values become a dated snapshot; show missingness and eligible descriptive deltas | Exported values, units, dates and source references read back exactly; browser FI remains explicit |
| Practitioner review queue | Show draft plans, changes since review, pending questions and the responsible practitioner | A draft never enters the patient view; edits, expired approval and revocation remove eligibility |
| Plan and protocol registry | Version clinic-authored goals/actions, evidence, conditions, limits and approvals | Approval binds exact snapshot/plan/rule versions; clinic corrections remain scoped and reviewed |
| Patient Today view | Explain current approved actions; record completion, difficulty and a question | Each check-in names its plan version; unsupported questions become a visible pending review request |
| Next-visit summary | Join adherence reports, open questions and comparable measurements | One readable export preserves distinctions and history without inferring treatment effect |

Authority should flow through deterministic checks before text generation:
approved intended-use/safety limits → current patient-plan approval → approved
clinic rules → reviewed defaults. This is our proposed precedence. A clinic
rule cannot override the product's safety boundary. Conflicting rules,
insufficient inputs, stale wearable data, expired/revoked approval or an
unavailable service fail closed to explanation or pending practitioner review.
The language model may draft or explain permitted content; it must not approve
a plan, decide access, silently expand an action or activate an unreviewed clinical rule.

For a future hosted version, authorization must bind clinic, user role and
patient membership server-side; selecting a practitioner/patient tab in a
local demo is not authentication. The minimum records are clinic membership,
measurement snapshot, plan version, reviewed evidence/rule version, approval,
check-in, review request and append-only audit event. Keep approval audit separate
from clinical-model approval. Native mobile, genetics, imaging interpretation,
full EMR replacement and many device connectors are outside the first increment.

## Ordered implementation proposal

The canonical status/dependency/owner table is in [ROADMAP.md](../../ROADMAP.md).
Project #4 mirrors FRM-0 through FRM-4. Role owners are proposed; named human
owners and review dates are unassigned until explicitly accepted.

| Item | Deliverable and acceptance |
|---|---|
| FRM-0 | This evidence-backed study and recommendation; source uncertainty, current capability, gates and next steps are explicit. Completion covers planning only. |
| FRM-1 | Restore the withholding boundary across browser, manual, export and MCP output. Withhold unsupported numeric system ages and remove missing-age substitution; retain measured values and missingness. Reconcile active L7, Wiki 025 and public claims. Independent checks cover missing age and absent domain measurements, with no fabricated values. |
| FRM-2 | Synthetic four-screen loop above, with version-bound approval, edit/revocation handling, bounded check-ins, explicit handoff and independent export readback. No patient storage or clinical coaching. |
| FRM-3 | Complete the existing IR1 five-user measurement study against its unchanged manual comparison and comprehension targets. Separately preregister a plan-loop study measuring practitioner review time, corrections, missed approvals and scope comprehension against a manual plan/check-in packet. Define pass/stop rules before sessions; report actual results, not synthetic success. |
| FRM-4 | Only after useful workflow evidence, decide the hosted wellness scope, named reviewers/operators and permitted data use. Prove clinic isolation, consent/withdrawal, approval audit, retention/deletion including processors/backups, failure handling and escalation ownership. Run a governed limited pilot under applicable IR6/IR7 requirements. Add one wearable integration after these prerequisites; wider modalities and native mobile apps follow demonstrated need. |

E-005 and domain validation remain required for the existing age/model claims.
A future measurement-only coaching scope needs its own qualified clinical,
intended-use and jurisdiction review; it must not borrow approval from either
our model tests or the vendor's educational disclaimer.

## Commercial and positioning changes

Recommended future message: **Review the measurements. Approve the plan. See
what happened between visits.** Current public copy must still describe the
research prototype and available measurement-review functions. A future clinic
page should address review burden, source traceability and follow-up; a patient
page should explain clinician oversight and what the approved plan permits.
Use a synthetic walkthrough as the current primary action.

Sell to longevity/wellness clinics already collecting body composition and
functional measurements. The clinic should own the plan and patient invitation;
the patient should get comprehensible actions and control over optional data.
This buying motion fits our existing clinician-first audience better than a
general consumer health chatbot. Research/investor evidence remains a supporting
surface.

Test a clinic subscription with an included patient allowance and a transparent
incremental fee. MyForme's price is a competitor anchor, not our chosen price.
Before pricing, measure extraction, model, connector and support costs plus
practitioner review burden. Interviews should test willingness to pay against
their actual manual workflow. We have no measured demand, retention, staffing
savings or unit economics. Do not promise age reversal, treatment effects,
replacement staffing, broad integration parity or a graded clinical library we
have not built and reviewed.

The first commercial experiment should target an owner-operated longevity or
wellness clinic already using SECA/body-composition and functional measures.
Show a source-confirmed review, a practitioner-entered goal, a week's synthetic
check-ins and a next-visit summary. Ask the buyer to compare it with the existing
spreadsheet/PDF and follow-up process. Test review effort, unresolved questions,
approval errors, repeated use and willingness to pay. Count practitioner review,
support, inference, extraction and connector costs when testing a subscription;
an included patient allowance does not imply unlimited affordable coaching.
FRM-3 owns actual evidence; no recruitment or outreach is performed here.

The achievable first equivalent is **workflow parity for one clinic use case**.
Commercial service parity adds identity, clinic isolation, governed records,
support and one reliable integration. Scientific parity requires independently
reviewed evidence for each offered claim. A synthetic prototype proves the first
workflow's software behavior only. Broad feature parity would hide the riskiest
assumption: whether clinics return to this loop because it makes their work easier.

## Known contradictions at the October 7 study checkpoint

At the October 7 study checkpoint, the inspected source still emitted 17 heuristic `estimated_ages` in the browser
packet. `estimateAgeSignals` substitutes age 45 when age is missing; bone, skin
and cognitive rules have no domain adjustment fields. This contradicts the
root goal/product-intent/architecture withholding policy. Active L7 and Wiki
025 document the heuristic feature; they are not evidence of domain validation.
FRM-1 was open at that checkpoint; the October 8 implementation checkpoint
below records its subsequent repair and verification.

Wiki 008 retains older distribution and P0/P1 completion language; its new
notice marks that baseline as historical. Root GOAL and ROADMAP also retain
dated release narratives predating September 30. Do not treat those earlier
release states as current; the latest dated publication checkpoint and active
contract govern that slice. No full historical-document audit or new release
verification was performed in this strategy task.

At that study checkpoint, FRM-1 through FRM-4 were unimplemented. Current status
is recorded in the dated implementation checkpoint below. Intended-user value
remains unverified, actual patient processing/coaching is not approved, and
E-005 is blocked.

## Skill learning and acceptance record

Reusable method: verify a competitor's rendered current methodology and buying
page before using search snippets; separate marketing, policy and audited
behavior. Compare the actual code output with our intent before mapping parity.
The cached homepage and blanket 'unsupported ages are withheld' summary were
insufficient for this review. Reopen those assumptions only with current live
or runtime evidence. Applied here: use the clinic approval loop as the product
direction and put heuristic-age reconciliation first.

Next owner/check: implementation owner takes FRM-1 before prototyping the plan
loop; independent reviewer exercises browser/manual/export/MCP missing-input
cases. The source study cannot certify clinical readiness or commercial value.
Independent nonauthor strategy review on 2026-10-07 returned READY for content:
capability distinctions, scope, concrete workflow and ordered gates were checked;
66 local links resolved at that checkpoint. The documentation verifier and
`git diff --check` passed after the Wiki 025 warning was added. This was a
documentation check, not a rerun of the application test suites or user study.
Project #4 readback verified LOCAL-REVIEW-1 In Progress first, followed by
FRM-0 Done and FRM-1 through FRM-4 Todo in order. The Wiki publishes this study,
the ordered roadmap and current boundary notices; main-repository edits remain
local for review. No UI deployment or new release verification was performed.

Tracker learning: the CLI draft-body-only edit failed with a blank-title error.
Passing the existing title with the body succeeded; use that form for draft
updates and verify content/status/order by readback. No item was duplicated.

October 8 refresh checkpoint: reused the October 7 study and FRM items rather
than starting a second plan. Live public pages support the core clinic loop and
current price; privacy refresh is unavailable, so its prior observation remains
dated. Explicitly resolved the patient-page/methodology tension in favor of
practitioner control. Next action remains FRM-1, then the synthetic FRM-2 loop;
the request is a strategy comparison, not execution of those implementation items.
Independent nonauthor review on October 8 returned READY for strategy content:
source distinctions, actual capability, module boundaries, ordered acceptance
and alignment across the local authority documents were inspected. The reviewer
suggested clarifying the evidence library description to avoid inferring private
retrieval architecture; that wording is now source-qualified. Application tests
and release checks are outside this
documentation-only refresh; no product behavior changed.

October 8 initial study synchronization closeout: the five-page Wiki refresh was published
at Wiki commit `379a7b8` and confirmed by remote Git and public Markdown readback.
Project #4 readback verified the same 26 items, with LOCAL-REVIEW-1 In Progress
first, FRM-0 Done second, and FRM-1 through FRM-4 Todo in order; all six bodies
contain the October 8 checkpoint. Priorities and dependencies remain in bodies.
Documentation verification and root/Wiki whitespace checks passed. The proposed
sequence and current blockers agree across GOAL, ROADMAP, Wiki and the board;
the L7/heuristic-age conflict remained unresolved at that study synchronization
checkpoint. The later implementation checkpoint below supersedes that status.
Main-source documentation edits remain local for review; no app deployment or
new release verification was performed.


## Implementation checkpoint, 2026-10-08

The local `/clinic-companion` prototype now demonstrates four linked views: measurement provenance, clinician-authored draft and explicit approval, patient Today with check-in, and next-visit summary/export. Approval binds to a synthetic measurement snapshot and plan version; edits and revocation close the patient view, and expired review dates are rejected. No real records are imported, no network service is called by the prototype, and the tab does not persist state.

The homepage and measurement workspace link to the preview. FRM-1 removes heuristic system ages and caller-supplied age pass-through from browser and MCP outputs; visible copy states the evidence gate. The Python and Node suites, canonical repository verifier, independent desktop/mobile UI QA, expiry/revocation/version checks, and synthetic JSON download readback passed. The Wiki and Project #4 were reconciled to this checkpoint. This does not advance IR1, E-005, clinical use, hosting, or paid-pilot readiness; clinic inbox, hosted service, and customer-value evidence remain open.
