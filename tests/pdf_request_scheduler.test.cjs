const test = require('node:test');
const assert = require('node:assert/strict');
const { createRequestScheduler, splitPages, requestPages } = require('../docs/pdf-batches.js');

function response(status, retryAfter) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get(name) { return name.toLowerCase() === 'retry-after' ? retryAfter ?? null : null; } }
  };
}

function fakeClock(start = 1_800_000_000_000) {
  let current = start;
  const sleeps = [];
  return {
    now: () => current,
    sleeps,
    advance: ms => { current += ms; },
    sleep: async (ms, signal) => {
      if (signal?.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' });
      sleeps.push(ms);
      current += ms;
    }
  };
}

function syntheticPages(count) {
  return Array.from({ length: count }, (_, index) => ({
    page: index + 1,
    text: 'Synthetic page ' + (index + 1),
    image: 'data:image/jpeg;base64,LOCAL' + (index + 1),
    requestImage: 'data:image/jpeg;base64,REQUEST' + (index + 1)
  }));
}

test('scheduler serializes nine 50-page batch sends and paces each start by at least 12.2 seconds', async () => {
  const clock = fakeClock(), starts = [], progress = [];
  let active = 0, maxActive = 0;
  const scheduler = createRequestScheduler({
    now: clock.now,
    sleep: clock.sleep,
    fetch: async (url, init) => {
      active++;
      maxActive = Math.max(maxActive, active);
      starts.push(clock.now());
      await Promise.resolve();
      active--;
      return response(200);
    }
  });
  const parts = splitPages(syntheticPages(50));
  assert.equal(parts.length, 9);
  assert.deepEqual(parts.map(({ startPage, endPage }) => [startPage, endPage]), [
    [1, 6], [7, 12], [13, 18], [19, 24], [25, 30], [31, 36], [37, 42], [43, 48], [49, 50]
  ]);

  const responses = await Promise.all(parts.map(batch => scheduler.send('/api/extract-pdf', {
    method: 'POST',
    body: JSON.stringify({ pages: requestPages(batch.pages) })
  }, { onProgress: event => progress.push({ ...event, startPage: batch.startPage }) })));

  assert.equal(responses.length, 9);
  assert.equal(maxActive, 1);
  assert.equal(starts.length, 9);
  assert.deepEqual(starts.slice(1).map((start, index) => start - starts[index]), Array(8).fill(12_200));
  assert.equal(clock.sleeps.length, 8);
  assert.ok(progress.some(event => event.state === 'waiting' && event.waitMs === 12_200));
  assert.equal(progress.filter(event => event.state === 'sending').length, 9);
});

test('429 numeric Retry-After retries the identical request after the longer of backoff and pacing', async () => {
  const clock = fakeClock(), sentBodies = [], starts = [], events = [];
  let calls = 0;
  const scheduler = createRequestScheduler({
    now: clock.now,
    sleep: clock.sleep,
    fetch: async (url, init) => {
      starts.push(clock.now());
      sentBodies.push(init.body);
      calls++;
      return calls === 1 ? response(429, '30') : response(200);
    }
  });
  const init = { method: 'POST', body: '{"pages":[{"page":1,"sourcePage":49}]}' };
  const result = await scheduler.send('/api/extract-pdf', init, { onProgress: event => events.push(event) });
  assert.equal(result.status, 200);
  assert.deepEqual(sentBodies, [init.body, init.body]);
  assert.equal(starts[1] - starts[0], 30_000);
  assert.ok(events.some(event => event.state === 'waiting' && event.waitMs === 30_000 && event.attempt === 2));
});

test('429 HTTP-date Retry-After is honored and a page-50 request is not remapped on retry', async () => {
  const clock = fakeClock(), bodies = [], starts = [];
  let calls = 0;
  const retryDate = new Date(clock.now() + 25_000).toUTCString();
  const scheduler = createRequestScheduler({
    now: clock.now,
    sleep: clock.sleep,
    fetch: async (url, init) => {
      starts.push(clock.now());
      bodies.push(init.body);
      calls++;
      return calls === 1 ? response(429, retryDate) : response(200);
    }
  });
  const lastBatch = splitPages(syntheticPages(50))[8];
  const body = JSON.stringify({ pages: requestPages(lastBatch.pages) });
  const result = await scheduler.send('/api/extract-pdf', { method: 'POST', body });
  assert.equal(result.status, 200);
  assert.equal(starts[1] - starts[0], 25_000);
  assert.deepEqual(bodies, [body, body]);
  const sentPages = JSON.parse(bodies[1]).pages;
  assert.deepEqual(sentPages.map(page => page.sourcePage), [49, 50]);
});

test('429 without Retry-After uses bounded 60s and 90s fallback waits, then returns the final 429', async () => {
  const clock = fakeClock();
  let calls = 0;
  const scheduler = createRequestScheduler({
    now: clock.now,
    sleep: clock.sleep,
    random: () => 0.25,
    fetch: async () => { calls++; return response(429); }
  });
  const result = await scheduler.send('/api/extract-pdf', { method: 'POST', body: '{}' });
  assert.equal(result.status, 429);
  assert.equal(calls, 3);
  assert.deepEqual(clock.sleeps, [60_250, 90_250]);
});

test('scheduler refuses a Retry-After beyond its explicit maximum instead of retrying early', async () => {
  const clock = fakeClock();
  let calls = 0;
  const scheduler = createRequestScheduler({
    now: clock.now,
    sleep: clock.sleep,
    fetch: async () => { calls++; return response(429, '121'); }
  });
  await assert.rejects(scheduler.send('/api/extract-pdf', { method: 'POST', body: '{}' }), error => {
    assert.equal(error.name, 'RetryAfterTooLongError');
    assert.equal(error.retryAfterMs, 121_000);
    return true;
  });
  assert.equal(calls, 1);
  assert.deepEqual(clock.sleeps, []);
});

test('a final 429 Retry-After cooldown also paces a manual restart', async () => {
  const clock = fakeClock(), starts = [];
  let calls = 0;
  const scheduler = createRequestScheduler({
    now: clock.now,
    sleep: clock.sleep,
    maxRetries: 0,
    fetch: async () => {
      starts.push(clock.now());
      calls++;
      return calls === 1 ? response(429, '30') : response(200);
    }
  });

  assert.equal((await scheduler.send('/api/extract-pdf', { method: 'POST', body: 'first' })).status, 429);
  assert.equal((await scheduler.send('/api/extract-pdf', { method: 'POST', body: 'manual retry' })).status, 200);
  assert.equal(starts[1] - starts[0], 30_000);
  assert.deepEqual(clock.sleeps, [30_000]);
});

test('a too-long final 429 cooldown blocks early manual restart, then defers once inside the wait bound', async () => {
  const clock = fakeClock(), starts = [];
  let calls = 0;
  const scheduler = createRequestScheduler({
    now: clock.now,
    sleep: clock.sleep,
    maxRetries: 0,
    fetch: async () => {
      starts.push(clock.now());
      calls++;
      return calls === 1 ? response(429, '121') : response(200);
    }
  });

  assert.equal((await scheduler.send('/api/extract-pdf', { method: 'POST', body: 'first' })).status, 429);
  await assert.rejects(scheduler.send('/api/extract-pdf', { method: 'POST', body: 'too soon' }), error => {
    assert.equal(error.name, 'RetryAfterTooLongError');
    assert.equal(error.retryAfterMs, 121_000);
    return true;
  });
  assert.equal(calls, 1);
  assert.deepEqual(clock.sleeps, []);

  clock.advance(2_000);
  assert.equal((await scheduler.send('/api/extract-pdf', { method: 'POST', body: 'after cooldown' })).status, 200);
  assert.equal(starts[1] - starts[0], 121_000);
  assert.deepEqual(clock.sleeps, [119_000]);
});

test('abort during a pacing wait cancels the wait and prevents the queued POST', async () => {
  const controller = new AbortController(), starts = [];
  let waiting = false, activeWaitListeners = 0;
  const scheduler = createRequestScheduler({
    now: () => 1000,
    sleep: (ms, signal) => new Promise((resolve, reject) => {
      if (signal?.aborted) { reject(Object.assign(new Error('aborted'), { name: 'AbortError' })); return; }
      waiting = true;
      activeWaitListeners++;
      const onAbort = () => {
        activeWaitListeners--;
        signal.removeEventListener('abort', onAbort);
        reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
      };
      signal.addEventListener('abort', onAbort, { once: true });
    }),
    fetch: async () => { starts.push(true); return response(200); }
  });
  await scheduler.send('/api/extract-pdf', { method: 'POST', body: 'first' });
  const pending = scheduler.send('/api/extract-pdf', { method: 'POST', body: 'cancelled', signal: controller.signal });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(waiting, true);
  assert.equal(activeWaitListeners, 1);
  controller.abort();
  await assert.rejects(pending, error => error.name === 'AbortError');
  assert.equal(activeWaitListeners, 0);
  assert.equal(starts.length, 1);
});

test('non-429 HTTP errors and network failures are never automatically retried', async () => {
  let httpCalls = 0;
  const httpScheduler = createRequestScheduler({
    now: () => 0,
    sleep: async () => {},
    fetch: async () => { httpCalls++; return response(503); }
  });
  assert.equal((await httpScheduler.send('/api/extract-pdf', { method: 'POST', body: '{}' })).status, 503);
  assert.equal(httpCalls, 1);

  let networkCalls = 0;
  const networkScheduler = createRequestScheduler({
    now: () => 0,
    sleep: async () => {},
    fetch: async () => { networkCalls++; throw new TypeError('network unavailable'); }
  });
  await assert.rejects(networkScheduler.send('/api/extract-pdf', { method: 'POST', body: '{}' }), /network unavailable/);
  assert.equal(networkCalls, 1);
});

test('default abortable timeout clears its timer and listener when cancelled', async () => {
  const controller = new AbortController();
  const signal = controller.signal;
  const originalSetTimeout = global.setTimeout;
  const originalClearTimeout = global.clearTimeout;
  const originalAdd = signal.addEventListener.bind(signal);
  const originalRemove = signal.removeEventListener.bind(signal);
  let timerId, clearedTimer = false, addedAbortListener = false, removedAbortListener = false;
  global.setTimeout = (callback, ms) => { timerId = originalSetTimeout(callback, ms); return timerId; };
  global.clearTimeout = id => { if (id === timerId) clearedTimer = true; return originalClearTimeout(id); };
  signal.addEventListener = (name, listener, options) => { if (name === 'abort') addedAbortListener = true; return originalAdd(name, listener, options); };
  signal.removeEventListener = (name, listener, options) => { if (name === 'abort') removedAbortListener = true; return originalRemove(name, listener, options); };
  try {
    const pending = require('../docs/pdf-batches.js').abortableTimeout(60_000, signal);
    controller.abort();
    await assert.rejects(pending, error => error.name === 'AbortError');
    assert.equal(addedAbortListener, true);
    assert.equal(removedAbortListener, true);
    assert.equal(clearedTimer, true);
  } finally {
    global.setTimeout = originalSetTimeout;
    global.clearTimeout = originalClearTimeout;
    signal.addEventListener = originalAdd;
    signal.removeEventListener = originalRemove;
  }
});
