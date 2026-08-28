document.addEventListener("DOMContentLoaded", () => {
  const state = {
    currentStep: 1,
    role: null,
    registeredEmail: null,
  };

  const stepEls = {
    1: document.getElementById("step1"),
    2: document.getElementById("step2"),
    3: document.getElementById("step3"),
    4: document.getElementById("step4"),
  };

  const stepperItems = document.querySelectorAll("#stepper .step-item");
  const stepperConnectors = document.querySelectorAll("#stepper .step-connector");

  function goToStep(stepNumber) {
    Object.values(stepEls).forEach((el) => (el.style.display = "none"));
    stepEls[stepNumber].style.display = "block";
    stepEls[stepNumber].classList.add("fade-in");
    state.currentStep = stepNumber;

    stepperItems.forEach((item) => {
      const itemStep = parseInt(item.getAttribute("data-step"), 10);
      item.classList.remove("active", "complete");
      if (itemStep < stepNumber) item.classList.add("complete");
      else if (itemStep === stepNumber) item.classList.add("active");
    });
    stepperConnectors.forEach((conn, idx) => {
      conn.classList.toggle("complete", idx < stepNumber - 1);
    });

    hideBanner("wizardAlert");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function showWizardError(message) {
    showBanner("wizardAlert", "wizardAlertText", message);
  }

  // ============ STEP 1: Role selection ============
  const roleCards = document.querySelectorAll(".role-card");
  const step1ContinueBtn = document.getElementById("step1Continue");

  roleCards.forEach((card) => {
    card.addEventListener("click", () => {
      roleCards.forEach((c) => c.classList.remove("selected"));
      card.classList.add("selected");
      state.role = card.getAttribute("data-role");
      step1ContinueBtn.disabled = false;
    });
  });

  step1ContinueBtn.addEventListener("click", async () => {

    setButtonLoading(step1ContinueBtn, true, "Saving...");

    const result = await apiPost("/api/register/validate-role", {
        role: state.role
    });

    setButtonLoading(step1ContinueBtn, false);

    if (!result.success) {
        showWizardError(result.message || "Please select a role.");
        return;
    }

    // Hide all extra sections first
    document.getElementById("doctorFields").style.display = "none";
    document.getElementById("familyFields").style.display = "none";

    // Show according to selected role
    if (state.role === "doctor") {
        document.getElementById("doctorFields").style.display = "block";
    }

    if (state.role === "family") {
        document.getElementById("familyFields").style.display = "block";
    }

    goToStep(2);
});
  // ============ STEP 2: Personal information ============
  const step2Continue = document.getElementById("step2Continue");
  const step2Back = document.getElementById("step2Back");

  step2Back.addEventListener("click", () => goToStep(1));

  step2Continue.addEventListener("click", async () => {
    clearAllFieldErrors(stepEls[2]);
    hideBanner("wizardAlert");

    const payload = {
      first_name: document.getElementById("firstName").value.trim(),
      last_name: document.getElementById("lastName").value.trim(),
      date_of_birth: document.getElementById("dob").value,
      gender: document.getElementById("gender").value,
      phone: document.getElementById("phone").value.trim(),
      address: document.getElementById("address").value.trim(),
    };

    // Basic client-side required check before hitting the server
    const fieldMap = {
      first_name: "firstName",
      last_name: "lastName",
      date_of_birth: "dob",
      gender: "gender",
      phone: "phone",
      address: "address",
    };
    let missing = false;
    Object.entries(payload).forEach(([key, val]) => {
      if (!val) {
        showFieldError(fieldMap[key], `${fieldMap[key]}Error`, "This field is required.");
        missing = true;
      }
    });
    if (missing) return;

    setButtonLoading(step2Continue, true, "Saving...");
    const result = await apiPost("/api/register/validate-personal", payload);
    setButtonLoading(step2Continue, false);

    if (!result.success) {
      if (result.field && fieldMap[result.field]) {
        showFieldError(fieldMap[result.field], `${fieldMap[result.field]}Error`, result.message);
      } else {
        showWizardError(result.message || "Please check your information and try again.");
      }
      return;
    }
    goToStep(3);
  });

  // ============ STEP 3: Account details ============
  const step3Continue = document.getElementById("step3Continue");
  const step3Back = document.getElementById("step3Back");
  const regPasswordInput = document.getElementById("regPassword");
  const strengthBars = document.querySelectorAll("#strengthMeter .strength-bar");
  const strengthLabel = document.getElementById("strengthLabel");
  let emailCheckTimer = null;

  step3Back.addEventListener("click", () => goToStep(2));

  function evaluatePasswordStrength(password) {
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
    if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score++;

    const levels = [
      { label: "", color: "" },
      { label: "Weak password", color: "weak" },
      { label: "Fair password", color: "fair" },
      { label: "Good password", color: "good" },
      { label: "Strong password", color: "strong" },
    ];

    strengthBars.forEach((bar, idx) => {
      bar.style.background = idx < score ? barColor(score) : "var(--border-color)";
    });

    strengthLabel.textContent = password ? levels[score].label : "";
    strengthLabel.className = "strength-label " + (password ? levels[score].color : "");
  }

  function barColor(score) {
    if (score <= 1) return "var(--danger)";
    if (score === 2) return "var(--warning)";
    if (score === 3) return "var(--accent-blue)";
    return "var(--success)";
  }

  regPasswordInput.addEventListener("input", () => {
    evaluatePasswordStrength(regPasswordInput.value);
  });

  document.getElementById("regEmail").addEventListener("input", (e) => {
    clearFieldError("regEmail", "regEmailError");
    clearTimeout(emailCheckTimer);
    const email = e.target.value.trim();
    if (!email) return;
    emailCheckTimer = setTimeout(async () => {
      if (!isValidEmail(email)) return;
      const result = await apiPost("/api/register/check-email", { email });
      if (!result.success) {
        showFieldError("regEmail", "regEmailError", result.message);
      }
    }, 500);
  });

  step3Continue.addEventListener("click", async () => {
    clearAllFieldErrors(stepEls[3]);
    hideBanner("wizardAlert");

    const email = document.getElementById("regEmail").value.trim();
    const password = regPasswordInput.value;
    const confirmPassword = document.getElementById("confirmPassword").value;
    const agreeTerms = document.getElementById("agreeTerms").checked;

    let hasError = false;
    if (!isValidEmail(email)) {
      showFieldError("regEmail", "regEmailError", "Please enter a valid email address.");
      hasError = true;
    }
    if (password.length < 8) {
      showFieldError("regPassword", "regPasswordError", "Password must be at least 8 characters.");
      hasError = true;
    }
    if (password !== confirmPassword) {
      showFieldError("confirmPassword", "confirmPasswordError", "Passwords do not match.");
      hasError = true;
    }
    if (!agreeTerms) {
      document.getElementById("agreeTermsError").textContent = "You must accept the terms to continue.";
      document.getElementById("agreeTermsError").classList.add("show");
      hasError = true;
    }
    if (hasError) return;

    setButtonLoading(step3Continue, true, "Creating...");
    const result = await apiPost("/api/register/submit", {
      email,
      password,
      confirm_password: confirmPassword,
      agree_terms: agreeTerms,
    });
    setButtonLoading(step3Continue, false);

    if (!result.success) {
      const fieldMap = {
        email: "regEmail",
        password: "regPassword",
        confirm_password: "confirmPassword",
        agree_terms: "agreeTerms",
      };
      if (result.field && fieldMap[result.field]) {
        showFieldError(fieldMap[result.field], `${fieldMap[result.field]}Error`, result.message);
      } else {
        showWizardError(result.message || "Something went wrong. Please try again.");
      }
      return;
    }

    state.registeredEmail = (result.data && result.data.email) || email;
    document.getElementById("otpEmailDisplay").textContent = state.registeredEmail;
    goToStep(4);
    if (otpHelper) otpHelper.focusFirst();
    beginResendCountdown();
  });

  // ============ STEP 4: OTP verification ============
  const verifyOtpBtn = document.getElementById("verifyOtpBtn");
  const verifyOtpBtnText = document.getElementById("verifyOtpBtnText");
  const resendOtpLink = document.getElementById("resendOtpLink");
  let resendIntervalRef = null;

  function setOtpStatus(type, message) {
    const el = document.getElementById("otpStatusMessage");
    el.className = "otp-status-message show " + type;
    el.innerHTML = `${iconFor(type)}<span>${message}</span>`;
  }

  function clearOtpStatus() {
    const el = document.getElementById("otpStatusMessage");
    el.className = "otp-status-message";
    el.innerHTML = "";
  }

  function iconFor(type) {
    if (type === "success-msg") {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
    }
    if (type === "warning-msg") {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';
    }
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
  }

  async function submitOtp(code) {
    clearOtpStatus();
    setButtonLoading(verifyOtpBtn, true, "Verifying...");

    const result = await apiPost("/api/register/verify-otp", { otp: code });

    setButtonLoading(verifyOtpBtn, false);

    if (result.success) {
      otpHelper.markSuccess();
      setOtpStatus("success-msg", "Email verified! Your account is now active.");
      clearInterval(resendIntervalRef);
      setTimeout(() => {
        window.location.href = "/login";
      }, 1600);
      return;
    }

    otpHelper.markError();

    if (result._status === 410) {
      setOtpStatus("warning-msg", "This code has expired. Please request a new one.");
    } else {
      setOtpStatus("error-msg", result.message || "The code you entered is incorrect.");
    }
    otpHelper.clear();
  }

  const otpHelper = setupOtpInputs("otpInputs", (code) => {
    submitOtp(code);
  });

  verifyOtpBtn.addEventListener("click", () => {
    const code = otpHelper.getValue();
    if (code.length !== 6) {
      setOtpStatus("error-msg", "Please enter the complete 6-digit code.");
      return;
    }
    submitOtp(code);
  });

  function beginResendCountdown() {
    clearInterval(resendIntervalRef);
    resendIntervalRef = startResendCountdown("resendOtpLink", "resendCountdown", 30);
  }

  resendOtpLink.addEventListener("click", async (e) => {
    e.preventDefault();
    if (resendOtpLink.classList.contains("disabled")) return;

    clearOtpStatus();
    const result = await apiPost("/api/register/resend-otp", {});

    if (!result.success) {
      setOtpStatus("error-msg", result.message || "Unable to resend the code right now.");
      return;
    }

    setOtpStatus("success-msg", "A new verification code has been sent.");
    otpHelper.clear();
    beginResendCountdown();
  });

  // Start on step 1
  goToStep(1);
});
