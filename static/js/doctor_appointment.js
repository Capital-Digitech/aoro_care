/* =========================================================
   HEALTH RING — Doctor Appointment Management Behavior
   Sidebar/theme toggle reuse doctor_dashboard.js if loaded
   globally; this file only adds page-specific behavior:
   topbar search (visual only — see note below), table
   search/filter, and the View / Edit / Delete actions.

   IMPORTANT FIX: previous versions of this file called
   `/doctor/appointments/<id>/<action>`. The Flask blueprint
   is registered at url_prefix "/appointment", so those calls
   were 404ing against `/doctor/appointments/...` instead of
   the real `/appointment/doctor/...` path — that was the
   root cause of every action silently failing. To make this
   robust against future route changes, every action button's
   URL is now read from `data-view-url` / `data-edit-url` /
   `data-delete-url` attributes rendered server-side with
   Flask's `url_for(...)`, instead of being hardcoded here.
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {
  initSidebarToggle();
  initThemeToggle();
  initTopbarSearch();
  initTableSearchFilter();
  initRowActionHandlers();
  initEditModal();
  initDeleteModal();
});

/* ---------------------------------------------------------
   CSRF helper — reads the token from the page's meta tag and
   attaches it to every AJAX request as required by Flask-WTF.
--------------------------------------------------------- */
function getCsrfToken(){
  const meta = document.querySelector('meta[name="csrf-token"]');
  return meta ? meta.getAttribute('content') : '';
}

