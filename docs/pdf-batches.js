(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.pdfBatches = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var MAX_DOCUMENT_PAGES = 24;
  var MAX_BATCH_PAGES = 6;
  var MAX_PAGE_TEXT = 10000;
  var MAX_REQUEST_IMAGE_CHARS = 500_000;
  var MAX_REQUEST_BYTES = 3_700_000;

  function splitPages(pages) {
    if (!Array.isArray(pages) || pages.length < 1 || pages.length > MAX_DOCUMENT_PAGES) {
      throw new Error("PDFs must contain 1 to " + MAX_DOCUMENT_PAGES + " pages.");
    }
    pages.forEach(function (page, index) {
      if (!page || page.page !== index + 1 || typeof page.text !== "string" || typeof page.image !== "string") {
        throw new Error("The locally inspected PDF pages are invalid.");
      }
    });
    var batches = [];
    for (var offset = 0; offset < pages.length; offset += MAX_BATCH_PAGES) {
      var batchPages = pages.slice(offset, offset + MAX_BATCH_PAGES);
      batches.push({ offset: offset, startPage: offset + 1, endPage: offset + batchPages.length, pages: batchPages });
    }
    return batches;
  }

  function requestPages(batch) {
    if (!Array.isArray(batch) || batch.length < 1 || batch.length > MAX_BATCH_PAGES) {
      throw new Error("PDF extraction batches must contain 1 to " + MAX_BATCH_PAGES + " pages.");
    }
    return batch.map(function (page, index) {
      var image = page && (page.requestImage || page.image);
      if (!page || typeof page.text !== "string" || page.text.length > MAX_PAGE_TEXT || typeof image !== "string" || !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(image) || image.length > MAX_REQUEST_IMAGE_CHARS) {
        throw new Error("The selected PDF page exceeds its safe extraction limits.");
      }
      return { page: index + 1, sourcePage: page.page, text: page.text, image: image };
    });
  }

  function validateCandidatePages(candidates, batchPages) {
    if (!Array.isArray(candidates) || !Array.isArray(batchPages) || batchPages.length < 1 || batchPages.length > MAX_BATCH_PAGES) {
      throw new Error("The extracted PDF candidates are invalid.");
    }
    var sourcePages = new Set(batchPages.map(function (page) { return page.page; }));
    return candidates.map(function (candidate) {
      var page = candidate && Number(candidate.page);
      if (!Number.isInteger(page) || !sourcePages.has(page)) throw new Error("The extracted PDF candidate page is invalid.");
      return Object.assign({}, candidate, { page: page });
    });
  }

  return {
    MAX_DOCUMENT_PAGES: MAX_DOCUMENT_PAGES,
    MAX_BATCH_PAGES: MAX_BATCH_PAGES,
    MAX_REQUEST_BYTES: MAX_REQUEST_BYTES,
    splitPages: splitPages,
    requestPages: requestPages,
    validateCandidatePages: validateCandidatePages
  };
});
