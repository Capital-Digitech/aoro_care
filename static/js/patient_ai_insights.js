/* =========================================================
   AORO CARE — Patient · AI Health Insights

   Self-contained page script. The sidebar toggle and dark mode
   are handled by patient_dashboard.js (same as every patient page).
   Handles: period selection · loading data · charts and sections
   · empty / insufficient-data states.

   No health or insight values live in this file. Every displayed
   value comes from the JSON returned by /ai-health-insights/data,
   which only ever contains the logged-in patient's own records.
   ========================================================= */

(function () {
  'use strict';

  const page = document.getElementById('aiInsightsPage');
  if (!page) return;

  const DATA_URL = page.dataset.dataUrl;
  const LOGIN_URL = page.dataset.loginUrl;

  const NO_DATA = 'No data available';
  const NO_PERIOD_DATA = 'No health data available for the selected period.';
  const NO_PATIENT_DATA = 'No health data has been recorded for you yet.';
  const INSUFFICIENT_TREND = 'Insufficient data for trend analysis.';
  const INSUFFICIENT_INSIGHT = 'Insufficient health data for a reliable insight.';

  const $ = (id) => document.getElementById(id);

  const el = {
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

    let lastPayload = null;

  /* ---------------------------------------------------------
     Page state
  --------------------------------------------------------- */
  const state = {
    period: el.period ? el.period.value : '7d',
    start: '',
    end: ''
  };

  function showState(type, text) {
    const icons = {
      info: 'fa-circle-info',
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
     Period controls
  --------------------------------------------------------- */
  function initPeriod() {
    el.period.addEventListener('change', () => {
      state.period = el.period.value;
      el.customRange.hidden = state.period !== 'custom';
      if (state.period !== 'custom') loadInsights();
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
      loadInsights();
    });
  }

  /* ---------------------------------------------------------
     Load data
  --------------------------------------------------------- */
  let requestSeq = 0;
  let controller = null;

  async function loadInsights() {
    const params = new URLSearchParams({ period: state.period });

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

  /* ---------- My summary ---------- */
  function renderSummary(d) {
    const p = d.patient || {};
    const items = [
      ['Name', hasValue(p.name) ? esc(p.name) : noData()],
      ['Patient ID', hasValue(p.code) ? esc(p.code) : noData()],
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
      '<p class="ai-follow-note">These suggestions are informational only. Please talk to your doctor before making any medical decision.</p>';
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
      el.historyBody.innerHTML = emptyBlock('No insight records are available for you yet.', 'fa-brain');
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
  initPeriod();

  // Re-draw the charts when the portal switches between light and dark mode.
  new MutationObserver(() => {
    if (lastPayload) renderCharts(lastPayload);
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  loadInsights();

})();
