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