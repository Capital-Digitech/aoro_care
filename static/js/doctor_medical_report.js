/* =========================================================
   HEALTH RING — Doctor Medical Reports Behavior
   Mirrors doctor_live_monitoring.js: sidebar/theme toggle,
   search/filter, client-side pagination, toast. Read-only
   page — View is populated entirely from the data already
   rendered into each row (no fetch, no invented endpoints,
   no POST requests). Download is a plain anchor tag handled
   natively by the browser.
   ========================================================= */

const HR_ROWS_PER_PAGE = 10;
let hrReportCurrentPage = 1;

document.addEventListener('DOMContentLoaded', () => {
  initSidebarToggle();
  initThemeToggle();
  initTableSearchFilter();
  initRowActionHandlers();
  renderPagination();
});

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
   Dark mode toggle (persisted — same key as the rest of the
   Doctor Portal, so theme stays in sync across pages)
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
   Search + type/status/date filter over rendered rows.
   Pure client-side filter — the server already scopes rows
   to the logged-in doctor's patients. No AJAX, no fetch.
--------------------------------------------------------- */
function initTableSearchFilter(){
  const searchInput = document.getElementById('hrReportSearch');
  const typeFilter = document.getElementById('hrFilterType');
  const statusFilter = document.getElementById('hrFilterStatus');
  const dateFilter = document.getElementById('hrFilterDate');
  const resetBtn = document.getElementById('hrResetFilters');
  const table = document.getElementById('hrReportTable');
  if(!table) return;

  function applyFilters(){
    hrReportCurrentPage = 1;
    renderPagination();
  }

  searchInput?.addEventListener('input', applyFilters);
  typeFilter?.addEventListener('change', applyFilters);
  statusFilter?.addEventListener('change', applyFilters);
  dateFilter?.addEventListener('change', applyFilters);
  resetBtn?.addEventListener('click', () => {
    if(searchInput) searchInput.value = '';
    if(typeFilter) typeFilter.value = '';
    if(statusFilter) statusFilter.value = '';
    if(dateFilter) dateFilter.value = '';
    applyFilters();
  });
}

/* ---------------------------------------------------------
   Returns all real data rows (excludes empty-state rows).
--------------------------------------------------------- */
function getAllRows(){
  const table = document.getElementById('hrReportTable');
  if(!table) return [];
  return Array.from(table.querySelectorAll('tbody tr'))
    .filter(r => r.id !== 'hrEmptyRow' && r.id !== 'hrDynamicEmptyRow');
}

/* ---------------------------------------------------------
   Returns rows matching the current search/filter state.
--------------------------------------------------------- */
function getFilteredRows(){
  const searchInput = document.getElementById('hrReportSearch');
  const typeFilter = document.getElementById('hrFilterType');
  const statusFilter = document.getElementById('hrFilterStatus');
  const dateFilter = document.getElementById('hrFilterDate');

  const term = (searchInput?.value || '').trim().toLowerCase();
  const type = typeFilter?.value || '';
  const status = statusFilter?.value || '';
  const dateValue = dateFilter?.value || '';

  return getAllRows().filter(row => {
    const text = row.textContent.toLowerCase();
    const matchesSearch = !term || text.includes(term);

    const rowType = row.getAttribute('data-report-type') || '';
    const matchesType = !type || rowType === type;

    const rowStatus = row.getAttribute('data-status') || '';
    const matchesStatus = !status || rowStatus === status;

    const rowDate = row.getAttribute('data-generated-date') || '';
    const matchesDate = !dateValue || rowDate === dateValue;

    return matchesSearch && matchesType && matchesStatus && matchesDate;
  });
}

/* ---------------------------------------------------------
   Pagination — slices the filtered rows into pages of
   HR_ROWS_PER_PAGE and renders the .hr-pagination controls.
--------------------------------------------------------- */
function renderPagination(){
  const table = document.getElementById('hrReportTable');
  const paginationBar = document.getElementById('hrPaginationBar');
  const paginationInfo = document.getElementById('hrPaginationInfo');
  const paginationEl = document.getElementById('hrPagination');
  if(!table || !paginationBar || !paginationInfo || !paginationEl) return;

  const allRows = getAllRows();
  const filteredRows = getFilteredRows();
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / HR_ROWS_PER_PAGE));

  if(hrReportCurrentPage > totalPages) hrReportCurrentPage = totalPages;
  if(hrReportCurrentPage < 1) hrReportCurrentPage = 1;

  allRows.forEach(row => { row.style.display = 'none'; });

  const start = (hrReportCurrentPage - 1) * HR_ROWS_PER_PAGE;
  const pageRows = filteredRows.slice(start, start + HR_ROWS_PER_PAGE);
  pageRows.forEach(row => { row.style.display = ''; });

  toggleEmptyState(filteredRows.length === 0);

  if(filteredRows.length === 0){
    paginationInfo.textContent = 'No reports to show';
  } else {
    paginationInfo.innerHTML =
      `Showing <strong>${start + 1}–${Math.min(start + HR_ROWS_PER_PAGE, filteredRows.length)}</strong> of <strong>${filteredRows.length}</strong>`;
  }

  paginationEl.innerHTML = '';
  paginationBar.style.display = filteredRows.length === 0 ? 'none' : 'flex';

  const prevBtn = document.createElement('li');
  prevBtn.innerHTML = `<button class="hr-page-btn" ${hrReportCurrentPage === 1 ? 'disabled' : ''} data-page="prev"><i class="fa-solid fa-chevron-left"></i></button>`;
  paginationEl.appendChild(prevBtn);

  for(let page = 1; page <= totalPages; page++){
    const pageBtn = document.createElement('li');
    pageBtn.innerHTML = `<button class="hr-page-btn ${page === hrReportCurrentPage ? 'active' : ''}" data-page="${page}">${page}</button>`;
    paginationEl.appendChild(pageBtn);
  }

  const nextBtn = document.createElement('li');
  nextBtn.innerHTML = `<button class="hr-page-btn" ${hrReportCurrentPage === totalPages ? 'disabled' : ''} data-page="next"><i class="fa-solid fa-chevron-right"></i></button>`;
  paginationEl.appendChild(nextBtn);

  paginationEl.querySelectorAll('[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-page');
      if(target === 'prev') hrReportCurrentPage -= 1;
      else if(target === 'next') hrReportCurrentPage += 1;
      else hrReportCurrentPage = parseInt(target, 10);
      renderPagination();
    });
  });
}

