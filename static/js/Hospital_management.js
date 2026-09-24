
/* =========================================================
   HEALTH RING — Hospital Management Behavior

   Sidebar/theme reuse admin_dashboard.js if loaded globally;
   this file only adds page-specific behavior.

   Global Admin Search:
   Searches existing sidebar navigation pages/modules.
   Same behavior as Emergency Alert Management.

   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {
  initSidebarToggle();
  initThemeToggle();
  initGlobalSearch();
  initTableSearchFilter();
  initDeleteModal();
  initViewModal();
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
   Dark mode toggle (persisted) — same key as dashboard
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
   Global Admin Search — searches sidebar navigation pages.

   This searches ADMIN PAGES / MODULES only.
   It does NOT filter hospital table records.

   Same behavior as Emergency Alert Management.
--------------------------------------------------------- */
function initGlobalSearch(){
  const wrap    = document.getElementById('hrGlobalSearch');
  const input   = document.getElementById('hrGlobalSearchInput');
  const results = document.getElementById('hrGlobalSearchResults');

  if(!wrap || !input || !results) return;


  /* Collect existing sidebar navigation items dynamically */
  const navItems = Array.from(
    document.querySelectorAll('.hr-sidebar .hr-nav-item')
  )
    .map(link => ({
      label: link.textContent.replace(/\s+/g, ' ').trim(),
      href: link.getAttribute('href'),
      icon: link.querySelector('i')?.className ||
            'fa-solid fa-arrow-right'
    }))
    .filter(item => item.href && item.href !== '#');


  /* Render matching pages */
  function render(matches){

    if(!matches.length){

      results.innerHTML =
        '<div class="hr-global-search-empty">' +
        'No matching pages found' +
        '</div>';

    } else {

      results.innerHTML = matches.map(m => `
        <a class="hr-global-search-item" href="${m.href}">
          <i class="${m.icon}"></i>
          <span>${m.label}</span>
        </a>
      `).join('');

    }

    results.classList.add('show');
  }


  /* Close dropdown */
  function close(){
    results.classList.remove('show');
    results.innerHTML = '';
  }


  /* Search input */
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


  /* Reopen results when focusing input */
  input.addEventListener('focus', () => {

    if(input.value.trim()){
      input.dispatchEvent(new Event('input'));
    }

  });


  /* Escape closes dropdown */
  input.addEventListener('keydown', (e) => {

    if(e.key === 'Escape'){
      close();
    }

  });


  /* Click outside closes dropdown */
  document.addEventListener('click', (e) => {

    if(!wrap.contains(e.target)){
      close();
    }

  });
}


