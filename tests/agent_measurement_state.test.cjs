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

