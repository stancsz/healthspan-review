(function () {
  "use strict";

  var secaParser = window.FrailtySecaParser;
  var clinicalParser = window.HealthspanClinicalParser;
  var state = { parsed: null, clinical: null, source: "", packet: null, active: "import", warnings: [] };
  var valueLabels = {
    bmi: "Body mass index", height_cm: "Height", weight_kg: "Weight", fat_mass_kg: "Fat mass",
    fat_free_mass_kg: "Fat-free mass", estimated_height_cm: "Estimated height", ffmi: "FFMI",
    skeletal_muscle_mass: "Skeletal muscle mass", visceral_fat: "Visceral adipose tissue",
    phase_angle: "Phase angle", ecw_tbw: "ECW/TBW"
  };
  var categoryLabels = { demographics: "Demographics", bia: "BIA / SECA", blood: "Blood", history: "History", functional: "Function" };

  function $(selector) { return document.querySelector(selector); }
  function escapeHtml(value) { return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]; }); }
  function formatValue(value) { return typeof value === "number" ? (Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")) : String(value == null ? "not present" : value); }
  function formatDelta(value) { return (value >= 0 ? "+" : "") + formatValue(value); }
  function labelFor(field) { return valueLabels[field] || (clinicalParser.byName[field] && clinicalParser.byName[field].label) || field.replace(/_/g, " "); }
  function unitFor(field, units) { return (units && units[field]) || (clinicalParser.byName[field] && clinicalParser.byName[field].unit) || (field === "estimated_height_cm" ? "cm" : field === "ffmi" ? "kg/m²" : ""); }
  function setStatus(text, isError) { var el = $("#import-status"); el.textContent = text; el.style.color = isError ? "var(--rust)" : "var(--forest)"; }
  function emptyParsed() { return { latest: { values: {}, units: {}, segments: {}, segmentUnits: {}, warnings: [], derivations: [] }, scans: [], measuredAt: "not provided", trend: {}, segmentalTrend: {}, trendAvailable: false, unmappedLabels: [], assessmentReadiness: null }; }
  function present(value) { return value !== null && value !== undefined && value !== ""; }

  function mergeValues() {
    var merged = {}, provenance = {}, units = {}, warnings = state.warnings.slice();
    var seca = state.parsed && state.parsed.latest ? state.parsed.latest : null;
    if (seca) Object.keys(seca.values || {}).forEach(function (field) { merged[field] = seca.values[field]; provenance[field] = "SECA TableView CSV"; units[field] = unitFor(field, seca.units); });
    if (state.clinical) {
      clinicalParser.specs.forEach(function (spec) {
        var value = state.clinical.values[spec.name];
        if (!present(value)) return;
        if (present(merged[spec.name]) && String(merged[spec.name]) !== String(value)) {
          warnings.push(spec.name + ": SECA value retained over conflicting clinical CSV value");
          return;
        }
        merged[spec.name] = value; provenance[spec.name] = "Clinical inputs CSV"; units[spec.name] = unitFor(spec.name, state.clinical.units);
      });
    }
    return { values: merged, provenance: provenance, units: units, warnings: warnings };
  }

  function readiness(values) {
    var missing = [], blood = clinicalParser.specs.filter(function (s) { return s.category === "blood" && present(values[s.name]); });
    var history = clinicalParser.specs.filter(function (s) { return s.category === "history" && present(values[s.name]); });
    if (!present(values.age) || !present(values.sex)) missing.push("age and sex (not present in the supplied inputs; never inferred)");
    ["bmi", "phase_angle", "ecw_tbw"].forEach(function (field) { if (!present(values[field])) missing.push(labelFor(field) + " (not present in the supplied inputs)"); });
    if (blood.length < 6 || (!present(values.fasting_glucose) && !present(values.hba1c))) missing.push("at least 6 blood-panel values, including fasting glucose or HbA1c (" + blood.length + " present)");
    if (history.length < 4) missing.push("at least 4 clinical-history values (" + history.length + " present)");
    return { assessmentReady: missing.length === 0, missingRequirements: missing, bloodCount: blood.length, historyCount: history.length };
  }

  function buildPacket(merged, ready) {
    var base = state.parsed && state.parsed.latest && state.parsed.latest.values && Object.keys(state.parsed.latest.values).length ? secaParser.buildMeasurementReviewPack(state.parsed, "Local SECA TableView CSV") : null;
    var clinicalLedger = state.clinical ? clinicalParser.specs.filter(function (spec) { return present(state.clinical.values[spec.name]); }).map(function (spec) {
      return { field: spec.name, value: state.clinical.values[spec.name], unit: unitFor(spec.name, state.clinical.units), category: spec.category, provenance: "observed_in_clinical_inputs_csv" };
    }) : [];
    var completeProfile = clinicalParser.specs.map(function (spec) {
      return { field: spec.name, value: present(merged.values[spec.name]) ? merged.values[spec.name] : null, unit: unitFor(spec.name, merged.units), category: spec.category, provenance: merged.provenance[spec.name] || null };
    });
    return {
      format: "local-measurement-review-pack-v0.2",
      intended_use: "research_and_wellness_measurement_review_only",
      clinical_use: "forbidden",
      source: { seca: base ? base.source : null, clinical: state.clinical ? { format: "canonical clinical inputs CSV", label: "Local clinical inputs CSV" } : null },
      measurement_ledger: base ? base.measurement_ledger : [],
      segment_ledger: base ? base.segment_ledger : [],
      clinical_ledger: clinicalLedger,
      complete_profile: { present_count: completeProfile.filter(function (row) { return present(row.value); }).length, total_count: completeProfile.length, fields: completeProfile },
      parsing_review: { unmapped_labels: state.parsed ? state.parsed.unmappedLabels : [], unit_warnings: (state.parsed && state.parsed.latest ? state.parsed.latest.warnings : []).concat(state.clinical ? state.clinical.warnings : []), derivations: state.parsed && state.parsed.latest ? state.parsed.latest.derivations : [], merge_warnings: merged.warnings },
      assessment_readiness: { assessment_ready: ready.assessmentReady, missing_requirements: ready.missingRequirements, blood_values_present: ready.bloodCount, history_values_present: ready.historyCount, note: "This is an input-completeness check, not a clinical assessment." },
      frailty_index: { status: "not_computed_in_browser_review", numerator: null, denominator: null, coverage_caveat: "The browser review does not compute an FI. Missing values must not be imputed." },
      comparison: base ? base.comparison : { status: "unavailable", basis: null, measurement_deltas: {}, segmental_deltas: {}, caveat: "A SECA comparison requires two dated scans." },
      estimated_ages: state.clinical && state.clinical.estimatedAges ? state.clinical.estimatedAges : [],
      boundaries: ["No diagnosis or treatment advice.", "Estimated age signals are illustrative, unvalidated, and not a biological or system age.", "No validated biological or system age.", "E-005 remains blocked.", "Generated locally; no source CSV or patient identifier is included."]
    };
  }

  function showView(name) {
    ["import", "review", "export"].forEach(function (key) {
      var view = $("#" + key + "-view"), step = document.querySelector('[data-step="' + key + '"]'), active = key === name;
      view.hidden = !active; view.classList.toggle("is-visible", active); step.classList.toggle("is-active", active);
    });
    state.active = name;
    if (name === "export") $("#export-summary").textContent = state.source + " is ready as a local review packet.";
  }
  function enableWorkflow() { document.querySelector('[data-step="review"]').disabled = false; document.querySelector('[data-step="export"]').disabled = false; }

  function loadRecord(parsed, clinical, source) {
    state.parsed = parsed || emptyParsed(); state.clinical = clinical || null; state.source = source; state.warnings = [];
    var merged = mergeValues(), ready = readiness(merged.values); state.packet = buildPacket(merged, ready);
    renderReview(merged, ready); enableWorkflow(); showView("review"); setStatus("Review loaded locally. No upload occurred.", false);
  }
  function loadSecaText(text, source) { try { loadRecord(secaParser.parseSecaCsv(text), state.clinical, source); } catch (error) { setStatus("Could not open this SECA export: " + error.message, true); } }
  function loadClinicalText(text, source) { try { loadRecord(state.parsed, clinicalParser.parseClinicalCsv(text, source), state.source || source); } catch (error) { setStatus("Could not open this clinical CSV: " + error.message, true); } }
  function openFile(file, kind) {
    if (!file) return;
    var max = kind === "seca" ? secaParser.MAX_SECA_BYTES : clinicalParser.MAX_BYTES;
    if (file.size > max) { setStatus("This file is larger than the 5 MB local preview limit.", true); return; }
    var reader = new FileReader(); reader.onload = function () { kind === "seca" ? loadSecaText(String(reader.result), "Local SECA export · " + file.name) : loadClinicalText(String(reader.result), "Local clinical inputs · " + file.name); };
    reader.onerror = function () { setStatus("This local file could not be read.", true); }; reader.readAsText(file);
  }

  function renderReview(merged, ready) {
    var p = state.parsed || emptyParsed(), latest = p.latest, values = latest.values || {}, canonicalPresent = clinicalParser.specs.filter(function (spec) { return present(merged.values[spec.name]); }).length;
    $("#record-status").textContent = state.source + "  ·  latest scan " + p.measuredAt + "  ·  parsed in this browser only";
    $("#summary-cards").innerHTML = [["Latest scan", p.measuredAt], ["Dated scans", p.scans.length || 0], ["SECA fields", Object.keys(values).length], ["Full profile", canonicalPresent + " / " + clinicalParser.specs.length], ["Parser warnings", (latest.warnings || []).length + (p.unmappedLabels || []).length + (merged.warnings || []).length]].map(function (item) { return '<div class="summary-card"><span>' + escapeHtml(item[0]) + '</span><strong>' + escapeHtml(formatValue(item[1])) + '</strong></div>'; }).join("");
    $("#ledger-rows").innerHTML = Object.keys(values).sort().map(function (field) {
      var derived = (latest.derivations || []).some(function (item) { return item.indexOf(field + " ") === 0; });
      return '<tr><td>' + escapeHtml(labelFor(field)) + '</td><td>' + escapeHtml(formatValue(values[field])) + '</td><td>' + escapeHtml(unitFor(field, latest.units)) + '</td><td class="' + (derived ? "derived-label" : "") + '">' + (derived ? "Derived" : "Observed") + '</td></tr>';
    }).join("");
    $("#ledger-empty").hidden = Boolean(Object.keys(values).length);
    var segments = Object.keys(latest.segments || {}).sort(); $("#segment-tag").textContent = segments.length + " observed";
    $("#segment-rows").innerHTML = segments.map(function (segment) { var delta = p.segmentalTrend && p.segmentalTrend[segment] !== undefined ? formatDelta(p.segmentalTrend[segment]) : "Not available"; return "<tr><td>" + escapeHtml(segment) + "</td><td>" + escapeHtml(formatValue(latest.segments[segment])) + "</td><td>" + escapeHtml((latest.segmentUnits || {})[segment] || "") + "</td><td>" + escapeHtml(delta) + "</td><td class=\"derived-label\">Observed</td></tr>"; }).join("");
    $("#segment-empty").hidden = Boolean(segments.length);
    $("#missing-count").textContent = ready.missingRequirements.length + " open items";
    $("#missing-copy").textContent = ready.missingRequirements.length ? "The current sources do not contain every minimum review input. Missing values remain visible and are never inferred." : "All minimum review inputs are present in the supplied local sources. This completeness result describes the packet only, not clinical validity.";
    $("#missing-list").innerHTML = ready.missingRequirements.length ? ready.missingRequirements.map(function (item) { return "<li>" + escapeHtml(item) + "</li>"; }).join("") : "<li class=\"complete-item\">All minimum review inputs are present.</li>";
    renderClinical(merged);
    renderEstimatedAges();
    $("#complete-panel").hidden = !canonicalPresent; $("#complete-tag").textContent = canonicalPresent + " / " + clinicalParser.specs.length + (canonicalPresent === clinicalParser.specs.length ? " complete" : " present");
    $("#complete-rows").innerHTML = clinicalParser.specs.map(function (spec) { var value = merged.values[spec.name]; return '<tr><td>' + escapeHtml(spec.label) + '<br><small class="field-name">' + escapeHtml(spec.name) + '</small></td><td>' + escapeHtml(formatValue(value)) + '</td><td>' + escapeHtml(unitFor(spec.name, merged.units)) + '</td><td>' + escapeHtml(categoryLabels[spec.category]) + '</td><td class="' + (present(value) ? "derived-label" : "") + '">' + escapeHtml(merged.provenance[spec.name] || "Not provided") + '</td></tr>'; }).join("");
    var full = canonicalPresent === clinicalParser.specs.length; $("#fi-title").textContent = full ? "All canonical readings are present." : "Withheld until the review contract is met."; $("#fi-copy").textContent = full ? "This complete synthetic or locally supplied profile contains 35/35 canonical fields. The browser workspace still does not compute a clinical FI or produce a diagnosis." : "The FI numerator and denominator are not computed from a partial review. Missing items must remain missing, and they must never be imputed just to produce a score.";
    var comparison = $("#comparison-content"), tag = $("#comparison-tag");
    if (p.trendAvailable) { tag.textContent = "2 dated scans"; comparison.innerHTML = '<ul class="comparison-list">' + Object.keys(p.trend).slice(0, 6).map(function (field) { return '<li><span>' + escapeHtml(labelFor(field)) + '</span><strong>' + escapeHtml(formatDelta(p.trend[field])) + '</strong></li>'; }).join("") + '</ul><p class="comparison-caveat">These are equipment-value deltas only. They are not evidence of improved health or an action effect.</p>'; }
    else { tag.textContent = "Not available"; comparison.innerHTML = '<p class="panel-copy">Only one dated SECA scan was found. A comparison requires two dated scans and is never inferred.</p>'; }
    var notes = [["Unmapped rows", p.unmappedLabels && p.unmappedLabels.length ? p.unmappedLabels.join(", ") : "None", "warning"], ["Unit warnings", latest.warnings && latest.warnings.length ? latest.warnings.join(" ") : "None", "warning"], ["Merge warnings", merged.warnings.length ? merged.warnings.join(" ") : "None", "warning"], ["Derivations", latest.derivations && latest.derivations.length ? latest.derivations.join(" · ") : "None", "derived"]];
    $("#parser-notes").innerHTML = notes.map(function (note) { return '<div class="note-block ' + note[2] + '"><h4>' + escapeHtml(note[0]) + '</h4><p>' + escapeHtml(note[1]) + '</p></div>'; }).join("");
  }
  function renderClinical(merged) {
    if (!state.clinical) { $("#clinical-panel").hidden = true; return; }
    var count = state.clinical.presentFields.length; $("#clinical-panel").hidden = false; $("#clinical-tag").textContent = count + " fields";
    $("#clinical-copy").textContent = state.clinical.complete ? "The clinical CSV contains all 35 canonical fields. Values remain separate from the SECA source ledger." : count + " canonical fields were supplied. Missing fields remain explicitly absent.";
    $("#clinical-rows").innerHTML = clinicalParser.specs.filter(function (spec) { return present(state.clinical.values[spec.name]); }).map(function (spec) { return '<tr><td>' + escapeHtml(spec.label) + '<br><small class="field-name">' + escapeHtml(spec.name) + '</small></td><td>' + escapeHtml(formatValue(state.clinical.values[spec.name])) + '</td><td>' + escapeHtml(unitFor(spec.name, state.clinical.units)) + '</td><td>' + escapeHtml(categoryLabels[spec.category]) + '</td><td class="derived-label">Clinical CSV</td></tr>'; }).join("");
  }
  function renderEstimatedAges() {
    var estimates = state.clinical && state.clinical.estimatedAges ? state.clinical.estimatedAges : [];
    $("#estimated-ages-panel").hidden = !estimates.length;
    $("#estimated-ages-tag").textContent = estimates.length ? estimates.length + " illustrative" : "";
    $("#estimated-age-cards").innerHTML = estimates.map(function (item) {
      var value = present(item.value) ? formatValue(item.value) + " " + (item.unit || "years") : "Not available";
      var basis = item.basis && item.basis.length ? "Basis: " + item.basis.join(", ") + ". " : "";
      return '<article class="estimated-age-card"><span class="age-label">' + escapeHtml(item.label || item.key || "Estimated age") + '</span><strong>' + escapeHtml(value) + '</strong><span class="age-status">Estimated · unvalidated</span><p class="age-basis">' + escapeHtml(basis + (item.method || "Illustrative estimate.") + " " + (item.uncertainty || "No validated uncertainty interval is available.")) + '</p></article>';
    }).join("");
  }
  function downloadPacket() { if (!state.packet) return; var blob = new Blob([JSON.stringify(state.packet, null, 2) + "\n"], { type: "application/json" }), url = URL.createObjectURL(blob), a = document.createElement("a"); a.href = url; a.download = "local-measurement-review-pack-v0.2.json"; a.click(); URL.revokeObjectURL(url); $("#export-status").textContent = "Downloaded locally. The packet contains no original CSV or patient identifier."; showView("export"); }
  function printPacket() { if (!state.packet) return; showView("review"); window.print(); }
  function reset() { state = { parsed: null, clinical: null, source: "", packet: null, active: "import", warnings: [] }; $("#seca-file").value = ""; $("#clinical-file").value = ""; setStatus("No record open.", false); showView("import"); }
  function fetchText(url) { return fetch(url, { cache: "no-store" }).then(function (response) { if (!response.ok) throw new Error(url + " returned " + response.status); return response.text(); }); }

  $("#seca-file").addEventListener("change", function () { openFile(this.files && this.files[0], "seca"); }); $("#clinical-file").addEventListener("change", function () { openFile(this.files && this.files[0], "clinical"); });
  $("#load-sample").addEventListener("click", function () { var button = this; button.disabled = true; setStatus("Opening the complete synthetic case locally…", false); Promise.all([fetchText("example-seca-tableview.csv"), fetchText("example-complete-synthetic.json")]).then(function (parts) { loadRecord(secaParser.parseSecaCsv(parts[0]), clinicalParser.parseProfile(JSON.parse(parts[1]), "Complete synthetic clinical profile"), "Complete synthetic case · SECA + clinical profile"); }).catch(function (error) { setStatus("Complete synthetic case could not be loaded: " + error.message, true); }).finally(function () { button.disabled = false; }); });
  $("#load-seca-preview").addEventListener("click", function () { var button = this; button.disabled = true; setStatus("Opening the SECA-only preview locally…", false); fetchText("example-seca-tableview.csv").then(function (text) { loadRecord(secaParser.parseSecaCsv(text), null, "Synthetic SECA-only preview"); }).catch(function (error) { setStatus("SECA sample could not be loaded: " + error.message, true); }).finally(function () { button.disabled = false; }); });
  $("#drop-zone").addEventListener("click", function () { $("#seca-file").click(); }); $("#clinical-drop-zone").addEventListener("click", function () { $("#clinical-file").click(); });
  [["#drop-zone", "seca"], ["#clinical-drop-zone", "clinical"]].forEach(function (item) { var zone = $(item[0]); ["dragenter", "dragover"].forEach(function (name) { zone.addEventListener(name, function (event) { event.preventDefault(); zone.classList.add("is-dragging"); }); }); ["dragleave", "drop"].forEach(function (name) { zone.addEventListener(name, function (event) { event.preventDefault(); zone.classList.remove("is-dragging"); }); }); zone.addEventListener("drop", function (event) { openFile(event.dataTransfer.files && event.dataTransfer.files[0], item[1]); }); zone.addEventListener("keydown", function (event) { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); $(item[1] === "seca" ? "#seca-file" : "#clinical-file").click(); } }); });
  document.querySelectorAll("[data-step]").forEach(function (step) { step.addEventListener("click", function () { if (!this.disabled && (this.dataset.step !== "export" || state.packet)) showView(this.dataset.step); }); });
  $("#new-record").addEventListener("click", reset); $("#export-button").addEventListener("click", downloadPacket); $("#print-button").addEventListener("click", printPacket); $("#export-again").addEventListener("click", downloadPacket); $("#print-again").addEventListener("click", printPacket); $("#back-to-review").addEventListener("click", function () { showView("review"); });
})();
