/* =========================================================
   Aoro Care - Family Portal Health Ring
   Mirrors doctor_health_ring.js (search, status/connection
   filter, View modal and the Battery History / Firmware /
   Device Logs panels) for the read-only Family Portal.
   Rows are scoped by the server to the family member's linked
   patients; details come from /family/health-ring/<id>/details
   (JSON, real DB data incl. recent sync logs).
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
   Search + status/connection filter over rendered rows.
--------------------------------------------------------- */
function initTableSearchFilter(){
  const searchInput = document.getElementById('hrRingSearch');
  const statusFilter = document.getElementById('hrFilterStatus');
  const connectionFilter = document.getElementById('hrFilterConnection');
  const resetBtn = document.getElementById('hrResetFilters');
  const table = document.getElementById('hrRingTable');
  if(!table) return;

  const getRows = () => Array.from(table.querySelectorAll('tbody tr'))
    .filter(r => r.id !== 'hrEmptyRow' && r.id !== 'hrDynamicEmptyRow');

  function applyFilters(){
    const term = (searchInput?.value || '').trim().toLowerCase();
    const status = statusFilter?.value || '';
    const connection = connectionFilter?.value || '';
    let visibleCount = 0;

    getRows().forEach(row => {
      const matchesSearch = !term || row.textContent.toLowerCase().includes(term);
      const matchesStatus = !status || (row.getAttribute('data-status') || '') === status;
      const matchesConnection = !connection || (row.getAttribute('data-connection') || '') === connection;

      const show = matchesSearch && matchesStatus && matchesConnection;
      row.style.display = show ? '' : 'none';
      if(show) visibleCount++;
    });

    toggleEmptyState(visibleCount === 0);
    const label = document.getElementById('hrRingCountLabel');
    if(label) label.textContent = `${visibleCount} ring(s) found`;
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
              <h4>No matching health rings</h4>
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
  connectionFilter?.addEventListener('change', applyFilters);
  resetBtn?.addEventListener('click', () => {
    if(searchInput) searchInput.value = '';
    if(statusFilter) statusFilter.value = '';
    if(connectionFilter) connectionFilter.value = '';
    applyFilters();
  });
}

/* ---------------------------------------------------------
   Row actions (delegated): View + dropdown info panels.
--------------------------------------------------------- */
function initRowActionHandlers(){
  const table = document.getElementById('hrRingTable');
  if(!table) return;

  table.addEventListener('click', (event) => {
    const viewBtn = event.target.closest('[data-action="view"]');
    if(viewBtn) return openPanel(viewBtn, 'view');

    const batteryBtn = event.target.closest('[data-action="battery-history"]');
    if(batteryBtn){ event.preventDefault(); return openPanel(batteryBtn, 'battery'); }

    const firmwareBtn = event.target.closest('[data-action="firmware-info"]');
    if(firmwareBtn){ event.preventDefault(); return openPanel(firmwareBtn, 'firmware'); }

    const logsBtn = event.target.closest('[data-action="device-logs"]');
    if(logsBtn){ event.preventDefault(); return openPanel(logsBtn, 'logs'); }
  });
}

function openPanel(trigger, kind){
  const row = trigger.closest('tr');
  const url = row?.getAttribute('data-details-url');
  if(!url) return;

  const titles = {
    view:     ['Health Ring Details',    'fa-ring'],
    battery:  ['Battery History',        'fa-battery-full'],
    firmware: ['Firmware Information',   'fa-microchip'],
    logs:     ['Device Logs',            'fa-file-lines']
  };

  const [modalId, bodyId] = kind === 'view'
    ? ['hrViewModal', 'hrViewModalBody']
    : ['hrInfoModal', 'hrInfoModalBody'];

  const modalEl = document.getElementById(modalId);
  const body = document.getElementById(bodyId);
  if(!modalEl || !body) return;

  if(kind !== 'view'){
    const [title, icon] = titles[kind];
    document.getElementById('hrInfoModalTitle').innerHTML =
      `<i class="fa-solid ${icon} me-2 text-primary"></i> ${escapeHtml(title)}`;
  }

  body.innerHTML = '<div class="text-center py-4"><i class="fa-solid fa-spinner fa-spin"></i></div>';
  bootstrap.Modal.getOrCreateInstance(modalEl).show();

  getJson(url)
    .then(data => {
      if(!data.success) throw new Error('Unable to load ring details.');
      body.innerHTML = renderPanel(kind, data);
    })
    .catch(err => {
      body.innerHTML = `<p class="text-danger mb-0">${escapeHtml(err.message || 'Unable to load ring details.')}</p>`;
    });
}

function detailRows(rows){
  return rows.map(([label, value]) => `
    <div class="hr-detail-row">
      <span class="hr-detail-label">${escapeHtml(label)}</span>
      <span class="hr-detail-value">${escapeHtml(String(value))}</span>
    </div>
  `).join('');
}

function renderPanel(kind, data){
  const r = data.ring;
  const battery = (r.battery !== null && r.battery !== undefined) ? `${r.battery}%` : '—';

  if(kind === 'view'){
    return detailRows([
      ['Patient', r.patient_name || '—'],
      ['Patient Code', r.patient_code || '—'],
      ['Serial Number', r.serial_number || '—'],
      ['MAC Address', r.mac_address || '—'],
      ['Model', r.model || '—'],
      ['Firmware', r.firmware || '—'],
      ['Battery', battery],
      ['Connection', capitalize(r.connection)],
      ['Last Sync', r.last_sync || 'Never'],
      ['Purchased Date', r.purchased_date || '—'],
      ['Warranty Expiry', r.warranty_expiry || '—'],
      ['Status', capitalize(r.status)]
    ]);
  }

  if(kind === 'firmware'){
    return detailRows([
      ['Model', r.model || '—'],
      ['Firmware Version', r.firmware || '—'],
      ['MAC Address', r.mac_address || '—']
    ]);
  }

  if(kind === 'battery'){
    const logs = (data.sync_logs || []).filter(l => l.battery !== null && l.battery !== undefined);
    const history = logs.length
      ? detailRows(logs.map(l => [l.time || '—', `${l.battery}%`]))
      : '<p class="text-muted mb-0" style="font-size:12.5px;">No earlier battery readings have been recorded for this ring yet.</p>';

    return detailRows([
      ['Current Reading', battery],
      ['Last Sync', r.last_sync || 'Never']
    ]) + history;
  }

  // Device logs
  const logs = data.sync_logs || [];
  const latest = data.latest_reading;
  let html = detailRows([
    ['Connection', capitalize(r.connection)],
    ['Last Sync', r.last_sync || 'Never']
  ]);

  if(latest){
    html += detailRows([
      ['Last Reading', latest.recorded_at || '—'],
      ['Heart Rate', latest.heart_rate != null ? `${latest.heart_rate} bpm` : '—'],
      ['SpO₂', latest.spo2 != null ? `${latest.spo2}%` : '—']
    ]);
  }

  html += logs.length
    ? detailRows(logs.map(l => [
        l.time || '—',
        `${capitalize(l.status)} · ${l.records} record(s)` + (l.error ? ` · ${l.error}` : '')
      ]))
    : '<p class="text-muted mb-0" style="font-size:12.5px;">No detailed device log entries are available for this ring yet.</p>';

  return html;
}

function capitalize(value){
  if(!value) return '—';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function escapeHtml(value){
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}
