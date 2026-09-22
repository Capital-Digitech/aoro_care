/* =========================================================
   HEALTH RING — Emergency Alert Management Behavior
   Sidebar/theme reuse admin_dashboard.js if loaded globally;
   this file only adds page-specific behavior.
   Same coding style as ring_management.js / patient_management.js.
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {
  initSidebarToggle();
  initThemeToggle();
  initGlobalSearch();
  initTableSearchFilter();
  initViewModal();
  initDeleteModal();
  initFormValidation();
  initPagination();
  initExport();
});

/* ---------------------------------------------------------
   Sidebar toggle (mobile / tablet) — same behavior as dashboard
--------------------------------------------------------- */
function initSidebarToggle(){
  const sidebar = document.getElementById('hrSidebar');
  const toggle  = document.getElementById('hrSidebarToggle');
  const overlay = document.getElementById('hrOverlay');
  if(!sidebar || !toggle || !overlay) return;

  const open  = () => { sidebar.classList.add('show'); overlay.classList.add('show'); };
  const close = () => { sidebar.classList.remove('show'); overlay.classList.remove('show'); };

  toggle.addEventListener('click', () => {
    sidebar.classList.contains('show') ? close() : open();
  });
  overlay.addEventListener('click', close);

  window.addEventListener('resize', () => {
    if(window.innerWidth > 1199.98) close();
  });
}

/* ---------------------------------------------------------
   Dark mode toggle (persisted) — same key as dashboard
--------------------------------------------------------- */
function initThemeToggle(){
  const btn  = document.getElementById('hrThemeToggle');
  const html = document.documentElement;
  if(!btn) return;

  const saved = localStorage.getItem('hr-admin-theme');
  if(saved) setTheme(saved);

  btn.addEventListener('click', () => {
    const current = html.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    setTheme(current === 'dark' ? 'light' : 'dark');
  });

  function setTheme(mode){
    html.setAttribute('data-theme', mode);
    localStorage.setItem('hr-admin-theme', mode);
    const icon = btn.querySelector('i');
    if(icon) icon.className = mode === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
  }
}

/* ---------------------------------------------------------
   Common/global admin search (topbar) — searches the existing
   sidebar navigation (Dashboard, Hospital/Doctor/Patient
   Management, Family, Health Rings, Health Data, Appointments,
   Reports, Emergency Alerts, Prescriptions, Notifications,
   AI Insights, Settings, plus super-admin-only items when
   visible) and navigates to the matching existing route.
   Not alert-table-specific — see initTableSearchFilter for that.
--------------------------------------------------------- */
function initGlobalSearch(){
  const wrap    = document.getElementById('hrGlobalSearch');
  const input   = document.getElementById('hrGlobalSearchInput');
  const results = document.getElementById('hrGlobalSearchResults');
  if(!wrap || !input || !results) return;

  // Built from the sidebar itself, so every admin module already
  // in the nav is searchable with no hardcoded list to maintain,
  // and super-admin-only items are included only when rendered.
  const navItems = Array.from(document.querySelectorAll('.hr-sidebar .hr-nav-item'))
    .map(link => ({
      label: link.textContent.replace(/\s+/g, ' ').trim(),
      href: link.getAttribute('href'),
      icon: link.querySelector('i')?.className || 'fa-solid fa-arrow-right'
    }))
    .filter(item => item.href && item.href !== '#');

  function render(matches){
    if(!matches.length){
      results.innerHTML = '<div class="hr-global-search-empty">No matching pages found</div>';
    } else {
      results.innerHTML = matches.map(m => `
        <a class="hr-global-search-item" href="${m.href}">
          <i class="${m.icon}"></i><span>${m.label}</span>
        </a>
      `).join('');
    }
    results.classList.add('show');
  }

  function close(){
    results.classList.remove('show');
    results.innerHTML = '';
  }

  input.addEventListener('input', () => {
    const term = input.value.trim().toLowerCase();
    if(!term){ close(); return; }
    render(navItems.filter(item => item.label.toLowerCase().includes(term)));
  });

  input.addEventListener('focus', () => {
    if(input.value.trim()) input.dispatchEvent(new Event('input'));
  });

  input.addEventListener('keydown', (e) => {
    if(e.key === 'Escape') close();
  });

  document.addEventListener('click', (e) => {
    if(!wrap.contains(e.target)) close();
  });
}

