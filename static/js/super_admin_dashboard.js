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

  const raw = window.SUPER_ADMIN_CHARTS || {};

  /* ---------- Monthly User Growth (line, multi-series) ---------- */
  const ctxUserGrowth = document.getElementById('chartUserGrowth');
  if(ctxUserGrowth){
    const d = raw.user_growth || {};
    const labels = (d.labels && d.labels.length) ? d.labels : ['Feb','Mar','Apr','May','Jun','Jul'];
    const patients = (d.patients && d.patients.length) ? d.patients : [0,0,0,0,0,0];
    const doctors = (d.doctors && d.doctors.length) ? d.doctors : [0,0,0,0,0,0];

    new Chart(ctxUserGrowth, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Patients',
            data: patients,
            borderColor: c.primary,
            backgroundColor: gradientFill(ctxUserGrowth, c.primary),
            fill: true, tension: .4, borderWidth: 2.5,
            pointRadius: 3, pointHoverRadius: 5
          },
          {
            label: 'Doctors',
            data: doctors,
            borderColor: c.teal,
            backgroundColor: 'transparent',
            fill: false, tension: .4, borderWidth: 2.5,
            pointRadius: 3, pointHoverRadius: 5
          }
        ]
      },
      options: baseLineOptions(c)
    });
  }

  /* ---------- Hospital Distribution (doughnut) ---------- */
  const ctxHospitalDist = document.getElementById('chartHospitalDist');
  if(ctxHospitalDist){
    const d = raw.hospital_dist || {};
    const labels = (d.labels && d.labels.length) ? d.labels : ['Enterprise', 'Regional', 'Clinic Network', 'Independent'];
    const data = (d.data && d.data.length) ? d.data : [0, 0, 0, 0];
    const bgColors = [c.primary, c.purple, c.teal, c.orange, c.green, c.red];

    new Chart(ctxHospitalDist, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: bgColors.slice(0, labels.length),
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
    const d = raw.revenue || {};
    const labels = (d.labels && d.labels.length) ? d.labels : ['Feb','Mar','Apr','May','Jun','Jul'];
    const data = (d.data && d.data.length) ? d.data : [0, 0, 0, 0, 0, 0];

    new Chart(ctxRevenue, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Revenue',
          data: data,
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
          y: { grid: { color: c.grid }, ticks: { font: { size: 11 }, callback: v => '$' + (v >= 1000 ? (v/1000).toFixed(1) + 'k' : v) } }
        }
      }
    });
  }

  /* ---------- Device Status (doughnut) ---------- */
  const ctxDeviceStatus = document.getElementById('chartDeviceStatus');
  if(ctxDeviceStatus){
    const d = raw.device_status || {};
    const labels = (d.labels && d.labels.length) ? d.labels : ['Online', 'Low Battery', 'Offline', 'Syncing'];
    const data = (d.data && d.data.length) ? d.data : [0, 0, 0, 0];

    new Chart(ctxDeviceStatus, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
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
    const d = raw.emergency_trends || {};
    const labels = (d.labels && d.labels.length) ? d.labels : ['M1','M2','M3','M4','M5','M6'];
    const data = (d.data && d.data.length) ? d.data : [0, 0, 0, 0, 0, 0];

    new Chart(ctxEmergency, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Alerts',
          data: data,
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
    const d = raw.subscription_growth || {};
    const labels = (d.labels && d.labels.length) ? d.labels : ['Feb','Mar','Apr','May','Jun','Jul'];
    const basic = (d.basic && d.basic.length) ? d.basic : [0,0,0,0,0,0];
    const premium = (d.premium && d.premium.length) ? d.premium : [0,0,0,0,0,0];
    const enterprise = (d.enterprise && d.enterprise.length) ? d.enterprise : [0,0,0,0,0,0];

    new Chart(ctxSub, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          { label: 'Basic',      data: basic, backgroundColor: c.primary, borderRadius: 6, maxBarThickness: 22 },
          { label: 'Premium',    data: premium, backgroundColor: c.purple,  borderRadius: 6, maxBarThickness: 22 },
          { label: 'Enterprise', data: enterprise, backgroundColor: c.teal,    borderRadius: 6, maxBarThickness: 22 }
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