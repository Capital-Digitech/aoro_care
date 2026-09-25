document.addEventListener('DOMContentLoaded', () => {

  initSidebarToggle();
  initThemeToggle();
  initLoadingAnimation();
  initPatientSearch();
  initViewModal();
  initPatientChat();
  initTooltips();
  highlightPatientRowFromHash();

});


/* =========================================================
   SIDEBAR TOGGLE
   ========================================================= */

function initSidebarToggle() {

  const toggleButton = document.getElementById('hrSidebarToggle');
  const sidebar = document.getElementById('hrSidebar');

  if (!toggleButton || !sidebar) {
    return;
  }

  toggleButton.addEventListener('click', () => {

    document.body.classList.toggle('hr-sidebar-collapsed');

    sidebar.classList.toggle('collapsed');

  });

}


/* =========================================================
   THEME TOGGLE
   ========================================================= */

function initThemeToggle() {

  const themeButton = document.getElementById('hrThemeToggle');

  if (!themeButton) {
    return;
  }

  const icon = themeButton.querySelector('i');

  const savedTheme =
    localStorage.getItem('hr-theme') || 'light';

  document.documentElement.setAttribute(
    'data-theme',
    savedTheme
  );

  updateThemeIcon(icon, savedTheme);


  themeButton.addEventListener('click', () => {

    const currentTheme =
      document.documentElement.getAttribute('data-theme') || 'light';

    const nextTheme =
      currentTheme === 'dark' ? 'light' : 'dark';

    document.documentElement.setAttribute(
      'data-theme',
      nextTheme
    );

    localStorage.setItem(
      'hr-theme',
      nextTheme
    );

    updateThemeIcon(icon, nextTheme);

  });

}


function updateThemeIcon(icon, theme) {

  if (!icon) {
    return;
  }

  if (theme === 'dark') {

    icon.classList.remove('fa-moon');
    icon.classList.add('fa-sun');

  } else {

    icon.classList.remove('fa-sun');
    icon.classList.add('fa-moon');

  }

}


/* =========================================================
   LOADING ANIMATION
   ========================================================= */

function initLoadingAnimation() {

  const table = document.getElementById('hrPatientTable');

  if (!table) {
    return;
  }

  /*
   * Do not force a loading animation if the table
   * already contains real server-rendered data.
   *
   * This only removes an optional loading class
   * if it exists.
   */

  setTimeout(() => {

    table.classList.remove('hr-table-loading');

  }, 250);

}


/* =========================================================
   PATIENT SEARCH + STATUS + DATE FILTER
   ========================================================= */

