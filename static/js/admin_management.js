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