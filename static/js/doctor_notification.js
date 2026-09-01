/* =========================================================
   HEALTH RING — Doctor Notifications Behavior
   Same structure as doctor_emergency_alert.js: sidebar/theme
   toggle, client-side search, AJAX mark-as-read, view modal,
   live badge/counter updates, toast.
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {
  initSidebarToggle();
  initThemeToggle();
  initTableSearch();
  initRowActionHandlers();
});

/* ---------------------------------------------------------
   CSRF helper — reads the token from the page's meta tag and
   attaches it to every AJAX request as required by Flask-WTF.
--------------------------------------------------------- */
function getCsrfToken(){
  const meta = document.querySelector('meta[name="csrf-token"]');
  return meta ? meta.getAttribute('content') : '';
}

async function postJSON(url){
  const csrfToken = getCsrfToken();

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': csrfToken
    },
    body: JSON.stringify({}),
    credentials: 'same-origin'
  });

  let payload = null;
  try{ payload = await response.json(); }catch(err){ /* non-JSON error page */ }

  if(!response.ok){
    const message = (payload && payload.message) || 'Request failed. Please try again.';
    throw new Error(message);
  }
  return payload;
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
   Dark mode toggle (persisted — same key as doctor_dashboard.js
   and doctor_emergency_alert.js, so theme stays in sync)
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
   Search — filters by Title, Message, or Type.
   Pure client-side filter — the server already scopes rows
   to the logged-in doctor.
