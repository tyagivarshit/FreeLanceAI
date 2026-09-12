const fs = require('fs');
let code = fs.readFileSync('apps/web/settings.js', 'utf8');

// Normalize CRLF
code = code.replace(/\r\n/g, '\n');

// 1. Add elements to the `elements` object
const elementsPatch = `    // Security
    mfaStatusBadge: document.getElementById("mfa-status-badge"),
    btnSetupMfa: document.getElementById("btn-setup-mfa"),
    btnDisableMfa: document.getElementById("btn-disable-mfa"),
    mfaSetupPanel: document.getElementById("mfa-setup-panel"),
    mfaQrCode: document.getElementById("mfa-qr-code"),
    mfaManualKey: document.getElementById("mfa-manual-key"),
    formEnableMfa: document.getElementById("form-enable-mfa"),
    mfaVerifyCode: document.getElementById("mfa-verify-code"),
    mfaAlert: document.getElementById("mfa-alert"),
    btnCancelMfa: document.getElementById("btn-cancel-mfa"),
    formPasswordChange: document.getElementById("form-password-change"),`;

code = code.replace(`    // Security\n    formPasswordChange: document.getElementById("form-password-change"),`, elementsPatch);

// 2. Add `renderProfile` modification to call `renderMfaStatus`
code = code.replace(
  `    if (elements.profileCreatedAt) {\n      elements.profileCreatedAt.textContent = formatDate(profile.createdAt);\n    }\n  }`,
  `    if (elements.profileCreatedAt) {\n      elements.profileCreatedAt.textContent = formatDate(profile.createdAt);\n    }\n    renderMfaStatus(profile.mfaEnabled);\n  }`
);

// 3. Add `renderMfaStatus` and MFA handlers
const mfaHandlers = `
  function renderMfaStatus(isEnabled) {
    if (!elements.mfaStatusBadge) return;
    elements.mfaStatusBadge.textContent = isEnabled ? "Enabled" : "Disabled";
    elements.mfaStatusBadge.className = isEnabled ? "badge badge-success" : "badge badge-warning";
    
    if (isEnabled) {
      elements.btnSetupMfa.classList.add("hidden");
      elements.btnDisableMfa.classList.remove("hidden");
    } else {
      elements.btnSetupMfa.classList.remove("hidden");
      elements.btnDisableMfa.classList.add("hidden");
    }
    elements.mfaSetupPanel.classList.add("hidden");
  }

  function showMfaAlert(msg, isError) {
    if (!elements.mfaAlert) return;
    elements.mfaAlert.textContent = msg;
    elements.mfaAlert.className = \`alert-box \${isError ? "alert-error" : "alert-success"}\`;
    elements.mfaAlert.classList.remove("hidden");
  }

  async function handleMfaSetup() {
    elements.btnSetupMfa.disabled = true;
    try {
      const res = await fetch("/api/auth/mfa/setup", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        elements.mfaQrCode.src = data.qrCodeUri;
        elements.mfaManualKey.textContent = data.secret;
        elements.mfaSetupPanel.classList.remove("hidden");
        elements.btnSetupMfa.classList.add("hidden");
      } else {
        showToast("Failed to initiate MFA setup.", true);
      }
    } catch {
      showToast("Network error.", true);
    } finally {
      elements.btnSetupMfa.disabled = false;
    }
  }

  async function handleMfaEnable(e) {
    e.preventDefault();
    const code = elements.mfaVerifyCode.value;
    if (!code || code.length !== 6) {
      showMfaAlert("Enter 6-digit code.", true);
      return;
    }
    
    try {
      const res = await fetch("/api/auth/mfa/enable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code })
      });
      if (res.ok) {
        showToast("MFA enabled successfully!");
        elements.mfaVerifyCode.value = "";
        elements.mfaAlert.classList.add("hidden");
        renderMfaStatus(true);
      } else {
        showMfaAlert("Invalid code.", true);
      }
    } catch {
      showMfaAlert("Network error.", true);
    }
  }

  async function handleMfaDisable() {
    if (!confirm("Are you sure you want to disable Two-Factor Authentication?")) return;
    elements.btnDisableMfa.disabled = true;
    try {
      const res = await fetch("/api/auth/mfa/disable", { method: "POST" });
      if (res.ok) {
        showToast("MFA disabled.");
        renderMfaStatus(false);
      } else {
        showToast("Failed to disable MFA.", true);
      }
    } catch {
      showToast("Network error.", true);
    } finally {
      elements.btnDisableMfa.disabled = false;
    }
  }

  /**
   * Password Change submission handler.`;

code = code.replace(`  /**\n   * Password Change submission handler.`, mfaHandlers);

// 4. Attach event listeners
const eventListenersPatch = `    if (elements.formPasswordChange) {
      elements.formPasswordChange.addEventListener("submit", handlePasswordChange);
    }
    if (elements.btnSetupMfa) elements.btnSetupMfa.addEventListener("click", handleMfaSetup);
    if (elements.formEnableMfa) elements.formEnableMfa.addEventListener("submit", handleMfaEnable);
    if (elements.btnCancelMfa) elements.btnCancelMfa.addEventListener("click", () => elements.mfaSetupPanel.classList.add("hidden") || elements.btnSetupMfa.classList.remove("hidden"));
    if (elements.btnDisableMfa) elements.btnDisableMfa.addEventListener("click", handleMfaDisable);`;

code = code.replace(`    if (elements.formPasswordChange) {\n      elements.formPasswordChange.addEventListener("submit", handlePasswordChange);\n    }`, eventListenersPatch);

// Write it back
code = code.replace(/\n/g, '\r\n');
fs.writeFileSync('apps/web/settings.js', code);
console.log("Successfully patched settings.js");
