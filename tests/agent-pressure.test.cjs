const test = require('node:test');
const assert = require('node:assert/strict');
const handler = require('../api/opencode-agent.js');
const sandboxSdkPromise = import('@vercel/sandbox');

const consent = true;
const basePrompt = 'Review synthetic measurements only.';
const encoded = (size) => Buffer.alloc(size, 0x61).toString('base64');
const file = (name, size = 16) => ({ name, data: encoded(size) });
const request = (files, extra = {}) => ({ prompt: basePrompt, consent, files, ...extra });

function candidate(overrides = {}) {
  return {
    field: 'fasting_glucose',
    value: '98',
    unit: 'mg/dL',
    date: '2026-01-02',
    file: 'synthetic-labs.docx',
    location: 'Table 1, row 3',
    evidence: 'Fasting glucose: 98 mg/dL',
    uncertainty: '',
    ...overrides,
  };
}

test('pressure: repeated body validation and output parsing remain stable', () => {
  const body = request([file('scan.opaque'), file('labs.docx')], { mode: 'measurement-review' });
  const result = JSON.stringify({ candidates: [candidate()], unreadable: [] });
  for (let i = 0; i < 1000; i++) {
    assert.equal(handler.validateBody(body), null);
    const parsed = handler.parseMeasurementOutput(result, ['synthetic-labs.docx']);
    assert.equal(parsed.candidates.length, 1);
    assert.equal(parsed.candidates[0].value, '98');
  }
});

test('file count and byte limits accept exact boundaries and reject one step beyond', () => {
  assert.equal(handler.validateBody(request(Array.from({ length: 6 }, (_, i) => file(`f${i}.bin`)))), null);
  assert.match(handler.validateBody(request(Array.from({ length: 7 }, (_, i) => file(`f${i}.bin`)))), /between 1 and 6/);

  assert.equal(handler.validateBody(request([file('exact-2mb.bin', 2 * 1024 * 1024)])), null);
  assert.match(handler.validateBody(request([file('over-2mb.bin', 2 * 1024 * 1024 + 1)])), /2 MB or smaller/);
  assert.equal(handler.validateBody(request([file('exact-total-2mb.bin', 2 * 1024 * 1024), file('exact-total-1mb.bin', 1024 * 1024)])), null);
  assert.match(handler.validateBody(request([file('total-2mb.bin', 2 * 1024 * 1024), file('over-total-1mb.bin', 1024 * 1024 + 1)])), /3 MB or smaller/);
});

test('malformed base64 and invalid basenames fail closed while arbitrary names remain supported', () => {
  for (const data of ['!', 'YQ', 'Y===', 'YQ==junk', 'ab=c', '====']) {
    assert.match(handler.validateBody(request([{ name: 'payload.bin', data }])), /could not be read/);
  }
  for (const name of ['', '.', '..', 'x'.repeat(121)]) {
    assert.match(handler.validateBody(request([{ name, data: Buffer.from('x').toString('base64') }])), /name is invalid/);
  }
  assert.equal(handler.validateBody(request([{ name: 'folder\\odd name.🧪', data: Buffer.from('synthetic').toString('base64') }])), null);
});

test('measurement parsing maps display labels to canonical IDs and filters unsupported claims', () => {
  const parsed = handler.parseMeasurementOutput(JSON.stringify({ candidates: [
    candidate({ field: 'Fasting glucose' }),
    candidate({ field: 'Grip strength', value: 31, file: 'synthetic-labs.docx' }),
    candidate({ field: 'Fasting glucose', file: 'not-uploaded.pdf' }),
    candidate({ field: 'invented_biological_age' }),
    candidate({ field: 'albumin', location: '', evidence: 'Albumin: 4.3 g/dL' }),
    candidate({ field: 'creatinine', location: 'Page 2', evidence: '' }),
    candidate({ field: 'RDW', value: 'x'.repeat(101) }),
  ] }), ['synthetic-labs.docx']);

  assert.deepEqual(parsed.candidates.map((item) => item.field), ['fasting_glucose', 'grip_strength']);
  assert.equal(parsed.candidates[0].value, '98');
  assert.equal(parsed.candidates[1].value, '31');
});

