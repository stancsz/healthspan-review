import { analyzePdfLocally } from './pdf-import.mjs';

(function () {
  "use strict";

  var secaParser = window.FrailtySecaParser;
  var clinicalParser = window.HealthspanClinicalParser;
  var state = { parsed: null, clinical: null, pdfClinical: null, pdfProvenance: {}, agentClinical: null, agentProvenance: {}, agentHistory: [], agentCandidates: [], pdfPages: [], pdfCandidates: [], source: "", packet: null, active: "import", warnings: [] };
  var agentFiles = [];
  var agentController = null;
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
  function compatibleUnit(expected, actual) {
    var clean = function (value) { return String(value || "").toLowerCase().replace(/[\s²³^]/g, "").replace(/[μµ]/g, "u"); };
    var target = clean(expected), source = clean(actual), aliases = {
      "ml/min/1.73m2": ["ml/min/1.73m2"], "kg/m2": ["kg/m2"], "degrees": ["degree", "degrees", "°"],
      "liters": ["l", "liter", "liters"], "years": ["year", "years", "yr"], "seconds": ["second", "seconds", "s"],
      "hours": ["hour", "hours", "hr"], "percent": ["%", "percent"], "10^9/l": ["10^9/l", "109/l"],
      "ratio": ["ratio", ""], "index": ["index", ""], "bpm": ["bpm", "beats/min"], "u/l": ["u/l"]
    };
    return target === source || (aliases[target] || [target]).indexOf(source) >= 0;
  }
  function agentCandidateValue(candidate, spec) {
    var unit = String(candidate.unit || "").trim(), valueText = String(candidate.value || "").trim(), evidence = String(candidate.evidence || "");
    if (spec.kind === "numeric") {
      if (unit && valueText.toLowerCase().endsWith(unit.toLowerCase())) valueText = valueText.slice(0, -unit.length).trim();
      if (!/^\s*[+-]?(?:\d[\d,]*(?:\.\d*)?|\.\d+)\s*$/.test(valueText)) throw new Error("Value needs manual review");
      if (spec.unit && !["ratio", "index"].includes(spec.unit.toLowerCase()) && !unit) throw new Error("Unit not printed");
      if (candidate.field === "fasting_glucose" && !/\bfasting\b/i.test(evidence)) throw new Error("Fasting status is not explicit");
      var numeric = Number(valueText.replace(/,/g, "")), normalized = numeric;
      var clean = unit.toLowerCase().replace(/[\sμµ]/g, function (match) { return match.trim() ? "u" : ""; });
      if (candidate.field === "fasting_glucose" && clean === "mmol/l") normalized = numeric * 18.018;
      else if (candidate.field === "creatinine" && ["umol/l", "micromol/l"].includes(clean)) normalized = numeric / 88.4;
      else if (candidate.field === "albumin" && clean === "g/l") normalized = numeric / 10;
      else if (unit && !compatibleUnit(spec.unit, unit)) throw new Error("Unit needs manual review");
      return clinicalParser.normalizeValue(normalized, spec);
    }
    return clinicalParser.normalizeValue(valueText, spec);
  }

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
    if (state.pdfClinical) clinicalParser.specs.forEach(function (spec) {
      var value = state.pdfClinical.values[spec.name];
      if (!present(value)) return;
      merged[spec.name] = value; provenance[spec.name] = "PDF · user-confirmed"; units[spec.name] = unitFor(spec.name, state.pdfClinical.units);
    });
    if (state.agentClinical) clinicalParser.specs.forEach(function (spec) {
      var value = state.agentClinical.values[spec.name];
      if (!present(value)) return;
      merged[spec.name] = value; provenance[spec.name] = "AI-assisted file · user-confirmed"; units[spec.name] = unitFor(spec.name, state.agentClinical.units);
    });
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
      return { field: spec.name, label: spec.label, value: present(merged.values[spec.name]) ? merged.values[spec.name] : null, unit: unitFor(spec.name, merged.units), category: spec.category, provenance: merged.provenance[spec.name] || null };
    });
    var domainSpecs = [
      ["body_composition", "Body composition", ["bmi", "waist_circumference", "visceral_fat"]],
      ["fluid_and_cellular", "Fluid and cellular health", ["phase_angle", "ecw_tbw"]],
      ["muscle_health", "Muscle health", ["ffmi", "skeletal_muscle_mass", "grip_strength", "chair_rise_time"]],
      ["joint_health", "Joint health", ["osteoarthritis", "chair_rise_time"]],
      ["bone_health", "Bone health", []],
      ["skin_health", "Skin health", []],
      ["blood_health", "Blood health", ["fasting_glucose", "hba1c", "hs_crp", "albumin", "creatinine", "egfr", "alp", "wbc", "rdw", "fib_4"]],
      ["cardiovascular_health", "Cardiovascular health", ["systolic_bp", "diastolic_bp", "resting_hr", "hs_crp", "hypertension", "cvd"]],
      ["cardiorespiratory_health", "Cardiorespiratory health", ["systolic_bp", "diastolic_bp", "resting_hr"]],
      ["immune_inflammatory_health", "Immune and inflammatory health", ["hs_crp", "wbc", "rdw"]],
      ["brain_cognitive_health", "Brain and cognitive health", []],
      ["metabolic_health", "Metabolic health", ["bmi", "waist_circumference", "visceral_fat", "fasting_glucose", "hba1c", "t2d"]],
      ["kidney_health", "Kidney health", ["creatinine", "egfr"]],
      ["liver_health", "Liver health", ["albumin", "alp", "fib_4"]],
      ["sleep_and_recovery", "Sleep and recovery", ["sleep_hours", "sleep_apnea"]],
      ["lifestyle_and_function", "Lifestyle and function", ["grip_strength", "chair_rise_time", "smoking_status", "alcohol_heavy_use", "sleep_hours"]],
      ["mental_health_history", "Mental-health history", ["depression"]]
    ];
    var domainAgeReports = domainSpecs.map(function (domain) {
      var supported = domain[2].map(function (name) { return completeProfile.find(function (field) { return field.field === name; }); }).filter(Boolean);
      var measured = supported.filter(function (field) { return present(field.value); }).map(function (field) { return field.field; });
      return { id: domain[0], label: domain[1], measured_fields: measured.map(function (name) { var field = completeProfile.find(function (item) { return item.field === name; }); return field ? field.label : name; }), expected_fields: domain[2], status: domain[2].length ? (measured.length ? "partial" : "not_available") : "not_available", reference_status: "not_available", age_report: { status: domain[2].length ? "withheld_unvalidated" : "not_available", point_estimate: null, interval: null, model_id: null, reference_panel_id: null } };
    });
    return {
      format: "local-measurement-review-pack-v0.2",
      intended_use: "research_and_wellness_measurement_review_only",
      clinical_use: "forbidden",
      source: { seca: base ? base.source : null, clinical: state.clinical ? { format: "canonical clinical inputs CSV", label: "Local clinical inputs CSV" } : null },
      measurement_ledger: base ? base.measurement_ledger : [],
      segment_ledger: base ? base.segment_ledger : [],
      clinical_ledger: clinicalLedger.concat(state.pdfClinical ? clinicalParser.specs.filter(function (spec) { return present(state.pdfClinical.values[spec.name]); }).map(function (spec) { var source = state.pdfProvenance[spec.name] || {}, entry = { field: spec.name, value: state.pdfClinical.values[spec.name], unit: unitFor(spec.name, state.pdfClinical.units), provenance: source }; return pdfCandidateReview.toLedgerRecord(entry, spec); }) : []).concat(state.agentClinical ? clinicalParser.specs.filter(function (spec) { return present(state.agentClinical.values[spec.name]); }).map(function (spec) { return { field: spec.name, value: state.agentClinical.values[spec.name], unit: unitFor(spec.name, state.agentClinical.units), category: spec.category, provenance: Object.assign({ type: "user_confirmed_ai_file_measurement", superseded: false }, state.agentProvenance[spec.name] || {}) }; }) : []).concat((state.agentHistory || []).map(function (entry) { var spec = clinicalParser.byName[entry.field]; return { field: entry.field, value: entry.value, unit: entry.unit || "", category: spec ? spec.category : "", provenance: Object.assign({ type: "user_confirmed_ai_file_measurement", historical: true, superseded: entry.superseded, duplicate_source: entry.superseded === false }, entry.provenance || {}) }; })),
      complete_profile: { present_count: completeProfile.filter(function (row) { return present(row.value); }).length, total_count: completeProfile.length, fields: completeProfile },
      chronological_age_context: { value: present(merged.values.age) ? merged.values.age : null, unit: "years", source: merged.provenance.age || null, status: present(merged.values.age) ? "supplied_not_recomputed" : "not_available", reference_date: null },
      domain_age_reports: domainAgeReports,
      parsing_review: { unmapped_labels: state.parsed ? state.parsed.unmappedLabels : [], unit_warnings: (state.parsed && state.parsed.latest ? state.parsed.latest.warnings : []).concat(state.clinical ? state.clinical.warnings : []), derivations: state.parsed && state.parsed.latest ? state.parsed.latest.derivations : [], merge_warnings: merged.warnings },
      assessment_readiness: { assessment_ready: ready.assessmentReady, missing_requirements: ready.missingRequirements, blood_values_present: ready.bloodCount, history_values_present: ready.historyCount, note: "This is an input-completeness check, not a clinical assessment." },
      frailty_index: { status: "not_computed_in_browser_review", numerator: null, denominator: null, coverage_caveat: "The browser review does not compute an FI. Missing values must not be imputed." },
      comparison: base ? base.comparison : { status: "unavailable", basis: null, measurement_deltas: {}, segmental_deltas: {}, caveat: "A SECA comparison requires two dated scans." },
      estimated_ages: [],
      boundaries: ["No diagnosis or treatment advice.", "Numeric system-age outputs are withheld pending domain-specific evidence and approval.", "E-005 remains blocked.", "Generated locally; no original source document is embedded. Review source excerpts and file names for identifiers before sharing.", "AI-suggested values were entered only after user confirmation."]
    };
  }

  function showView(name) {
    if (name !== "import" && !state.packet) return;
    ["import", "review", "export"].forEach(function (key) {
      var view = $("#" + key + "-view"), step = document.querySelector('[data-step="' + key + '"]'), active = key === name;
      view.hidden = !active; view.classList.toggle("is-visible", active); step.classList.toggle("is-active", active);
      if (active) step.setAttribute("aria-current", "step"); else step.removeAttribute("aria-current");
    });
    state.active = name;
    if (name === "export") $("#export-summary").textContent = state.source + " is ready as a local review packet.";
    var heading = $("#" + name + "-view h2");
    if (heading) { heading.setAttribute("tabindex", "-1"); heading.focus({ preventScroll: true }); }
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
    if (!state.clinical && !state.pdfClinical && !state.agentClinical) { $("#clinical-panel").hidden = true; return; }
    var csvRows = state.clinical ? clinicalParser.specs.filter(function (spec) { return present(state.clinical.values[spec.name]); }).map(function (spec) { return '<tr><td>' + escapeHtml(spec.label) + '<br><small class="field-name">' + escapeHtml(spec.name) + '</small></td><td>' + escapeHtml(formatValue(state.clinical.values[spec.name])) + '</td><td>' + escapeHtml(unitFor(spec.name, state.clinical.units)) + '</td><td>' + escapeHtml(categoryLabels[spec.category]) + '</td><td class="derived-label">Clinical CSV</td><td>Local CSV input</td></tr>'; }).join("") : "";
    var pdfRows = state.pdfClinical ? clinicalParser.specs.filter(function (spec) { return present(state.pdfClinical.values[spec.name]); }).map(function (spec) { var src = state.pdfProvenance[spec.name] || {}; return '<tr><td>' + escapeHtml(spec.label) + '<br><small class="field-name">' + escapeHtml(spec.name) + '</small></td><td>' + escapeHtml(formatValue(state.pdfClinical.values[spec.name])) + '</td><td>' + escapeHtml(unitFor(spec.name, state.pdfClinical.units)) + '</td><td>' + escapeHtml(categoryLabels[spec.category]) + '</td><td class="derived-label">PDF · user-confirmed</td><td>Page ' + escapeHtml(src.page || "?") + ': ' + escapeHtml(src.evidence || "") + '</td></tr>'; }).join("") : "";
    var agentRows = state.agentClinical ? clinicalParser.specs.filter(function (spec) { return present(state.agentClinical.values[spec.name]); }).map(function (spec) { var src = state.agentProvenance[spec.name] || {}; return '<tr><td>' + escapeHtml(spec.label) + '<br><small class="field-name">' + escapeHtml(spec.name) + '</small></td><td>' + escapeHtml(formatValue(state.agentClinical.values[spec.name])) + '</td><td>' + escapeHtml(unitFor(spec.name, state.agentClinical.units)) + '</td><td>' + escapeHtml(categoryLabels[spec.category]) + '</td><td class="derived-label">AI file · user-confirmed</td><td>' + escapeHtml(src.file || "") + ' · ' + escapeHtml(src.location || "") + ': ' + escapeHtml(src.evidence || "") + '</td></tr>'; }).join("") : "";
    var agentHistoryRows = (state.agentHistory || []).map(function (entry) { var spec = clinicalParser.byName[entry.field], src = entry.provenance || {}, status = entry.superseded ? "Previously confirmed · superseded" : "Previously confirmed · same reading from another source"; return '<tr><td>' + escapeHtml(spec ? spec.label : entry.field) + '<br><small class="field-name">' + escapeHtml(entry.field) + '</small></td><td>' + escapeHtml(formatValue(entry.value)) + '</td><td>' + escapeHtml(entry.unit || "") + '</td><td>' + escapeHtml(spec ? categoryLabels[spec.category] : "") + '</td><td class="warning-label">' + escapeHtml(status) + '</td><td>' + escapeHtml(src.file || "") + ' · ' + escapeHtml(src.location || "") + ': ' + escapeHtml(src.evidence || "") + '</td></tr>'; }).join("");
    var count = clinicalParser.specs.filter(function (spec) { return present(merged.values[spec.name]); }).length; $("#clinical-panel").hidden = false; $("#clinical-tag").textContent = count + " fields";
    $("#clinical-copy").textContent = "Values from local CSV input and user-confirmed AI candidates. Missing fields remain explicitly absent.";
    $("#clinical-rows").innerHTML = csvRows + pdfRows + agentRows + agentHistoryRows;
  }
  function renderEstimatedAges() {
    $("#estimated-ages-panel").hidden = false;
    $("#estimated-ages-tag").textContent = "Withheld";
    $("#estimated-age-cards").textContent = "No numeric system-age estimate is shown. Domain-specific evidence and approval are required first.";
  }
  function downloadPacket() { if (!state.packet) return; var blob = new Blob([JSON.stringify(state.packet, null, 2) + "\n"], { type: "application/json" }), url = URL.createObjectURL(blob), a = document.createElement("a"); a.href = url; a.download = "local-measurement-review-pack-v0.2.json"; a.click(); URL.revokeObjectURL(url); $("#export-status").textContent = "Downloaded locally. The packet contains no original CSV or patient identifier."; showView("export"); }
  function downloadReportPdf() { if (!state.packet) return; var bytes = window.HealthspanReportPdf.build(state.packet), blob = new Blob([bytes], { type: "application/pdf" }), url = URL.createObjectURL(blob), a = document.createElement("a"); a.href = url; a.download = "healthspan-measurement-review.pdf"; a.click(); setTimeout(function () { URL.revokeObjectURL(url); }, 1000); $("#export-status").textContent = "Downloaded the PDF report locally from the confirmed review packet."; showView("export"); }
  function printPacket() { if (!state.packet) return; showView("review"); window.print(); }
  function agentFileIssue(files) {
    if (!files.length) return "Choose at least one file.";
    if (files.length > 6) return "Choose up to 6 files.";
    if (files.some(function (file) { return !file.size || file.size > 2 * 1024 * 1024; })) return "Each file must be non-empty and 2 MB or smaller.";
    if (files.reduce(function (sum, file) { return sum + file.size; }, 0) > 3 * 1024 * 1024) return "All files together must be 3 MB or smaller.";
    return "";
  }
  function renderAgentFiles(options) {
    var list = $("#agent-measurement-file-list"); if (!list) return;
    list.replaceChildren();
    if (!agentFiles.length) { var empty = document.createElement("li"); empty.className = "empty-files"; empty.textContent = "No files selected"; list.append(empty); }
    agentFiles.forEach(function (file) { var row = document.createElement("li"); row.textContent = file.name + " · " + (file.size / 1024).toFixed(0) + " KB"; list.append(row); });
    $("#analyze-agent-measurement-files").disabled = Boolean(agentFileIssue(agentFiles)) || !$("#agent-measurement-consent").checked || $("#analyze-agent-measurement-files").dataset.busy === "true";
    if (agentFiles.length && !(options && options.preserveStatus)) $("#agent-measurement-status").textContent = agentFileIssue(agentFiles) || "Selected files stay local until you submit this request.";
  }
  function renderAgentCandidates(candidates) {
    state.agentCandidates = candidates;
    var counts = {}; candidates.forEach(function (item) { counts[item.field] = (counts[item.field] || 0) + 1; });
    $("#agent-measurement-candidate-tag").textContent = candidates.length + " candidates";
    $("#agent-measurement-candidate-rows").innerHTML = candidates.map(function (candidate, index) {
      var spec = clinicalParser.byName[candidate.field], initialValue = "", issue = "";
      try { initialValue = String(agentCandidateValue(candidate, spec)); } catch (error) { issue = error.message; }
      candidate.entryValue = initialValue;
      candidate.sourceIssue = issue;
      var current = mergeValues();
      if (present(current.values[candidate.field])) {
        try { if (String(current.values[candidate.field]) !== String(clinicalParser.normalizeValue(initialValue, spec))) issue = issue || "Conflicts with an existing local source; compare both records"; } catch (_) { }
      }
      candidate.reviewIssue = issue || candidate.uncertainty || (counts[candidate.field] > 1 ? "Multiple source readings; select only one and compare evidence" : "");
      var file = candidate.displayFile || candidate.file;
      var conflict = counts[candidate.field] > 1 ? "Multiple source readings; select only one and compare evidence" : "Check source";
      return '<tr><td><input class="agent-candidate-use" type="checkbox" data-index="' + index + '" aria-label="Select ' + escapeHtml(candidate.field) + ' for entry" ' + (candidate.sourceIssue ? "disabled" : "") + '></td><td>' + escapeHtml(spec.label) + '<br><small class="field-name">' + escapeHtml(candidate.field) + '</small></td><td>' + escapeHtml(candidate.value) + '</td><td><input class="agent-candidate-value" data-index="' + index + '" value="' + escapeHtml(initialValue) + '" aria-label="Value to enter for ' + escapeHtml(candidate.field) + '"></td><td>' + escapeHtml(candidate.unit || "not printed") + (candidate.unit && candidate.unit !== spec.unit ? ' → ' + escapeHtml(spec.unit) : '') + '</td><td>' + escapeHtml(candidate.date || "Not provided") + '</td><td><strong>' + escapeHtml(file) + '</strong><br><small>' + escapeHtml(candidate.location) + '</small><br><small>' + escapeHtml(candidate.evidence) + '</small></td><td id="agent-candidate-review-' + index + '" class="' + (candidate.reviewIssue ? "warning-label" : "derived-label") + '">' + escapeHtml(candidate.reviewIssue || conflict) + '</td></tr>';
    }).join("");
    $("#agent-measurement-candidate-panel").hidden = false;
    document.querySelectorAll(".agent-candidate-use").forEach(function (checkbox) { checkbox.addEventListener("change", function () {
      var selectedCandidate = state.agentCandidates[Number(this.dataset.index)];
      if (this.checked) document.querySelectorAll(".agent-candidate-use").forEach(function (other) { var otherCandidate = state.agentCandidates[Number(other.dataset.index)]; if (other !== checkbox && otherCandidate.field === selectedCandidate.field) other.checked = false; });
      $("#apply-agent-measurement-candidates").disabled = !document.querySelector(".agent-candidate-use:checked");
    }); });
    document.querySelectorAll(".agent-candidate-value").forEach(function (input) { input.addEventListener("input", function () { var index = Number(this.dataset.index), candidate = state.agentCandidates[index], spec = clinicalParser.byName[candidate.field], checkbox = document.querySelector('.agent-candidate-use[data-index="' + index + '"]'), cell = $("#agent-candidate-review-" + index); try { clinicalParser.normalizeValue(this.value, spec); cell.textContent = candidate.reviewIssue || candidate.uncertainty || "Check source"; cell.className = candidate.reviewIssue || candidate.uncertainty ? "warning-label" : "derived-label"; if (checkbox) checkbox.disabled = false; } catch (error) { cell.textContent = error.message; cell.className = "warning-label"; if (checkbox) { checkbox.checked = false; checkbox.disabled = true; } } $("#apply-agent-measurement-candidates").disabled = !document.querySelector(".agent-candidate-use:checked"); }); });
  }
  function reset() { if (agentController) agentController.abort(); choosePdf(null); state = { parsed: null, clinical: null, pdfClinical: null, pdfProvenance: {}, agentClinical: null, agentProvenance: {}, agentHistory: [], agentCandidates: [], pdfPages: [], pdfCandidates: [], source: "", packet: null, active: "import", warnings: [] }; $("#seca-file").value = ""; $("#clinical-file").value = ""; $("#pdf-file").value = ""; $("#pdf-ai-consent").checked = false; $("#pdf-candidate-panel").hidden = true; $("#pdf-status").textContent = "Choose a PDF to inspect it locally."; $("#pdf-file-name").textContent = "No PDF selected"; agentFiles = []; $("#agent-measurement-files").value = ""; $("#agent-measurement-consent").checked = false; $("#agent-measurement-candidate-panel").hidden = true; $("#agent-measurement-status").textContent = "Choose files and confirm before sending."; renderAgentFiles(); document.querySelector('[data-step="review"]').disabled = true; document.querySelector('[data-step="export"]').disabled = true; $("#export-status").textContent = ""; setStatus("No record open.", false); showView("import"); }
  function fetchText(url) { return fetch(url, { cache: "no-store" }).then(function (response) { if (!response.ok) throw new Error(url + " returned " + response.status); return response.text(); }); }

  var localPdf = null, pdfSelectionId = 0, activePdfController = null;
  var pdfRequestScheduler = window.pdfBatches.createRequestScheduler();
  function updatePdfButton() { $("#analyze-pdf").disabled = !localPdf || !$("#pdf-ai-consent").checked || Boolean(activePdfController); }
  function setPdfStatus(message, error) { $("#pdf-status").textContent = message; $("#pdf-status").style.color = error ? "var(--rust)" : "var(--forest)"; }
  function choosePdf(file) {
    pdfSelectionId++;
    if (activePdfController) { activePdfController.abort(); activePdfController = null; }
    localPdf = null; state.pdfPages = []; state.pdfCandidates = []; $("#pdf-candidate-panel").hidden = true;
    $("#pdf-ai-consent").checked = false; updatePdfButton();
    if (!file) return;
    var selectionId = pdfSelectionId;
    $("#pdf-file-name").textContent = file.name.slice(0, 80); setPdfStatus("Reading and rendering locally…", false);
    analyzePdfLocally(file).then(function (result) { if (selectionId !== pdfSelectionId) return; localPdf = result; state.pdfPages = result.pages; setPdfStatus(result.pageCount + " page(s) inspected locally. No content has been sent.", false); updatePdfButton(); }).catch(function (error) { if (selectionId !== pdfSelectionId) return; localPdf = null; setPdfStatus(error.message || "Could not read this PDF.", true); updatePdfButton(); });
  }
  function renderPdfCandidates(candidates) {
    state.pdfCandidates = candidates; $("#pdf-candidate-panel").hidden = false; $("#pdf-candidate-tag").textContent = candidates.length + " candidate(s)";
    $("#pdf-candidate-rows").innerHTML = candidates.map(function (candidate, index) {
      var spec = clinicalParser.byName[candidate.field], value = candidate.value == null ? candidate.printedValue : candidate.value;
      if (typeof candidate.baseIssue !== "string") candidate.baseIssue = candidate.issue || "";
      var issue = candidate.issue || "";
      var disabled = candidate.value == null || (candidate.baseIssue && !candidate.conflict && !candidate.duplicate && !candidate.dateIssue);
      var dateValue = /^\d{4}-\d{2}-\d{2}$/.test(candidate.date || "") && !candidate.dateIssue ? candidate.date : "";
      return '<tr><td><input class="pdf-candidate-use" type="checkbox" data-index="' + index + '" aria-label="Select ' + escapeHtml(candidate.field) + ' for entry" ' + (disabled ? "disabled" : "") + '></td><td>' + escapeHtml(spec ? spec.label : candidate.field) + '<br><small class="field-name">' + escapeHtml(candidate.field) + '</small></td><td>' + escapeHtml(candidate.printedValue) + '</td><td><input class="pdf-candidate-value" data-index="' + index + '" value="' + escapeHtml(value) + '" aria-label="Value to enter for ' + escapeHtml(candidate.field) + '"></td><td>' + escapeHtml(candidate.unit || "not printed") + (candidate.unitConverted ? ' → ' + escapeHtml(candidate.normalizedUnit) : '') + '</td><td><input class="pdf-candidate-date" data-index="' + index + '" type="date" value="' + dateValue + '" aria-label="Confirmed measurement date for ' + escapeHtml(candidate.field) + '">' + (candidate.date ? '<br><small>Printed: ' + escapeHtml(candidate.date) + '</small>' : '') + '</td><td><button class="text-button pdf-page-button" type="button" data-page="' + candidate.page + '">Page ' + candidate.page + '</button><br><small>' + escapeHtml(candidate.evidence) + '</small></td><td id="pdf-candidate-review-' + index + '" class="' + (issue ? "warning-label" : "derived-label") + '">' + escapeHtml(issue || "Check source") + (candidate.unitConverted ? ' · converted' : '') + '</td></tr>';
    }).join("");
    $("#apply-pdf-candidates").disabled = true;
    document.querySelectorAll(".pdf-candidate-use").forEach(function (checkbox) { checkbox.addEventListener("change", function () {
      if (this.checked) { var field = state.pdfCandidates[Number(this.dataset.index)].field; document.querySelectorAll(".pdf-candidate-use").forEach(function (other) { if (other !== checkbox && state.pdfCandidates[Number(other.dataset.index)].field === field) other.checked = false; }); }
      $("#apply-pdf-candidates").disabled = !document.querySelector(".pdf-candidate-use:checked");
    }); });
    function refreshGroups() {
      var rows = state.pdfCandidates.map(function (candidate, index) {
        var spec = clinicalParser.byName[candidate.field], value = null;
        try { value = clinicalParser.normalizeValue(document.querySelector('.pdf-candidate-value[data-index="' + index + '"]').value, spec); } catch (_) { }
        return { field: candidate.field, value: value, date: document.querySelector('.pdf-candidate-date[data-index="' + index + '"]').value };
      });
      pdfCandidateReview.classifyCandidateRows(rows).forEach(function (flags, index) {
        var candidate = state.pdfCandidates[index];
        candidate.conflict = flags.conflict;
        candidate.duplicate = flags.duplicate;
        var enteredDate = document.querySelector('.pdf-candidate-date[data-index="' + index + '"]').value;
        var messages = pdfCandidateReview.candidateReviewMessages(candidate, enteredDate, flags);
        var cell = $("#pdf-candidate-review-" + index);
        cell.textContent = messages.filter(Boolean).join("; ") || "Check source";
        cell.className = messages.some(Boolean) ? "warning-label" : "derived-label";
        if (candidate.unitConverted) cell.textContent += " · converted";
      });
    }
    document.querySelectorAll(".pdf-candidate-value, .pdf-candidate-date").forEach(function (input) {
      input.addEventListener("input", refreshGroups);
      input.addEventListener("change", refreshGroups);
    });
    refreshGroups();
    document.querySelectorAll(".pdf-page-button").forEach(function (button) { button.addEventListener("click", function () { var source = state.pdfPages.find(function (page) { return page.page === Number(button.dataset.page); }); if (source) { $("#pdf-page-image").src = source.image; $("#pdf-page-dialog").showModal(); } }); });
  }

  $("#choose-pdf").addEventListener("click", function () { $("#pdf-file").click(); });
  $("#pdf-file").addEventListener("change", function () { choosePdf(this.files && this.files[0]); });
  $("#pdf-ai-consent").addEventListener("change", function () {
    if (!this.checked && activePdfController) activePdfController.abort();
    updatePdfButton();
  });
  $("#close-pdf-page").addEventListener("click", function () { $("#pdf-page-dialog").close(); });
  $("#analyze-pdf").addEventListener("click", async function () {
    if (!localPdf || !$("#pdf-ai-consent").checked || activePdfController) return;
    var sourcePdf = localPdf, selectionId = pdfSelectionId, button = this, operationController = new AbortController(); activePdfController = operationController; button.disabled = true; state.pdfCandidates = []; $("#pdf-candidate-panel").hidden = true; $("#pdf-apply-status").textContent = "";
    try {
      var batches = window.pdfBatches.splitPages(sourcePdf.pages), encoder = new TextEncoder();
      batches.forEach(function (batch) {
        var request = JSON.stringify({ confirmedDeidentified: true, pages: window.pdfBatches.requestPages(batch.pages) });
        if (encoder.encode(request).byteLength > window.pdfBatches.MAX_REQUEST_BYTES) throw new Error("A PDF page batch is too large to send securely. Choose a lower-resolution PDF.");
      });
      setPdfStatus("Preparing " + batches.length + " batches. No content has been sent yet.", false);
      var candidates = [];
      for (var index = 0; index < batches.length; index++) {
        if (selectionId !== pdfSelectionId || localPdf !== sourcePdf) return;
        if (!$("#pdf-ai-consent").checked) throw new Error("Extraction stopped because consent was withdrawn.");
        var batch = batches[index];
        var response;
        try {
          response = await pdfRequestScheduler.send('/api/extract-pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmedDeidentified: true, pages: window.pdfBatches.requestPages(batch.pages) }), signal: operationController.signal }, { onProgress: function (progress) {
            if (selectionId !== pdfSelectionId || operationController.signal.aborted) return;
            var span = "pages " + batch.startPage + "–" + batch.endPage + " of " + sourcePdf.pageCount;
            setPdfStatus(progress.state === 'waiting' ? "Waiting about " + Math.ceil(progress.waitMs / 1000) + "s before reviewing " + span + "…" : "Reviewing " + span + " (" + (index + 1) + "/" + batches.length + ")…", false);
          } });
        } catch (requestError) {
          if (requestError.name === 'AbortError') throw requestError;
          throw new Error("PDF extraction failed for pages " + batch.startPage + "–" + batch.endPage + ": " + requestError.message);
        }
        if (selectionId !== pdfSelectionId || localPdf !== sourcePdf) return;
        if (response.status === 429) throw new Error("PDF extraction paused for pages " + batch.startPage + "–" + batch.endPage + ". The service is busy; please retry this PDF later.");
        var data;
        try { data = await response.json(); } catch (_) { throw new Error("PDF extraction returned an unreadable response for pages " + batch.startPage + "–" + batch.endPage + ". Please try again later."); }
        if (operationController.signal.aborted) throw new DOMException("Extraction cancelled.", "AbortError");
        if (!response.ok) throw new Error("PDF extraction failed for pages " + batch.startPage + "–" + batch.endPage + ": " + (data.error || "Please try again."));
        candidates = candidates.concat(window.pdfBatches.validateCandidatePages(data.candidates || [], batch.pages));
      }
      if (selectionId !== pdfSelectionId || localPdf !== sourcePdf) return;
      if (operationController.signal.aborted) throw new DOMException("Extraction cancelled.", "AbortError");
      renderPdfCandidates(candidates); setPdfStatus("Extraction complete. Verify every value against its source page before entry.", false);
      $("#pdf-apply-status").textContent = candidates.length ? "" : "No supported measurement candidates were returned.";
    } catch (error) {
      if (selectionId === pdfSelectionId) setPdfStatus(error.name === "AbortError" ? "Extraction stopped because consent was withdrawn." : (error.message || "PDF extraction failed."), true);
    }
    finally { if (activePdfController === operationController) activePdfController = null; updatePdfButton(); }
  });
  $("#apply-pdf-candidates").addEventListener("click", function () {
    var selected = Array.from(document.querySelectorAll(".pdf-candidate-use:checked"));
    var selections = selected.map(function (checkbox) {
      var index = Number(checkbox.dataset.index), candidate = state.pdfCandidates[index];
      return { candidate: candidate, spec: clinicalParser.byName[candidate.field], valueText: document.querySelector('.pdf-candidate-value[data-index="' + index + '"]').value, enteredDate: document.querySelector('.pdf-candidate-date[data-index="' + index + '"]').value };
    });
    var prepared = pdfCandidateReview.prepareSelectedCandidates(selections, clinicalParser.normalizeValue);
    if (!prepared.ok) { $("#pdf-apply-status").textContent = prepared.error; return; }
    var values = clinicalParser.emptyValues(), units = {}, nextProvenance = Object.assign({}, state.pdfProvenance);
    prepared.entries.forEach(function (entry) { values[entry.field] = entry.value; units[entry.field] = entry.unit; nextProvenance[entry.field] = entry.provenance; });
    if (prepared.entries.some(function (entry) { return !present(entry.value); })) { $("#pdf-apply-status").textContent = "One or more edited values failed validation. Correct them before entry."; return; }
    state.pdfProvenance = nextProvenance;
    state.pdfClinical = clinicalParser.result(values, units, "User-confirmed AI-extracted PDF measurements"); state.source = state.source || "PDF measurements · user-confirmed";
    var merged = mergeValues(), ready = readiness(merged.values); state.packet = buildPacket(merged, ready); renderReview(merged, ready); enableWorkflow(); showView("review");
    $("#pdf-apply-status").textContent = selected.length + " user-confirmed value(s) entered. Provenance is attached to the local packet.";
  });
  $("#discard-pdf-candidates").addEventListener("click", function () { state.pdfCandidates = []; state.pdfPages = []; localPdf = null; $("#pdf-candidate-panel").hidden = true; $("#pdf-file").value = ""; $("#pdf-ai-consent").checked = false; $("#pdf-page-image").removeAttribute("src"); updatePdfButton(); setPdfStatus("Local PDF content and suggestions cleared from this tab.", false); });

  $("#choose-agent-measurement-files").addEventListener("click", function () { $("#agent-measurement-files").click(); });
  $("#agent-measurement-files").addEventListener("change", function () { if (agentController) agentController.abort(); $("#agent-measurement-consent").checked = false; agentFiles = Array.from(this.files || []); $("#agent-measurement-candidate-panel").hidden = true; renderAgentFiles(); });
  $("#agent-measurement-consent").addEventListener("change", function () { if (!this.checked && agentController) agentController.abort(); renderAgentFiles(); });
  $("#analyze-agent-measurement-files").addEventListener("click", async function () {
    if (this.disabled || agentController) return;
    var issue = agentFileIssue(agentFiles); if (issue) { $("#agent-measurement-status").textContent = issue; return; }
    var button = this, filesToSend = agentFiles.slice(), controller = new AbortController(); agentController = controller; button.dataset.busy = "true"; renderAgentFiles(); $("#agent-measurement-candidate-panel").hidden = true; $("#agent-measurement-status").textContent = "Uploading selected files to a temporary workspace…";
    try {
      var files = await Promise.all(filesToSend.map(function (file, index) { return new Promise(function (resolve, reject) { var reader = new FileReader(); reader.onerror = function () { reject(new Error("A selected file could not be read.")); }; reader.onload = function () { var ext = /\.([A-Za-z0-9]{1,12})$/.exec(file.name), alias = "source-" + String(index + 1).padStart(2, "0") + (ext ? "." + ext[1].toLowerCase() : ""); resolve({ name: alias, data: String(reader.result).split(",")[1] }); }; reader.readAsDataURL(file); }); }));
      if (!$("#agent-measurement-consent").checked) throw new DOMException("Upload cancelled because consent was withdrawn.", "AbortError");
      var response = await fetch("/api/opencode-agent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "measurement-review", prompt: "Extract only explicit observed measurement values that map to the canonical Healthspan Review fields. Do not infer missing values or calculate an assessment.", files: files, consent: true }), signal: controller.signal });
      var data; try { data = await response.json(); } catch (_) { throw new Error("The agent returned an unreadable response."); }
      if (!response.ok) throw new Error(data.error || "The measurement agent could not complete this request.");
      if (!$("#agent-measurement-consent").checked) throw new DOMException("Review cancelled because consent was withdrawn.", "AbortError");
      $("#agent-measurement-consent").checked = false;
      var aliases = new Map(files.map(function (file, index) { return [file.name, filesToSend[index].name]; }));
      var candidates = (data.candidates || []).map(function (candidate) { return Object.assign({}, candidate, { displayFile: aliases.get(candidate.file) || candidate.file }); });
      renderAgentCandidates(candidates);
      var unreadable = (data.unreadable || []).length;
      $("#agent-measurement-status").textContent = candidates.length + " candidate(s) returned. " + (unreadable ? unreadable + " file(s) could not be fully read." : "Check every result against the original files.") + " Nothing has entered the measurement record.";
      if (unreadable) { $("#agent-measurement-status").textContent += " " + data.unreadable.map(function (item) { return (aliases.get(item.file) || item.file) + ": " + item.reason; }).join(" "); }
    } catch (error) {
      $("#agent-measurement-status").textContent = error.name === "AbortError" ? "Upload cancelled because consent was withdrawn." : (error.message || "The agent could not complete this request.");
    } finally { if (agentController === controller) agentController = null; button.dataset.busy = "false"; renderAgentFiles({ preserveStatus: true }); }
  });
  $("#apply-agent-measurement-candidates").addEventListener("click", function () {
    var selected = Array.from(document.querySelectorAll(".agent-candidate-use:checked")), updates = [];
    try {
      selected.forEach(function (checkbox) {
        var index = Number(checkbox.dataset.index), candidate = state.agentCandidates[index], spec = clinicalParser.byName[candidate.field], valueText = document.querySelector('.agent-candidate-value[data-index="' + index + '"]').value;
        var value = clinicalParser.normalizeValue(valueText, spec);
        var existingValue = mergeValues().values[candidate.field];
        var provenance = { file: candidate.displayFile || candidate.file, location: candidate.location, evidence: candidate.evidence, uncertainty: candidate.uncertainty || candidate.reviewIssue || "", printedValue: candidate.value, printedUnit: candidate.unit || "", printedDate: candidate.date || null, date: candidate.date || null, enteredValue: value, selectedAmongAlternatives: state.agentCandidates.filter(function (item) { return item.field === candidate.field; }).length > 1, overridesExisting: present(existingValue) && String(existingValue) !== String(value) };
        updates.push({ field: candidate.field, value: value, unit: spec.unit, provenance: provenance });
      });
    } catch (error) { $("#agent-measurement-apply-status").textContent = "One or more values need correction: " + error.message; return; }
    if (!selected.length) { $("#agent-measurement-apply-status").textContent = "Select at least one value and check it against the original file."; return; }
    var combinedAgent = HealthspanAgentMeasurementState.mergeConfirmedBatch({
      values: state.agentClinical ? state.agentClinical.values : {},
      units: state.agentClinical ? state.agentClinical.units : {},
      provenance: state.agentProvenance,
      history: state.agentHistory,
    }, updates);
    state.agentClinical = clinicalParser.result(combinedAgent.values, combinedAgent.units, "User-confirmed AI-extracted arbitrary-file measurements");
    state.agentProvenance = combinedAgent.provenance;
    state.agentHistory = combinedAgent.history;
    state.warnings = state.warnings.filter(function (warning) { return warning.indexOf("AI file candidates:") !== 0; });
    var provenance = Object.fromEntries(updates.map(function (entry) { return [entry.field, entry.provenance]; }));
    var alternateFields = Object.keys(provenance).filter(function (field) { return provenance[field].selectedAmongAlternatives; });
    if (alternateFields.length) state.warnings.push("AI file candidates: multiple source readings were returned for " + alternateFields.join(", ") + "; one user-selected source per field was entered.");
    var overriddenFields = Object.keys(provenance).filter(function (field) { return provenance[field].overridesExisting; });
    if (overriddenFields.length) state.warnings.push("AI file candidates: user-confirmed values differ from existing local sources for " + overriddenFields.join(", ") + "; all source records are retained in the ledger.");
    state.source = state.source ? state.source + " + user-confirmed AI file measurements" : "User-confirmed AI file measurements";
    var merged = mergeValues(), ready = readiness(merged.values); state.packet = buildPacket(merged, ready); renderReview(merged, ready); enableWorkflow(); showView("review");
    $("#agent-measurement-apply-status").textContent = selected.length + " user-confirmed value(s) entered. The local review and packet have been rebuilt.";
    $("#agent-measurement-consent").checked = false;
  });
  $("#discard-agent-measurement-candidates").addEventListener("click", function () { agentFiles = []; $("#agent-measurement-files").value = ""; $("#agent-measurement-consent").checked = false; state.agentCandidates = []; $("#agent-measurement-candidate-panel").hidden = true; renderAgentFiles(); $("#agent-measurement-status").textContent = "Selected files and unconfirmed suggestions cleared from this tab."; });

  $("#seca-file").addEventListener("change", function () { openFile(this.files && this.files[0], "seca"); }); $("#clinical-file").addEventListener("change", function () { openFile(this.files && this.files[0], "clinical"); });
  $("#load-sample").addEventListener("click", function () { var button = this; button.disabled = true; setStatus("Opening the complete synthetic case locally…", false); Promise.all([fetchText("example-seca-tableview.csv"), fetchText("example-complete-synthetic.json")]).then(function (parts) { loadRecord(secaParser.parseSecaCsv(parts[0]), clinicalParser.parseProfile(JSON.parse(parts[1]), "Complete synthetic clinical profile"), "Complete synthetic case · SECA + clinical profile"); }).catch(function (error) { setStatus("Complete synthetic case could not be loaded: " + error.message, true); }).finally(function () { button.disabled = false; }); });
  $("#load-seca-preview").addEventListener("click", function () { var button = this; button.disabled = true; setStatus("Opening the SECA-only preview locally…", false); fetchText("example-seca-tableview.csv").then(function (text) { loadRecord(secaParser.parseSecaCsv(text), null, "Synthetic SECA-only preview"); }).catch(function (error) { setStatus("SECA sample could not be loaded: " + error.message, true); }).finally(function () { button.disabled = false; }); });
  $("#drop-zone").addEventListener("click", function () { $("#seca-file").click(); }); $("#clinical-drop-zone").addEventListener("click", function () { $("#clinical-file").click(); });
  [["#drop-zone", "seca"], ["#clinical-drop-zone", "clinical"]].forEach(function (item) { var zone = $(item[0]); ["dragenter", "dragover"].forEach(function (name) { zone.addEventListener(name, function (event) { event.preventDefault(); zone.classList.add("is-dragging"); }); }); ["dragleave", "drop"].forEach(function (name) { zone.addEventListener(name, function (event) { event.preventDefault(); zone.classList.remove("is-dragging"); }); }); zone.addEventListener("drop", function (event) { openFile(event.dataTransfer.files && event.dataTransfer.files[0], item[1]); }); zone.addEventListener("keydown", function (event) { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); $(item[1] === "seca" ? "#seca-file" : "#clinical-file").click(); } }); });
  document.querySelectorAll("[data-step]").forEach(function (step) { step.addEventListener("click", function () { if (!this.disabled && (this.dataset.step !== "export" || state.packet)) showView(this.dataset.step); }); });
  $("#new-record").addEventListener("click", reset); $("#export-button").addEventListener("click", downloadPacket); $("#print-button").addEventListener("click", printPacket); $("#export-again").addEventListener("click", downloadPacket); $("#download-report-pdf").addEventListener("click", downloadReportPdf); $("#print-again").addEventListener("click", printPacket); $("#back-to-review").addEventListener("click", function () { showView("review"); });
})();
