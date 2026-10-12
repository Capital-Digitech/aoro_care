/* =========================================================
   Aoro Care - Family Portal Appointments
   Mirrors doctor_appointment.js (search, status/date filter,
   View modal) for the read-only Family Portal. Rows are already
   scoped by the server to the family member's linked patients;
   the View modal loads /family/appointments/<id> (JSON).
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {
  initTableSearchFilter();
  initRowActionHandlers();
});

async function getJson(url){
  const response = await fetch(url, { credentials: 'same-origin' });
  let payload = null;
  try{ payload = await response.json(); }catch(err){ /* non-JSON error page */ }

  if(!response.ok){
    throw new Error((payload && payload.message) || 'Request failed. Please try again.');
  }
  return payload;
}

/* ---------------------------------------------------------
   Search + status/date filter over rendered rows.
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
    let visibleCount = 0;

    getRows().forEach(row => {
      const matchesSearch = !term || row.textContent.toLowerCase().includes(term);
      const matchesStatus = !status || (row.getAttribute('data-status') || '') === status;
      const matchesDate = !dateValue || (row.getAttribute('data-appointment-date') || '') === dateValue;

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
      if(!emptyRow && !table.querySelector('#hrEmptyRow')){
        emptyRow = document.createElement('tr');
        emptyRow.id = 'hrDynamicEmptyRow';
        emptyRow.innerHTML = `
          <td colspan="8">
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

function updateCountLabel(count){
  const label = document.getElementById('hrAppointmentCountLabel');
  if(label) label.textContent = `${count} appointment(s) found`;
}

/* ---------------------------------------------------------
   View action (delegated from the table)
--------------------------------------------------------- */
function initRowActionHandlers(){
  const table = document.getElementById('hrAppointmentTable');
  if(!table) return;

  table.addEventListener('click', (event) => {
    const viewBtn = event.target.closest('[data-action="view"]');
    if(viewBtn) handleView(viewBtn);
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
  bootstrap.Modal.getOrCreateInstance(modalEl).show();

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
    pending: 'Pending',
    scheduled: 'Pending',
    completed: 'Completed',
    cancelled: 'Cancelled',
    missed: 'Missed'
  };

  const rows = [
    ['Patient', appointment.patient_name || '—'],
    ['Patient Code', appointment.patient_code || '—'],
    ['Doctor', appointment.doctor_name || '—'],
    ['Specialization', appointment.specialization || '—'],
    ['Hospital', appointment.hospital_name || '—'],
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

function escapeHtml(value){
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}
