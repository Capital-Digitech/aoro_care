/* =========================================================
   HEALTH RING — Doctor Emergency Alerts Behavior
   Same structure as doctor_appointment.js: sidebar/theme
   toggle, search/filter, AJAX status actions, modals, toast.
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {
  initSidebarToggle();
  initThemeToggle();
  initTableSearchFilter();
  initRowActionHandlers();
  initAcknowledgeModal();
  initResolveModal();
});

/* ---------------------------------------------------------
   CSRF helper — reads the token from the page's meta tag and
   attaches it to every AJAX request as required by Flask-WTF.
--------------------------------------------------------- */
function getCsrfToken(){
  const meta = document.querySelector('meta[name="csrf-token"]');
  return meta ? meta.getAttribute('content') : '';
}

async function postForm(url, formData){
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'X-CSRFToken': getCsrfToken() },
    body: formData,
    credentials: 'same-origin'
  });

  let payload = null;
  try{ payload = await response.json(); }catch(err){ /* non-JSON error page */ }

  if(!response.ok){
    const message = (payload && payload.description) || 'Request failed. Please try again.';
    throw new Error(message);
  }
  return payload;
}

/* ---------------------------------------------------------
   Sidebar toggle (mobile / tablet)
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
   Dark mode toggle (persisted — same key as doctor_appointment.js
   and doctor_dashboard.js, so theme stays in sync across the portal)
--------------------------------------------------------- */
function initThemeToggle(){
  const btn  = document.getElementById('hrThemeToggle');
  const html = document.documentElement;
  if(!btn) return;

  const saved = localStorage.getItem('hr-doctor-theme');
  if(saved) setTheme(saved);

  btn.addEventListener('click', () => {
    const current = html.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    setTheme(current === 'dark' ? 'light' : 'dark');
  });

  function setTheme(mode){
    html.setAttribute('data-theme', mode);
    localStorage.setItem('hr-doctor-theme', mode);
    const icon = btn.querySelector('i');
    if(icon) icon.className = mode === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
  }
}