function initPatientSearch() {

  const searchInput =
    document.getElementById('hrSearchPatient');

  const statusFilter =
    document.getElementById('hrStatusFilter');

  const dateFilter =
    document.getElementById('hrDateFilter');

  const resetButton =
    document.getElementById('hrResetFilters');

  const table =
    document.getElementById('hrPatientTable');


  if (!table) {
    return;
  }


  const tbody = table.querySelector('tbody');

  if (!tbody) {
    return;
  }


  /* ---------------------------------------------------------
     GET REAL PATIENT ROWS
     --------------------------------------------------------- */

  function getPatientRows() {

    return Array.from(
      tbody.querySelectorAll('tr')
    ).filter(row => {

      /*
       * Ignore dynamically-created empty row
       */
      if (row.id === 'hrDynamicEmptyRow') {
        return false;
      }


      /*
       * Ignore server-side empty state row
       */
      if (row.querySelector('td[colspan]')) {
        return false;
      }


      return true;

    });

  }


  /* ---------------------------------------------------------
     APPLY ALL FILTERS
     --------------------------------------------------------- */

  function applyFilters() {

    const searchTerm =
      searchInput
        ? searchInput.value.trim().toLowerCase()
        : '';


    const selectedStatus =
      statusFilter
        ? statusFilter.value.trim().toLowerCase()
        : '';


    const selectedDate =
      dateFilter
        ? dateFilter.value
        : '';


    const rows = getPatientRows();

    let visibleCount = 0;


    rows.forEach(row => {

      /*
       * Search
       */
      const rowText =
        row.textContent
          .trim()
          .toLowerCase();


      const matchesSearch =
        !searchTerm ||
        rowText.includes(searchTerm);


      /*
       * Status
       */
      const rowStatus =
        (
          row.dataset.status || ''
        )
          .trim()
          .toLowerCase();


      const matchesStatus =
        !selectedStatus ||
        rowStatus === selectedStatus;


      /*
       * Appointment date
       *
       * HTML:
       * data-appointment-date="2026-09-25"
       */
      const rowDate =
        (
          row.dataset.appointmentDate || ''
        ).trim();


      const matchesDate =
        !selectedDate ||
        rowDate === selectedDate;


      /*
       * Final result
       */
      const visible =
        matchesSearch &&
        matchesStatus &&
        matchesDate;


      row.style.display =
        visible ? '' : 'none';


      if (visible) {
        visibleCount++;
      }

    });


    updateEmptyState(
      rows.length > 0 &&
      visibleCount === 0
    );


    updatePatientCount(
      visibleCount
    );

  }


  /* ---------------------------------------------------------
     EMPTY STATE
     --------------------------------------------------------- */

  function updateEmptyState(show) {

    let emptyRow =
      document.getElementById(
        'hrDynamicEmptyRow'
      );


    if (show) {

      if (!emptyRow) {

        emptyRow =
          document.createElement('tr');

        emptyRow.id =
          'hrDynamicEmptyRow';


        emptyRow.innerHTML = `
          <td colspan="9" class="text-center py-5">
            <div class="hr-empty-state">

              <div class="hr-empty-icon">
                <i class="fa-solid fa-magnifying-glass"></i>
              </div>

              <div class="fw-bold">
                No matching patients
              </div>

              <small class="text-muted">
                Try changing your search or filters.
              </small>

            </div>
          </td>
        `;


        tbody.appendChild(emptyRow);

      }

    } else {

      if (emptyRow) {
        emptyRow.remove();
      }

    }

  }


  /* ---------------------------------------------------------
     PATIENT COUNT
     --------------------------------------------------------- */

  function updatePatientCount(count) {

    const countLabel =
      document.getElementById(
        'hrPatientCountLabel'
      );


    if (!countLabel) {
      return;
    }


    countLabel.textContent =
      `${count} patient(s) found`;

  }


  /* ---------------------------------------------------------
     SEARCH INPUT
     --------------------------------------------------------- */

  if (searchInput) {

    searchInput.addEventListener(
      'input',
      applyFilters
    );


    searchInput.addEventListener(
      'keydown',
      event => {

        if (event.key === 'Escape') {

          searchInput.value = '';

          applyFilters();

          searchInput.blur();

        }

      }
    );

  }


  /* ---------------------------------------------------------
     STATUS FILTER
     --------------------------------------------------------- */

  if (statusFilter) {

    statusFilter.addEventListener(
      'change',
      applyFilters
    );

  }


  /* ---------------------------------------------------------
     DATE FILTER
     --------------------------------------------------------- */

  if (dateFilter) {

    dateFilter.addEventListener(
      'change',
      applyFilters
    );

  }


  /* ---------------------------------------------------------
     RESET FILTERS
     --------------------------------------------------------- */

  if (resetButton) {

    resetButton.addEventListener(
      'click',
      () => {

        if (searchInput) {
          searchInput.value = '';
        }


        if (statusFilter) {
          statusFilter.value = '';
        }


        if (dateFilter) {
          dateFilter.value = '';
        }


        applyFilters();

      }
    );

  }


  /*
   * Apply initial state
   */
  applyFilters();

}


/* =========================================================
   VIEW PATIENT MODAL
   ========================================================= */

