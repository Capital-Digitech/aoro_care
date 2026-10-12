
/* =========================================================
   AORO CARE — Family Dashboard
   Sidebar · Theme · Database notifications · SOS · Charts
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  initSidebarToggle();
  initThemeToggle();
  setTodayDate();
  initMarkAllRead();
  initSyncButton();
  initSosButton();
  initCharts();
});

/* ---------------- Sidebar ---------------- */
function initSidebarToggle() {
  const sidebar = document.getElementById("hrSidebar");
  const toggle = document.getElementById("hrSidebarToggle");
  const overlay = document.getElementById("hrOverlay");

  if (!sidebar || !toggle || !overlay) return;

  const close = () => {
    sidebar.classList.remove("show");
    overlay.classList.remove("show");
  };

  toggle.addEventListener("click", () => {
    const isOpen = sidebar.classList.contains("show");
    sidebar.classList.toggle("show", !isOpen);
    overlay.classList.toggle("show", !isOpen);
  });

  overlay.addEventListener("click", close);

  window.addEventListener("resize", () => {
    if (window.innerWidth > 1199.98) close();
  });
}

/* ---------------- Theme ---------------- */
function initThemeToggle() {
  const button = document.getElementById("hrThemeToggle");
  const root = document.documentElement;

  if (!button) return;

  function setTheme(theme) {
    root.setAttribute("data-theme", theme);
    localStorage.setItem("hr-family-theme", theme);

    const icon = button.querySelector("i");
    if (icon) {
      icon.className =
        theme === "dark"
          ? "fa-solid fa-sun"
          : "fa-solid fa-moon";
    }
  }

  const savedTheme = localStorage.getItem("hr-family-theme");
  if (savedTheme === "dark" || savedTheme === "light") {
    setTheme(savedTheme);
  }

  button.addEventListener("click", () => {
    const nextTheme =
      root.getAttribute("data-theme") === "dark" ? "light" : "dark";

    setTheme(nextTheme);
    refreshChartsTheme();
  });
}

