/* =========================================================
   HEALTH RING — Appointment Management Behavior
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
  initViewModal();
  initFormValidation();
  initPagination();
  initExport();
});

/* ---------------------------------------------------------
   Sidebar toggle (mobile / tablet) — same behavior as dashboard
--------------------------------------------------------- */
function initSidebarToggle(){
  const sidebar = document.getElementById('hrSidebar');
  const toggle = document.getElementById('hrSidebarToggle');
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
    if(window.innerWidth > 1199.98) close();
  });
}

/* ---------------------------------------------------------
   Dark mode toggle (persisted) — same key as dashboard
--------------------------------------------------------- */
function initThemeToggle(){
  const btn = document.getElementById('hrThemeToggle');
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
   Global Admin Search
   Searches the existing sidebar navigation items.
   Appointment table search remains separate.
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
      icon: link.querySelector('i')?.className ||
            'fa-solid fa-arrow-right'
    }))
    .filter(item => item.href && item.href !== '#');

  function render(matches){
    if(!matches.length){
      results.innerHTML =
        '<div class="hr-global-search-empty">' +
        'No matching pages found' +
        '</div>';
    }else{
      results.innerHTML = matches.map(item => `
        <a class="hr-global-search-item" href="${item.href}">
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
   Client-side search + doctor/type/status/date filter over
   rendered rows. Pure UI filter — does not touch server
   pagination/query logic.
--------------------------------------------------------- */
function initTableSearchFilter(){
  const searchInput = document.getElementById('hrAppointmentSearch');
  const doctorFilter = document.getElementById('hrFilterDoctor');
  const typeFilter = document.getElementById('hrFilterType');
  const statusFilter = document.getElementById('hrFilterStatus');
  const dateFilter = document.getElementById('hrFilterDate');
  const resetBtn = document.getElementById('hrResetFilters');
  const table = document.getElementById('hrAppointmentTable');

  if(!table) return;

  const getRows = () => Array.from(
    table.querySelectorAll('tbody tr')
  ).filter(row =>
    row.id !== 'hrEmptyRow' &&
    row.id !== 'hrDynamicEmptyRow'
  );

  function applyFilters(){
    const term = (searchInput?.value || '').trim().toLowerCase();
    const doctor = doctorFilter?.value || '';
    const type = typeFilter?.value || '';
    const status = statusFilter?.value || '';
    const dateValue = dateFilter?.value || '';

    const rows = getRows();
    let visibleCount = 0;

    rows.forEach(row => {
      const text = row.textContent.toLowerCase();
      const matchesSearch = !term || text.includes(term);

      const rowDoctor = row.getAttribute('data-doctor-id') || '';
      const matchesDoctor = !doctor || rowDoctor === doctor;

      const rowType = row.getAttribute('data-appointment-type') || '';
      const matchesType = !type || rowType === type;

      const rowStatus = row.getAttribute('data-status') || '';
      const matchesStatus = !status || rowStatus === status;

      const rowDate = row.getAttribute('data-appointment-date') || '';
      const matchesDate = !dateValue || rowDate === dateValue;

      const show =
        matchesSearch &&
        matchesDoctor &&
        matchesType &&
        matchesStatus &&
        matchesDate;

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
          <td colspan="9">
            <div class="hr-empty-state">
              <div class="hr-empty-icon">
                <i class="fa-solid fa-magnifying-glass"></i>
              </div>
              <h4>No matching appointments</h4>
              <p>Try adjusting your search or filters.</p>
            </div>
          </td>
        `;

        table.querySelector('tbody').appendChild(emptyRow);
      }
    }else if(emptyRow){
      emptyRow.remove();
    }
  }

  searchInput?.addEventListener('input', applyFilters);
  doctorFilter?.addEventListener('change', applyFilters);
  typeFilter?.addEventListener('change', applyFilters);
  statusFilter?.addEventListener('change', applyFilters);
  dateFilter?.addEventListener('change', applyFilters);

  resetBtn?.addEventListener('click', () => {
    if(searchInput) searchInput.value = '';
    if(doctorFilter) doctorFilter.value = '';
    if(typeFilter) typeFilter.value = '';
    if(statusFilter) statusFilter.value = '';
    if(dateFilter) dateFilter.value = '';

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

    const appointmentId = trigger.getAttribute('data-appointment-id');
    const appointmentName = trigger.getAttribute('data-appointment-name');

    const nameEl = document.getElementById('hrDeleteAppointmentName');
    const form = document.getElementById('hrDeleteForm');

    if(nameEl){
      nameEl.textContent = appointmentName || 'this appointment';
    }

    if(form && appointmentId){
      form.action = `/appointment/delete/${appointmentId}`;
    }
  });
}

