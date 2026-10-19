# Domain-age model compatibility audit — 2026-10-19

## Decision

No category-age estimate or age/sex-matched reference interval can be produced
from the current 35-feature record. The 2026 NHANES KDM study is a candidate
for future body, heart, liver, or kidney ages, but its exact panels exceed the
app's current inputs, it does not publish fitted coefficients or its analysis
code, and it does not report patient-level uncertainty or age/sex-specific
clinical reference intervals. A candidate model is not a currently runnable
algorithm. Joint, muscle, BIA, and other category ages are not supported by
this paper.

## Candidate model compatibility

The paper uses sex-stratified Klemera–Doubal Method (KDM) models fit on
model-specific healthy NHANES cohorts. This table records feature coverage,
not model outputs.

| Candidate construct | Published NHANES panel | Current contract coverage | Key missing inputs / protocol gaps | Patient age result and reference interval |
|---|---|---|---|---|
| Whole-body / body age | Albumin, ALP, BUN, creatinine, CRP, HbA1c, uric acid, WBC, lymphocyte %, MCV, RDW, diastolic BP, pulse pressure | Albumin, ALP, creatinine, hs-CRP, HbA1c, WBC, RDW, SBP and DBP | BUN, uric acid, lymphocyte %, MCV. CRP assay harmonization is not established; pulse pressure needs same-session source/protocol. | Not runnable; no fitted coefficients, patient uncertainty, or matched age/sex interval. This is whole-body age, not a blood-system age. |
| Heart age | DBP, SBP, fasting glucose, total cholesterol, HDL, LDL, fasting triglycerides | DBP, SBP, fasting glucose | Total cholesterol, HDL, LDL, triglycerides; standardized fast/lab protocol and harmonization | Not runnable; no fitted coefficients, patient uncertainty, or matched age/sex interval. |
| Liver age | AST, ALT, GGT, ALP, LDH | ALP | AST, ALT, GGT, LDH; assay compatibility | Not runnable; FIB-4 is not a substitute for these inputs. No patient uncertainty or matched age/sex interval. |
| Kidney age | Urine albumin, urine creatinine, serum creatinine, BUN, uric acid, phosphorus, bicarbonate | Serum creatinine and eGFR | Urine albumin, urine creatinine, BUN, uric acid, phosphorus, bicarbonate; assay and specimen protocol | Not runnable; eGFR is not a substitute for the model panel. No patient uncertainty or matched age/sex interval. |
| Joint, muscle, bone, skin, brain, immune, fluid/cellular, or sleep age | No corresponding panel in the cited paper | Various descriptive measurements or history flags | A named construct, standardized protocol, frozen model, and matched reference cohort must be selected separately | No compatible model identified; leave unscored. |

## Closest runnable whole-person candidate

Clinical PhenoAge is a published whole-person, mortality-equivalent estimate,
not a blood-system or organ age. Its fixed formula requires chronological age
and albumin, creatinine, glucose, CRP, lymphocyte percentage, MCV, RDW, ALP,
and WBC with the original units and transformations. The current contract lacks
lymphocyte percentage and MCV; glucose fasting status and CRP assay/unit
compatibility also need confirmation. A partial panel or substituted fields
would not be the published algorithm. This candidate could be a first
whole-person score after its complete inputs and validation are in place, but
it does not provide a patient-level age/sex-matched range or satisfy the
requested joint/blood/organ-specific estimates.

## Reference interpretation

The paper's KDM age gap (estimated age minus chronological age) and positive/
negative sign grouping are research outcomes, not individual age/sex-matched
clinical reference ranges. Its internal cross-validation MAE is a population
performance summary, not a person's confidence interval. Age/sex-specific
ranges for measured biomarkers are a separate deliverable: they need
assay/device-specific reference populations, age and sex strata,
protocol-compatible distribution estimates, provenance, and independent
review. Existing development bands in this repository are not those ranges.

## Reproduction and rights

The paper says KDM was implemented using the BioAge R package and public
NHANES data. The BioAge toolkit paper describes sex-specific KDM fitting and
publishes GPL-3.0 code. The 2026 paper's own analysis code and fitted
coefficients are not public; its paper license is CC BY-NC-ND 4.0. Any future
implementation must distinguish a documented independent rebuild from exact
reproduction, review code/data licensing, pin the training cohort and
preprocessing, and validate missingness, calibration, uncertainty,
repeatability, external transport, and subgroup support before numeric output.

## Recommended next step

Heart is the smallest candidate schema expansion because four lipid measures
are missing, compared with the longer additions for other panels. A future
heart-age slice still needs standardized inputs, a reproducibly trained and
frozen sex-stratified KDM model, external/subgroup validation, a patient-level
uncertainty method, and a separately built age/sex-specific reference
distribution. Do not substitute a partial score or relabel systemic PhenoAge
as heart age. Keep numeric category-age fields null until the model and
reference evidence are independently accepted and E-005 is resolved.

## Sources

- Zheng et al. (2026), [NHANES body/heart/liver/kidney KDM study](https://www.nature.com/articles/s41538-026-00799-3), including Supplementary Table 13.
- Kwon et al. (2021), [BioAge toolkit paper](https://pmc.ncbi.nlm.nih.gov/articles/PMC8602613/).
- [BioAge KDM implementation (GPL-3.0)](https://github.com/dayoonkwon/BioAge/blob/master/R/kdm_calc.R).
- Levine et al. (2018), [clinical PhenoAge derivation](https://pmc.ncbi.nlm.nih.gov/articles/PMC5940111/).
- CDC, [NHANES data and documentation](https://www.cdc.gov/nchs/nhanes/).
