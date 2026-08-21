import test from "node:test";
import assert from "node:assert";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read settings HTML template
const settingsHtml = fs.readFileSync(path.join(__dirname, "settings.html"), "utf-8");

// Mock Data
const mockProfile = {
  success: true,
  profile: {
    userId: "user-12345",
    email: "tyagi@freelanceos.com",
    status: "active",
    emailVerifiedAt: "2026-08-01T10:00:00.000Z",
    createdAt: "2026-07-15T08:30:00.000Z",
  },
};

const mockSessions = {
  success: true,
  currentSessionId: "session-current-1",
  sessions: [
    {
      sessionId: "session-current-1",
      deviceName: "Chrome on macOS",
      platform: "macOS",
      browser: "Chrome",
      ipAddress: "192.168.1.10",
      lastActivityAt: new Date().toISOString(),
      createdAt: "2026-08-20T10:00:00.000Z",
      expiresAt: "2026-09-20T10:00:00.000Z",
      isCurrent: true,
    },
    {
      sessionId: "session-other-2",
      deviceName: "Safari on iPhone",
      platform: "iOS",
      browser: "Safari",
      ipAddress: "10.0.0.5",
      lastActivityAt: new Date(Date.now() - 3600000).toISOString(),
      createdAt: "2026-08-18T12:00:00.000Z",
      expiresAt: "2026-09-18T12:00:00.000Z",
      isCurrent: false,
    },
  ],
};

const mockExtension = {
  success: true,
  extension: {
    name: "FreelanceOS Job Matcher",
    version: "0.1.0",
    manifestVersion: 3,
    supportedPlatforms: [
      { id: "upwork", name: "Upwork", supported: true, matchPattern: "https://*.upwork.com/*" },
      {
        id: "linkedin",
        name: "LinkedIn",
        supported: true,
        matchPattern: "https://*.linkedin.com/*",
      },
    ],
    syncPreferences: {
      autoImport: true,
      backgroundSync: true,
    },
    connectionStatus: "available",
  },
};

const mockSubscription = {
  success: true,
  planId: "PRO",
  planName: "Pro Plan",
  source: "SUBSCRIPTION",
  status: "active",
  billingInterval: "MONTHLY",
  period: {
    type: "BILLING_CYCLE",
    startedAt: "2026-08-01T00:00:00.000Z",
    endsAt: "2026-09-01T00:00:00.000Z",
  },
  trialDaysRemaining: null,
  hasCustomer: true,
};

/**
 * Creates an isolated mock DOM environment mimicking settings.html.
 */