test('empty reviews and unreadable-file reports are valid, bounded results', () => {
  assert.deepEqual(handler.parseMeasurementOutput('{"candidates":[],"unreadable":[]}', ['opaque.bin']), { candidates: [], unreadable: [] });
  const parsed = handler.parseMeasurementOutput(JSON.stringify({
    candidates: [],
    unreadable: [
      { file: 'opaque.bin', reason: 'No supported text or image decoder found.' },
      { file: 'not-uploaded.bin', reason: 'Must be filtered.' },
      { file: 'opaque.bin', reason: 'r'.repeat(300) },
      null,
    ],
  }), ['opaque.bin']);
  assert.equal(parsed.candidates.length, 0);
  assert.equal(parsed.unreadable.length, 2);
  assert.equal(parsed.unreadable[0].file, 'opaque.bin');
  assert.equal(parsed.unreadable[1].reason.length, 240);
  assert.deepEqual(handler.parseMeasurementOutput('{"candidates":[]}', ['opaque.bin']), { candidates: [], unreadable: [] });
  assert.equal(handler.parseMeasurementOutput(JSON.stringify({ candidates: Array.from({ length: 201 }, () => candidate()) }), ['synthetic-labs.docx']), null);
});

test('measurement candidates and unreadable entries are capped and length-limited', () => {
  const input = {
    candidates: [candidate({ location: 'L'.repeat(241), evidence: 'E'.repeat(601) })],
    unreadable: Array.from({ length: 14 }, () => ({ file: 'opaque.bin', reason: 'x' })),
  };
  const parsed = handler.parseMeasurementOutput(JSON.stringify(input), ['synthetic-labs.docx', 'opaque.bin']);
  assert.equal(parsed.candidates.length, 0);
  assert.equal(parsed.unreadable.length, 12);
});

test('same-origin and consent checks reject missing, malformed, or cross-site requests before execution', async () => {
  const cases = [
    { origin: 'https://attacker.example', host: 'healthspan-review.example', consent },
    { origin: 'not a URL', host: 'healthspan-review.example', consent },
    { origin: 'https://healthspan-review.example', host: undefined, consent },
    { origin: 'https://healthspan-review.example', host: 'healthspan-review.example', consent: false },
  ];
  for (const headers of cases) {
    const chunks = [];
    const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(value) { chunks.push(value); } };
    await handler({ method: 'POST', headers, body: request([file('synthetic.csv')], { consent: headers.consent }) }, res);
    assert.equal(res.statusCode, headers.consent ? 403 : 400);
    const error = JSON.parse(chunks.join('')).error;
    assert.match(error, headers.consent ? /must come from/ : /Confirm the data-processing notice/);
  }
});

test('bounded concurrency rejects 64 unconsented endpoint requests without sandbox execution', async () => {
  const requests = Array.from({ length: 64 }, async () => {
    const chunks = [];
    const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(value) { chunks.push(value); } };
    await handler({ method: 'POST', headers: { origin: 'https://healthspan-review.example', host: 'healthspan-review.example' }, body: request([file('synthetic.csv')], { consent: false }) }, res);
    return { status: res.statusCode, body: JSON.parse(chunks.join('')) };
  });
  const results = await Promise.all(requests);
  assert.equal(results.length, 64);
  assert.ok(results.every(result => result.status === 400 && /Confirm the data-processing notice/.test(result.body.error)));
});

