const test = require('node:test');
const assert = require('node:assert/strict');
const handler = require('./extract-pdf.js');

function sourcePages(numbers) {
  return numbers.map((sourcePage, index) => ({ page: index + 1, sourcePage }));
}

function invoke(body, options = {}) {
  const chunks = [];
  const res = { headers: {}, setHeader(name, value) { this.headers[name] = value; }, end(value) { chunks.push(value); } };
  const req = { method: options.method || 'POST', headers: { host: options.host || 'localhost:3000', origin: Object.hasOwn(options, 'origin') ? options.origin : 'http://localhost:3000' }, body };
  return handler(req, res).then(() => ({ status: res.statusCode, headers: res.headers, body: JSON.parse(chunks.join('')) }));
}

test('candidate normalization accepts canonical values with page evidence and rejects out-of-range values', () => {
  const values = handler.normalizeCandidates([
    { field: 'fasting_glucose', printed_value: '98', unit: 'mg/dL', date: '2026-01-02', page: 1, evidence: 'Fasting glucose 98 mg/dL' },
    { field: 'fasting_glucose', printed_value: '9999', unit: 'mg/dL', date: '', page: 1, evidence: 'Fasting glucose 9999 mg/dL' },
    { field: 'noncanonical_field', printed_value: '1', unit: '', date: '', page: 1, evidence: 'value' },
    { field: 'hba1c', printed_value: '6.1', unit: '%', date: '', page: 2, evidence: 'HbA1c 6.1%' }
  ], sourcePages([1]));
  assert.equal(values.length, 2);
  assert.equal(values[0].value, 98);
  assert.equal(values[0].page, 1);
  assert.equal(values[1].value, null);
  assert.match(values[1].issue, /manual review/);
});

test('candidate page citations from later batches resolve to original PDF pages', () => {
  const pages = sourcePages([7, 8, 9, 10, 11, 12]);
  const values = handler.normalizeCandidates([
    { field: 'fasting_glucose', printed_value: '98', unit: 'mg/dL', date: '2026-01-02', page: 1, evidence: 'Fasting glucose 98 mg/dL' },
    { field: 'hba1c', printed_value: '5.6', unit: '%', date: '2026-01-02', page: 12, evidence: 'HbA1c 5.6%' }
  ], pages);
  assert.deepEqual(values.map(candidate => candidate.page), [7, 12]);
});

test('normalization converts only supported units and flags same-date conflicting candidates', () => {
  const values = handler.normalizeCandidates([
    { field: 'fasting_glucose', printed_value: '5.5', unit: 'mmol/L', date: '2026-01-02', page: 1, evidence: 'Fasting glucose 5.5 mmol/L' },
    { field: 'fasting_glucose', printed_value: '99', unit: 'mg/dL', date: '2026-01-02', page: 1, evidence: 'Fasting glucose 99 mg/dL' },
    { field: 'creatinine', printed_value: '88.4', unit: 'μmol/L', date: '2026-01-02', page: 1, evidence: 'Creatinine 88.4 μmol/L' },
    { field: 'albumin', printed_value: '42', unit: 'g/L', date: '2026-01-02', page: 1, evidence: 'Albumin 42 g/L' }
  ], sourcePages([1]));
  assert.equal(values[0].value, 99.099);
  assert.equal(values[0].unit, 'mmol/L');
  assert.equal(values[0].normalizedUnit, 'mg/dL');
  assert.equal(values[0].unitConverted, true);
  assert.equal(values[1].value, 99);
  assert.equal(values[0].conflict, true);
  assert.equal(values[1].conflict, true);
  assert.equal(values[0].baseIssue, '');
  assert.match(values[0].issue, /Conflicting values/);
  assert.equal(values[2].value, 1);
  assert.equal(values[2].normalizedUnit, 'mg/dL');
  assert.equal(values[3].value, 4.2);
  assert.equal(values[3].normalizedUnit, 'g/dL');
});

