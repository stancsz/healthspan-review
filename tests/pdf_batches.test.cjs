const test = require('node:test');
const assert = require('node:assert/strict');
const batches = require('../docs/pdf-batches.js');
const candidateReview = require('../docs/pdf-candidate-review.js');

function pages(count) {
  return Array.from({ length: count }, (_, index) => ({
    page: index + 1,
    text: 'Synthetic page ' + (index + 1),
    image: 'data:image/jpeg;base64,LOCALPREVIEW' + (index + 1),
    requestImage: 'data:image/jpeg;base64,AIIMAGE' + (index + 1)
  }));
}

test('50-page PDFs split into nine sequential six-page requests with a two-page tail', () => {
  const parts = batches.splitPages(pages(50));
  assert.equal(parts.length, 9);
  assert.deepEqual(parts.map(part => [part.startPage, part.endPage, part.offset]), [
    [1, 6, 0], [7, 12, 6], [13, 18, 12], [19, 24, 18],
    [25, 30, 24], [31, 36, 30], [37, 42, 36], [43, 48, 42], [49, 50, 48]
  ]);
  assert.deepEqual(parts.map(part => part.pages.length), [6, 6, 6, 6, 6, 6, 6, 6, 2]);
  assert.deepEqual(parts.flatMap(part => part.pages.map(page => page.page)), Array.from({ length: 50 }, (_, index) => index + 1));
});

test('requests reindex pages locally and send compressed AI images, not local previews', () => {
  const part = batches.splitPages(pages(12))[1];
  const request = batches.requestPages(part.pages);
  assert.deepEqual(request.map(page => page.page), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(request.map(page => page.sourcePage), [7, 8, 9, 10, 11, 12]);
  assert.equal(request[0].text, 'Synthetic page 7');
  assert.equal(request[0].image, 'data:image/jpeg;base64,AIIMAGE7');
  assert.equal(request.some(page => page.image.includes('LOCALPREVIEW')), false);
});

test('six maximum-sized page envelopes stay below the browser request preflight ceiling', () => {
  const pageCount = 6, prefix = 'data:image/jpeg;base64,';
  const maxPages = Array.from({ length: pageCount }, (_, index) => ({
    page: index + 1,
    text: 'x'.repeat(10_000),
    image: 'data:image/jpeg;base64,LOCAL_PREVIEW',
    requestImage: prefix + 'A'.repeat(500_000 - prefix.length)
  }));
  const request = JSON.stringify({ confirmedDeidentified: true, pages: batches.requestPages(maxPages) });
  assert.equal(new TextEncoder().encode(request).byteLength < batches.MAX_REQUEST_BYTES, true);
});

test('candidates preserve original PDF citations through the 50-page boundary', () => {
  const parts = batches.splitPages(pages(50));
  const validated = batches.validateCandidatePages([
    { field: 'fasting_glucose', page: 49 },
    { field: 'hba1c', page: 50 }
  ], parts[8].pages);
  assert.deepEqual(validated.map(candidate => candidate.page), [49, 50]);
});

test('same-date conflicts remain visible when their candidates come from distant batches', () => {
  const allPages = pages(50), parts = batches.splitPages(allPages);
  const candidates = [
    { field: 'fasting_glucose', page: 1 },
    { field: 'hba1c', page: 7 },
    { field: 'fasting_glucose', page: 37 },
    { field: 'albumin', page: 49 }
  ].map((candidate, index) => batches.validateCandidatePages([candidate], parts[[0, 1, 6, 8][index]].pages)[0]);
  const rows = candidates.map((candidate, index) => ({
    field: candidate.field,
    value: [98, 5.6, 110, 4.3][index],
    date: '2026-01-02'
  }));
  const flags = candidateReview.classifyCandidateRows(rows);
  assert.equal(candidates[0].page, 1);
  assert.equal(candidates[2].page, 37);
  assert.equal(flags[0].conflict, true);
  assert.equal(flags[2].conflict, true);
});

test('invalid document pages and invalid model page citations fail closed', () => {
  assert.throws(() => batches.splitPages([]), /1 to 50 pages/);
  assert.throws(() => batches.splitPages(pages(51)), /1 to 50 pages/);
  assert.throws(() => batches.splitPages([{ ...pages(1)[0], page: 2 }]), /pages are invalid/);
  assert.throws(() => batches.validateCandidatePages([{ page: 42 }], batches.splitPages(pages(50))[8].pages), /page is invalid/);
  assert.throws(() => batches.validateCandidatePages([{ page: 51 }], batches.splitPages(pages(50))[8].pages), /page is invalid/);
});
