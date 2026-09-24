/* =========================================================
   HEALTH RING — Doctor Dashboard Behavior
   Sidebar toggle · Dark mode · Live date · Animated counters
   Mark-all-read · Chart.js configurations
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {
  initSidebarToggle();
  initThemeToggle();
  setTodayDate();
  animateCounters();
  initMarkAllRead();
  initCharts();
  initGlobalSearch();
});

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
   Dark mode toggle (persisted)
--------------------------------------------------------- */
function initThemeToggle(){
  const btn  = document.getElementById('hrThemeToggle');
  const html = document.documentElement;
  if(!btn) return;

  const saved = localStorage.getItem('hr-doctor-theme');
  if(saved) setTheme(saved);

  btn.addEventListener('click', () => {
    const current = html.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    setTheme(current === 'dark' ? 'light' : 'dark');
    refreshChartsTheme();
  });

  function setTheme(mode){
    html.setAttribute('data-theme', mode);
    localStorage.setItem('hr-doctor-theme', mode);
    const icon = btn.querySelector('i');
    if(icon){
      icon.className = mode === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    }
  }
}

/* ---------------------------------------------------------
   Today's date in the welcome banner
--------------------------------------------------------- */
function setTodayDate(){
  const el = document.getElementById('hrTodayDate');
  if(!el) return;
  const today = new Date();
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  el.textContent = today.toLocaleDateString('en-US', options);
}

/* ---------------------------------------------------------
   Animated counters for stat cards
--------------------------------------------------------- */
function animateCounters(){
  const counters = document.querySelectorAll('[data-counter]');
  const duration = 1200;

  const run = (el) => {
    const target = parseInt(el.getAttribute('data-counter'), 10) || 0;
    const start = performance.now();

    const step = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      const value = Math.floor(eased * target);
      el.textContent = value.toLocaleString('en-US');
      if(progress < 1){
        requestAnimationFrame(step);
      } else {
        el.textContent = target.toLocaleString('en-US');
      }
    };
    requestAnimationFrame(step);
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if(entry.isIntersecting){
        run(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: .4 });

  counters.forEach(el => observer.observe(el));
}

/* ---------------------------------------------------------
   Notifications — Mark All Read
--------------------------------------------------------- */
function initMarkAllRead(){
  const btn = document.getElementById('hrMarkAllRead');
  const countEl = document.getElementById('hrUnreadCount');
  if(!btn) return;

  btn.addEventListener('click', () => {
    document.querySelectorAll('.hr-notif-item.unread').forEach(item => {
      item.classList.remove('unread');
      item.removeAttribute('data-unread');
      const dot = item.querySelector('.hr-unread-dot');
      if(dot) dot.remove();
    });
    if(countEl) countEl.textContent = '0';
  });
}

/* ---------------------------------------------------------
   Chart.js — shared helpers
--------------------------------------------------------- */
let hrChartInstances = [];

function chartColors(){
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  return {
    grid: dark ? 'rgba(255,255,255,.06)' : 'rgba(15,23,42,.06)',
    text: dark ? '#94A3B8' : '#64748B',
    primary: '#2563EB',
    green:   '#10B981',
    red:     '#EF4444',
    orange:  '#F59E0B',
    purple:  '#7C3AED',
    teal:    '#0EA5A5'
  };
}

function gradientFill(canvas, hexColor){
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height || 260);
  gradient.addColorStop(0, hexToRgba(hexColor, .22));
  gradient.addColorStop(1, hexToRgba(hexColor, 0));
  return gradient;
}

function hexToRgba(hex, alpha){
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function baseLineOptions(c, singleSeries){
  return {
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: !singleSeries, position: 'bottom', labels: { boxWidth: 8, boxHeight: 8, usePointStyle: true, padding: 14, font: { size: 11.5 } } }
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 11 } } },
      y: { grid: { color: c.grid }, ticks: { font: { size: 11 } } }
    }
  };
}

function baseDoughnutOptions(){
  return {
    responsive: true, maintainAspectRatio: false,
    cutout: '68%',
    plugins: {
      legend: { position: 'bottom', labels: { boxWidth: 8, boxHeight: 8, usePointStyle: true, padding: 14, font: { size: 11.5 } } }
    }
  };
}

