/* =========================================================
   AORO CARE — Doctor · AI Health Insights

   Self-contained. Does not depend on doctor_dashboard.js or
   doctor_my_patients.js. Handles:
   - Sidebar toggle · dark mode (same localStorage key as the portal)
   - Topbar search (calls the existing pages.doctor_global_search)
   - Patient picker (assigned patients rendered by the server)
   - Period selection · loading data · rendering charts and sections
   - Empty / insufficient-data states

   No patient, health or insight values live in this file.
   Every displayed value comes from the JSON returned by
   /doctor-ai-health-insights/data.
   ========================================================= */

(function () {
  'use strict';

  const page = document.getElementById('aiInsightsPage');
  if (!page) return;

  const DATA_URL = page.dataset.dataUrl;
  const SEARCH_URL = page.dataset.searchUrl;
  const LOGIN_URL = page.dataset.loginUrl;

  const NO_DATA = 'No data available';
  const NO_PERIOD_DATA = 'No health data available for the selected period.';
  const NO_PATIENT_DATA = 'No health data available for this patient.';
  const INSUFFICIENT_TREND = 'Insufficient data for trend analysis.';
  const INSUFFICIENT_INSIGHT = 'Insufficient health data for a reliable insight.';

  const $ = (id) => document.getElementById(id);

  const el = {
    patientInput: $('aiPatientSearch'),
    patientList: $('aiPatientList'),
    patientPicker: $('aiPatientPicker'),
    period: $('aiPeriod'),
    customRange: $('aiCustomRange'),
    startDate: $('aiStartDate'),
    endDate: $('aiEndDate'),
    applyRange: $('aiApplyRange'),
    state: $('aiState'),
    results: $('aiResults'),
    summarySub: $('aiSummarySub'),
    summaryBody: $('aiSummaryBody'),
    overviewSub: $('aiOverviewSub'),
    overviewBody: $('aiOverviewBody'),
    trendSub: $('aiTrendSub'),
    trendBody: $('aiTrendBody'),
    analysisBody: $('aiAnalysisBody'),
    patternsBody: $('aiPatternsBody'),
    attentionBody: $('aiAttentionBody'),
    followUpBody: $('aiFollowUpBody'),
    historyBody: $('aiHistoryBody')
  };

  /* ---------------------------------------------------------
     Helpers
  --------------------------------------------------------- */
  function esc(value) {
    const div = document.createElement('div');
    div.textContent = value == null ? '' : String(value);
    return div.innerHTML;
  }

  function hasValue(v) {
    return v !== null && v !== undefined && v !== '';
  }

  function num(v) {
    const n = Number(v);
    return Number.isInteger(n) ? String(n) : String(+n.toFixed(2));
  }

  function withUnit(v, unit) {
    if (!unit) return num(v);
    return unit === '%' ? num(v) + '%' : num(v) + ' ' + unit;
  }

  function noData() {
    return '<span class="ai-no-data">' + NO_DATA + '</span>';
  }

  function emptyBlock(message, icon) {
    return (
      '<div class="ai-empty"><i class="fa-solid ' + (icon || 'fa-circle-info') + '"></i>' +
      esc(message) + '</div>'
    );
  }

  /* ---------------------------------------------------------
     Sidebar toggle (mobile / tablet)
  --------------------------------------------------------- */
  function initSidebarToggle() {
    const sidebar = $('hrSidebar');
    const toggle = $('hrSidebarToggle');
    const overlay = $('hrOverlay');
    if (!sidebar || !toggle || !overlay) return;

    const open = () => { sidebar.classList.add('show'); overlay.classList.add('show'); };
    const close = () => { sidebar.classList.remove('show'); overlay.classList.remove('show'); };

    toggle.addEventListener('click', () => {
      sidebar.classList.contains('show') ? close() : open();
    });
    overlay.addEventListener('click', close);
    window.addEventListener('resize', () => {
      if (window.innerWidth > 1199.98) close();
    });
  }

  /* ---------------------------------------------------------
     Dark mode (same storage key the other Doctor pages use)
  --------------------------------------------------------- */
  let lastPayload = null;

  function initThemeToggle() {
    const btn = $('hrThemeToggle');
    const html = document.documentElement;
    if (!btn) return;

    const setTheme = (mode) => {
      html.setAttribute('data-theme', mode);
      try { localStorage.setItem('hr-doctor-theme', mode); } catch (e) { /* ignore */ }
      const icon = btn.querySelector('i');
      if (icon) icon.className = mode === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    };

    let saved = null;
    try { saved = localStorage.getItem('hr-doctor-theme'); } catch (e) { /* ignore */ }
    if (saved) setTheme(saved);

    btn.addEventListener('click', () => {
      const current = html.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
      setTheme(current === 'dark' ? 'light' : 'dark');
      if (lastPayload) renderCharts(lastPayload);
    });
  }

  /* ---------------------------------------------------------
     Topbar search — uses the existing doctor global-search
     endpoint and the existing result styles (doctor_dashboard.css)
  --------------------------------------------------------- */
  function initTopbarSearch() {
    return; // Handled by doctor_global_search.js

    const ORDER = [
      'Navigation', 'Patients', 'Appointments', 'Prescriptions',
      'Health Ring', 'Emergency Alerts', 'Reports', 'Notifications', 'AI Insights'
    ];

    const navLinks = Array.from(document.querySelectorAll('.hr-sidebar a.hr-nav-item'))
      .map((a) => ({
        text: a.textContent.replace(/\s+/g, ' ').trim(),
        href: a.getAttribute('href'),
        icon: (a.querySelector('i') && a.querySelector('i').className) || 'fa-solid fa-compass'
      }))
      .filter((n) => n.text && n.href && n.href !== '#');

    let timer = null;
    let controller = null;
    let requestId = 0;

    const open = () => panel.classList.add('show');
    const close = () => panel.classList.remove('show');
    const show = (html) => { panel.innerHTML = html; open(); };
    const message = (icon, text) =>
      show('<div class="hr-search-empty"><i class="fa-solid ' + icon + '"></i> ' + esc(text) + '</div>');

    function renderResults(items) {
      if (!items.length) { message('fa-magnifying-glass', 'No results found'); return; }

      const groups = {};
      items.forEach((item) => {
        const cat = item.category || 'Results';
        (groups[cat] = groups[cat] || []).push(item);
      });

      let html = '';
      ORDER.forEach((cat) => {
        if (!groups[cat]) return;
        html += '<div class="hr-global-search-category">' + esc(cat) + '</div>';
        groups[cat].forEach((item) => {
          html +=
            '<a class="hr-global-search-item" href="' + esc(item.url || '') + '">' +
            '<span class="hr-global-search-icon"><i class="' + esc(item.icon || 'fa-solid fa-circle') + '"></i></span>' +
            '<span class="hr-global-search-content">' +
            '<span class="hr-global-search-title">' + esc(item.title) + '</span><br>' +
            '<span class="hr-global-search-subtitle">' + esc(item.subtitle) + '</span>' +
            '</span></a>';
        });
      });
      show(html);
    }

    async function run(query) {
      const term = (query || '').trim();
      if (term.length < 2) { close(); return; }

      const lower = term.toLowerCase();
      const navMatches = navLinks
        .filter((n) => n.text.toLowerCase().includes(lower))
        .slice(0, 5)
        .map((n) => ({ category: 'Navigation', title: n.text, subtitle: 'Go to page', url: n.href, icon: n.icon }));

      if (!SEARCH_URL) { renderResults(navMatches); return; }

      message('fa-spinner fa-spin', 'Searching…');
      const id = ++requestId;
      if (controller) controller.abort();
      controller = new AbortController();

      try {
        const res = await fetch(SEARCH_URL + '?q=' + encodeURIComponent(term), {
          credentials: 'same-origin',
          signal: controller.signal
        });
        if (id !== requestId) return;
        if (!res.ok) { message('fa-triangle-exclamation', 'Something went wrong. Please try again.'); return; }
        const payload = await res.json();
        if (id !== requestId) return;
        renderResults(navMatches.concat((payload && payload.results) || []));
      } catch (err) {
        if (err && err.name === 'AbortError') return;
        if (id !== requestId) return;
        message('fa-triangle-exclamation', 'Something went wrong. Please try again.');
      }
    }

    input.addEventListener('input', () => {
      clearTimeout(timer);
      if (input.value.trim().length < 2) { close(); return; }
      timer = setTimeout(() => run(input.value), 300);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { close(); input.blur(); }
    });
    input.addEventListener('focus', () => {
      if (input.value.trim().length >= 2 && panel.innerHTML.trim()) open();
    });
    document.addEventListener('click', (e) => {
      if (!wrap.contains(e.target)) close();
    });
  }

  /* ---------------------------------------------------------
     Page state
  --------------------------------------------------------- */
  const state = {
    patientId: null,
    period: el.period ? el.period.value : '7d',
    start: '',
    end: ''
  };

  let patients = [];
  try {
    patients = JSON.parse($('aiPatientData').textContent) || [];
  } catch (e) {
    patients = [];
  }

  function showState(type, text) {
    const icons = {
      info: 'fa-user-doctor',
      loading: 'fa-spinner fa-spin',
      error: 'fa-triangle-exclamation'
    };
    el.state.hidden = false;
    el.state.className = 'ai-state' + (type === 'error' ? ' is-error' : '');
    el.state.innerHTML = '<i class="fa-solid ' + (icons[type] || icons.info) + '"></i><span>' + esc(text) + '</span>';
  }

  function hideState() { el.state.hidden = true; }
  function hideResults() { el.results.hidden = true; }

  /* ---------------------------------------------------------
     Patient picker
  --------------------------------------------------------- */
  function patientLabel(p) { return hasValue(p.name) ? p.name : NO_DATA; }

  function renderPatientList(query) {
    const q = (query || '').trim().toLowerCase();

    if (!patients.length) {
      el.patientList.innerHTML = '<div class="ai-patient-empty">No patients are assigned to you.</div>';
      return;
    }

    const matches = patients.filter((p) =>
      !q ||
      (p.name || '').toLowerCase().includes(q) ||
      (p.code || '').toLowerCase().includes(q)
    );

    if (!matches.length) {
      el.patientList.innerHTML = '<div class="ai-patient-empty">No matching patients found.</div>';
      return;
    }

    el.patientList.innerHTML = matches.map((p) =>
      '<button type="button" class="ai-patient-option' + (p.id === state.patientId ? ' is-selected' : '') +
      '" data-id="' + esc(p.id) + '">' +
      '<span class="ai-patient-avatar"><i class="fa-solid fa-user"></i></span>' +
      '<span><span class="ai-patient-name">' + esc(patientLabel(p)) + '</span>' +
      '<span class="ai-patient-code">' + (hasValue(p.code) ? esc(p.code) : NO_DATA) + '</span></span>' +
      '</button>'
    ).join('');
  }

  function openPatientList() {
    renderPatientList(el.patientInput.value === selectedText() ? '' : el.patientInput.value);
    el.patientList.hidden = false;
    el.patientInput.setAttribute('aria-expanded', 'true');
  }

  function closePatientList() {
    el.patientList.hidden = true;
    el.patientInput.setAttribute('aria-expanded', 'false');
  }

  function selectedText() {
    const p = patients.find((x) => x.id === state.patientId);
    return p ? patientLabel(p) + (hasValue(p.code) ? ' (' + p.code + ')' : '') : '';
  }

  function selectPatient(id) {
    if (!patients.some((p) => p.id === id)) return;
    state.patientId = id;
    el.patientInput.value = selectedText();
    closePatientList();
    loadInsights();
  }

  function initPatientPicker() {
    if (!patients.length) {
      el.patientInput.disabled = true;
      el.patientInput.placeholder = 'No patients assigned';
      showState('info', 'No patients are assigned to you.');
      return;
    }

    el.patientInput.addEventListener('focus', openPatientList);
    el.patientInput.addEventListener('input', () => {
      renderPatientList(el.patientInput.value);
      el.patientList.hidden = false;
      el.patientInput.setAttribute('aria-expanded', 'true');
    });
    el.patientInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closePatientList();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const first = el.patientList.querySelector('.ai-patient-option');
        if (first) selectPatient(first.dataset.id);
      }
    });
    el.patientList.addEventListener('click', (e) => {
      const btn = e.target.closest('.ai-patient-option');
      if (btn) selectPatient(btn.dataset.id);
    });
    document.addEventListener('click', (e) => {
      if (!el.patientPicker.contains(e.target)) closePatientList();
    });

    const preselected = page.dataset.selectedPatient;
    if (preselected && patients.some((p) => p.id === preselected)) {
      selectPatient(preselected);
    }
  }

  /* ---------------------------------------------------------
     Period controls
  --------------------------------------------------------- */
  function initPeriod() {
    el.period.addEventListener('change', () => {
      state.period = el.period.value;
      el.customRange.hidden = state.period !== 'custom';
      if (state.period !== 'custom' && state.patientId) loadInsights();
    });

    el.applyRange.addEventListener('click', () => {
      state.start = el.startDate.value;
      state.end = el.endDate.value;
      if (!state.start || !state.end) {
        showState('error', 'Select both a start date and an end date.');
        hideResults();
        return;
      }
      if (state.end < state.start) {
        showState('error', 'The end date must not be before the start date.');
        hideResults();
        return;
      }
      if (state.patientId) loadInsights();
    });
  }

  /* ---------------------------------------------------------
     Load data
  --------------------------------------------------------- */
  let requestSeq = 0;
  let controller = null;

  async function loadInsights() {
    if (!state.patientId) {
      hideResults();
      showState('info', 'Select a patient to view health insights.');
      return;
    }

    const params = new URLSearchParams({ patient_id: state.patientId, period: state.period });

    if (state.period === 'custom') {
      if (!state.start || !state.end) {
        hideResults();
        showState('info', 'Choose a start and end date, then select Apply.');
        return;
      }
      params.set('start_date', state.start);
      params.set('end_date', state.end);
    }

    hideResults();
    showState('loading', 'Loading health insights…');

    const id = ++requestSeq;
    if (controller) controller.abort();
    controller = new AbortController();

    try {
      const res = await fetch(DATA_URL + '?' + params.toString(), {
        credentials: 'same-origin',
        signal: controller.signal
      });

      let payload = null;
      try { payload = await res.json(); } catch (e) { payload = null; }

      if (id !== requestSeq) return;

      if (res.status === 401 && LOGIN_URL) {
        window.location.href = LOGIN_URL;
        return;
      }

      if (!res.ok || !payload || !payload.success) {
        showState('error', (payload && payload.message) || 'Unable to load health insights. Please try again.');
        return;
      }

      lastPayload = payload;
      hideState();
      renderAll(payload);

    } catch (err) {
      if (err && err.name === 'AbortError') return;
      if (id !== requestSeq) return;
      showState('error', 'Unable to load health insights. Please try again.');
    }
  }

  /* ---------------------------------------------------------
     Rendering
  --------------------------------------------------------- */
  function renderAll(d) {
    el.results.hidden = false;
    renderSummary(d);
    renderOverview(d);
    renderTrends(d);
    renderAnalysis(d);
    renderPatterns(d);
    renderAttention(d);
    renderFollowUp(d);
    renderHistory(d);
  }

  /* ---------- Patient summary ---------- */
  function renderSummary(d) {
    const p = d.patient || {};
    const items = [
      ['Patient', hasValue(p.name) ? esc(p.name) : noData()],
      ['Patient code', hasValue(p.code) ? esc(p.code) : noData()],
      ['Age', hasValue(p.age) ? esc(p.age) : noData()],
      ['Gender', hasValue(p.gender) ? esc(p.gender) : noData()],
      ['Blood group', hasValue(p.blood_group) ? esc(p.blood_group) : noData()],
      ['Records in selected period', esc(d.record_count)],
      ['Latest reading', hasValue(d.latest_recorded_at) ? esc(d.latest_recorded_at) : noData()]
    ];

    el.summarySub.textContent = d.period && d.period.label
      ? d.period.label + ' · ' + d.period.text
      : '';

    el.summaryBody.innerHTML =
      '<div class="ai-summary-grid">' +
      items.map((i) =>
        '<div class="ai-summary-item"><div class="ai-summary-label">' + i[0] +
        '</div><div class="ai-summary-value">' + i[1] + '</div></div>'
      ).join('') +
      '</div>';
  }

  /* ---------- Current health overview ---------- */
  const OVERVIEW = [
    { key: 'heart_rate', label: 'Heart Rate', icon: 'fa-heart-pulse', bg: 'hr-bg-red', unit: 'bpm' },
    { key: 'spo2', label: 'SpO₂', icon: 'fa-lungs', bg: 'hr-bg-blue', unit: '%' },
    { key: 'blood_pressure', label: 'Blood Pressure', icon: 'fa-droplet', bg: 'hr-bg-purple', unit: 'mmHg' },
    { key: 'body_temperature', label: 'Body Temperature', icon: 'fa-temperature-half', bg: 'hr-bg-orange', unit: '',
      note: 'Stored value (unit not specified)' },
    { key: 'stress_level', label: 'Stress', icon: 'fa-brain', bg: 'hr-bg-red', unit: '' },
    { key: 'sleep_hours', label: 'Sleep', icon: 'fa-moon', bg: 'hr-bg-purple', unit: 'hrs' },
    { key: 'heart_rate_variability', label: 'HRV', icon: 'fa-wave-square', bg: 'hr-bg-teal', unit: '' },
    { key: 'respiratory_rate', label: 'Respiratory Rate', icon: 'fa-wind', bg: 'hr-bg-green', unit: 'breaths/min' }
  ];

  function renderOverview(d) {
    if (!d.has_any_data) {
      el.overviewSub.textContent = '';
      el.overviewBody.innerHTML = emptyBlock(NO_PATIENT_DATA, 'fa-heart-pulse');
      return;
    }

    el.overviewSub.textContent = 'Latest recorded reading for each metric';

    const cards = OVERVIEW.map((m) => {
      const r = (d.latest || {})[m.key];
      let value;
      let time = '';

      if (!r) {
        value = '<div class="hr-vital-value ai-no-data">' + NO_DATA + '</div>';
      } else {
        let text;
        if (m.key === 'blood_pressure') {
          text = num(r.systolic) + '/' + num(r.diastolic);
        } else {
          text = num(r.value);
        }
        value =
          '<div class="hr-vital-value">' + esc(text) +
          (m.unit ? ' <span class="hr-vital-unit">' + esc(m.unit) + '</span>' : '') +
          '</div>';
        time = hasValue(r.recorded_at)
          ? '<div class="ai-vital-time">Recorded: ' + esc(r.recorded_at) + '</div>'
          : '';
      }

      return (
        '<div class="hr-card hr-vital-card">' +
        '<div class="hr-vital-icon ' + m.bg + '"><i class="fa-solid ' + m.icon + '"></i></div>' +
        value +
        '<div class="hr-vital-label">' + esc(m.label) + '</div>' +
        time +
        (m.note && r ? '<div class="ai-vital-note">' + esc(m.note) + '</div>' : '') +
        '</div>'
      );
    });

    el.overviewBody.innerHTML = '<div class="ai-overview-grid">' + cards.join('') + '</div>';
  }

  /* ---------- Trends ---------- */
  const CHARTS = [
    { key: 'heart_rate', title: 'Heart Rate', unit: 'bpm', colors: ['red'] },
    { key: 'spo2', title: 'SpO₂', unit: '%', colors: ['primary'] },
    { key: 'blood_pressure', title: 'Blood Pressure', unit: 'mmHg', colors: ['purple', 'orange'] },
    { key: 'sleep_hours', title: 'Sleep', unit: 'hrs', colors: ['purple'], type: 'bar' },
    { key: 'stress_level', title: 'Stress', unit: '', colors: ['orange'] }
  ];

  let chartInstances = [];

  function chartColors() {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    return {
      grid: dark ? 'rgba(255,255,255,.06)' : 'rgba(15,23,42,.06)',
      text: dark ? '#94A3B8' : '#64748B',
      primary: '#2563EB',
      green: '#10B981',
      red: '#EF4444',
      orange: '#F59E0B',
      purple: '#7C3AED',
      teal: '#0EA5A5'
    };
  }

  function destroyCharts() {
    chartInstances.forEach((c) => c.destroy());
    chartInstances = [];
  }

  function renderTrends(d) {
    destroyCharts();

    if (d.record_count === 0) {
      el.trendSub.textContent = '';
      el.trendBody.innerHTML = emptyBlock(
        d.has_any_data ? NO_PERIOD_DATA : NO_PATIENT_DATA, 'fa-chart-line'
      );
      return;
    }

    el.trendSub.textContent = d.period ? d.period.label : '';

    el.trendBody.innerHTML =
      '<div class="ai-trend-grid">' +
      CHARTS.map((c) => {
        const t = (d.trends || {})[c.key];
        const ok = t && t.count >= 2;
        const note = ok && t.bucket
          ? '<div class="ai-trend-note">Averaged per ' + esc(t.bucket) + ' (' + esc(t.raw_count) + ' readings).</div>'
          : '';
        return (
  '<div class="ai-trend-card">' +
  '<h4 class="ai-trend-title">' + esc(c.title) +
  (c.unit ? ' <span class="ai-trend-unit">' + esc(c.unit) + '</span>' : '') +
  '</h4>' +
  (ok
    ? '<div class="ai-chart-wrap"><canvas id="aiChart-' + c.key + '"></canvas></div>' + note
    : emptyBlock(INSUFFICIENT_TREND, 'fa-chart-line')) +
  '</div>'
);
      }).join('') +
      '</div>';

    renderCharts(d);
  }

  function renderCharts(d) {
    if (!d || d.record_count === 0) return;

    if (typeof Chart === 'undefined') {
      el.trendBody.insertAdjacentHTML('beforeend', emptyBlock('Charts are unavailable right now.', 'fa-triangle-exclamation'));
      return;
    }

    destroyCharts();
    const c = chartColors();
    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.color = c.text;

    CHARTS.forEach((def) => {
      const t = (d.trends || {})[def.key];
      const canvas = $('aiChart-' + def.key);
      if (!t || t.count < 2 || !canvas) return;

      const many = t.count > 60;
      const datasets = t.series.map((s, i) => {
        const color = c[def.colors[i] || def.colors[0]];
        return {
          label: s.name,
          data: s.values,
          borderColor: color,
          backgroundColor: def.type === 'bar' ? color : color + '22',
          borderWidth: 2,
          tension: 0.35,
          pointRadius: many ? 0 : 3,
          pointHoverRadius: 5,
          borderRadius: def.type === 'bar' ? 6 : 0,
          maxBarThickness: 24,
          spanGaps: true,
          fill: false
        };
      });

      chartInstances.push(new Chart(canvas, {
        type: def.type || 'line',
        data: { labels: t.labels, datasets: datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: {
              display: datasets.length > 1,
              position: 'bottom',
              labels: { boxWidth: 8, boxHeight: 8, usePointStyle: true, padding: 14, font: { size: 11.5 } }
            },
            tooltip: {
              callbacks: {
                label: (ctx) =>
                  ctx.dataset.label + ': ' + withUnit(ctx.parsed.y, def.unit)
              }
            }
          },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 11 }, maxTicksLimit: 8, maxRotation: 0 } },
            y: { grid: { color: c.grid }, ticks: { font: { size: 11 } }, beginAtZero: def.type === 'bar' }
          }
        }
      }));
    });
  }

  /* ---------- Health data analysis ---------- */
  function analysisUnavailable(d) {
    if (d.record_count === 0) {
      return d.has_any_data ? NO_PERIOD_DATA : NO_PATIENT_DATA;
    }
    return null;
  }

  function renderAnalysis(d) {
    const unavailable = analysisUnavailable(d);
    if (unavailable) {
      el.analysisBody.innerHTML = emptyBlock(unavailable, 'fa-chart-simple');
      return;
    }

    const a = d.analysis;
    let html = '';

    if (!a.sufficient) {
      html += emptyBlock(INSUFFICIENT_INSIGHT, 'fa-chart-simple');
    } else if (a.analyzed_metrics && a.analyzed_metrics.length) {
      html += '<p class="ai-coverage">Analysis based on: ' + esc(a.analyzed_metrics.join(', ')) + '.</p>';
    }

    if (a.observations && a.observations.length) {
      const iconFor = { stable: 'fa-equals', increase: 'fa-arrow-trend-up', decrease: 'fa-arrow-trend-down', insufficient: 'fa-minus' };
      const cls = { stable: 'is-stable', increase: 'is-up', decrease: 'is-down', insufficient: '' };

      html += '<ul class="ai-obs-list">' + a.observations.map((o) =>
        '<li class="ai-obs-item"><span class="ai-obs-icon ' + (cls[o.kind] || '') + '"><i class="fa-solid ' +
        (iconFor[o.kind] || 'fa-minus') + '"></i></span><span>' + esc(o.text) + '</span></li>'
      ).join('') + '</ul>';
    }

    if (a.stats && a.stats.length) {
      html +=
        '<h4 class="ai-stats-title">Readings in the selected period</h4>' +
        '<div class="table-responsive"><table class="table hr-table"><thead><tr>' +
        '<th>Metric</th><th>Readings</th><th>Lowest</th><th>Average</th><th>Highest</th>' +
        '</tr></thead><tbody>' +
        a.stats.map((s) =>
          '<tr><td>' + esc(s.metric) + '</td><td>' + esc(s.count) + '</td><td>' +
          esc(withUnit(s.min, s.unit)) + '</td><td>' + esc(withUnit(s.avg, s.unit)) + '</td><td>' +
          esc(withUnit(s.max, s.unit)) + '</td></tr>'
        ).join('') +
        '</tbody></table></div>';
    }

    el.analysisBody.innerHTML = html || emptyBlock(INSUFFICIENT_INSIGHT, 'fa-chart-simple');
  }

  /* ---------- Patterns ---------- */
  const PATTERN_ICON = {
    hr_high: 'fa-heart-pulse',
    hr_low: 'fa-heart-pulse',
    spo2_low: 'fa-lungs',
    bp_high: 'fa-droplet',
    sleep_short: 'fa-moon',
    sleep_decline: 'fa-moon',
    resp_out: 'fa-wind',
    stress_up: 'fa-brain',
    hrv_change: 'fa-wave-square'
  };

  function renderPatterns(d) {
    const unavailable = analysisUnavailable(d);
    if (unavailable) {
      el.patternsBody.innerHTML = emptyBlock(unavailable, 'fa-wave-square');
      return;
    }

    const a = d.analysis;

    if (!a.sufficient) {
      el.patternsBody.innerHTML = emptyBlock(INSUFFICIENT_INSIGHT, 'fa-wave-square');
      return;
    }

    if (!a.patterns.length) {
      el.patternsBody.innerHTML = emptyBlock('No patterns were detected in the selected data.', 'fa-wave-square');
      return;
    }

    el.patternsBody.innerHTML = a.patterns.map((p) =>
      '<div class="ai-pattern-card' + (p.attention ? ' is-attention' : '') + '">' +
      '<div class="ai-pattern-icon"><i class="fa-solid ' + (PATTERN_ICON[p.key] || 'fa-wave-square') + '"></i></div>' +
      '<div><p class="ai-pattern-title">' + esc(p.title) + '</p>' +
      '<p class="ai-pattern-desc">' + esc(p.description) + '</p>' +
      (hasValue(p.period) ? '<div class="ai-pattern-meta">' + esc(p.period) + '</div>' : '') +
      '</div></div>'
    ).join('');
  }

  /* ---------- Attention ---------- */
  function renderAttention(d) {
    const unavailable = analysisUnavailable(d);
    if (unavailable) {
      el.attentionBody.innerHTML = emptyBlock(unavailable, 'fa-circle-exclamation');
      return;
    }

    const a = d.analysis;

    if (!a.sufficient) {
      el.attentionBody.innerHTML = emptyBlock(INSUFFICIENT_INSIGHT, 'fa-circle-exclamation');
      return;
    }

    if (!a.attention.length) {
      el.attentionBody.innerHTML =
        '<div class="ai-all-clear"><i class="fa-solid fa-circle-check"></i><span>' +
        esc(a.message) + '</span></div>';
      return;
    }

    el.attentionBody.innerHTML = a.attention.map((x) =>
      '<div class="ai-attention-card">' +
      '<div class="ai-attention-top"><span class="ai-attention-metric">' + esc(x.metric) +
      '</span><span class="ai-attention-reason">' + esc(x.reason) + '</span></div>' +
      '<p class="ai-attention-text">' + esc(x.observed) + '</p>' +
      (hasValue(x.period) ? '<div class="ai-attention-period">' + esc(x.period) + '</div>' : '') +
      '</div>'
    ).join('');
  }

  /* ---------- Follow-up ---------- */
  function renderFollowUp(d) {
    const unavailable = analysisUnavailable(d);
    if (unavailable) {
      el.followUpBody.innerHTML = emptyBlock(unavailable, 'fa-list-check');
      return;
    }

    const a = d.analysis;

    if (!a.sufficient) {
      el.followUpBody.innerHTML = emptyBlock(INSUFFICIENT_INSIGHT, 'fa-list-check');
      return;
    }

    if (!a.follow_up.length) {
      el.followUpBody.innerHTML = emptyBlock('No follow-up suggestions were derived from the selected data.', 'fa-list-check');
      return;
    }

    el.followUpBody.innerHTML =
      '<ul class="ai-follow-list">' +
      a.follow_up.map((f) =>
        '<li class="ai-follow-item"><i class="fa-solid fa-circle-check"></i><span>' + esc(f) + '</span></li>'
      ).join('') +
      '</ul>' +
      '<p class="ai-follow-note">These suggestions are informational. The treating doctor remains the final decision-maker.</p>';
  }

  /* ---------- Insight history ---------- */
  function riskBadge(level) {
    const l = String(level || '').toLowerCase();
    const cls = l === 'high' || l === 'critical' ? 'hr-badge-danger'
      : l === 'medium' || l === 'moderate' ? 'hr-badge-warning'
      : l === 'low' ? 'hr-badge-success'
      : 'hr-badge-neutral';
    return '<span class="hr-badge ' + cls + '">' + esc(level) + ' risk</span>';
  }

  function renderHistory(d) {
    const list = d.insights || [];

    if (!list.length) {
      el.historyBody.innerHTML = emptyBlock('No insight records are available for this patient.', 'fa-brain');
      return;
    }

    el.historyBody.innerHTML = list.map((i) => {
      const meta = [];
      if (hasValue(i.created_at)) meta.push('<span>' + esc(i.created_at) + '</span>');
      if (hasValue(i.insight_type)) meta.push('<span>' + esc(i.insight_type) + '</span>');
      if (hasValue(i.confidence_score)) meta.push('<span>Confidence score: ' + esc(num(i.confidence_score)) + '</span>');

      return (
        '<div class="ai-insight-item">' +
        '<div class="ai-insight-top"><p class="ai-insight-title">' +
        (hasValue(i.title) ? esc(i.title) : NO_DATA) + '</p>' +
        (hasValue(i.risk_level) ? riskBadge(i.risk_level) : '') + '</div>' +
        (meta.length ? '<div class="ai-insight-meta">' + meta.join('<span>·</span>') + '</div>' : '') +
        (hasValue(i.description)
          ? '<p class="ai-insight-text"><span class="ai-insight-label">Description: </span>' + esc(i.description) + '</p>'
          : '') +
        (hasValue(i.recommendation)
          ? '<p class="ai-insight-text"><span class="ai-insight-label">Recommendation: </span>' + esc(i.recommendation) + '</p>'
          : '') +
        '</div>'
      );
    }).join('') +
      (d.insights_has_more ? '<p class="ai-history-more">Showing the ' + list.length + ' most recent records.</p>' : '');
  }

  /* ---------------------------------------------------------
     Init
  --------------------------------------------------------- */
  initSidebarToggle();
  initThemeToggle();
  initTopbarSearch();
  initPeriod();
  initPatientPicker();

})();