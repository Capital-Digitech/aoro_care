/* =========================================================
   Super Admin > Admin Management
   Replaces the inline onclick/onsubmit handlers:
   - [data-am-dismiss]  closes its flash message
   - [data-am-confirm]  asks for confirmation before a form submits
   ========================================================= */

document.addEventListener('click', (event) => {
  const btn = event.target.closest('[data-am-dismiss]');
  if (!btn) return;
  const flash = btn.closest('.am-flash');
  if (flash) flash.remove();
});

document.addEventListener('submit', (event) => {
  const form = event.target.closest('form[data-am-confirm]');
  if (!form) return;
  if (!window.confirm(form.getAttribute('data-am-confirm'))) {
    event.preventDefault();
  }
});

/* =========================================================
   Topbar global search - same behaviour as Hospital Management:
   searches the sidebar navigation pages and links to them.
   ========================================================= */
document.addEventListener('DOMContentLoaded', () => {
  const wrap    = document.getElementById('hrGlobalSearch');
  const input   = document.getElementById('hrGlobalSearchInput');
  const results = document.getElementById('hrGlobalSearchResults');
  if (!wrap || !input || !results) return;

  const navItems = Array.from(document.querySelectorAll('.hr-sidebar .hr-nav-item'))
    .map((link) => ({
      label: link.textContent.replace(/\s+/g, ' ').trim(),
      href: link.getAttribute('href'),
      icon: (link.querySelector('i') && link.querySelector('i').className) || 'fa-solid fa-arrow-right'
    }))
    .filter((item) => item.href && item.href !== '#');

  function close() {
    results.classList.remove('show');
    results.innerHTML = '';
  }

  function render(matches) {
    results.innerHTML = '';
    if (!matches.length) {
      const empty = document.createElement('div');
      empty.className = 'hr-global-search-empty';
      empty.textContent = 'No matching pages found';
      results.appendChild(empty);
    } else {
      matches.forEach((m) => {
        const a = document.createElement('a');
        a.className = 'hr-global-search-item';
        a.href = m.href;
        const i = document.createElement('i');
        i.className = m.icon;
        const span = document.createElement('span');
        span.textContent = m.label;
        a.appendChild(i);
        a.appendChild(span);
        results.appendChild(a);
      });
    }
    results.classList.add('show');
  }

  input.addEventListener('input', () => {
    const term = input.value.trim().toLowerCase();
    if (!term) { close(); return; }
    render(navItems.filter((item) => item.label.toLowerCase().includes(term)));
  });
  input.addEventListener('focus', () => {
    if (input.value.trim()) input.dispatchEvent(new Event('input'));
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });
  document.addEventListener('click', (e) => {
    if (!wrap.contains(e.target)) close();
  });
});