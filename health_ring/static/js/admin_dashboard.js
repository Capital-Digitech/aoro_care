/* =========================================================
   HEALTH RING — Admin Dashboard Behavior
   Sidebar toggle · Dark mode · Animated counters
   Mark-all-read · Chart.js configurations
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {
  initSidebarToggle();
  initThemeToggle();
  animateCounters();
  initMarkAllRead();
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

  const saved = localStorage.getItem('hr-admin-theme');
  if(saved) setTheme(saved);

  btn.addEventListener('click', () => {
    const current = html.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    setTheme(current === 'dark' ? 'light' : 'dark');
    refreshChartsTheme();
  });

  function setTheme(mode){
    html.setAttribute('data-theme', mode);
    localStorage.setItem('hr-admin-theme', mode);
    const icon = btn.querySelector('i');
    if(icon){
      icon.className = mode === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    }
  }
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

  /* ---------- Patient Growth (line) ---------- */
  const ctxPatientGrowth = document.getElementById('chartPatientGrowth');
  if(ctxPatientGrowth){
    hrChartInstances.push(new Chart(ctxPatientGrowth, {
      type: 'line',
      data: {
        labels: ['Feb','Mar','Apr','May','Jun','Jul'],
        datasets: [{
          label: 'New Patients',
          data: [15200, 16800, 18100, 19400, 20600, 21840],
          borderColor: c.primary,
          backgroundColor: gradientFill(ctxPatientGrowth, c.primary),
          fill: true, tension: .4, borderWidth: 2.5,
          pointRadius: 0, pointHoverRadius: 5
        }]
      },
      options: baseLineOptions(c, true)
    }));
  }

  /* ---------- Health Ring Status (doughnut) ---------- */
  const ctxRingStatus = document.getElementById('chartRingStatus');
  if(ctxRingStatus){
    hrChartInstances.push(new Chart(ctxRingStatus, {
      type: 'doughnut',
      data: {
        labels: ['Online', 'Charging', 'Low Battery', 'Offline', 'Disconnected'],
        datasets: [{
          data: [15840, 1240, 770, 890, 464],
          backgroundColor: [c.green, c.orange, '#F97316', c.text ? '#94A3B8' : '#94A3B8', c.red],
          borderWidth: 0,
          hoverOffset: 6
        }]
      },
      options: baseDoughnutOptions()
    }));
  }

  /* ---------- Appointments (bar) ---------- */
  const ctxAppointments = document.getElementById('chartAppointments');
  if(ctxAppointments){
    hrChartInstances.push(new Chart(ctxAppointments, {
      type: 'bar',
      data: {
        labels: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
        datasets: [{
          label: 'Appointments',
          data: [212, 248, 231, 265, 284, 168, 94],
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

  /* ---------- Emergency Alerts (line) ---------- */
  const ctxEmergency = document.getElementById('chartEmergencyAlerts');
  if(ctxEmergency){
    hrChartInstances.push(new Chart(ctxEmergency, {
      type: 'line',
      data: {
        labels: ['W1','W2','W3','W4','W5','W6'],
        datasets: [{
          label: 'Alerts',
          data: [58, 49, 63, 41, 45, 18],
          borderColor: c.red,
          backgroundColor: gradientFill(ctxEmergency, c.red),
          fill: true, tension: .4, borderWidth: 2.5,
          pointRadius: 3, pointBackgroundColor: c.red
        }]
      },
      options: baseLineOptions(c, true)
    }));
  }

  /* ---------- Hospital Distribution (pie) ---------- */
  const ctxHospitalDist = document.getElementById('chartHospitalDistribution');
  if(ctxHospitalDist){
    hrChartInstances.push(new Chart(ctxHospitalDist, {
      type: 'pie',
      data: {
        labels: ['Enterprise', 'Regional', 'Clinic Network', 'Independent'],
        datasets: [{
          data: [42, 68, 51, 23],
          backgroundColor: [c.primary, c.purple, c.teal, c.orange],
          borderWidth: 0,
          hoverOffset: 6
        }]
      },
      options: baseDoughnutOptions()
    }));
  }

  /* ---------- Monthly Reports (bar) ---------- */
  const ctxMonthlyReports = document.getElementById('chartMonthlyReports');
  if(ctxMonthlyReports){
    hrChartInstances.push(new Chart(ctxMonthlyReports, {
      type: 'bar',
      data: {
        labels: ['Feb','Mar','Apr','May','Jun','Jul'],
        datasets: [
          { label: 'Clinical',     data: [180, 195, 205, 220, 235, 248], backgroundColor: c.primary, borderRadius: 6, maxBarThickness: 22 },
          { label: 'Compliance',   data: [120, 128, 135, 140, 148, 155], backgroundColor: c.purple,  borderRadius: 6, maxBarThickness: 22 },
          { label: 'Operational',  data: [95, 102, 110, 118, 130, 139],  backgroundColor: c.teal,    borderRadius: 6, maxBarThickness: 22 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 8, boxHeight: 8, usePointStyle: true, padding: 14, font: { size: 11.5 } } } },
        scales: {
          x: { stacked: true, grid: { display: false }, ticks: { font: { size: 11 } } },
          y: { stacked: true, grid: { color: c.grid }, ticks: { font: { size: 11 } } }
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