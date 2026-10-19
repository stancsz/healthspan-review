const test = require('node:test');
const assert = require('node:assert/strict');
const { deflateRawSync } = require('node:zlib');
const { finished } = require('node:stream/promises');
const handler = require('./opencode-agent.js');

const file = (name, text = 'synthetic sample') => ({ name, data: Buffer.from(text).toString('base64') });
function zipEnvelope({ name = 'word/document.xml', payload = Buffer.from('synthetic document xml'), entries = 1, eocd = true, declaredSize } = {}) {
  const crc32 = buffer => { let crc = 0xffffffff; for (const byte of buffer) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); } return (crc ^ 0xffffffff) >>> 0; };
  const source = Buffer.isBuffer(payload) ? payload : Buffer.from(payload), nameBytes = Buffer.from(name), packed = deflateRawSync(source), crc = crc32(source);
  const locals = [], centralEntries = []; let localOffset = 0;
  for (let index = 0; index < entries; index++) {
    const local = Buffer.alloc(30 + nameBytes.length + packed.length);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(8, 8); local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(packed.length, 18); local.writeUInt32LE(source.length, 22); local.writeUInt16LE(nameBytes.length, 26);
    nameBytes.copy(local, 30); packed.copy(local, 30 + nameBytes.length); locals.push(local);
    const central = Buffer.alloc(46 + nameBytes.length);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(8, 10); central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(packed.length, 20); central.writeUInt32LE(declaredSize ?? source.length, 24);
    central.writeUInt16LE(nameBytes.length, 28); central.writeUInt32LE(localOffset, 42); nameBytes.copy(central, 46);
    centralEntries.push(central); localOffset += local.length;
  }
  const directory = Buffer.concat(centralEntries), localData = Buffer.concat(locals);
  if (!eocd) return Buffer.concat([localData, directory]);
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries, 8); end.writeUInt16LE(entries, 10);
  end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(localData.length, 16);
  return Buffer.concat([localData, directory, end]);
}

test('sandbox SDK loads through its ESM entry from the CommonJS API handler', async () => {
  const sdk = await handler.loadSandboxSdk();
  assert.equal(typeof sdk.Sandbox?.create, 'function');
});

test('agent request accepts arbitrary file extensions within bounded payload limits', () => {
  assert.equal(handler.validateBody({ prompt: 'Summarize this', files: [file('report.pdf'), file('image.png'), file('book.docx'), file('data.xlsx'), file('opaque.custom')] , consent: true }), null);
});

test('agent request rejects invalid and unsupported payloads', () => {
  assert.match(handler.validateBody({ prompt: 'review', files: [file('x.csv')], consent: false }), /Confirm the data-processing notice/);
  assert.match(handler.validateBody({ prompt: 'review', files: [file('x.csv')] }), /Confirm the data-processing notice/);
  assert.match(handler.validateBody({ prompt: '', files: [file('x.csv')], consent: true }), /Enter a task/);
  assert.match(handler.validateBody({ prompt: 'review', files: [file('x.csv')], consent: true, mode: 'unknown' }), /task type/);
  assert.equal(handler.validateBody({ prompt: 'review', files: [{ name: '../x.csv', data: 'c2FtcGxl' }], consent: true }), null);
  assert.equal(handler.validateBody({ prompt: 'review', files: [{ name: '.csv', data: 'c2FtcGxl' }], consent: true }), null);
  assert.match(handler.validateBody({ prompt: 'review', files: [{ name: '..', data: 'c2FtcGxl' }], consent: true }), /name is invalid/);
  assert.match(handler.validateBody({ prompt: 'review', files: [{ name: 'x.csv', data: 'not base64' }], consent: true }), /could not be read/);
  assert.match(handler.validateBody({ prompt: 'review', files: Array.from({ length: 7 }, (_, i) => file(`${i}.csv`)), consent: true }), /between 1 and 6/);
  assert.match(handler.validateBody({ prompt: 'review', files: [file('large.csv', 'x'.repeat(2 * 1024 * 1024 + 1))], consent: true }), /2 MB or smaller/);
});

