const test = require('node:test');
const assert = require('node:assert/strict');
const review = require('../docs/pdf-candidate-review.js');
const clinical = require('../docs/clinical-parser.js');

test('ISO dates are calendar-valid, not just syntactically shaped', () => {
  assert.equal(review.isValidISODate('2026-02-28'), true);
  assert.equal(review.isValidISODate('2024-02-29'), true);
  assert.equal(review.isValidISODate('2026-02-29'), false);
  assert.equal(review.isValidISODate('2026-02-31'), false);
  assert.equal(review.isValidISODate('01/02/2026'), false);
});

test('correcting ambiguous dates recalculates same-date conflict and duplicate groups', () => {
  const conflict = review.classifyCandidateRows([
    { field: 'hba1c', value: 6.1, date: '2026-02-01' },
    { field: 'hba1c', value: 6.2, date: '2026-02-01' }
  ]);
  assert.deepEqual(conflict, [{ conflict: true, duplicate: false }, { conflict: true, duplicate: false }]);
  const duplicate = review.classifyCandidateRows([
    { field: 'fasting_glucose', value: 99.099, date: '2026-02-03' },
    { field: 'fasting_glucose', value: 99.099, date: '2026-02-03' }
  ]);
  assert.deepEqual(duplicate, [{ conflict: false, duplicate: true }, { conflict: false, duplicate: true }]);
});

test('blank or invalid edited values do not become zero-valued duplicate candidates', () => {
  const rows = review.classifyCandidateRows([
    { field: 'fasting_glucose', value: null, date: '2026-02-03' },
    { field: 'fasting_glucose', value: '', date: '2026-02-03' },
    { field: 'fasting_glucose', value: 'not a number', date: '2026-02-03' },
    { field: 'fasting_glucose', value: 0, date: '2026-02-03' }
  ]);
  assert.deepEqual(rows, [
    { conflict: false, duplicate: false },
    { conflict: false, duplicate: false },
    { conflict: false, duplicate: false },
    { conflict: false, duplicate: false }
  ]);
});

test('a valid corrected date clears the ambiguity warning but preserves source evidence', () => {
  const candidate = { field: 'hba1c', date: '01/02/2026', dateIssue: true, baseIssue: '' };
  assert.deepEqual(review.candidateReviewMessages(candidate, '', { conflict: false, duplicate: false }), [
    'Date is ambiguous or unsupported; enter the source date explicitly'
  ]);
  assert.deepEqual(review.candidateReviewMessages(candidate, '2026-02-01', { conflict: false, duplicate: false }), []);
  const spec = clinical.specs.find(item => item.name === 'hba1c');
  const prepared = review.prepareSelectedCandidates([{
    candidate: { ...candidate, printedValue: '6.1', unit: '%', normalizedUnit: '%', page: 1, evidence: 'HbA1c 6.1%' },
    valueText: '6.1', enteredDate: '2026-02-01', spec
  }], clinical.normalizeValue);
  assert.equal(prepared.ok, true);
  assert.equal(review.toLedgerRecord(prepared.entries[0], spec).printed_date, '01/02/2026');
});

test('confirmed date is exported while the ambiguous printed date remains in provenance', () => {
  const spec = clinical.specs.find(item => item.name === 'hba1c');
  const prepared = review.prepareSelectedCandidates([{
    candidate: { field: 'hba1c', printedValue: '6.1', unit: '%', normalizedUnit: '%', date: '01/02/2026', dateIssue: true, page: 1, evidence: 'HbA1c 6.1%' },
    valueText: '6.1', enteredDate: '2026-02-01', spec
  }], clinical.normalizeValue);
  assert.equal(prepared.ok, true);
  const row = review.toLedgerRecord(prepared.entries[0], spec);
  assert.equal(row.printed_date, '01/02/2026');
  assert.equal(row.measured_at, '2026-02-01');
  assert.equal(row.provenance, 'user_confirmed_pdf_measurement');
});

test('invalid later selection returns no prepared entries, preserving atomic apply', () => {
  const hba1c = clinical.specs.find(item => item.name === 'hba1c');
  const glucose = clinical.specs.find(item => item.name === 'fasting_glucose');
  const prepared = review.prepareSelectedCandidates([
    { candidate: { field: 'hba1c', printedValue: '6.1', unit: '%', date: '', page: 1, evidence: 'HbA1c 6.1%' }, valueText: '6.1', enteredDate: '', spec: hba1c },
    { candidate: { field: 'fasting_glucose', printedValue: '98', unit: 'mg/dL', date: '2026-01-02', dateIssue: true, page: 1, evidence: 'Fasting glucose 98 mg/dL' }, valueText: '98', enteredDate: '2026-02-31', spec: glucose }
  ], clinical.normalizeValue);
  assert.equal(prepared.ok, false);
  assert.deepEqual(prepared.entries, []);
  assert.match(prepared.error, /valid calendar date/);
});
