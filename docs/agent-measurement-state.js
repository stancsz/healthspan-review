(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.HealthspanAgentMeasurementState = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function present(value) { return value !== null && value !== undefined && value !== ""; }

  function mergeConfirmedBatch(current, updates) {
    current = current || {};
    var values = Object.assign({}, current.values || {});
    var units = Object.assign({}, current.units || {});
    var provenance = Object.assign({}, current.provenance || {});
    var history = Array.isArray(current.history) ? current.history.slice() : [];

    (updates || []).forEach(function (item) {
      if (!item || typeof item.field !== "string" || !item.field) return;
      if (present(values[item.field]) && provenance[item.field]) {
        history.push({
          field: item.field,
          value: values[item.field],
          unit: units[item.field] || "",
          provenance: provenance[item.field],
          superseded: String(values[item.field]) !== String(item.value),
        });
      }
      values[item.field] = item.value;
      units[item.field] = item.unit || "";
      provenance[item.field] = item.provenance || {};
    });

    return { values: values, units: units, provenance: provenance, history: history };
  }

  return { mergeConfirmedBatch: mergeConfirmedBatch };
});