test('measurement output accepts only canonical fields with file evidence and source locations', () => {
  const parsed = handler.parseMeasurementOutput(JSON.stringify({ candidates: [
    { field: 'fasting_glucose', value: '98', unit: 'mg/dL', date: '2026-01-02', file: 'labs.docx', location: 'Table 1, row 3', evidence: 'Fasting glucose 98 mg/dL', uncertainty: '' },
    { field: 'Grip strength', value: '31', unit: 'kg', date: '', file: 'labs.docx', location: 'paragraph 4', evidence: 'Grip strength: 31 kg', uncertainty: '' },
    { field: 'HbA1c', value: '5.6', unit: '%', date: '', file: '/vercel/workspace/01-labs.docx', location: 'paragraph 3', evidence: 'HbA1c 5.6%', uncertainty: '' },
    { field: 'unsupported_bioage', value: '42', unit: 'years', date: '', file: 'labs.docx', location: 'row 4', evidence: 'Bio age 42', uncertainty: '' },
    { field: 'albumin', value: '4.3', unit: 'g/dL', date: '', file: 'invented.pdf', location: 'page 2', evidence: 'Albumin 4.3', uncertainty: '' },
    { field: 'creatinine', value: '0.9', unit: 'mg/dL', date: '', file: 'labs.docx', location: '', evidence: 'Creatinine 0.9', uncertainty: '' },
  ] }), ['labs.docx']);
  assert.equal(parsed.candidates.length, 3);
  assert.equal(parsed.candidates[0].field, 'fasting_glucose');
  assert.equal(parsed.candidates[1].field, 'grip_strength');
  assert.equal(parsed.candidates[2].field, 'hba1c');
  assert.equal(parsed.candidates[2].file, 'labs.docx');
  assert.equal(handler.parseMeasurementOutput('not JSON', ['labs.docx']), null);
});

test('agent output extracts text events and strips non-text OpenCode events', () => {
  const output = [
    JSON.stringify({ type: 'step-start', part: {} }),
    JSON.stringify({ type: 'text', part: { text: 'Summary: synthetic file reviewed.' } }),
    JSON.stringify({ type: 'step-finish', part: {} }),
  ].join('\n');
  assert.equal(handler.safeOutput(output, ''), 'Summary: synthetic file reviewed.');
  assert.deepEqual(handler.outputDiagnostics(output), { lines: 3, plainTextLines: 0, eventTypes: ['step-start', 'text', 'step-finish'] });
  const toolOnly = JSON.stringify({ type: 'tool_use', part: { tool: 'read' } }) + '\n' + JSON.stringify({ type: 'step_finish', part: {} });
  const stderrText = JSON.stringify({ type: 'text', part: { text: '{"candidates":[],"unreadable":[]}' } });
  assert.equal(handler.safeOutput(toolOnly, stderrText), '{"candidates":[],"unreadable":[]}');
});

test('arbitrary files stay in the sandbox and are not passed through OpenCode binary attachments', () => {
  const args = handler.buildCommandArgs('Inspect files in /vercel/workspace.');
  assert.deepEqual(args.slice(0, 8), ['run', '--pure', '--format', 'json', '--model', 'openrouter/minimax/minimax-m3', '--agent', 'build']);
  assert.equal(args.includes('--file'), false);
  assert.equal(args.at(-1), 'Inspect files in /vercel/workspace.');
  const retryArgs = handler.buildCommandArgs('Return schema-valid JSON.', true);
  assert.deepEqual(retryArgs.slice(0, 3), ['run', '--continue', '--pure']);
});

test('PDF text companion extraction preserves numbered page boundaries, including blank leading pages', async () => {
  const writes = [];
  const sandbox = {
    async runCommand(args) {
      assert.equal(args.cmd, 'pdftotext');
      assert.deepEqual(args.args.slice(0, 3), ['-layout', '-enc', 'UTF-8']);
      assert.ok(args.stdout instanceof require('node:stream').Writable);
      args.stdout.end('\fPage two\f');
      await finished(args.stdout);
      return { exitCode: 0 };
    },
    async mkDir(path) { assert.equal(path, 'workspace/pdf-text'); },
    async writeFiles(files) { writes.push(...files); },
  };
  const derived = await handler.preparePdfText(sandbox, [{ name: 'scan.PDF' }], ['/vercel/workspace/01-scan.PDF']);
  assert.deepEqual(derived, [{ originalName: 'scan.PDF', path: '/vercel/workspace/pdf-text/01-extracted.txt', truncated: false }]);
  assert.equal(writes[0].content.toString('utf8'), '[Original PDF page 1]\n\n\n[Original PDF page 2]\nPage two');
  assert.equal(handler.SANDBOX_TIMEOUT_MS, 150_000);
  assert.ok(writes[0].content.length <= handler.MAX_EXTRACTED_PDF_CHARS);
});