function createMockEnvironment(fetchHandler) {
  const elements = {};
  const querySelectors = {};
  const eventListeners = {};

  function makeElement(id, tag = "div") {
    const el = {
      id,
      tagName: tag.toUpperCase(),
      textContent: "",
      value: "",
      className: "",
      disabled: false,
      style: {},
      attributes: {},
      children: [],
      classList: {
        _classes: new Set(),
        add(...cls) {
          cls.forEach((c) => this._classes.add(c));
          el.className = Array.from(this._classes).join(" ");
        },
        remove(...cls) {
          cls.forEach((c) => this._classes.delete(c));
          el.className = Array.from(this._classes).join(" ");
        },
        contains(c) {
          return this._classes.has(c);
        },
        toggle(c, force) {
          if (force !== undefined) {
            if (force) {
              this.add(c);
            } else {
              this.remove(c);
            }
          } else {
            if (this.contains(c)) {
              this.remove(c);
            } else {
              this.add(c);
            }
          }
        },
      },
      setAttribute(k, v) {
        this.attributes[k] = String(v);
      },
      getAttribute(k) {
        return this.attributes[k] || null;
      },
      removeAttribute(k) {
        delete this.attributes[k];
      },
      addEventListener(evt, fn) {
        if (!eventListeners[`${id}:${evt}`]) {
          eventListeners[`${id}:${evt}`] = [];
        }
        eventListeners[`${id}:${evt}`].push(fn);
      },
      click() {
        const handlers = eventListeners[`${id}:click`] || [];
        handlers.forEach((fn) => fn({ preventDefault: () => {} }));
      },
      focus() {},
      reset() {
        this.value = "";
      },
      appendChild(child) {
        this.children.push(child);
      },
      remove() {},
    };
    elements[id] = el;
    return el;
  }

  // Core Shell Elements
  makeElement("user-avatar");
  makeElement("btn-logout");
  makeElement("settings-skeleton");
  makeElement("settings-error");
  makeElement("settings-error-msg");
  makeElement("settings-retry-btn");
  makeElement("settings-content");

  // Tabs & Panels
  const tabsList = ["profile", "security", "data", "extension", "billing"].map((tab) => {
    const tabEl = makeElement(`tab-${tab}`, "button");
    tabEl.setAttribute("data-tab", tab);
    return tabEl;
  });

  makeElement("panel-profile", "section");
  makeElement("panel-security", "section");
  makeElement("panel-data", "section");
  makeElement("panel-extension", "section");
  makeElement("panel-billing", "section");

  // Profile Elements
  makeElement("profile-email", "input");
  makeElement("profile-user-id", "input");
  makeElement("profile-status-badge", "span");
  makeElement("profile-created-at", "span");

  // Security Elements
  makeElement("form-password-change", "form");
  makeElement("current-password", "input");
  makeElement("new-password", "input");
  makeElement("confirm-password", "input");
  makeElement("btn-change-password", "button");
  makeElement("password-alert", "div");
  makeElement("sessions-list", "div");
  makeElement("btn-revoke-all-sessions", "button");

  // Data Elements
  makeElement("btn-export-data", "button");
  makeElement("btn-danger-reset", "button");

  // Extension Elements
  makeElement("extension-status-badge", "span");
  makeElement("ext-version", "span");
  makeElement("ext-env", "span");
  makeElement("ext-platforms-list", "div");
  makeElement("toggle-auto-import", "input");
  makeElement("toggle-bg-sync", "input");

  // Billing Elements
  makeElement("billing-status-badge", "span");
  makeElement("billing-plan-name", "h3");
  makeElement("billing-period-info", "p");
  makeElement("billing-trial-info", "div");
  makeElement("btn-settings-portal", "button");
  makeElement("link-settings-upgrade", "a");

  // Modal Elements
  makeElement("confirmation-modal", "div");
  makeElement("modal-title", "h3");
  makeElement("modal-msg", "p");
  makeElement("modal-close-btn", "button");
  makeElement("modal-cancel-btn", "button");
  makeElement("modal-confirm-btn", "button");

  // Toast
  makeElement("toast-container", "div");
  makeElement("toast-msg", "span");

  const windowListeners = {};
  const mockLocation = {
    hash: "#profile",
    href: "http://localhost/settings.html#profile",
    assignCalls: [],
    assign(url) {
      this.assignCalls.push(url);
    },
  };

  const mockWindow = {
    location: mockLocation,
    history: {
      replaceState: (state, title, url) => {
        if (url && url.startsWith("#")) {
          mockLocation.hash = url;
        }
      },
    },
    addEventListener: (evt, fn) => {
      if (!windowListeners[evt]) {
        windowListeners[evt] = [];
      }
      windowListeners[evt].push(fn);
    },
    fetch: fetchHandler,
  };

  const mockDocument = {
    getElementById: (id) => elements[id] || null,
    querySelectorAll: (selector) => {
      if (selector === ".settings-tab-btn") {
        return tabsList;
      }
      return [];
    },
    querySelector: (selector) => querySelectors[selector] || null,
    createElement: (tag) => {
      const created = makeElement(`created-${Math.random()}`, tag);
      return created;
    },
    body: {
      appendChild: () => {},
    },
  };

  function executeController() {
    const scriptCode = fs.readFileSync(path.join(__dirname, "settings.js"), "utf-8");
    const runFn = new Function(
      "window",
      "document",
      "fetch",
      "AbortController",
      "URL",
      "setTimeout",
      scriptCode,
    );

    runFn(mockWindow, mockDocument, mockWindow.fetch, AbortController, URL, (fn) => fn());
    return mockWindow.__settingsController;
  }

  return {
    elements,
    querySelectors,
    eventListeners,
    windowListeners,
    window: mockWindow,
    document: mockDocument,
    executeController,
  };
}

// =====================================================================
// Phase 11G: Settings UI Test Suite
// =====================================================================