/* ---------------------------------------------------------
   Page-specific search (#hrAlertSearch) + severity/status/
   alert-type filters over rendered rows. Pure UI filter —
   does not touch server pagination/query logic. Kept
   separate from the topbar global search above.

   The search matches against each row's full visible text
   (row.textContent), which already covers every column
   rendered in the table — Patient, Patient Code (shown under
   the patient name), Health Ring, Alert Type, Severity, Heart
   Rate, SpO2, Location, Status and Raised At — so no column
   is missed. Search and the three dropdown filters combine
   with AND logic, and Reset clears all four back to "show
   everything".
--------------------------------------------------------- */
function initTableSearchFilter(){
  const searchInput = document.getElementById('hrAlertSearch');
  const severityFilter = document.getElementById('hrFilterSeverity');
  const statusFilter = document.getElementById('hrFilterStatus');
  const typeFilter = document.getElementById('hrFilterAlertType');
  const resetBtn = document.getElementById('hrResetFilters');
  const table = document.getElementById('hrAlertTable');
  if(!table) return;

  const getRows = () => Array.from(table.querySelectorAll('tbody tr'))
    .filter(r => r.id !== 'hrEmptyRow' && r.id !== 'hrDynamicEmptyRow');

  function applyFilters(){
    const term = (searchInput?.value || '').trim().toLowerCase();
    const severity = severityFilter?.value || '';
    const status = statusFilter?.value || '';
    const type = typeFilter?.value || '';
    const rows = getRows();
    let visibleCount = 0;

    rows.forEach(row => {
      const text = row.textContent.toLowerCase();
      const matchesSearch = !term || text.includes(term);

      const rowSeverity = row.getAttribute('data-severity') || '';
      const matchesSeverity = !severity || rowSeverity === severity;

      const rowStatus = row.getAttribute('data-status') || '';
      const matchesStatus = !status || rowStatus === status;

      const rowType = row.getAttribute('data-alert-type') || '';
      const matchesType = !type || rowType === type;

      const show = matchesSearch && matchesSeverity && matchesStatus && matchesType;
      row.style.display = show ? '' : 'none';
      if(show) visibleCount++;
    });

    toggleEmptyState(visibleCount === 0);
  }

  function toggleEmptyState(isEmpty){
    let emptyRow = table.querySelector('#hrDynamicEmptyRow');
    if(isEmpty){
      if(!emptyRow){
        emptyRow = document.createElement('tr');
        emptyRow.id = 'hrDynamicEmptyRow';
        emptyRow.innerHTML = `
          <td colspan="10">
            <div class="hr-empty-state">
              <div class="hr-empty-icon"><i class="fa-solid fa-magnifying-glass"></i></div>
              <h4>No matching emergency alerts</h4>
              <p>Try adjusting your search or filters.</p>
            </div>
          </td>`;
        table.querySelector('tbody').appendChild(emptyRow);
      }
    } else if(emptyRow){
      emptyRow.remove();
    }
  }

  searchInput?.addEventListener('input', applyFilters);
  severityFilter?.addEventListener('change', applyFilters);
  statusFilter?.addEventListener('change', applyFilters);
  typeFilter?.addEventListener('change', applyFilters);
  resetBtn?.addEventListener('click', () => {
    if(searchInput) searchInput.value = '';
    if(severityFilter) severityFilter.value = '';
    if(statusFilter) statusFilter.value = '';
    if(typeFilter) typeFilter.value = '';
    applyFilters();
  });
}

/* ---------------------------------------------------------
   View modal (read-only) — populates the alert detail modal
   from the triggering row's data-* attributes. No extra
   backend call; reuses data already rendered in the table.
--------------------------------------------------------- */
function initViewModal(){
  const modal = document.getElementById('hrViewModal');
  if(!modal) return;

  modal.addEventListener('show.bs.modal', (event) => {
    const trigger = event.relatedTarget;
    const row = trigger?.closest('tr');
    if(!row) return;

    const d = row.dataset;
    setText('hrViewPatientName', d.patientName);
    setText('hrViewPatientCode', d.patientCode);
    setText('hrViewRing', d.ringSerial);
    setText('hrViewAlertType', d.alertTypeLabel);
    setText('hrViewSeverity', d.severityLabel);
    setText('hrViewStatus', d.statusLabel);
    setText('hrViewHeartRate', d.heartRate ? `${d.heartRate} bpm` : '');
    setText('hrViewSpo2', d.spo2 ? `${d.spo2}%` : '');
    setText('hrViewLatitude', d.latitude);
    setText('hrViewLongitude', d.longitude);
    setText('hrViewRaisedAt', d.raisedAt);
    setText('hrViewMessage', d.message);
  });

  function setText(id, value){
    const el = document.getElementById(id);
    if(el) el.textContent = value && String(value).trim() ? value : '-';
  }
}

/* ---------------------------------------------------------
   Delete confirmation modal — wires the row's data attributes
   into the confirm dialog and its existing delete form action.
   Uses the existing backend route at
   /emergency-alert/delete/<id> — no backend changes made.
--------------------------------------------------------- */
function initDeleteModal(){
  const modal = document.getElementById('hrDeleteModal');
  if(!modal) return;

  modal.addEventListener('show.bs.modal', (event) => {
    const trigger = event.relatedTarget;
    if(!trigger) return;

    const alertId = trigger.getAttribute('data-alert-id');
    const alertName = trigger.getAttribute('data-alert-name');

    const nameEl = document.getElementById('hrDeleteAlertName');
    const form = document.getElementById('hrDeleteForm');

    if(nameEl) nameEl.textContent = alertName || 'this emergency alert';
    if(form && alertId){
      form.action = `/emergency-alert/delete/${alertId}`;
    }
  });
}

