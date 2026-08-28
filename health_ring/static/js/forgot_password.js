document.addEventListener("DOMContentLoaded", () => {
  let resetEmail = null;
  let resendIntervalRef = null;

  const stepEmail = document.getElementById("fpStepEmail");
  const stepOtp = document.getElementById("fpStepOtp");
  const stepReset = document.getElementById("fpStepReset");

  function showStep(step) {
    [stepEmail, stepOtp, stepReset].forEach((el) => (el.style.display = "none"));
    step.style.display = "block";
    step.classList.add("fade-in");
    hideBanner("fpAlert");
    hideBanner("fpSuccess");
  }

  // ===== Step A: send OTP =====
  const sendOtpBtn = document.getElementById("fpSendOtpBtn");
  sendOtpBtn.addEventListener("click", async () => {
    hideBanner("fpAlert");
    const email = document.getElementById("fpEmail").value.trim();

    if (!isValidEmail(email)) {
      showBanner("fpAlert", "fpAlertText", "Please enter a valid email address.");
      return;
    }

    setButtonLoading(sendOtpBtn, true, "Sending...");
    const result = await apiPost("/api/forgot-password/send-otp", { email });
    setButtonLoading(sendOtpBtn, false);

    if (!result.success) {
      showBanner("fpAlert", "fpAlertText", result.message || "Unable to send reset code.");
      return;
    }

    resetEmail = email;
    document.getElementById("fpOtpEmailDisplay").textContent = email;
    showStep(stepOtp);
    otpHelper.focusFirst();
    beginResendCountdown();
  });

  // ===== Step B: verify OTP =====
  const verifyBtn = document.getElementById("fpVerifyOtpBtn");
  const resendLink = document.getElementById("fpResendOtpLink");

  async function submitOtp(code) {
    hideBanner("fpAlert");
    setButtonLoading(verifyBtn, true, "Verifying...");
    const result = await apiPost("/api/forgot-password/verify-otp", { otp: code });
    setButtonLoading(verifyBtn, false);

    if (!result.success) {
      otpHelper.markError();
      showBanner("fpAlert", "fpAlertText", result.message || "Invalid or expired code.");
      otpHelper.clear();
      return;
    }

    otpHelper.markSuccess();
    clearInterval(resendIntervalRef);
    setTimeout(() => showStep(stepReset), 500);
  }

  const otpHelper = setupOtpInputs("fpOtpInputs", (code) => submitOtp(code));

  verifyBtn.addEventListener("click", () => {
    const code = otpHelper.getValue();
    if (code.length !== 6) {
      showBanner("fpAlert", "fpAlertText", "Please enter the complete 6-digit code.");
      return;
    }
    submitOtp(code);
  });

  function beginResendCountdown() {
    clearInterval(resendIntervalRef);
    resendIntervalRef = startResendCountdown("fpResendOtpLink", "fpResendCountdown", 30);
  }

  resendLink.addEventListener("click", async (e) => {
    e.preventDefault();
    if (resendLink.classList.contains("disabled")) return;
    hideBanner("fpAlert");

    const result = await apiPost("/api/forgot-password/send-otp", { email: resetEmail });
    if (!result.success) {
      showBanner("fpAlert", "fpAlertText", result.message || "Unable to resend code.");
      return;
    }
    showBanner("fpSuccess", "fpSuccessText", "A new code has been sent.");
    otpHelper.clear();
    beginResendCountdown();
  });

  // ===== Step C: set new password =====
  const resetBtn = document.getElementById("fpResetBtn");
  resetBtn.addEventListener("click", async () => {
    hideBanner("fpAlert");
    const newPassword = document.getElementById("newPassword").value;
    const confirmNewPassword = document.getElementById("confirmNewPassword").value;

    if (newPassword.length < 8) {
      showBanner("fpAlert", "fpAlertText", "Password must be at least 8 characters long.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      showBanner("fpAlert", "fpAlertText", "Passwords do not match.");
      return;
    }

    setButtonLoading(resetBtn, true, "Updating...");
    const result = await apiPost("/api/forgot-password/reset", {
      new_password: newPassword,
      confirm_password: confirmNewPassword,
    });
    setButtonLoading(resetBtn, false);

    if (!result.success) {
      showBanner("fpAlert", "fpAlertText", result.message || "Unable to update password.");
      return;
    }

    showBanner("fpSuccess", "fpSuccessText", "Password updated! Redirecting to sign in...");
    setTimeout(() => {
      window.location.href = "/login";
    }, 1500);
  });
});