function toggleEmptyState(isEmpty){
  const table = document.getElementById('hrReportTable');
  if(!table) return;
  let emptyRow = table.querySelector('#hrDynamicEmptyRow');
  if(isEmpty){
    if(!emptyRow && !table.querySelector('#hrEmptyRow')){
      emptyRow = document.createElement('tr');
      emptyRow.id = 'hrDynamicEmptyRow';
      emptyRow.innerHTML = `
        <td colspan="7">
          <div class="hr-empty-state">
            <div class="hr-empty-icon"><i class="fa-solid fa-magnifying-glass"></i></div>
            <h4>No matching reports</h4>
            <p>Try adjusting your search or filters.</p>
          </div>
        </td>`;
      table.querySelector('tbody').appendChild(emptyRow);
    } else if(emptyRow){
      emptyRow.style.display = '';
    }
  } else if(emptyRow){
    emptyRow.style.display = 'none';
  }
}

/* ---------------------------------------------------------
   Row action handler — View only. Download is a plain <a>
   handled natively by the browser, no JS required for it.
   Populated directly from the row's data attributes.
--------------------------------------------------------- */
function initRowActionHandlers(){
  const table = document.getElementById('hrReportTable');
  if(!table) return;

  table.addEventListener('click', (event) => {
    const viewBtn = event.target.closest('[data-action="view"]');
    if(viewBtn) return handleView(viewBtn);
  });
}

function handleView(button){
  const row = button.closest('tr');
  if(!row) return;

  const modalEl = document.getElementById('hrViewModal');
  const header = document.getElementById('hrViewReportHeader');
  const body = document.getElementById('hrViewModalBody');
  const downloadLink = document.getElementById('hrViewModalDownload');
  if(!modalEl || !header || !body) return;

  const data = readRowData(row);
  const initials = data.patientName
    ? data.patientName.trim().split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase()
    : '-';

  header.innerHTML = `
    <div class="hr-person-avatar" style="background:var(--hr-primary)">${escapeHtml(initials)}</div>
    <div>
      <div class="hr-report-header-title">${escapeHtml(data.reportTitle || 'Untitled Report')}</div>
      <div class="hr-report-header-sub">
        ${escapeHtml(data.patientName || '—')} · Code: ${escapeHtml(data.patientCode || '—')}
      </div>
    </div>
  `;

  const statusLabels = {
    pending: 'Pending Review',
    reviewed: 'Reviewed',
    completed: 'Completed'
  };

  const rows = [
    ['Report ID', `#${data.reportId || '—'}`],
    ['Report Type', data.reportType ? capitalize(data.reportType) : '—'],
    ['Generated Date', data.generatedAt || '—'],
    ['Status', statusLabels[data.status] || capitalize(data.status)],
    ['Notes', data.notes || '—']
  ];

  body.innerHTML = rows.map(([label, value]) => `
    <div class="hr-detail-row">
      <span class="hr-detail-label">${label}</span>
      <span class="hr-detail-value">${escapeHtml(String(value))}</span>
    </div>
  `).join('');

  if(downloadLink){
    if(data.file){
      downloadLink.href = data.file;
      downloadLink.classList.remove('d-none');
    } else {
      downloadLink.href = '#';
      downloadLink.classList.add('d-none');
    }
  }

  bootstrap.Modal.getOrCreateInstance(modalEl).show();
}

/* ---------------------------------------------------------
   Read a table row's data-* attributes into a plain object.
--------------------------------------------------------- */
function readRowData(row){
  return {
    reportId: row.getAttribute('data-report-id') || '',
    status: row.getAttribute('data-status') || '',
    reportType: row.getAttribute('data-report-type') || '',
    reportTitle: row.getAttribute('data-report-title') || '',
    patientName: row.getAttribute('data-patient-name') || '',
    patientCode: row.getAttribute('data-patient-code') || '',
    notes: row.getAttribute('data-notes') || '',
    file: row.getAttribute('data-file') || '',
    generatedAt: row.getAttribute('data-generated-at') || ''
  };
}

/* ---------------------------------------------------------
   Small UI helpers
--------------------------------------------------------- */
function capitalize(value){
  if(!value) return '—';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/* ---------------------------------------------------------
   Toast helper — showToast('message', 'success' | 'error')
   Kept for parity with the rest of the portal even though
   this read-only page has no actions that trigger it today.
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