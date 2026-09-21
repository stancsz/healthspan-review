const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "docs", "workbench.html"), "utf8");
const css = fs.readFileSync(path.join(root, "docs", "workbench.css"), "utf8");
const js = fs.readFileSync(path.join(root, "docs", "workbench.js"), "utf8");
const vercel = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));

test("Vercel root routes to the clinician workspace", () => {
  assert.ok(vercel.rewrites.some((route) => route.source === "/" && route.destination === "/docs/workbench.html"));
  assert.ok(vercel.rewrites.some((route) => route.source === "/workbench" && route.destination === "/docs/workbench.html"));
  assert.ok(vercel.rewrites.some((route) => route.source === "/workbench.css" && route.destination === "/docs/workbench.css"));
  assert.ok(vercel.rewrites.some((route) => route.source === "/workbench.js" && route.destination === "/docs/workbench.js"));
  assert.ok(vercel.rewrites.some((route) => route.source === "/manual" && route.destination === "/docs/manual.html"));
  assert.ok(vercel.rewrites.some((route) => route.source === "/clinical-parser.js" && route.destination === "/docs/clinical-parser.js"));
  assert.match(html, /id="drop-zone"/);
  assert.match(html, /id="clinical-file"/);
  assert.match(html, /id="load-sample"/);
  assert.match(html, /example-clinical-inputs.csv/);
  assert.match(html, /manual.html/);
  assert.match(html, /id="review-view"/);
  assert.match(html, /id="export-view"/);
  assert.match(html, /id="segment-rows"/);
  assert.match(html, /id="estimated-ages-panel"/);
  assert.match(html, /Estimated age signals/);
});

test("clinician workspace keeps the local-only safety boundary visible", () => {
  assert.match(html, /Data stays in this browser tab/);
  assert.match(html, /Nothing is uploaded/);
  assert.match(html, /No diagnosis, treatment advice, or validated biological age/);
  assert.match(html, /Clinical use: forbidden/);
  assert.match(js, /buildMeasurementReviewPack/);
  assert.match(js, /35/);
  assert.match(js, /Clinical inputs CSV/);
  assert.match(js, /contains no original CSV or patient identifier/);
  assert.match(js, /estimatedAges/);
  assert.match(js, /estimateJointAge/);
  assert.match(js, /heuristic/);
  assert.match(js, /Estimated · unvalidated/);
  assert.doesNotMatch(js, /fetch\s*\([^)]*https?:\/\//);
});

test("workspace exposes accessible actions and print styling", () => {
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /aria-label="Review workflow"/);
  assert.match(html, /type="file" accept="\.csv,text\/csv"/);
  assert.match(css, /@media print/);
  assert.match(css, /\.fi-panel/);
  assert.match(css, /\.segment-panel/);
  assert.match(html, /Segment readings/);
});

test("manual entry surface is present and local-only", () => {
  const manualHtml = fs.readFileSync(path.join(root, "docs", "manual.html"), "utf8");
  const manualJs = fs.readFileSync(path.join(root, "docs", "manual.js"), "utf8");
  assert.match(manualHtml, /id="manual-form"/);
  assert.match(manualHtml, /Fill complete synthetic profile/);
  assert.match(manualJs, /parser\.specs/);
  assert.match(manualJs, /No patient identifier/);
  assert.match(manualHtml, /id="manual-estimated-ages"/);
  assert.match(manualJs, /estimated_ages/);
});
