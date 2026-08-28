/* =========================================================
   HEALTH RING — Emergency Alert Management Behavior
   Sidebar/theme reuse admin_dashboard.js if loaded globally;
   this file only adds page-specific behavior.
   Same coding style as ring_management.js / patient_management.js.
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {
  initSidebarToggle();
  initThemeToggle();
  initTableSearchFilter();
  initDeleteModal();
  initFormValidation();
  initPagination();
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
   Client-side search + severity/status/alert-type filter over
   rendered rows. Pure UI filter — does not touch server
   pagination/query logic.
--------------------------------------------------------- */
function initTableSearchFilter(){
  const searchInput = document.getElementById('hrAlertSearch');
  const severityFilter = document.getElementById('hrFilterSeverity');
  const statusFilter = document.getElementById('hrFilterStatus');
  const typeFilter = document.getElementById('hrFilterAlertType');
  const resetBtn = document.getElementById('hrResetFilters');
  const table = document.getElementById('hrAlertTable');
  if(!table) return;

  const getRows = () => Array.from(table.querySelectorAll('tbody tr')).filter(r => r.id !== 'hrEmptyRow');

  function applyFilters(){
    const term = (searchInput?.value || '').trim().toLowerCase();
    const severity = severityFilter?.value || '';
    const status = statusFilter?.value || '';
    const type = typeFilter?.value || '';
    const rows = getRows();
    let visibleCount = 0;

    rows.forEach(row => {
      const text = row.textContent.toLowerCase();
      const matchesSearch = !term || text.includes(term);

      const rowSeverity = row.getAttribute('data-severity') || '';
      const matchesSeverity = !severity || rowSeverity === severity;

      const rowStatus = row.getAttribute('data-status') || '';
      const matchesStatus = !status || rowStatus === status;

      const rowType = row.getAttribute('data-alert-type') || '';
      const matchesType = !type || rowType === type;

      const show = matchesSearch && matchesSeverity && matchesStatus && matchesType;
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
              <h4>No matching emergency alerts</h4>
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
  typeFilter?.addEventListener('change', applyFilters);
  resetBtn?.addEventListener('click', () => {
    if(searchInput) searchInput.value = '';
    if(severityFilter) severityFilter.value = '';
    if(statusFilter) statusFilter.value = '';
    if(typeFilter) typeFilter.value = '';
    applyFilters();
  });
}

/* ---------------------------------------------------------
   Delete confirmation modal — wires the row's data attributes
   into the confirm dialog and its existing delete form action.
   Assumes a Flask endpoint accepting an alert id at
   /emergency-alert/delete/<id> — update the url pattern below if
   yours differs.
--------------------------------------------------------- */
function initDeleteModal(){
  const modal = document.getElementById('hrDeleteModal');
  if(!modal) return;

  modal.addEventListener('show.bs.modal', (event) => {
    const trigger = event.relatedTarget;
    if(!trigger) return;

    const alertId = trigger.getAttribute('data-alert-id');
    const alertName = trigger.getAttribute('data-alert-name');

    const nameEl = document.getElementById('hrDeleteAlertName');
    const form = document.getElementById('hrDeleteForm');

    if(nameEl) nameEl.textContent = alertName || 'this emergency alert';
    if(form && alertId){
      // NOTE: adjust this path to match your actual delete route/blueprint.
      form.action = `/emergency-alert/delete/${alertId}`;
    }
  });
}

/* ---------------------------------------------------------
   Floating-label form validation (client-side UX only —
   server-side validation in Flask remains the source of truth)
--------------------------------------------------------- */
function initFormValidation(){
  const form = document.getElementById('hrAlertForm');
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
   CSRF helper — attach automatically to any fetch() call this
   page makes (none by default; forms submit via normal POST
   with the hidden csrf_token field already in the DOM, same
   as ring_management.js). Kept here so any future AJAX added
   to this page picks up the token without extra wiring.
--------------------------------------------------------- */
function getCsrfToken(){
  const input = document.querySelector('input[name="csrf_token"]');
  return input ? input.value : '';
}

function hrFetch(url, options = {}){
  const token = getCsrfToken();
  const headers = Object.assign({}, options.headers, token ? { 'X-CSRFToken': token } : {});
  return fetch(url, Object.assign({}, options, { headers }));
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