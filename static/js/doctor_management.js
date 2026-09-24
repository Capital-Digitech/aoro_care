
/* =========================================================
   HEALTH RING — Doctor Management Behavior

   Sidebar toggle · Dark mode · Global Admin Search
   Search/filter table · Delete modal · View modal
   Time picker · Pagination · Export · Toast
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {
  initSidebarToggle();
  initThemeToggle();
  initGlobalSearch();
  initToolbarFilters();
  initDeleteModal();
  initViewModal();
  initTimePicker();
  initPagination();
  initExportButton();
});


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
   Dark mode toggle
   Same key as rest of admin panel
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

    setTheme(
      current === 'dark'
        ? 'light'
        : 'dark'
    );

  });


  function setTheme(mode){

    html.setAttribute(
      'data-theme',
      mode
    );

    localStorage.setItem(
      'hr-admin-theme',
      mode
    );

    const icon =
      btn.querySelector('i');

    if(icon){

      icon.className =
        mode === 'dark'
          ? 'fa-solid fa-sun'
          : 'fa-solid fa-moon';

    }

  }
}


/* ---------------------------------------------------------
   Global Admin Search

   Searches existing sidebar navigation pages/modules.

   This is separate from #hrDoctorSearch, which searches
   doctor records inside the current table.

   Same behavior as Emergency Alert / Hospital Management.
--------------------------------------------------------- */
function initGlobalSearch(){

  const wrap =
    document.getElementById(
      'hrGlobalSearch'
    );

  const input =
    document.getElementById(
      'hrGlobalSearchInput'
    );

  const results =
    document.getElementById(
      'hrGlobalSearchResults'
    );


  if(!wrap || !input || !results){
    return;
  }


  /*
     Read the actual sidebar links dynamically.

     This means:
     - Hospital Management
     - Doctor Management
     - Patient Management
     - Family Members
     - Health Rings
     - Health Data
     - Appointments
     - Reports
     - Emergency Alerts
     - Prescriptions
     - Notifications
     - AI Insights
     - Settings

     and any super-admin-only links that are actually
     rendered in the sidebar will automatically appear.
  */
  const navItems =
    Array.from(
      document.querySelectorAll(
        '.hr-sidebar .hr-nav-item'
      )
    )
    .map(link => ({
      label:
        link.textContent
          .replace(/\s+/g, ' ')
          .trim(),

      href:
        link.getAttribute('href'),

      icon:
        link.querySelector('i')?.className ||
        'fa-solid fa-arrow-right'
    }))
    .filter(item =>
      item.href &&
      item.href !== '#'
    );


  /* -------------------------------------------------------
     Render search results
  ------------------------------------------------------- */
  function render(matches){

    if(!matches.length){

      results.innerHTML =
        '<div class="hr-global-search-empty">' +
        'No matching pages found' +
        '</div>';

    } else {

      results.innerHTML =
        matches
          .map(m => `
            <a
              class="hr-global-search-item"
              href="${m.href}"
            >
              <i class="${m.icon}"></i>
              <span>${m.label}</span>
            </a>
          `)
          .join('');

    }

    results.classList.add('show');
  }


  /* -------------------------------------------------------
     Close dropdown
  ------------------------------------------------------- */
  function close(){

    results.classList.remove(
      'show'
    );

    results.innerHTML = '';
  }


  /* -------------------------------------------------------
     Search while typing
  ------------------------------------------------------- */
  input.addEventListener(
    'input',
    () => {

      const term =
        input.value
          .trim()
          .toLowerCase();


      if(!term){

        close();

        return;
      }


      const matches =
        navItems.filter(item =>
          item.label
            .toLowerCase()
            .includes(term)
        );


      render(matches);

    }
  );


  /* -------------------------------------------------------
     Reopen matching results on focus
  ------------------------------------------------------- */
  input.addEventListener(
    'focus',
    () => {

      if(input.value.trim()){

        input.dispatchEvent(
          new Event('input')
        );

      }

    }
  );


  /* -------------------------------------------------------
     Escape closes search
  ------------------------------------------------------- */
  input.addEventListener(
    'keydown',
    (e) => {

      if(e.key === 'Escape'){

        close();

      }

    }
  );


  /* -------------------------------------------------------
     Click outside closes search
  ------------------------------------------------------- */
  document.addEventListener(
    'click',
    (e) => {

      if(!wrap.contains(e.target)){

        close();

      }

    }
  );

}


