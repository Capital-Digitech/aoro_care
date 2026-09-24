/* =========================================================
   HEALTH RING — Notification Management Behavior
   Mirrors hospital_management.js structure/conventions.
   No jQuery. Modern ES6. No inline JS.
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {
  initSidebarToggle();
  initThemeToggle();
  initGlobalSearch();
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

  const open = () => {
    sidebar.classList.add('show');
    overlay.classList.add('show');
  };

  const close = () => {
    sidebar.classList.remove('show');
    overlay.classList.remove('show');
  };

  toggle.addEventListener('click', () => {
    sidebar.classList.contains('show') ? close() : open();
  });

  overlay.addEventListener('click', close);

  window.addEventListener('resize', () => {
    if(window.innerWidth > 1199.98){
      close();
    }
  });
}

/* ---------------------------------------------------------
   Dark mode toggle (persisted)
   Same key as the rest of the admin application.
--------------------------------------------------------- */
function initThemeToggle(){
  const btn  = document.getElementById('hrThemeToggle');
  const html = document.documentElement;

  if(!btn) return;

  const saved = localStorage.getItem('hr-admin-theme');

  if(saved){
    setTheme(saved);
  }

  btn.addEventListener('click', () => {
    const current =
      html.getAttribute('data-theme') === 'dark'
        ? 'dark'
        : 'light';

    setTheme(current === 'dark' ? 'light' : 'dark');
  });

  function setTheme(mode){
    html.setAttribute('data-theme', mode);
    localStorage.setItem('hr-admin-theme', mode);

    const icon = btn.querySelector('i');

    if(icon){
      icon.className =
        mode === 'dark'
          ? 'fa-solid fa-sun'
          : 'fa-solid fa-moon';
    }
  }
}

/* ---------------------------------------------------------
   COMMON ADMIN GLOBAL SEARCH
   Searches the existing sidebar navigation items.

   IMPORTANT:
   This is different from #hrNotificationSearch.
   #hrNotificationSearch searches notification records.
--------------------------------------------------------- */
function initGlobalSearch(){
  const wrap = document.getElementById('hrGlobalSearch');
  const input = document.getElementById('hrGlobalSearchInput');
  const results = document.getElementById('hrGlobalSearchResults');

  if(!wrap || !input || !results) return;

  const navItems = Array.from(
    document.querySelectorAll('.hr-sidebar .hr-nav-item')
  )
    .map(link => ({
      label: link.textContent.replace(/\s+/g, ' ').trim(),
      href: link.getAttribute('href'),
      icon:
        link.querySelector('i')?.className ||
        'fa-solid fa-arrow-right'
    }))
    .filter(item => item.href && item.href !== '#');

  function render(matches){
    if(!matches.length){
      results.innerHTML =
        '<div class="hr-global-search-empty">' +
        'No matching pages found' +
        '</div>';
    } else {
      results.innerHTML = matches.map(item => `
        <a
          class="hr-global-search-item"
          href="${escapeAttribute(item.href)}">

          <i class="${escapeAttribute(item.icon)}"></i>
          <span>${escapeHtml(item.label)}</span>

        </a>
      `).join('');
    }

    results.classList.add('show');
  }

  function close(){
    results.classList.remove('show');
    results.innerHTML = '';
  }

  input.addEventListener('input', () => {
    const term = input.value.trim().toLowerCase();

    if(!term){
      close();
      return;
    }

    const matches = navItems.filter(item =>
      item.label.toLowerCase().includes(term)
    );

    render(matches);
  });

  input.addEventListener('focus', () => {
    if(input.value.trim()){
      input.dispatchEvent(new Event('input'));
    }
  });

  input.addEventListener('keydown', (event) => {
    if(event.key === 'Escape'){
      close();
      input.blur();
    }
  });

  document.addEventListener('click', (event) => {
    if(!wrap.contains(event.target)){
      close();
    }
  });
}