/* ---------------------------------------------------------
   View modal — reads the triggering row's data-view-* attrs
   and fills the read-only Appointment Details card.
   No writes, no navigation — view-only.
--------------------------------------------------------- */
function initViewModal(){
  const modal = document.getElementById('hrViewAppointmentModal');
  if(!modal) return;

  const statusMap = {
    scheduled: {
      label: 'Scheduled',
      cls: 'hr-badge-info'
    },
    completed: {
      label: 'Completed',
      cls: 'hr-badge-success'
    },
    cancelled: {
      label: 'Cancelled',
      cls: 'hr-badge-neutral'
    }
  };

  modal.addEventListener('show.bs.modal', (event) => {
    const trigger = event.relatedTarget;
    if(!trigger) return;

    const get = (attr) => trigger.getAttribute(attr) || '-';

    const patientName = document.getElementById('hrViewPatientName');
    const doctorName = document.getElementById('hrViewDoctorName');
    const date = document.getElementById('hrViewDate');
    const time = document.getElementById('hrViewTime');
    const type = document.getElementById('hrViewType');
    const hospital = document.getElementById('hrViewHospital');
    const patientCode = document.getElementById('hrViewPatientCode');
    const reason = document.getElementById('hrViewReason');

    if(patientName){
      patientName.textContent = get('data-view-patient');
    }

    if(doctorName){
      doctorName.textContent = get('data-view-doctor');
    }

    if(date){
      date.textContent = get('data-view-date');
    }

    if(time){
      time.textContent = get('data-view-time');
    }

    if(type){
      type.textContent = get('data-view-type');
    }

    if(hospital){
      hospital.textContent = get('data-view-hospital');
    }

    if(patientCode){
      patientCode.textContent = get('data-view-patient-code');
    }

    if(reason){
      reason.textContent = get('data-view-reason');
    }

    const meetingLink = trigger.getAttribute('data-view-meeting');
    const meetingEl = document.getElementById('hrViewMeeting');

    if(meetingEl){
      if(meetingLink){
        meetingEl.innerHTML = `
          <a href="${meetingLink}"
             target="_blank"
             rel="noopener">
            <i class="fa-solid fa-video"></i> Join
          </a>
        `;
      }else{
        meetingEl.textContent = '-';
      }
    }

    const statusKey = (
      trigger.getAttribute('data-view-status') || ''
    ).toLowerCase();

    const statusInfo = statusMap[statusKey] || {
      label: get('data-view-status-label'),
      cls: 'hr-badge-info'
    };

    const badge = document.getElementById('hrViewStatusBadge');

    if(badge){
      badge.textContent = statusInfo.label;
      badge.className = 'hr-badge ' + statusInfo.cls;
    }
  });
}

/* ---------------------------------------------------------
   Floating-label form validation (client-side UX only —
   server-side validation in Flask remains the source of truth)
--------------------------------------------------------- */
function initFormValidation(){
  const form = document.getElementById('hrAppointmentForm');
  if(!form) return;

  form.addEventListener('submit', (e) => {
    let valid = true;

    form.querySelectorAll('[required]').forEach(field => {
      const wrapper = field.closest('.hr-field');
      if(!wrapper) return;

      const filled =
        field.value &&
        field.value.trim().length > 0;

      wrapper.classList.toggle('is-invalid', !filled);
      wrapper.classList.toggle('is-valid', !!filled);

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
   Pagination — visual only; wire hrPageBtn clicks to your
   Flask pagination when ready.
--------------------------------------------------------- */
function initPagination(){
  const buttons = document.querySelectorAll('.hr-page-btn');

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      if(
        btn.disabled ||
        btn.classList.contains('active')
      ) return;

      buttons.forEach(b => b.classList.remove('active'));

      if(/^\d+$/.test(btn.textContent.trim())){
        btn.classList.add('active');
      }

      // TODO: navigate to ?page=N once server-side
      // pagination is connected.
    });
  });
}

// //* ---------------------------------------------------------
//    Export — Excel (.xlsx) download of currently visible rows.
//    Uses existing filtered/visible appointments only.
// --------------------------------------------------------- */
function initExport(){
  const exportBtn = document.getElementById('hrExportBtn');
  const table = document.getElementById('hrAppointmentTable');

  if(!exportBtn || !table) return;

  exportBtn.addEventListener('click', async () => {
    const rows = Array.from(
      table.querySelectorAll('tbody tr')
    ).filter(row => {
      if(
        row.id === 'hrEmptyRow' ||
        row.id === 'hrDynamicEmptyRow'
      ){
        return false;
      }

      return row.style.display !== 'none';
    });

    if(rows.length === 0){
      showToast(
        'No appointments to export.',
        'error'
      );
      return;
    }

    const appointmentIds = rows
      .map(row => {
        const deleteButton = row.querySelector(
          '[data-appointment-id]'
        );

        return deleteButton
          ? deleteButton.getAttribute(
              'data-appointment-id'
            )
          : '';
      })
      .filter(Boolean);

    if(appointmentIds.length === 0){
      showToast(
        'No appointments to export.',
        'error'
      );
      return;
    }

    try{
      exportBtn.disabled = true;

      const params = new URLSearchParams();
      params.set(
        'ids',
        appointmentIds.join(',')
      );

      const response = await fetch(
        `/appointment/export?${params.toString()}`,
        {
          method: 'GET',
          credentials: 'same-origin'
        }
      );

      if(!response.ok){
        throw new Error(
          'Export request failed.'
        );
      }

      const blob = await response.blob();

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');

      const timestamp =
        new Date().toISOString().slice(0, 10);

      link.href = url;
      link.download =
        `appointments_${timestamp}.xlsx`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);

      showToast(
        'Appointments exported successfully.'
      );

    }catch(error){
      console.error(
        'Appointment export error:',
        error
      );

      showToast(
        'Unable to export appointments.',
        'error'
      );

    }finally{
      exportBtn.disabled = false;
    }
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
    icon.className =
      'hr-toast-icon ' +
      (type === 'success'
        ? 'hr-bg-green'
        : 'hr-bg-red');

    icon.innerHTML = `
      <i class="fa-solid ${
        type === 'success'
          ? 'fa-check'
          : 'fa-xmark'
      }"></i>
    `;
  }

  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
  }, 3200);
}