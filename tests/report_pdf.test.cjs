const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '..', 'docs', 'report-pdf.js'), 'utf8');

test('PDF evidence retains declined alternatives while excluding them from confirmed counts', () => {
  const context = vm.createContext({ TextEncoder });
  vm.runInContext(source, context, { filename: 'report-pdf.js' });
  const bytes = context.HealthspanReportPdf.build({
    complete_profile: { fields: [] },
    clinical_ledger: [
      { field: 'fasting_glucose', value: 98, unit: 'mg/dL', provenance: { file: 'first.csv', location: 'row 2', evidence: 'Glucose,98' } },
      {
        field: 'fasting_glucose', value: '104', unit: 'mg/dL', provenance: {
          file: 'second.csv', location: 'row 4', evidence: 'Glucose,104', printedValue: '104', printedUnit: 'mg/dL', alternativeNotSelected: true,
          selectedAlternative: { value: '98', unit: 'mg/dL', file: 'first.csv', location: 'row 2' },
        },
      },
    ],
  });
  const pdf = new TextDecoder().decode(bytes);

  assert.ok(pdf.includes('CURRENT CONFIRMED ENTRIES) Tj ET\nBT /F2 18') && pdf.includes('(1) Tj ET'), 'the summary counts only the confirmed reading');
  assert.ok(pdf.toLowerCase().includes('alternative not selected:'), 'the declined candidate has a distinct PDF label');
  assert.ok(pdf.includes('Not selected; not entered into measurements or calculations'));
  assert.ok(pdf.includes('Selected reading for comparison: 98 mg/dL | first.csv | row 2'));
  assert.ok(pdf.includes('Source: second.csv | row 4'));
  assert.ok(pdf.includes('Evidence: Glucose,104'));
});