/* ---------------------------------------------------------
   Client-side search + status/tier filter over rendered rows.

   Pure UI filter — does not touch server pagination/query logic.
--------------------------------------------------------- */
function initTableSearchFilter(){

  const searchInput =
    document.getElementById('hrHospitalSearch');

  const statusFilter =
    document.getElementById('hrFilterStatus');

  const tierFilter =
    document.getElementById('hrFilterTier');

  const resetBtn =
    document.getElementById('hrResetFilters');

  const table =
    document.getElementById('hrHospitalTable');

  if(!table) return;


  const getRows = () =>
    Array.from(
      table.querySelectorAll('tbody tr')
    ).filter(
      row => row.id !== 'hrEmptyRow'
    );


  function applyFilters(){

    const term =
      (searchInput?.value || '')
        .trim()
        .toLowerCase();

    const status =
      statusFilter?.value || '';

    const tier =
      tierFilter?.value || '';

    const rows = getRows();

    let visibleCount = 0;


    rows.forEach(row => {

      const text =
        row.textContent.toLowerCase();

      const matchesSearch =
        !term || text.includes(term);


      const statusBadge =
        row.querySelector('.hr-badge');

      const rowStatus =
        statusBadge
          ? statusBadge.textContent.trim().toLowerCase()
          : '';

      /*
         "Pending" badge should match "pending"
         and "Inactive"/"Active" normally.
      */
      const normalizedStatus =
        rowStatus === 'pending'
          ? 'pending'
          : rowStatus;


      const matchesStatus =
        !status ||
        normalizedStatus === status;


      /*
         Tier filtering is kept compatible with the current
         rendered table. If tier information is not present
         in a row, do not break the existing search behavior.
      */
      const matchesTier =
        !tier ||
        text.includes(tier) ||
        text.includes(
          tier === 'clinic'
            ? 'clinic network'
            : tier
        );


      const show =
        matchesSearch &&
        matchesStatus &&
        matchesTier;


      row.style.display =
        show ? '' : 'none';

      if(show){
        visibleCount++;
      }

    });


    toggleEmptyState(
      visibleCount === 0
    );
  }


  function toggleEmptyState(isEmpty){

    let emptyRow =
      table.querySelector('#hrDynamicEmptyRow');


    if(isEmpty){

      if(!emptyRow){

        emptyRow =
          document.createElement('tr');

        emptyRow.id =
          'hrDynamicEmptyRow';

        emptyRow.innerHTML = `
          <td colspan="6">
            <div class="hr-empty-state">

              <div class="hr-empty-icon">
                <i class="fa-solid fa-magnifying-glass"></i>
              </div>

              <h4>No matching hospitals</h4>

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

  statusFilter?.addEventListener(
    'change',
    applyFilters
  );

  tierFilter?.addEventListener(
    'change',
    applyFilters
  );


  resetBtn?.addEventListener(
    'click',
    () => {

      if(searchInput){
        searchInput.value = '';
      }

      if(statusFilter){
        statusFilter.value = '';
      }

      if(tierFilter){
        tierFilter.value = '';
      }

      applyFilters();
    }
  );
}


/* ---------------------------------------------------------
   Hospital Details (view) modal

   Populate from row data attributes.
--------------------------------------------------------- */
function initViewModal(){

  const modal =
    document.getElementById(
      'hrHospitalViewModal'
    );

  if(!modal) return;


  modal.addEventListener(
    'show.bs.modal',
    (event) => {

      const trigger =
        event.relatedTarget;

      if(!trigger) return;


      const name =
        trigger.getAttribute(
          'data-hospital-name'
        ) || '—';

      const code =
        trigger.getAttribute(
          'data-hospital-code'
        ) || '';

      const email =
        trigger.getAttribute(
          'data-hospital-email'
        ) || '—';

      const phone =
        trigger.getAttribute(
          'data-hospital-phone'
        ) || '—';

      const address =
        trigger.getAttribute(
          'data-hospital-address'
        ) || '—';

      const city =
        trigger.getAttribute(
          'data-hospital-city'
        ) || '';

      const state =
        trigger.getAttribute(
          'data-hospital-state'
        ) || '';

      const country =
        trigger.getAttribute(
          'data-hospital-country'
        ) || '';

      const pincode =
        trigger.getAttribute(
          'data-hospital-pincode'
        ) || '';

      const website =
        trigger.getAttribute(
          'data-hospital-website'
        ) || '—';

      const license =
        trigger.getAttribute(
          'data-hospital-license'
        ) || '—';

      const year =
        trigger.getAttribute(
          'data-hospital-year'
        ) || '—';

      const doctors =
        trigger.getAttribute(
          'data-hospital-doctors'
        ) || '0';

      const status =
        (
          trigger.getAttribute(
            'data-hospital-status'
          ) || 'active'
        ).toLowerCase();


      setText(
        'hrViewHospitalName',
        name
      );

      setText(
        'hrViewHospitalCode',
        code
          ? `Code: ${code}`
          : `ID: ${
              trigger.getAttribute(
                'data-hospital-id'
              ) || '—'
            }`
      );

      setText(
        'hrViewHospitalEmail',
        email
      );

      setText(
        'hrViewHospitalPhone',
        phone
      );

      setText(
        'hrViewHospitalAddress',
        address
      );

      setText(
        'hrViewHospitalLocation',
        [city, state]
          .filter(Boolean)
          .join(', ') || '—'
      );

      setText(
        'hrViewHospitalCountryPin',
        [country, pincode]
          .filter(Boolean)
          .join(' - ') || '—'
      );

      setText(
        'hrViewHospitalWebsite',
        website
      );

      setText(
        'hrViewHospitalLicense',
        license
      );

      setText(
        'hrViewHospitalYear',
        year
      );

      setText(
        'hrViewHospitalDoctors',
        doctors
      );


      /* Hospital avatar */
      const avatar =
        document.getElementById(
          'hrViewHospitalAvatar'
        );

      if(avatar){

        avatar.textContent =
          name
            .trim()
            .slice(0, 2)
            .toUpperCase() || 'HP';

      }


      /* Status badge */
      const statusBadge =
        document.getElementById(
          'hrViewHospitalStatus'
        );

      if(statusBadge){

        if(status === 'active'){

          statusBadge.textContent =
            'Active';

          statusBadge.className =
            'hr-badge hr-badge-success ms-auto';

        } else if(status === 'pending'){

          statusBadge.textContent =
            'Pending';

          statusBadge.className =
            'hr-badge hr-badge-warning ms-auto';

        } else {

          statusBadge.textContent =
            'Inactive';

          statusBadge.className =
            'hr-badge hr-badge-danger ms-auto';

        }

      }

    }
  );


  function setText(id, val){

    const el =
      document.getElementById(id);

    if(el){
      el.textContent = val;
    }

  }
}


/* ---------------------------------------------------------
   Delete confirmation modal

   Wires the row's data attributes into the confirm dialog
   and existing delete form action.
--------------------------------------------------------- */
function initDeleteModal(){

  const modal =
    document.getElementById(
      'hrDeleteModal'
    );

  if(!modal) return;


  modal.addEventListener(
    'show.bs.modal',
    (event) => {

      const trigger =
        event.relatedTarget;

      if(!trigger) return;


      const hospitalId =
        trigger.getAttribute(
          'data-hospital-id'
        );

      const hospitalName =
        trigger.getAttribute(
          'data-hospital-name'
        );


      const nameEl =
        document.getElementById(
          'hrDeleteHospitalName'
        );

      const form =
        document.getElementById(
          'hrDeleteForm'
        );


      if(nameEl){

        nameEl.textContent =
          hospitalName ||
          'this hospital';

      }


      if(form && hospitalId){

        form.action =
          `/hospital/delete/${hospitalId}`;

      }

    }
  );
}


/* ---------------------------------------------------------
   Floating-label form validation

   Client-side UX only.
   Server-side validation in Flask remains the source of truth.
--------------------------------------------------------- */
function initFormValidation(){

  const form =
    document.getElementById(
      'hrHospitalForm'
    );

  if(!form) return;


  form.addEventListener(
    'submit',
    (e) => {

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
        e.preventDefault();
      }

    }
  );


  /* Keep select floating-label styling in sync */
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
   Pagination — visual only

   Wire hrPageBtn clicks to Flask pagination
   when server-side pagination is connected.
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


        buttons.forEach(
          b => b.classList.remove('active')
        );


        if(
          /^\d+$/.test(
            btn.textContent.trim()
          )
        ){

          btn.classList.add('active');

        }


        /*
          TODO:
          Navigate to ?page=N once
          server-side pagination is connected.
        */

      }
    );

  });
}


/* ---------------------------------------------------------
   Toast helper

   Call:
   showToast('Saved!', 'success')
   showToast('Something went wrong', 'error')
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


  text.textContent =
    message;


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
