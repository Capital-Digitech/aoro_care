/* =========================================================
   HEALTH RING — Report Management Behavior
   Sidebar/theme reuse admin_dashboard.js if loaded globally;
   this file only adds page-specific behavior.
   Same coding style as patient_management.js.
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {
  initSidebarToggle();
  initThemeToggle();
  initTableSearchFilter();
  initDeleteModal();
  initFormValidation();
  initPagination();
  initFileInputPreview();
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
   Client-side search + doctor/type/date filter over rendered
   rows. Pure UI filter — does not touch server pagination/
   query logic.
--------------------------------------------------------- */
function initTableSearchFilter(){
  const searchInput = document.getElementById('hrReportSearch');
  const doctorFilter = document.getElementById('hrFilterDoctor');
  const typeFilter = document.getElementById('hrFilterType');
  const dateFilter = document.getElementById('hrFilterDate');
  const resetBtn = document.getElementById('hrResetFilters');
  const table = document.getElementById('hrReportTable');
  if(!table) return;

  const getRows = () => Array.from(table.querySelectorAll('tbody tr')).filter(r => r.id !== 'hrEmptyRow');

  function applyFilters(){
    const term = (searchInput?.value || '').trim().toLowerCase();
    const doctor = doctorFilter?.value || '';
    const type = typeFilter?.value || '';
    const dateValue = dateFilter?.value || '';
    const rows = getRows();
    let visibleCount = 0;

    rows.forEach(row => {
      const text = row.textContent.toLowerCase();
      const matchesSearch = !term || text.includes(term);

      const rowDoctor = row.getAttribute('data-doctor-id') || '';
      const matchesDoctor = !doctor || rowDoctor === doctor;

      const rowType = row.getAttribute('data-report-type') || '';
      const matchesType = !type || rowType === type;

      const rowDate = row.getAttribute('data-generated-date') || '';
      const matchesDate = !dateValue || rowDate === dateValue;

      const show = matchesSearch && matchesDoctor && matchesType && matchesDate;
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
          <td colspan="8">
            <div class="hr-empty-state">
              <div class="hr-empty-icon"><i class="fa-solid fa-magnifying-glass"></i></div>
              <h4>No matching reports</h4>
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
  doctorFilter?.addEventListener('change', applyFilters);
  typeFilter?.addEventListener('change', applyFilters);
  dateFilter?.addEventListener('change', applyFilters);
  resetBtn?.addEventListener('click', () => {
    if(searchInput) searchInput.value = '';
    if(doctorFilter) doctorFilter.value = '';
    if(typeFilter) typeFilter.value = '';
    if(dateFilter) dateFilter.value = '';
    applyFilters();
  });
}

/* ---------------------------------------------------------
   Delete confirmation modal — wires the row's data attributes
   into the confirm dialog and its existing delete form action.
   Assumes a Flask endpoint accepting a report id at
   /report/delete/<id> — update the url pattern below if
   yours differs.
--------------------------------------------------------- */
function initDeleteModal(){
  const modal = document.getElementById('hrDeleteModal');
  if(!modal) return;

  modal.addEventListener('show.bs.modal', (event) => {
    const trigger = event.relatedTarget;
    if(!trigger) return;

    const reportId = trigger.getAttribute('data-report-id');
    const reportName = trigger.getAttribute('data-report-name');

    const nameEl = document.getElementById('hrDeleteReportName');
    const form = document.getElementById('hrDeleteForm');

    if(nameEl) nameEl.textContent = reportName || 'this report';
    if(form && reportId){
      // NOTE: adjust this path to match your actual delete route/blueprint.
      form.action = `/report/delete/${reportId}`;
    }
  });
}

/* ---------------------------------------------------------
   Floating-label form validation (client-side UX only —
   server-side validation in Flask remains the source of truth)
--------------------------------------------------------- */
function initFormValidation(){
  const form = document.getElementById('hrReportForm');
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
   File input preview — shows the chosen filename and blocks
   obviously invalid extensions client-side (server remains
   the source of truth for validation).
--------------------------------------------------------- */
function initFileInputPreview(){
  const fileInputs = document.querySelectorAll('input[type="file"][name="report_file"]');

  fileInputs.forEach(input => {
    input.addEventListener('change', () => {
      const hint = input.closest('.hr-field')?.querySelector('.hr-upload-hint');
      if(!hint) return;

      const file = input.files?.[0];
      if(!file){
        hint.textContent = 'Accepted formats: PDF, DOCX — max size 10 MB';
        return;
      }

      const extension = file.name.split('.').pop().toLowerCase();
      const allowed = ['pdf', 'docx'];
      const maxSize = 10 * 1024 * 1024;

      if(!allowed.includes(extension)){
        hint.textContent = `"${file.name}" is not a supported format. Use PDF or DOCX.`;
        input.value = '';
        return;
      }

      if(file.size > maxSize){
        hint.textContent = `"${file.name}" exceeds the 10 MB limit.`;
        input.value = '';
        return;
      }

      hint.textContent = `Selected: ${file.name}`;
    });
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
      // TODO: navigate to `?page=${btn.textContent.trim()}` once
      // server-side pagination is connected.
    });
  });
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