test('conflict detection requires an explicit ISO date and unsupported or unitless values fail closed', () => {
  const values = handler.normalizeCandidates([
    { field: 'fasting_glucose', printed_value: '5.5', unit: 'mmol/L', date: '', page: 1, evidence: 'Fasting glucose 5.5 mmol/L' },
    { field: 'fasting_glucose', printed_value: '99', unit: 'mg/dL', date: '', page: 1, evidence: 'Fasting glucose 99 mg/dL' },
    { field: 'fasting_glucose', printed_value: '5.5', unit: '', date: '2026-01-02', page: 1, evidence: 'Fasting glucose 5.5' },
    { field: 'fasting_glucose', printed_value: '99', unit: 'made-up', date: '2026-01-02', page: 1, evidence: 'Fasting glucose 99 made-up' },
    { field: 'fasting_glucose', printed_value: '5.5', unit: 'mmol/L', date: '2026-01-02', page: 1, evidence: 'Glucose 5.5 mmol/L' }
  ], sourcePages([1]));
  assert.equal(values[0].conflict, false);
  assert.equal(values[1].conflict, false);
  assert.equal(values[2].value, null);
  assert.match(values[2].issue, /Unit not printed/);
  assert.equal(values[3].value, null);
  assert.match(values[3].issue, /Unit needs manual review/);
  assert.equal(values[4].value, null);
  assert.match(values[4].issue, /Fasting status is not explicit/);
});

test('equivalent same-date values are marked as duplicates, not conflicts', () => {
  const values = handler.normalizeCandidates([
    { field: 'fasting_glucose', printed_value: '5.5', unit: 'mmol/L', date: '2026-01-02', page: 1, evidence: 'Fasting glucose 5.5 mmol/L' },
    { field: 'fasting_glucose', printed_value: '99.099', unit: 'mg/dL', date: '2026-01-02', page: 1, evidence: 'Fasting glucose 99.099 mg/dL' }
  ], sourcePages([1]));
  assert.equal(values[0].value, values[1].value);
  assert.equal(values[0].duplicate, true);
  assert.equal(values[1].duplicate, true);
  assert.equal(values[0].conflict, false);
  assert.match(values[0].issue, /Equivalent value\/date/);
});

test('ambiguous and impossible printed dates require a human-confirmed date', () => {
  const values = handler.normalizeCandidates([
    { field: 'hba1c', printed_value: '6.1', unit: '%', date: '01/02/2026', page: 1, evidence: 'HbA1c 6.1%' },
    { field: 'hba1c', printed_value: '6.2', unit: '%', date: '2026-02-31', page: 1, evidence: 'HbA1c 6.2%' },
    { field: 'hba1c', printed_value: '6.3', unit: '%', date: '', page: 1, evidence: 'HbA1c 6.3%' }
  ], sourcePages([1]));
  assert.equal(values[0].value, 6.1);
  assert.equal(values[0].date, '01/02/2026');
  assert.equal(values[0].dateIssue, true);
  assert.match(values[0].issue, /Date is ambiguous/);
  assert.equal(values[0].baseIssue, '');
  assert.equal(values[1].dateIssue, true);
  assert.equal(values[2].dateIssue, false);
});

test('API requires consent, valid origin, supported page data, and limits payload size', async () => {
  const previous = process.env.MINIMAX_API_KEY;
  process.env.MINIMAX_API_KEY = 'synthetic-test-key';
  try {
    const page = number => ({ page: number, sourcePage: number, text: '', image: 'data:image/jpeg;base64,AA==' });
    assert.equal((await invoke({ pages: [{ page: 1, text: '', image: 'data:image/jpeg;base64,AA==' }] })).status, 400);
    assert.equal((await invoke({ confirmedDeidentified: true, pages: [{ page: 1, text: '', image: 'data:image/jpeg;base64,AA==' }] }, { origin: 'https://attacker.invalid' })).status, 403);
    for (const origin of [undefined, '', 'not-an-origin']) {
      assert.equal((await invoke({ confirmedDeidentified: true, pages: [page(1)] }, { origin })).status, 403);
    }
    assert.equal((await invoke({ confirmedDeidentified: true, pages: [{ page: 2, text: '', image: 'data:image/jpeg;base64,AA==' }] })).status, 400);
    assert.equal((await invoke({ confirmedDeidentified: true, pages: Array.from({ length: 7 }, (_, index) => page(index + 1)) })).status, 400);
    assert.equal((await invoke({ confirmedDeidentified: true, pages: [{ page: 1, sourcePage: 1, text: '', image: 'data:image/jpeg;base64,' + 'A'.repeat(500_001) }] })).status, 400);
    assert.equal((await invoke({ confirmedDeidentified: true, pages: [page(1), { ...page(2), sourcePage: 3 }] })).status, 400);
    assert.equal((await invoke('x'.repeat(3_900_001))).status, 413);
  } finally { if (previous === undefined) delete process.env.MINIMAX_API_KEY; else process.env.MINIMAX_API_KEY = previous; }
});

