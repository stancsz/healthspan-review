const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const parser = require(path.join(root, "docs", "clinical-parser.js"));

test("complete synthetic profile has all 35 canonical fields", () => {
  const profile = JSON.parse(fs.readFileSync(path.join(root, "docs", "example-complete-synthetic.json"), "utf8"));
  const result = parser.parseProfile(profile);
  assert.equal(parser.specs.length, 35);
  assert.equal(result.presentFields.length, 35);
  assert.deepEqual(result.missingFields, []);
  assert.equal(result.complete, true);
  const joint = result.estimatedAges.find((item) => item.key === "joint_age");
  assert.equal(result.estimatedAges.length, 17);
  assert.equal(joint.label, "Joint age");
  assert.equal(joint.value, 35);
  assert.equal(joint.status, "estimated_heuristic");
  assert.ok(joint.inputsUsed.includes("grip_strength"));
  assert.equal(joint.inputCoverage, "6 / 6");
});

test("clinical CSV preserves canonical values and rejects unknown fields", () => {
  const csv = fs.readFileSync(path.join(root, "docs", "example-clinical-inputs.csv"), "utf8");
  const result = parser.parseClinicalCsv(csv);
  assert.equal(result.presentFields.length, 35);
  assert.equal(result.values.fasting_glucose, 92);
  assert.equal(result.values.sex, "female");
  assert.equal(result.units.hba1c, "%");
  assert.throws(() => parser.parseClinicalCsv("Field,Value,Unit\nage,45,years\nnot_a_feature,1,"), /unknown/);
  assert.equal(result.estimatedAges.length, 17);
  const partial = parser.parseClinicalCsv("Field,Value,Unit\nage,60,years\ngrip_strength,20,kg");
  const partialJoint = partial.estimatedAges.find((item) => item.key === "joint_age");
  assert.equal(partialJoint.label, "Joint age");
  assert.equal(partialJoint.inputCoverage, "2 / 6");
  assert.deepEqual(partialJoint.inputsUsed, ["age", "grip_strength"]);
});