function initViewModal() {

  const modal =
    document.getElementById(
      'hrViewPatientModal'
    );


  if (!modal) {
    return;
  }


  const viewButtons =
    document.querySelectorAll(
      '[data-action="view-patient"]'
    );


  const closeButtons =
    modal.querySelectorAll(
      '[data-close-modal]'
    );


  /* ---------------------------------------------------------
     ELEMENT HELPERS
     --------------------------------------------------------- */

  function setText(id, value) {

    const element =
      document.getElementById(id);


    if (!element) {
      return;
    }


    element.textContent =
      value || '  ';

  }


  /* ---------------------------------------------------------
     OPEN MODAL
     --------------------------------------------------------- */

  function openModal(button) {

    if (!button) {
      return;
    }


    const data = button.dataset;


    /* Profile */
    setText(
      'hrViewName',
      data.name
    );


    setText(
      'hrViewCode',
      data.code
    );


    setText(
      'hrViewGender',
      data.gender
    );


    setText(
      'hrViewAge',
      data.age
    );


    setText(
      'hrViewBlood',
      data.blood
    );


    setText(
      'hrViewDoctor',
      data.doctor
    );


    setText(
      'hrViewEmergency',
      data.emergency
    );


    /* Health */
    setText(
      'hrViewHeartRate',
      data.heartRate
    );


    setText(
      'hrViewSpo2',
      data.spo2
    );


    setText(
      'hrViewTemperature',
      data.temperature
    );


    setText(
      'hrViewRingStatusValue',
      data.ringStatus
    );


    /* Appointment */
    setText(
      'hrViewAppointment',
      data.appointment
    );


    /* Report */
    setText(
      'hrViewReport',
      data.report
    );


    /* Medical history */
    setText(
      'hrViewHistory',
      data.history
    );


    /* Avatar */
    const avatar =
      document.getElementById(
        'hrViewAvatar'
      );


    if (avatar) {

      const name =
        data.name || 'P';


      avatar.textContent =
        name.trim().charAt(0).toUpperCase() || 'P';

    }


    /* Ring status chip */
    const ringChip =
      document.getElementById(
        'hrViewRingStatus'
      );


    if (ringChip) {

      const ringStatus =
        (
          data.ringStatus || ''
        ).toLowerCase();


      ringChip.textContent =
        data.ringStatus || '  ';


      ringChip.classList.remove(
        'online',
        'offline',
        'hr-ring-online',
        'hr-ring-offline'
      );


      if (ringStatus === 'online') {

        ringChip.classList.add(
          'online',
          'hr-ring-online'
        );

      } else if (ringStatus === 'offline') {

        ringChip.classList.add(
          'offline',
          'hr-ring-offline'
        );

      }

    }


    /*
     * Open modal
     */
    modal.classList.add(
      'show'
    );


    modal.setAttribute(
      'aria-hidden',
      'false'
    );


    document.body.classList.add(
      'hr-modal-open'
    );

  }


  /* ---------------------------------------------------------
     CLOSE MODAL
     --------------------------------------------------------- */

  function closeModal() {

    modal.classList.remove(
      'show'
    );


    modal.setAttribute(
      'aria-hidden',
      'true'
    );


    document.body.classList.remove(
      'hr-modal-open'
    );

  }


  /* ---------------------------------------------------------
     VIEW BUTTONS
     --------------------------------------------------------- */

  viewButtons.forEach(button => {

    button.addEventListener(
      'click',
      () => {

        openModal(button);

      }
    );

  });


  /* ---------------------------------------------------------
     CLOSE BUTTONS
     --------------------------------------------------------- */

  closeButtons.forEach(button => {

    button.addEventListener(
      'click',
      closeModal
    );

  });


  /* ---------------------------------------------------------
     CLICK OUTSIDE MODAL
     --------------------------------------------------------- */

  modal.addEventListener(
    'click',
    event => {

      if (event.target === modal) {

        closeModal();

      }

    }
  );


  /* ---------------------------------------------------------
     ESC KEY
     --------------------------------------------------------- */

  document.addEventListener(
    'keydown',
    event => {

      if (
        event.key === 'Escape' &&
        modal.classList.contains('show')
      ) {

        closeModal();

      }

    }
  );

}


