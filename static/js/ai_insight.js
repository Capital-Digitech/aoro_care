document.addEventListener('DOMContentLoaded', () => {

    initSidebarToggle();
    initThemeToggle();
    initGlobalSearch();

});


/* =========================================================
   SIDEBAR TOGGLE
   ========================================================= */

function initSidebarToggle() {

    const sidebar = document.getElementById('hrSidebar');
    const toggle = document.getElementById('hrSidebarToggle');
    const overlay = document.getElementById('hrOverlay');

    if (!sidebar || !toggle) {
        return;
    }

    toggle.addEventListener('click', () => {

        sidebar.classList.toggle('open');

        if (overlay) {
            overlay.classList.toggle('show');
        }

    });


    if (overlay) {

        overlay.addEventListener('click', () => {

            sidebar.classList.remove('open');
            overlay.classList.remove('show');

        });

    }

}


/* =========================================================
   DARK MODE
   ========================================================= */

function initThemeToggle() {

    const themeToggle = document.getElementById('hrThemeToggle');

    if (!themeToggle) {
        return;
    }


    themeToggle.addEventListener('click', () => {

        const html = document.documentElement;

        const isDark =
            html.getAttribute('data-theme') === 'dark';

        html.setAttribute(
            'data-theme',
            isDark ? 'light' : 'dark'
        );

    });

}


/* =========================================================
   COMMON ADMIN GLOBAL SEARCH
   ========================================================= */

function initGlobalSearch() {

    const wrap = document.getElementById('hrGlobalSearch');
    const input = document.getElementById('hrGlobalSearchInput');
    const results = document.getElementById('hrGlobalSearchResults');

    if (!wrap || !input || !results) {
        return;
    }


    const navItems = Array.from(
        document.querySelectorAll('.hr-sidebar .hr-nav-item')
    )
    .map(link => ({

        label: link.textContent
            .replace(/\s+/g, ' ')
            .trim(),

        href: link.getAttribute('href'),

        icon:
            link.querySelector('i')?.className ||
            'fa-solid fa-arrow-right'

    }))
    .filter(item =>
        item.href &&
        item.href !== '#'
    );


    function escapeHtml(value) {

        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');

    }


    function renderResults(matches) {

        if (!matches.length) {

            results.innerHTML = `
                <div class="hr-global-search-empty">
                    No matching pages found
                </div>
            `;

        } else {

            results.innerHTML = matches.map(item => `

                <a
                    href="${escapeHtml(item.href)}"
                    class="hr-global-search-item"
                >
                    <i class="${escapeHtml(item.icon)}"></i>
                    <span>${escapeHtml(item.label)}</span>
                </a>

            `).join('');

        }

        results.classList.add('show');

    }


    function closeResults() {

        results.classList.remove('show');
        results.innerHTML = '';

    }


    /* Search */
    input.addEventListener('input', () => {

        const term = input.value
            .trim()
            .toLowerCase();


        if (!term) {

            closeResults();
            return;

        }


        const matches = navItems.filter(item =>
            item.label
                .toLowerCase()
                .includes(term)
        );


        renderResults(matches);

    });


    /* Focus */
    input.addEventListener('focus', () => {

        if (input.value.trim()) {
            input.dispatchEvent(
                new Event('input')
            );
        }

    });


    /* Escape */
    input.addEventListener('keydown', event => {

        if (event.key === 'Escape') {

            closeResults();
            input.blur();

        }

    });


    /* Click outside */
    document.addEventListener('click', event => {

        if (!wrap.contains(event.target)) {
            closeResults();
        }

    });

}