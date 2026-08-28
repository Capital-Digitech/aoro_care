/* =========================================================
   HEALTH RING — Family Dashboard Behavior
   Sidebar toggle · Dark mode · Live date · Animated counters
   Mark-all-read · Ring Sync · Emergency SOS · Chart.js
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {
  initSidebarToggle();
  initThemeToggle();
  setTodayDate();
  animateCounters();
  initMarkAllRead();
  initSyncButton();
  initSosButton();
  initCharts();
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

  const saved = localStorage.getItem('hr-family-theme');
  if(saved) setTheme(saved);

  btn.addEventListener('click', () => {
    const current = html.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    setTheme(current === 'dark' ? 'light' : 'dark');
    refreshChartsTheme();
  });

  function setTheme(mode){
    html.setAttribute('data-theme', mode);
    localStorage.setItem('hr-family-theme', mode);
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
   Health Ring — Sync Now button
--------------------------------------------------------- */
function initSyncButton(){
  const btn = document.getElementById('hrSyncBtn');
  const lastSyncEl = document.getElementById('hrLastSync');
  const ringLastSyncEl = document.getElementById('hrRingLastSync');
  if(!btn) return;

  btn.addEventListener('click', () => {
    if(btn.classList.contains('syncing')) return;
    btn.classList.add('syncing');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> Syncing…';

    setTimeout(() => {
      btn.classList.remove('syncing');
      btn.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> Sync Now';
      if(lastSyncEl) lastSyncEl.textContent = 'Just now';
      if(ringLastSyncEl) ringLastSyncEl.textContent = 'Just now';
    }, 1500);
  });
}

/* ---------------------------------------------------------
   Emergency SOS button
--------------------------------------------------------- */
function initSosButton(){
  const btn = document.getElementById('hrSosBtn');
  const sosStatusEl = document.getElementById('hrSosStatus');
  const emergencyStatusEl = document.getElementById('hrEmergencyStatus');
  if(!btn || !sosStatusEl) return;

  let active = false;

  btn.addEventListener('click', () => {
    active = !active;
    if(active){
      sosStatusEl.textContent = 'Alert Sent';
      sosStatusEl.className = 'hr-badge hr-badge-danger';
      if(emergencyStatusEl){
        emergencyStatusEl.textContent = 'Emergency';
        emergencyStatusEl.className = 'hr-badge hr-badge-danger';
      }
      btn.style.animationPlayState = 'paused';
    } else {
      sosStatusEl.textContent = 'No Active Alert';
      sosStatusEl.className = 'hr-badge hr-badge-success';
      if(emergencyStatusEl){
        emergencyStatusEl.textContent = 'Normal';
        emergencyStatusEl.className = 'hr-badge hr-badge-success';
      }
      btn.style.animationPlayState = 'running';
    }
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

  /* ---------- Heart Rate Trend (line) ---------- */
  const ctxHeartRate = document.getElementById('chartHeartRateTrend');
  if(ctxHeartRate){
    hrChartInstances.push(new Chart(ctxHeartRate, {
      type: 'line',
      data: {
        labels: ['12 AM','4 AM','8 AM','12 PM','4 PM','8 PM','Now'],
        datasets: [{
          label: 'Heart Rate (bpm)',
          data: [68, 65, 78, 90, 96, 88, 82],
          borderColor: c.red,
          backgroundColor: gradientFill(ctxHeartRate, c.red),
          fill: true, tension: .4, borderWidth: 2.5,
          pointRadius: 0, pointHoverRadius: 5
        }]
      },
      options: baseLineOptions(c, true)
    }));
  }

  /* ---------- SpO2 Trend (line) ---------- */
  const ctxSpo2 = document.getElementById('chartSpo2Trend');
  if(ctxSpo2){
    hrChartInstances.push(new Chart(ctxSpo2, {
      type: 'line',
      data: {
        labels: ['12 AM','6 AM','12 PM','6 PM','Now'],
        datasets: [{
          label: 'SpO₂ (%)',
          data: [95, 96, 97, 96, 97],
          borderColor: c.primary,
          backgroundColor: gradientFill(ctxSpo2, c.primary),
          fill: true, tension: .4, borderWidth: 2.5,
          pointRadius: 3, pointBackgroundColor: c.primary
        }]
      },
      options: baseLineOptions(c, true)
    }));
  }

  /* ---------- Sleep Analysis (doughnut) ---------- */
  const ctxSleep = document.getElementById('chartSleepAnalysis');
  if(ctxSleep){
    hrChartInstances.push(new Chart(ctxSleep, {
      type: 'doughnut',
      data: {
        labels: ['Deep Sleep', 'Light Sleep', 'REM', 'Awake'],
        datasets: [{
          data: [1.4, 3.4, 1.3, 0.7],
          backgroundColor: [c.purple, c.primary, c.teal, c.orange],
          borderWidth: 0,
          hoverOffset: 6
        }]
      },
      options: baseDoughnutOptions()
    }));
  }

  /* ---------- Weekly Steps (bar) ---------- */
  const ctxSteps = document.getElementById('chartWeeklySteps');
  if(ctxSteps){
    hrChartInstances.push(new Chart(ctxSteps, {
      type: 'bar',
      data: {
        labels: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
        datasets: [{
          label: 'Steps',
          data: [3800, 4600, 3900, 5100, 4400, 5600, 4218],
          backgroundColor: '#0EA5A5',
          borderRadius: 8,
          maxBarThickness: 22
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

  /* ---------- Stress Level (line) ---------- */
  const ctxStress = document.getElementById('chartStressLevel');
  if(ctxStress){
    hrChartInstances.push(new Chart(ctxStress, {
      type: 'line',
      data: {
        labels: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
        datasets: [{
          label: 'Stress Index',
          data: [55, 62, 58, 71, 68, 50, 64],
          borderColor: c.orange,
          backgroundColor: gradientFill(ctxStress, c.orange),
          fill: true, tension: .4, borderWidth: 2.5,
          pointRadius: 3, pointBackgroundColor: c.orange
        }]
      },
      options: baseLineOptions(c, true)
    }));
  }

  /* ---------- Calories Burned (bar) ---------- */
  const ctxCalories = document.getElementById('chartCaloriesBurned');
  if(ctxCalories){
    hrChartInstances.push(new Chart(ctxCalories, {
      type: 'bar',
      data: {
        labels: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
        datasets: [{
          label: 'Calories (kcal)',
          data: [210, 265, 198, 302, 245, 320, 248],
          backgroundColor: c.orange,
          borderRadius: 8,
          maxBarThickness: 26
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
}

/* ---------------------------------------------------------
   Refresh chart colors when theme changes
--------------------------------------------------------- */
function refreshChartsTheme(){
  hrChartInstances.forEach(chart => chart.destroy());
  initCharts();
}