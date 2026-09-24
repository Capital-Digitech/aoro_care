/* =========================================================
   HEALTH RING — Doctor · My Patients Behavior
   Mirrors doctor_dashboard.js structure/conventions.
   No jQuery. Vanilla ES6 only.
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {
  initSidebarToggle();
  initThemeToggle();
  initLoadingAnimation();
  initTableSearchFilter();
  initTopbarSearchSync();
  initViewModal();
  initTooltips();
  initPagination();
  initGlobalSearch();
  highlightPatientRowFromHash();
});

/* ---------------------------------------------------------
   Sidebar toggle (mobile / tablet) — identical to Dashboard
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
   Dark mode toggle (persisted) — same key as Doctor Dashboard
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
   Loading animation — brief skeleton shimmer while the table
   settles in on first paint (purely cosmetic, no data fetch).
--------------------------------------------------------- */
function initLoadingAnimation(){
  const table = document.getElementById('hrPatientTable');
  if(!table) return;

  table.classList.add('hr-table-loading');
  window.requestAnimationFrame(() => {
    setTimeout(() => table.classList.remove('hr-table-loading'), 260);
  });
}

/* ---------------------------------------------------------
   Client-side search + status/ring filter over rendered rows.
--------------------------------------------------------- */
function initTableSearchFilter(){
  const searchInput = document.getElementById('hrPatientSearch');
  const statusFilter = document.getElementById('hrFilterStatus');
  const ringFilter = document.getElementById('hrFilterRing');
  const resetBtn = document.getElementById('hrResetFilters');
  const table = document.getElementById('hrPatientTable');
  if(!table) return;

  const getRows = () => Array.from(table.querySelectorAll('tbody tr')).filter(r => r.id !== 'hrEmptyRow');

  function applyFilters(){
    const term = (searchInput?.value || '').trim().toLowerCase();
    const status = (statusFilter?.value || '').toLowerCase();
    const ring = (ringFilter?.value || '').toLowerCase();
    const rows = getRows();
    let visibleCount = 0;

    rows.forEach(row => {
      const text = row.textContent.toLowerCase();
      const matchesSearch = !term || text.includes(term);

      const statusBadge = row.querySelector('.hr-badge');
      const rowStatus = statusBadge ? statusBadge.textContent.trim().toLowerCase() : '';
      const matchesStatus = !status || rowStatus === status;

      const ringCell = row.children[6];
      const rowRing = ringCell ? ringCell.textContent.trim().toLowerCase() : '';
      const matchesRing = !ring || rowRing === ring;

      const show = matchesSearch && matchesStatus && matchesRing;
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
              <h4>No matching patients</h4>
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
  ringFilter?.addEventListener('change', applyFilters);
  resetBtn?.addEventListener('click', () => {
    if(searchInput) searchInput.value = '';
    if(statusFilter) statusFilter.value = '';
    if(ringFilter) ringFilter.value = '';
    applyFilters();
  });
}

/* ---------------------------------------------------------
   Keep the topbar's global search in sync with the page's
   dedicated patient search — typing in either filters the table.
--------------------------------------------------------- */
function initTopbarSearchSync(){
  const topbarSearch = document.getElementById('hrSearchPatient');
  const pageSearch = document.getElementById('hrPatientSearch');
  if(!topbarSearch || !pageSearch) return;

  topbarSearch.addEventListener('input', () => {
    pageSearch.value = topbarSearch.value;
    pageSearch.dispatchEvent(new Event('input'));
  });
}

/* ---------------------------------------------------------
   View Patient modal — populates from data-* attributes on
   the triggering "View" action button.
--------------------------------------------------------- */
function initViewModal(){
  const modal = document.getElementById('hrViewPatientModal');
  if(!modal) return;

  modal.addEventListener('show.bs.modal', (event) => {
    const trigger = event.relatedTarget;
    if(!trigger) return;

    const name = trigger.getAttribute('data-name') || '—';

    setText('hrViewName', name);
    setText('hrViewCode', trigger.getAttribute('data-code'));
    setText('hrViewGender', trigger.getAttribute('data-gender'));
    setText('hrViewAge', trigger.getAttribute('data-age'));
    setText('hrViewBlood', trigger.getAttribute('data-blood'));
    setText('hrViewDoctor', trigger.getAttribute('data-doctor'));
    setText('hrViewEmergency', trigger.getAttribute('data-emergency'));
    setText('hrViewHistory', trigger.getAttribute('data-history'));
    setText('hrViewHeartRate', formatUnit(trigger.getAttribute('data-heart-rate'), 'bpm'));
    setText('hrViewSpo2', formatUnit(trigger.getAttribute('data-spo2'), '%'));
    setText('hrViewTemperature', formatUnit(trigger.getAttribute('data-temperature'), '°F'));
    setText('hrViewAppointment', trigger.getAttribute('data-appointment'));
    setText('hrViewReport', trigger.getAttribute('data-report'));

    const avatar = document.getElementById('hrViewAvatar');
    if(avatar) avatar.textContent = initials(name);

    const ringStatus = (trigger.getAttribute('data-ring-status') || 'disconnected').toLowerCase();
    const dot = document.getElementById('hrViewRingDot');
    const ringText = document.getElementById('hrViewRingText');

    if(dot && ringText){
      dot.className = 'hr-ring-status-dot';
      if(ringStatus === 'online'){
        dot.classList.add('hr-ring-online');
        ringText.textContent = 'Connected';
      } else if(ringStatus === 'charging'){
        dot.classList.add('hr-ring-charging');
        ringText.textContent = 'Charging';
      } else {
        dot.classList.add('hr-ring-disconnected');
        ringText.textContent = 'Disconnected';
      }
    }
  });

  function setText(id, value){
    const el = document.getElementById(id);
    if(el) el.textContent = value && value.trim() ? value : '—';
  }

  function initials(fullName){
    if(!fullName) return '—';
    return fullName.trim().split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase();
  }

  function formatUnit(value, unit){
    if(!value || value === '—' || value === 'None') return '—';
    return `${value} ${unit}`;
  }
}

/* ---------------------------------------------------------
   Bootstrap tooltips — for row action icon buttons (title attr)
--------------------------------------------------------- */
function initTooltips(){
  if(typeof bootstrap === 'undefined' || !bootstrap.Tooltip) return;
  const triggers = document.querySelectorAll('[title]');
  triggers.forEach(el => {
    if(el.closest('.hr-row-actions')){
      new bootstrap.Tooltip(el, { placement: 'top', trigger: 'hover' });
    }
  });
}

/* ---------------------------------------------------------
   Pagination — visual only; wire hrPageBtn clicks to Flask
   pagination (e.g. ?page=N) once server-side paging is added.
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
   DOCTOR PORTAL GLOBAL SEARCH
   Backed by GET pages.doctor_global_search (url read from the
   input's data-search-url attribute, rendered via url_for()).
   Response shape: {"results": [{category,title,subtitle,url,icon}]}.
   Debounced, min 2 chars, doctor-scoped on the server. Exposes
   window.HRPortalSearch.run(value) per the shared-handler
   convention also used by doctor_dashboard.js, so either
   topbar search box drives the same backend consistently.
--------------------------------------------------------- */
function initGlobalSearch(){
  const input = document.getElementById('hrTopbarSearch');
  const panel = document.getElementById('hrSearchResults');
  const wrap = document.getElementById('hrGlobalSearchWrap');
  if(!input || !panel || !wrap) return;

  // Real backend URL, rendered server-side via url_for() — never
  // hand-built on the client.
  const searchUrl = input.dataset.searchUrl;
  if(!searchUrl) return;

  const CATEGORY_ORDER = [
    'Patients', 'Appointments', 'Prescriptions', 'Health Ring',
    'Emergency Alerts', 'Reports', 'Notifications', 'AI Insights'
  ];

  let debounceTimer = null;
  let activeController = null;
  let latestRequestId = 0;

  function openPanel(){ panel.classList.add('show'); }
  function closePanel(){ panel.classList.remove('show'); }

  function renderState(html){
    panel.innerHTML = html;
    openPanel();
  }

  function renderLoading(){
    renderState(`
      <div class="hr-search-state">
        <i class="fa-solid fa-spinner fa-spin"></i> Searching…
      </div>`);
  }

  function renderError(){
    renderState(`
      <div class="hr-search-state">
        <i class="fa-solid fa-triangle-exclamation"></i> Something went wrong. Please try again.
      </div>`);
  }

  function renderEmpty(){
    renderState(`
      <div class="hr-search-state">
        <i class="fa-solid fa-magnifying-glass"></i> No results found
      </div>`);
  }

  function escapeGlobalSearchText(str){
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  function renderResults(items){
    if(!items || items.length === 0){
      renderEmpty();
      return;
    }

    const byCategory = {};
    items.forEach(item => {
      const cat = item.category || 'Results';
      if(!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(item);
    });

    let html = '';
    CATEGORY_ORDER.forEach(cat => {
      const group = byCategory[cat];
      if(!group || group.length === 0) return;

      html += `<div class="hr-search-section-label">${escapeGlobalSearchText(cat)}</div>`;
      group.forEach(item => { html += renderItem(item); });
    });

    renderState(html);
  }

  function renderItem(item){
    const title = escapeGlobalSearchText(item.title);
    const sub = escapeGlobalSearchText(item.subtitle);
    const icon = item.icon || 'fa-solid fa-circle';
    const url = item.url || '';

    return `
      <a class="hr-search-result-item" href="${escapeGlobalSearchText(url)}">
        <span class="hr-search-result-icon"><i class="${icon}"></i></span>
        <span class="hr-search-result-body">
          <span class="hr-search-result-title">${title}</span>
          <br>
          <span class="hr-search-result-sub">${sub}</span>
        </span>
      </a>`;
  }

  async function runSearch(query){
    const term = (query || '').trim();

    if(term.length < 2){
      closePanel();
      return;
    }

    renderLoading();

    const requestId = ++latestRequestId;

    if(activeController) activeController.abort();
    activeController = new AbortController();

    try {
      const response = await fetch(
        `${searchUrl}?q=${encodeURIComponent(term)}`,
        { credentials: 'same-origin', signal: activeController.signal }
      );

      if(requestId !== latestRequestId) return;

      if(!response.ok){
        renderError();
        return;
      }

      const payload = await response.json();

      if(requestId !== latestRequestId) return;

      renderResults((payload && payload.results) || []);

    } catch(err){
      if(err && err.name === 'AbortError') return;
      if(requestId !== latestRequestId) return;
      renderError();
    }
  }

  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const value = input.value;

    if(value.trim().length < 2){
      closePanel();
      return;
    }

    debounceTimer = setTimeout(() => runSearch(value), 300);
  });

  input.addEventListener('keydown', (e) => {
    if(e.key === 'Escape'){
      closePanel();
      input.blur();
    }
  });

  input.addEventListener('focus', () => {
    if(input.value.trim().length >= 2 && panel.innerHTML.trim()){
      openPanel();
    }
  });

  document.addEventListener('click', (e) => {
    if(!wrap.contains(e.target)) closePanel();
  });

  window.HRPortalSearch = {
    run(value){
      if(typeof value === 'string') input.value = value;
      clearTimeout(debounceTimer);
      runSearch(input.value);
    }
  };
}

/* ---------------------------------------------------------
   When arriving via a search result link (#patient-row-<id>),
   scroll to that row in the table and briefly highlight it.
--------------------------------------------------------- */
function highlightPatientRowFromHash(){
  if(!location.hash || !location.hash.startsWith('#patient-row-')) return;

  const row = document.querySelector(location.hash);
  if(!row) return;

  row.scrollIntoView({ behavior: 'smooth', block: 'center' });
  row.classList.add('hr-row-highlight');
  setTimeout(() => row.classList.remove('hr-row-highlight'), 2300);
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