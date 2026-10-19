const test = require('node:test');
const assert = require('node:assert/strict');
require('../docs/report-pdf.js');

test('downloadable PDF report reflects the confirmed measurement packet and limits', () => {
  const packet = {
    complete_profile: { present_count: 1, total_count: 35, fields: [
      { field: 'fasting_glucose', value: 98, unit: 'mg/dL', category: 'blood', provenance: 'AI-assisted file · user-confirmed' },
      { field: 'albumin', value: null, unit: 'g/dL', category: 'blood', provenance: null },
    ] },
    assessment_readiness: { assessment_ready: false, missing_requirements: ['6 blood-panel values remain missing'] },
    clinical_ledger: [{ field: 'fasting_glucose', value: 98, unit: 'mg/dL', provenance: { file: 'labs.xlsx', location: 'Sheet1!B4', evidence: 'Fasting glucose 98 mg/dL', uncertainty: 'Check source', printedValue: '5.4', printedUnit: 'mmol/L', printedDate: '2026-10-01', enteredValue: 98 } }],
    frailty_index: { status: 'not_computed_in_browser_review' },
    boundaries: ['No diagnosis or treatment advice.', 'Numeric system-age outputs are withheld.'],
  };
  const bytes = global.HealthspanReportPdf.build(packet);
  const pdf = Buffer.from(bytes).toString('ascii');
  assert.ok(pdf.startsWith('%PDF-1.4'));
  assert.match(pdf, /xref\n0 /);
  assert.match(pdf, /98 mg\/dL/);
  assert.match(pdf, /labs\.xlsx \| Sheet1!B4/);
  assert.match(pdf, /Printed value: 5\.4/);
  assert.match(pdf, /Printed unit: mmol\/L/);
  assert.match(pdf, /Printed date: 2026-10-01/);
  assert.match(pdf, /User-confirmed entered value: 98/);
  assert.match(pdf, /CURRENT CONFIRMED ENTRIES/);
  assert.match(pdf, /6 blood-panel values remain missing/);
  assert.match(pdf, /not computed in this browser review/i);
  assert.match(pdf, /Numeric system-age outputs are withheld/);
  assert.ok(pdf.endsWith('%%EOF\n'));
});

test('PDF report paginates a complete profile and preserves confirmed source metadata', () => {
  const fields = Array.from({ length: 35 }, (_, index) => ({ field: `field_${index + 1}`, value: index + 1, unit: 'unit', provenance: 'synthetic review' }));
  const clinical_ledger = Array.from({ length: 4 }, (_, index) => ({
    field: `clinical_${index + 1}`, value: index + 10, unit: 'mg/dL',
    provenance: { file: 'synthetic.csv', location: `row ${index + 2}`, printedDate: '2026-10-01', printedValue: String(index + 10), evidence: `Measurement ${index + 10}` },
  }));
  const pdf = Buffer.from(global.HealthspanReportPdf.build({
    complete_profile: { present_count: 35, total_count: 35, fields },
    clinical_ledger,
    measurement_ledger: Array.from({ length: 10 }, (_, index) => ({ feature: `seca_${index + 1}` })),
    segment_ledger: Array.from({ length: 5 }, (_, index) => ({ region: `segment_${index + 1}` })),
    assessment_readiness: { assessment_ready: true, missing_requirements: [] },
    frailty_index: { status: 'not_computed_in_browser_review' },
    boundaries: ['Research use only.'],
  })).toString('ascii');
  assert.match(pdf, /1 \/ 5/);
  assert.match(pdf, /5 \/ 5/);
  assert.match(pdf, /Printed date: 2026-10-01/);
  assert.match(pdf, /Equipment readings: 10   \|   Segment readings: 5/);
  assert.match(pdf, /Measurement 13/);
  assert.ok(pdf.endsWith('%%EOF\n'));
});

