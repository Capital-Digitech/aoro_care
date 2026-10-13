/* =========================================================
   AORO CARE — Patient Medical Reports
   Page-specific behaviour. Load AFTER patient_dashboard.js.

   Replaces the old inline search script. Keeps the same
   element IDs and data attributes:
     #reportSearch, #reportList, #reportSearchEmpty,
     .hr-report-row[data-search]
   and adds type / file / date filters with a Reset button.

   View and Download are plain links to the existing
   pages.view_medical_report endpoint — no JS involved.
   ========================================================= */
(function () {
  'use strict';

  function byId(id) { return document.getElementById(id); }

  function init() {
    var searchInput = byId('reportSearch');
    var reportList = byId('reportList');
    var emptyState = byId('reportSearchEmpty');

    // Nothing to filter (no reports, so the toolbar isn't rendered).
    if (!searchInput || !reportList) { return; }

    var typeSelect = byId('hrFilterType');
    var fileSelect = byId('hrFilterFile');
    var dateInput = byId('hrFilterDate');
    var resetBtn = byId('hrResetFilters');
    var countEl = byId('hrReportCount');

    var rows = Array.prototype.slice.call(
      reportList.querySelectorAll('.hr-report-row')
    );

    function applyFilters() {
      var query = searchInput.value.trim().toLowerCase();
      var type = typeSelect ? typeSelect.value : '';
      var file = fileSelect ? fileSelect.value : '';
      var date = dateInput ? dateInput.value : '';
      var visible = 0;

      rows.forEach(function (row) {
        var matches = true;

        if (query && (row.dataset.search || '').indexOf(query) === -1) {
          matches = false;
        }
        if (matches && type && row.dataset.type !== type) {
          matches = false;
        }
        if (matches && file && row.dataset.file !== file) {
          matches = false;
        }
        if (matches && date && row.dataset.date !== date) {
          matches = false;
        }

        row.hidden = !matches;
        if (matches) { visible += 1; }
      });

      if (countEl) { countEl.textContent = visible; }
      if (emptyState) { emptyState.hidden = visible !== 0; }
    }

    searchInput.addEventListener('input', applyFilters);
    if (typeSelect) { typeSelect.addEventListener('change', applyFilters); }
    if (fileSelect) { fileSelect.addEventListener('change', applyFilters); }
    if (dateInput) {
      dateInput.addEventListener('change', applyFilters);
      dateInput.addEventListener('input', applyFilters);
    }
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        searchInput.value = '';
        if (typeSelect) { typeSelect.value = ''; }
        if (fileSelect) { fileSelect.value = ''; }
        if (dateInput) { dateInput.value = ''; }
        applyFilters();
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();