/* ---------------------------------------------------------
   Chart.js — initialize all dashboard charts
--------------------------------------------------------- */
function initCharts(){
  if(typeof Chart === 'undefined') return;
  const c = chartColors();
  Chart.defaults.font.family = "'Inter', sans-serif";
  Chart.defaults.color = c.text;
  hrChartInstances = [];

  /* ---------- Patient Recovery Trend (line) ---------- */
  const ctxRecovery = document.getElementById('chartRecoveryTrend');

if (ctxRecovery) {
    hrChartInstances.push(new Chart(ctxRecovery, {
        type: 'line',
        data: {
            labels: ['Feb','Mar','Apr','May','Jun','Jul'],
            datasets: [{
                label: 'Avg. Recovery Score',
                data: dashboardData.recovery,
          borderColor: c.primary,
          backgroundColor: gradientFill(ctxRecovery, c.primary),
          fill: true, tension: .4, borderWidth: 2.5,
          pointRadius: 0, pointHoverRadius: 5
        }]
      },
      options: baseLineOptions(c, true)
    }));
  }

  /* ---------- Heart Rate Distribution (doughnut) ---------- */
  const ctxHeartRate = document.getElementById('chartHeartRateDist');
  if(ctxHeartRate){
    hrChartInstances.push(new Chart(ctxHeartRate, {
      type: 'doughnut',
      data: {
        labels: ['Normal (60-100)', 'Elevated (100-120)', 'High (120+)', 'Low (<60)'],
        datasets: [{
          data: dashboardData.heartRate,
          backgroundColor: [c.green, c.orange, c.red, c.primary],
          borderWidth: 0,
          hoverOffset: 6
        }]
      },
      options: baseDoughnutOptions()
    }));
  }

  /* ---------- Daily Appointments (bar) ---------- */
  const ctxDailyAppt = document.getElementById('chartDailyAppointments');
  if(ctxDailyAppt){
    hrChartInstances.push(new Chart(ctxDailyAppt, {
      type: 'bar',
      data: {
        labels: ['Mon','Tue','Wed','Thu','Fri','Sat'],
        datasets: [{
          label: 'Appointments',
          data: dashboardData.appointments,
          backgroundColor: c.primary,
          borderRadius: 8,
          maxBarThickness: 24
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 11 } } },
          y: { grid: { color: c.grid }, ticks: { font: { size: 11 } } }
        }
      }
    }));
  }

  /* ---------- Patient Health Score (radar) ---------- */
  const ctxRadar = document.getElementById('chartHealthScoreRadar');
  if(ctxRadar){
    hrChartInstances.push(new Chart(ctxRadar, {
      type: 'radar',
      data: {
        labels: ['Cardiac', 'Respiratory', 'Sleep', 'Activity', 'Stress', 'Nutrition'],
        datasets: [{
          label: 'Patient Average',
          data: dashboardData.healthScore,
          borderColor: c.primary,
          backgroundColor: hexToRgba(c.primary, .18),
          pointBackgroundColor: c.primary,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          r: {
            grid: { color: c.grid },
            angleLines: { color: c.grid },
            pointLabels: { font: { size: 10.5 } },
            ticks: { display: false, backdropColor: 'transparent' },
            suggestedMin: 0, suggestedMax: 100
          }
        }
      }
    }));
  }

  /* ---------- Emergency Cases (line) ---------- */
  const ctxEmergency = document.getElementById('chartEmergencyCases');
  if(ctxEmergency){
    hrChartInstances.push(new Chart(ctxEmergency, {
      type: 'line',
      data: {
        labels: ['W1','W2','W3','W4','W5','W6'],
        datasets: [{
          label: 'Cases',
          data: dashboardData.emergency,
          borderColor: c.red,
          backgroundColor: gradientFill(ctxEmergency, c.red),
          fill: true, tension: .4, borderWidth: 2.5,
          pointRadius: 3, pointBackgroundColor: c.red
        }]
      },
      options: baseLineOptions(c, true)
    }));
  }

  /* ---------- Weekly Consultation (bar, grouped) ---------- */
  const ctxWeekly = document.getElementById('chartWeeklyConsultation');
  if(ctxWeekly){
    hrChartInstances.push(new Chart(ctxWeekly, {
      type: 'bar',
      data: {
        labels: ['Wk 1','Wk 2','Wk 3','Wk 4','Wk 5','Wk 6'],
        datasets: [
          { label: 'In-Person',data: dashboardData.inPerson, backgroundColor: c.primary, borderRadius: 6, maxBarThickness: 22 },
          { label: 'Video Call',data: dashboardData.video, backgroundColor: c.teal,    borderRadius: 6, maxBarThickness: 22 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 8, boxHeight: 8, usePointStyle: true, padding: 14, font: { size: 11.5 } } } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 11 } } },
          y: { grid: { color: c.grid }, ticks: { font: { size: 11 } } }
        }
      }
    }));
  }
}

/* ---------------------------------------------------------
   Refresh chart colors when theme changes
--------------------------------------------------------- */
function refreshChartsTheme(){
  hrChartInstances.forEach(chart => chart.destroy());
  initCharts();
}

