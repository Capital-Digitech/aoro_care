/* =========================================================
   Aoro Care - Family Linked Patients
   Page-specific JavaScript
   ========================================================= */

document.addEventListener("DOMContentLoaded", function () {
    initLinkedPatientsSidebar();
    initLinkedPatientsTheme();
    initLinkedPatientsSearch();
    initLinkedPatientsFilters();
    initLinkedPatientsViewModal();
});

/* ---------------- Sidebar ---------------- */

function initLinkedPatientsSidebar() {
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

function initLinkedPatientsTheme() {
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

function initLinkedPatientsSearch() {
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

/* ---------------- Table Search + Filters ---------------- */

function initLinkedPatientsFilters() {
    const table = document.getElementById("hrPatientTable");
    const search = document.getElementById("hrSearchPatient");
    const statusFilter = document.getElementById("hrStatusFilter");
    const resetButton = document.getElementById("hrResetFilters");
    const countLabel = document.getElementById("hrPatientCountLabel");
    const noResults = document.getElementById("hrNoResults");

    if (!table) return;

    const rows = Array.from(
        table.querySelectorAll("tbody tr[data-name]")
    );

    function applyFilters() {
        const term = (search ? search.value : "").trim().toLowerCase();
        const status = statusFilter ? statusFilter.value : "";
        let visible = 0;

        rows.forEach(function (row) {
            const matchesText =
                !term ||
                row.dataset.name.includes(term) ||
                row.dataset.code.includes(term);

            let matchesStatus = true;

            if (status === "critical") {
                matchesStatus = row.dataset.critical === "yes";
            } else if (status) {
                matchesStatus = row.dataset.ring === status;
            }

            const show = matchesText && matchesStatus;
            row.hidden = !show;

            if (show) visible += 1;
        });

        if (countLabel) {
            countLabel.textContent = visible + " patient(s) found";
        }

        if (noResults) {
            noResults.hidden = !(rows.length > 0 && visible === 0);
        }
    }

    if (search) search.addEventListener("input", applyFilters);
    if (statusFilter) statusFilter.addEventListener("change", applyFilters);

    if (resetButton) {
        resetButton.addEventListener("click", function () {
            if (search) search.value = "";
            if (statusFilter) statusFilter.value = "";
            applyFilters();
        });
    }
}

/* ---------------- View Patient Modal ---------------- */

function initLinkedPatientsViewModal() {
    const modal = document.getElementById("hrViewPatientModal");

    if (!modal) return;

    function setText(id, value) {
        const element = document.getElementById(id);
        if (element) element.textContent = value || "—";
    }

    function openModal(button) {
        const data = button.dataset;

        setText("hrViewName", data.name);
        setText("hrViewCode", data.code);
        setText("hrViewGender", data.gender);
        setText("hrViewAge", data.age);
        setText("hrViewBlood", data.blood);
        setText("hrViewDoctor", data.doctor);
        setText("hrViewEmergency", data.emergency);
        setText("hrViewHeartRate", data.heartRate);
        setText("hrViewSpo2", data.spo2);
        setText("hrViewTemperature", data.temperature);
        setText("hrViewRingStatusValue", data.ringStatus);
        setText("hrViewAppointment", data.appointment);
        setText("hrViewReport", data.report);
        setText("hrViewHistory", data.history);

        const avatar = document.getElementById("hrViewAvatar");

        if (avatar) {
            avatar.textContent =
                (data.name || "P").trim().charAt(0).toUpperCase() || "P";
        }

        const chip = document.getElementById("hrViewRingStatus");
        const chipText = document.getElementById("hrViewRingStatusText");
        const ring = (data.ringStatus || "").toLowerCase();

        if (chipText) chipText.textContent = data.ringStatus || "—";

        if (chip) {
            chip.classList.remove(
                "online", "offline", "hr-ring-online", "hr-ring-offline"
            );

            if (ring === "online") {
                chip.classList.add("online", "hr-ring-online");
            } else if (ring === "offline") {
                chip.classList.add("offline", "hr-ring-offline");
            }
        }

        modal.classList.add("show");
        modal.setAttribute("aria-hidden", "false");
        document.body.classList.add("hr-modal-open");
    }

    function closeModal() {
        modal.classList.remove("show");
        modal.setAttribute("aria-hidden", "true");
        document.body.classList.remove("hr-modal-open");
    }

    document
        .querySelectorAll('[data-action="view-patient"]')
        .forEach(function (button) {
            button.addEventListener("click", function () {
                openModal(button);
            });
        });

    modal.querySelectorAll("[data-close-modal]").forEach(function (button) {
        button.addEventListener("click", closeModal);
    });

    modal.addEventListener("click", function (event) {
        if (event.target === modal) closeModal();
    });

    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && modal.classList.contains("show")) {
            closeModal();
        }
    });
}