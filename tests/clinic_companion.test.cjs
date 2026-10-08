const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '../docs/clinic-companion.html'), 'utf8');
const source = fs.readFileSync(path.join(__dirname, '../docs/clinic-companion.js'), 'utf8');

// Exercise the shipped event handlers with a tiny DOM, without exposing mutable
// app state. The independently run browser review covers real layout and input.
function harness() {
  let now = new Date('2026-10-08T12:00:00Z'), downloaded, focused, interval;
  const nodes = new Map();
  function node(id, dataset = {}) {
    const classes = new Set();
    const listeners = {};
    const n = { id, dataset, value: '', textContent: '', hidden: false, disabled: false,
      attributes: {}, classList: { toggle(c, on) { on ? classes.add(c) : classes.delete(c); }, contains(c) { return classes.has(c); } },
      addEventListener(event, handler) { listeners[event] = handler; },
      setAttribute(k, v) { this.attributes[k] = v; }, removeAttribute(k) { delete this.attributes[k]; },
      focus() { focused = id; }, remove() {}, click() { if (!this.disabled && listeners.click) listeners.click({}); },
      dispatch(type) { if (listeners[type]) listeners[type]({ preventDefault() {} }); }
    };
    nodes.set(id, n); return n;
  }
  for (const match of html.matchAll(/id="([^"]+)"/g)) node(match[1]);
  const steps = ['measure', 'plan', 'today', 'followup'].map(name => node('step-' + name, { view: name }));
  const goes = ['plan', 'today', 'followup'].map(name => node('go-' + name, { go: name }));
  const checks = ['done', 'difficult'].map(name => node('check-' + name, { check: name }));
  const views = ['measure', 'plan', 'today', 'followup'].map(name => nodes.get(name + '-view'));
  nodes.get('measure-view').classList.toggle('shown', true);
  nodes.get('goal').value = 'More energy through the week';
  nodes.get('action').value = 'Add a 10-minute walk after lunch on three weekdays, if this feels manageable.';
  nodes.get('rationale').value = 'A small, repeatable starting point. Adjust together if it does not fit your routine.';
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [now])); } }
  const document = {
    getElementById(id) { assert.ok(nodes.has(id), `missing element ${id}`); return nodes.get(id); },
    querySelectorAll(selector) { return ({ '.view': views, '.step': steps, '[data-view]': steps, '[data-go]': goes, '.checkin': checks })[selector] || []; },
    addEventListener() {}, body: { appendChild() {} }, createElement() { return node('download-link'); }
  };
  vm.runInNewContext(source, { document, Date: Clock, Blob, URL: { createObjectURL(blob) { downloaded = blob; return 'blob:demo'; }, revokeObjectURL() {} },
    window: { scrollTo() {}, setInterval(handler) { interval = handler; }, setTimeout() {} } });
  return { get: id => nodes.get(id), click: id => nodes.get(id).click(), edit(id, value) { nodes.get(id).value = value; nodes.get(id).dispatch('input'); },
    tick(iso) { now = new Date(iso); interval(); }, download: () => downloaded, focus: () => focused };
}
function approve(h) { h.click('save-draft'); h.click('approve'); }

test('draft stays private; save enables exact snapshot approval and accessible navigation', () => {
  const h = harness();
  assert.equal(h.get('approve').disabled, true);
  assert.equal(h.get('today-card').hidden, true);
  assert.equal(h.get('review-date').value, '2026-11-05');
  h.click('step-plan');
  assert.equal(h.focus(), 'plan-title');
  assert.equal(h.get('step-plan').attributes['aria-current'], 'step');
  assert.equal(h.get('step-measure').attributes['aria-current'], undefined);
  h.click('save-draft');
  assert.equal(h.get('approve').disabled, false);
  assert.equal(h.get('today-card').hidden, true);
  h.click('approve');
  assert.equal(h.get('today-card').hidden, false);
  assert.match(h.get('plan-status').textContent, /HSR-042 rev 1 · v1/);
  assert.equal(h.focus(), 'today-title');
  assert.equal(h.get('approve').disabled, true);
});

