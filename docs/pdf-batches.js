(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.pdfBatches = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var MAX_DOCUMENT_PAGES = 50;
  var MAX_BATCH_PAGES = 6;
  var MAX_PAGE_TEXT = 10000;
  var MAX_REQUEST_IMAGE_CHARS = 500_000;
  var MAX_REQUEST_BYTES = 3_700_000;
  var DEFAULT_REQUEST_INTERVAL_MS = 12_200;
  var DEFAULT_MAX_RETRIES = 2;
  var DEFAULT_RETRY_WAITS_MS = [60_000, 90_000];
  var DEFAULT_MAX_RETRY_WAIT_MS = 120_000;

  function abortError() {
    var error = new Error("The PDF extraction request was cancelled.");
    error.name = "AbortError";
    return error;
  }

  function throwIfAborted(signal) {
    if (signal && signal.aborted) throw abortError();
  }

  function abortableTimeout(ms, signal) {
    return new Promise(function (resolve, reject) {
      if (signal && signal.aborted) { reject(abortError()); return; }
      var timer = setTimeout(done, ms);
      function cleanup() {
        clearTimeout(timer);
        if (signal) signal.removeEventListener("abort", onAbort);
      }
      function done() { cleanup(); resolve(); }
      function onAbort() { cleanup(); reject(abortError()); }
      if (signal) signal.addEventListener("abort", onAbort, { once: true });
    });
  }

  function retryAfterMs(response, now) {
    var header = response && response.headers && typeof response.headers.get === "function" ? response.headers.get("Retry-After") : null;
    if (header === null || header === undefined || String(header).trim() === "") return null;
    var value = String(header).trim();
    if (/^\d+(?:\.\d+)?$/.test(value)) return Math.max(0, Number(value) * 1000);
    var date = Date.parse(value);
    return Number.isFinite(date) ? Math.max(0, date - now) : null;
  }

  function createRequestScheduler(options) {
    options = options || {};
    var fetchRequest = options.fetch || function () { return globalThis.fetch.apply(globalThis, arguments); };
    var now = options.now || Date.now;
    var sleep = options.sleep || abortableTimeout;
    var random = options.random || Math.random;
    var intervalMs = options.intervalMs === undefined ? DEFAULT_REQUEST_INTERVAL_MS : options.intervalMs;
    var maxRetries = options.maxRetries === undefined ? DEFAULT_MAX_RETRIES : options.maxRetries;
    var retryWaits = options.retryWaitsMs || DEFAULT_RETRY_WAITS_MS;
    var maxRetryWaitMs = options.maxRetryWaitMs === undefined ? DEFAULT_MAX_RETRY_WAIT_MS : options.maxRetryWaitMs;
    var lastStartedAt = null;
    var notBefore = 0;
    var queue = Promise.resolve();

    function emit(onProgress, state, waitMs, attempt) {
      if (typeof onProgress === "function") onProgress({ state: state, waitMs: waitMs, attempt: attempt });
    }

    function retryLaterError(waitMs) {
      var error = new Error("The extraction service asked for a longer wait. Please retry this PDF later.");
      error.name = "RetryAfterTooLongError";
      error.retryAfterMs = waitMs;
      return error;
    }

    async function waitUntilStart(signal, onProgress, attempt, retryWaitMs) {
      while (true) {
        throwIfAborted(signal);
        var currentTime = now();
        var paceWait = lastStartedAt === null ? 0 : Math.max(0, intervalMs - (currentTime - lastStartedAt));
        var cooldownWait = Math.max(0, notBefore - currentTime);
        if (cooldownWait > maxRetryWaitMs) throw retryLaterError(cooldownWait);
        var waitMs = Math.max(paceWait, cooldownWait, retryWaitMs || 0);
        if (waitMs <= 0) return;
        emit(onProgress, "waiting", waitMs, attempt);
        await sleep(waitMs, signal);
        throwIfAborted(signal);
        retryWaitMs = 0;
      }
    }

    async function run(url, init, context) {
      init = init || {};
      context = context || {};
      var signal = init.signal;
      var onProgress = context.onProgress;
      var retryWaitMs = 0;
      for (var attempt = 1; attempt <= maxRetries + 1; attempt++) {
        await waitUntilStart(signal, onProgress, attempt, retryWaitMs);
        throwIfAborted(signal);
        lastStartedAt = now();
        emit(onProgress, "sending", 0, attempt);
        // Reuse the exact URL/init, including its body, for any explicit 429 retry.
        var response = await fetchRequest(url, init);
        throwIfAborted(signal);
        if (!response || response.status !== 429) return response;
        var responseTime = now();
        var serverWait = retryAfterMs(response, responseTime);
        if (serverWait !== null) notBefore = Math.max(notBefore, responseTime + serverWait);
        if (attempt > maxRetries) return response;
        if (serverWait === null) {
          var fallback = retryWaits[Math.min(attempt - 1, retryWaits.length - 1)] || DEFAULT_RETRY_WAITS_MS[DEFAULT_RETRY_WAITS_MS.length - 1];
          var jitter = Math.floor(Math.max(0, Math.min(0.999999, random())) * 1000);
          serverWait = fallback + jitter;
        }
        if (serverWait > maxRetryWaitMs) throw retryLaterError(serverWait);
        retryWaitMs = serverWait;
      }
    }

    return {
      send: function (url, init, context) {
        var operation = queue.then(function () { return run(url, init, context); });
        queue = operation.catch(function () {});
        return operation;
      }
    };
  }

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
    validateCandidatePages: validateCandidatePages,
    createRequestScheduler: createRequestScheduler,
    abortableTimeout: abortableTimeout
  };
});
