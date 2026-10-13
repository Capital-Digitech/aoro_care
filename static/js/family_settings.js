/* =========================================================
   Aoro Care - Family Portal Settings
   Same behaviour as the Doctor Portal Settings page.
   Sidebar + topbar theme toggle are handled by
   family_portal_shell.js (storage key: hr-family-theme);
   this file keeps the Theme dropdown in sync with it and
   validates the change-password form.
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {
  initThemePreference();
  initPasswordForm();
});

const THEME_KEY = 'hr-family-theme';

function storeTheme(mode){
  try{ localStorage.setItem(THEME_KEY, mode); }catch(err){ /* storage unavailable */ }
}

function applyTheme(mode){
  const html = document.documentElement;
  html.setAttribute('data-theme', mode);
  const icon = document.querySelector('#hrThemeToggle i');
  if(icon){
    icon.classList.toggle('fa-sun', mode === 'dark');
    icon.classList.toggle('fa-moon', mode !== 'dark');
  }
}

function initThemePreference(){
  const themeSelect = document.getElementById('hrPrefTheme');
  const themeBtn = document.getElementById('hrThemeToggle');
  const form = document.getElementById('hrPreferencesForm');

  let stored = null;
  try{ stored = localStorage.getItem(THEME_KEY); }catch(err){ /* ignore */ }

  // No browser choice yet -> use the theme saved in the database
  if(!stored && window.HR_SAVED_THEME){
    applyTheme(window.HR_SAVED_THEME);
    storeTheme(window.HR_SAVED_THEME);
  }

  if(themeSelect){
    themeSelect.value = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';

    themeSelect.addEventListener('change', () => {
      applyTheme(themeSelect.value);
      storeTheme(themeSelect.value);
    });
  }

  // Topbar toggle (handled by the shell) -> keep dropdown in sync
  themeBtn?.addEventListener('click', () => {
    setTimeout(() => {
      if(themeSelect){
        themeSelect.value = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
      }
    }, 0);
  });

  form?.addEventListener('submit', (e) => {
    const action = e.submitter ? e.submitter.value : '';
    storeTheme(action === 'reset_preferences' ? 'light' : (themeSelect ? themeSelect.value : 'light'));
  });
}

function initPasswordForm(){
  document.querySelectorAll('.hr-password-eye').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.target);
      if(!input) return;
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.querySelector('i').className = show ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye';
    });
  });

  const pwdForm = document.getElementById('hrPasswordForm');
  const pwdError = document.getElementById('hrPasswordError');

  function showPwdError(message){
    if(!pwdError) return;
    pwdError.textContent = message || '';
    pwdError.classList.toggle('show', Boolean(message));
  }

  pwdForm?.addEventListener('submit', (e) => {
    const current = pwdForm.current_password.value;
    const next = pwdForm.new_password.value;
    const confirm = pwdForm.confirm_password.value;
    let problem = '';

    if(!current || !next || !confirm) problem = 'Please fill in all password fields.';
    else if(next.length < 8) problem = 'New password must be at least 8 characters long.';
    else if(!/[A-Z]/.test(next)) problem = 'New password must include an uppercase letter.';
    else if(!/[a-z]/.test(next)) problem = 'New password must include a lowercase letter.';
    else if(!/[0-9]/.test(next)) problem = 'New password must include a number.';
    else if(next !== confirm) problem = 'New passwords do not match.';
    else if(next === current) problem = 'New password must be different from the current password.';

    if(problem){ e.preventDefault(); showPwdError(problem); return; }
    showPwdError('');
  });

  document.getElementById('hrPasswordClear')?.addEventListener('click', () => showPwdError(''));
}