test('PDF text companion caps streamed stdout while draining oversized extraction output', async () => {
  const writes = [];
  const sandbox = {
    async runCommand({ stdout }) {
      const chunk = Buffer.alloc(16 * 1024, 0x61);
      for (let index = 0; index < 20; index++) stdout.write(chunk);
      stdout.end();
      await finished(stdout);
      return { exitCode: 0 };
    },
    async mkDir() {},
    async writeFiles(files) { writes.push(...files); },
  };
  const derived = await handler.preparePdfText(sandbox, [{ name: 'large.pdf' }], ['/vercel/workspace/01-large.pdf']);
  assert.equal(derived.length, 1);
  assert.equal(derived[0].truncated, true);
  assert.ok(writes[0].content.length <= handler.MAX_EXTRACTED_PDF_CHARS);
  assert.match(writes[0].content.toString('utf8'), /^\[Original PDF page 1\]/);
});

test('PDF text extraction failures fall back to the original file', async () => {
  const sandbox = { async runCommand() { return { exitCode: 127, async stdout() { return ''; } }; }, async writeFiles() { throw new Error('must not write'); } };
  assert.deepEqual(await handler.preparePdfText(sandbox, [{ name: 'scan.pdf' }], ['/vercel/workspace/01-scan.pdf']), []);
});

test('ZIP office files are bounded by entry count, expansion size, ratio, and safe paths', () => {
  assert.deepEqual(handler.inspectZipEnvelope(zipEnvelope()), { issue: null, expanded: 22 });
  assert.match(handler.inspectZipEnvelope(zipEnvelope({ payload: Buffer.alloc(2 * 1024 * 1024) })).issue, /compression ratio/);
  assert.match(handler.inspectZipEnvelope(zipEnvelope({ payload: Buffer.alloc(9 * 1024 * 1024) })).issue, /8 MB limit/);
  assert.match(handler.inspectZipEnvelope(zipEnvelope({ entries: 1001 })).issue, /too many entries/);
  assert.match(handler.inspectZipEnvelope(zipEnvelope({ name: '../outside.txt' })).issue, /unsafe path/);
  assert.match(handler.inspectZipEnvelope(zipEnvelope({ eocd: false })).issue, /directory is missing/);
  assert.match(handler.inspectZipEnvelope(zipEnvelope({ payload: Buffer.from('forged archive size'), declaredSize: 1000 })).issue, /size or checksum/);
  assert.match(handler.validateBody({ prompt: 'review', consent: true, files: [{ name: 'huge.docx', data: zipEnvelope({ payload: Buffer.alloc(2 * 1024 * 1024) }).toString('base64') }] }), /compression ratio/);
  const { randomBytes } = require('node:crypto');
  const block = randomBytes(30 * 1024), expansion = Buffer.alloc(7 * 1024 * 1024);
  for (let offset = 0; offset < expansion.length; offset += block.length) block.copy(expansion, offset, 0, Math.min(block.length, expansion.length - offset));
  assert.match(handler.inspectZipEnvelope(zipEnvelope({ payload: expansion, entries: 5 })).issue, /32 MB expanded limit/);
  const archiveA = zipEnvelope({ payload: expansion, entries: 3 }), archiveB = zipEnvelope({ payload: expansion, entries: 3 });
  assert.match(handler.validateBody({ prompt: 'review', consent: true, files: [
    { name: 'a.docx', data: archiveA.toString('base64') }, { name: 'b.xlsx', data: archiveB.toString('base64') },
  ] }), /together exceed the 32 MB expanded limit/);
});

test('agent endpoint rejects requests without an exact same-origin host', async () => {
  const chunks = [];
  const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(v) { chunks.push(v); } };
  await handler({ method: 'POST', headers: { origin: 'https://attacker.example', host: 'healthspan-review.vercel.app' }, body: { prompt: 'review', files: [file('a.csv')], consent: true } }, res);
  assert.equal(res.statusCode, 403);
  assert.match(JSON.parse(chunks.join('')).error, /must come from/);
});
