/* =========================================================
   HEALTH RING — Patient Notifications Behavior
   Client-side search, AJAX mark-as-read, mark-all-read, view modal,
   live counter / badge updates, toast. Sidebar and dark mode are
   handled by patient_dashboard.js.
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {
  initTableSearch();
  initRowActionHandlers();
  initMarkAll();
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
   Search — filters by Title, Message, or Type.
   Pure client-side filter — the server already scopes rows
   to the logged-in patient.
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
      decrementUnreadCounters(data && data.unread_count);
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

function setUnreadCounters(count){
  const statValue = document.getElementById('hrUnreadStatValue');
  if(statValue) statValue.textContent = count;

  const navBadge = document.getElementById('hrNotifNavBadge');
  if(navBadge){
    navBadge.textContent = count || '';
    navBadge.style.display = count ? '' : 'none';
  }

  const dot = document.getElementById('hrNotifDot');
  if(dot) dot.style.display = count ? '' : 'none';

  const markAll = document.getElementById('hrMarkAllReadBtn');
  if(markAll) markAll.disabled = !count;
}

function decrementUnreadCounters(serverCount){
  if(Number.isInteger(serverCount)) return setUnreadCounters(serverCount);

  const statValue = document.getElementById('hrUnreadStatValue');
  const current = statValue ? (parseInt(statValue.textContent, 10) || 0) : 0;
  setUnreadCounters(Math.max(current - 1, 0));
}

/* ---------------------------------------------------------
   Mark ALL as read (one request; the server only touches the
   logged-in patient's own notifications)
--------------------------------------------------------- */
function initMarkAll(){
  const btn = document.getElementById('hrMarkAllReadBtn');
  if(!btn) return;

  btn.addEventListener('click', () => {
    const url = btn.getAttribute('data-url');
    if(!url) return;

    btn.disabled = true;

    postJSON(url)
      .then(() => {
        document.querySelectorAll('#hrNotificationTable tbody tr[data-read="false"]')
          .forEach(updateRowRead);
        setUnreadCounters(0);
        showToast('All notifications marked as read.', 'success');
      })
      .catch(err => {
        btn.disabled = false;
        showToast(err.message, 'error');
      });
  });
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