/* ---------------- Date ---------------- */
function setTodayDate() {
  const element = document.getElementById("hrTodayDate");
  if (!element) return;

  element.textContent = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

/* ---------------- Shared helpers ---------------- */
function getCsrfToken() {
  return (
    document.querySelector('meta[name="csrf-token"]')?.content ||
    document.querySelector('input[name="csrf_token"]')?.value ||
    ""
  );
}

async function postJson(url, payload = {}) {
  const headers = {
    "Content-Type": "application/json",
    "Accept": "application/json"
  };

  const csrfToken = getCsrfToken();
  if (csrfToken) {
    headers["X-CSRFToken"] = csrfToken;
  }

  const response = await fetch(url, {
    method: "POST",
    credentials: "same-origin",
    headers,
    body: JSON.stringify(payload)
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok || result.success === false) {
    throw new Error(result.message || "The request could not be completed.");
  }

  return result;
}

function showDashboardMessage(message, type = "info") {
  let container = document.getElementById("hrDashboardMessage");

  if (!container) {
    container = document.createElement("div");
    container.id = "hrDashboardMessage";
    container.className = "alert";
    container.setAttribute("role", "status");

    const main = document.querySelector(".hr-content");
    if (!main) return;

    main.prepend(container);
  }

  container.className = `alert alert-${type}`;
  container.textContent = message;
}

/* ---------------- Notifications ----------------
   Each rendered notification must have:
   data-notification-id="{{ notification.id }}"
------------------------------------------------- */
function initMarkAllRead() {
  const button = document.getElementById("hrMarkAllRead");
  const countElement = document.getElementById("hrUnreadCount");

  if (!button) return;

  button.addEventListener("click", async () => {
    const unreadItems = [
      ...document.querySelectorAll(
        '.hr-notif-item.unread[data-notification-id]'
      )
    ];

    if (unreadItems.length === 0) {
      showDashboardMessage("There are no unread notifications.", "info");
      return;
    }

    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = "Updating…";

    try {
      // Use the existing notification endpoint for each owned notification.
      for (const item of unreadItems) {
        const id = item.dataset.notificationId;
        const headers = {};
        const csrfToken = getCsrfToken();

        if (csrfToken) {
          headers["X-CSRFToken"] = csrfToken;
        }

        const response = await fetch(
          `/notification/mark-read/${encodeURIComponent(id)}`,
          {
            method: "POST",
            credentials: "same-origin",
            headers
          }
        );

        if (!response.ok) {
          throw new Error("One or more notifications could not be updated.");
        }

        const result = await response.json().catch(() => ({}));
        if (result.success !== true) {
          throw new Error("One or more notifications could not be updated.");
        }

        item.classList.remove("unread");
        item.removeAttribute("data-unread");
        item.querySelector(".hr-unread-dot")?.remove();
      }

      if (countElement) {
        countElement.textContent = String(
          document.querySelectorAll(".hr-notif-item.unread").length
        );
      }

      showDashboardMessage("Notifications marked as read.", "success");
    } catch (error) {
      showDashboardMessage(error.message, "danger");
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  });
}

/* ---------------- Ring Sync ----------------
   No fake success: the family sync API has not
   been implemented or connected to ring hardware.
------------------------------------------------- */
function initSyncButton() {
  const button = document.getElementById("hrSyncBtn");
  if (!button) return;

  button.addEventListener("click", () => {
    showDashboardMessage(
      "Family ring sync is not available yet. A real device-sync integration is required.",
      "warning"
    );
  });
}

/* ---------------- Emergency SOS ----------------
   Requires the backend POST /family/sos route.
   The patient ID must come from a linked patient.
------------------------------------------------- */
function initSosButton() {
  const button = document.getElementById("hrSosBtn");
  const sosStatus = document.getElementById("hrSosStatus");
  const emergencyStatus = document.getElementById("hrEmergencyStatus");

  if (!button) return;

  button.addEventListener("click", async () => {
    const patientId = button.dataset.patientId;

    if (!patientId) {
      showDashboardMessage(
        "SOS cannot be sent because no linked patient is selected.",
        "warning"
      );
      return;
    }

    const confirmed = window.confirm(
      "Create an emergency alert for the linked patient?"
    );

    if (!confirmed) return;

    const originalHtml = button.innerHTML;
    button.disabled = true;
    button.innerHTML =
      '<i class="fa-solid fa-spinner fa-spin"></i> Sending…';

    try {
      const result = await postJson("/family/sos", {
        patient_id: patientId,
        message: "Emergency assistance requested by a family member."
      });

      if (sosStatus) {
        sosStatus.textContent = "Alert Created";
        sosStatus.className = "hr-badge hr-badge-danger";
      }

      if (emergencyStatus) {
        emergencyStatus.textContent = "Emergency";
        emergencyStatus.className = "hr-badge hr-badge-danger";
      }

      showDashboardMessage(
        result.message || "Emergency alert created.",
        "success"
      );
    } catch (error) {
      showDashboardMessage(error.message, "danger");
    } finally {
      button.disabled = false;
      button.innerHTML = originalHtml;
    }
  });
}

/* ---------------- Chart data ----------------
   Backend data is injected into #familyDashboardData.
   Missing readings remain empty; no sample values.
------------------------------------------------- */
let hrChartInstances = [];

function getDashboardData() {
  const element = document.getElementById("familyDashboardData");

  if (!element) return {};

  try {
    return JSON.parse(element.textContent || "{}");
  } catch (error) {
    console.error("Invalid Family Dashboard chart data.", error);
    return {};
  }
}

function chartColors() {
  const dark =
    document.documentElement.getAttribute("data-theme") === "dark";

  return {
    grid: dark ? "rgba(255,255,255,.06)" : "rgba(15,23,42,.06)",
    text: dark ? "#94A3B8" : "#64748B",
    primary: "#2563EB",
    green: "#10B981",
    red: "#EF4444",
    orange: "#F59E0B",
    purple: "#7C3AED",
    teal: "#0EA5A5"
  };
}

function gradientFill(canvas, color) {
  const context = canvas.getContext("2d");
  const gradient = context.createLinearGradient(
    0, 0, 0, canvas.height || 260
  );

  gradient.addColorStop(0, hexToRgba(color, 0.22));
  gradient.addColorStop(1, hexToRgba(color, 0));

  return gradient;
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  return `rgba(${r},${g},${b},${alpha})`;
}

function baseLineOptions(colors) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: {
        display: false,
        labels: {
          boxWidth: 8,
          boxHeight: 8,
          usePointStyle: true,
          padding: 14,
          font: { size: 11.5 }
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: colors.text, font: { size: 11 } }
      },
      y: {
        grid: { color: colors.grid },
        ticks: { color: colors.text, font: { size: 11 } }
      }
    }
  };
}