/* ---------------------------------------------------------
   Toolbar — live search + specialization/hospital/status
   filters
--------------------------------------------------------- */
function initToolbarFilters(){

  const searchInput =
    document.getElementById(
      'hrDoctorSearch'
    );

  const specSelect =
    document.getElementById(
      'hrFilterSpecialization'
    );

  const hospitalSelect =
    document.getElementById(
      'hrFilterHospital'
    );

  const statusSelect =
    document.getElementById(
      'hrFilterStatus'
    );

  const resetBtn =
    document.getElementById(
      'hrResetFilters'
    );

  const table =
    document.getElementById(
      'hrDoctorTable'
    );


  if(!table) return;


  const rows = () =>
    Array.from(
      table.querySelectorAll(
        'tbody tr'
      )
    )
    .filter(
      row =>
        row.id !== 'hrEmptyRow'
    );


  function applyFilters(){

    const term =
      (searchInput?.value || '')
        .trim()
        .toLowerCase();

    const spec =
      specSelect?.value || '';

    const hosp =
      hospitalSelect?.value || '';

    const status =
      statusSelect?.value || '';


    let visibleCount = 0;


    rows().forEach(row => {

      const cells =
        row.querySelectorAll('td');


      if(cells.length < 8){
        return;
      }


      const nameText =
        cells[0]
          .innerText
          .toLowerCase();

      const emailText =
        cells[1]
          .innerText
          .toLowerCase();

      const phoneText =
        cells[2]
          .innerText
          .toLowerCase();

      const specText =
        cells[3]
          .innerText
          .trim();

      const hospitalText =
        cells[4]
          .innerText
          .trim();

      const statusText =
        cells[6]
          .innerText
          .trim()
          .toLowerCase()
          .replace(/\s+/g, '_');


      const matchesSearch =
        !term ||
        nameText.includes(term) ||
        emailText.includes(term) ||
        phoneText.includes(term) ||
        specText
          .toLowerCase()
          .includes(term);


      const matchesSpec =
        !spec ||
        specText === spec;


      const matchesHospital =
        !hosp ||
        hospitalText === hosp;


      const matchesStatus =
        !status ||
        statusText === status;


      const visible =
        matchesSearch &&
        matchesSpec &&
        matchesHospital &&
        matchesStatus;


      row.style.display =
        visible ? '' : 'none';


      if(visible){
        visibleCount++;
      }

    });


    toggleEmptyState(
      visibleCount
    );
  }


  function toggleEmptyState(
    visibleCount
  ){

    let emptyRow =
      table.querySelector(
        '#hrEmptyRow'
      );


    if(visibleCount === 0){

      if(!emptyRow){

        emptyRow =
          document.createElement(
            'tr'
          );

        emptyRow.id =
          'hrEmptyRow';


        emptyRow.innerHTML = `
          <td colspan="9">

            <div class="hr-empty-state">

              <div class="hr-empty-icon">
                <i class="fa-solid fa-user-doctor"></i>
              </div>

              <h4>No doctors found</h4>

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


      emptyRow.style.display =
        '';

    } else if(emptyRow){

      emptyRow.style.display =
        'none';

    }

  }


  [
    searchInput,
    specSelect,
    hospitalSelect,
    statusSelect
  ].forEach(el => {

    if(!el) return;


    el.addEventListener(
      'input',
      applyFilters
    );


    el.addEventListener(
      'change',
      applyFilters
    );

  });


  resetBtn?.addEventListener(
    'click',
    () => {

      if(searchInput){
        searchInput.value = '';
      }

      if(specSelect){
        specSelect.value = '';
      }

      if(hospitalSelect){
        hospitalSelect.value = '';
      }

      if(statusSelect){
        statusSelect.value = '';
      }


      applyFilters();

    }
  );

}


/* ---------------------------------------------------------
   Delete confirmation modal
   Populate doctor name + form target
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


      const doctorName =
        trigger.getAttribute(
          'data-doctor-name'
        ) ||
        'this doctor';


      const doctorId =
        trigger.getAttribute(
          'data-doctor-id'
        );


      const nameEl =
        document.getElementById(
          'hrDeleteDoctorName'
        );


      if(nameEl){

        nameEl.textContent =
          doctorName.trim();

      }


      const form =
        document.getElementById(
          'hrDeleteForm'
        );


      if(form && doctorId){

        form.action =
          `/doctor/delete/${doctorId}`;

      }

    }
  );

}


/* ---------------------------------------------------------
   Doctor Details View Modal
   Populate from row data attributes
--------------------------------------------------------- */
function initViewModal(){

  const modal =
    document.getElementById(
      'hrDoctorViewModal'
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
          'data-doctor-name'
        ) ||
        'Dr. —';


      const email =
        trigger.getAttribute(
          'data-doctor-email'
        ) ||
        '—';


      const phone =
        trigger.getAttribute(
          'data-doctor-phone'
        ) ||
        '—';


      const specialization =
        trigger.getAttribute(
          'data-doctor-specialization'
        ) ||
        '—';


      const qualification =
        trigger.getAttribute(
          'data-doctor-qualification'
        ) ||
        '—';


      const experience =
        trigger.getAttribute(
          'data-doctor-experience'
        );


      const license =
        trigger.getAttribute(
          'data-doctor-license'
        ) ||
        '—';


      const hospital =
        trigger.getAttribute(
          'data-doctor-hospital'
        ) ||
        '—';


      const fee =
        trigger.getAttribute(
          'data-doctor-fee'
        );


      const status =
        trigger.getAttribute(
          'data-doctor-status'
        ) ||
        'active';


      const days =
        trigger.getAttribute(
          'data-doctor-days'
        ) ||
        '—';


      const time =
        trigger.getAttribute(
          'data-doctor-time'
        ) ||
        '—';


      const about =
        trigger.getAttribute(
          'data-doctor-about'
        ) ||
        '—';


      setText(
        'hrViewName',
        name
      );

      setText(
        'hrViewSpecialization',
        specialization
      );

      setText(
        'hrViewEmail',
        email
      );

      setText(
        'hrViewPhone',
        phone
      );

      setText(
        'hrViewQualification',
        qualification
      );

      setText(
        'hrViewExperience',
        experience
          ? `${experience} yrs`
          : '—'
      );

      setText(
        'hrViewLicense',
        license
      );

      setText(
        'hrViewHospital',
        hospital
      );

      setText(
        'hrViewFee',
        fee
          ? `₹${fee}`
          : '—'
      );

      setText(
        'hrViewDays',
        days
      );

      setText(
        'hrViewTime',
        time
      );

      setText(
        'hrViewAbout',
        about
      );


      /* Doctor avatar */
      const avatar =
        document.getElementById(
          'hrViewAvatar'
        );


      if(avatar){

        const initials =
          name
            .replace('Dr.', '')
            .trim()
            .split(' ')
            .map(w => w[0])
            .join('')
            .slice(0, 2)
            .toUpperCase();


        avatar.textContent =
          initials || 'DR';

      }


      /* Doctor status badge */
      const statusBadge =
        document.getElementById(
          'hrViewStatus'
        );


      if(statusBadge){

        const statusMap = {

          active: {
            label: 'Active',
            cls: 'hr-badge-success'
          },

          on_leave: {
            label: 'On Leave',
            cls: 'hr-badge-warning'
          },

          pending: {
            label: 'Pending',
            cls: 'hr-badge-info'
          },

          inactive: {
            label: 'Inactive',
            cls: 'hr-badge-danger'
          }

        };


        const info =
          statusMap[status] ||
          statusMap.active;


        statusBadge.textContent =
          info.label;


        statusBadge.className =
          `hr-badge ${info.cls} ms-auto`;

      }

    }
  );


  function setText(
    id,
    value
  ){

    const el =
      document.getElementById(id);


    if(el){
      el.textContent = value;
    }

  }

}


/* ---------------------------------------------------------
   Compact Clock / Time-Picker synchronization
--------------------------------------------------------- */
function initTimePicker(){

  const startInput =
    document.getElementById(
      'hrDocTimeStart'
    );

  const endInput =
    document.getElementById(
      'hrDocTimeEnd'
    );

  const target =
    document.getElementById(
      'hrDocAvailableTime'
    );


  if(
    !startInput ||
    !endInput ||
    !target
  ){
    return;
  }


  function formatTime(val){

    if(!val) return '';


    const parts =
      val.split(':');


    let hours =
      parseInt(
        parts[0],
        10
      );


    const minutes =
      parts[1] ||
      '00';


    const ampm =
      hours >= 12
        ? 'PM'
        : 'AM';


    hours =
      hours % 12;


    hours =
      hours
        ? hours
        : 12;


    const strHours =
      hours < 10
        ? '0' + hours
        : '' + hours;


    return `${strHours}:${minutes} ${ampm}`;
  }


  function syncTime(){

    const startStr =
      formatTime(
        startInput.value
      );


    const endStr =
      formatTime(
        endInput.value
      );


    if(
      startStr &&
      endStr
    ){

      target.value =
        `${startStr} - ${endStr}`;

    } else if(startStr){

      target.value =
        startStr;

    }

  }


  startInput.addEventListener(
    'input',
    syncTime
  );

  startInput.addEventListener(
    'change',
    syncTime
  );

  endInput.addEventListener(
    'input',
    syncTime
  );

  endInput.addEventListener(
    'change',
    syncTime
  );


  syncTime();

}


/* ---------------------------------------------------------
   Pagination — visual state only
--------------------------------------------------------- */
function initPagination(){

  const pagination =
    document.getElementById(
      'hrPagination'
    );


  if(!pagination) return;


  pagination
    .querySelectorAll(
      '.hr-page-btn'
    )
    .forEach(btn => {

      if(btn.disabled) return;


      btn.addEventListener(
        'click',
        () => {

          pagination
            .querySelectorAll(
              '.hr-page-btn'
            )
            .forEach(
              b =>
                b.classList.remove(
                  'active'
                )
            );


          if(
            !btn.querySelector('i')
          ){

            btn.classList.add(
              'active'
            );

          }

        }
      );

    });

}


/* ---------------------------------------------------------
   Export button — existing behavior preserved
--------------------------------------------------------- */
function initExportButton(){

  const btn =
    document.getElementById(
      'hrExportBtn'
    );


  if(!btn) return;


  btn.addEventListener(
    'click',
    () => {

      showToast(
        'Export started — this will download shortly.'
      );

    }
  );

}


/* ---------------------------------------------------------
   Toast helper
--------------------------------------------------------- */
function showToast(message){

  const toast =
    document.getElementById(
      'hrToast'
    );


  const text =
    document.getElementById(
      'hrToastText'
    );


  if(
    !toast ||
    !text
  ){
    return;
  }


  text.textContent =
    message;


  toast.classList.add(
    'show'
  );


  clearTimeout(
    showToast._timer
  );


  showToast._timer =
    setTimeout(
      () =>
        toast.classList.remove(
          'show'
        ),
      3200
    );

}