/* ---------------------------------------------------------
   Floating-label form validation (client-side UX only —
   server-side validation in Flask remains the source of truth)
--------------------------------------------------------- */
function initFormValidation(){
  const form = document.getElementById('hrAlertForm');
  if(!form) return;

  form.addEventListener('submit', (e) => {
    let valid = true;
    form.querySelectorAll('[required]').forEach(field => {
      const wrapper = field.closest('.hr-field');
      if(!wrapper) return;
      const filled = field.value && field.value.trim().length > 0;
      wrapper.classList.toggle('is-invalid', !filled);
      wrapper.classList.toggle('is-valid', !!filled);
      if(!filled) valid = false;
    });
    if(!valid) e.preventDefault();
  });

  // Keep select "floating label" styling in sync
  form.querySelectorAll('select').forEach(select => {
    const sync = () => select.classList.toggle('hr-has-value', !!select.value);
    select.addEventListener('change', sync);
    sync();
  });
}

/* ---------------------------------------------------------
   Pagination — visual only; wire hrPageBtn clicks to your
   Flask pagination (e.g. ?page=N) when ready.
--------------------------------------------------------- */
function initPagination(){
  const buttons = document.querySelectorAll('.hr-page-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      if(btn.disabled || btn.classList.contains('active')) return;
      buttons.forEach(b => b.classList.remove('active'));
      if(/^\d+$/.test(btn.textContent.trim())){
        btn.classList.add('active');
      }
    });
  });
}

/* ---------------------------------------------------------
   Excel Export — builds a real .xlsx (via SheetJS) from the
   currently visible/filtered rows only. Reads directly from
   each row's data-* attributes (already populated server-side),
   so it stays in sync with whatever the page search + severity/
   status/alert-type filters have left visible. No backend route.
--------------------------------------------------------- */
function initExport(){
  const btn = document.getElementById('hrExportBtn');
  const table = document.getElementById('hrAlertTable');
  if(!btn || !table) return;

  btn.addEventListener('click', () => {
    if(typeof XLSX === 'undefined'){
      showToast('Export library failed to load.', 'error');
      return;
    }

    const rows = Array.from(table.querySelectorAll('tbody tr'))
      .filter(r => r.id !== 'hrEmptyRow' && r.id !== 'hrDynamicEmptyRow')
      .filter(r => r.style.display !== 'none');

    if(!rows.length){
      showToast('No emergency alerts to export.', 'error');
      return;
    }

    const headers = [
      'Patient', 'Patient Code', 'Health Ring', 'Alert Type', 'Severity',
      'Heart Rate', 'SpO2', 'Location', 'Status', 'Raised At', 'Message'
    ];

    const data = rows.map(row => {
      const d = row.dataset;
      const location = (d.latitude && d.longitude) ? `${d.latitude}, ${d.longitude}` : '';
      return [
        d.patientName || '',
        d.patientCode || '',
        d.ringSerial || '',
        d.alertTypeLabel || '',
        d.severityLabel || '',
        d.heartRate || '',
        d.spo2 || '',
        location,
        d.statusLabel || '',
        d.raisedAt || '',
        d.message || ''
      ];
    });

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...data]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Emergency Alerts');
    XLSX.writeFile(workbook, 'health_ring_emergency_alerts.xlsx');

    showToast('Emergency alerts exported successfully.');
  });
}

/* ---------------------------------------------------------
   CSRF helper — kept for any future AJAX added to this page;
   Add Emergency Alert still submits via normal POST with the
   hidden csrf_token field already in the DOM.
--------------------------------------------------------- */
function getCsrfToken(){
  const input = document.querySelector('input[name="csrf_token"]');
  return input ? input.value : '';
}

function hrFetch(url, options = {}){
  const token = getCsrfToken();
  const headers = Object.assign({}, options.headers, token ? { 'X-CSRFToken': token } : {});
  return fetch(url, Object.assign({}, options, { headers }));
}

/* ---------------------------------------------------------
   Toast helper — call showToast('Saved!', 'success' | 'error')
--------------------------------------------------------- */
function showToast(message, type = 'success'){
  const toast = document.getElementById('hrToast');
  const text = document.getElementById('hrToastText');
  const icon = toast?.querySelector('.hr-toast-icon');
  if(!toast || !text) return;

  text.textContent = message;
  if(icon){
    icon.className = 'hr-toast-icon ' + (type === 'success' ? 'hr-bg-green' : 'hr-bg-red');
    icon.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-check' : 'fa-xmark'}"></i>`;
  }
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3200);
}