test('last batch accepts source page 50 and rejects source page 51 without calling the service', async () => {
  const previousKey = process.env.MINIMAX_API_KEY, previousFetch = global.fetch;
  process.env.MINIMAX_API_KEY = 'synthetic-test-key';
  let calls = 0;
  global.fetch = async (url, options) => {
    calls++;
    assert.match(JSON.stringify(JSON.parse(options.body)), /ORIGINAL PDF PAGE 50/);
    const argumentsValue = JSON.stringify({ candidates: [
      { field: 'albumin', printed_value: '4.5', unit: 'g/dL', date: '2026-01-02', page: 2, evidence: 'Albumin 4.5 g/dL' }
    ] });
    return new Response(JSON.stringify({ choices: [{ message: { tool_calls: [{ function: { arguments: argumentsValue } }] } }] }), { status: 200 });
  };
  try {
    const pages = [49, 50].map((sourcePage, index) => ({ page: index + 1, sourcePage, text: 'Synthetic test page', image: 'data:image/jpeg;base64,AA==' }));
    const result = await invoke({ confirmedDeidentified: true, pages });
    assert.equal(result.status, 200);
    assert.equal(result.body.candidates[0].page, 50);
    assert.equal(result.body.candidates[0].value, 4.5);
    assert.equal((await invoke({ confirmedDeidentified: true, pages: [{ ...pages[0], sourcePage: 51 }] })).status, 400);
    assert.equal(calls, 1);
    assert.deepEqual(handler.normalizeCandidates([{ field: 'albumin', printed_value: '4.5', unit: 'g/dL', date: '', page: 51, evidence: 'Albumin 4.5 g/dL' }], sourcePages([49, 50])), []);
  } finally {
    global.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.MINIMAX_API_KEY; else process.env.MINIMAX_API_KEY = previousKey;
  }
});

test('upstream throttling returns 429 with Retry-After for bounded browser retry', async () => {
  const previousKey = process.env.MINIMAX_API_KEY, previousFetch = global.fetch;
  process.env.MINIMAX_API_KEY = 'synthetic-test-key';
  global.fetch = async () => new Response('', { status: 429, headers: { 'Retry-After': '17' } });
  try {
    const pages = [{ page: 1, sourcePage: 50, text: '', image: 'data:image/jpeg;base64,AA==' }];
    const result = await invoke({ confirmedDeidentified: true, pages });
    assert.equal(result.status, 429);
    assert.equal(result.headers['Retry-After'], '17');
    assert.match(result.body.error, /busy/);
    assert.equal(result.body.candidates, undefined);
  } finally {
    global.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.MINIMAX_API_KEY; else process.env.MINIMAX_API_KEY = previousKey;
  }
});

test('API sends only the bounded page payload to MiniMax and returns validated candidates without persisting input', async () => {
  const previousKey = process.env.MINIMAX_API_KEY, previousFetch = global.fetch;
  process.env.MINIMAX_API_KEY = 'synthetic-test-key';
  let sent;
  global.fetch = async (url, options) => {
    sent = { url, options, body: JSON.parse(options.body) };
    const args = { candidates: [{ field: 'fasting_glucose', printed_value: '98', unit: 'mg/dL', date: '2026-01-02', page: 6, evidence: 'Fasting glucose 98 mg/dL' }] };
    const response = { choices: [{ message: { tool_calls: [{ function: { arguments: JSON.stringify(args) } }] } }] };
    return new Response(JSON.stringify(response), { status: 200 });
  };
  try {
    const sixPages = Array.from({ length: 6 }, (_, index) => ({ page: index + 1, sourcePage: index + 7, text: index === 5 ? 'Fasting glucose 98 mg/dL' : '', image: 'data:image/jpeg;base64,AA==' }));
    const result = await invoke({ confirmedDeidentified: true, pages: sixPages });
    assert.equal(result.status, 200);
    assert.equal(result.body.candidates[0].value, 98);
    assert.equal(result.body.candidates[0].page, 12);
    assert.equal(sent.body.messages[0].content[0].text.includes('PAGE 6 (ORIGINAL PDF PAGE 12) TEXT: Fasting glucose 98 mg/dL'), true);
    assert.equal(sent.url, 'https://api.minimax.io/v1/chat/completions');
    assert.equal(sent.options.headers.Authorization, 'Bearer synthetic-test-key');
    assert.match(JSON.stringify(sent.body), /Fasting glucose 98/);
    assert.equal(JSON.stringify(result.body).includes('synthetic-test-key'), false);
    assert.equal(result.headers['Cache-Control'], 'no-store, private');
  } finally {
    global.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.MINIMAX_API_KEY; else process.env.MINIMAX_API_KEY = previousKey;
  }
});
