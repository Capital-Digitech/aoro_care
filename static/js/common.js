/**
 * Health Ring - shared front-end helpers
 */

async function apiPost(url, data) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": window.CSRF_TOKEN,
    },
    credentials: "same-origin",
    body: JSON.stringify(data || {}),
  });

  let payload = {};
  try {
    payload = await response.json();
  } catch (e) {
    payload = { success: false, message: "Unexpected server response." };
  }

  payload._status = response.status;
  return payload;
}

function showFieldError(inputId, errorId, message) {
  const input = document.getElementById(inputId);
  const errorEl = document.getElementById(errorId);
  if (input) input.classList.add("is-invalid");
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.classList.add("show");
  }
}

function clearFieldError(inputId, errorId) {
  const input = document.getElementById(inputId);
  const errorEl = document.getElementById(errorId);
  if (input) input.classList.remove("is-invalid");
  if (errorEl) {
    errorEl.textContent = "";
    errorEl.classList.remove("show");
  }
}

function clearAllFieldErrors(container) {
  container.querySelectorAll(".form-control.is-invalid").forEach((el) => el.classList.remove("is-invalid"));
  container.querySelectorAll(".field-error.show").forEach((el) => {
    el.classList.remove("show");
    el.textContent = "";
  });
}

function showBanner(bannerId, textId, message) {
  const banner = document.getElementById(bannerId);
  const textEl = document.getElementById(textId);
  if (textEl) textEl.textContent = message;
  if (banner) banner.classList.add("show");
}

function hideBanner(bannerId) {
  const banner = document.getElementById(bannerId);
  if (banner) banner.classList.remove("show");
}

