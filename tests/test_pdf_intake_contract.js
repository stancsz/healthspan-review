const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');

const html = readFileSync('docs/workbench.html', 'utf8');
const browser = readFileSync('docs/workbench.js', 'utf8');
const importer = readFileSync('docs/pdf-import.mjs', 'utf8');
const review = readFileSync('docs/pdf-candidate-review.js', 'utf8');
const batches = readFileSync('docs/pdf-batches.js', 'utf8');

test('PDF intake is separate, opt-in, and begins with local file inspection', () => {
  assert.match(html, /id="pdf-file" type="file" accept="\.pdf,application\/pdf"/);
  assert.match(html, /id="analyze-pdf"[^>]*disabled/);
  assert.match(html, /id="pdf-ai-consent" type="checkbox"/);
  assert.match(html, /AI service privacy policy.{0,120}data handling and retention/s);
  assert.doesNotMatch(html, /MiniMax|Vercel function/);
  assert.match(importer, /file\.arrayBuffer\(\)/);
  assert.match(importer, /page\.getTextContent\(\)/);
  assert.match(importer, /canvas\.toDataURL\('image\/jpeg'/);
  assert.match(importer, /MAX_BYTES = 12 \* 1024 \* 1024/);
  assert.match(importer, /MAX_PAGES = 24/);
  assert.match(html, /up to 24 pages and 12 MB/i);
  assert.match(html, /pdf-batches\.js/);
  assert.match(batches, /MAX_DOCUMENT_PAGES = 24/);
  assert.match(batches, /MAX_BATCH_PAGES = 6/);
});

test('PDF bytes and file names are excluded from bounded sequential AI requests; candidates require explicit confirmation', () => {
  assert.match(browser, /window\.pdfBatches\.splitPages\(sourcePdf\.pages\)/);
  assert.match(browser, /window\.pdfBatches\.requestPages\(batch\.pages\)/);
  assert.match(browser, /encoder\.encode\(request\)\.byteLength > window\.pdfBatches\.MAX_REQUEST_BYTES/);
  assert.match(browser, /await fetch\('\/api\/extract-pdf'/);
  assert.match(browser, /validateCandidatePages\(data\.candidates \|\| \[\], batch\.pages\)/);
  assert.match(browser, /selectionId !== pdfSelectionId/);
  assert.match(importer, /MAX_REQUEST_IMAGE_CHARS = 500_000/);
  assert.doesNotMatch(browser, /localStorage|sessionStorage/);
  assert.match(browser, /#apply-pdf-candidates/);
  assert.match(browser + review, /user_confirmed_pdf_measurement/);
  assert.match(browser + review, /source_page: source\.page|source_page: entry\.provenance\.page/);
  assert.match(html, /Nothing is entered automatically/);
});

test('PDF candidates expose source-to-entry units and flag same-date conflicts', () => {
  assert.match(html, /Source → entry unit/);
  assert.match(html, /printed value and source unit remain in the packet/);
  assert.match(browser, /candidate\.normalizedUnit/);
  assert.match(browser, /candidate\.conflict/);
  assert.match(browser + review, /unit_conversion_applied/);
  assert.match(browser + review, /printed_date: source\.printedDate|printed_date: entry\.provenance\.printedDate/);
  assert.match(browser, /type="date"/);
  assert.match(browser, /candidate\.duplicate/);
  assert.match(browser, /candidate\.dateIssue/);
  assert.match(browser, /typeof candidate\.baseIssue !== "string"/);
  assert.match(browser, /prepareSelectedCandidates/);
  assert.match(browser, /classifyCandidateRows/);
  assert.match(browser, /candidateReviewMessages/);
  assert.match(html, /pdf-candidate-review\.js/);
  assert.match(review, /printedDate: candidate\.date/);
});
