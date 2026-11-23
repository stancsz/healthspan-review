# A Research-Use-Only Healthspan Assessment Engine with Explicit Evidence Boundaries

System design, deterministic deficit accumulation, and clinical validation gates

## Abstract

This paper describes research-use-only software for organizing healthspan assessment data and presenting a deterministic deficit-accumulation index with a guarded biological-age interface. The engine accepts a 35-feature assessment, enforces a minimum viable vector, and computes a Rockwood-style frailty index. A synthetic browser companion demonstrates local review and follow-up workflows. The repository explicitly does not establish clinical approval, a validated survival model, a clinical reference panel, or validated uncertainty analysis; it makes no lifespan, diagnostic, mortality, or treatment-effect claim. No patient cohort or clinical outcome evaluation is reported. We describe system boundaries and a validation program requiring governance, representative data, external validation, uncertainty analysis, and workflow evaluation.

## 1. Intended use

Healthspan software can appear clinically authoritative before evidence supports that use. This project treats intended use and evidence boundaries as product requirements. The current software is a research prototype and evidence showcase, not a clinical decision system.

Deficit accumulation is an established research construct, but an implementation does not validate a feature set or resulting score for a population or clinical decision [R1].

## 2. System design

The Python engine validates a 35-feature assessment and computes a deterministic Rockwood-style index; a biological-age interface is guarded. A synthetic clinic companion demonstrates save, review, approval, check-in, and follow-up export. It has no patient accounts, clinic authentication, or hosted patient records.

Local manual and CSV flows are distinct from PDF extraction, which may send de-identified page content to an external AI service only after explicit consent. A browser preview or reproducible calculation cannot establish clinical validity, utility, or regulatory status.

## Product and research values

This research-use-only project organizes structured wellness measurements and computes a deterministic Rockwood-style deficit-accumulation index through a reviewable software workflow.

- **Research use only:** it is not clinically approved and does not establish diagnosis, lifespan, mortality, or treatment effects.
- **Traceable evidence:** synthetic demonstrations and software verification are distinct from patient or outcome evidence.
- **Consent and data boundaries:** local CSV/manual flows differ from PDF extraction that may send de-identified content to an external AI provider after consent.
- **Validation before claims:** E-005 remains blocked; clinical use requires governance, representative cohorts, external validation, uncertainty analysis, and workflow evaluation.

## 3. Evidence and validation gates

The repository states [R3] that it does not ship an approved survival model, a clinical reference panel, or validated uncertainty analysis, and that E-005 remains blocked. Software acceptance and scientific evidence are distinct.

Before clinical claims, fix intended population and measurement definitions; assess missingness, reliability, calibration, subgroup performance, uncertainty, external transportability, and decision consequences. Prospective work requires appropriate ethics review and data governance. Reporting should follow relevant prediction-model guidance such as TRIPOD+AI [R2].

## 4. Limitations and conclusion

This draft reports no cohort, outcome, calibration, survival, treatment-effect, or prospective workflow results. Deterministic behavior does not establish clinical validity.

The current contribution is a bounded prototype with explicit evidence gaps. Clinical utility requires governance, representative validation, uncertainty analysis, and workflow study.

## References

[R1] Rockwood, K., and Mitnitski, A. Frailty in relation to the accumulation of deficits. Journal of Gerontology: Medical Sciences, 62(7), 722-727, 2007. URL: https://doi.org/10.1093/gerona/62.7.722
[R2] Collins, G. S., et al. TRIPOD+AI statement. BMJ, 2024. URL: https://www.bmj.com/content/385/bmj-2023-078378
[R3] Chen, S. Clinical Healthspan and Deficit Accumulation Engine. URL: https://github.com/stancsz/healthspan-review