const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const parser = require("../docs/clinical-parser.js");

function setup() {
  const nodes = new Map();
  function node(id) {
    if (!nodes.has(id)) nodes.set(id, { _value: "", get value() { return this._value; }, set value(v) { this._value = String(v); }, hidden: true, disabled: true, textContent: "", innerHTML: "", events: {}, addEventListener(type, fn) { this.events[type] = fn; }, fire(type) { this.events[type]?.({ preventDefault() {} }); } });
    return nodes.get(id);
  }
  const profile = JSON.parse(fs.readFileSync(path.join(__dirname, "../docs/example-complete-synthetic.json"), "utf8"));
  const downloads = [];
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../docs/manual.js"), "utf8"), {
    window: { HealthspanClinicalParser: parser },
    document: { querySelector: node, createElement() { return { click() {} }; } },
    fetch: async () => ({ ok: true, json: async () => profile }),
    Blob: class { constructor(parts) { downloads.push(JSON.parse(parts.join(""))); } },
    URL: { createObjectURL() { return "blob:test"; }, revokeObjectURL() {} }
  });
  return { node, downloads };
}

test("manual edits require a fresh review and export the current values with units", async () => {
  const { node, downloads } = setup();
  node("#fill-synthetic").fire("click");
  await new Promise(resolve => setImmediate(resolve));
  node("#download-manual").fire("click");
  assert.equal(downloads[0].measurements.age, 45);
  assert.equal(downloads[0].units.fasting_glucose, "mg/dL");
  node("#field-age").value = "60";
  node("#manual-form").fire("input");
  assert.equal(node("#download-manual").disabled, true);
  assert.equal(node("#manual-result").hidden, true);
  node("#download-manual").fire("click");
  assert.equal(downloads.length, 1);
  node("#manual-form").fire("submit");
  node("#download-manual").fire("click");
  assert.equal(downloads[1].measurements.age, 60);
  assert.deepEqual(downloads[1].estimated_ages, []);
});

test("invalid manual review clears previously complete output", async () => {
  const { node } = setup();
  node("#fill-synthetic").fire("click");
  await new Promise(resolve => setImmediate(resolve));
  node("#field-age").value = "invalid";
  node("#manual-form").fire("submit");
  assert.equal(node("#manual-result").hidden, true);
  assert.equal(node("#download-manual").disabled, true);
  assert.match(node("#manual-status").textContent, /Check the entry/);
});
