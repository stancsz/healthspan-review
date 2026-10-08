(function () {
  "use strict";
  // This fixed synthetic workflow uses tab memory only. Approval is a demo state,
  // not an identity, clinical authorization, or permission to process patient data.
  var version = 1, approval = null, checkin = null, savedDraft = null, closedReason = "";
  var $ = function (id) { return document.getElementById(id); };
  var fields = [$("goal"), $("action"), $("rationale"), $("review-date")];
  var defaults = ["More energy through the week", "Add a 10-minute walk after lunch on three weekdays, if this feels manageable.", "A small, repeatable starting point. Adjust together if it does not fit your routine."];
  var viewNames = ["measure", "plan", "today", "followup"];
  function todayISO() { var now = new Date(); return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-"); }
  function defaultReviewDate() { var day = new Date(); day.setDate(day.getDate() + 28); return [day.getFullYear(), String(day.getMonth() + 1).padStart(2, "0"), String(day.getDate()).padStart(2, "0")].join("-"); }
  function formatDate(iso) { return new Date(iso + "T12:00:00").toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }); }
  function validDate(iso) { var date = new Date(iso + "T12:00:00Z"); return /^\d{4}-\d{2}-\d{2}$/.test(iso) && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === iso; }
  function currentDraft() { return { goal: $("goal").value.trim(), action: $("action").value.trim(), rationale: $("rationale").value.trim(), reviewDate: $("review-date").value, version: version, snapshot: "HSR-042-rev-1" }; }
  function sameDraft(a, b) { return Boolean(a && b && a.goal === b.goal && a.action === b.action && a.rationale === b.rationale && a.reviewDate === b.reviewDate && a.version === b.version && a.snapshot === b.snapshot); }
  function isCurrent() { return Boolean(approval && approval.snapshot === "HSR-042-rev-1" && approval.version === version && sameDraft(approval, currentDraft()) && approval.reviewDate >= todayISO()); }
  function view(name) {
    if (viewNames.indexOf(name) < 0) return;
    renderAll();
    document.querySelectorAll(".view").forEach(function (node) { node.classList.toggle("shown", node.id === name + "-view"); });
    document.querySelectorAll(".step").forEach(function (node) {
      var selected = node.dataset.view === name;
      node.classList.toggle("active", selected);
      if (selected) node.setAttribute("aria-current", "step"); else node.removeAttribute("aria-current");
    });
    $("workflow-position").textContent = "STEP " + (viewNames.indexOf(name) + 1) + " OF 4";
    $(name + "-title").focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "auto" });
  }
  function setStatus(message) { $("plan-status").textContent = message; }
  function invalidate() {
    if (approval || savedDraft) {
      version += 1;
      if (approval) closedReason = "The approved plan was edited. Save and approve the new version before continuing.";
      approval = null; checkin = null;
      savedDraft = null;
      setStatus(closedReason ? "Edited · previous approval invalidated; patient view closed" : "Draft changed · save version " + version + " before approval");
    } else setStatus("Draft changed · save before approval");
    $("export-status").textContent = "";
    renderAll();
  }
  function renderPatient() {
    var active = isCurrent(), expired = approval && approval.reviewDate < todayISO();
    $("today-state").textContent = active ? "Approved · current" : expired ? "Approval expired" : "Approval needed";
    $("locked-state").hidden = active;
    $("today-card").hidden = !active;
    $("today-next").hidden = !(active && checkin);
    $("revoked-note").hidden = active || !(closedReason || approval);
    var reason = expired ? "The review date has passed; approval expired. Review and approve a new plan before continuing." : closedReason || "Save a draft and approve the current version to preview the participant's Today card.";
    $("locked-reason").textContent = reason;
    $("revoked-reason").textContent = reason;
    // Clear stale private text from the hidden patient card as well as closing it.
    $("today-goal").textContent = active ? "YOUR PRIORITY · " + approval.goal : "";
    $("today-action").textContent = active ? approval.action : "";
    $("today-rationale").textContent = active ? approval.rationale : "";
    $("patient-plan-version").textContent = active ? "v" + approval.version : "";
    $("patient-review-date").textContent = active ? formatDate(approval.reviewDate) : "";
    $("checkin-status").textContent = active && checkin ? "Check-in recorded: " + (checkin.response === "done" ? "I did it" : "It was difficult") + ". Ready for follow-up." : "No check-in yet.";
    document.querySelectorAll(".checkin").forEach(function (button) {
      var selected = Boolean(active && checkin && button.dataset.check === checkin.response);
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-pressed", String(selected));
      button.disabled = !active;
    });
  }
  function renderFollowup() {
    var active = isCurrent();
    $("followup-action-title").textContent = approval ? approval.action : "No approved plan yet";
    $("followup-check-tag").textContent = checkin ? (active ? "Check-in recorded" : "Review needed · inactive") : "No check-in";
    $("followup-check").textContent = checkin ? (checkin.response === "done" ? "Participant marked the action as completed." : "Participant marked the action as difficult.") + (active ? " This response belongs to the current approved plan." : " Approval is no longer current. Review the plan before continuing; export is closed.") : active ? "The plan is approved. Open Patient today and record a synthetic check-in." : "Approve the draft and record a synthetic check-in to see it here.";
    $("followup-version").textContent = approval ? "v" + approval.version + " · HSR-042 rev 1" : "—";
    $("followup-time").textContent = checkin ? "Recorded " + new Date(checkin.recordedAt).toLocaleString() + " · synthetic response" : "";
    $("export-followup").disabled = !(active && checkin && checkin.version === approval.version);
    $("export-note").textContent = active && checkin ? "Local JSON includes the action, approval, check-in and snapshot provenance. No participant name or raw source file." : "Record a check-in on a current approved plan to enable download.";
  }
  function renderAll() {
    var active = isCurrent(), saved = sameDraft(savedDraft, currentDraft()), expired = approval && approval.reviewDate < todayISO();
    $("plan-version").textContent = "Version " + version;
    $("approval-badge").textContent = active ? "Approved · v" + version : expired ? "Expired · review needed" : saved ? "Saved draft · clinic only" : "Draft · clinic only";
    $("revoke").hidden = !approval;
    $("approve").disabled = !saved || active || !validDate($("review-date").value) || $("review-date").value < todayISO();
    $("save-draft").disabled = active || saved;
    $("step-plan-state").textContent = active ? "Approved · v" + version : expired ? "Approval expired" : saved ? "Saved · ready to approve" : "Draft to prepare";
    $("step-today-state").textContent = active ? "Current plan available" : "Approval needed";
    $("step-followup-state").textContent = active && checkin ? "Ready to review" : "Check-in needed";
    if (expired) setStatus("Approval expired · patient view and export closed. Update the review date, save and approve again.");
    renderPatient(); renderFollowup();
  }
  function validateDraft(draft) {
    var missing = fields.find(function (field) { return !field.value.trim(); });
    if (missing) { setStatus("Complete all fields before saving the draft."); missing.focus(); return false; }
    if (!validDate(draft.reviewDate) || draft.reviewDate < todayISO()) { setStatus("Choose a valid review date today or later."); $("review-date").focus(); return false; }
    return true;
  }
  document.querySelectorAll("[data-view]").forEach(function (button) { button.addEventListener("click", function () { view(button.dataset.view); }); });
  document.querySelectorAll("[data-go]").forEach(function (button) { button.addEventListener("click", function () { view(button.dataset.go); }); });
  fields.forEach(function (field) { field.addEventListener("input", invalidate); field.addEventListener("change", invalidate); });
  $("plan-form").addEventListener("submit", function (event) { event.preventDefault(); $("save-draft").click(); });
  $("save-draft").addEventListener("click", function () {
    var draft = currentDraft();
    if (!validateDraft(draft)) return;
    savedDraft = Object.freeze(draft);
    setStatus("Draft v" + version + " saved in this tab · not visible to participant. Ready for approval.");
    renderAll();
  });
  $("approve").addEventListener("click", function () {
    var draft = currentDraft();
    if (!validateDraft(draft)) return;
    if (!sameDraft(savedDraft, draft)) { setStatus("Save the current draft before approving it."); renderAll(); return; }
    draft.approvedAt = new Date().toISOString();
    approval = Object.freeze(draft); checkin = null; closedReason = "";
    setStatus("Approved · bound to HSR-042 rev 1 · v" + version + " · active through " + formatDate(draft.reviewDate));
    renderAll(); view("today");
  });
  $("revoke").addEventListener("click", function () {
    if (!approval) return;
    approval = null; checkin = null; savedDraft = null; version++;
    closedReason = "Approval was revoked. Save and approve a new plan version before continuing.";
    setStatus("Approval revoked · patient view closed. Draft v" + version + " requires new approval.");
    $("export-status").textContent = "";
    renderAll();
  });
  document.querySelectorAll(".checkin").forEach(function (button) { button.addEventListener("click", function () {
    if (!isCurrent()) { renderAll(); return; }
    checkin = Object.freeze({ response: button.dataset.check, recordedAt: new Date().toISOString(), version: approval.version, snapshot: approval.snapshot });
    $("export-status").textContent = "";
    renderAll();
  }); });
  document.addEventListener("visibilitychange", renderAll);
  window.setInterval(renderAll, 30000);
  $("export-followup").addEventListener("click", function () {
    if (!checkin || !isCurrent() || checkin.version !== approval.version || checkin.snapshot !== approval.snapshot) { renderAll(); return; }
    var packet = {
      format: "synthetic-clinic-followup-v1", case_id: "HSR-042", synthetic: true, snapshot: approval.snapshot, plan_version: approval.version, current: true,
      plan: { goal: approval.goal, action: approval.action, participant_note: approval.rationale },
      approval: { status: "synthetic_workflow_approval", approved_at: approval.approvedAt, snapshot: approval.snapshot, plan_version: approval.version },
      participant_check_in: checkin.response, check_in_recorded_at: checkin.recordedAt, review_date: approval.reviewDate,
      measurement_provenance: [{ field: "body_mass_index", value: 28.4, unit: "kg/m2", kind: "derived_synthetic_example", source: "Synthetic clinic record", date: "2026-10-08", limitation: "Height and weight inputs are not included." }, { field: "grip_strength", value: 31, unit: "kg", kind: "observed_synthetic_example", source: "Synthetic clinic measurement", date: "2026-10-08", limitation: "Measurement protocol is not included." }],
      data_handling: "Generated locally for demonstration; no real patient data, participant name or raw source file.",
      intended_use: "Research and wellness workflow demonstration only; no clinical authorization, diagnosis, treatment advice or age prediction."
    };
    var url = URL.createObjectURL(new Blob([JSON.stringify(packet, null, 2) + "\n"], { type: "application/json" }));
    var link = document.createElement("a"); link.href = url; link.download = "synthetic-followup-HSR-042.json";
    document.body.appendChild(link); link.click(); link.remove();
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    $("export-status").textContent = "Synthetic JSON download prepared on this device. Nothing was uploaded.";
  });
  $("reset-demo").addEventListener("click", function () {
    approval = null; checkin = null; savedDraft = null; closedReason = ""; version = 1;
    fields.slice(0, 3).forEach(function (field, index) { field.value = defaults[index]; });
    $("review-date").value = defaultReviewDate();
    setStatus("Draft · not visible to participant"); $("export-status").textContent = "";
    renderAll(); view("measure");
  });
  $("review-date").value = defaultReviewDate();
  renderAll();
})();