/* ---------------------------------------------------------
   Client-side search + type/status filter
   over rendered notification rows.
--------------------------------------------------------- */
function initTableSearchFilter(){
  const searchInput = document.getElementById('hrNotificationSearch');
  const typeFilter = document.getElementById('hrFilterType');
  const statusFilter = document.getElementById('hrFilterStatus');
  const resetBtn = document.getElementById('hrResetFilters');
  const table = document.getElementById('hrNotificationTable');

  if(!table) return;

  const getRows = () =>
    Array.from(
      table.querySelectorAll('tbody tr')
    ).filter(row =>
      row.id !== 'hrEmptyRow' &&
      row.id !== 'hrDynamicEmptyRow'
    );

  function applyFilters(){
    const term =
      (searchInput?.value || '')
        .trim()
        .toLowerCase();

    const type =
      (typeFilter?.value || '')
        .toLowerCase();

    const status =
      (statusFilter?.value || '')
        .toLowerCase();

    const rows = getRows();

    let visibleCount = 0;

    rows.forEach(row => {
      const text = row.textContent.toLowerCase();

      const matchesSearch =
        !term || text.includes(term);

      const typeBadge = row.querySelector(
        '.hr-badge-alert, ' +
        '.hr-badge-appointment, ' +
        '.hr-badge-report, ' +
        '.hr-badge-system'
      );

      const rowType = typeBadge
        ? typeBadge.textContent.trim().toLowerCase()
        : '';

      const matchesType =
        !type || rowType === type;

      const statusBadge = row.querySelector(
        '.hr-badge-success, .hr-badge-warning'
      );

      const rowStatus = statusBadge
        ? statusBadge.textContent.trim().toLowerCase()
        : '';

      const matchesStatus =
        !status || rowStatus === status;

      const show =
        matchesSearch &&
        matchesType &&
        matchesStatus;

      row.style.display = show ? '' : 'none';

      if(show){
        visibleCount++;
      }
    });

    toggleEmptyState(visibleCount === 0);
  }

  function toggleEmptyState(isEmpty){
    let emptyRow =
      table.querySelector('#hrDynamicEmptyRow');

    if(isEmpty){
      if(!emptyRow){
        emptyRow = document.createElement('tr');
        emptyRow.id = 'hrDynamicEmptyRow';

        emptyRow.innerHTML = `
          <td colspan="8">
            <div class="hr-empty-state">
              <div class="hr-empty-icon">
                <i class="fa-solid fa-magnifying-glass"></i>
              </div>

              <h4>No matching notifications</h4>

              <p>
                Try adjusting your search or filters.
              </p>
            </div>
          </td>
        `;

        table
          .querySelector('tbody')
          .appendChild(emptyRow);
      }
    } else if(emptyRow){
      emptyRow.remove();
    }
  }

  searchInput?.addEventListener(
    'input',
    applyFilters
  );

  typeFilter?.addEventListener(
    'change',
    applyFilters
  );

  statusFilter?.addEventListener(
    'change',
    applyFilters
  );

  resetBtn?.addEventListener('click', () => {
    if(searchInput){
      searchInput.value = '';
    }

    if(typeFilter){
      typeFilter.value = '';
    }

    if(statusFilter){
      statusFilter.value = '';
    }

    applyFilters();
  });
}

/* ---------------------------------------------------------
   Delete confirmation modal
   Wires row data attributes into the confirmation dialog.
--------------------------------------------------------- */
function initDeleteModal(){
  const modal = document.getElementById('hrDeleteModal');

  if(!modal) return;

  modal.addEventListener(
    'show.bs.modal',
    event => {
      const trigger = event.relatedTarget;

      if(!trigger) return;

      const notificationId =
        trigger.getAttribute(
          'data-notification-id'
        );

      const notificationTitle =
        trigger.getAttribute(
          'data-notification-title'
        );

      const titleEl =
        document.getElementById(
          'hrDeleteNotificationTitle'
        );

      const form =
        document.getElementById(
          'hrDeleteForm'
        );

      if(titleEl){
        titleEl.textContent =
          notificationTitle ||
          'this notification';
      }

      if(form && notificationId){
        form.action =
          `/notification/delete/${notificationId}`;
      }
    }
  );
}

