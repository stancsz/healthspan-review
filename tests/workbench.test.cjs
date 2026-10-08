const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "docs", "workbench.html"), "utf8");
const css = fs.readFileSync(path.join(root, "docs", "workbench.css"), "utf8");
const js = fs.readFileSync(path.join(root, "docs", "workbench.js"), "utf8");
const vercel = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));

test("Vercel root routes to the clinic companion", () => {
  assert.ok(vercel.rewrites.some((route) => route.source === "/" && route.destination === "/docs/clinic-companion"));
  assert.ok(vercel.rewrites.some((route) => route.source === "/workbench" && route.destination === "/docs/workbench"));
  assert.ok(vercel.rewrites.some((route) => route.source === "/clinic-companion" && route.destination === "/docs/clinic-companion"));
  assert.ok(vercel.rewrites.some((route) => route.source === "/workbench.css" && route.destination === "/docs/workbench.css"));
  assert.ok(vercel.rewrites.some((route) => route.source === "/workbench.js" && route.destination === "/docs/workbench.js"));
  assert.ok(vercel.rewrites.some((route) => route.source === "/manual" && route.destination === "/docs/manual"));
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
  assert.match(html, /System-age estimates are withheld/);
});

test("clinician workspace discloses optional external PDF processing", () => {
  assert.match(html, /CSV files stay local/);
  assert.match(html, /original PDF is not uploaded/);
  assert.match(html, /text and rendered page images leave this browser for processing by an external AI service/);
  assert.match(html, /up to 50 pages and 12 MB/i);
  assert.match(html, /pdf-batches\.js/);
  assert.match(html, /I consent to sending its selected page content to an external AI service/);
  assert.doesNotMatch(html, /MiniMax|Vercel function/);
  assert.doesNotMatch(js, /MiniMax/);
  assert.match(html, /No diagnosis or treatment advice\. Numeric system-age outputs are withheld/);
  assert.match(html, /Clinical use: forbidden/);
  assert.match(js, /buildMeasurementReviewPack/);
  assert.match(js, /35/);
  assert.match(js, /Clinical inputs CSV/);
  assert.match(js, /contains no original CSV or patient identifier/);
  assert.match(js, /estimated_ages: \[\]/);
  assert.match(js, /withheld pending domain-specific evidence/);
  assert.doesNotMatch(js, /estimateAgeSignals|heuristic/);
  assert.doesNotMatch(js, /fetch\s*\([^)]*https?:\/\//);
});

test("workspace exposes accessible actions and print styling", () => {
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /aria-label="Review workflow"/);
  assert.match(html, /type="file" accept="\.csv,text\/csv"/);
  assert.match(css, /@media print/);
  assert.match(css, /\.fi-panel/);
  assert.match(css, /\.segment-panel/);
  assert.match(css, /#seca-file, #clinical-file\s*\{[^}]*opacity: 0;/);
  assert.match(html, /Segment readings/);
});

test("manual entry surface is present and local-only", () => {
  const manualHtml = fs.readFileSync(path.join(root, "docs", "manual.html"), "utf8");
  const manualJs = fs.readFileSync(path.join(root, "docs", "manual.js"), "utf8");
  assert.match(manualHtml, /id="manual-form"/);
  assert.match(manualHtml, /Fill complete synthetic profile/);
  assert.match(manualJs, /parser\.specs/);
  assert.match(manualJs, /No patient identifier/);
  assert.match(manualHtml, /Numeric outputs are withheld/);
  assert.match(manualJs, /estimated_ages: \[\]/);
  assert.doesNotMatch(manualJs, /estimatedAges/);
});


test("synthetic clinic companion binds approval, check-in and follow-up locally", () => {
  const companion = fs.readFileSync(path.join(root, "docs", "clinic-companion.html"), "utf8");
  const script = fs.readFileSync(path.join(root, "docs", "clinic-companion.js"), "utf8");
  assert.match(companion, /Synthetic case HSR-042/);
  assert.match(companion, /Clinician-authored weekly action/);
  assert.match(companion, /Approve for patient view/);
  assert.match(companion, /Patient view closed/);
  assert.match(script, /Object\.freeze\(draft\)/);
  assert.match(script, /approval\.snapshot === "HSR-042-rev-1"/);
  assert.match(script, /approval = null; checkin = null/);
  assert.match(script, /synthetic-clinic-followup-v1/);
  assert.doesNotMatch(script, /localStorage|sessionStorage|fetch\s*\(/);
});