test('check-in updates selection and downloads exact approved plan, timestamps and provenance', async () => {
  const h = harness(); approve(h); h.click('check-done');
  assert.equal(h.get('check-done').attributes['aria-pressed'], 'true');
  assert.equal(h.get('export-followup').disabled, false);
  h.click('check-difficult');
  assert.equal(h.get('check-done').attributes['aria-pressed'], 'false');
  assert.equal(h.get('check-difficult').attributes['aria-pressed'], 'true');
  h.click('export-followup');
  const packet = JSON.parse(await h.download().text());
  assert.equal(packet.current, true);
  assert.equal(packet.synthetic, true);
  assert.equal(packet.plan_version, 1);
  assert.equal(packet.approval.snapshot, 'HSR-042-rev-1');
  assert.equal(packet.approval.plan_version, packet.plan_version);
  assert.equal(packet.participant_check_in, 'difficult');
  assert.equal(packet.check_in_recorded_at, '2026-10-08T12:00:00.000Z');
  assert.equal(packet.plan.action, h.get('action').value);
  assert.deepEqual(packet.measurement_provenance.map(p => p.date), ['2026-10-08', '2026-10-08']);
  assert.match(packet.measurement_provenance[0].kind, /derived/);
  assert.doesNotMatch(JSON.stringify(packet), /Sam Taylor/);
});

test('editing approval closes patient and export, clears hidden text, and requires save plus new approval', () => {
  const h = harness(); approve(h); h.click('check-done');
  h.edit('action', 'Fictional revised action');
  assert.equal(h.get('today-card').hidden, true);
  assert.equal(h.get('today-action').textContent, '');
  assert.equal(h.get('export-followup').disabled, true);
  assert.equal(h.get('approve').disabled, true);
  assert.match(h.get('plan-version').textContent, /2/);
  approve(h);
  assert.equal(h.get('today-action').textContent, 'Fictional revised action');
  assert.equal(h.get('check-done').attributes['aria-pressed'], 'false');
  assert.equal(h.get('export-followup').disabled, true);
});

test('revocation closes access and does not resurrect the old check-in after reapproval', () => {
  const h = harness(); approve(h); h.click('check-done'); h.click('revoke');
  assert.equal(h.get('today-card').hidden, true);
  assert.equal(h.get('export-followup').disabled, true);
  assert.match(h.get('locked-reason').textContent, /revoked/);
  approve(h);
  assert.equal(h.get('today-card').hidden, false);
  assert.equal(h.get('check-done').attributes['aria-pressed'], 'false');
});

test('approval remains current through review date, then expiry fails closed for patient, check-in and export', () => {
  const h = harness(); approve(h); h.click('check-done');
  h.tick('2026-11-05T12:00:00Z');
  assert.equal(h.get('today-card').hidden, false);
  h.tick('2026-11-06T12:00:00Z');
  assert.equal(h.get('today-card').hidden, true);
  assert.equal(h.get('today-action').textContent, '');
  assert.equal(h.get('check-difficult').disabled, true);
  assert.equal(h.get('export-followup').disabled, true);
  assert.match(h.get('followup-check').textContent, /no longer current/);
  h.click('export-followup');
  assert.equal(h.download(), undefined);
});

test('blank, past and impossible date inputs cannot be saved or approved', () => {
  const h = harness(); h.edit('action', '   '); h.click('save-draft');
  assert.equal(h.get('approve').disabled, true);
  assert.equal(h.focus(), 'action');
  h.edit('action', 'Fictional action');
  for (const date of ['2026-10-07', '2026-13-40', '2026-02-30']) {
    h.edit('review-date', date); h.click('save-draft');
    assert.equal(h.get('approve').disabled, true);
    assert.match(h.get('plan-status').textContent, /valid review date/);
  }
});

test('reset clears the entire loop and computes a fresh future review date', () => {
  const h = harness(); approve(h); h.click('check-done'); h.tick('2026-12-01T12:00:00Z'); h.click('reset-demo');
  assert.equal(h.get('review-date').value, '2026-12-29');
  assert.equal(h.get('plan-version').textContent, 'Version 1');
  assert.equal(h.get('today-card').hidden, true);
  assert.equal(h.get('export-followup').disabled, true);
  assert.equal(h.get('measure-view').classList.contains('shown'), true);
});

test('source uses tab memory without network, storage or numeric age outputs', () => {
  assert.doesNotMatch(source, /localStorage|sessionStorage|fetch\s*\(|XMLHttpRequest/);
  assert.match(html, /Derived example/);
  assert.match(html, /Numeric system-age outputs are withheld/);
});


test('unsignaled field mutation also fails closed instead of exporting a stale approval', () => {
  const h = harness(); approve(h); h.click('check-done');
  h.get('action').value = 'Unsignaled fictional mutation';
  h.tick('2026-10-08T13:00:00Z');
  assert.equal(h.get('today-card').hidden, true);
  assert.equal(h.get('today-action').textContent, '');
  assert.equal(h.get('export-followup').disabled, true);
});
