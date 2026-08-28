/* =========================================================
   HEALTH RING — Patient Dashboard Behavior
   Sidebar toggle · Dark mode · Live date · Animated counters
   Mark-all-read · Emergency SOS · Chart.js configurations
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {
  initSidebarToggle();
  initThemeToggle();
  setTodayDate();
  animateCounters();
  initMarkAllRead();
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

  const saved = localStorage.getItem('hr-patient-theme');
  if(saved) setTheme(saved);

  btn.addEventListener('click', () => {
    const current = html.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    setTheme(current === 'dark' ? 'light' : 'dark');
    refreshChartsTheme();
  });

  function setTheme(mode){
    html.setAttribute('data-theme', mode);
    localStorage.setItem('hr-patient-theme', mode);
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
   Emergency SOS button
--------------------------------------------------------- */
function initSosButton(){
  const btn = document.getElementById('hrSosBtn');
  const statusEl = document.getElementById('hrSosStatus');
  if(!btn || !statusEl) return;

  let active = false;

  btn.addEventListener('click', () => {
    active = !active;
    if(active){
      statusEl.textContent = 'Alert Sent';
      statusEl.className = 'hr-badge hr-badge-danger';
      btn.style.animationPlayState = 'paused';
    } else {
      statusEl.textContent = 'No Active Alert';
      statusEl.className = 'hr-badge hr-badge-success';
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
          data: [64, 60, 72, 84, 88, 79, 76],
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
          data: [96, 97, 98, 97, 98],
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
          data: [1.8, 3.6, 1.5, 0.3],
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
          data: [5200, 7600, 6100, 8400, 7200, 9100, 6482],
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
          data: [42, 58, 51, 66, 60, 38, 45],
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
          data: [280, 340, 265, 390, 310, 420, 312],
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