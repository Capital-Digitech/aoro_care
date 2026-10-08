/**
 * AORO CARE — Doctor Portal Global Search
 *
 * Provides real-time patient search across all Doctor Portal topbar search boxes.
 * Searches database for doctor's assigned patients by:
 *   - Patient Name
 *   - Patient Email
 *   - Patient ID / Code
 *
 * Displays matching patients or "No patients found".
 * Clicking a patient opens the existing patient details view on My Patients.
 */

(function () {
  'use strict';

  function initDoctorGlobalSearch() {
    // Target the topbar search element on any Doctor Portal page
    const searchWrap = document.querySelector('.hr-topbar .hr-search') || document.querySelector('.hr-search');
    if (!searchWrap) return;

    const input = searchWrap.querySelector('input');
    if (!input) return;

    input.setAttribute('autocomplete', 'off');
    input.setAttribute('spellcheck', 'false');

    // Ensure searchWrap has relative positioning for dropdown
    if (window.getComputedStyle(searchWrap).position === 'static') {
      searchWrap.style.position = 'relative';
    }

    // Get or create the results panel
    let panel = searchWrap.querySelector('.hr-global-search-results, .hr-search-results, #hrGlobalSearchResults');
    if (!panel) {
      panel = document.createElement('div');
      panel.className = 'hr-global-search-results';
      panel.id = 'hrGlobalSearchResults';
      searchWrap.appendChild(panel);
    }

    const searchUrl = input.dataset.searchUrl || '/doctor-global-search';

    let debounceTimer = null;
    let abortController = null;
    let requestId = 0;
    let selectedIndex = -1;

    function escapeHtml(str) {
      if (str == null) return '';
      const div = document.createElement('div');
      div.textContent = String(str);
      return div.innerHTML;
    }

    function openPanel() {
      panel.classList.add('show');
    }

    function closePanel() {
      panel.classList.remove('show');
      selectedIndex = -1;
    }

    function showState(html) {
      panel.innerHTML = html;
      openPanel();
    }

    function renderLoading() {
      showState(`
        <div class="hr-search-empty">
          <i class="fa-solid fa-spinner fa-spin"></i> Searching...
        </div>
      `);
    }

    function renderEmpty() {
      showState(`
        <div class="hr-search-empty">
          <i class="fa-solid fa-user-slash"></i> No patients found
        </div>
      `);
    }

    function renderError() {
      showState(`
        <div class="hr-search-empty">
          <i class="fa-solid fa-triangle-exclamation"></i> Error loading patients. Please try again.
        </div>
      `);
    }

    function renderPatients(patients) {
      if (!patients || patients.length === 0) {
        renderEmpty();
        return;
      }

      const itemsHtml = patients.map((p, idx) => {
        const name = escapeHtml(p.name || 'Unknown Patient');
        const code = escapeHtml(p.code || p.patient_code || '-');
        const email = p.email ? escapeHtml(p.email) : '';
        const subtitle = email ? `${code} &middot; ${email}` : code;
        const url = escapeHtml(p.url || `/doctor-my-patients#patient-row-${p.id}`);

        return `
          <a class="hr-global-search-item" href="${url}" data-patient-id="${escapeHtml(p.id)}" data-index="${idx}" role="option">
            <span class="hr-global-search-icon">
              <i class="fa-solid fa-hospital-user"></i>
            </span>
            <span class="hr-global-search-content">
              <span class="hr-global-search-title">${name}</span>
              <br>
              <span class="hr-global-search-subtitle">${subtitle}</span>
            </span>
          </a>
        `;
      }).join('');

      showState(itemsHtml);
      attachItemClickHandlers();
    }

    function handlePatientSelection(patientId, targetUrl) {
      closePanel();

      const isOnMyPatients = window.location.pathname.includes('/doctor-my-patients');
      const hash = `#patient-row-${patientId}`;

      if (isOnMyPatients) {
        window.location.hash = hash;
        const row = document.getElementById(`patient-row-${patientId}`);
        if (row) {
          row.style.display = '';
          row.classList.add('hr-row-highlight');
          row.scrollIntoView({ behavior: 'smooth', block: 'center' });

          const viewBtn = row.querySelector('[data-action="view-patient"]');
          if (viewBtn) {
            setTimeout(() => {
              viewBtn.click();
            }, 300);
          }

          setTimeout(() => {
            row.classList.remove('hr-row-highlight');
          }, 3000);
        }
      } else {
        window.location.href = targetUrl || `/doctor-my-patients${hash}`;
      }
    }

    function attachItemClickHandlers() {
      const items = panel.querySelectorAll('.hr-global-search-item');
      items.forEach((item) => {
        item.addEventListener('click', (e) => {
          const patientId = item.getAttribute('data-patient-id');
          const url = item.getAttribute('href');
          if (window.location.pathname.includes('/doctor-my-patients')) {
            e.preventDefault();
            handlePatientSelection(patientId, url);
          }
        });
      });
    }

    async function executeSearch(query) {
      const term = (query || '').trim();
      if (!term) {
        closePanel();
        panel.innerHTML = '';
        return;
      }

      renderLoading();

      const currentId = ++requestId;
      if (abortController) {
        abortController.abort();
      }
      abortController = new AbortController();

      try {
        const response = await fetch(
          `${searchUrl}?q=${encodeURIComponent(term)}`,
          {
            credentials: 'same-origin',
            signal: abortController.signal
          }
        );

        if (currentId !== requestId) return;

        if (!response.ok) {
          renderError();
          return;
        }

        const data = await response.json();
        if (currentId !== requestId) return;

        const patients = data.patients || data.results || [];
        renderPatients(patients);
      } catch (err) {
        if (err.name === 'AbortError') return;
        if (currentId !== requestId) return;
        renderError();
      }
    }

    // Input event with 250ms debounce
    input.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      const val = e.target.value;
      if (!val || !val.trim()) {
        closePanel();
        panel.innerHTML = '';
        return;
      }
      debounceTimer = setTimeout(() => {
        executeSearch(val);
      }, 250);
    });

    // Keyboard navigation
    input.addEventListener('keydown', (e) => {
      const items = panel.querySelectorAll('.hr-global-search-item');
      if (!panel.classList.contains('show') || items.length === 0) {
        if (e.key === 'Escape') {
          closePanel();
          input.blur();
        }
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedIndex = (selectedIndex + 1) % items.length;
        updateActiveItem(items);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedIndex = selectedIndex <= 0 ? items.length - 1 : selectedIndex - 1;
        updateActiveItem(items);
      } else if (e.key === 'Enter') {
        if (selectedIndex >= 0 && selectedIndex < items.length) {
          e.preventDefault();
          items[selectedIndex].click();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closePanel();
        input.blur();
      }
    });

    function updateActiveItem(items) {
      items.forEach((item, idx) => {
        if (idx === selectedIndex) {
          item.classList.add('active');
          item.scrollIntoView({ block: 'nearest' });
        } else {
          item.classList.remove('active');
        }
      });
    }

    // Focus re-opening
    input.addEventListener('focus', () => {
      if (input.value.trim().length > 0 && panel.innerHTML.trim() !== '') {
        openPanel();
      }
    });

    // Dismiss on click outside
    document.addEventListener('click', (e) => {
      if (!searchWrap.contains(e.target)) {
        closePanel();
      }
    });

    // Expose API
    window.HRDoctorGlobalSearch = {
      search: executeSearch,
      close: closePanel
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDoctorGlobalSearch);
  } else {
    initDoctorGlobalSearch();
  }
})();