function setButtonLoading(btn, isLoading, loadingText) {
  if (!btn) return;
  if (isLoading) {
    btn.dataset.originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span><span>${loadingText || "Please wait..."}</span>`;
  } else {
    btn.disabled = false;
    if (btn.dataset.originalHtml) {
      btn.innerHTML = btn.dataset.originalHtml;
    }
  }
}

function isValidEmail(value) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
}

// Password visibility toggles (works on any page with .toggle-visibility buttons)
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".toggle-visibility").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-target");
      const input = document.getElementById(targetId);
      if (!input) return;
      input.type = input.type === "password" ? "text" : "password";
    });
  });
});

/**
 * Wire up a 6-box OTP input group.
 * Returns helper functions: { getValue, clear, focusFirst, markError, markSuccess, onComplete }
 */
function setupOtpInputs(containerId, onCompleteCallback) {
  const container = document.getElementById(containerId);
  if (!container) return null;
  const boxes = Array.from(container.querySelectorAll(".otp-box"));

  function getValue() {
    return boxes.map((b) => b.value).join("");
  }

  function clear() {
    boxes.forEach((b) => {
      b.value = "";
      b.classList.remove("filled", "error", "success");
    });
    boxes[0].focus();
  }

  function markError() {
    boxes.forEach((b) => b.classList.add("error"));
    setTimeout(() => boxes.forEach((b) => b.classList.remove("error")), 350);
  }

  function markSuccess() {
    boxes.forEach((b) => b.classList.add("success"));
  }

  boxes.forEach((box, idx) => {
    box.addEventListener("input", () => {
      box.value = box.value.replace(/\D/g, "").slice(0, 1);
      if (box.value) {
        box.classList.add("filled");
        if (idx < boxes.length - 1) boxes[idx + 1].focus();
      } else {
        box.classList.remove("filled");
      }
      if (getValue().length === boxes.length && onCompleteCallback) {
        onCompleteCallback(getValue());
      }
    });

    box.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" && !box.value && idx > 0) {
        boxes[idx - 1].focus();
      }
    });

    box.addEventListener("paste", (e) => {
      e.preventDefault();
      const pasted = (e.clipboardData || window.clipboardData).getData("text").replace(/\D/g, "");
      if (!pasted) return;
      pasted
        .slice(0, boxes.length)
        .split("")
        .forEach((char, i) => {
          if (boxes[i]) {
            boxes[i].value = char;
            boxes[i].classList.add("filled");
          }
        });
      const lastFilledIndex = Math.min(pasted.length, boxes.length) - 1;
      if (boxes[lastFilledIndex]) boxes[lastFilledIndex].focus();
      if (getValue().length === boxes.length && onCompleteCallback) {
        onCompleteCallback(getValue());
      }
    });
  });

  return { getValue, clear, markError, markSuccess, focusFirst: () => boxes[0].focus() };
}

/**
 * Simple countdown timer for "Resend code" links.
 */
function startResendCountdown(linkId, countdownId, seconds, onExpireEnableLink) {
  const link = document.getElementById(linkId);
  const countdownEl = document.getElementById(countdownId);
  let remaining = seconds;

  link.classList.add("disabled");
  countdownEl.textContent = ` in ${remaining}s`;

  const interval = setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) {
      clearInterval(interval);
      countdownEl.textContent = "";
      link.classList.remove("disabled");
      if (onExpireEnableLink) onExpireEnableLink();
    } else {
      countdownEl.textContent = ` in ${remaining}s`;
    }
  }, 1000);

  return interval;
}
// ==========================================================
// PATIENT GLOBAL SEARCH
// ==========================================================
function initPatientGlobalSearch() {

  const searchInput = document.getElementById("hrSearchInput");
  const resultsBox = document.getElementById("hrGlobalSearchResults");

  if (!searchInput || !resultsBox) return;

  if (searchInput.dataset.searchInitialized === "true") return;

  searchInput.dataset.searchInitialized = "true";

  let searchTimer;

  function escapeHtml(value) {
    const div = document.createElement("div");
    div.textContent = value || "";
    return div.innerHTML;
  }

  function hideResults() {
    resultsBox.classList.remove("show");
    resultsBox.innerHTML = "";
  }

  function showLoading() {
    resultsBox.innerHTML = `
      <div class="hr-search-loading">
        <i class="fa-solid fa-spinner fa-spin"></i>
        Searching...
      </div>
    `;

    resultsBox.classList.add("show");
  }

  function showEmpty(query) {
    resultsBox.innerHTML = `
      <div class="hr-search-empty">
        <i class="fa-solid fa-magnifying-glass"></i>
        <strong>No results found</strong>
        <span>No matches found for "${escapeHtml(query)}"</span>
      </div>
    `;

    resultsBox.classList.add("show");
  }

  function renderResults(results) {

    if (!results || results.length === 0) {
      showEmpty(searchInput.value.trim());
      return;
    }

    let html = "";
    let currentCategory = "";

    results.forEach((result) => {

      if (result.category !== currentCategory) {

        currentCategory = result.category;

        html += `
          <div class="hr-search-category">
            ${escapeHtml(currentCategory)}
          </div>
        `;
      }

      html += `
        <div
          class="hr-search-result"
          data-url="${escapeHtml(result.url || "#")}"
        >

          <div class="hr-search-result-icon">
            <i class="fa-solid ${escapeHtml(result.icon || "fa-magnifying-glass")}"></i>
          </div>

          <div class="hr-search-result-content">

            <div class="hr-search-result-title">
              ${escapeHtml(result.title || "Search Result")}
            </div>

            <div class="hr-search-result-description">
              ${escapeHtml(result.description || "")}
            </div>

          </div>

          <i
            class="fa-solid fa-chevron-right"
            style="font-size:10px;color:var(--hr-text-400);"
          ></i>

        </div>
      `;
    });

    resultsBox.innerHTML = html;
    resultsBox.classList.add("show");

    resultsBox.querySelectorAll(".hr-search-result").forEach((item) => {

      item.addEventListener("click", () => {

        const url = item.dataset.url;

        if (url && url !== "#") {
          window.location.href = url;
        }

      });

    });
  }

  searchInput.addEventListener("input", function () {

    const query = this.value
      .trim()
      .replace(/\s+/g, " ");

    clearTimeout(searchTimer);

    if (query.length < 2) {
      hideResults();
      return;
    }

    showLoading();

    searchTimer = setTimeout(async () => {

      try {

        const response = await fetch(
          `/patient-search?q=${encodeURIComponent(query)}`,
          {
            credentials: "same-origin"
          }
        );

        if (!response.ok) {
          throw new Error(`Search failed: ${response.status}`);
        }

        const data = await response.json();

        console.log("Patient Search:", data);

        renderResults(data.results);

      } catch (error) {

        console.error("Patient search error:", error);

        resultsBox.innerHTML = `
          <div class="hr-search-empty">
            <i class="fa-solid fa-triangle-exclamation"></i>
            <strong>Unable to search</strong>
            <span>Please try again in a moment.</span>
          </div>
        `;

        resultsBox.classList.add("show");
      }

    }, 300);
  });

  // Close when clicking outside
  document.addEventListener("click", function (event) {

    if (
      !searchInput.contains(event.target) &&
      !resultsBox.contains(event.target)
    ) {
      hideResults();
    }

  });

  // Escape key closes search
  searchInput.addEventListener("keydown", function (event) {

    if (event.key === "Escape") {
      hideResults();
      searchInput.blur();
    }

  });
}

initPatientGlobalSearch();