test('64 concurrent valid synthetic reviews isolate and stop each mocked sandbox without exposing the key', async () => {
  const { Sandbox } = await sandboxSdkPromise;
  const originalCreate = Sandbox.create;
  const previousKey = process.env.OPENROUTER_API_KEY;
  const secret = 'test-only-openrouter-secret';
  const metrics = { created: 0, stopped: 0, active: 0, peak: 0, commands: 0 };
  const candidateOutput = JSON.stringify({
    candidates: [candidate()],
    unreadable: [],
  });
  Sandbox.create = async (options) => {
    metrics.created++;
    metrics.active++;
    metrics.peak = Math.max(metrics.peak, metrics.active);
    assert.equal(options.timeout, 150_000);
    assert.equal(options.resources.vcpus, 1);
    assert.deepEqual(Object.keys(options.networkPolicy.allow), ['openrouter.ai']);
    assert.equal(options.env.OPENROUTER_API_KEY, 'brokered-by-vercel');
    return {
      mkDir: async () => {},
      writeFiles: async () => {},
      runCommand: async ({ env }) => {
        metrics.commands++;
        assert.equal(env.OPENROUTER_API_KEY, 'brokered-by-vercel');
        await new Promise((resolve) => setImmediate(resolve));
        return {
          exitCode: 0,
          stdout: async () => JSON.stringify({ type: 'text', part: { text: candidateOutput } }),
          stderr: async () => '',
        };
      },
      stop: async () => { metrics.stopped++; metrics.active--; },
    };
  };
  process.env.OPENROUTER_API_KEY = secret;
  try {
    const requests = Array.from({ length: 64 }, async () => {
      const chunks = [];
      const response = {
        headers: {},
        setHeader(key, value) { this.headers[key] = value; },
        end(value) { chunks.push(value); },
      };
      await handler({
        method: 'POST',
        headers: { origin: 'https://healthspan-review.example', host: 'healthspan-review.example' },
        body: request([file('synthetic-labs.docx')], { mode: 'measurement-review' }),
      }, response);
      return { status: response.statusCode, body: chunks.join('') };
    });
    const results = await Promise.all(requests);
    assert.equal(results.length, 64);
    assert.ok(results.every((result) => result.status === 200));
    assert.ok(results.every((result) => JSON.parse(result.body).candidates[0].value === '98'));
    assert.ok(results.every((result) => !result.body.includes(secret)));
    assert.equal(metrics.created, 64);
    assert.equal(metrics.commands, 64);
    assert.equal(metrics.stopped, 64);
    assert.equal(metrics.active, 0);
    assert.equal(metrics.peak, 64);
  } finally {
    Sandbox.create = originalCreate;
    if (previousKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = previousKey;
  }
});

test('schema-invalid output receives one bounded continuation and still tears down the sandbox', async () => {
  const { Sandbox } = await sandboxSdkPromise;
  const originalCreate = Sandbox.create;
  const previousKey = process.env.OPENROUTER_API_KEY;
  let commands = 0, stopped = 0;
  const validOutput = JSON.stringify({ candidates: [candidate()], unreadable: [] });
  Sandbox.create = async () => ({
    mkDir: async () => {},
    writeFiles: async () => {},
    runCommand: async ({ args }) => {
      commands++;
      if (commands === 1) {
        assert.equal(args.includes('--continue'), false);
        return { exitCode: 0, stdout: async () => JSON.stringify({ type: 'text', part: { text: '{"not":"the review schema"}' } }), stderr: async () => '' };
      }
      assert.equal(args.includes('--continue'), true);
      return { exitCode: 0, stdout: async () => JSON.stringify({ type: 'text', part: { text: validOutput } }), stderr: async () => '' };
    },
    stop: async () => { stopped++; },
  });
  process.env.OPENROUTER_API_KEY = 'test-only-openrouter-secret';
  try {
    const chunks = [];
    const response = { headers: {}, setHeader(key, value) { this.headers[key] = value; }, end(value) { chunks.push(value); } };
    await handler({
      method: 'POST',
      headers: { origin: 'https://healthspan-review.example', host: 'healthspan-review.example' },
      body: request([file('synthetic-labs.docx')], { mode: 'measurement-review' }),
    }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(commands, 2);
    assert.equal(stopped, 1);
    assert.equal(JSON.parse(chunks.join('')).candidates[0].value, '98');
  } finally {
    Sandbox.create = originalCreate;
    if (previousKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = previousKey;
  }
});

test('sandbox preparation failures return a bounded error and stop an allocated sandbox', async () => {
  const { Sandbox } = await sandboxSdkPromise;
  const originalCreate = Sandbox.create;
  const previousKey = process.env.OPENROUTER_API_KEY;
  let stopped = 0;
  Sandbox.create = async () => ({
    mkDir: async () => {},
    writeFiles: async () => { throw new Error('synthetic sandbox setup failure'); },
    stop: async () => { stopped++; },
  });
  process.env.OPENROUTER_API_KEY = 'test-only-openrouter-secret';
  try {
    const chunks = [];
    const response = { headers: {}, setHeader(key, value) { this.headers[key] = value; }, end(value) { chunks.push(value); } };
    await handler({
      method: 'POST',
      headers: { origin: 'https://healthspan-review.example', host: 'healthspan-review.example' },
      body: request([file('synthetic-labs.docx')], { mode: 'measurement-review' }),
    }, response);
    assert.equal(response.statusCode, 502);
    assert.match(chunks.join(''), /could not complete this request/);
    assert.doesNotMatch(chunks.join(''), /synthetic sandbox setup failure|test-only-openrouter-secret/);
    assert.equal(stopped, 1);
  } finally {
    Sandbox.create = originalCreate;
    if (previousKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = previousKey;
  }
});

test('OpenCode text events are extracted, non-text and error events are discarded, and output is clipped', () => {
  const stdout = [
    JSON.stringify({ type: 'step-start', part: {} }),
    JSON.stringify({ type: 'text', part: { text: 'Found synthetic values.' } }),
    JSON.stringify({ type: 'tool-invocation', part: { tool: 'read', input: 'do not expose' } }),
    JSON.stringify({ type: 'error', error: { message: 'private error detail' } }),
    JSON.stringify({ type: 'step-finish', part: {} }),
  ].join('\n');
  assert.equal(handler.safeOutput(stdout, 'fallback should be combined with stdout'), 'Found synthetic values.\nfallback should be combined with stdout');
  assert.equal(handler.safeOutput(JSON.stringify({ type: 'error', error: { message: 'failure' } }), ''), '');
  assert.equal(handler.safeOutput('', 'synthetic stderr fallback'), 'synthetic stderr fallback');
  assert.equal(handler.safeOutput('z'.repeat(50000), '').length, 48000);
});
