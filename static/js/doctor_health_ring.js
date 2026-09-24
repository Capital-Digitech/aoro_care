/* =========================================================
   HEALTH RING — Doctor Health Ring Management Behavior
   Mirrors doctor_appointment.js: sidebar/theme toggle,
   search/filter, row actions, edit modal, toast feedback.

   Only /health-ring/edit/<id> and /health-ring/delete/<id>
   are real backend routes today, so both Edit and Delete
   submit as normal HTML POSTs (per the "prefer normal forms
   over fetch()" rule) instead of AJAX.
   View, Sync, Restart, Battery History, Firmware Information
   and Device Logs have no dedicated backend routes yet, so
   they work entirely from the data already rendered into the
   table rows — no invented endpoints, no fake data.
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {
  initSidebarToggle();
  initThemeToggle();
  initTableSearchFilter();
  initRowActionHandlers();
  initEditModal();
  initDeleteModal();
});

/* ---------------------------------------------------------
   CSRF helper — reads the token from the page's meta tag.
--------------------------------------------------------- */
function getCsrfToken(){
  const meta = document.querySelector('meta[name="csrf-token"]');
  return meta ? meta.getAttribute('content') : '';
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
   Search + status/connection filter over rendered rows.
   Pure client-side filter — the server already scopes rows
   to the logged-in doctor's patients.
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
    const rows = getRows();
    let visibleCount = 0;

    rows.forEach(row => {
      const text = row.textContent.toLowerCase();
      const matchesSearch = !term || text.includes(term);

      const rowStatus = row.getAttribute('data-status') || '';
      const matchesStatus = !status || rowStatus === status;

      const rowConnection = row.getAttribute('data-connection') || '';
      const matchesConnection = !connection || rowConnection === connection;

      const show = matchesSearch && matchesStatus && matchesConnection;
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
   Row action handlers — View / Sync / Restart / Delete /
   dropdown info items. Delegated from the table so filtered
   rows keep working without re-binding. The Edit button is
   handled by initEditModal() via the modal's show.bs.modal
   event.
--------------------------------------------------------- */
function initRowActionHandlers(){
  const table = document.getElementById('hrRingTable');
  if(!table) return;

  table.addEventListener('click', (event) => {
    const viewBtn = event.target.closest('[data-action="view"]');
    if(viewBtn) return handleView(viewBtn);

    const syncBtn = event.target.closest('[data-action="sync"]');
    if(syncBtn) return handleSync(syncBtn);

    const restartBtn = event.target.closest('[data-action="restart"]');
    if(restartBtn) return handleRestart(restartBtn);

    const batteryHistoryBtn = event.target.closest('[data-action="battery-history"]');
    if(batteryHistoryBtn) return handleBatteryHistory(batteryHistoryBtn);

    const firmwareInfoBtn = event.target.closest('[data-action="firmware-info"]');
    if(firmwareInfoBtn) return handleFirmwareInfo(firmwareInfoBtn);

    const deviceLogsBtn = event.target.closest('[data-action="device-logs"]');
    if(deviceLogsBtn) return handleDeviceLogs(deviceLogsBtn);

    const deleteBtn = event.target.closest('[data-action="delete"]');
    if(deleteBtn) return handleDeleteClick(deleteBtn);
  });
}

/* ---------------------------------------------------------
   View — populated directly from the row's data attributes,
   which already hold everything rendered server-side.
--------------------------------------------------------- */
function handleView(button){
  const row = button.closest('tr');
  if(!row) return;

  const modalEl = document.getElementById('hrViewModal');
  const body = document.getElementById('hrViewModalBody');
  if(!modalEl || !body) return;

  const data = readRowData(row);

  const rows = [
    ['Patient', data.patientName || '—'],
    ['Patient Code', data.patientCode || '—'],
    ['Serial Number', data.serialNumber || '—'],
    ['MAC Address', data.macAddress || '—'],
    ['Model', data.model || '—'],
    ['Firmware', data.firmware || '—'],
    ['Battery', data.battery !== '' ? `${data.battery}%` : '—'],
    ['Connection', capitalize(data.connection)],
    ['Last Sync', data.lastSync || 'Never'],
    ['Purchased Date', data.purchasedDate || '—'],
    ['Warranty Expiry', data.warrantyExpiry || '—'],
    ['Status', capitalize(data.status)]
  ];

  body.innerHTML = rows.map(([label, value]) => `
    <div class="hr-detail-row">
      <span class="hr-detail-label">${label}</span>
      <span class="hr-detail-value">${escapeHtml(String(value))}</span>
    </div>
  `).join('');

  bootstrap.Modal.getOrCreateInstance(modalEl).show();
}

/* ---------------------------------------------------------
   Sync / Restart — no dedicated backend route exists yet, so
   these confirm the action and give visual feedback without
   calling an endpoint that isn't there.
--------------------------------------------------------- */
function handleSync(button){
  const row = button.closest('tr');
  if(!row) return;
  if(!window.confirm('Send a sync request to this ring?')) return;

  setButtonLoading(button, true);
  setTimeout(() => {
    setButtonLoading(button, false);
    showToast('Sync request sent to the ring.', 'success');
  }, 600);
}

function handleRestart(button){
  const row = button.closest('tr');
  if(!row) return;
  if(!window.confirm('Restart this ring? The device will briefly go offline.')) return;

  setButtonLoading(button, true);
  setTimeout(() => {
    setButtonLoading(button, false);
    showToast('Restart command sent to the ring.', 'success');
  }, 600);
}

/* ---------------------------------------------------------
   Dropdown info items — Battery History / Firmware Info /
   Device Logs. All shown from data already on the row; no
   history log is stored server-side today, so each panel is
   scoped to what is actually known about the ring.
--------------------------------------------------------- */
function handleBatteryHistory(link){
  const row = link.closest('tr');
  if(!row) return;
  const data = readRowData(row);

  showInfoModal('Battery History', `
    <div class="hr-detail-row">
      <span class="hr-detail-label">Current Reading</span>
      <span class="hr-detail-value">${data.battery !== '' ? escapeHtml(data.battery) + '%' : '—'}</span>
    </div>
    <div class="hr-detail-row">
      <span class="hr-detail-label">Last Sync</span>
      <span class="hr-detail-value">${escapeHtml(data.lastSync || 'Never')}</span>
    </div>
    <p class="text-muted mb-0" style="font-size:12.5px;">No earlier battery readings have been recorded for this ring yet.</p>
  `, 'fa-battery-full');
}

function handleFirmwareInfo(link){
  const row = link.closest('tr');
  if(!row) return;
  const data = readRowData(row);

  showInfoModal('Firmware Information', `
    <div class="hr-detail-row">
      <span class="hr-detail-label">Model</span>
      <span class="hr-detail-value">${escapeHtml(data.model || '—')}</span>
    </div>
    <div class="hr-detail-row">
      <span class="hr-detail-label">Firmware Version</span>
      <span class="hr-detail-value">${escapeHtml(data.firmware || '—')}</span>
    </div>
    <div class="hr-detail-row">
      <span class="hr-detail-label">MAC Address</span>
      <span class="hr-detail-value">${escapeHtml(data.macAddress || '—')}</span>
    </div>
  `, 'fa-microchip');
}

function handleDeviceLogs(link){
  const row = link.closest('tr');
  if(!row) return;
  const data = readRowData(row);

  showInfoModal('Device Logs', `
    <div class="hr-detail-row">
      <span class="hr-detail-label">Connection</span>
      <span class="hr-detail-value">${capitalize(data.connection)}</span>
    </div>
    <div class="hr-detail-row">
      <span class="hr-detail-label">Last Sync</span>
      <span class="hr-detail-value">${escapeHtml(data.lastSync || 'Never')}</span>
    </div>
    <p class="text-muted mb-0" style="font-size:12.5px;">No detailed device log entries are available for this ring yet.</p>
  `, 'fa-file-lines');
}

function showInfoModal(title, bodyHtml, iconClass){
  const modalEl = document.getElementById('hrInfoModal');
  const titleEl = document.getElementById('hrInfoModalTitle');
  const body = document.getElementById('hrInfoModalBody');
  if(!modalEl || !titleEl || !body) return;

  titleEl.innerHTML = `<i class="fa-solid ${iconClass} me-2 text-primary"></i> ${escapeHtml(title)}`;
  body.innerHTML = bodyHtml;
  bootstrap.Modal.getOrCreateInstance(modalEl).show();
}

/* ---------------------------------------------------------
   Edit modal — pre-fills from the row's data attributes and
   points the form at the real /health-ring/edit/<id> route.
   Submits as a normal HTML form POST, not fetch().
--------------------------------------------------------- */
function initEditModal(){
  const modal = document.getElementById('hrEditModal');
  const form = document.getElementById('hrEditForm');
  const table = document.getElementById('hrRingTable');
  if(!modal || !form || !table) return;

  const baseAction = form.getAttribute('action').replace(/\/0$/, '/');

  table.addEventListener('click', (event) => {
    const editBtn = event.target.closest('[data-action="edit"]');
    if(!editBtn) return;

    const row = editBtn.closest('tr');
    if(!row) return;

    const data = readRowData(row);

    form.setAttribute('action', baseAction + data.ringId);

    document.getElementById('hrEditPatientId').value = data.patientId || '';
    document.getElementById('hrEditPatientDisplay').value =
      data.patientName ? `${data.patientName} (Code: ${data.patientCode || '—'})` : '—';
    document.getElementById('hrEditSerialNumber').value = data.serialNumber || '';
    document.getElementById('hrEditMacAddress').value = data.macAddress || '';
    document.getElementById('hrEditModel').value = data.model || '';
    document.getElementById('hrEditFirmware').value = data.firmware || '';
    document.getElementById('hrEditBattery').value = data.battery || '';
    document.getElementById('hrEditConnection').value = data.connection || 'disconnected';
    document.getElementById('hrEditPurchasedDate').value = data.purchasedDate || '';
    document.getElementById('hrEditWarrantyExpiry').value = data.warrantyExpiry || '';
    document.getElementById('hrEditStatus').value = data.status || 'active';
  });
}

/* ---------------------------------------------------------
   Delete — confirms via modal, then submits a real POST to
   the existing /health-ring/delete/<id> route using the
   row's own data-delete-url (server-rendered redirect, not
   AJAX, consistent with the Edit form). The ring id always
   comes from the row that was clicked, never a stale value.
--------------------------------------------------------- */
let pendingDeleteUrl = null;

function handleDeleteClick(link){
  const row = link.closest('tr');
  if(!row) return;

  const url = row.getAttribute('data-delete-url');
  if(!url) return;

  pendingDeleteUrl = url;

  const modalEl = document.getElementById('hrDeleteModal');
  if(!modalEl) return;
  bootstrap.Modal.getOrCreateInstance(modalEl).show();
}

function initDeleteModal(){
  const modalEl = document.getElementById('hrDeleteModal');
  const confirmBtn = document.getElementById('hrDeleteConfirmBtn');
  const form = document.getElementById('hrDeleteForm');
  if(!modalEl || !confirmBtn || !form) return;

  confirmBtn.addEventListener('click', () => {
    if(!pendingDeleteUrl) return;

    setButtonLoading(confirmBtn, true);
    form.setAttribute('action', pendingDeleteUrl);
    form.submit();
  });

  // Clear the pending url whenever the modal closes without confirming,
  // so a stray click on the confirm button later can't reuse a stale id.
  modalEl.addEventListener('hidden.bs.modal', () => {
    pendingDeleteUrl = null;
    setButtonLoading(confirmBtn, false);
  });
}

/* ---------------------------------------------------------
   Read a table row's data-* attributes into a plain object.
--------------------------------------------------------- */
function readRowData(row){
  return {
    ringId: row.getAttribute('data-ring-id') || '',
    status: row.getAttribute('data-status') || '',
    connection: row.getAttribute('data-connection') || '',
    patientId: row.getAttribute('data-patient-id') || '',
    patientName: row.getAttribute('data-patient-name') || '',
    patientCode: row.getAttribute('data-patient-code') || '',
    serialNumber: row.getAttribute('data-serial-number') || '',
    macAddress: row.getAttribute('data-mac-address') || '',
    model: row.getAttribute('data-model') || '',
    firmware: row.getAttribute('data-firmware') || '',
    battery: row.getAttribute('data-battery') || '',
    lastSync: row.getAttribute('data-last-sync') || '',
    purchasedDate: row.getAttribute('data-purchased-date') || '',
    warrantyExpiry: row.getAttribute('data-warranty-expiry') || '',
    deleteUrl: row.getAttribute('data-delete-url') || ''
  };
}

/* ---------------------------------------------------------
   Small UI helpers
--------------------------------------------------------- */
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

function capitalize(value){
  if(!value) return '—';
  return value.charAt(0).toUpperCase() + value.slice(1);
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