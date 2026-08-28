/* =========================================================
   HEALTH RING — Notification Management Behavior
   Mirrors hospital_management.js structure/conventions.
   No jQuery. Modern ES6. No inline JS.
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {
  initSidebarToggle();
  initThemeToggle();
  initTableSearchFilter();
  initDeleteModal();
  initViewModal();
  initMarkAsRead();
  initFormValidation();
  initPagination();
  initSelectAll();
  initExportButton();
});

/* ---------------------------------------------------------
   CSRF helper — reads the meta tag every request needs.
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
   Dark mode toggle (persisted) — same key as the rest of the app
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
   Client-side search + type/status filter over rendered rows.
--------------------------------------------------------- */
function initTableSearchFilter(){
  const searchInput = document.getElementById('hrNotificationSearch');
  const typeFilter = document.getElementById('hrFilterType');
  const statusFilter = document.getElementById('hrFilterStatus');
  const resetBtn = document.getElementById('hrResetFilters');
  const table = document.getElementById('hrNotificationTable');
  if(!table) return;

  const getRows = () => Array.from(table.querySelectorAll('tbody tr')).filter(r => r.id !== 'hrEmptyRow');

  function applyFilters(){
    const term = (searchInput?.value || '').trim().toLowerCase();
    const type = (typeFilter?.value || '').toLowerCase();
    const status = (statusFilter?.value || '').toLowerCase();
    const rows = getRows();
    let visibleCount = 0;

    rows.forEach(row => {
      const text = row.textContent.toLowerCase();
      const matchesSearch = !term || text.includes(term);

      const typeBadge = row.querySelector('.hr-badge-alert, .hr-badge-appointment, .hr-badge-report, .hr-badge-system');
      const rowType = typeBadge ? typeBadge.textContent.trim().toLowerCase() : '';
      const matchesType = !type || rowType === type;

      const statusBadge = row.querySelector('.hr-badge-success, .hr-badge-warning');
      const rowStatus = statusBadge ? statusBadge.textContent.trim().toLowerCase() : '';
      const matchesStatus = !status || rowStatus === status;

      const show = matchesSearch && matchesType && matchesStatus;
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
              <h4>No matching notifications</h4>
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
  typeFilter?.addEventListener('change', applyFilters);
  statusFilter?.addEventListener('change', applyFilters);
  resetBtn?.addEventListener('click', () => {
    if(searchInput) searchInput.value = '';
    if(typeFilter) typeFilter.value = '';
    if(statusFilter) statusFilter.value = '';
    applyFilters();
  });
}

/* ---------------------------------------------------------
   Delete confirmation modal — wires row data attributes into
   the confirm dialog and the existing delete form action.
--------------------------------------------------------- */
function initDeleteModal(){
  const modal = document.getElementById('hrDeleteModal');
  if(!modal) return;

  modal.addEventListener('show.bs.modal', (event) => {
    const trigger = event.relatedTarget;
    if(!trigger) return;

    const notificationId = trigger.getAttribute('data-notification-id');
    const notificationTitle = trigger.getAttribute('data-notification-title');

    const titleEl = document.getElementById('hrDeleteNotificationTitle');
    const form = document.getElementById('hrDeleteForm');

    if(titleEl) titleEl.textContent = notificationTitle || 'this notification';
    if(form && notificationId){
      form.action = `/notification/delete/${notificationId}`;
    }
  });
}

/* ---------------------------------------------------------
   View modal — populates from data-* attributes on the
   triggering "Read More" link or "View" action button.
--------------------------------------------------------- */
function initViewModal(){
  const modal = document.getElementById('hrViewModal');
  if(!modal) return;

  modal.addEventListener('show.bs.modal', (event) => {
    const trigger = event.relatedTarget;
    if(!trigger) return;

    const fields = {
      hrViewTitle: trigger.getAttribute('data-title'),
      hrViewUser: trigger.getAttribute('data-user'),
      hrViewMessage: trigger.getAttribute('data-message'),
      hrViewType: capitalize(trigger.getAttribute('data-type')),
      hrViewStatus: trigger.getAttribute('data-status'),
      hrViewCreated: trigger.getAttribute('data-created')
    };

    Object.entries(fields).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if(el) el.textContent = value || '—';
    });

    modal.dataset.notificationId = trigger.getAttribute('data-id') || '';

    const markReadBtn = document.getElementById('hrMarkReadBtn');
    const isRead = (trigger.getAttribute('data-status') || '').toLowerCase() === 'read';
    if(markReadBtn){
      markReadBtn.disabled = isRead;
      markReadBtn.innerHTML = isRead
        ? '<i class="fa-solid fa-check-double"></i> Already Read'
        : '<i class="fa-solid fa-check-double"></i> Mark as Read';
    }
  });

  function capitalize(str){
    if(!str) return '—';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

/* ---------------------------------------------------------
   Mark as Read — fetch() POST with CSRF header, no page reload.
--------------------------------------------------------- */
function initMarkAsRead(){
  const btn = document.getElementById('hrMarkReadBtn');
  const modal = document.getElementById('hrViewModal');
  if(!btn || !modal) return;

  btn.addEventListener('click', async () => {
    const notificationId = modal.dataset.notificationId;
    if(!notificationId) return;

    setLoading(btn, true);

    try {
      const response = await fetch(`/notification/mark-read/${notificationId}`, {
        method: 'POST',
        headers: {
          'X-CSRFToken': getCsrfToken(),
          'Content-Type': 'application/json'
        }
      });

      if(!response.ok) throw new Error('Request failed');

      const data = await response.json();

      showToast(data.message || 'Notification marked as read.', 'success');
      document.getElementById('hrViewStatus').textContent = 'Read';
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-check-double"></i> Already Read';

      setTimeout(() => window.location.reload(), 900);
    } catch (err) {
      showToast('Could not mark notification as read.', 'error');
    } finally {
      setLoading(btn, false);
    }
  });
}

/* ---------------------------------------------------------
   Loading spinner helper — call setLoading(btn, true/false)
--------------------------------------------------------- */
function setLoading(button, isLoading){
  if(!button) return;
  if(isLoading){
    button.dataset.originalHtml = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Please wait…';
  } else if(button.dataset.originalHtml){
    button.innerHTML = button.dataset.originalHtml;
  }
}

/* ---------------------------------------------------------
   Floating-label form validation (client-side UX only —
   server-side validation in Flask remains the source of truth)
--------------------------------------------------------- */
function initFormValidation(){
  const form = document.getElementById('hrNotificationForm');
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

  form.querySelectorAll('select').forEach(select => {
    const sync = () => select.classList.toggle('hr-has-value', !!select.value);
    select.addEventListener('change', sync);
    sync();
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
   Select all + per-row checkbox selection
--------------------------------------------------------- */
function initSelectAll(){
  const selectAll = document.getElementById('hrSelectAll');
  const table = document.getElementById('hrNotificationTable');
  if(!selectAll || !table) return;

  selectAll.addEventListener('change', () => {
    table.querySelectorAll('.hr-row-checkbox').forEach(cb => {
      cb.checked = selectAll.checked;
    });
  });

  table.addEventListener('change', (e) => {
    if(!e.target.classList.contains('hr-row-checkbox')) return;
    const boxes = Array.from(table.querySelectorAll('.hr-row-checkbox'));
    selectAll.checked = boxes.length > 0 && boxes.every(cb => cb.checked);
  });
}

/* ---------------------------------------------------------
   Export button — exports the currently visible rows to CSV.
--------------------------------------------------------- */
function initExportButton(){
  const btn = document.getElementById('hrExportBtn');
  const table = document.getElementById('hrNotificationTable');
  if(!btn || !table) return;

  btn.addEventListener('click', () => {
    const rows = Array.from(table.querySelectorAll('tbody tr'))
      .filter(r => r.style.display !== 'none' && r.id !== 'hrEmptyRow' && r.id !== 'hrDynamicEmptyRow');

    if(rows.length === 0){
      showToast('There is nothing to export.', 'error');
      return;
    }

    const header = ['Title', 'User', 'Message', 'Type', 'Status', 'Created At'];
    const lines = [header.join(',')];

    rows.forEach(row => {
      const cells = row.querySelectorAll('td');
      const title = cells[1]?.querySelector('.hr-person-name')?.textContent.trim() || '';
      const user = cells[2]?.textContent.trim() || '';
      const message = cells[3]?.querySelector('.hr-msg-preview')?.textContent.trim() || '';
      const type = cells[4]?.textContent.trim() || '';
      const status = cells[5]?.textContent.trim() || '';
      const created = cells[6]?.textContent.trim() || '';
      const escaped = [title, user, message, type, status, created].map(csvEscape);
      lines.push(escaped.join(','));
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'notifications.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast('Notifications exported successfully.', 'success');
  });

  function csvEscape(value){
    const str = String(value ?? '');
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  }
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