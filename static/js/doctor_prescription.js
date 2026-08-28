/* =========================================================
   HEALTH RING — Doctor Prescriptions
   Vanilla JavaScript. No jQuery.
   Implements: sidebar toggle, theme toggle, search, filters,
   view modal, print, add notes modal, toast.
   ========================================================= */
(function () {
  "use strict";

  /* ---------------------------------------------------------
     Sidebar toggle + responsive overlay
  --------------------------------------------------------- */
  function initSidebar() {
    var sidebar = document.getElementById("hrSidebar");
    var overlay = document.getElementById("hrOverlay");
    var toggleBtn = document.getElementById("hrSidebarToggle");
    if (!sidebar || !toggleBtn) return;

    function openSidebar() {
      sidebar.classList.add("show");
      if (overlay) overlay.classList.add("show");
    }
    function closeSidebar() {
      sidebar.classList.remove("show");
      if (overlay) overlay.classList.remove("show");
    }

    toggleBtn.addEventListener("click", function () {
      if (sidebar.classList.contains("show")) {
        closeSidebar();
      } else {
        openSidebar();
      }
    });

    if (overlay) overlay.addEventListener("click", closeSidebar);
  }

  /* ---------------------------------------------------------
     Theme toggle
  --------------------------------------------------------- */
  function initTheme() {
    var themeBtn = document.getElementById("hrThemeToggle");
    if (!themeBtn) return;
    var html = document.documentElement;

    var stored = null;
    try { stored = sessionStorage.getItem("hrTheme"); } catch (e) { stored = null; }
    if (stored === "dark") {
      html.setAttribute("data-theme", "dark");
      themeBtn.innerHTML = '<i class="fa-solid fa-sun"></i>';
    }

    themeBtn.addEventListener("click", function () {
      var isDark = html.getAttribute("data-theme") === "dark";
      if (isDark) {
        html.setAttribute("data-theme", "light");
        themeBtn.innerHTML = '<i class="fa-solid fa-moon"></i>';
        try { sessionStorage.setItem("hrTheme", "light"); } catch (e) {}
      } else {
        html.setAttribute("data-theme", "dark");
        themeBtn.innerHTML = '<i class="fa-solid fa-sun"></i>';
        try { sessionStorage.setItem("hrTheme", "dark"); } catch (e) {}
      }
    });
  }

  /* ---------------------------------------------------------
     Toast
  --------------------------------------------------------- */
  function showToast(text) {
    var toast = document.getElementById("hrToast");
    var toastText = document.getElementById("hrToastText");
    if (!toast) return;
    if (toastText && text) toastText.textContent = text;
    toast.classList.add("show");
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(function () {
      toast.classList.remove("show");
    }, 3200);
  }

  function initFlashToast() {
    var alertEl = document.querySelector(".hr-content .alert");
    if (alertEl) showToast(alertEl.textContent.trim());
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str || "";
    return div.innerHTML;
  }

  /* ---------------------------------------------------------
     Search + Filters
  --------------------------------------------------------- */
  function initTableFilters() {
    var table = document.getElementById("hrRxTable");
    if (!table) return;
    var tbody = table.querySelector("tbody");
    var rows = Array.prototype.slice.call(tbody.querySelectorAll("tr[data-rx-id]"));

    var searchInput = document.getElementById("hrRxSearch");
    var statusSelect = document.getElementById("hrRxFilterStatus");
    var dateInput = document.getElementById("hrRxFilterDate");
    var resetBtn = document.getElementById("hrRxResetFilters");

    function applyFilters() {
      var term = searchInput ? searchInput.value.trim().toLowerCase() : "";
      var statusVal = statusSelect ? statusSelect.value.toLowerCase() : "";
      var dateVal = dateInput ? dateInput.value : "";

      var visibleCount = 0;

      rows.forEach(function (row) {
        var patient = (row.getAttribute("data-patient-name") || "").toLowerCase();
        var code = (row.getAttribute("data-patient-code") || "").toLowerCase();
        var diagnosis = (row.getAttribute("data-diagnosis") || "").toLowerCase();
        var status = (row.getAttribute("data-status") || "").toLowerCase();
        var rowDate = row.getAttribute("data-generated-date") || "";

        var matchesTerm =
          !term ||
          patient.indexOf(term) !== -1 ||
          code.indexOf(term) !== -1 ||
          diagnosis.indexOf(term) !== -1;

        var matchesStatus = !statusVal || status === statusVal;
        var matchesDate = !dateVal || rowDate === dateVal;

        var show = matchesTerm && matchesStatus && matchesDate;
        row.style.display = show ? "" : "none";
        if (show) visibleCount++;
      });

      var infoEl = document.getElementById("hrRxPaginationInfo");
      if (infoEl) {
        infoEl.textContent = visibleCount + " of " + rows.length + " prescription(s) shown";
      }
    }

    if (searchInput) searchInput.addEventListener("input", applyFilters);
    if (statusSelect) statusSelect.addEventListener("change", applyFilters);
    if (dateInput) dateInput.addEventListener("change", applyFilters);
    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        if (searchInput) searchInput.value = "";
        if (statusSelect) statusSelect.value = "";
        if (dateInput) dateInput.value = "";
        applyFilters();
      });
    }

    applyFilters();
  }

  /* ---------------------------------------------------------
     View modal
  --------------------------------------------------------- */
  function buildDetailRow(label, value) {
    return (
      '<div class="hr-rx-detail-row">' +
      '<span class="hr-rx-detail-label">' + label + "</span>" +
      '<span class="hr-rx-detail-value">' + (value || "—") + "</span>" +
      "</div>"
    );
  }

  function rowToDetails(row) {
    return {
      patientName: row.getAttribute("data-patient-name") || "-",
      patientCode: row.getAttribute("data-patient-code") || "",
      diagnosis: row.getAttribute("data-diagnosis") || "",
      medicines: row.getAttribute("data-medicines") || "",
      dosage: row.getAttribute("data-dosage") || "",
      instructions: row.getAttribute("data-instructions") || "",
      date: row.getAttribute("data-date") || "",
      status: row.getAttribute("data-status-label") || ""
    };
  }

  function renderMedPills(medicines) {
    return medicines
      .split(",")
      .map(function (m) { return m.trim(); })
      .filter(Boolean)
      .map(function (m) { return '<span class="hr-rx-med-pill">' + escapeHtml(m) + "</span>"; })
      .join("");
  }

  var currentRowForModal = null;

  function initViewModal() {
    var modalEl = document.getElementById("hrRxViewModal");
    if (!modalEl || typeof bootstrap === "undefined") return;
    var modal = new bootstrap.Modal(modalEl);
    var headerEl = document.getElementById("hrRxViewHeader");
    var bodyEl = document.getElementById("hrRxViewBody");

    document.querySelectorAll('[data-action="view"]').forEach(function (btn) {
      btn.addEventListener("click", function () {
        var row = btn.closest("tr");
        if (!row) return;
        currentRowForModal = row;
        var d = rowToDetails(row);

        var initials = d.patientName
          .split(" ")
          .map(function (p) { return p.charAt(0); })
          .join("")
          .slice(0, 2)
          .toUpperCase();

        headerEl.innerHTML =
          '<div class="hr-person-avatar" style="background:var(--hr-primary)">' + escapeHtml(initials) + "</div>" +
          "<div>" +
          '<div class="hr-rx-header-title">' + escapeHtml(d.patientName) + "</div>" +
          '<div class="hr-rx-header-sub">' + (d.patientCode ? "Code: " + escapeHtml(d.patientCode) : "") + "</div>" +
          "</div>";

        bodyEl.innerHTML =
          buildDetailRow("Diagnosis", escapeHtml(d.diagnosis)) +
          buildDetailRow("Dosage", escapeHtml(d.dosage)) +
          buildDetailRow("Date", escapeHtml(d.date)) +
          buildDetailRow("Status", escapeHtml(d.status)) +
          '<div class="hr-rx-detail-row" style="align-items:flex-start;">' +
          '<span class="hr-rx-detail-label">Medicines</span>' +
          '<div class="hr-rx-med-pills" style="justify-content:flex-end;">' + (renderMedPills(d.medicines) || "—") + "</div>" +
          "</div>" +
          (d.instructions
            ? '<div class="hr-rx-detail-row" style="align-items:flex-start;">' +
              '<span class="hr-rx-detail-label">Instructions</span>' +
              '<span class="hr-rx-detail-value">' + escapeHtml(d.instructions) + "</span>" +
              "</div>"
            : "");

        modal.show();
      });
    });
  }

  /* ---------------------------------------------------------
     Print
  --------------------------------------------------------- */
  function printRow(row) {
    if (!row) return;
    var d = rowToDetails(row);

    document.getElementById("hrRxPrintDate").textContent = "Printed: " + new Date().toLocaleDateString();

    document.getElementById("hrRxPrintBody").innerHTML =
      buildDetailRow("Patient", escapeHtml(d.patientName) + (d.patientCode ? " (" + escapeHtml(d.patientCode) + ")" : "")) +
      buildDetailRow("Diagnosis", escapeHtml(d.diagnosis)) +
      buildDetailRow("Dosage", escapeHtml(d.dosage)) +
      buildDetailRow("Date", escapeHtml(d.date)) +
      buildDetailRow("Status", escapeHtml(d.status)) +
      '<div class="hr-rx-detail-row" style="align-items:flex-start;">' +
      '<span class="hr-rx-detail-label">Medicines</span>' +
      '<div class="hr-rx-med-pills" style="justify-content:flex-end;">' + (renderMedPills(d.medicines) || "—") + "</div>" +
      "</div>" +
      (d.instructions
        ? '<div class="hr-rx-detail-row" style="align-items:flex-start;">' +
          '<span class="hr-rx-detail-label">Instructions</span>' +
          '<span class="hr-rx-detail-value">' + escapeHtml(d.instructions) + "</span>" +
          "</div>"
        : "");

    document.body.classList.add("hr-rx-printing");
    window.print();
  }

  function initPrint() {
    document.querySelectorAll('[data-action="print"]').forEach(function (btn) {
      btn.addEventListener("click", function () {
        var row = btn.closest("tr");
        printRow(row);
      });
    });

    var modalPrintBtn = document.getElementById("hrRxViewPrintBtn");
    if (modalPrintBtn) {
      modalPrintBtn.addEventListener("click", function () {
        printRow(currentRowForModal);
      });
    }

    window.addEventListener("afterprint", function () {
      document.body.classList.remove("hr-rx-printing");
    });
  }

  /* ---------------------------------------------------------
     Add Notes modal — reuses prescription.prescription_edit
     endpoint, so every required form field is included as a
     hidden input pre-filled from the row's existing values.
  --------------------------------------------------------- */
  function initNotesModal() {
    var modalEl = document.getElementById("hrRxNotesModal");
    var form = document.getElementById("hrRxNotesForm");
    if (!modalEl || !form || typeof bootstrap === "undefined") return;
    var modal = new bootstrap.Modal(modalEl);

    document.querySelectorAll('[data-action="notes"]').forEach(function (btn) {
      btn.addEventListener("click", function () {
        var row = btn.closest("tr");
        if (!row) return;

        var editUrl = row.getAttribute("data-edit-url");
        if (editUrl) form.setAttribute("action", editUrl);

        document.getElementById("hrRxNotesPatientId").value = row.getAttribute("data-patient-id") || "";
        document.getElementById("hrRxNotesDoctorId").value = row.getAttribute("data-doctor-id") || "";
        document.getElementById("hrRxNotesDiagnosis").value = row.getAttribute("data-diagnosis") || "";
        document.getElementById("hrRxNotesMedicines").value = row.getAttribute("data-medicines") || "";
        document.getElementById("hrRxNotesDosage").value = row.getAttribute("data-dosage") || "";
        document.getElementById("hrRxNotesStatus").value = row.getAttribute("data-status-label") || "Active";
        document.getElementById("hrRxNotesInstructions").value = row.getAttribute("data-instructions") || "";

        modal.show();
      });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initSidebar();
    initTheme();
    initFlashToast();
    initTableFilters();
    initViewModal();
    initPrint();
    initNotesModal();
  });
})();