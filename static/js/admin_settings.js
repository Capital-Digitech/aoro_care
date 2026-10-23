/* Admin / Super Admin — Settings pages */
(function () {
  'use strict';

  var html = document.documentElement;
  var themeKey = document.body.getAttribute('data-theme-key') || 'hr-admin-theme';

  function store(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* storage unavailable */ }
  }

  /* ---------- Sidebar (mobile) ---------- */
  var sidebar = document.getElementById('hrSidebar');
  var toggle = document.getElementById('hrSidebarToggle');
  var overlay = document.getElementById('hrOverlay');

  function closeSidebar() {
    if (sidebar) sidebar.classList.remove('show');
    if (overlay) overlay.classList.remove('show');
  }

  if (toggle) {
    toggle.addEventListener('click', function () {
      if (sidebar) sidebar.classList.toggle('show');
      if (overlay) overlay.classList.toggle('show');
    });
  }
  if (overlay) overlay.addEventListener('click', closeSidebar);

  /* ---------- Theme ---------- */
  var themeBtn = document.getElementById('hrThemeToggle');

  function applyTheme(mode) {
    html.setAttribute('data-theme', mode);
    if (themeBtn) {
      var icon = themeBtn.querySelector('i');
      if (icon) icon.className = mode === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    }
  }

  applyTheme(html.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');

  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      var next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      store(themeKey, next);

      var select = document.getElementById('stPrefTheme');
      if (select) select.value = next;
    });
  }

  /* My Preferences: theme select previews instantly and is remembered on save */
  var themeSelect = document.getElementById('stPrefTheme');
  if (themeSelect) {
    themeSelect.addEventListener('change', function () {
      applyTheme(themeSelect.value);
    });
  }

  var prefsForm = document.getElementById('stPreferencesForm');
  if (prefsForm) {
    prefsForm.addEventListener('submit', function (e) {
      var action = e.submitter ? e.submitter.value : '';
      if (action === 'reset_preferences') {
        store(themeKey, 'light');
      } else if (themeSelect) {
        store(themeKey, themeSelect.value);
      }
    });
  }

  /* ---------- Unsaved-changes bar ---------- */
  document.querySelectorAll('form[data-dirty-bar]').forEach(function (form) {
    var bar = form.querySelector('.st-savebar');
    if (!bar) return;

    var initial = new URLSearchParams(new FormData(form)).toString();

    function check() {
      var now = new URLSearchParams(new FormData(form)).toString();
      bar.classList.toggle('show', now !== initial);
    }

    form.addEventListener('input', check);
    form.addEventListener('change', check);
    form.addEventListener('reset', function () {
      setTimeout(check, 0);
    });
  });

  /* ---------- Delete confirmation modal ---------- */
  var deleteModalEl = document.getElementById('stDeleteModal');
  if (deleteModalEl) {
    var deleteForm = document.getElementById('stDeleteForm');
    var deleteName = document.getElementById('stDeleteName');

    document.querySelectorAll('[data-st-delete]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        deleteForm.setAttribute('action', btn.getAttribute('data-action'));
        deleteName.textContent = btn.getAttribute('data-name') || 'this user';
        bootstrap.Modal.getOrCreateInstance(deleteModalEl).show();
      });
    });
  }

  /* ---------- Filters: submit when a select changes ---------- */
  document.querySelectorAll('[data-autosubmit]').forEach(function (el) {
    el.addEventListener('change', function () {
      if (el.form) el.form.submit();
    });
  });

  /* ---------- Section index highlight (System Settings) ---------- */
  var links = document.querySelectorAll('.st-index a[href^="#"], .st-anchors a[href^="#"]');
  if (links.length && 'IntersectionObserver' in window) {
    var byId = {};
    links.forEach(function (a) { byId[a.getAttribute('href').slice(1)] = a; });

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting && byId[entry.target.id]) {
          links.forEach(function (a) { a.classList.remove('active'); });
          byId[entry.target.id].classList.add('active');
        }
      });
    }, { rootMargin: '-20% 0px -70% 0px' });

    Object.keys(byId).forEach(function (id) {
      var section = document.getElementById(id);
      if (section) observer.observe(section);
    });
  }

  /* ---------- Success alerts fade out ---------- */
  document.querySelectorAll('.st-flash .alert-success').forEach(function (alertEl) {
    setTimeout(function () {
      if (window.bootstrap && alertEl.isConnected) {
        bootstrap.Alert.getOrCreateInstance(alertEl).close();
      }
    }, 5000);
  });

  /* ---------- Change password ---------- */
  document.querySelectorAll('.st-password-eye').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var input = document.getElementById(btn.getAttribute('data-target'));
      if (!input) return;
      var show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.querySelector('i').className = show ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye';
    });
  });

  var pwdForm = document.getElementById('stPasswordForm');
  if (pwdForm) {
    var pwdError = document.getElementById('stPasswordError');
    var strengthBox = document.getElementById('stStrength');
    var strengthFill = document.getElementById('stStrengthFill');
    var strengthLabel = document.getElementById('stStrengthLabel');

    function showError(message) {
      pwdError.textContent = message || '';
      pwdError.classList.toggle('show', Boolean(message));
    }

    pwdForm.addEventListener('submit', function (e) {
      var current = pwdForm.current_password.value;
      var next = pwdForm.new_password.value;
      var confirm = pwdForm.confirm_password.value;
      var problem = '';

      if (!current || !next || !confirm) problem = 'Please fill in all password fields.';
      else if (next.length < 8) problem = 'New password must be at least 8 characters long.';
      else if (!/[A-Z]/.test(next)) problem = 'New password must include an uppercase letter.';
      else if (!/[a-z]/.test(next)) problem = 'New password must include a lowercase letter.';
      else if (!/[0-9]/.test(next)) problem = 'New password must include a number.';
      else if (next !== confirm) problem = 'New passwords do not match.';
      else if (next === current) problem = 'New password must be different from the current password.';

      if (problem) { e.preventDefault(); showError(problem); return; }
      showError('');
    });

    pwdForm.new_password.addEventListener('input', function (e) {
      var value = e.target.value;
      strengthBox.classList.toggle('show', value.length > 0);

      var score = 0;
      if (value.length >= 8) score++;
      if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score++;
      if (/[0-9]/.test(value)) score++;
      if (/[^A-Za-z0-9]/.test(value) || value.length >= 12) score++;

      var levels = [
        ['Too weak', '#EF4444', '20%'], ['Weak', '#EF4444', '35%'], ['Fair', '#F59E0B', '60%'],
        ['Good', '#10B981', '80%'], ['Strong', '#10B981', '100%']
      ];
      strengthFill.style.width = levels[score][2];
      strengthFill.style.background = levels[score][1];
      strengthLabel.textContent = 'Password strength: ' + levels[score][0];
    });

    document.getElementById('stPasswordClear').addEventListener('click', function () {
      showError('');
      strengthBox.classList.remove('show');
    });
  }
})();