/* ---------------------------------------------------------
   DOCTOR PORTAL — TRUE GLOBAL SEARCH
   Attaches to the existing #hrSearchPatient topbar input.
   Combines two sources:
     1. Navigation — matched client-side against the real
        sidebar links already rendered on the page (.hr-sidebar a),
        so it always reflects the actual sidebar, never a
        hardcoded duplicate list.
     2. Everything else (Patients, Appointments, Prescriptions,
        Health Ring, Emergency Alerts, Reports, Notifications,
        AI Insights) — fetched from GET pages.doctor_global_search
        (URL read from data-search-url, rendered via url_for()),
        which is scoped server-side to the logged-in doctor.
   Exposes window.HRPortalSearch.run(value) so any other Doctor
   Portal page with the same markup can reuse this exact backend.
--------------------------------------------------------- */
function initGlobalSearch(){
  const input = document.getElementById('hrSearchPatient');
  const panel = document.getElementById('hrGlobalSearchResults');
  const wrap = document.getElementById('hrGlobalSearchWrap');
  if(!input || !panel || !wrap) return;

  const searchUrl = input.dataset.searchUrl;

  const CATEGORY_ORDER = [
    'Navigation', 'Patients', 'Appointments', 'Prescriptions',
    'Health Ring', 'Emergency Alerts', 'Reports', 'Notifications', 'AI Insights'
  ];

  let debounceTimer = null;
  let activeController = null;
  let latestRequestId = 0;

  // ---- Navigation index, built once from the real sidebar DOM ----
  const navLinks = Array.from(document.querySelectorAll('.hr-sidebar a.hr-nav-item'))
    .map(a => ({
      text: a.textContent.replace(/\s+/g, ' ').trim(),
      href: a.getAttribute('href'),
      icon: (a.querySelector('i') && a.querySelector('i').className) || 'fa-solid fa-compass'
    }))
    .filter(item => item.text && item.href && item.href !== '#');

  function matchNavigation(term){
    const lower = term.toLowerCase();
    return navLinks
      .filter(item => item.text.toLowerCase().includes(lower))
      .slice(0, 5)
      .map(item => ({
        category: 'Navigation',
        title: item.text,
        subtitle: 'Go to page',
        url: item.href,
        icon: item.icon
      }));
  }

  function openPanel(){ panel.classList.add('show'); }
  function closePanel(){ panel.classList.remove('show'); }

  function renderState(html){
    panel.innerHTML = html;
    openPanel();
  }

  function renderLoading(){
    renderState(`
      <div class="hr-search-empty">
        <i class="fa-solid fa-spinner fa-spin"></i> Searching…
      </div>`);
  }

  function renderError(){
    renderState(`
      <div class="hr-search-empty">
        <i class="fa-solid fa-triangle-exclamation"></i> Something went wrong. Please try again.
      </div>`);
  }

  function renderEmpty(){
    renderState(`
      <div class="hr-search-empty">
        <i class="fa-solid fa-magnifying-glass"></i> No results found
      </div>`);
  }

  function escapeGlobalSearchText(str){
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  function renderResults(items){
    if(!items || items.length === 0){
      renderEmpty();
      return;
    }

    const byCategory = {};
    items.forEach(item => {
      const cat = item.category || 'Results';
      if(!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(item);
    });

    let html = '';
    CATEGORY_ORDER.forEach(cat => {
      const group = byCategory[cat];
      if(!group || group.length === 0) return;

      html += `<div class="hr-global-search-category">${escapeGlobalSearchText(cat)}</div>`;
      group.forEach(item => { html += renderItem(item); });
    });

    renderState(html);
  }

  function renderItem(item){
    const title = escapeGlobalSearchText(item.title);
    const sub = escapeGlobalSearchText(item.subtitle);
    const icon = item.icon || 'fa-solid fa-circle';
    const url = item.url || '';

    return `
      <a class="hr-global-search-item" href="${escapeGlobalSearchText(url)}">
        <span class="hr-global-search-icon"><i class="${icon}"></i></span>
        <span class="hr-global-search-content">
          <span class="hr-global-search-title">${title}</span>
          <br>
          <span class="hr-global-search-subtitle">${sub}</span>
        </span>
      </a>`;
  }

  async function runSearch(query){
    const term = (query || '').trim();

    if(term.length < 2){
      closePanel();
      return;
    }

    const navMatches = matchNavigation(term);

    if(!searchUrl){
      renderResults(navMatches);
      return;
    }

    renderLoading();

    const requestId = ++latestRequestId;

    if(activeController) activeController.abort();
    activeController = new AbortController();

    try {
      const response = await fetch(
        `${searchUrl}?q=${encodeURIComponent(term)}`,
        { credentials: 'same-origin', signal: activeController.signal }
      );

      if(requestId !== latestRequestId) return;

      if(!response.ok){
        renderError();
        return;
      }

      const payload = await response.json();

      if(requestId !== latestRequestId) return;

      const backendResults = (payload && payload.results) || [];
      renderResults(navMatches.concat(backendResults));

    } catch(err){
      if(err && err.name === 'AbortError') return;
      if(requestId !== latestRequestId) return;
      renderError();
    }
  }

  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const value = input.value;

    if(value.trim().length < 2){
      closePanel();
      return;
    }

    debounceTimer = setTimeout(() => runSearch(value), 300);
  });

  input.addEventListener('keydown', (e) => {
    if(e.key === 'Escape'){
      closePanel();
      input.blur();
    }
  });

  input.addEventListener('focus', () => {
    if(input.value.trim().length >= 2 && panel.innerHTML.trim()){
      openPanel();
    }
  });

  document.addEventListener('click', (e) => {
    if(!wrap.contains(e.target)) closePanel();
  });

  window.HRPortalSearch = {
    run(value){
      if(typeof value === 'string') input.value = value;
      clearTimeout(debounceTimer);
      runSearch(input.value);
    }
  };
}