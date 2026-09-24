/* =========================================================
   HEALTH RING — Family Member Management Behavior
   Sidebar/theme reuse admin_dashboard.js if loaded globally;
   this file only adds page-specific behavior.
   Same coding style as patient_management.js.
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {
  initSidebarToggle();
  initThemeToggle();
  initGlobalSearch();
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
    if(icon){
      icon.className = mode === 'dark'
        ? 'fa-solid fa-sun'
        : 'fa-solid fa-moon';
    }
  }
}

/* ---------------------------------------------------------
   Common Admin Global Search
   Searches the actual sidebar navigation links so the
   results always use existing Flask routes.
--------------------------------------------------------- */
function initGlobalSearch(){
  const wrap    = document.getElementById('hrGlobalSearch');
  const input   = document.getElementById('hrGlobalSearchInput');
  const results = document.getElementById('hrGlobalSearchResults');

  if(!wrap || !input || !results) return;

  const navItems = Array.from(
    document.querySelectorAll('.hr-sidebar .hr-nav-item')
  )
    .map(link => ({
      label: link.textContent.replace(/\s+/g, ' ').trim(),
      href: link.getAttribute('href'),
      icon: link.querySelector('i')?.className || 'fa-solid fa-arrow-right'
    }))
    .filter(item => item.href && item.href !== '#');

  function render(matches){
    if(!matches.length){
      results.innerHTML = `
        <div class="hr-global-search-empty">
          No matching pages found
        </div>
      `;
    } else {
      results.innerHTML = matches.map(item => `
        <a
          class="hr-global-search-item"
          href="${item.href}"
        >
          <i class="${item.icon}"></i>
          <span>${item.label}</span>
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
   Client-side search + status/relationship/permission filter
   over rendered rows. Pure UI filter — does not touch server
   pagination/query logic.
--------------------------------------------------------- */
function initTableSearchFilter(){
  const searchInput = document.getElementById('hrFamilySearch');
  const statusFilter = document.getElementById('hrFilterStatus');
  const relationshipFilter = document.getElementById('hrFilterRelationship');
  const permissionFilter = document.getElementById('hrFilterPermission');
  const resetBtn = document.getElementById('hrResetFilters');
  const table = document.getElementById('hrFamilyTable');

  if(!table) return;

  const getRows = () =>
    Array.from(
      table.querySelectorAll('tbody tr')
    ).filter(row => row.id !== 'hrEmptyRow');

  function applyFilters(){
    const term = (searchInput?.value || '').trim().toLowerCase();
    const status = statusFilter?.value || '';
    const relationship = relationshipFilter?.value || '';
    const permission = permissionFilter?.value || '';

    const rows = getRows();
    let visibleCount = 0;

    rows.forEach(row => {
      const text = row.textContent.toLowerCase();
      const matchesSearch = !term || text.includes(term);

      const badges = row.querySelectorAll('.hr-badge');

      // Last badge in the row is Status; permission badges
      // come before it.
      const rowStatus = badges.length
        ? badges[badges.length - 1].textContent.trim().toLowerCase()
        : '';

      const matchesStatus =
        !status || rowStatus === status;

      const rowRelationship =
        row.getAttribute('data-relationship') || '';

      const matchesRelationship =
        !relationship || rowRelationship === relationship;

      let matchesPermission = true;

      if(permission === 'view_reports'){
        matchesPermission =
          row.getAttribute('data-can-view-reports') === 'true';
      } else if(permission === 'receive_alerts'){
        matchesPermission =
          row.getAttribute('data-can-receive-alerts') === 'true';
      }

      const show =
        matchesSearch &&
        matchesStatus &&
        matchesRelationship &&
        matchesPermission;

      row.style.display = show ? '' : 'none';

      if(show) visibleCount++;
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
          <td colspan="9">
            <div class="hr-empty-state">
              <div class="hr-empty-icon">
                <i class="fa-solid fa-magnifying-glass"></i>
              </div>
              <h4>No matching family members</h4>
              <p>Try adjusting your search or filters.</p>
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

  searchInput?.addEventListener('input', applyFilters);

  statusFilter?.addEventListener('change', applyFilters);

  relationshipFilter?.addEventListener(
    'change',
    applyFilters
  );

  permissionFilter?.addEventListener(
    'change',
    applyFilters
  );

  resetBtn?.addEventListener('click', () => {
    if(searchInput) searchInput.value = '';
    if(statusFilter) statusFilter.value = '';
    if(relationshipFilter) relationshipFilter.value = '';
    if(permissionFilter) permissionFilter.value = '';

    applyFilters();
  });
}

/* ---------------------------------------------------------
   Delete confirmation modal — wires the row's data attributes
   into the confirm dialog and its existing delete form action.
--------------------------------------------------------- */
function initDeleteModal(){
  const modal = document.getElementById('hrDeleteModal');
  if(!modal) return;

  modal.addEventListener('show.bs.modal', (event) => {
    const trigger = event.relatedTarget;
    if(!trigger) return;

    const familyId =
      trigger.getAttribute('data-family-id');

    const familyName =
      trigger.getAttribute('data-family-name');

    const nameEl =
      document.getElementById('hrDeleteFamilyName');

    const form =
      document.getElementById('hrDeleteForm');

    if(nameEl){
      nameEl.textContent =
        familyName || 'this family member';
    }

    if(form && familyId){
      form.action = `/family/delete/${familyId}`;
    }
  });
}

/* ---------------------------------------------------------
   Floating-label form validation
--------------------------------------------------------- */
function initFormValidation(){
  const form = document.getElementById('hrFamilyForm');
  if(!form) return;

  form.addEventListener('submit', (e) => {
    let valid = true;

    form.querySelectorAll('[required]').forEach(field => {
      const wrapper = field.closest('.hr-field');
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

      if(!filled) valid = false;
    });

    if(!valid) e.preventDefault();
  });

  form.querySelectorAll('select').forEach(select => {
    const sync = () => {
      select.classList.toggle(
        'hr-has-value',
        !!select.value
      );
    };

    select.addEventListener('change', sync);
    sync();
  });
}

/* ---------------------------------------------------------
   Pagination — visual only
--------------------------------------------------------- */
function initPagination(){
  const buttons =
    document.querySelectorAll('.hr-page-btn');

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      if(
        btn.disabled ||
        btn.classList.contains('active')
      ){
        return;
      }

      buttons.forEach(b =>
        b.classList.remove('active')
      );

      if(/^\d+$/.test(btn.textContent.trim())){
        btn.classList.add('active');
      }

      // TODO: navigate to ?page=N once
      // server-side pagination is connected.
    });
  });
}

/* ---------------------------------------------------------
   Toast helper
--------------------------------------------------------- */
function showToast(
  message,
  type = 'success'
){
  const toast =
    document.getElementById('hrToast');

  const text =
    document.getElementById('hrToastText');

  const icon =
    toast?.querySelector('.hr-toast-icon');

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

    icon.innerHTML = `
      <i class="fa-solid ${
        type === 'success'
          ? 'fa-check'
          : 'fa-xmark'
      }"></i>
    `;
  }

  toast.classList.add('show');

  setTimeout(
    () => toast.classList.remove('show'),
    3200
  );
}