/* =========================================================
   TOOLTIPS
   ========================================================= */

function initTooltips() {

  /*
   * Bootstrap tooltips
   *
   * Only initialize when Bootstrap is available.
   */

  if (
    typeof bootstrap === 'undefined' ||
    !bootstrap.Tooltip
  ) {
    return;
  }


  const tooltipElements =
    document.querySelectorAll(
      '[title]'
    );


  tooltipElements.forEach(element => {

    /*
     * Avoid initializing empty titles
     */
    if (!element.getAttribute('title')) {
      return;
    }


    new bootstrap.Tooltip(
      element
    );

  });

}


/* =========================================================
   HIGHLIGHT PATIENT FROM URL HASH
   ========================================================= */

function highlightPatientRowFromHash() {

  const hash =
    window.location.hash;


  if (!hash) {
    return;
  }


  /*
   * Example:
   * #patient-row-123
   */

  const row =
    document.querySelector(
      hash
    );


  if (!row) {
    return;
  }


  row.classList.add(
    'hr-row-highlight'
  );


  setTimeout(() => {

    row.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });

  }, 300);


  setTimeout(() => {

    row.classList.remove(
      'hr-row-highlight'
    );

  }, 3000);

}


/* =========================================================
   TOAST
   ========================================================= */

function showToast(
  message,
  type = 'success'
) {

  const toast =
    document.getElementById(
      'hrToast'
    );


  const messageElement =
    document.getElementById(
      'hrToastMessage'
    );


  if (!toast) {
    return;
  }


  if (messageElement) {

    messageElement.textContent =
      message || 'Done';

  }


  /*
   * Remove previous state classes
   */
  toast.classList.remove(
    'show',
    'success',
    'error',
    'warning',
    'info'
  );


  toast.classList.add(
    type
  );


  /*
   * Force reflow so repeated toast
   * calls animate correctly.
   */
  void toast.offsetWidth;


  toast.classList.add(
    'show'
  );


  setTimeout(() => {

    toast.classList.remove(
      'show'
    );

  }, 3000);

}


/* =========================================================
   OPTIONAL GLOBAL ACCESS
   ========================================================= */

window.showDoctorPatientToast =
  showToast;
/* =========================================================
   PATIENT CHAT
   ========================================================= */

/* =========================================================
   PATIENT CHAT
   ========================================================= */