--------------------------------------------------------- */
function initTableSearch(){
  const searchInput = document.getElementById('hrNotificationSearch');
  const resetBtn = document.getElementById('hrResetSearch');
  const table = document.getElementById('hrNotificationTable');
  if(!table) return;

  const getRows = () => Array.from(table.querySelectorAll('tbody tr'))
    .filter(r => r.id !== 'hrEmptyRow' && r.id !== 'hrDynamicEmptyRow');

  function applyFilter(){
    const term = (searchInput?.value || '').trim().toLowerCase();
    const rows = getRows();
    let visibleCount = 0;

    rows.forEach(row => {
      const text = row.textContent.toLowerCase();
      const show = !term || text.includes(term);
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
          <td colspan="6">
            <div class="hr-empty-state">
              <div class="hr-empty-icon"><i class="fa-solid fa-magnifying-glass"></i></div>
              <h4>No matching notifications</h4>
              <p>Try adjusting your search.</p>
            </div>
          </td>`;
        table.querySelector('tbody').appendChild(emptyRow);
      }
    } else if(emptyRow){
      emptyRow.remove();
    }
  }

  searchInput?.addEventListener('input', applyFilter);
  resetBtn?.addEventListener('click', () => {
    if(searchInput) searchInput.value = '';
    applyFilter();
  });
}

/* ---------------------------------------------------------
   Row action handlers — View opens the modal (auto-marks as
   read if needed) and Mark as Read updates the row in place.
--------------------------------------------------------- */
function initRowActionHandlers(){
  const table = document.getElementById('hrNotificationTable');
  if(!table) return;

  table.addEventListener('click', (event) => {
    const viewBtn = event.target.closest('[data-action="view"]');
    if(viewBtn) return handleView(viewBtn);

    const markReadBtn = event.target.closest('[data-action="mark-read"]');
    if(markReadBtn) return handleMarkRead(markReadBtn);
  });
}

function handleView(button){
  const body = document.getElementById('hrViewNotificationModalBody');
  const modalEl = document.getElementById('hrViewNotificationModal');
  if(!body || !modalEl) return;

  const row = button.closest('tr');
  const isRead = button.getAttribute('data-read') === 'true';

  const typeLabels = {
    alert: 'Alert',
    appointment: 'Appointment',
    report: 'Report',
    system: 'System'
  };
  const typeValue = typeLabels[button.getAttribute('data-type')] || button.getAttribute('data-type');

  body.innerHTML = `
    <div class="hr-detail-row">
      <span class="hr-detail-label">Title</span>
      <span class="hr-detail-value">${escapeHtml(button.getAttribute('data-title') || '-')}</span>
    </div>
    <div class="hr-detail-row">
      <span class="hr-detail-label">Type</span>
      <span class="hr-detail-value">${escapeHtml(typeValue || '-')}</span>
    </div>
    <div class="hr-detail-row">
      <span class="hr-detail-label">Created Date</span>
      <span class="hr-detail-value">${escapeHtml(button.getAttribute('data-created') || '-')}</span>
    </div>
    <div class="hr-detail-row">
      <span class="hr-detail-label">Status</span>
      <span class="hr-detail-value" id="hrModalStatusValue">${isRead ? 'Read' : 'Unread'}</span>
    </div>
    <div class="hr-detail-row">
      <span class="hr-detail-label">Message</span>
      <span class="hr-detail-value hr-detail-message">${escapeHtml(button.getAttribute('data-message') || '-')}</span>
    </div>
  `;

  bootstrap.Modal.getOrCreateInstance(modalEl).show();

  if(!isRead){
    const markReadUrl = button.getAttribute('data-mark-read-url');
    markNotificationRead(markReadUrl, row, { silentToast: true })
      .then(() => {
        button.setAttribute('data-read', 'true');
        const statusValue = document.getElementById('hrModalStatusValue');
        if(statusValue) statusValue.textContent = 'Read';
      })
      .catch(err => showToast(err.message, 'error'));
  }
}

function handleMarkRead(button){
  const row = button.closest('tr');
  const markReadUrl = button.getAttribute('data-mark-read-url');

  markNotificationRead(markReadUrl, row, { button })
    .then(() => showToast('Notification marked as read.', 'success'))
    .catch(err => showToast(err.message, 'error'));
}

/* ---------------------------------------------------------
   Shared mark-as-read call — updates the row's status badge,
   hides the "Mark as Read" action, and decrements the unread
   counters (stat card + sidebar badge) without a page reload.
--------------------------------------------------------- */
function markNotificationRead(url, row, { button, silentToast } = {}){
  if(!url) return Promise.reject(new Error('Missing notification URL.'));
  if(row && row.getAttribute('data-read') === 'true') return Promise.resolve();

  setRowBusy(row, true);
  if(button) setButtonLoading(button, true);

  return postJSON(url)
    .then(data => {
      updateRowRead(row);
      decrementUnreadCounters();
      return data;
    })
    .finally(() => {
      setRowBusy(row, false);
      if(button) setButtonLoading(button, false);
    });
}

function updateRowRead(row){
  if(!row) return;
  row.setAttribute('data-read', 'true');

  const statusBadge = row.querySelector('[data-role="status-badge"]');
  if(statusBadge){
    statusBadge.className = 'hr-badge hr-badge-success';
    statusBadge.textContent = 'Read';
  }

  const viewBtn = row.querySelector('[data-action="view"]');
  if(viewBtn) viewBtn.setAttribute('data-read', 'true');

  const markReadBtn = row.querySelector('[data-action="mark-read"]');
  if(markReadBtn) markReadBtn.classList.add('d-none');
}

function decrementUnreadCounters(){
  const statValue = document.getElementById('hrUnreadStatValue');
  if(statValue){
    const current = parseInt(statValue.textContent, 10) || 0;
    statValue.textContent = Math.max(current - 1, 0);
  }

  const sidebarBadge = document.getElementById('hrSidebarUnreadBadge');
  if(sidebarBadge){
    const current = parseInt(sidebarBadge.textContent, 10) || 0;
    const next = Math.max(current - 1, 0);
    if(next === 0){
      sidebarBadge.remove();
    } else {
      sidebarBadge.textContent = next;
    }
  }
}

function setRowBusy(row, busy){
  if(row) row.classList.toggle('hr-row-busy', busy);
}

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