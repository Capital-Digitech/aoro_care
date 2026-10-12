/* =========================================================
   Aoro Care - Family Portal shell behaviour
   Sidebar toggle, dark-mode toggle and topbar global search
   shared by the Family Health Ring and Appointments pages.
   (Theme key matches the rest of the Family Portal.)
   ========================================================= */

document.addEventListener("DOMContentLoaded", function () {
    initFamilyShellSidebar();
    initFamilyShellTheme();
    initFamilyShellSearch();
});

/* ---------------- Sidebar ---------------- */

function initFamilyShellSidebar() {
    const sidebar = document.getElementById("hrSidebar");
    const toggle = document.getElementById("hrSidebarToggle");
    const overlay = document.getElementById("hrOverlay");

    if (!sidebar || !toggle || !overlay) return;

    const mobileBreakpoint = 1200;

    function openSidebar() {
        sidebar.classList.add("show");
        overlay.classList.add("show");
        overlay.setAttribute("aria-hidden", "false");
        toggle.setAttribute("aria-expanded", "true");
    }

    function closeSidebar() {
        sidebar.classList.remove("show");
        overlay.classList.remove("show");
        overlay.setAttribute("aria-hidden", "true");
        toggle.setAttribute("aria-expanded", "false");
    }

    toggle.addEventListener("click", function () {
        sidebar.classList.contains("show")
            ? closeSidebar()
            : openSidebar();
    });

    overlay.addEventListener("click", closeSidebar);

    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && sidebar.classList.contains("show")) {
            closeSidebar();
            toggle.focus();
        }
    });

    sidebar.querySelectorAll("a").forEach(function (link) {
        link.addEventListener("click", function () {
            if (window.innerWidth < mobileBreakpoint) {
                closeSidebar();
            }
        });
    });

    window.addEventListener("resize", function () {
        if (window.innerWidth >= mobileBreakpoint) {
            closeSidebar();
        }
    });
}

/* ---------------- Theme Toggle ---------------- */

function initFamilyShellTheme() {
    const toggle = document.getElementById("hrThemeToggle");

    if (!toggle) return;

    const icon = toggle.querySelector("i");
    const storageKey = "hr-family-theme";

    function applyTheme(theme) {
        document.documentElement.setAttribute("data-theme", theme);

        if (icon) {
            icon.classList.toggle("fa-sun", theme === "dark");
            icon.classList.toggle("fa-moon", theme !== "dark");
        }

        toggle.setAttribute(
            "aria-label",
            theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
        );
    }

    let savedTheme = "light";

    try {
        savedTheme = localStorage.getItem(storageKey) || "light";
    } catch (error) {
        // Continue with the default theme if storage is unavailable.
    }

    applyTheme(savedTheme);

    toggle.addEventListener("click", function () {
        const currentTheme =
            document.documentElement.getAttribute("data-theme") || "light";

        const nextTheme = currentTheme === "dark" ? "light" : "dark";

        applyTheme(nextTheme);

        try {
            localStorage.setItem(storageKey, nextTheme);
        } catch (error) {
            // Theme still works for the current page.
        }
    });
}

/* ---------------- Global Search ---------------- */

function initFamilyShellSearch() {
    const input = document.getElementById("hrTopbarSearch");
    const resultsBox = document.getElementById("hrGlobalSearchResults");

    if (!input || !resultsBox) return;

    let debounceTimer = null;
    let activeRequest = null;

    function hideResults() {
        resultsBox.hidden = true;
        resultsBox.innerHTML = "";
        input.setAttribute("aria-expanded", "false");
    }

    function showMessage(message) {
        resultsBox.replaceChildren();

        const item = document.createElement("div");
        item.className = "p-3 text-muted small";
        item.textContent = message;

        resultsBox.appendChild(item);
        resultsBox.hidden = false;
        input.setAttribute("aria-expanded", "true");
    }

    function getResultUrl(item) {
        // Only allow URLs returned by the existing same-origin API.
        if (!item || typeof item.url !== "string") return null;

        try {
            const url = new URL(item.url, window.location.origin);

            if (url.origin !== window.location.origin) return null;

            return url.href;
        } catch (error) {
            return null;
        }
    }

    function renderResults(items) {
        resultsBox.replaceChildren();

        if (!Array.isArray(items) || items.length === 0) {
            showMessage("No results found.");
            return;
        }

        items.forEach(function (item) {
            const url = getResultUrl(item);
            const label =
                item.name || item.title || item.label || item.email || "Result";
            const description = item.description || item.type || "";

            if (!url) return;

            const link = document.createElement("a");
            link.href = url;
            link.className = "hr-global-search-item";
            link.setAttribute("role", "option");

            const title = document.createElement("div");
            title.className = "fw-semibold";
            title.textContent = label;

            link.appendChild(title);

            if (description) {
                const detail = document.createElement("div");
                detail.className = "small text-muted";
                detail.textContent = description;
                link.appendChild(detail);
            }

            resultsBox.appendChild(link);
        });

        if (!resultsBox.children.length) {
            showMessage("No results found.");
            return;
        }

        resultsBox.hidden = false;
        input.setAttribute("aria-expanded", "true");
    }

    input.addEventListener("input", function () {
        const query = input.value.trim();

        clearTimeout(debounceTimer);

        if (activeRequest) {
            activeRequest.abort();
            activeRequest = null;
        }

        if (query.length < 2) {
            hideResults();
            return;
        }

        debounceTimer = setTimeout(async function () {
            activeRequest = new AbortController();

            showMessage("Searching...");

            try {
                const response = await fetch(
                    "/global-search?q=" + encodeURIComponent(query),
                    {
                        method: "GET",
                        headers: { "Accept": "application/json" },
                        credentials: "same-origin",
                        signal: activeRequest.signal
                    }
                );

                if (!response.ok) {
                    showMessage(
                        response.status === 401
                            ? "Please log in again."
                            : "Search is temporarily unavailable."
                    );
                    return;
                }

                const data = await response.json();
                renderResults(data.results);

            } catch (error) {
                if (error.name !== "AbortError") {
                    showMessage("Unable to complete search.");
                }
            } finally {
                activeRequest = null;
            }
        }, 250);
    });

    input.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
            hideResults();
            input.blur();
        }
    });

    document.addEventListener("click", function (event) {
        if (
            !input.contains(event.target) &&
            !resultsBox.contains(event.target)
        ) {
            hideResults();
        }
    });
}