function initPatientChat() {

  const chatButtons = document.querySelectorAll(
    '[data-action="chat-patient"]'
  );

  if (!chatButtons.length) {
    return;
  }

  const chatModal = document.getElementById('hrPatientChatModal');

  if (!chatModal) {
    console.error('Patient chat modal not found');
    return;
  }

  const chatName = document.getElementById('hrChatPatientName');
  const chatPatientId = document.getElementById('hrChatPatientId');
  const chatMessages = document.getElementById('hrChatMessages');
  const chatInput = document.getElementById('hrChatInput');
  const chatSend = document.getElementById('hrChatSend');
  const chatCloseButtons = chatModal.querySelectorAll(
    '[data-close-chat]'
  );


  /* ---------------------------------------------------------
     OPEN CHAT
     --------------------------------------------------------- */

  function openChat(button) {

    const patientId = button.dataset.patientId;
    const patientName =
      button.dataset.patientName || 'Patient';

    if (!patientId) {
      console.error('Patient ID missing for chat');
      return;
    }

    if (chatName) {
      chatName.textContent = patientName;
    }

    if (chatPatientId) {
      chatPatientId.value = patientId;
    }

    /*
     * Clear old demo messages whenever a patient is opened.
     */
    if (chatMessages) {
      chatMessages.innerHTML = `
        <div class="hr-chat-empty">
          <div class="hr-chat-empty-icon">
            <i class="fa-regular fa-comments"></i>
          </div>

          <div class="hr-chat-empty-title">
            Start a conversation
          </div>

          <div class="hr-chat-empty-text">
            Send a message to ${patientName}.
          </div>
        </div>
      `;
    }

    chatModal.classList.add('show');

    chatModal.setAttribute(
      'aria-hidden',
      'false'
    );

    document.body.classList.add(
      'hr-modal-open'
    );

    setTimeout(() => {

      if (chatInput) {
        chatInput.focus();
      }

    }, 100);

  }


  /* ---------------------------------------------------------
     CLOSE CHAT
     --------------------------------------------------------- */

  function closeChat() {

    chatModal.classList.remove(
      'show'
    );

    chatModal.setAttribute(
      'aria-hidden',
      'true'
    );

    document.body.classList.remove(
      'hr-modal-open'
    );

  }


  /* ---------------------------------------------------------
     SEND MESSAGE
     --------------------------------------------------------- */

  function sendMessage() {

    if (!chatInput || !chatMessages) {
      return;
    }

    const message =
      chatInput.value.trim();

    if (!message) {
      return;
    }


    /*
     * Remove empty state
     */
    const emptyState =
      chatMessages.querySelector(
        '.hr-chat-empty'
      );

    if (emptyState) {
      emptyState.remove();
    }


    /*
     * Add doctor message
     */
    const messageElement =
      document.createElement('div');

    messageElement.className =
      'hr-chat-message hr-chat-message-doctor';

    messageElement.innerHTML = `
      <div class="hr-chat-message-bubble">
        ${escapeChatHtml(message)}
      </div>

      <div class="hr-chat-message-time">
        Just now
      </div>
    `;

    chatMessages.appendChild(
      messageElement
    );


    /*
     * Clear input
     */
    chatInput.value = '';

    chatInput.focus();


    /*
     * Scroll to latest message
     */
    chatMessages.scrollTop =
      chatMessages.scrollHeight;

  }


  /* ---------------------------------------------------------
     ESCAPE CHAT HTML
     --------------------------------------------------------- */

  function escapeChatHtml(value) {

    const div =
      document.createElement('div');

    div.textContent =
      value;

    return div.innerHTML;

  }


  /* ---------------------------------------------------------
     CHAT BUTTONS
     --------------------------------------------------------- */

  chatButtons.forEach(button => {

    button.addEventListener(
      'click',
      () => {

        openChat(button);

      }
    );

  });


  /* ---------------------------------------------------------
     CLOSE BUTTONS
     --------------------------------------------------------- */

  chatCloseButtons.forEach(button => {

    button.addEventListener(
      'click',
      closeChat
    );

  });


  /* ---------------------------------------------------------
     CLICK OUTSIDE
     --------------------------------------------------------- */

  chatModal.addEventListener(
    'click',
    event => {

      if (event.target === chatModal) {
        closeChat();
      }

    }
  );


  /* ---------------------------------------------------------
     SEND BUTTON
     --------------------------------------------------------- */

  if (chatSend) {

    chatSend.addEventListener(
      'click',
      sendMessage
    );

  }


  /* ---------------------------------------------------------
     ENTER TO SEND
     --------------------------------------------------------- */

  if (chatInput) {

    chatInput.addEventListener(
      'keydown',
      event => {

        if (
          event.key === 'Enter' &&
          !event.shiftKey
        ) {

          event.preventDefault();

          sendMessage();

        }

      }
    );

  }


  /* ---------------------------------------------------------
     ESC TO CLOSE
     --------------------------------------------------------- */

  document.addEventListener(
    'keydown',
    event => {

      if (
        event.key === 'Escape' &&
        chatModal.classList.contains('show')
      ) {

        closeChat();

      }

    }
  );

}