/* ---------------------------------------------------------
   Search + severity/status filter over rendered rows.
   Pure client-side filter — the server already scopes rows
   to the logged-in doctor's patients.
--------------------------------------------------------- */
function initTableSearchFilter(){
  const searchInput = document.getElementById('hrAlertSearch');
  const severityFilter = document.getElementById('hrFilterSeverity');
  const statusFilter = document.getElementById('hrFilterStatus');
  const resetBtn = document.getElementById('hrResetFilters');
  const table = document.getElementById('hrAlertTable');
  if(!table) return;

  const getRows = () => Array.from(table.querySelectorAll('tbody tr'))
    .filter(r => r.id !== 'hrEmptyRow' && r.id !== 'hrDynamicEmptyRow');

  function applyFilters(){
    const term = (searchInput?.value || '').trim().toLowerCase();
    const severity = severityFilter?.value || '';
    const status = statusFilter?.value || '';
    const rows = getRows();
    let visibleCount = 0;

    rows.forEach(row => {
      const text = row.textContent.toLowerCase();
      const matchesSearch = !term || text.includes(term);

      const rowSeverity = row.getAttribute('data-severity') || '';
      const matchesSeverity = !severity || rowSeverity === severity;

      const rowStatus = row.getAttribute('data-status') || '';
      const matchesStatus = !status || rowStatus === status;

      const show = matchesSearch && matchesSeverity && matchesStatus;
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
              <h4>No matching alerts</h4>
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
  resetBtn?.addEventListener('click', () => {
    if(searchInput) searchInput.value = '';
    if(severityFilter) severityFilter.value = '';
    if(statusFilter) statusFilter.value = '';
    applyFilters();
  });
}

/* ---------------------------------------------------------
   Row action handlers — View and Patient Details render from
   the row's own data attributes (no extra endpoint needed).
   Acknowledge/Resolve open their modals via data-bs-toggle and
   are wired separately below.
--------------------------------------------------------- */
function initRowActionHandlers(){
  const table = document.getElementById('hrAlertTable');
  if(!table) return;

  table.addEventListener('click', (event) => {
    const viewBtn = event.target.closest('[data-action="view"]');
    if(viewBtn) return handleView(viewBtn);

    const detailsBtn = event.target.closest('[data-action="patient-details"]');
    if(detailsBtn) return handlePatientDetails(detailsBtn);
  });
}

function handleView(button){
  const body = document.getElementById('hrViewAlertModalBody');
  const modalEl = document.getElementById('hrViewAlertModal');
  if(!body || !modalEl) return;

  const rows = [
    ['Patient', button.getAttribute('data-patient-name')],
    ['Patient Code', button.getAttribute('data-patient-code')],
    ['Emergency Type', button.getAttribute('data-emergency-type')],
    ['Heart Rate', button.getAttribute('data-heart-rate')],
    ['SpO₂', button.getAttribute('data-spo2')],
    ['Severity', button.getAttribute('data-severity')],
    ['Alert Time', button.getAttribute('data-alert-time')],
    ['Status', button.getAttribute('data-status')],
    ['Message', button.getAttribute('data-message')]
  ];

  body.innerHTML = rows.map(([label, value]) => `
    <div class="hr-detail-row">
      <span class="hr-detail-label">${label}</span>
      <span class="hr-detail-value">${escapeHtml(value || '-')}</span>
    </div>
  `).join('');

  bootstrap.Modal.getOrCreateInstance(modalEl).show();
}

function handlePatientDetails(button){
  const body = document.getElementById('hrPatientDetailsModalBody');
  const modalEl = document.getElementById('hrPatientDetailsModal');
  if(!body || !modalEl) return;

  const rows = [
    ['Patient', button.getAttribute('data-patient-name')],
    ['Patient Code', button.getAttribute('data-patient-code')]
  ];

  body.innerHTML = rows.map(([label, value]) => `
    <div class="hr-detail-row">
      <span class="hr-detail-label">${label}</span>
      <span class="hr-detail-value">${escapeHtml(value || '-')}</span>
    </div>
  `).join('');

  bootstrap.Modal.getOrCreateInstance(modalEl).show();
}

/* ---------------------------------------------------------
   Update a row's status badge and available actions in place
   after a successful action — no full page reload needed.
--------------------------------------------------------- */
function updateRowStatus(row, newStatus){
  if(!row || !newStatus) return;

  row.setAttribute('data-status', newStatus);

  const badge = row.querySelector('[data-role="status-badge"]');
  if(badge){
    const config = {
      active:       ['hr-badge-danger',  'Active'],
      acknowledged: ['hr-badge-warning', 'Acknowledged'],
      resolved:     ['hr-badge-success', 'Resolved']
    };
    const [badgeClass, label] = config[newStatus] || ['hr-badge-info', newStatus];
    badge.className = `hr-badge ${badgeClass}`;
    badge.textContent = label;
  }

  const acknowledgeBtn = row.querySelector('[data-action="acknowledge"]');
  const resolveBtn = row.querySelector('[data-action="resolve"]');

  if(acknowledgeBtn) acknowledgeBtn.classList.toggle('d-none', newStatus !== 'active');
  if(resolveBtn) resolveBtn.classList.toggle('d-none', newStatus === 'resolved');
}

function setRowBusy(row, busy){
  if(row) row.classList.toggle('hr-row-busy', busy);
}

function setButtonLoading(button, loading){
  if(!button) return;
  button.disabled = loading;
  if(loading){
    button.dataset.originalHtml = button.innerHTML;
    button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
  } else if(button.dataset.originalHtml){
    button.innerHTML = button.dataset.originalHtml;
    delete button.dataset.originalHtml;
  }
}

/* ---------------------------------------------------------
   Acknowledgement modal
   NOTE: posts to /emergency-alert/doctor/<id>/acknowledge —
   add this route to emergency_alert_bp alongside the existing
   doctor_emergency_alert_list route if it isn't there yet.
--------------------------------------------------------- */
function initAcknowledgeModal(){
  const modal = document.getElementById('hrAcknowledgeModal');
  const form = document.getElementById('hrAcknowledgeForm');
  if(!modal || !form) return;

  let activeAlertId = null;
  let activeRow = null;

  modal.addEventListener('show.bs.modal', (event) => {
    const trigger = event.relatedTarget;
    if(!trigger) return;
    activeAlertId = trigger.getAttribute('data-alert-id');
    activeRow = trigger.closest('tr');
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if(!activeAlertId) return;

    const submitBtn = form.querySelector('[type="submit"]');
    setRowBusy(activeRow, true);
    setButtonLoading(submitBtn, true);

    postForm(`/emergency-alert/doctor/${activeAlertId}/acknowledge`, new FormData(form))
      .then(data => {
        updateRowStatus(activeRow, data.status || 'acknowledged');
        showToast('Alert acknowledged.', 'success');
        bootstrap.Modal.getInstance(modal)?.hide();
      })
      .catch(err => showToast(err.message, 'error'))
      .finally(() => {
        setRowBusy(activeRow, false);
        setButtonLoading(submitBtn, false);
      });
  });
}

/* ---------------------------------------------------------
   Resolve Alert modal
   NOTE: posts to /emergency-alert/doctor/<id>/resolve — add
   this route to emergency_alert_bp alongside the existing
   doctor_emergency_alert_list route if it isn't there yet.
--------------------------------------------------------- */
function initResolveModal(){
  const modal = document.getElementById('hrResolveModal');
  const form = document.getElementById('hrResolveForm');
  if(!modal || !form) return;

  let activeAlertId = null;
  let activeRow = null;

  modal.addEventListener('show.bs.modal', (event) => {
    const trigger = event.relatedTarget;
    if(!trigger) return;
    activeAlertId = trigger.getAttribute('data-alert-id');
    activeRow = trigger.closest('tr');

    const textarea = form.querySelector('[name="resolution_notes"]');
    if(textarea) textarea.value = '';
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if(!activeAlertId) return;

    const submitBtn = form.querySelector('[type="submit"]');
    setRowBusy(activeRow, true);
    setButtonLoading(submitBtn, true);

    postForm(`/emergency-alert/doctor/${activeAlertId}/resolve`, new FormData(form))
      .then(data => {
        updateRowStatus(activeRow, data.status || 'resolved');
        showToast('Alert marked resolved.', 'success');
        bootstrap.Modal.getInstance(modal)?.hide();
      })
      .catch(err => showToast(err.message, 'error'))
      .finally(() => {
        setRowBusy(activeRow, false);
        setButtonLoading(submitBtn, false);
      });
  });
}

/* ---------------------------------------------------------
   Toast helper — showToast('message', 'success' | 'error')
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

/* ---------------------------------------------------------
   Minimal HTML escaping for text injected into modals
--------------------------------------------------------- */
function escapeHtml(value){
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}