/* =========================================================
   HEALTH RING — Dashboard Behavior
   Sidebar toggle · Dark mode · Animated counters · Chart.js
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {
  initSidebarToggle();
  initThemeToggle();
  animateCounters();
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

  const open = () => { sidebar.classList.add('show'); overlay.classList.add('show'); };
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
   Dark mode toggle
--------------------------------------------------------- */
function initThemeToggle(){
  const btn = document.getElementById('hrThemeToggle');
  const html = document.documentElement;
  if(!btn) return;

  const saved = localStorage.getItem('hr-theme');
  if(saved) setTheme(saved);

  btn.addEventListener('click', () => {
    const current = html.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    setTheme(current === 'dark' ? 'light' : 'dark');
  });

  function setTheme(mode){
    html.setAttribute('data-theme', mode);
    localStorage.setItem('hr-theme', mode);
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
   Chart.js — shared defaults
--------------------------------------------------------- */
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

function initCharts(){
  if(typeof Chart === 'undefined') return;
  const c = chartColors();
  Chart.defaults.font.family = "'Inter', sans-serif";
  Chart.defaults.color = c.text;

  /* ---------- Monthly User Growth (line, multi-series) ---------- */
  const ctxUserGrowth = document.getElementById('chartUserGrowth');
  if(ctxUserGrowth){
    new Chart(ctxUserGrowth, {
      type: 'line',
      data: {
        labels: ['Feb','Mar','Apr','May','Jun','Jul'],
        datasets: [
          {
            label: 'Patients',
            data: [15200, 16800, 18100, 19400, 20600, 21840],
            borderColor: c.primary,
            backgroundColor: gradientFill(ctxUserGrowth, c.primary),
            fill: true, tension: .4, borderWidth: 2.5,
            pointRadius: 0, pointHoverRadius: 5
          },
          {
            label: 'Doctors',
            data: [1400, 1520, 1610, 1710, 1830, 1926],
            borderColor: c.teal,
            backgroundColor: 'transparent',
            fill: false, tension: .4, borderWidth: 2.5,
            pointRadius: 0, pointHoverRadius: 5
          }
        ]
      },
      options: baseLineOptions(c)
    });
  }

  /* ---------- Hospital Distribution (doughnut) ---------- */
  const ctxHospitalDist = document.getElementById('chartHospitalDist');
  if(ctxHospitalDist){
    new Chart(ctxHospitalDist, {
      type: 'doughnut',
      data: {
        labels: ['Enterprise', 'Regional', 'Clinic Network', 'Independent'],
        datasets: [{
          data: [42, 68, 51, 23],
          backgroundColor: [c.primary, c.purple, c.teal, c.orange],
          borderWidth: 0,
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 8, boxHeight: 8, usePointStyle: true, padding: 14, font: { size: 11.5 } } }
        }
      }
    });
  }

  /* ---------- Revenue Analytics (bar) ---------- */
  const ctxRevenue = document.getElementById('chartRevenue');
  if(ctxRevenue){
    new Chart(ctxRevenue, {
      type: 'bar',
      data: {
        labels: ['Feb','Mar','Apr','May','Jun','Jul'],
        datasets: [{
          label: 'Revenue',
          data: [312000, 338000, 365000, 402000, 441000, 482900],
          backgroundColor: c.primary,
          borderRadius: 8,
          maxBarThickness: 26
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 11 } } },
          y: { grid: { color: c.grid }, ticks: { font: { size: 11 }, callback: v => '$' + (v/1000) + 'k' } }
        }
      }
    });
  }

  /* ---------- Device Status (doughnut) ---------- */
  const ctxDeviceStatus = document.getElementById('chartDeviceStatus');
  if(ctxDeviceStatus){
    new Chart(ctxDeviceStatus, {
      type: 'doughnut',
      data: {
        labels: ['Online', 'Low Battery', 'Offline', 'Syncing'],
        datasets: [{
          data: [15840, 2010, 890, 464],
          backgroundColor: [c.green, c.orange, c.red, c.primary],
          borderWidth: 0,
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 8, boxHeight: 8, usePointStyle: true, padding: 14, font: { size: 11.5 } } }
        }
      }
    });
  }

  /* ---------- Emergency Trends (line) ---------- */
  const ctxEmergency = document.getElementById('chartEmergencyTrends');
  if(ctxEmergency){
    new Chart(ctxEmergency, {
      type: 'line',
      data: {
        labels: ['W1','W2','W3','W4','W5','W6'],
        datasets: [{
          label: 'Alerts',
          data: [58, 49, 63, 41, 45, 37],
          borderColor: c.red,
          backgroundColor: gradientFill(ctxEmergency, c.red),
          fill: true, tension: .4, borderWidth: 2.5,
          pointRadius: 3, pointBackgroundColor: c.red
        }]
      },
      options: baseLineOptions(c, true)
    });
  }

  /* ---------- Subscription Growth (stacked bar) ---------- */
  const ctxSub = document.getElementById('chartSubscriptionGrowth');
  if(ctxSub){
    new Chart(ctxSub, {
      type: 'bar',
      data: {
        labels: ['Feb','Mar','Apr','May','Jun','Jul'],
        datasets: [
          { label: 'Basic',      data: [4200,4500,4700,4900,5100,5300], backgroundColor: c.primary, borderRadius: 6, maxBarThickness: 22 },
          { label: 'Premium',    data: [3100,3300,3500,3800,4000,4200], backgroundColor: c.purple,  borderRadius: 6, maxBarThickness: 22 },
          { label: 'Enterprise', data: [2600,2750,2900,3050,3200,3350], backgroundColor: c.teal,    borderRadius: 6, maxBarThickness: 22 }
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
    });
  }
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