/* =========================================================
   HEALTH RING — Doctor Appointment Management Behavior
   Sidebar/theme toggle reuse doctor_dashboard.js if loaded
   globally; this file only adds page-specific behavior:
   search/filter, AJAX status actions, reschedule, notes,
   prescription, and toast feedback.
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {
  initSidebarToggle();
  initThemeToggle();
  initTableSearchFilter();
  initRowActionHandlers();
  initRescheduleModal();
  initNotesModal();
  initPrescriptionModal();
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
}

/* ---------------------------------------------------------
   Row action handlers — View / Confirm / Complete / Cancel.
   Delegated from the table so dynamically-filtered rows keep
   working without re-binding.
--------------------------------------------------------- */
function initRowActionHandlers(){
  const table = document.getElementById('hrAppointmentTable');
  if(!table) return;

  table.addEventListener('click', (event) => {
    const viewBtn = event.target.closest('[data-action="view"]');
    if(viewBtn) return handleView(viewBtn);

    const confirmBtn = event.target.closest('[data-action="confirm"]');
    if(confirmBtn) return handleStatusAction(confirmBtn, 'confirm', 'Confirm this appointment?', 'Appointment confirmed.');

    const completeBtn = event.target.closest('[data-action="complete"]');
    if(completeBtn) return handleStatusAction(completeBtn, 'complete', 'Mark this appointment as completed?', 'Appointment marked completed.');

    const cancelBtn = event.target.closest('[data-action="cancel"]');
    if(cancelBtn) return handleStatusAction(cancelBtn, 'cancel', 'Cancel this appointment? This cannot be undone.', 'Appointment cancelled.');
  });
}

function handleView(button){
  const row = button.closest('tr');
  const appointmentId = row?.getAttribute('data-appointment-id');
  if(!appointmentId) return;

  const modalEl = document.getElementById('hrViewModal');
  const body = document.getElementById('hrViewModalBody');
  if(!modalEl || !body) return;

  body.innerHTML = '<div class="text-center py-4"><i class="fa-solid fa-spinner fa-spin"></i></div>';
  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
  modal.show();

  fetch(`/doctor/appointments/${appointmentId}`, { credentials: 'same-origin' })
    .then(res => res.json())
    .then(data => {
      if(!data.success) throw new Error('Unable to load appointment.');
      renderViewModal(data.appointment);
    })
    .catch(() => {
      body.innerHTML = '<p class="text-danger mb-0">Unable to load appointment details.</p>';
    });
}

function renderViewModal(appointment){
  const body = document.getElementById('hrViewModalBody');
  if(!body) return;

  const rows = [
    ['Patient', appointment.patient_name || '—'],
    ['Patient Code', appointment.patient_code || '—'],
    ['Date', appointment.appointment_date || '—'],
    ['Time', appointment.appointment_time || '—'],
    ['Type', appointment.appointment_type || '—'],
    ['Status', appointment.status || '—'],
    ['Reason', appointment.reason || '—'],
    ['Notes', appointment.notes || '—'],
    ['Prescription', appointment.prescription || '—']
  ];

  body.innerHTML = rows.map(([label, value]) => `
    <div class="hr-detail-row">
      <span class="hr-detail-label">${label}</span>
      <span class="hr-detail-value">${escapeHtml(String(value))}</span>
    </div>
  `).join('');
}

function handleStatusAction(button, action, confirmMessage, successMessage){
  const row = button.closest('tr');
  const appointmentId = row?.getAttribute('data-appointment-id');
  if(!appointmentId) return;

  if(!window.confirm(confirmMessage)) return;

  setRowBusy(row, true);
  setButtonLoading(button, true);

  const formData = new FormData();
  formData.append('csrf_token', getCsrfToken());

  postForm(`/doctor/appointments/${appointmentId}/${action}`, formData)
    .then(data => {
      updateRowStatus(row, data.status);
      showToast(successMessage, 'success');
    })
    .catch(err => {
      showToast(err.message, 'error');
    })
    .finally(() => {
      setRowBusy(row, false);
      setButtonLoading(button, false);
    });
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
      pending:   ['hr-badge-warning', 'Pending'],
      confirmed: ['hr-badge-info',    'Confirmed'],
      completed: ['hr-badge-success', 'Completed'],
      cancelled: ['hr-badge-neutral', 'Cancelled']
    };
    const [badgeClass, label] = config[newStatus] || ['hr-badge-info', newStatus];
    badge.className = `hr-badge ${badgeClass}`;
    badge.textContent = label;
  }

  const confirmBtn = row.querySelector('[data-action="confirm"]');
  const completeBtn = row.querySelector('[data-action="complete"]');
  const cancelBtn = row.querySelector('[data-action="cancel"]');
  const rescheduleItem = row.querySelector('[data-action="reschedule"]');

  if(confirmBtn) confirmBtn.classList.toggle('d-none', newStatus !== 'pending');
  if(completeBtn) completeBtn.classList.toggle('d-none', newStatus !== 'confirmed');

  const isClosed = newStatus === 'completed' || newStatus === 'cancelled';
  if(cancelBtn) cancelBtn.classList.toggle('d-none', isClosed);
  if(rescheduleItem) rescheduleItem.classList.toggle('disabled', isClosed);
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
   Reschedule modal
