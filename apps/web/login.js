document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("login-form");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const submitButton = document.getElementById("submit-button");
  const buttonText = document.getElementById("button-text");
  const buttonSpinner = document.getElementById("button-spinner");

  const errorAlert = document.getElementById("error-alert");
  const errorTitle = document.getElementById("error-title");
  const errorList = document.getElementById("error-list");
  const successPanel = document.getElementById("success-panel");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Reset previous states
    hideError();
    hideSuccess();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    // Validate inputs
    const errors = [];
    if (!email) {
      errors.push("Email address is required.");
    } else if (!validateEmail(email)) {
      errors.push("Please enter a valid email address.");
    }

    if (!password) {
      errors.push("Password is required.");
    }

    if (errors.length > 0) {
      showErrors("Validation failed", errors);
      return;
    }

    // Set Loading State
    setLoading(true);

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        showSuccess(data.user);
      } else {
        const message = data.message || "An unexpected error occurred.";
        switch (data.code) {
          case "ACCOUNT_LOCKED":
            showErrors("Account Locked", [message]);
            break;
          case "PENDING_VERIFICATION":
            showErrors("Verification Pending", [message]);
            break;
          case "ACCOUNT_SUSPENDED":
            showErrors("Account Suspended", [message]);
            break;
          case "ACCOUNT_DISABLED":
            showErrors("Account Disabled", [message]);
            break;
          case "MAX_SESSIONS_EXCEEDED":
            showErrors("Concurrent Sessions Exceeded", [message]);
            break;
          case "INVALID_CREDENTIALS":
            showErrors("Authentication Failure", ["Invalid email or password."]);
            break;
          default:
            showErrors("Authentication Failure", [message]);
            break;
        }
      }
    } catch {
      showErrors("Network Error", [
        "Could not connect to the authentication server. Please try again.",
      ]);
    } finally {
      setLoading(false);
    }
  });

  function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }

  function setLoading(isLoading) {
    if (isLoading) {
      submitButton.disabled = true;
      buttonText.textContent = "Verifying...";
      buttonSpinner.classList.remove("hidden");
    } else {
      submitButton.disabled = false;
      buttonText.textContent = "Log in";
      buttonSpinner.classList.add("hidden");
    }
  }

  function showErrors(title, messages) {
    errorTitle.textContent = title;
    errorList.innerHTML = "";
    messages.forEach((msg) => {
      const li = document.createElement("li");
      li.textContent = msg;
      errorList.appendChild(li);
    });
    errorAlert.classList.remove("hidden");
    // Scroll error alert into view for keyboard/screen reader focus
    errorAlert.scrollIntoView({ behavior: "smooth" });
  }

  function hideError() {
    errorAlert.classList.add("hidden");
    errorList.innerHTML = "";
  }

  function showSuccess(user) {
    form.classList.add("hidden");
    successPanel.classList.remove("hidden");
    logoutActions.classList.remove("hidden");
    logoutSuccessMessage.classList.add("hidden");
    globalConfirmPanel.classList.add("hidden");
    const successMsg = document.getElementById("success-message");
    successMsg.textContent = `Welcome back! You have successfully established a secure session as ${user.email}.`;
    logoutButton.focus();
  }

  function hideSuccess() {
    successPanel.classList.add("hidden");
    form.classList.remove("hidden");
  }

  // Logout UI Selectors
  const logoutButton = document.getElementById("logout-button");
  const logoutText = document.getElementById("logout-text");
  const logoutSpinner = document.getElementById("logout-spinner");

  const globalLogoutButton = document.getElementById("global-logout-button");
  const globalLogoutSpinner = document.getElementById("global-logout-spinner");

  const globalConfirmPanel = document.getElementById("global-confirm-panel");
  const confirmGlobalButton = document.getElementById("confirm-global-button");
  const cancelGlobalButton = document.getElementById("cancel-global-button");

  const logoutSuccessMessage = document.getElementById("logout-success-message");
  const logoutActions = document.getElementById("logout-actions");

  // Single Device Logout Event Listener
  logoutButton.addEventListener("click", async () => {
    await performLogout(false);
  });

  // Global Logout triggers Confirmation Dialog
  globalLogoutButton.addEventListener("click", () => {
    logoutActions.classList.add("hidden");
    globalConfirmPanel.classList.remove("hidden");
    confirmGlobalButton.focus(); // Set focus for accessibility
  });

  cancelGlobalButton.addEventListener("click", () => {
    globalConfirmPanel.classList.add("hidden");
    logoutActions.classList.remove("hidden");
    globalLogoutButton.focus();
  });

  confirmGlobalButton.addEventListener("click", async () => {
    await performLogout(true);
  });

  async function performLogout(global = false) {
    setLogoutLoading(true, global);
    hideError();

    try {
      const data = await window.authActions.logout({ global });

      if (data.success) {
        globalConfirmPanel.classList.add("hidden");
        logoutActions.classList.add("hidden");
        logoutSuccessMessage.classList.remove("hidden");

        // Restore login form after success delay
        setTimeout(() => {
          logoutSuccessMessage.classList.add("hidden");
          successPanel.classList.add("hidden");
          form.classList.remove("hidden");
          emailInput.value = "";
          passwordInput.value = "";
          emailInput.focus();
        }, 2000);
      } else {
        showErrors("Logout Failed", [
          data.message || "An unexpected error occurred during logout.",
        ]);
        globalConfirmPanel.classList.add("hidden");
        logoutActions.classList.remove("hidden");
      }
    } catch (err) {
      showErrors("Logout Failed", [
        err.message || "Could not connect to the authentication server for logout.",
      ]);
      globalConfirmPanel.classList.add("hidden");
      logoutActions.classList.remove("hidden");
    } finally {
      setLogoutLoading(false, global);
    }
  }

  function setLogoutLoading(isLoading, global) {
    if (isLoading) {
      logoutButton.disabled = true;
      globalLogoutButton.disabled = true;
      confirmGlobalButton.disabled = true;
      cancelGlobalButton.disabled = true;
      if (global) {
        confirmGlobalButton.textContent = "Logging out...";
        globalLogoutSpinner.classList.remove("hidden");
      } else {
        logoutText.textContent = "Logging out...";
        logoutSpinner.classList.remove("hidden");
      }
    } else {
      logoutButton.disabled = false;
      globalLogoutButton.disabled = false;
      confirmGlobalButton.disabled = false;
      cancelGlobalButton.disabled = false;
      confirmGlobalButton.textContent = "Yes, log out all";
      logoutText.textContent = "Log out from this device";
      logoutSpinner.classList.add("hidden");
      globalLogoutSpinner.classList.add("hidden");
    }
  }
});