test('PDF report presents domain coverage, supplied age context, and withheld age status', () => {
  const domains = [
    { id: 'body_composition', label: 'Body composition', measured_fields: ['bmi'], expected_fields: ['bmi', 'waist_circumference'], status: 'partial', age_report: { status: 'withheld_unvalidated', point_estimate: null } },
    { id: 'bone_health', label: 'Bone health', measured_fields: [], expected_fields: [], status: 'not_available', age_report: { status: 'not_available', point_estimate: null } },
  ];
  const pdf = Buffer.from(global.HealthspanReportPdf.build({
    complete_profile: { present_count: 2, total_count: 35, fields: [
      { field: 'age', label: 'Age', value: 45, unit: 'years', provenance: 'CSV' },
      { field: 'bmi', label: 'Body mass index', value: 23, unit: 'kg/m²', provenance: 'CSV' },
      { field: 'waist_circumference', label: 'Waist circumference', value: null, unit: 'cm', provenance: null },
    ] },
    chronological_age_context: { value: 45, unit: 'years', status: 'supplied_not_recomputed' },
    domain_age_reports: domains,
    assessment_readiness: { assessment_ready: false, missing_requirements: [] },
    clinical_ledger: [],
    boundaries: ['Research and wellness use only.'],
  })).toString('ascii');
  assert.match(pdf, /DOMAIN AGE ESTIMATES: WITHHELD/);
  assert.match(pdf, /Supplied age: 45 years/);
  assert.match(pdf, /Domain measurement and age status/);
  assert.match(pdf, /Body composition/);
  assert.match(pdf, /Age estimate withheld/);
  assert.match(pdf, /Recorded fields: 1 of 2/);
  assert.match(pdf, /Recorded: Body mass index/);
  assert.match(pdf, /Not recorded: Waist circumference/);
  assert.match(pdf, /AGE AND REFERENCE STATUS/);
  assert.match(pdf, /Age\/sex-specific reference ranges are unavailable/);
  assert.match(pdf, /Bone health/);
  assert.match(pdf, /No supported measures are included in/);
});

test('PDF report distinguishes an older value from an equivalent repeated source', () => {
  const pdf = Buffer.from(global.HealthspanReportPdf.build({
    complete_profile: { present_count: 1, total_count: 35, fields: [
      { field: 'fasting_glucose', label: 'Fasting glucose', value: 98, unit: 'mg/dL', provenance: 'synthetic' },
    ] },
    clinical_ledger: [
      { field: 'fasting_glucose', value: 98, unit: 'mg/dL', provenance: { file: 'first.csv', location: 'row 2' } },
      { field: 'fasting_glucose', value: 98, unit: 'mg/dL', provenance: { file: 'repeat.csv', location: 'row 4', historical: true, duplicate_source: true } },
      { field: 'fasting_glucose', value: 101, unit: 'mg/dL', provenance: { file: 'older.csv', location: 'row 3', historical: true, superseded: true } },
    ],
    assessment_readiness: { assessment_ready: false, missing_requirements: [] },
    boundaries: ['Research and wellness use only.'],
  })).toString('ascii');
  const readablePdfStrings = pdf.replace(/\\/g, '');
  assert.match(readablePdfStrings, /Previously confirmed \(same reading, additional source\): Fasting glucose/);
  assert.match(readablePdfStrings, /Previously confirmed \(superseded\): Fasting glucose/);
  assert.match(pdf, /first\.csv/);
  assert.match(pdf, /repeat\.csv/);
  assert.match(pdf, /older\.csv/);
});

test('PDF report for the full 35-field and 17-domain packet paginates every domain', () => {
  const fields = Array.from({ length: 35 }, (_, index) => ({ field: `field_${index + 1}`, label: `Field ${index + 1}`, value: index, unit: 'unit', provenance: 'synthetic' }));
  const domainLabels = ['Body composition', 'Fluid and cellular health', 'Muscle health', 'Joint health', 'Bone health', 'Skin health', 'Blood health', 'Cardiovascular health', 'Cardiorespiratory health', 'Immune and inflammatory health', 'Brain and cognitive health', 'Metabolic health', 'Kidney health', 'Liver health', 'Sleep and recovery', 'Lifestyle and function', 'Mental-health history'];
  const pdf = Buffer.from(global.HealthspanReportPdf.build({
    complete_profile: { present_count: 35, total_count: 35, fields },
    chronological_age_context: { value: 42, unit: 'years', status: 'supplied_not_recomputed' },
    domain_age_reports: domainLabels.map((label, index) => ({ id: `domain_${index}`, label, expected_fields: [], age_report: { status: 'not_available', point_estimate: null } })),
    clinical_ledger: [],
    assessment_readiness: { assessment_ready: false, missing_requirements: [] },
    boundaries: ['Research and wellness use only.'],
  })).toString('ascii');
  assert.equal((pdf.match(/\/Type \/Page\b/g) || []).length, 6);
  for (const label of domainLabels) assert.ok(pdf.includes(label), `missing domain ${label}`);
  assert.match(pdf, /Candidate age algorithms and input gaps/);
  assert.match(pdf, /Whole-body age \| NHANES KDM/);
  assert.match(pdf, /Heart age \| NHANES KDM/);
  assert.match(pdf, /triglycerides/);
  assert.match(pdf, /NO PATIENT-SPECIFIC AGE OR REFERENCE INTERVAL/);
  assert.match(pdf, /1 \/ 6/);
  assert.match(pdf, /6 \/ 6/);
  assert.match(pdf, /Supplied age: 42 years/);
  assert.match(pdf, /SYNTHETIC FIXTURE  \/  NOT USER DATA/);
  assert.match(pdf, /Synthetic\) Tj ET/);
});
