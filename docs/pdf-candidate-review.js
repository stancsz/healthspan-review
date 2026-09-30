(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.pdfCandidateReview = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';

  function isValidISODate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
    if (!match) return false;
    const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
    const date = new Date(0);
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCFullYear(year, month - 1, day);
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }

  function classifyCandidateRows(rows) {
    const result = rows.map(() => ({ conflict: false, duplicate: false }));
    const groups = new Map();
    rows.forEach((row, index) => {
      if (row.value == null || row.value === '') return;
      const value = Number(row.value);
      if (!row.field || !isValidISODate(row.date) || !Number.isFinite(value)) return;
      const key = `${row.field}\u0000${row.date}`;
      const group = groups.get(key) || [];
      group.push({ index, value });
      groups.set(key, group);
    });
    for (const group of groups.values()) {
      if (group.length < 2) continue;
      const conflict = new Set(group.map(item => String(item.value))).size > 1;
      for (const item of group) result[item.index][conflict ? 'conflict' : 'duplicate'] = true;
    }
    return result;
  }

  function candidateReviewMessages(candidate, enteredDate, flags) {
    const messages = [];
    if (candidate.baseIssue) messages.push(candidate.baseIssue);
    if (candidate.dateIssue && !isValidISODate(enteredDate)) messages.push('Date is ambiguous or unsupported; enter the source date explicitly');
    if (flags.conflict) messages.push('Conflicting values for this field/date; compare the source and choose one');
    else if (flags.duplicate) messages.push('Equivalent value/date also appears in another source; choose one source');
    return messages;
  }

  function prepareSelectedCandidates(selections, normalizeValue) {
    const entries = [];
    try {
      for (const selection of selections) {
        const { candidate, valueText, enteredDate, spec } = selection;
        if (enteredDate && !isValidISODate(enteredDate)) throw new Error('Enter a valid calendar date.');
        if (candidate.dateIssue && !isValidISODate(enteredDate)) throw new Error('Confirm an unambiguous measurement date before entry.');
        const value = normalizeValue(valueText, spec);
        entries.push({
          field: candidate.field,
          value,
          unit: candidate.normalizedUnit || candidate.unit || spec.unit,
          provenance: {
            printedValue: candidate.printedValue,
            printedUnit: candidate.unit,
            unitConverted: candidate.unitConverted,
            page: candidate.page,
            evidence: candidate.evidence,
            printedDate: candidate.date || null,
            date: enteredDate || candidate.date || null,
            enteredValue: value
          }
        });
      }
    } catch (error) {
      return { ok: false, error: error.message, entries: [] };
    }
    return { ok: true, error: '', entries };
  }

  function toLedgerRecord(entry, spec) {
    return {
      field: entry.field,
      value: entry.value,
      unit: entry.unit,
      unit_conversion_applied: !!entry.provenance.unitConverted,
      category: spec.category,
      provenance: 'user_confirmed_pdf_measurement',
      printed_value: entry.provenance.printedValue || null,
      printed_unit: entry.provenance.printedUnit || null,
      printed_date: entry.provenance.printedDate || null,
      source_page: entry.provenance.page || null,
      evidence: entry.provenance.evidence || null,
      measured_at: entry.provenance.date || null
    };
  }

  return { isValidISODate, classifyCandidateRows, candidateReviewMessages, prepareSelectedCandidates, toLedgerRecord };
});
