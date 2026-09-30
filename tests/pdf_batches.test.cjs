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

test('24-page PDFs split into four sequential six-page requests', () => {
  const parts = batches.splitPages(pages(24));
  assert.equal(parts.length, 4);
  assert.deepEqual(parts.map(part => [part.startPage, part.endPage, part.offset]), [
    [1, 6, 0], [7, 12, 6], [13, 18, 12], [19, 24, 18]
  ]);
  assert.deepEqual(parts.map(part => part.pages.length), [6, 6, 6, 6]);
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

test('candidates preserve their original PDF page numbers across each batch', () => {
  const sourcePages = batches.splitPages(pages(24))[3].pages;
  const validated = batches.validateCandidatePages([
    { field: 'fasting_glucose', page: 19 },
    { field: 'hba1c', page: 24 }
  ], sourcePages);
  assert.deepEqual(validated.map(candidate => candidate.page), [19, 24]);
});

test('same-date conflicts remain visible when their candidates come from distant batches', () => {
  const allPages = pages(24), parts = batches.splitPages(allPages);
  const candidates = [
    { field: 'fasting_glucose', page: 1 },
    { field: 'hba1c', page: 7 },
    { field: 'fasting_glucose', page: 13 },
    { field: 'albumin', page: 19 }
  ].map((candidate, index) => batches.validateCandidatePages([candidate], parts[[0, 1, 2, 3][index]].pages)[0]);
  const rows = candidates.map((candidate, index) => ({
    field: candidate.field,
    value: [98, 5.6, 110, 4.3][index],
    date: '2026-01-02'
  }));
  const flags = candidateReview.classifyCandidateRows(rows);
  assert.equal(candidates[0].page, 1);
  assert.equal(candidates[2].page, 13);
  assert.equal(flags[0].conflict, true);
  assert.equal(flags[2].conflict, true);
});

test('invalid document pages and invalid model page citations fail closed', () => {
  assert.throws(() => batches.splitPages([]), /1 to 24 pages/);
  assert.throws(() => batches.splitPages(pages(25)), /1 to 24 pages/);
  assert.throws(() => batches.splitPages([{ ...pages(1)[0], page: 2 }]), /pages are invalid/);
  assert.throws(() => batches.validateCandidatePages([{ page: 18 }], batches.splitPages(pages(24))[3].pages), /page is invalid/);
  assert.throws(() => batches.validateCandidatePages([{ page: 25 }], batches.splitPages(pages(24))[3].pages), /page is invalid/);
});
