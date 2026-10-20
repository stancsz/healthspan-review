const test = require('node:test');
const assert = require('node:assert/strict');
const { mergeConfirmedBatch } = require('../docs/agent-measurement-state.js');

test('a later file batch adds fields without erasing earlier confirmed measurements', () => {
  const firstSource = { file: 'labs-a.docx', location: 'paragraph 2', evidence: 'Fasting glucose 98 mg/dL' };
  const secondSource = { file: 'labs-b.xlsx', location: 'Sheet1!B4', evidence: 'Grip strength 31 kg' };
  const merged = mergeConfirmedBatch({
    values: { fasting_glucose: 98 },
    units: { fasting_glucose: 'mg/dL' },
    provenance: { fasting_glucose: firstSource },
    history: [],
  }, [{ field: 'grip_strength', value: 31, unit: 'kg', provenance: secondSource }]);

  assert.deepEqual(merged.values, { fasting_glucose: 98, grip_strength: 31 });
  assert.deepEqual(merged.units, { fasting_glucose: 'mg/dL', grip_strength: 'kg' });
  assert.equal(merged.provenance.fasting_glucose, firstSource);
  assert.equal(merged.provenance.grip_strength, secondSource);
  assert.deepEqual(merged.history, []);
});

test('a later confirmation replaces the current value and preserves the earlier source as history', () => {
  const earlierSource = { file: 'labs-a.docx', location: 'paragraph 2', evidence: 'Fasting glucose 98 mg/dL' };
  const newerSource = { file: 'labs-b.pdf', location: 'page 3', evidence: 'Fasting glucose 101 mg/dL' };
  const merged = mergeConfirmedBatch({
    values: { fasting_glucose: 98, hba1c: 5.6 },
    units: { fasting_glucose: 'mg/dL', hba1c: '%' },
    provenance: { fasting_glucose: earlierSource, hba1c: { file: 'labs-a.docx', location: 'paragraph 4' } },
    history: [],
  }, [{ field: 'fasting_glucose', value: 101, unit: 'mg/dL', provenance: newerSource }]);

  assert.equal(merged.values.fasting_glucose, 101);
  assert.equal(merged.values.hba1c, 5.6);
  assert.equal(merged.provenance.fasting_glucose, newerSource);
  assert.deepEqual(merged.history, [{
    field: 'fasting_glucose',
    value: 98,
    unit: 'mg/dL',
    provenance: earlierSource,
    superseded: true,
  }]);
});

test('equivalent repeated readings retain both source records without changing the current value', () => {
  const earlierSource = { file: 'labs-a.docx', location: 'paragraph 2' };
  const newerSource = { file: 'labs-b.xlsx', location: 'Sheet1!B4' };
  const merged = mergeConfirmedBatch({
    values: { fasting_glucose: 98 },
    units: { fasting_glucose: 'mg/dL' },
    provenance: { fasting_glucose: earlierSource },
    history: [],
  }, [{ field: 'fasting_glucose', value: 98, unit: 'mg/dL', provenance: newerSource }]);

  assert.equal(merged.values.fasting_glucose, 98);
  assert.equal(merged.provenance.fasting_glucose, newerSource);
  assert.equal(merged.history.length, 1);
  assert.equal(merged.history[0].superseded, false);
  assert.equal(merged.history[0].provenance.file, 'labs-a.docx');
});

test('declined candidate alternatives retain source evidence without entering confirmed measurements', () => {
  const alternative = {
    sourceCandidateId: 'agent-candidate-1-1',
    field: 'fasting_glucose',
    value: '104',
    unit: 'mg/dL',
    provenance: { file: 'second.csv', location: 'row 4', evidence: 'Glucose,104', alternativeNotSelected: true },
  };
  const merged = mergeConfirmedBatch({ values: {}, units: {}, provenance: {}, history: [], alternatives: [] }, [
    { field: 'fasting_glucose', value: 98, unit: 'mg/dL', provenance: { file: 'first.csv', location: 'row 2' } },
  ], [alternative]);

  assert.deepEqual(merged.values, { fasting_glucose: 98 });
  assert.equal(merged.alternatives.length, 1);
  assert.equal(merged.alternatives[0].value, '104');
  assert.equal(merged.alternatives[0].provenance.file, 'second.csv');

  const repeated = mergeConfirmedBatch(merged, [], [alternative]);
  assert.equal(repeated.alternatives.length, 1, 'reapplying the same candidate batch does not duplicate the evidence row');
  assert.deepEqual(repeated.values, { fasting_glucose: 98 });
});

test('reapplying the same confirmed candidate does not create duplicate measurement history', () => {
  const update = {
    field: 'fasting_glucose', value: 98, unit: 'mg/dL',
    provenance: { sourceCandidateId: 'agent-candidate-2-0', file: 'labs.csv', location: 'row 2' },
  };
  const first = mergeConfirmedBatch({}, [update]);
  const replayed = mergeConfirmedBatch(first, [update]);

  assert.deepEqual(replayed.values, { fasting_glucose: 98 });
  assert.equal(replayed.history.length, 0);
  assert.equal(replayed.provenance.fasting_glucose.sourceCandidateId, 'agent-candidate-2-0');
});

