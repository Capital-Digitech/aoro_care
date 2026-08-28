document.addEventListener("DOMContentLoaded", () => {
  let selectedRole = "patient";

  const roleTabs = document.querySelectorAll("#roleTabs .role-tab");
  roleTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      roleTabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      selectedRole = tab.getAttribute("data-role");
    });
  });

  const form = document.getElementById("loginForm");
  const submitBtn = document.getElementById("loginSubmitBtn");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideBanner("loginAlert");
    clearFieldError("email", "emailError");
    clearFieldError("password", "passwordError");

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const remember = document.getElementById("remember").checked;

    let hasError = false;
    if (!isValidEmail(email)) {
      showFieldError("email", "emailError", "Please enter a valid email address.");
      hasError = true;
    }
    if (!password) {
      showFieldError("password", "passwordError", "Please enter your password.");
      hasError = true;
    }
    if (hasError) return;

    setButtonLoading(submitBtn, true, "Signing in...");

    const result = await apiPost("/api/login", {
      role: selectedRole,
      email,
      password,
      remember,
    });

    setButtonLoading(submitBtn, false);

    if (!result.success) {
      showBanner("loginAlert", "loginAlertText", result.message || "Unable to sign in.");
      return;
    }

    window.location.href = (result.data && result.data.redirect) || "/dashboard";
  });
});
