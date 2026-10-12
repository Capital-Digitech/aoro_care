/* =========================================================
   Aoro Care - Family Portal Doctors
   Mirrors the Appointments page behaviour (search, filters,
   View modal) for the read-only Family Portal. Rows are already
   scoped by the server to doctors connected to the family
   member's linked patients; the View modal loads
   /family/doctors/<id> (JSON).
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
   Search + specialization/status filter over rendered rows.
--------------------------------------------------------- */
function initTableSearchFilter(){
  const searchInput = document.getElementById('hrDoctorSearch');
  const specFilter = document.getElementById('hrFilterSpecialization');
  const statusFilter = document.getElementById('hrFilterStatus');
  const resetBtn = document.getElementById('hrResetFilters');
  const table = document.getElementById('hrDoctorTable');
  if(!table) return;

  const getRows = () => Array.from(table.querySelectorAll('tbody tr'))
    .filter(r => r.id !== 'hrEmptyRow' && r.id !== 'hrDynamicEmptyRow');

  function applyFilters(){
    const term = (searchInput?.value || '').trim().toLowerCase();
    const spec = specFilter?.value || '';
    const status = statusFilter?.value || '';
    let visibleCount = 0;

    getRows().forEach(row => {
      const matchesSearch = !term || row.textContent.toLowerCase().includes(term);
      const matchesSpec = !spec || (row.getAttribute('data-specialization') || '') === spec;
      const matchesStatus = !status || (row.getAttribute('data-status') || '') === status;
      const show = matchesSearch && matchesSpec && matchesStatus;
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
          <td colspan="9">
            <div class="hr-empty-state">
              <div class="hr-empty-icon"><i class="fa-solid fa-magnifying-glass"></i></div>
              <h4>No matching doctors</h4>
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
  specFilter?.addEventListener('change', applyFilters);
  statusFilter?.addEventListener('change', applyFilters);

  resetBtn?.addEventListener('click', () => {
    if(searchInput) searchInput.value = '';
    if(specFilter) specFilter.value = '';
    if(statusFilter) statusFilter.value = '';
    applyFilters();
  });
}

function updateCountLabel(count){
  const label = document.getElementById('hrDoctorCountLabel');
  if(label) label.textContent = `${count} doctor(s) found`;
}

/* ---------------------------------------------------------
   View action (delegated from the table)
--------------------------------------------------------- */
function initRowActionHandlers(){
  const table = document.getElementById('hrDoctorTable');
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
      if(!data.success) throw new Error('Unable to load doctor.');
      renderViewModal(data.doctor);
    })
    .catch(err => {
      body.innerHTML = `<p class="text-danger mb-0">${escapeHtml(err.message || 'Unable to load doctor details.')}</p>`;
    });
}

function renderViewModal(doctor){
  const body = document.getElementById('hrViewModalBody');
  if(!body) return;

  const rows = [
    ['Doctor', doctor.doctor_name || '—'],
    ['Doctor ID', doctor.doctor_code || '—'],
    ['Specialization', doctor.specialization || '—'],
    ['Qualification', doctor.qualification || '—'],
    ['Experience', doctor.experience_years !== '' ? `${doctor.experience_years} years` : '—'],
    ['Hospital', doctor.hospital_name || '—'],
    ['City', doctor.hospital_city || '—'],
    ['Consultation Fee', doctor.consultation_fee !== '' ? doctor.consultation_fee : '—'],
    ['Available Days', doctor.available_days || '—'],
    ['Available Time', doctor.available_time || '—'],
    ['Email', doctor.email || '—'],
    ['Mobile', doctor.mobile || '—'],
    ['Linked Patients', (doctor.linked_patients || []).join(', ') || '—'],
    ['Status', doctor.status === 'inactive' ? 'Inactive' : 'Active'],
    ['About', doctor.about || '—']
  ];

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
