/* Browser-local parser for the canonical 35-feature clinical input CSV. */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.HealthspanClinicalParser = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var MAX_BYTES = 5 * 1024 * 1024;
  var specs = [
    ["age", "Age", "demographics", "numeric", "years", 18, 120],
    ["sex", "Sex", "demographics", "sex", "", null, null],
    ["bmi", "Body mass index", "demographics", "numeric", "kg/m²", 5, 100],
    ["systolic_bp", "Systolic blood pressure", "demographics", "numeric", "mmHg", 50, 300],
    ["diastolic_bp", "Diastolic blood pressure", "demographics", "numeric", "mmHg", 30, 200],
    ["resting_hr", "Resting heart rate", "demographics", "numeric", "bpm", 20, 250],
    ["waist_circumference", "Waist circumference", "demographics", "numeric", "cm", 30, 250],
    ["phase_angle", "Phase angle", "bia", "numeric", "degrees", 0, 20],
    ["ecw_tbw", "ECW/TBW", "bia", "numeric", "ratio", 0.1, 0.8],
    ["ffmi", "FFMI", "bia", "numeric", "kg/m²", 5, 60],
    ["skeletal_muscle_mass", "Skeletal muscle mass", "bia", "numeric", "kg", 1, 150],
    ["visceral_fat", "Visceral adipose tissue", "bia", "numeric", "Liters", 0, 100],
    ["fasting_glucose", "Fasting glucose", "blood", "numeric", "mg/dL", 20, 1000],
    ["hba1c", "HbA1c", "blood", "numeric", "%", 2, 30],
    ["hs_crp", "High-sensitivity CRP", "blood", "numeric", "mg/L", 0, 1000],
    ["albumin", "Albumin", "blood", "numeric", "g/dL", 0.1, 8],
    ["creatinine", "Creatinine", "blood", "numeric", "mg/dL", 0.1, 20],
    ["egfr", "eGFR", "blood", "numeric", "mL/min/1.73m²", 0, 250],
    ["alp", "Alkaline phosphatase", "blood", "numeric", "U/L", 1, 2000],
    ["wbc", "White blood cell count", "blood", "numeric", "10^9/L", 0.1, 200],
    ["rdw", "RDW", "blood", "numeric", "%", 5, 50],
    ["fib_4", "FIB-4", "blood", "numeric", "index", 0, 100],
    ["hypertension", "Hypertension", "history", "binary", "", 0, 1],
    ["t2d", "Type 2 diabetes", "history", "binary", "", 0, 1],
    ["osteoarthritis", "Osteoarthritis", "history", "binary", "", 0, 1],
    ["sleep_apnea", "Sleep apnea", "history", "binary", "", 0, 1],
    ["cvd", "Cardiovascular disease", "history", "binary", "", 0, 1],
    ["copd", "COPD", "history", "binary", "", 0, 1],
    ["cancer", "Cancer history", "history", "binary", "", 0, 1],
    ["depression", "Depression", "history", "binary", "", 0, 1],
    ["grip_strength", "Grip strength", "functional", "numeric", "kg", 0, 150],
    ["chair_rise_time", "Chair-rise time", "functional", "numeric", "seconds", 0.1, 300],
    ["smoking_status", "Smoking status", "functional", "smoking", "", null, null],
    ["alcohol_heavy_use", "Heavy alcohol use", "functional", "binary", "", 0, 1],
    ["sleep_hours", "Sleep duration", "functional", "numeric", "hours", 0, 30]
  ].map(function (row) {
    return { name: row[0], label: row[1], category: row[2], kind: row[3], unit: row[4], minimum: row[5], maximum: row[6] };
  });
  var byName = {};
  specs.forEach(function (spec) { byName[spec.name] = spec; });

  function parseCsv(text) {
    var rows = [], row = [], cell = "", quoted = false;
    for (var i = 0; i < text.length; i++) {
      var char = text[i];
      if (char === '"') {
        if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
        else quoted = !quoted;
      } else if (char === "," && !quoted) {
        row.push(cell); cell = "";
      } else if ((char === "\n" || char === "\r") && !quoted) {
        if (char === "\r" && text[i + 1] === "\n") i++;
        row.push(cell); cell = "";
        if (row.some(function (part) { return part.trim() !== ""; })) rows.push(row);
        row = [];
      } else cell += char;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }

  function normalizeValue(raw, spec) {
    if (raw === null || raw === undefined || String(raw).trim() === "") return null;
    var value = String(raw).trim();
    if (spec.kind === "numeric") {
      var number = Number(value.replace(/,/g, ""));
      if (!Number.isFinite(number)) throw new Error(spec.name + " must be numeric");
      if ((spec.minimum !== null && number < spec.minimum) || (spec.maximum !== null && number > spec.maximum)) {
        throw new Error(spec.name + " is outside the accepted engineering range");
      }
      return number;
    }
    if (spec.kind === "binary") {
      var binary = value.toLowerCase();
      if (["0", "no", "false", "n", "absent"].indexOf(binary) >= 0) return 0;
      if (["1", "yes", "true", "y", "present"].indexOf(binary) >= 0) return 1;
      throw new Error(spec.name + " must be 0/1 or yes/no");
    }
    if (spec.kind === "sex") {
      var sex = value.toLowerCase();
      if (["f", "female", "woman"].indexOf(sex) >= 0) return "female";
      if (["m", "male", "man"].indexOf(sex) >= 0) return "male";
      throw new Error("sex must be male or female");
    }
    var smoking = value.toLowerCase();
    if (["never", "non-smoker", "nonsmoker"].indexOf(smoking) >= 0) return "never";
    if (["former", "ex"].indexOf(smoking) >= 0) return "former";
    if (["current", "active"].indexOf(smoking) >= 0) return "current";
    throw new Error("smoking_status must be never, former, or current");
  }

  function emptyValues() {
    var values = {};
    specs.forEach(function (spec) { values[spec.name] = null; });
    return values;
  }

  function hasValue(values, field) {
    return values[field] !== null && values[field] !== undefined && values[field] !== "";
  }

  function clamp(value, minimum, maximum) { return Math.max(minimum, Math.min(maximum, value)); }

  var AGE_RULES = [
    { key: "body_composition_age", label: "Body composition age", offset: -5, adjustments: [{ field: "bmi", target: 24, scale: 0.25, min: -3, max: 6 }, { field: "waist_circumference", target: 80, scale: 0.12, min: -4, max: 8 }, { field: "visceral_fat", target: 3, scale: 0.5, min: -3, max: 8 }] },
    { key: "fluid_cellular_age", label: "Fluid & cellular age", offset: -3, adjustments: [{ field: "phase_angle", target: 6, scale: -4, min: -8, max: 8 }, { field: "ecw_tbw", target: 0.39, scale: 40, min: -6, max: 8 }] },
    { key: "muscle_age", label: "Muscle age", offset: -6, adjustments: [{ field: "ffmi", target: 19, scale: -0.4, min: -5, max: 6 }, { field: "skeletal_muscle_mass", target: 28, scale: -0.15, min: -5, max: 5 }, { field: "grip_strength", target: 30, scale: -0.35, min: -5, max: 8 }, { field: "chair_rise_time", target: 10, scale: 0.75, min: -5, max: 12 }] },
    { key: "joint_age", label: "Joint age", offset: -10, adjustments: [{ field: "osteoarthritis", binaryScale: 8 }, { field: "chair_rise_time", target: 10, scale: 0.25, min: -5, max: 12 }, { field: "grip_strength", target: 30, scale: -0.15, min: -5, max: 8 }, { field: "bmi", target: 24, scale: 0.25, min: -3, max: 6 }, { field: "ffmi", target: 19, scale: -0.2, min: -4, max: 4 }] },
    { key: "bone_age", label: "Bone age", offset: 0, adjustments: [] },
    { key: "skin_age", label: "Skin age", offset: 0, adjustments: [] },
    { key: "blood_age", label: "Blood age", offset: -2, adjustments: [{ field: "fasting_glucose", target: 90, scale: 0.05, min: -4, max: 8 }, { field: "hba1c", target: 5.2, scale: 3, min: -4, max: 8 }, { field: "hs_crp", target: 1, scale: 0.4, min: -3, max: 8 }, { field: "albumin", target: 4.2, scale: -3, min: -4, max: 4 }, { field: "creatinine", target: 0.9, scale: 2, min: -3, max: 5 }, { field: "egfr", target: 95, scale: -0.08, min: -5, max: 5 }, { field: "rdw", target: 12.5, scale: 0.5, min: -3, max: 6 }, { field: "fib_4", target: 1, scale: 2, min: -3, max: 8 }] },
    { key: "cardiovascular_age", label: "Cardiovascular age", offset: -4, adjustments: [{ field: "systolic_bp", target: 120, scale: 0.08, min: -5, max: 10 }, { field: "diastolic_bp", target: 80, scale: 0.08, min: -4, max: 6 }, { field: "resting_hr", target: 65, scale: 0.04, min: -3, max: 5 }, { field: "hypertension", binaryScale: 6 }, { field: "cvd", binaryScale: 10 }] },
    { key: "cardiorespiratory_age", label: "Cardiorespiratory age", offset: -4, adjustments: [{ field: "systolic_bp", target: 120, scale: 0.08, min: -5, max: 10 }, { field: "diastolic_bp", target: 80, scale: 0.08, min: -4, max: 6 }, { field: "resting_hr", target: 65, scale: 0.04, min: -3, max: 5 }] },
    { key: "immune_inflammatory_age", label: "Immune & inflammatory age", offset: -1, adjustments: [{ field: "hs_crp", target: 1, scale: 0.5, min: -3, max: 10 }, { field: "wbc", target: 6, scale: 0.3, min: -3, max: 5 }, { field: "rdw", target: 12.5, scale: 0.5, min: -3, max: 6 }] },
    { key: "brain_cognitive_age", label: "Brain & cognitive age", offset: 0, adjustments: [] },
    { key: "metabolic_age", label: "Metabolic age", offset: -4, adjustments: [{ field: "bmi", target: 24, scale: 0.25, min: -3, max: 6 }, { field: "waist_circumference", target: 80, scale: 0.12, min: -4, max: 8 }, { field: "visceral_fat", target: 3, scale: 0.5, min: -3, max: 8 }, { field: "fasting_glucose", target: 90, scale: 0.05, min: -4, max: 8 }, { field: "hba1c", target: 5.2, scale: 3, min: -4, max: 8 }, { field: "t2d", binaryScale: 7 }] },
    { key: "kidney_age", label: "Kidney age", offset: -1, adjustments: [{ field: "creatinine", target: 0.9, scale: 2, min: -3, max: 5 }, { field: "egfr", target: 95, scale: -0.08, min: -5, max: 5 }] },
    { key: "liver_age", label: "Liver age", offset: -1, adjustments: [{ field: "albumin", target: 4.2, scale: -3, min: -4, max: 4 }, { field: "alp", target: 80, scale: 0.02, min: -3, max: 5 }, { field: "fib_4", target: 1, scale: 2, min: -3, max: 8 }] },
    { key: "sleep_recovery_age", label: "Sleep & recovery age", offset: 0, adjustments: [{ field: "sleep_hours", target: 7.5, scale: 1.2, mode: "absolute", min: -1, max: 8 }, { field: "sleep_apnea", binaryScale: 6 }] },
    { key: "lifestyle_function_age", label: "Lifestyle & function age", offset: -5, adjustments: [{ field: "grip_strength", target: 30, scale: -0.35, min: -5, max: 8 }, { field: "chair_rise_time", target: 10, scale: 0.75, min: -5, max: 12 }, { field: "smoking_status", stringScale: { current: 5, former: 2, never: 0 } }, { field: "alcohol_heavy_use", binaryScale: 4 }, { field: "sleep_hours", target: 7.5, scale: 1.2, mode: "absolute", min: -1, max: 8 }] },
    { key: "mental_health_age", label: "Mental health age", offset: 0, adjustments: [{ field: "depression", binaryScale: 5 }] }
  ];

  function estimateAgeSignals(values) {
    return AGE_RULES.map(function (rule) {
      var score = hasValue(values, "age") ? Number(values.age) + rule.offset : 45 + rule.offset;
      var used = hasValue(values, "age") ? ["age"] : [];
      var fields = [];
      rule.adjustments.forEach(function (adjustment) {
        if (fields.indexOf(adjustment.field) < 0) fields.push(adjustment.field);
        if (!hasValue(values, adjustment.field)) return;
        used.push(adjustment.field);
        var raw = values[adjustment.field], delta = 0;
        if (adjustment.binaryScale !== undefined) delta = Number(raw) * adjustment.binaryScale;
        else if (adjustment.stringScale) delta = adjustment.stringScale[String(raw).toLowerCase()] || 0;
        else if (adjustment.mode === "absolute") delta = Math.abs(Number(raw) - adjustment.target) * adjustment.scale;
        else delta = (Number(raw) - adjustment.target) * adjustment.scale;
        score += adjustment.min !== undefined && adjustment.max !== undefined ? clamp(delta, adjustment.min, adjustment.max) : delta;
      });
      return {
        key: rule.key,
        label: rule.label,
        value: Math.round(clamp(score, 18, 100)),
        unit: "years",
        status: "estimated_heuristic",
        basis: used,
        inputsUsed: used,
        inputCoverage: used.length + " / " + (fields.length + 1),
        method: "Deterministic category estimate from the available measurements.",
        uncertainty: "Research estimate; review alongside the underlying measurements."
      };
    });
  }

  function estimateJointAge(values) { return estimateAgeSignals(values).filter(function (item) { return item.key === "joint_age"; })[0]; }

  function parseRows(rows, sourceLabel) {
    if (!rows.length) throw new Error("the clinical CSV is empty");
    var header = rows[0].map(function (cell) { return cell.trim().toLowerCase(); });
    var fieldIndex = header.indexOf("field"), valueIndex = header.indexOf("value"), unitIndex = header.indexOf("unit");
    if (fieldIndex < 0 || valueIndex < 0) throw new Error("expected Field,Value,Unit columns");
    var values = emptyValues(), units = {}, errors = [], unknown = [], seen = {};
    rows.slice(1).forEach(function (row, index) {
      var field = String(row[fieldIndex] || "").trim();
      if (!field) return;
      var spec = byName[field];
      if (!spec) { unknown.push(field); return; }
      if (seen[field]) { errors.push("row " + (index + 2) + ": duplicate field " + field); return; }
      seen[field] = true;
      try {
        values[field] = normalizeValue(row[valueIndex], spec);
        if (unitIndex >= 0 && row[unitIndex] && String(row[unitIndex]).trim()) units[field] = String(row[unitIndex]).trim();
      } catch (error) { errors.push("row " + (index + 2) + ": " + error.message); }
    });
    if (errors.length) throw new Error(errors.join("; "));
    if (unknown.length) throw new Error("unknown clinical field(s): " + unknown.join(", "));
    return result(values, units, sourceLabel || "local clinical inputs CSV", { unknownFields: unknown });
  }

  function result(values, units, sourceLabel, extra) {
    var present = specs.filter(function (spec) { return values[spec.name] !== null && values[spec.name] !== undefined && values[spec.name] !== ""; }).map(function (spec) { return spec.name; });
    var missing = specs.filter(function (spec) { return present.indexOf(spec.name) < 0; }).map(function (spec) { return spec.name; });
    var byCategory = {};
    specs.forEach(function (spec) {
      if (!byCategory[spec.category]) byCategory[spec.category] = { present: 0, total: 0, missing: [] };
      byCategory[spec.category].total++;
      if (present.indexOf(spec.name) >= 0) byCategory[spec.category].present++;
      else byCategory[spec.category].missing.push(spec.name);
    });
    return {
      sourceLabel: sourceLabel,
      values: values,
      units: units || {},
      presentFields: present,
      missingFields: missing,
      complete: missing.length === 0,
      byCategory: byCategory,
      unknownFields: (extra && extra.unknownFields) || [],
      warnings: (extra && extra.warnings) || [],
      estimatedAges: extra && Object.prototype.hasOwnProperty.call(extra, "estimatedAges") ? extra.estimatedAges : estimateAgeSignals(values)
    };
  }

  function normalizeEstimatedAges(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.map(function (item, index) {
      if (!item || typeof item !== "object") throw new Error("estimated_ages[" + index + "] must be an object");
      var value = item.value === null || item.value === undefined || item.value === "" ? null : Number(item.value);
      if (value !== null && !Number.isFinite(value)) throw new Error("estimated_ages[" + index + "] value must be numeric");
      return {
        key: String(item.key || "estimated_age_" + (index + 1)),
        label: String(item.label || item.key || "Estimated age"),
        value: value,
        unit: String(item.unit || "years"),
        status: String(item.status || "estimated"),
        basis: Array.isArray(item.basis) ? item.basis.map(function (part) { return String(part); }) : [],
        method: String(item.method || "Deterministic category estimate from the available measurements."),
        uncertainty: String(item.uncertainty || "Research estimate; review alongside the underlying measurements."),
        inputsUsed: Array.isArray(item.inputsUsed || item.inputs_used) ? (item.inputsUsed || item.inputs_used).map(function (part) { return String(part); }) : [],
        inputCoverage: String(item.inputCoverage || item.input_coverage || "")
      };
    });
  }

  function parseClinicalCsv(input, sourceLabel) {
    var text = String(input).replace(/^\uFEFF/, "");
    if (text.length > MAX_BYTES) throw new Error("this file is larger than the 5 MB local preview limit");
    return parseRows(parseCsv(text), sourceLabel);
  }

  function parseProfile(profile, sourceLabel) {
    if (!profile || typeof profile !== "object" || !profile.measurements || typeof profile.measurements !== "object") {
      throw new Error("complete synthetic profile must contain a measurements object");
    }
    var values = emptyValues(), units = profile.units || {}, unknown = [];
    Object.keys(profile.measurements).forEach(function (field) {
      if (!byName[field]) { unknown.push(field); return; }
      values[field] = normalizeValue(profile.measurements[field], byName[field]);
    });
    var suppliedEstimates = profile.estimated_ages || profile.estimatedAges;
    return result(values, units, sourceLabel || profile.profile_label || "local profile", suppliedEstimates ? {
      unknownFields: unknown,
      estimatedAges: normalizeEstimatedAges(suppliedEstimates)
    } : { unknownFields: unknown });
  }

  return { MAX_BYTES: MAX_BYTES, specs: specs, byName: byName, emptyValues: emptyValues, parseClinicalCsv: parseClinicalCsv, parseProfile: parseProfile, normalizeValue: normalizeValue, normalizeEstimatedAges: normalizeEstimatedAges, estimateJointAge: estimateJointAge, estimateAgeSignals: estimateAgeSignals, result: result };
});
