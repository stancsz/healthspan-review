const test = require('node:test');
const assert = require('node:assert/strict');
const handler = require('./opencode-agent.js');

const file = (name, text = 'synthetic sample') => ({ name, data: Buffer.from(text).toString('base64') });

test('agent request accepts bounded common research formats', () => {
  assert.equal(handler.validateBody({ prompt: 'Summarize this', files: [file('report.pdf'), file('image.png'), file('table.csv')], consent: true }), null);
});

test('agent request rejects invalid and unsupported payloads', () => {
  assert.match(handler.validateBody({ prompt: 'review', files: [file('x.csv')], consent: false }), /Confirm the data-processing notice/);
  assert.match(handler.validateBody({ prompt: 'review', files: [file('x.csv')] }), /Confirm the data-processing notice/);
  assert.match(handler.validateBody({ prompt: '', files: [file('x.csv')], consent: true }), /Enter a task/);
  assert.match(handler.validateBody({ prompt: 'review', files: [file('x.exe')], consent: true }), /not supported/);
  assert.match(handler.validateBody({ prompt: 'review', files: [file('x.docx')], consent: true }), /not supported/);
  assert.equal(handler.validateBody({ prompt: 'review', files: [{ name: '../x.csv', data: 'c2FtcGxl' }], consent: true }), null);
  assert.match(handler.validateBody({ prompt: 'review', files: [{ name: '.csv', data: 'c2FtcGxl' }], consent: true }), /name is invalid/);
  assert.match(handler.validateBody({ prompt: 'review', files: [{ name: 'x.csv', data: 'not base64' }], consent: true }), /could not be read/);
  assert.match(handler.validateBody({ prompt: 'review', files: Array.from({ length: 7 }, (_, i) => file(`${i}.csv`)), consent: true }), /between 1 and 6/);
  assert.match(handler.validateBody({ prompt: 'review', files: [file('large.csv', 'x'.repeat(2 * 1024 * 1024 + 1))], consent: true }), /2 MB or smaller/);
});

test('agent output extracts text events and strips non-text OpenCode events', () => {
  const output = [
    JSON.stringify({ type: 'step-start', part: {} }),
    JSON.stringify({ type: 'text', part: { text: 'Summary: synthetic file reviewed.' } }),
    JSON.stringify({ type: 'step-finish', part: {} }),
  ].join('\n');
  assert.equal(handler.safeOutput(output, ''), 'Summary: synthetic file reviewed.');
});

test('agent endpoint rejects requests without an exact same-origin host', async () => {
  const chunks = [];
  const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(v) { chunks.push(v); } };
  await handler({ method: 'POST', headers: { origin: 'https://attacker.example', host: 'healthspan-review.vercel.app' }, body: { prompt: 'review', files: [file('a.csv')], consent: true } }, res);
  assert.equal(res.statusCode, 403);
  assert.match(JSON.parse(chunks.join('')).error, /must come from/);
});
