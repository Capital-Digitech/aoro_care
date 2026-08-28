/* =========================================================
   HEALTH RING — Prescription Management (Admin)
   Vanilla JavaScript. No jQuery.
   Implements: sidebar toggle, theme toggle, search, filters,
   view modal, delete confirm, toast.
   ========================================================= */
(function () {
  "use strict";

  var CSRF_TOKEN = (function () {
    var meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute("content") : "";
  })();

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

    if (overlay) {
      overlay.addEventListener("click", closeSidebar);
    }
  }

  /* ---------------------------------------------------------
     Theme toggle (light / dark) — persists for this session
  --------------------------------------------------------- */
  function initTheme() {
    var themeBtn = document.getElementById("hrThemeToggle");
    if (!themeBtn) return;

    var html = document.documentElement;

    var stored = null;
    try {
      stored = sessionStorage.getItem("hrTheme");
    } catch (e) {
      stored = null;
    }
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
    if (alertEl) {
      showToast(alertEl.textContent.trim());
    }
  }

  /* ---------------------------------------------------------
     Search + Filters (client-side, over the rendered table)
  --------------------------------------------------------- */
  function initTableFilters() {
    var table = document.getElementById("hrRxTable");
    if (!table) return;
    var tbody = table.querySelector("tbody");
    var rows = Array.prototype.slice.call(
      tbody.querySelectorAll("tr[data-rx-id]")
    );

    var searchInput = document.getElementById("hrRxSearch");
    var doctorSelect = document.getElementById("hrRxFilterDoctor");
    var statusSelect = document.getElementById("hrRxFilterStatus");
    var resetBtn = document.getElementById("hrRxResetFilters");

    function applyFilters() {
      var term = searchInput ? searchInput.value.trim().toLowerCase() : "";
      var doctorVal = doctorSelect ? doctorSelect.value.toLowerCase() : "";
      var statusVal = statusSelect ? statusSelect.value.toLowerCase() : "";

      var visibleCount = 0;

      rows.forEach(function (row) {
        var patient = (row.getAttribute("data-patient-name") || "").toLowerCase();
        var code = (row.getAttribute("data-patient-code") || "").toLowerCase();
        var diagnosis = (row.getAttribute("data-diagnosis") || "").toLowerCase();
        var doctorName = (row.getAttribute("data-doctor-name") || "").toLowerCase();
        var status = (row.getAttribute("data-status") || "").toLowerCase();

        var matchesTerm =
          !term ||
          patient.indexOf(term) !== -1 ||
          code.indexOf(term) !== -1 ||
          diagnosis.indexOf(term) !== -1;

        var matchesDoctor = !doctorVal || doctorName.indexOf(doctorVal) !== -1;
        var matchesStatus = !statusVal || status === statusVal;

        var show = matchesTerm && matchesDoctor && matchesStatus;
        row.style.display = show ? "" : "none";
        if (show) visibleCount++;
      });

      var infoEl = document.getElementById("hrRxPaginationInfo");
      if (infoEl) {
        infoEl.textContent = visibleCount + " of " + rows.length + " prescription(s) shown";
      }
    }

    if (searchInput) searchInput.addEventListener("input", applyFilters);
    if (doctorSelect) doctorSelect.addEventListener("change", applyFilters);
    if (statusSelect) statusSelect.addEventListener("change", applyFilters);
    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        if (searchInput) searchInput.value = "";
        if (doctorSelect) doctorSelect.value = "";
        if (statusSelect) statusSelect.value = "";
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

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str || "";
    return div.innerHTML;
  }

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

        var patientName = row.getAttribute("data-patient-name") || "-";
        var patientCode = row.getAttribute("data-patient-code") || "";
        var doctorName = row.getAttribute("data-doctor-name") || "-";
        var diagnosis = row.getAttribute("data-diagnosis") || "";
        var medicines = row.getAttribute("data-medicines") || "";
        var dosage = row.getAttribute("data-dosage") || "";
        var instructions = row.getAttribute("data-instructions") || "";
        var date = row.getAttribute("data-date") || "";
        var status = row.getAttribute("data-status-label") || "";

        var initials = patientName
          .split(" ")
          .map(function (p) { return p.charAt(0); })
          .join("")
          .slice(0, 2)
          .toUpperCase();

        headerEl.innerHTML =
          '<div class="hr-person-avatar" style="background:var(--hr-primary)">' + escapeHtml(initials) + "</div>" +
          "<div>" +
          '<div class="hr-rx-header-title">' + escapeHtml(patientName) + "</div>" +
          '<div class="hr-rx-header-sub">' + (patientCode ? "Code: " + escapeHtml(patientCode) : "") + "</div>" +
          "</div>";

        var medPills = medicines
          .split(",")
          .map(function (m) { return m.trim(); })
          .filter(Boolean)
          .map(function (m) {
            return '<span class="hr-rx-med-pill">' + escapeHtml(m) + "</span>";
          })
          .join("");

        bodyEl.innerHTML =
          buildDetailRow("Doctor", escapeHtml(doctorName)) +
          buildDetailRow("Diagnosis", escapeHtml(diagnosis)) +
          buildDetailRow("Dosage", escapeHtml(dosage)) +
          buildDetailRow("Date", escapeHtml(date)) +
          buildDetailRow("Status", escapeHtml(status)) +
          '<div class="hr-rx-detail-row" style="align-items:flex-start;">' +
          '<span class="hr-rx-detail-label">Medicines</span>' +
          '<div class="hr-rx-med-pills" style="justify-content:flex-end;">' + (medPills || "—") + "</div>" +
          "</div>" +
          (instructions
            ? '<div class="hr-rx-detail-row" style="align-items:flex-start;">' +
              '<span class="hr-rx-detail-label">Instructions</span>' +
              '<span class="hr-rx-detail-value">' + escapeHtml(instructions) + "</span>" +
              "</div>"
            : "");

        modal.show();
      });
    });
  }

  /* ---------------------------------------------------------
     Delete confirm — submits the hidden delete form
  --------------------------------------------------------- */
  function initDelete() {
    var deleteForm = document.getElementById("hrRxDeleteForm");
    if (!deleteForm) return;

    document.querySelectorAll('[data-action="delete"]').forEach(function (btn) {
      btn.addEventListener("click", function () {
        var row = btn.closest("tr");
        if (!row) return;
        var url = row.getAttribute("data-delete-url");
        var patientName = row.getAttribute("data-patient-name") || "this patient";
        if (!url) return;

        var confirmed = window.confirm(
          "Delete the prescription for " + patientName + "? This cannot be undone."
        );
        if (!confirmed) return;

        deleteForm.setAttribute("action", url);
        deleteForm.submit();
      });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initSidebar();
    initTheme();
    initFlashToast();
    initTableFilters();
    initViewModal();
    initDelete();
  });
})();