test("Phase 11G: Settings UI Suite", async (t) => {
  await t.test("1. Settings page semantic markup in settings.html", () => {
    assert.ok(settingsHtml.includes('id="settings-main-container"'));
    assert.ok(settingsHtml.includes('role="tablist"'));
    assert.ok(settingsHtml.includes('id="tab-profile"'));
    assert.ok(settingsHtml.includes('id="tab-security"'));
    assert.ok(settingsHtml.includes('id="tab-data"'));
    assert.ok(settingsHtml.includes('id="tab-extension"'));
    assert.ok(settingsHtml.includes('id="tab-billing"'));
    assert.ok(settingsHtml.includes('id="panel-profile"'));
    assert.ok(settingsHtml.includes('id="panel-security"'));
    assert.ok(settingsHtml.includes('id="panel-data"'));
    assert.ok(settingsHtml.includes('id="panel-extension"'));
    assert.ok(settingsHtml.includes('id="panel-billing"'));
    assert.ok(settingsHtml.includes('id="confirmation-modal"'));
    assert.ok(settingsHtml.includes('id="toast-container"'));
  });

  await t.test("2. Initial loading skeleton state", () => {
    const env = createMockEnvironment(async () => new Promise(() => {}));
    env.executeController();

    assert.strictEqual(env.elements["settings-skeleton"].classList.contains("hidden"), false);
    assert.strictEqual(env.elements["settings-content"].classList.contains("hidden"), true);
    assert.strictEqual(env.elements["settings-error"].classList.contains("hidden"), true);
  });

  await t.test("3. 401 Unauthorized redirects to /login.html", async () => {
    const fetchMock = async () => ({ status: 401, ok: false });
    const env = createMockEnvironment(fetchMock);
    env.executeController();

    await new Promise((resolve) => setTimeout(resolve, 20));

    assert.ok(env.window.location.assignCalls.length >= 1);
    assert.strictEqual(env.window.location.assignCalls.includes("/login.html"), true);
  });

  await t.test("4. Hash routing and tab switching", async () => {
    const fetchMock = async (url) => {
      if (url.includes("/api/settings/profile")) {
        return { status: 200, ok: true, json: async () => mockProfile };
      }
      if (url.includes("/api/settings/security/sessions")) {
        return { status: 200, ok: true, json: async () => mockSessions };
      }
      if (url.includes("/api/settings/extension")) {
        return { status: 200, ok: true, json: async () => mockExtension };
      }
      if (url.includes("/api/billing/subscription")) {
        return { status: 200, ok: true, json: async () => mockSubscription };
      }
      return { status: 200, ok: true, json: async () => ({}) };
    };

    const env = createMockEnvironment(fetchMock);
    env.window.location.hash = "#security";
    const ctrl = env.executeController();

    await new Promise((resolve) => setTimeout(resolve, 20));

    // Security tab active
    assert.strictEqual(env.elements["tab-security"].classList.contains("active"), true);
    assert.strictEqual(env.elements["tab-security"].getAttribute("aria-selected"), "true");
    assert.strictEqual(env.elements["panel-security"].classList.contains("active"), true);

    // Switch to data tab
    ctrl.switchTab("data", true);
    assert.strictEqual(env.elements["tab-data"].classList.contains("active"), true);
    assert.strictEqual(env.elements["tab-data"].getAttribute("aria-selected"), "true");
    assert.strictEqual(env.elements["panel-data"].classList.contains("active"), true);
    assert.strictEqual(env.window.location.hash, "#data");
  });

  await t.test("5. Profile loading and rendering", async () => {
    const fetchMock = async (url) => {
      if (url.includes("/api/settings/profile")) {
        return { status: 200, ok: true, json: async () => mockProfile };
      }
      if (url.includes("/api/settings/security/sessions")) {
        return { status: 200, ok: true, json: async () => mockSessions };
      }
      if (url.includes("/api/settings/extension")) {
        return { status: 200, ok: true, json: async () => mockExtension };
      }
      if (url.includes("/api/billing/subscription")) {
        return { status: 200, ok: true, json: async () => mockSubscription };
      }
      return { status: 200, ok: true, json: async () => ({}) };
    };

    const env = createMockEnvironment(fetchMock);
    env.executeController();
    await new Promise((resolve) => setTimeout(resolve, 20));

    assert.strictEqual(env.elements["settings-skeleton"].classList.contains("hidden"), true);
    assert.strictEqual(env.elements["settings-content"].classList.contains("hidden"), false);
    assert.strictEqual(env.elements["profile-email"].value, "tyagi@freelanceos.com");
    assert.strictEqual(env.elements["profile-user-id"].value, "user-12345");
    assert.strictEqual(env.elements["profile-status-badge"].textContent, "ACTIVE");
  });

  await t.test("6. Password validation rejects short passwords and mismatches", async () => {
    const env = createMockEnvironment(async () => ({
      status: 200,
      ok: true,
      json: async () => mockProfile,
    }));
    const ctrl = env.executeController();

    // 1. Missing current password
    env.elements["current-password"].value = "";
    env.elements["new-password"].value = "short";
    env.elements["confirm-password"].value = "short";
    await ctrl.handlePasswordChange({ preventDefault: () => {} });
    assert.strictEqual(
      env.elements["password-alert"].textContent,
      "Please enter your current password.",
    );

    // 2. Short new password (< 8 chars)
    env.elements["current-password"].value = "OldPassword123!";
    env.elements["new-password"].value = "short";
    env.elements["confirm-password"].value = "short";
    await ctrl.handlePasswordChange({ preventDefault: () => {} });
    assert.strictEqual(
      env.elements["password-alert"].textContent,
      "New password must be at least 8 characters long.",
    );

    // 3. Confirm password mismatch
    env.elements["new-password"].value = "StrongNewPassword123!";
    env.elements["confirm-password"].value = "DifferentPassword456!";
    await ctrl.handlePasswordChange({ preventDefault: () => {} });
    assert.strictEqual(env.elements["password-alert"].textContent, "New passwords do not match.");
  });

  await t.test("7. Password change submission handles API failure & success", async () => {
    let passwordCallPayload = null;
    const fetchMock = async (url, opts) => {
      if (url === "/api/settings/security/password") {
        passwordCallPayload = JSON.parse(opts.body);
        if (passwordCallPayload.currentPassword === "WrongPassword!") {
          return {
            status: 400,
            ok: false,
            json: async () => ({ success: false, error: "Incorrect current password." }),
          };
        }
        return {
          status: 200,
          ok: true,
          json: async () => ({ success: true, message: "Password updated successfully." }),
        };
      }
      return { status: 200, ok: true, json: async () => ({}) };
    };

    const env = createMockEnvironment(fetchMock);
    const ctrl = env.executeController();

    // Test incorrect password
    env.elements["current-password"].value = "WrongPassword!";
    env.elements["new-password"].value = "ValidNewPassword123!";
    env.elements["confirm-password"].value = "ValidNewPassword123!";
    await ctrl.handlePasswordChange({ preventDefault: () => {} });
    assert.strictEqual(env.elements["password-alert"].textContent, "Incorrect current password.");

    // Test successful update
    env.elements["current-password"].value = "CorrectOldPassword123!";
    await ctrl.handlePasswordChange({ preventDefault: () => {} });
    assert.strictEqual(
      env.elements["password-alert"].textContent,
      "Password updated successfully.",
    );
    assert.strictEqual(passwordCallPayload.newPassword, "ValidNewPassword123!");
  });

  await t.test("8. Active sessions rendering and current session identification", async () => {
    const fetchMock = async (url) => {
      if (url.includes("/api/settings/security/sessions")) {
        return { status: 200, ok: true, json: async () => mockSessions };
      }
      if (url.includes("/api/settings/profile")) {
        return { status: 200, ok: true, json: async () => mockProfile };
      }
      return { status: 200, ok: true, json: async () => ({}) };
    };

    const env = createMockEnvironment(fetchMock);
    env.executeController();
    await new Promise((resolve) => setTimeout(resolve, 20));

    assert.strictEqual(env.elements["sessions-list"].children.length, 2);
    // First session is current
    assert.strictEqual(
      env.elements["sessions-list"].children[0].classList.contains("session-item-current"),
      true,
    );
    // Second session has revoke button
    const otherSession = env.elements["sessions-list"].children[1];
    assert.strictEqual(otherSession.classList.contains("session-item-current"), false);
  });

  await t.test("9. Revoke single session and revoke all other sessions", async () => {
    let singleRevokeId = null;
    let revokeAllCalled = false;

    const fetchMock = async (url, opts) => {
      if (
        url.includes("/api/settings/security/sessions/session-other-2") &&
        opts.method === "DELETE"
      ) {
        singleRevokeId = "session-other-2";
        return {
          status: 200,
          ok: true,
          json: async () => ({ success: true, message: "Session revoked successfully." }),
        };
      }
      if (url === "/api/settings/security/sessions" && opts.method === "DELETE") {
        revokeAllCalled = true;
        return {
          status: 200,
          ok: true,
          json: async () => ({ success: true, message: "All other sessions revoked." }),
        };
      }
      if (url.includes("/api/settings/security/sessions")) {
        return { status: 200, ok: true, json: async () => mockSessions };
      }
      return { status: 200, ok: true, json: async () => ({}) };
    };

    const env = createMockEnvironment(fetchMock);
    const ctrl = env.executeController();

    // Trigger single revocation
    await ctrl.revokeSingleSession("session-other-2", env.document.createElement("button"));
    assert.strictEqual(singleRevokeId, "session-other-2");

    // Trigger revoke all other sessions
    await ctrl.revokeAllOtherSessions();
    assert.strictEqual(revokeAllCalled, true);
  });

  await t.test("10. Data export trigger", async () => {
    let exportCalled = false;
    const fetchMock = async (url) => {
      if (url === "/api/settings/data/export") {
        exportCalled = true;
        return {
          status: 200,
          ok: true,
          json: async () => ({
            success: true,
            export: {
              version: "1.0.0",
              tenantId: "tenant_user-12345",
              clients: [{ id: "c1" }],
              jobs: [{ id: "j1" }],
              matches: [{ id: "m1" }],
              timeline: [],
              brainAnalyses: [],
            },
          }),
        };
      }
      return { status: 200, ok: true, json: async () => ({}) };
    };

    const env = createMockEnvironment(fetchMock);
    const ctrl = env.executeController();

    await ctrl.handleDataExport();
    assert.strictEqual(exportCalled, true);
    assert.strictEqual(
      env.elements["toast-msg"].textContent,
      "Data export downloaded successfully.",
    );
  });

  await t.test("11. Extension settings rendering", async () => {
    const fetchMock = async (url) => {
      if (url.includes("/api/settings/extension")) {
        return { status: 200, ok: true, json: async () => mockExtension };
      }
      return { status: 200, ok: true, json: async () => ({}) };
    };

    const env = createMockEnvironment(fetchMock);
    env.executeController();
    await new Promise((resolve) => setTimeout(resolve, 20));

    assert.strictEqual(env.elements["extension-status-badge"].textContent, "Ready to Connect");
    assert.strictEqual(env.elements["ext-version"].textContent, "FreelanceOS Job Matcher v0.1.0");
  });

  await t.test("12. Billing quick-settings rendering and portal action", async () => {
    const fetchMock = async (url) => {
      if (url.includes("/api/billing/subscription")) {
        return { status: 200, ok: true, json: async () => mockSubscription };
      }
      if (url === "/api/billing/portal") {
        return {
          status: 200,
          ok: true,
          json: async () => ({
            success: true,
            portalUrl: "https://billing.stripe.com/p/session/123",
          }),
        };
      }
      return { status: 200, ok: true, json: async () => ({}) };
    };

    const env = createMockEnvironment(fetchMock);
    const ctrl = env.executeController();
    await new Promise((resolve) => setTimeout(resolve, 20));

    assert.strictEqual(env.elements["billing-plan-name"].textContent, "Pro Plan");
    assert.strictEqual(env.elements["billing-status-badge"].textContent, "Active");
    assert.strictEqual(env.elements["btn-settings-portal"].classList.contains("hidden"), false);

    // Click portal button
    await ctrl.handlePortalOpen();
    assert.strictEqual(
      env.window.location.assignCalls.includes("https://billing.stripe.com/p/session/123"),
      true,
    );
  });

  await t.test("13. Safe XSS rendering of profile and session data", async () => {
    const maliciousProfile = {
      success: true,
      profile: {
        userId: "<script>alert('xss-user')</script>",
        email: "<img src=x onerror=alert(1)>",
        status: "active",
        createdAt: "2026-08-01",
      },
    };

    const fetchMock = async (url) => {
      if (url.includes("/api/settings/profile")) {
        return { status: 200, ok: true, json: async () => maliciousProfile };
      }
      return { status: 200, ok: true, json: async () => ({}) };
    };

    const env = createMockEnvironment(fetchMock);
    env.executeController();
    await new Promise((resolve) => setTimeout(resolve, 20));

    assert.strictEqual(env.elements["profile-email"].value, "<img src=x onerror=alert(1)>");
    assert.strictEqual(env.elements["profile-user-id"].value, "<script>alert('xss-user')</script>");
  });

  await t.test("14. URL helper and external URL validation", () => {
    const env = createMockEnvironment(async () => ({}));
    const ctrl = env.executeController();

    assert.strictEqual(ctrl.isSafeExternalUrl("https://billing.stripe.com/p/session/123"), true);
    assert.strictEqual(ctrl.isSafeExternalUrl("http://localhost:4000/settings.html"), true);
    assert.strictEqual(ctrl.isSafeExternalUrl("javascript:alert(1)"), false);
    assert.strictEqual(ctrl.isSafeExternalUrl("data:text/html,..."), false);
    assert.strictEqual(ctrl.isSafeExternalUrl("http://evil.com"), false);
    assert.strictEqual(ctrl.isSafeExternalUrl("//evil.com"), false);
    assert.strictEqual(ctrl.isSafeExternalUrl(null), false);
    assert.strictEqual(ctrl.isSafeExternalUrl(""), false);
  });
});