async function getJson(url){
  const response = await fetch(url, { credentials: 'same-origin' });
  let payload = null;
  try{ payload = await response.json(); }catch(err){ /* non-JSON error page */ }

  if(!response.ok){
    const message = (payload && payload.message) || (payload && payload.description) || 'Request failed. Please try again.';
    throw new Error(message);
  }
  return payload;
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
    const message = (payload && payload.message) || (payload && payload.description) || 'Request failed. Please try again.';
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
   Dark mode toggle (persisted — same key as doctor_dashboard.js)
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
   Topbar search box.
   NOTE: this project's shared/common Doctor Portal search
   component (as used on other pages, e.g. Dashboard) wasn't
   available to reference while fixing this page, so this is
   a visual-only placeholder wired to nothing. If a shared
   handler already exists (e.g. `window.HRPortalSearch`),
   attach it here instead of leaving this inert:

     const input = document.getElementById('hrTopbarSearch');
     input?.addEventListener('keydown', (e) => {
       if (e.key === 'Enter') window.HRPortalSearch?.run(input.value);
     });
--------------------------------------------------------- */
function initTopbarSearch(){
  const input = document.getElementById('hrTopbarSearch');
  if(!input) return;
  // Intentionally left unwired — see note above.
}

/* ---------------------------------------------------------
   Search + status/date filter over rendered rows.
   Pure client-side filter — the server already scopes rows
   to the logged-in doctor.
--------------------------------------------------------- */
function initTableSearchFilter(){
  const searchInput = document.getElementById('hrAppointmentSearch');
  const statusFilter = document.getElementById('hrFilterStatus');
  const dateFilter = document.getElementById('hrFilterDate');
  const resetBtn = document.getElementById('hrResetFilters');
  const table = document.getElementById('hrAppointmentTable');
  if(!table) return;

  const getRows = () => Array.from(table.querySelectorAll('tbody tr'))
    .filter(r => r.id !== 'hrEmptyRow' && r.id !== 'hrDynamicEmptyRow');

  function applyFilters(){
    const term = (searchInput?.value || '').trim().toLowerCase();
    const status = statusFilter?.value || '';
    const dateValue = dateFilter?.value || '';
    const rows = getRows();
    let visibleCount = 0;

    rows.forEach(row => {
      const text = row.textContent.toLowerCase();
      const matchesSearch = !term || text.includes(term);

      const rowStatus = row.getAttribute('data-status') || '';
      const matchesStatus = !status || rowStatus === status;

      const rowDate = row.getAttribute('data-appointment-date') || '';
      const matchesDate = !dateValue || rowDate === dateValue;

      const show = matchesSearch && matchesStatus && matchesDate;
      row.style.display = show ? '' : 'none';
      if(show) visibleCount++;
    });

    toggleEmptyState(visibleCount === 0);
    updateCountLabel(visibleCount);
  }

  function toggleEmptyState(isEmpty){
    let emptyRow = table.querySelector('#hrDynamicEmptyRow');
    if(isEmpty){
      if(!emptyRow){
        emptyRow = document.createElement('tr');
        emptyRow.id = 'hrDynamicEmptyRow';
        emptyRow.innerHTML = `
          <td colspan="7">
            <div class="hr-empty-state">
              <div class="hr-empty-icon"><i class="fa-solid fa-magnifying-glass"></i></div>
              <h4>No matching appointments</h4>
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
  statusFilter?.addEventListener('change', applyFilters);
  dateFilter?.addEventListener('change', applyFilters);
  resetBtn?.addEventListener('click', () => {
    if(searchInput) searchInput.value = '';
    if(statusFilter) statusFilter.value = '';
    if(dateFilter) dateFilter.value = '';
    applyFilters();
  });

  // Expose so row add/remove (edit/delete) can re-run the current filter.
  window.hrApplyAppointmentFilters = applyFilters;
}

function updateCountLabel(count){
  const label = document.getElementById('hrAppointmentCountLabel');
  if(label) label.textContent = `${count} appointment(s) found`;
}

/* ---------------------------------------------------------
   Row action handlers — View / Edit / Delete.
   Delegated from the table so dynamically-filtered rows keep
   working without re-binding. Each button's target URL comes
   from the row's data-view-url / data-edit-url / data-delete-url
   attributes (rendered server-side via url_for), so the correct
   appointment ID is always used and never has to be guessed
   client-side.
--------------------------------------------------------- */
function initRowActionHandlers(){
  const table = document.getElementById('hrAppointmentTable');
  if(!table) return;

  table.addEventListener('click', (event) => {
    const viewBtn = event.target.closest('[data-action="view"]');
    if(viewBtn) return handleView(viewBtn);

    const editBtn = event.target.closest('[data-action="edit"]');
    if(editBtn) return handleEditOpen(editBtn);

    const deleteBtn = event.target.closest('[data-action="delete"]');
    if(deleteBtn) return handleDeleteOpen(deleteBtn);
  });
}

function handleView(button){
  const row = button.closest('tr');
  const url = row?.getAttribute('data-view-url');
  if(!url) return;

  const modalEl = document.getElementById('hrViewModal');
  const body = document.getElementById('hrViewModalBody');
  if(!modalEl || !body) return;

  body.innerHTML = '<div class="text-center py-4"><i class="fa-solid fa-spinner fa-spin"></i></div>';
  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
  modal.show();

  getJson(url)
    .then(data => {
      if(!data.success) throw new Error('Unable to load appointment.');
      renderViewModal(data.appointment);
    })
    .catch(err => {
      body.innerHTML = `<p class="text-danger mb-0">${escapeHtml(err.message || 'Unable to load appointment details.')}</p>`;
    });
}

function renderViewModal(appointment){
  const body = document.getElementById('hrViewModalBody');
  if(!body) return;

  const statusLabels = {
    scheduled: 'Pending',
    completed: 'Completed',
    cancelled: 'Cancelled',
    missed: 'Missed'
  };

  const rows = [
    ['Patient', appointment.patient_name || '—'],
    ['Patient Code', appointment.patient_code || '—'],
    ['Doctor', appointment.doctor_name || '—'],
    ['Date', appointment.appointment_date || '—'],
    ['Time', appointment.appointment_time || '—'],
    ['Type', appointment.appointment_type || '—'],
    ['Status', statusLabels[appointment.status] || appointment.status || '—'],
    ['Reason / Notes', appointment.reason || '—']
  ];

  if(appointment.meeting_link){
    rows.push(['Meeting Link', appointment.meeting_link]);
  }

  body.innerHTML = rows.map(([label, value]) => `
    <div class="hr-detail-row">
      <span class="hr-detail-label">${escapeHtml(label)}</span>
      <span class="hr-detail-value">${escapeHtml(String(value))}</span>
    </div>
  `).join('');
}

/* ---------------------------------------------------------
   Edit modal
--------------------------------------------------------- */
function initEditModal(){
  const modal = document.getElementById('hrEditModal');
  const form = document.getElementById('hrEditForm');
  const errorBox = document.getElementById('hrEditFormError');
  if(!modal || !form) return;

  let activeEditUrl = null;
  let activeRow = null;

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if(!activeEditUrl) return;

    errorBox.classList.add('d-none');
    errorBox.textContent = '';

    const submitBtn = form.querySelector('[type="submit"]');
    setButtonLoading(submitBtn, true);

    const formData = new FormData(form);

    postForm(activeEditUrl, formData)
      .then(data => {
        if(activeRow) applyEditToRow(activeRow, data.appointment);
        showToast('Appointment updated successfully.', 'success');
        bootstrap.Modal.getInstance(modal)?.hide();
        recomputeStatCards();
        window.hrApplyAppointmentFilters?.();
      })
      .catch(err => {
        errorBox.textContent = err.message;
        errorBox.classList.remove('d-none');
      })
      .finally(() => setButtonLoading(submitBtn, false));
  });

  // Exposed so the delegated row-click handler can open this modal
  // with the right row's data already fetched.
  window.hrOpenEditModal = (row) => {
    activeEditUrl = row.getAttribute('data-edit-url');
    activeRow = row;
  };
}

function handleEditOpen(button){
  const row = button.closest('tr');
  const viewUrl = row?.getAttribute('data-view-url');
  if(!row || !viewUrl) return;

  const modalEl = document.getElementById('hrEditModal');
  const form = document.getElementById('hrEditForm');
  if(!modalEl || !form) return;

  form.reset();
  document.getElementById('hrEditFormError')?.classList.add('d-none');

  getJson(viewUrl)
    .then(data => {
      if(!data.success) throw new Error('Unable to load appointment.');
      const a = data.appointment;
      form.querySelector('[name="appointment_date"]').value = a.appointment_date || '';
      form.querySelector('[name="appointment_time"]').value = a.appointment_time || '';
      form.querySelector('[name="appointment_type"]').value = a.appointment_type || 'online';
      form.querySelector('[name="status"]').value = a.status || 'scheduled';
      form.querySelector('[name="reason"]').value = a.reason || '';

      window.hrOpenEditModal(row);
      bootstrap.Modal.getOrCreateInstance(modalEl).show();
    })
    .catch(err => showToast(err.message, 'error'));
}

function applyEditToRow(row, appointment){
  if(!row || !appointment) return;

  const dateCell = row.querySelector('[data-role="appointment-date"]');
  const timeCell = row.querySelector('[data-role="appointment-time"]');
  const typeCell = row.querySelector('[data-role="appointment-type"]');
  if(dateCell) dateCell.textContent = appointment.appointment_date;
  if(timeCell) timeCell.textContent = appointment.appointment_time;
  if(typeCell) typeCell.textContent = appointment.appointment_type;

  row.setAttribute('data-appointment-date', appointment.appointment_date);

  const normalized = appointment.status === 'scheduled' ? 'pending' : appointment.status;
  row.setAttribute('data-status', normalized);

  const badge = row.querySelector('[data-role="status-badge"]');
  if(badge){
    const config = {
      pending:   ['hr-badge-warning', 'Pending'],
      completed: ['hr-badge-success', 'Completed'],
      cancelled: ['hr-badge-neutral', 'Cancelled'],
      missed:    ['hr-badge-danger',  'Missed']
    };
    const [badgeClass, label] = config[normalized] || ['hr-badge-warning', 'Pending'];
    badge.className = `hr-badge ${badgeClass}`;
    badge.textContent = label;
  }
}

/* ---------------------------------------------------------
   Delete confirm modal
--------------------------------------------------------- */
function initDeleteModal(){
  const modal = document.getElementById('hrDeleteModal');
  const confirmBtn = document.getElementById('hrDeleteConfirmBtn');
  if(!modal || !confirmBtn) return;

  let activeDeleteUrl = null;
  let activeRow = null;

  confirmBtn.addEventListener('click', () => {
    if(!activeDeleteUrl) return;

    setButtonLoading(confirmBtn, true);

    const formData = new FormData();
    formData.append('csrf_token', getCsrfToken());

    postForm(activeDeleteUrl, formData)
      .then(() => {
        activeRow?.remove();
        showToast('Appointment deleted successfully.', 'success');
        bootstrap.Modal.getInstance(modal)?.hide();
        recomputeStatCards();
        window.hrApplyAppointmentFilters?.();
        maybeShowEmptyState();
      })
      .catch(err => showToast(err.message, 'error'))
      .finally(() => setButtonLoading(confirmBtn, false));
  });

  window.hrOpenDeleteModal = (url, row) => {
    activeDeleteUrl = url;
    activeRow = row;
  };
}

function handleDeleteOpen(button){
  const row = button.closest('tr');
  const url = row?.getAttribute('data-delete-url');
  if(!row || !url) return;

  window.hrOpenDeleteModal(url, row);
  const modalEl = document.getElementById('hrDeleteModal');
  bootstrap.Modal.getOrCreateInstance(modalEl).show();
}

function maybeShowEmptyState(){
  const table = document.getElementById('hrAppointmentTable');
  if(!table) return;
  const rows = Array.from(table.querySelectorAll('tbody tr'))
    .filter(r => r.id !== 'hrEmptyRow' && r.id !== 'hrDynamicEmptyRow');
  if(rows.length === 0 && !table.querySelector('#hrDynamicEmptyRow')){
    const emptyRow = document.createElement('tr');
    emptyRow.id = 'hrDynamicEmptyRow';
    emptyRow.innerHTML = `
      <td colspan="7">
        <div class="hr-empty-state">
          <div class="hr-empty-icon"><i class="fa-solid fa-calendar-check"></i></div>
          <h4>No appointments found</h4>
          <p>You have no appointments scheduled yet.</p>
        </div>
      </td>`;
    table.querySelector('tbody').appendChild(emptyRow);
  }
}

/* ---------------------------------------------------------
   Recompute the four stat cards from the rows currently in
   the table, so Delete/Edit keep them accurate without a
   full page reload.
--------------------------------------------------------- */
function recomputeStatCards(){
  const table = document.getElementById('hrAppointmentTable');
  if(!table) return;

  const rows = Array.from(table.querySelectorAll('tbody tr'))
    .filter(r => r.id !== 'hrEmptyRow' && r.id !== 'hrDynamicEmptyRow');

  const todayStr = new Date().toISOString().slice(0, 10);

  let today = 0, pending = 0, missed = 0, completed = 0;

  rows.forEach(row => {
    const status = row.getAttribute('data-status');
    const date = row.getAttribute('data-appointment-date');
    if(date === todayStr) today++;
    if(status === 'pending') pending++;
    if(status === 'missed') missed++;
    if(status === 'completed') completed++;
  });

  setText('hrStatToday', today);
  setText('hrStatPending', pending);
  setText('hrStatMissed', missed);
  setText('hrStatCompleted', completed);
}

function setText(id, value){
  const el = document.getElementById(id);
  if(el) el.textContent = value;
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
   Minimal HTML escaping for text injected into the View modal
--------------------------------------------------------- */
function escapeHtml(value){
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}