--------------------------------------------------------- */
function initRescheduleModal(){
  const modal = document.getElementById('hrRescheduleModal');
  const form = document.getElementById('hrRescheduleForm');
  if(!modal || !form) return;

  let activeAppointmentId = null;
  let activeRow = null;

  modal.addEventListener('show.bs.modal', (event) => {
    const trigger = event.relatedTarget;
    if(!trigger) return;

    activeAppointmentId = trigger.getAttribute('data-appointment-id');
    activeRow = trigger.closest('tr');

    const dateInput = form.querySelector('[name="appointment_date"]');
    const timeInput = form.querySelector('[name="appointment_time"]');
    if(dateInput) dateInput.value = trigger.getAttribute('data-current-date') || '';
    if(timeInput) timeInput.value = trigger.getAttribute('data-current-time') || '';
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if(!activeAppointmentId) return;

    const submitBtn = form.querySelector('[type="submit"]');
    setButtonLoading(submitBtn, true);

    const formData = new FormData(form);

    postForm(`/doctor/appointments/${activeAppointmentId}/reschedule`, formData)
      .then(data => {
        if(activeRow){
          const dateCell = activeRow.querySelector('[data-role="appointment-date"]');
          const timeCell = activeRow.querySelector('[data-role="appointment-time"]');
          if(dateCell) dateCell.textContent = data.appointment_date;
          if(timeCell) timeCell.textContent = data.appointment_time;
          activeRow.setAttribute('data-appointment-date', data.appointment_date);
        }
        showToast('Appointment rescheduled.', 'success');
        bootstrap.Modal.getInstance(modal)?.hide();
      })
      .catch(err => showToast(err.message, 'error'))
      .finally(() => setButtonLoading(submitBtn, false));
  });
}

/* ---------------------------------------------------------
   Add Notes modal
--------------------------------------------------------- */
function initNotesModal(){
  const modal = document.getElementById('hrNotesModal');
  const form = document.getElementById('hrNotesForm');
  if(!modal || !form) return;

  let activeAppointmentId = null;

  modal.addEventListener('show.bs.modal', (event) => {
    const trigger = event.relatedTarget;
    if(!trigger) return;
    activeAppointmentId = trigger.getAttribute('data-appointment-id');

    const textarea = form.querySelector('[name="notes"]');
    if(textarea) textarea.value = trigger.getAttribute('data-current-notes') || '';
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if(!activeAppointmentId) return;

    const submitBtn = form.querySelector('[type="submit"]');
    setButtonLoading(submitBtn, true);

    postForm(`/doctor/appointments/${activeAppointmentId}/notes`, new FormData(form))
      .then(() => {
        showToast('Notes saved.', 'success');
        bootstrap.Modal.getInstance(modal)?.hide();
      })
      .catch(err => showToast(err.message, 'error'))
      .finally(() => setButtonLoading(submitBtn, false));
  });
}

/* ---------------------------------------------------------
   Add Prescription modal
--------------------------------------------------------- */
function initPrescriptionModal(){
  const modal = document.getElementById('hrPrescriptionModal');
  const form = document.getElementById('hrPrescriptionForm');
  if(!modal || !form) return;

  let activeAppointmentId = null;

  modal.addEventListener('show.bs.modal', (event) => {
    const trigger = event.relatedTarget;
    if(!trigger) return;
    activeAppointmentId = trigger.getAttribute('data-appointment-id');

    const textarea = form.querySelector('[name="prescription"]');
    if(textarea) textarea.value = trigger.getAttribute('data-current-prescription') || '';
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if(!activeAppointmentId) return;

    const submitBtn = form.querySelector('[type="submit"]');
    setButtonLoading(submitBtn, true);

    postForm(`/doctor/appointments/${activeAppointmentId}/prescription`, new FormData(form))
      .then(() => {
        showToast('Prescription saved.', 'success');
        bootstrap.Modal.getInstance(modal)?.hide();
      })
      .catch(err => showToast(err.message, 'error'))
      .finally(() => setButtonLoading(submitBtn, false));
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
   Minimal HTML escaping for text injected into the View modal
--------------------------------------------------------- */
function escapeHtml(value){
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}