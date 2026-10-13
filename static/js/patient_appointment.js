/* =========================================================
   AORO CARE — Patient Appointments
   Page-specific behaviour. Load AFTER patient_dashboard.js.

   1. View-appointment modal: fills #hrView* fields from the
      data-* attributes of the clicked .hr-view-appt-btn.
   2. Cancel confirmation for forms carrying data-confirm.
   3. Client-side search / status / date filtering across the
      Pending, Upcoming and History tables.

   No backend calls are made here — the cancel and request
   forms still submit normally to their Flask endpoints.
   ========================================================= */
(function () {
  'use strict';

  function byId(id) { return document.getElementById(id); }

  function setText(id, value, fallback) {
    var el = byId(id);
    if (el) { el.textContent = value || fallback; }
  }

  /* -------------------------------------------------------
     1. VIEW MODAL
  ------------------------------------------------------- */
  function fillViewModal(btn) {
    if (!btn) { return; }
    var d = btn.dataset;

    setText('hrViewDoctor', d.doctor, '--');
    setText('hrViewSpecialization', d.specialization, '--');
    setText('hrViewDate', d.date, '--');
    setText('hrViewTime', d.time, '--');
    setText('hrViewHospital', d.hospital, '--');
    setText('hrViewType', d.type, '--');
    setText('hrViewStatus', d.status, '--');
    setText('hrViewReason', d.reason, 'No purpose specified.');

    var linkEl = byId('hrViewLink');
    if (linkEl) {
      if (d.link) {
        linkEl.href = d.link;
        linkEl.style.display = 'block';
      } else {
        linkEl.removeAttribute('href');
        linkEl.style.display = 'none';
      }
    }
  }

  function initViewModal() {
    var modalEl = byId('hrViewModal');

    // Primary path: Bootstrap tells us which button opened the modal.
    if (modalEl) {
      modalEl.addEventListener('show.bs.modal', function (event) {
        var trigger = event.relatedTarget;
        if (trigger && trigger.closest) {
          fillViewModal(trigger.closest('.hr-view-appt-btn'));
        }
      });
    }

    // Fallback: also fill on click, in case relatedTarget is unavailable.
    document.addEventListener('click', function (event) {
      var btn = event.target.closest ? event.target.closest('.hr-view-appt-btn') : null;
      if (btn) { fillViewModal(btn); }
    });
  }

  /* -------------------------------------------------------
     2. CANCEL CONFIRMATION
  ------------------------------------------------------- */
  function initConfirmForms() {
    document.addEventListener('submit', function (event) {
      var form = event.target;
      if (!form || !form.hasAttribute || !form.hasAttribute('data-confirm')) { return; }
      var message = form.getAttribute('data-confirm') || 'Are you sure?';
      if (!window.confirm(message)) {
        event.preventDefault();
      }
    });
  }

  /* -------------------------------------------------------
     3. SEARCH + FILTERS
  ------------------------------------------------------- */
  function initFilters() {
    var searchInput = byId('hrAppointmentSearch');
    var statusSelect = byId('hrFilterStatus');
    var dateInput = byId('hrFilterDate');
    var resetBtn = byId('hrResetFilters');

    var sections = document.querySelectorAll('[data-pa-section]');
    if (!sections.length) { return; }

    function applyFilters() {
      var query = searchInput ? searchInput.value.trim().toLowerCase() : '';
      var status = statusSelect ? statusSelect.value : '';
      var date = dateInput ? dateInput.value : '';

      Array.prototype.forEach.call(sections, function (section) {
        var rows = section.querySelectorAll('.pa-row');
        var visible = 0;

        Array.prototype.forEach.call(rows, function (row) {
          var matches = true;

          if (query && (row.getAttribute('data-search') || '').indexOf(query) === -1) {
            matches = false;
          }
          if (matches && status && row.getAttribute('data-status') !== status) {
            matches = false;
          }
          if (matches && date && row.getAttribute('data-date') !== date) {
            matches = false;
          }

          row.hidden = !matches;
          if (matches) { visible += 1; }
        });

        var counter = section.querySelector('[data-pa-count]');
        if (counter) { counter.textContent = visible; }

        var noMatch = section.querySelector('.pa-no-match');
        if (noMatch) { noMatch.hidden = visible > 0 || rows.length === 0; }
      });
    }

    if (searchInput) { searchInput.addEventListener('input', applyFilters); }
    if (statusSelect) { statusSelect.addEventListener('change', applyFilters); }
    if (dateInput) {
      dateInput.addEventListener('change', applyFilters);
      dateInput.addEventListener('input', applyFilters);
    }
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        if (searchInput) { searchInput.value = ''; }
        if (statusSelect) { statusSelect.value = ''; }
        if (dateInput) { dateInput.value = ''; }
        applyFilters();
      });
    }
  }

  /* -------------------------------------------------------
     INIT
  ------------------------------------------------------- */
  function init() {
    initViewModal();
    initConfirmForms();
    initFilters();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();