/* ---------------------------------------------------------
   View modal
   Populates details from data-* attributes.
--------------------------------------------------------- */
function initViewModal(){
  const modal =
    document.getElementById('hrViewModal');

  if(!modal) return;

  modal.addEventListener(
    'show.bs.modal',
    event => {
      const trigger = event.relatedTarget;

      if(!trigger) return;

      const fields = {
        hrViewTitle:
          trigger.getAttribute('data-title'),

        hrViewUser:
          trigger.getAttribute('data-user'),

        hrViewMessage:
          trigger.getAttribute('data-message'),

        hrViewType:
          capitalize(
            trigger.getAttribute('data-type')
          ),

        hrViewStatus:
          trigger.getAttribute('data-status'),

        hrViewCreated:
          trigger.getAttribute('data-created')
      };

      Object.entries(fields).forEach(
        ([id, value]) => {
          const element =
            document.getElementById(id);

          if(element){
            element.textContent =
              value || '—';
          }
        }
      );

      modal.dataset.notificationId =
        trigger.getAttribute('data-id') || '';

      const markReadBtn =
        document.getElementById(
          'hrMarkReadBtn'
        );

      const isRead =
        (
          trigger.getAttribute('data-status') ||
          ''
        ).toLowerCase() === 'read';

      if(markReadBtn){
        markReadBtn.disabled = isRead;

        markReadBtn.innerHTML = isRead
          ? '<i class="fa-solid fa-check-double"></i> Already Read'
          : '<i class="fa-solid fa-check-double"></i> Mark as Read';
      }
    }
  );

  function capitalize(str){
    if(!str) return '—';

    return (
      str.charAt(0).toUpperCase() +
      str.slice(1)
    );
  }
}

/* ---------------------------------------------------------
   Mark as Read
   POST request with CSRF header.
--------------------------------------------------------- */
function initMarkAsRead(){
  const btn =
    document.getElementById('hrMarkReadBtn');

  const modal =
    document.getElementById('hrViewModal');

  if(!btn || !modal) return;

  btn.addEventListener(
    'click',
    async () => {

      const notificationId =
        modal.dataset.notificationId;

      if(!notificationId) return;

      setLoading(btn, true);

      try{
        const response = await fetch(
          `/notification/mark-read/${notificationId}`,
          {
            method: 'POST',
            headers: {
              'X-CSRFToken': getCsrfToken(),
              'Content-Type': 'application/json'
            }
          }
        );

        if(!response.ok){
          throw new Error('Request failed');
        }

        const data =
          await response.json();

        showToast(
          data.message ||
          'Notification marked as read.',
          'success'
        );

        const statusEl =
          document.getElementById(
            'hrViewStatus'
          );

        if(statusEl){
          statusEl.textContent = 'Read';
        }

        btn.disabled = true;

        btn.innerHTML =
          '<i class="fa-solid fa-check-double"></i> Already Read';

        setTimeout(
          () => window.location.reload(),
          900
        );

      }catch(error){

        showToast(
          'Could not mark notification as read.',
          'error'
        );

      }finally{
        setLoading(btn, false);
      }
    }
  );
}

/* ---------------------------------------------------------
   Loading spinner helper
--------------------------------------------------------- */
function setLoading(button, isLoading){
  if(!button) return;

  if(isLoading){

    button.dataset.originalHtml =
      button.innerHTML;

    button.disabled = true;

    button.innerHTML =
      '<i class="fa-solid fa-spinner fa-spin"></i> Please wait…';

  }else if(button.dataset.originalHtml){

    button.innerHTML =
      button.dataset.originalHtml;
  }
}

/* ---------------------------------------------------------
   Floating-label form validation
   Server-side Flask validation remains the source of truth.
--------------------------------------------------------- */
function initFormValidation(){
  const form =
    document.getElementById(
      'hrNotificationForm'
    );

  if(!form) return;

  form.addEventListener(
    'submit',
    event => {

      let valid = true;

      form
        .querySelectorAll('[required]')
        .forEach(field => {

          const wrapper =
            field.closest('.hr-field');

          if(!wrapper) return;

          const filled =
            field.value &&
            field.value.trim().length > 0;

          wrapper.classList.toggle(
            'is-invalid',
            !filled
          );

          wrapper.classList.toggle(
            'is-valid',
            !!filled
          );

          if(!filled){
            valid = false;
          }
        });

      if(!valid){
        event.preventDefault();
      }
    }
  );

  form
    .querySelectorAll('select')
    .forEach(select => {

      const sync = () => {
        select.classList.toggle(
          'hr-has-value',
          !!select.value
        );
      };

      select.addEventListener(
        'change',
        sync
      );

      sync();
    });
}

/* ---------------------------------------------------------
   Pagination
   Visual only until Flask server-side pagination is connected.
--------------------------------------------------------- */
function initPagination(){
  const buttons =
    document.querySelectorAll(
      '.hr-page-btn'
    );

  buttons.forEach(btn => {

    btn.addEventListener(
      'click',
      () => {

        if(
          btn.disabled ||
          btn.classList.contains('active')
        ){
          return;
        }

        buttons.forEach(button =>
          button.classList.remove('active')
        );

        if(
          /^\d+$/.test(
            btn.textContent.trim()
          )
        ){
          btn.classList.add('active');
        }

        /*
          Server-side pagination can later navigate to:

          ?page=${btn.textContent.trim()}

          No backend behavior is changed here.
        */
      }
    );
  });
}

