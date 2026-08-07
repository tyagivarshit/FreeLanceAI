document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("signup-form");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const submitButton = document.getElementById("submit-button");
  const buttonText = document.getElementById("button-text");
  const buttonSpinner = document.getElementById("button-spinner");
  const successPanel = document.getElementById("success-panel");
  const successMessage = document.getElementById("success-message");
  const errorAlert = document.getElementById("error-alert");
  const errorList = document.getElementById("error-list");
  const errorTitle = document.getElementById("error-title");

  const reqLength = document.getElementById("req-length");
  const reqUppercase = document.getElementById("req-uppercase");
  const reqLowercase = document.getElementById("req-lowercase");
  const reqDigit = document.getElementById("req-digit");
  const reqSpecial = document.getElementById("req-special");
  const strengthBar = document.getElementById("strength-bar");

  // Real-time password criteria visualization
  passwordInput.addEventListener("input", () => {
    const password = passwordInput.value;

    const rules = {
      length: password.length >= 12,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      digit: /[0-9]/.test(password),
      special: /[^A-Za-z0-9]/.test(password),
    };

    updateRequirementUI(reqLength, rules.length);
    updateRequirementUI(reqUppercase, rules.uppercase);
    updateRequirementUI(reqLowercase, rules.lowercase);
    updateRequirementUI(reqDigit, rules.digit);
    updateRequirementUI(reqSpecial, rules.special);

    const metCount = Object.values(rules).filter(Boolean).length;
    const percentage = (metCount / 5) * 100;
    strengthBar.style.width = `${percentage}%`;

    strengthBar.className = "strength-bar";
    if (metCount <= 2) {
      strengthBar.classList.add("strength-weak");
    } else if (metCount <= 4) {
      strengthBar.classList.add("strength-medium");
    } else {
      strengthBar.classList.add("strength-strong");
    }
  });

  function updateRequirementUI(element, isMet) {
    if (isMet) {
      element.classList.add("met");
    } else {
      element.classList.remove("met");
    }
  }

  // Intercept and post signup details
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    errorAlert.classList.add("hidden");
    errorList.innerHTML = "";

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      showError("Registration Failed", ["Please fill out all required fields."]);
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        form.classList.add("hidden");
        successPanel.classList.remove("hidden");
        successMessage.textContent = `We've sent a verification link to ${result.user.email}. Please click the link to activate your account.`;
      } else {
        const title =
          result.code === "DUPLICATE_EMAIL" ? "Account Already Exists" : "Registration Failed";

        const errors = result.errors
          ? result.errors
          : [result.message || "An unexpected error occurred during signup."];

        showError(title, errors);
        setLoading(false);
      }
    } catch {
      showError("Connection Failed", [
        "Unable to connect to the server. Please check your internet connection.",
      ]);
      setLoading(false);
    }
  });

  function showError(title, errors) {
    errorTitle.textContent = title;
    errorList.innerHTML = "";
    errors.forEach((err) => {
      const li = document.createElement("li");
      li.textContent = err;
      errorList.appendChild(li);
    });
    errorAlert.classList.remove("hidden");
    errorAlert.scrollIntoView({ behavior: "smooth" });
  }

  function setLoading(isLoading) {
    if (isLoading) {
      submitButton.disabled = true;
      emailInput.disabled = true;
      passwordInput.disabled = true;
      buttonText.textContent = "Creating account...";
      buttonSpinner.classList.remove("hidden");
    } else {
      submitButton.disabled = false;
      emailInput.disabled = false;
      passwordInput.disabled = false;
      buttonText.textContent = "Create account";
      buttonSpinner.classList.add("hidden");
    }
  }
});
