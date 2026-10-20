(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.HealthspanAgentMeasurementState = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function present(value) { return value !== null && value !== undefined && value !== ""; }

  function mergeConfirmedBatch(current, updates, alternativesToKeep) {
    current = current || {};
    var values = Object.assign({}, current.values || {});
    var units = Object.assign({}, current.units || {});
    var provenance = Object.assign({}, current.provenance || {});
    var history = Array.isArray(current.history) ? current.history.slice() : [];
    var alternatives = Array.isArray(current.alternatives) ? current.alternatives.slice() : [];
    var knownAlternativeIds = new Set(alternatives.map(function (item) { return item && item.sourceCandidateId; }).filter(Boolean));

    (alternativesToKeep || []).forEach(function (item) {
      if (!item || typeof item.field !== "string" || !item.field || typeof item.sourceCandidateId !== "string" || knownAlternativeIds.has(item.sourceCandidateId)) return;
      knownAlternativeIds.add(item.sourceCandidateId);
      alternatives.push(item);
    });

    (updates || []).forEach(function (item) {
      if (!item || typeof item.field !== "string" || !item.field) return;
      if (present(values[item.field]) && provenance[item.field]) {
        var previousSource = provenance[item.field];
        var repeatedCandidate = String(values[item.field]) === String(item.value) &&
          typeof item.provenance?.sourceCandidateId === "string" &&
          item.provenance.sourceCandidateId === previousSource.sourceCandidateId;
        if (!repeatedCandidate) {
          history.push({
            field: item.field,
            value: values[item.field],
            unit: units[item.field] || "",
            provenance: previousSource,
            superseded: String(values[item.field]) !== String(item.value),
          });
        }
      }
      values[item.field] = item.value;
      units[item.field] = item.unit || "";
      provenance[item.field] = item.provenance || {};
    });

    return { values: values, units: units, provenance: provenance, history: history, alternatives: alternatives };
  }

  return { mergeConfirmedBatch: mergeConfirmedBatch };
});