/* ---------------------------------------------------------
   Select all + per-row checkbox selection
--------------------------------------------------------- */
function initSelectAll(){
  const selectAll =
    document.getElementById(
      'hrSelectAll'
    );

  const table =
    document.getElementById(
      'hrNotificationTable'
    );

  if(!selectAll || !table) return;

  selectAll.addEventListener(
    'change',
    () => {

      table
        .querySelectorAll(
          '.hr-row-checkbox'
        )
        .forEach(cb => {
          cb.checked =
            selectAll.checked;
        });
    }
  );

  table.addEventListener(
    'change',
    event => {

      if(
        !event.target.classList.contains(
          'hr-row-checkbox'
        )
      ){
        return;
      }

      const boxes =
        Array.from(
          table.querySelectorAll(
            '.hr-row-checkbox'
          )
        );

      selectAll.checked =
        boxes.length > 0 &&
        boxes.every(
          cb => cb.checked
        );
    }
  );
}

/* ---------------------------------------------------------
   Export button
   Exports currently visible notification rows to CSV.
--------------------------------------------------------- */
function initExportButton(){
  const btn =
    document.getElementById(
      'hrExportBtn'
    );

  const table =
    document.getElementById(
      'hrNotificationTable'
    );

  if(!btn || !table) return;

  btn.addEventListener(
    'click',
    () => {

      const rows =
        Array.from(
          table.querySelectorAll(
            'tbody tr'
          )
        ).filter(row =>
          row.style.display !== 'none' &&
          row.id !== 'hrEmptyRow' &&
          row.id !== 'hrDynamicEmptyRow'
        );

      if(rows.length === 0){

        showToast(
          'There is nothing to export.',
          'error'
        );

        return;
      }

      const header = [
        'Title',
        'User',
        'Message',
        'Type',
        'Status',
        'Created At'
      ];

      const lines = [
        header.join(',')
      ];

      rows.forEach(row => {

        const cells =
          row.querySelectorAll('td');

        const title =
          cells[1]
            ?.querySelector(
              '.hr-person-name'
            )
            ?.textContent
            .trim() || '';

        const user =
          cells[2]
            ?.textContent
            .trim() || '';

        const message =
          cells[3]
            ?.querySelector(
              '.hr-msg-preview'
            )
            ?.textContent
            .trim() || '';

        const type =
          cells[4]
            ?.textContent
            .trim() || '';

        const status =
          cells[5]
            ?.textContent
            .trim() || '';

        const created =
          cells[6]
            ?.textContent
            .trim() || '';

        const escaped = [
          title,
          user,
          message,
          type,
          status,
          created
        ].map(csvEscape);

        lines.push(
          escaped.join(',')
        );
      });

      const blob = new Blob(
        [lines.join('\n')],
        {
          type:
            'text/csv;charset=utf-8;'
        }
      );

      const url =
        URL.createObjectURL(blob);

      const link =
        document.createElement('a');

      link.href = url;
      link.download =
        'notifications.csv';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);

      showToast(
        'Notifications exported successfully.',
        'success'
      );
    }
  );

  function csvEscape(value){
    const str =
      String(value ?? '');

    return /[",\n]/.test(str)
      ? `"${str.replace(/"/g, '""')}"`
      : str;
  }
}

/* ---------------------------------------------------------
   Toast helper
--------------------------------------------------------- */
function showToast(
  message,
  type = 'success'
){
  const toast =
    document.getElementById(
      'hrToast'
    );

  const text =
    document.getElementById(
      'hrToastText'
    );

  const icon =
    toast?.querySelector(
      '.hr-toast-icon'
    );

  if(!toast || !text) return;

  text.textContent = message;

  if(icon){

    icon.className =
      'hr-toast-icon ' +
      (
        type === 'success'
          ? 'hr-bg-green'
          : 'hr-bg-red'
      );

    icon.innerHTML =
      `<i class="fa-solid ${
        type === 'success'
          ? 'fa-check'
          : 'fa-xmark'
      }"></i>`;
  }

  toast.classList.add('show');

  setTimeout(
    () => toast.classList.remove('show'),
    3200
  );
}

/* ---------------------------------------------------------
   HTML escaping helpers
   Used only for dynamically generated global-search items.
--------------------------------------------------------- */
function escapeHtml(value){
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttribute(value){
  return escapeHtml(value);
}