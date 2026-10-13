/* =========================================================
   Aoro Care - Family Portal Emergency Alerts
   Mirrors doctor_emergency_alert.js (search, severity/status
   filter, View + Patient Details modals) for the read-only
   Family Portal. Rows are scoped by the server to the family
   member's linked patients; View loads
   /family/emergency-alerts/<id> (JSON).
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
    let visibleCount = 0;

    getRows().forEach(row => {
      const matchesSearch = !term || row.textContent.toLowerCase().includes(term);
      const matchesSeverity = !severity || (row.getAttribute('data-severity') || '') === severity;
      const matchesStatus = !status || (row.getAttribute('data-status') || '') === status;

      const show = matchesSearch && matchesSeverity && matchesStatus;
      row.style.display = show ? '' : 'none';
      if(show) visibleCount++;
    });

    toggleEmptyState(visibleCount === 0);
    const label = document.getElementById('hrAlertCountLabel');
    if(label) label.textContent = `${visibleCount} alert(s) found`;
  }

  function toggleEmptyState(isEmpty){
    let emptyRow = table.querySelector('#hrDynamicEmptyRow');
    if(isEmpty){
      if(!emptyRow && !table.querySelector('#hrEmptyRow')){
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

function renderRows(body, rows){
  body.innerHTML = rows.map(([label, value]) => `
    <div class="hr-detail-row">
      <span class="hr-detail-label">${escapeHtml(label)}</span>
      <span class="hr-detail-value">${escapeHtml(String(value || '-'))}</span>
    </div>
  `).join('');
}

function capitalize(value){
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : '-';
}

function handleView(button){
  const url = button.closest('tr')?.getAttribute('data-view-url');
  const modalEl = document.getElementById('hrViewAlertModal');
  const body = document.getElementById('hrViewAlertModalBody');
  if(!url || !modalEl || !body) return;

  body.innerHTML = '<div class="text-center py-4"><i class="fa-solid fa-spinner fa-spin"></i></div>';
  bootstrap.Modal.getOrCreateInstance(modalEl).show();

  getJson(url)
    .then(data => {
      if(!data.success) throw new Error('Unable to load alert.');
      const a = data.alert;
      const rows = [
        ['Patient', a.patient_name],
        ['Patient Code', a.patient_code],
        ['Emergency Type', a.alert_type],
        ['Heart Rate', a.heart_rate],
        ['SpO\u2082', a.spo2],
        ['Severity', capitalize(a.severity)],
        ['Alert Time', a.alert_time],
        ['Status', capitalize(a.status)],
        ['Health Ring', a.ring_code],
        ['Message', a.message]
      ];
      if(a.has_location){
        rows.push(['Location', `${a.latitude}, ${a.longitude}`]);
      }
      renderRows(body, rows);
    })
    .catch(err => {
      body.innerHTML = `<p class="text-danger mb-0">${escapeHtml(err.message || 'Unable to load alert details.')}</p>`;
    });
}

function handlePatientDetails(button){
  const body = document.getElementById('hrPatientDetailsModalBody');
  const modalEl = document.getElementById('hrPatientDetailsModal');
  if(!body || !modalEl) return;

  renderRows(body, [
    ['Patient', button.getAttribute('data-patient-name')],
    ['Patient Code', button.getAttribute('data-patient-code')]
  ]);

  bootstrap.Modal.getOrCreateInstance(modalEl).show();
}

function escapeHtml(value){
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}
