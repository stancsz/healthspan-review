(function (root) {
  "use strict";

  var C = {
    ink: "18352D", green: "214B3E", green2: "2F6756", cream: "F7F5EF",
    paper: "FFFFFF", muted: "64736D", line: "DCE4DD", gold: "C18B43",
    paleGreen: "EAF1EB", paleGold: "F7F0E4", paleRed: "F8ECE7", red: "9B5138",
  };

  function ascii(value) {
    return String(value == null ? "" : value)
      .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[²₂]/g, "2").replace(/[–—]/g, "-")
      .replace(/[“”]/g, '"').replace(/[‘’]/g, "'")
      .replace(/[·•]/g, " | ").replace(/→/g, "to")
      .replace(/[^\x20-\x7E]/g, "?");
  }
  function esc(value) { return ascii(value).replace(/([\\()])/g, "\\$1"); }
  function color(hex) { return [0, 2, 4].map(function (i) { return (parseInt(hex.slice(i, i + 2), 16) / 255).toFixed(3); }).join(" "); }
  function wrap(value, maxChars) {
    var words = ascii(value).split(/\s+/), lines = [], line = "";
    words.forEach(function (word) {
      while (word.length > maxChars) {
        if (line) { lines.push(line); line = ""; }
        lines.push(word.slice(0, maxChars)); word = word.slice(maxChars);
      }
      if (!word) return;
      if (line && line.length + word.length + 1 > maxChars) { lines.push(line); line = word; }
      else line += (line ? " " : "") + word;
    });
    if (line) lines.push(line);
    return lines;
  }
  function displayNumber(value) {
    if (typeof value !== "number" || !Number.isFinite(value)) return String(value);
    return String(Number(value.toFixed(3)));
  }
  function displayField(field) { return field.label || String(field.field || "").replace(/_/g, " "); }
  function fieldName(name, fields) {
    var field = fields.find(function (item) { return item.field === name; });
    return field ? displayField(field) : String(name || "Measurement").replace(/_/g, " ");
  }
  function displayBoundary(value) {
    if (value === "E-005 remains blocked.") return "The research evidence gate remains incomplete; this report does not enable clinical or age-estimate claims.";
    return value;
  }
  function displayComparisonStatus(value) {
    if (!value || value === "unavailable") return "No comparable dated scans are available.";
    if (value === "descriptive_measurement_deltas_only") return "Descriptive measurement differences only.";
    return String(value || "unavailable").replace(/_/g, " ");
  }
  function isSyntheticProvenance(provenance) {
    if (typeof provenance === "string") return provenance.toLowerCase() === "synthetic" || provenance.toLowerCase() === "synthetic display fixture";
    if (!provenance || typeof provenance !== "object") return false;
    return provenance.synthetic === true || [provenance.source, provenance.file, provenance.filename].some(function (value) {
      return typeof value === "string" && (value.toLowerCase() === "synthetic" || value.toLowerCase() === "synthetic display fixture");
    });
  }

  function buildReportPdf(packet) {
    packet = packet || {};
    var profile = packet.complete_profile || {}, fields = Array.isArray(profile.fields) ? profile.fields : [];
    var readiness = packet.assessment_readiness || {}, fi = packet.frailty_index || {};
    var ledger = Array.isArray(packet.clinical_ledger) ? packet.clinical_ledger : [];
    var currentLedger = ledger.filter(function (entry) {
      var provenance = entry.provenance || {};
      return !provenance.historical && !provenance.alternativeNotSelected;
    });
    var syntheticFixture = fields.some(function (field) { return isSyntheticProvenance(field.provenance); }) || currentLedger.some(function (entry) { return isSyntheticProvenance(entry.provenance); });
    var boundaries = Array.isArray(packet.boundaries) ? packet.boundaries : [];
    var warnings = packet.parsing_review || {}, comparison = packet.comparison || {};
    var pages = [], page, y;

    function command(s) { page.ops.push(s); }
    function rect(x, top, w, h, fill, stroke) {
      var bottom = 792 - top - h;
      command(color(fill) + " rg " + x + " " + bottom + " " + w + " " + h + " re f");
      if (stroke) command(color(stroke) + " RG 0.7 w " + x + " " + bottom + " " + w + " " + h + " re S");
    }
    function rule(x1, top, x2, stroke, width) {
      var yy = 792 - top;
      command(color(stroke || C.line) + " RG " + (width || 0.7) + " w " + x1 + " " + yy + " m " + x2 + " " + yy + " l S");
    }
    function text(value, x, top, size, fill, bold) {
      command("BT /" + (bold ? "F2" : "F1") + " " + size + " Tf " + color(fill || C.ink) + " rg 1 0 0 1 " + x + " " + (792 - top - size) + " Tm (" + esc(value) + ") Tj ET");
    }
    function para(value, x, top, maxChars, size, fill, leading, bold) {
      var lines = wrap(value, maxChars), step = leading || size * 1.42;
      lines.forEach(function (line, index) { text(line, x, top + index * step, size, fill, bold); });
      return lines.length * step;
    }
    function startPage(kind) {
      page = { ops: [], kind: kind };
      pages.push(page);
      if (kind === "cover") {
        rect(0, 0, 612, 792, C.cream);
        rect(0, 0, 612, 202, C.green);
        rect(42, 35, 36, 4, C.gold);
        text("HEALTHSPAN REVIEW", 42, 52, 9, "D8E6DA", true);
        text("Measurement review", 42, 80, 29, C.paper, true);
        text(syntheticFixture ? "SYNTHETIC FIXTURE  /  NOT USER DATA" : "MEASUREMENT RECORD  /  COMPLETENESS SNAPSHOT", 42, 126, 9, "E6C58F", true);
        para("Research and wellness use only. An organized record of entered measurements, source evidence, and missing inputs.", 42, 153, 83, 9, "E8F0E8", 13);
        y = 220;
      } else {
        rect(0, 0, 612, 792, C.cream);
        rect(0, 0, 612, 44, C.green);
        text("HEALTHSPAN REVIEW", 42, 15, 9, "E4EEE5", true);
        text(kind === "profile" ? "MEASUREMENT PROFILE" : kind === "domains" ? "DOMAIN AGE ESTIMATES" : kind === "age-methods" ? "AGE MODEL AUDIT" : "SOURCE NOTES & LIMITS", 386, 15, 8, "E6C58F", true);
        y = 65;
      }
    }
    function section(title, kicker) {
      if (y > 680) { startPage("details"); y = 65; }
      if (kicker) { text(kicker.toUpperCase(), 42, y, 7, C.green2, true); y += 14; }
      text(title, 42, y, 15, C.ink, true); y += 24;
      rule(42, y - 4, 570, C.gold, 1.2);
    }
    function need(height) { if (y + height > 736) { startPage("details"); y = 66; } }
    function chip(label, value, x, top, width) {
      rect(x, top, width, 76, C.paper, C.line);
      rect(x, top, 4, 76, C.gold);
      text(label.toUpperCase(), x + 15, top + 13, 7, C.muted, true);
      text(value, x + 15, top + 31, 18, C.green, true);
    }

    // Cover: a clear summary and the most useful confirmed readings.
    startPage("cover");
    var present = Number(profile.present_count || 0), total = Number(profile.total_count || 35);
    var missing = Array.isArray(readiness.missing_requirements) ? readiness.missing_requirements : [];
    var readyText = readiness.assessment_ready ? "Minimum inputs present" : "Minimum inputs missing";
    chip("Record completeness", present + " / " + total, 42, 220, 166);
    chip("Input completeness", readiness.assessment_ready ? "Minimum met" : "Incomplete", 223, 220, 166);
      chip("Current confirmed entries", String(currentLedger.length), 404, 220, 166);
    rect(42, 313, 528, 52, readiness.assessment_ready ? C.paleGreen : C.paleGold);
    text(readyText, 58, 325, 10, C.ink, true);
    para("This report checks whether inputs are present. It is not a clinical assessment, diagnosis, or treatment recommendation.", 58, 342, 91, 8, C.muted, 11);

    rect(42, 376, 528, 43, C.paleGold);
    rect(42, 376, 4, 43, C.gold);
    text("DOMAIN AGE ESTIMATES: WITHHELD", 56, 384, 8, C.ink, true);
    para("No category-specific model, uncertainty estimate, and approved reference panel are available for reporting.", 56, 398, 88, 7.5, C.muted, 9);

    y = 436;
    section("Selected clinical entries", "From current packet");
    if (!currentLedger.length) {
      rect(42, y + 2, 528, 58, C.paper, C.line);
      text("No AI-assisted file readings have been confirmed.", 57, y + 20, 9, C.muted, false);
      y += 72;
    } else {
      currentLedger.slice(0, 4).forEach(function (entry, index) {
        var x = index % 2 ? 311 : 42;
        if (index % 2 === 0 && index > 0) y += 98;
        var top = y + (index % 2 ? 0 : 0);
        rect(x, top, 259, 88, C.paper, C.line);
        rect(x, top, 259, 3, index === 0 ? C.gold : C.green2);
        text(fieldName(entry.field, fields), x + 14, top + 12, 9, C.ink, true);
        text(String(entry.value == null ? "Not provided" : entry.value) + (entry.unit ? " " + entry.unit : ""), x + 14, top + 31, 16, C.green, true);
        var provenance = entry.provenance || {};
        var sourceName = provenance.file || provenance.filename || provenance.source || (typeof entry.provenance === "string" ? entry.provenance : "Source not recorded");
        if (sourceName === "observed_in_clinical_inputs_csv") sourceName = "Clinical inputs CSV";
        if (sourceName === "synthetic") sourceName = "Synthetic display fixture";
        var location = provenance.location || (provenance.page ? "Page " + provenance.page : "Location not recorded");
        para(sourceName + "  |  " + location, x + 14, top + 60, 44, 7, C.muted, 9);
      });
      if (currentLedger.length > 4) {
        y += 98;
        text("+ " + (currentLedger.length - 4) + " additional measurements in the profile table", 42, y, 8, C.muted, false);
        y += 14;
      } else y += 98;
    }
    text("Prepared from the current locally assembled review packet.", 42, 733, 8, C.muted, false);

    // Full canonical profile, compact and consistently aligned.
    startPage("profile");
    var profileTitle = fields.length === total ? "All " + total + " canonical fields" : "Profile fields provided (" + fields.length + " of " + total + ")";
    text(profileTitle, 42, y, 16, C.ink, true); y += 23;
    para("A blank entry means no value was supplied. Record status shows presence only; it does not verify the source document.", 42, y, 92, 8.5, C.muted, 11.5); y += 26;
    var cols = [42, 282, 374, 445, 516], profileRowHeight = 17;
    rect(42, y, 528, 22, C.green);
    text("FIELD", cols[0] + 9, y + 7, 7.5, C.paper, true);
    text("VALUE", cols[1] + 8, y + 7, 7.5, C.paper, true);
    text("UNIT", cols[2] + 8, y + 7, 7.5, C.paper, true);
    text("RECORD STATUS", cols[3] + 8, y + 7, 7, C.paper, true);
    y += 2;
    y += 22;
    fields.forEach(function (field, index) {
      if (y + profileRowHeight > 736) { startPage("profile"); y = 65; text(profileTitle + " (continued)", 42, y, 14, C.ink, true); y += 22; }
      var value = field.value === null || field.value === undefined || field.value === "" ? "-" : String(field.value);
      var source = !field.provenance ? "Missing" : isSyntheticProvenance(field.provenance) ? "Synthetic" : "Recorded";
      if (index % 2 === 0) rect(42, y, 528, profileRowHeight, C.paper);
      text(displayField(field).slice(0, 35), cols[0] + 9, y + 4, 8.2, C.ink, false);
      text(value.slice(0, 14), cols[1] + 8, y + 4, 8.2, value === "-" ? C.muted : C.green, value !== "-");
      text(String(field.unit || "-"), cols[2] + 8, y + 4, 7.6, C.muted, false);
      text(source, cols[3] + 8, y + 4, 8, source === "Missing" ? C.red : C.green2, true);
      rule(42, y + profileRowHeight, 570, C.line, 0.35);
      y += profileRowHeight;
    });

    // Domain cards show complete field membership and missingness in readable type.
    var domains = Array.isArray(packet.domain_age_reports) ? packet.domain_age_reports : [];
    if (domains.length) {
      var ageContext = packet.chronological_age_context || {};
      var sexContext = fields.find(function (field) { return field.field === "sex" && field.value != null; });
      var ageText = ageContext.value == null ? "Age not supplied" : "Supplied age: " + displayNumber(Number(ageContext.value)) + " years (not recalculated)";
      if (sexContext) ageText += "; recorded sex: " + sexContext.value;
      for (var domainStart = 0; domainStart < domains.length; domainStart += 9) {
        var domainPage = domains.slice(domainStart, domainStart + 9);
        startPage("domains");
        text(domainStart === 0 ? "Domain measurement and age status" : "Domain measurement and age status (continued)", 42, y, 16, C.ink, true); y += 23;
        para(ageText + ". Context only; not independently verified.", 42, y, 92, 8.5, C.muted, 12); y += 26;
        var noteTop = y;
        rect(42, noteTop, 528, 54, C.paleGold);
        text("AGE AND REFERENCE STATUS", 54, noteTop + 6, 7, C.ink, true);
        para("Age/sex-specific reference ranges are unavailable. Numeric domain ages remain withheld pending validated models, uncertainty, and reference panels. Domain counts can overlap; all 35 fields are listed on page 2.", 54, noteTop + 18, 86, 8.4, C.muted, 10.5);
        y = noteTop + 62;
        domainPage.forEach(function (domain, localIndex) {
          var index = domainStart + localIndex, h = 100, col = localIndex % 2, row = Math.floor(localIndex / 2), x = col ? 311 : 42;
          var cardY = y + row * 104;
          rect(x, cardY, 259, h, C.paper, C.line);
          rect(x, cardY, 3, h, domain.status === "not_available" ? C.line : C.gold);
          text(String(domain.label || domain.id || "Domain"), x + 11, cardY + 7, 10, C.ink, true);
          text("Age estimate withheld", x + 11, cardY + 23, 8.5, C.red, true);
          var expected = Array.isArray(domain.expected_fields) ? domain.expected_fields : [];
          var presentNames = [], missingNames = [];
          expected.forEach(function (name) {
            var field = fields.find(function (item) { return item.field === name; });
            var label = field ? displayField(field) : String(name).replace(/_/g, " ");
            if (field && field.value !== null && field.value !== undefined && field.value !== "") presentNames.push(label);
            else missingNames.push(label);
          });
          if (!expected.length) {
            para("No supported measures are included in the current packet.", x + 11, cardY + 39, 48, 8.5, C.muted, 10);
          } else {
            text("Recorded fields: " + presentNames.length + " of " + expected.length, x + 11, cardY + 36, 8, C.muted, false);
            var details = [];
            if (presentNames.length) details.push("Recorded: " + presentNames.join(", "));
            if (missingNames.length) details.push("Not recorded: " + missingNames.join(", "));
            var detailY = cardY + 47;
            details.forEach(function (line) { detailY += para(line, x + 11, detailY, 48, 8.5, C.muted, 10) + 2; });
          }
        });
      }
    }

    // Show why the most relevant published population models cannot produce
    // patient-level domain ages from the current measurement contract.
    startPage("age-methods");
    text("Candidate age algorithms and input gaps", 42, y, 16, C.ink, true); y += 23;
    para("These published research models are not run on this record. A partial panel or a relabeled whole-body clock would not be a category-age estimate.", 42, y, 92, 8.5, C.muted, 12); y += 34;
    var candidates = [
      { title: "Whole-body age | NHANES KDM", panel: "Albumin, ALP, BUN, creatinine, CRP, HbA1c, uric acid, WBC, lymphocyte %, MCV, RDW, diastolic BP, pulse pressure.", missing: "BUN, uric acid, lymphocyte %, MCV; CRP assay harmonization and same-session pulse pressure also need protocol review." },
      { title: "Heart age | NHANES KDM", panel: "Diastolic and systolic BP, fasting glucose, total cholesterol, HDL, LDL, fasting triglycerides.", missing: "Total cholesterol, HDL, LDL, and fasting triglycerides; fasting/lab protocol needs confirmation." },
      { title: "Liver age | NHANES KDM", panel: "AST, ALT, GGT, ALP, LDH.", missing: "AST, ALT, GGT, and LDH. FIB-4 is not a substitute for this model panel." },
      { title: "Kidney age | NHANES KDM", panel: "Urine albumin and creatinine, serum creatinine, BUN, uric acid, phosphorus, bicarbonate.", missing: "Urine albumin, urine creatinine, BUN, uric acid, phosphorus, and bicarbonate. eGFR is not a substitute." },
    ];
    candidates.forEach(function (item, index) {
      var col = index % 2, row = Math.floor(index / 2), x = col ? 311 : 42;
      var top = y + row * 190;
      rect(x, top, 259, 178, C.paper, C.line);
      rect(x, top, 4, 178, index === 0 ? C.gold : C.green2);
      text(item.title, x + 13, top + 12, 9, C.ink, true);
      text("Published inputs", x + 13, top + 34, 7.5, C.green2, true);
      var ty = top + 46 + para(item.panel, x + 13, top + 46, 49, 7.5, C.muted, 10);
      text("Missing or unmatched here", x + 13, ty + 4, 7.5, C.red, true);
      ty += 17;
      ty += para(item.missing, x + 13, ty, 49, 7.5, C.muted, 10);
      text("Result: not calculated", x + 13, top + 153, 7.5, C.red, true);
    });
    var candidateNoteY = y + 390;
    rect(42, candidateNoteY, 528, 78, C.paleGold);
    text("NO PATIENT-SPECIFIC AGE OR REFERENCE INTERVAL", 55, candidateNoteY + 10, 8, C.ink, true);
    para("The paper's cohort MAE is not an individual's uncertainty interval, and its positive/negative age gap is not an age/sex-matched clinical reference range. The paper includes no joint-age model. The app needs a complete compatible panel, reproducible frozen model, patient-level uncertainty, and a separately validated age/sex reference distribution before it can report an age.", 55, candidateNoteY + 27, 86, 7.5, C.muted, 10);
    para("Source: Zheng et al. 2026, NHANES KDM body/heart/liver/kidney models; https://www.nature.com/articles/s41538-026-00799-3", 42, candidateNoteY + 92, 92, 7, C.muted, 9);

    // Provenance and interpretation details continue on a clean notes page.
    startPage("details");
    var evidenceEntries = ledger.filter(function (entry) {
      var source = entry.provenance || {};
      return ["file", "filename", "location", "page", "printedValue", "printedUnit", "printedDate", "enteredValue", "evidence", "excerpt", "uncertainty"].some(function (key) {
        return source[key] !== undefined && source[key] !== null && source[key] !== "";
      });
    });
    section("Source evidence", "Traceability");
    if (evidenceEntries.length) {
      evidenceEntries.forEach(function (entry, index) {
        var source = entry.provenance || {};
        var historyLabel = source.alternativeNotSelected
          ? "Alternative not selected: "
          : source.historical ? (source.duplicate_source ? "Previously confirmed (same reading, additional source): " : "Previously confirmed (superseded): ") : "";
        var title = historyLabel + fieldName(entry.field, fields) + "  -  " + String(entry.value == null ? "" : entry.value) + (entry.unit ? " " + entry.unit : "");
        var lines = [title, "Source: " + (source.file || source.filename || source.source || "not recorded") + " | " + (source.location || (source.page ? "page " + source.page : "location not recorded"))];
        if (source.printedValue != null) lines.push("Printed value: " + source.printedValue);
        if (source.printedUnit) lines.push("Printed unit: " + source.printedUnit);
        if (source.printedDate) lines.push("Printed date: " + source.printedDate);
        if (source.enteredValue != null && String(source.enteredValue) !== String(source.printedValue)) lines.push("User-confirmed entered value: " + source.enteredValue);
        if (source.alternativeNotSelected) lines.push("Review status: Not selected; not entered into measurements or calculations.");
        if (source.alternativeNotSelected && source.selectedAlternative) {
          var selected = source.selectedAlternative;
          lines.push("Selected reading for comparison: " + selected.value + (selected.unit ? " " + selected.unit : "") + " | " + (selected.file || "source not recorded") + " | " + (selected.location || "location not recorded"));
        }
        if (source.evidence || source.excerpt) lines.push("Evidence: " + (source.evidence || source.excerpt));
        if (source.uncertainty) lines.push("Review note: " + source.uncertainty);
        var h = 36 + lines.slice(1).reduce(function (sum, line) { return sum + Math.max(12, wrap(line, 86).length * 12); }, 0);
        if (h > 210) h = 210;
        need(h + 10);
        rect(42, y, 528, h, C.paper, C.line);
        rect(42, y, 4, h, index === 0 ? C.gold : C.green2);
        var ty = y + 10;
        text(lines[0], 56, ty, 9, C.green, true); ty += 17;
        lines.slice(1).forEach(function (line) { ty += para(line, 56, ty, 86, 7.5, C.muted, 10) + 2; });
        y += h + 9;
      });
    } else {
      text("No field-level source citations are attached. The profile lists each recorded value and its recorded or missing status.", 42, y, 8.5, C.muted, false); y += 22;
    }
    if ((packet.measurement_ledger && packet.measurement_ledger.length) || (packet.segment_ledger && packet.segment_ledger.length)) {
      need(46);
      rect(42, y, 528, 36, C.paper, C.line);
      text("Equipment readings: " + ((packet.measurement_ledger || []).length) + "   |   Segment readings: " + ((packet.segment_ledger || []).length), 54, y + 12, 8.5, C.green2, true);
      y += 44;
    }
    section("Missing inputs", "Completeness");
    if (missing.length) {
      missing.forEach(function (item) {
        var h = Math.max(24, wrap(item, 83).length * 11 + 12); need(h);
        rect(42, y, 528, h, C.paleGold);
        text("-", 54, y + 7, 9, C.gold, true);
        para(item, 68, y + 7, 85, 8, C.ink, 11);
        y += h + 5;
      });
    } else {
      text("No minimum readiness inputs are missing.", 42, y, 8.5, C.green2, true); y += 12;
      text("Other fields may still be unrecorded; see the profile table.", 42, y, 8.5, C.muted, false); y += 18;
    }
    need(245);
    section("Review notes", "Interpretation");
    text("Comparison", 42, y, 9, C.ink, true); y += 15;
    y += para(displayComparisonStatus(comparison.status), 42, y, 88, 8.5, C.green2, 11.5) + 2;
    if (comparison.caveat) y += para(comparison.caveat, 42, y, 88, 8.5, C.muted, 11.5) + 5;
    var deltas = comparison.measurement_deltas || {};
    Object.keys(deltas).forEach(function (key) { y += para(fieldName(key, fields) + " delta: " + displayNumber(deltas[key]), 42, y, 88, 8.5, C.muted, 11.5); });
    y += 6;
    text("Frailty index", 42, y, 9, C.ink, true); y += 15;
    y += para(fi.status === "not_computed_in_browser_review" ? "Not computed in this browser review. Missing values were not imputed." : "Status: " + String(fi.status || "not computed"), 42, y, 88, 8.5, C.muted, 11.5) + 7;
    text("Source and parsing warnings", 42, y, 9, C.ink, true); y += 15;
    var warningItems = [].concat((warnings.unmapped_labels || []).map(function (v) { return "Unmapped label: " + v; }), (warnings.unit_warnings || []).map(function (v) { return "Unit warning: " + v; }), (warnings.merge_warnings || []).map(function (v) { return "Source warning: " + v; }));
    if (!warningItems.length) warningItems.push("No parser or source warnings.");
    warningItems.forEach(function (item) { var h = para(item, 42, y, 88, 8.5, C.muted, 11.5); y += h + 3; });
    y += 6;
    text("Use and limitations", 42, y, 9, C.ink, true); y += 15;
    var limitItems = boundaries.length ? boundaries : ["Research and wellness use only.", "This report does not provide diagnosis or treatment advice."];
    limitItems.forEach(function (item) { var h = para("- " + displayBoundary(item), 42, y, 88, 8.5, C.muted, 11.5); y += h + 3; });

    // Footer is added after page count is known.
    pages.forEach(function (p, index) {
      var label = syntheticFixture ? "SYNTHETIC FIXTURE - NOT USER DATA  |  Research and wellness use only  |  Generated locally" : "Research and wellness use only  |  Generated locally  |  Source documents not embedded";
      var yy = 35;
      p.ops.push(color(C.line) + " RG 0.7 w 42 " + yy + " m 570 " + yy + " l S");
      p.ops.push("BT /F1 8 Tf " + color(C.muted) + " rg 1 0 0 1 42 " + (yy - 18) + " Tm (" + esc(label) + ") Tj ET");
      p.ops.push("BT /F2 8 Tf " + color(C.green) + " rg 1 0 0 1 530 " + (yy - 18) + " Tm (" + (index + 1) + " / " + pages.length + ") Tj ET");
    });

    var objects = [];
    function add(value) { objects.push(value); return objects.length; }
    var catalogId = add(""), pagesId = add(""), regularFont = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
    var boldFont = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>"), pageIds = [];
    pages.forEach(function (p) {
      var stream = p.ops.join("\n");
      var contentId = add("<< /Length " + stream.length + " >>\nstream\n" + stream + "\nendstream");
      var pageId = add("<< /Type /Page /Parent " + pagesId + " 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 " + regularFont + " 0 R /F2 " + boldFont + " 0 R >> >> /Contents " + contentId + " 0 R >>");
      pageIds.push(pageId);
    });
    objects[catalogId - 1] = "<< /Type /Catalog /Pages " + pagesId + " 0 R >>";
    objects[pagesId - 1] = "<< /Type /Pages /Kids [" + pageIds.map(function (id) { return id + " 0 R"; }).join(" ") + "] /Count " + pageIds.length + " >>";
    var pdf = "%PDF-1.4\n%HealthspanReview\n", offsets = [0];
    objects.forEach(function (object, index) { offsets.push(pdf.length); pdf += (index + 1) + " 0 obj\n" + object + "\nendobj\n"; });
    var xref = pdf.length;
    pdf += "xref\n0 " + (objects.length + 1) + "\n0000000000 65535 f \n";
    offsets.slice(1).forEach(function (offset) { pdf += String(offset).padStart(10, "0") + " 00000 n \n"; });
    pdf += "trailer\n<< /Size " + (objects.length + 1) + " /Root " + catalogId + " 0 R >>\nstartxref\n" + xref + "\n%%EOF\n";
    return new TextEncoder().encode(pdf);
  }

  root.HealthspanReportPdf = { build: buildReportPdf };
})(typeof globalThis !== "undefined" ? globalThis : this);