function createChart(canvasId, type, labels, values, color, colors, options = {}) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const hasData = Array.isArray(values) &&
    values.some(value => value !== null && value !== undefined);

  const dataset = {
    label: options.label || "",
    data: Array.isArray(values) ? values : [],
    borderColor: color,
    backgroundColor: type === "line"
      ? gradientFill(canvas, color)
      : color,
    fill: type === "line",
    tension: 0.4,
    borderWidth: 2.5,
    pointRadius: type === "line" ? 3 : 0,
    pointBackgroundColor: color,
    borderRadius: type === "bar" ? 8 : 0
  };

  if (type === "doughnut") {
    dataset.backgroundColor = [
      colors.purple, colors.primary, colors.teal, colors.orange
    ];
    dataset.borderWidth = 0;
  }

  const chartOptions = type === "doughnut"
    ? {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "68%",
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              color: colors.text,
              boxWidth: 8,
              usePointStyle: true
            }
          }
        }
      }
    : baseLineOptions(colors);

  if (type === "bar") {
    chartOptions.plugins.legend = { display: false };
    dataset.maxBarThickness = 26;
  }

  if (!hasData) {
    dataset.data = [];
  }

  hrChartInstances.push(new Chart(canvas, {
    type,
    data: {
      labels: Array.isArray(labels) ? labels : [],
      datasets: [dataset]
    },
    options: chartOptions
  }));
}

function initCharts() {
  if (typeof Chart === "undefined") return;

  const data = getDashboardData();
  const colors = chartColors();

  hrChartInstances.forEach(chart => chart.destroy());
  hrChartInstances = [];

  Chart.defaults.font.family = "'Inter', sans-serif";
  Chart.defaults.color = colors.text;

  const dates = data.dates || [];
  const latestSleep = data.latest_sleep;

  createChart(
    "chartHeartRateTrend", "line", dates,
    data.heart_rate || [], colors.red, colors,
    { label: "Heart Rate (bpm)" }
  );

  createChart(
    "chartSpo2Trend", "line", dates,
    data.spo2 || [], colors.primary, colors,
    { label: "SpO₂ (%)" }
  );

  // Sleep hours are actual recorded values. The dashboard has no sleep-stage
  // fields, so do not fabricate Deep/Light/REM breakdowns.
  createChart(
    "chartSleepAnalysis", "bar", dates,
    data.sleep || [], colors.purple, colors,
    { label: "Sleep (hours)" }
  );

  createChart(
    "chartWeeklySteps", "bar", dates,
    data.steps || [], colors.teal, colors,
    { label: "Steps" }
  );

  createChart(
    "chartStressLevel", "line", dates,
    data.stress || [], colors.orange, colors,
    { label: "Stress Index" }
  );

  createChart(
    "chartCaloriesBurned", "bar", dates,
    data.calories || [], colors.orange, colors,
    { label: "Calories (kcal)" }
  );
}

function refreshChartsTheme() {
  initCharts();
}

