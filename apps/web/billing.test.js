import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read billing.js and billing.html source content
const billingJsContent = fs.readFileSync(path.join(__dirname, "billing.js"), "utf8");
const billingHtmlContent = fs.readFileSync(path.join(__dirname, "billing.html"), "utf8");

// Helper to construct a mock DOM element
function createMockElement(id, tag = "div", classes = []) {
  const listeners = {};
  const element = {
    id,
    tagName: tag.toUpperCase(),
    className: classes.join(" "),
    classList: {
      classes: [...classes],
      add(c) {
        if (!this.classes.includes(c)) {
          this.classes.push(c);
        }
        element.className = this.classes.join(" ");
      },
      remove(c) {
        const idx = this.classes.indexOf(c);
        if (idx !== -1) {
          this.classes.splice(idx, 1);
        }
        element.className = this.classes.join(" ");
      },
      toggle(c, force) {
        const has = this.classes.includes(c);
        const shouldHave = force !== undefined ? force : !has;
        if (shouldHave) {
          this.add(c);
        } else {
          this.remove(c);
        }
      },
      contains(c) {
        return this.classes.includes(c);
      },
    },
    textContent: "",
    _innerHTML: "",
    get innerHTML() {
      return this._innerHTML;
    },
    set innerHTML(val) {
      this._innerHTML = val;
      if (val === "") {
        this.children = [];
      }
    },
    style: {
      width: "",
      display: "",
    },
    disabled: false,
    attributes: {},
    setAttribute(name, val) {
      this.attributes[name] = String(val);
    },
    getAttribute(name) {
      return this.attributes[name];
    },
    addEventListener(event, cb) {
      listeners[event] = listeners[event] || [];
      listeners[event].push(cb);
    },
    trigger(event, data) {
      if (listeners[event]) {
        listeners[event].forEach((cb) => cb(data));
      }
    },
    click() {
      this.trigger("click", {
        preventDefault: () => {},
        currentTarget: this,
        target: this,
      });
    },
    appendChild(child) {
      this.children.push(child);
    },
    children: [],
  };
  return element;
}

// Function to construct a fresh Mock Browser Environment
function createMockEnvironment(fetchMock) {
  const elements = {};
  const querySelectors = {};

  const ids = [
    "sidebar",
    "sidebar-toggle",
    "mobile-drawer-toggle",
    "drawer-overlay",
    "sidebar-logout-btn",
    "user-avatar-initials",
    "currency-selector",
    "main-content",
    "billing-toast",
    "billing-toast-msg",
    "billing-skeleton",
    "billing-error",
    "billing-error-msg",
    "billing-error-retry",
    "billing-content",
    "billing-current-card",
    "current-plan-name",
    "current-plan-status-badge",
    "current-trial-badge",
    "current-plan-period",
    "billing-portal-btn",
    "meter-ai-proposals",
    "usage-proposals-val",
    "usage-proposals-progress",
    "usage-proposals-bar",
    "meter-job-scans",
    "usage-scans-val",
    "usage-scans-progress",
    "usage-scans-bar",
    "meter-workspaces",
    "usage-workspaces-val",
    "usage-workspaces-progress",
    "usage-workspaces-bar",
    "billing-plans-grid",
    "plan-card-STARTER",
    "btn-plan-starter",
    "plan-card-PRO",
    "btn-upgrade-pro",
    "plan-card-POWER_BIDDER",
    "btn-upgrade-power-bidder",
  ];

  ids.forEach((id) => {
    const classes = [];
    if (id === "billing-toast" || id === "billing-error" || id === "billing-content") {
      classes.push("hidden");
    }
    if (id === "current-trial-badge" || id === "billing-portal-btn") {
      classes.push("hidden");
    }
    elements[id] = createMockElement(id, "div", classes);
  });

  // Query selector mappings
  querySelectors['[data-plan-price="STARTER"]'] = createMockElement(
    "plan-price-starter",
    "span",
    [],
  );
  querySelectors['[data-plan-price="PRO"]'] = createMockElement("plan-price-pro", "span", []);
  querySelectors['[data-plan-price="POWER_BIDDER"]'] = createMockElement(
    "plan-price-power-bidder",
    "span",
    [],
  );

  const documentMock = {
    getElementById(id) {
      return elements[id] || null;
    },
    querySelector(selector) {
      return querySelectors[selector] || null;
    },
    querySelectorAll() {
      return [];
    },
    createElement(tag) {
      return createMockElement("", tag);
    },
    title: "Billing & Plans — FreelanceOS",
  };

  const windowMock = {
    location: {
      pathname: "/billing.html",
      search: "",
      assignUrl: null,
      assign(url) {
        this.assignUrl = url;
      },
    },
    history: {
      replaceState: () => {},
    },
    addEventListener: () => {},
    document: documentMock,
    fetch: fetchMock,
    __billingController: null,
  };

  return {
    document: documentMock,
    window: windowMock,
    elements,
    querySelectors,
    executeController() {
      const fn = new Function("window", "document", "fetch", billingJsContent);
      fn(windowMock, documentMock, fetchMock);
      return windowMock.__billingController;
    },
  };
}

// Sample mock data fixtures
const mockPlans = [
  {
    planId: "STARTER",
    code: "starter_monthly",
    name: "Starter Plan",
    description: "Essential features for freelancers starting out.",
    lifecycleState: "ACTIVE",
    features: ["JOB_SCAN", "AI_PROPOSAL", "UPWORK", "LINKEDIN", "BASIC_MATCHING"],
    limits: {
      jobScans: { type: "LIMITED", value: 5 },
      aiProposals: { type: "LIMITED", value: 3 },
      maxWorkspaces: { type: "LIMITED", value: 1 },
    },
    prices: [
      {
        region: "GLOBAL",
        currency: "USD",
        amountMinor: 0,
        formatted: "Free",
        interval: "MONTHLY",
        version: 1,
      },
      {
        region: "INDIA",
        currency: "INR",
        amountMinor: 0,
        formatted: "Free",
        interval: "MONTHLY",
        version: 1,
      },
    ],
    billingInterval: "MONTHLY",
  },
  {
    planId: "PRO",
    code: "pro_monthly_v1",
    name: "Pro Plan",
    description: "Advanced matching, full explanations, and higher proposal limits.",
    lifecycleState: "ACTIVE",
    features: [
      "JOB_SCAN",
      "AI_PROPOSAL",
      "UPWORK",
      "LINKEDIN",
      "BASIC_MATCHING",
      "ADVANCED_MATCHING",
      "PRIORITY_WEIGHT_SCORING",
      "FULL_MATCH_EXPLANATION",
    ],
    limits: {
      jobScans: { type: "UNLIMITED" },
      aiProposals: { type: "LIMITED", value: 50 },
      maxWorkspaces: { type: "LIMITED", value: 1 },
    },
    prices: [
      {
        region: "GLOBAL",
        currency: "USD",
        amountMinor: 1499,
        formatted: "$14.99",
        interval: "MONTHLY",
        version: 1,
      },
      {
        region: "INDIA",
        currency: "INR",
        amountMinor: 79900,
        formatted: "₹799",
        interval: "MONTHLY",
        version: 1,
      },
    ],
    billingInterval: "MONTHLY",
  },
  {
    planId: "POWER_BIDDER",
    code: "power_bidder_monthly_v1",
    name: "Power Bidder Plan",
    description: "High-volume bidding across multiple workspaces with priority generation.",
    lifecycleState: "ACTIVE",
    features: [
      "JOB_SCAN",
      "AI_PROPOSAL",
      "UPWORK",
      "LINKEDIN",
      "BASIC_MATCHING",
      "ADVANCED_MATCHING",
      "PRIORITY_WEIGHT_SCORING",
      "FULL_MATCH_EXPLANATION",
      "PRIORITY_AI_GENERATION",
      "MULTI_WORKSPACE",
    ],
    limits: {
      jobScans: { type: "UNLIMITED" },
      aiProposals: { type: "LIMITED", value: 200 },
      maxWorkspaces: { type: "UNLIMITED" },
    },
    prices: [
      {
        region: "GLOBAL",
        currency: "USD",
        amountMinor: 3999,
        formatted: "$39.99",
        interval: "MONTHLY",
        version: 1,
      },
      {
        region: "INDIA",
        currency: "INR",
        amountMinor: 299900,
        formatted: "₹2,999",
        interval: "MONTHLY",
        version: 1,
      },
    ],
    billingInterval: "MONTHLY",
  },
];

const mockStarterSubscription = {
  success: true,
  planId: "STARTER",
  planName: "Starter Plan",
  source: "STARTER",
  status: "free",
  billingInterval: "MONTHLY",
  period: {
    type: "CALENDAR_MONTH",
    startedAt: "2026-08-01T00:00:00.000Z",
    endsAt: "2026-09-01T00:00:00.000Z",
  },
  trialDaysRemaining: null,
  limits: {
    jobScans: { type: "LIMITED", value: 5 },
    aiProposals: { type: "LIMITED", value: 3 },
    maxWorkspaces: { type: "LIMITED", value: 1 },
  },
  usage: {
    jobScans: 2,
    aiProposals: 1,
  },
  hasCustomer: false,
};

const mockTrialSubscription = {
  success: true,
  planId: "PRO",
  planName: "Pro Plan",
  source: "TRIAL",
  status: "trialing",
  billingInterval: "MONTHLY",
  period: {
    type: "TRIAL_DURATION",
    startedAt: "2026-08-15T00:00:00.000Z",
    endsAt: "2026-08-22T00:00:00.000Z",
  },
  trialDaysRemaining: 5,
  limits: {
    jobScans: { type: "UNLIMITED" },
    aiProposals: { type: "LIMITED", value: 50 },
    maxWorkspaces: { type: "LIMITED", value: 1 },
  },
  usage: {
    jobScans: 12,
    aiProposals: 8,
  },
  hasCustomer: false,
};

const mockPaidSubscription = {
  success: true,
  planId: "PRO",
  planName: "Pro Plan",
  source: "SUBSCRIPTION",
  status: "active",
  billingInterval: "MONTHLY",
  period: {
    type: "BILLING_CYCLE",
    startedAt: "2026-08-10T00:00:00.000Z",
    endsAt: "2026-09-10T00:00:00.000Z",
  },
  trialDaysRemaining: null,
  limits: {
    jobScans: { type: "UNLIMITED" },
    aiProposals: { type: "LIMITED", value: 50 },
    maxWorkspaces: { type: "LIMITED", value: 1 },
  },
  usage: {
    jobScans: 45,
    aiProposals: 22,
  },
  hasCustomer: true,
};

// =====================================================================
// Phase 11F Billing UI Unit Tests
// =====================================================================

test("Phase 11F: Billing UI Suite", async (t) => {
  await t.test("1. Billing page semantic markup in billing.html", () => {
    assert.match(billingHtmlContent, /<aside\s+id="sidebar"/);
    assert.match(billingHtmlContent, /<header\s+class="topbar"/);
    assert.match(billingHtmlContent, /<main\s+id="main-content"/);
    assert.match(billingHtmlContent, /id="billing-current-card"/);
    assert.match(billingHtmlContent, /id="billing-plans-grid"/);
    assert.match(billingHtmlContent, /id="billing-skeleton"/);
    assert.match(billingHtmlContent, /id="billing-error"/);
    assert.match(billingHtmlContent, /id="currency-selector"/);
  });

  await t.test("2. Initial loading skeleton state", () => {
    const fetchMock = async () => new Promise(() => {}); // Never resolves
    const env = createMockEnvironment(fetchMock);
    env.executeController();

    assert.strictEqual(env.elements["billing-skeleton"].classList.contains("hidden"), false);
    assert.strictEqual(env.elements["billing-content"].classList.contains("hidden"), true);
    assert.strictEqual(env.elements["billing-error"].classList.contains("hidden"), true);
  });

  await t.test("3. 401 Unauthorized redirects to /login.html", async () => {
    const fetchMock = async (url) => {
      if (url.includes("/api/billing/subscription") || url.includes("/api/session")) {
        return { status: 401, ok: false, json: async () => ({ error: "Unauthorized" }) };
      }
      return { status: 200, ok: true, json: async () => ({ success: true, plans: mockPlans }) };
    };
    const env = createMockEnvironment(fetchMock);
    env.executeController();

    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.strictEqual(env.window.location.assignUrl, "/login.html");
  });

  await t.test("4. Successful plans and starter subscription rendering", async () => {
    const fetchMock = async (url) => {
      if (url.includes("/api/session")) {
        return {
          status: 200,
          ok: true,
          json: async () => ({ success: true, user: { email: "tyagi@example.com" } }),
        };
      }
      if (url.includes("/api/billing/plans")) {
        return { status: 200, ok: true, json: async () => ({ success: true, plans: mockPlans }) };
      }
      if (url.includes("/api/billing/subscription")) {
        return { status: 200, ok: true, json: async () => mockStarterSubscription };
      }
      throw new Error(`Unhandled mock fetch: ${url}`);
    };

    const env = createMockEnvironment(fetchMock);
    env.executeController();

    await new Promise((resolve) => setTimeout(resolve, 20));

    assert.strictEqual(env.elements["billing-skeleton"].classList.contains("hidden"), true);
    assert.strictEqual(env.elements["billing-content"].classList.contains("hidden"), false);
    assert.strictEqual(env.elements["current-plan-name"].textContent, "Starter Plan");
    assert.strictEqual(env.elements["current-plan-status-badge"].textContent, "Free");
    assert.strictEqual(env.elements["current-trial-badge"].classList.contains("hidden"), true);
    assert.strictEqual(env.elements["billing-portal-btn"].classList.contains("hidden"), true);

    // Usage meters
    assert.strictEqual(env.elements["usage-proposals-val"].textContent, "1 / 3");
    assert.strictEqual(env.elements["usage-scans-val"].textContent, "2 / 5");

    // Plan prices
    assert.strictEqual(env.querySelectors['[data-plan-price="STARTER"]'].textContent, "Free");
    assert.strictEqual(env.querySelectors['[data-plan-price="PRO"]'].textContent, "$14.99");
    assert.strictEqual(
      env.querySelectors['[data-plan-price="POWER_BIDDER"]'].textContent,
      "$39.99",
    );

    // Current plan card buttons
    assert.strictEqual(env.elements["btn-plan-starter"].disabled, true);
    assert.strictEqual(env.elements["btn-upgrade-pro"].disabled, false);
    assert.strictEqual(env.elements["btn-upgrade-power-bidder"].disabled, false);
  });

  await t.test("5. Trial subscription rendering and countdown badge", async () => {
    const fetchMock = async (url) => {
      if (url.includes("/api/session")) {
        return {
          status: 200,
          ok: true,
          json: async () => ({ success: true, user: { email: "user@example.com" } }),
        };
      }
      if (url.includes("/api/billing/plans")) {
        return { status: 200, ok: true, json: async () => ({ success: true, plans: mockPlans }) };
      }
      if (url.includes("/api/billing/subscription")) {
        return { status: 200, ok: true, json: async () => mockTrialSubscription };
      }
      throw new Error(`Unhandled url: ${url}`);
    };

    const env = createMockEnvironment(fetchMock);
    env.executeController();

    await new Promise((resolve) => setTimeout(resolve, 20));

    assert.strictEqual(env.elements["current-plan-name"].textContent, "Pro Plan");
    assert.strictEqual(env.elements["current-plan-status-badge"].textContent, "Trial");
    assert.strictEqual(env.elements["current-trial-badge"].classList.contains("hidden"), false);
    assert.strictEqual(env.elements["current-trial-badge"].textContent, "5 days left in trial");

    // Unlimited scans meter
    assert.strictEqual(env.elements["usage-scans-val"].textContent, "12 (Unlimited)");
    assert.strictEqual(env.elements["usage-proposals-val"].textContent, "8 / 50");
  });

  await t.test("6. Paid active subscription rendering and portal button", async () => {
    const fetchMock = async (url) => {
      if (url.includes("/api/session")) {
        return {
          status: 200,
          ok: true,
          json: async () => ({ success: true, user: { email: "user@example.com" } }),
        };
      }
      if (url.includes("/api/billing/plans")) {
        return { status: 200, ok: true, json: async () => ({ success: true, plans: mockPlans }) };
      }
      if (url.includes("/api/billing/subscription")) {
        return { status: 200, ok: true, json: async () => mockPaidSubscription };
      }
      throw new Error(`Unhandled url: ${url}`);
    };

    const env = createMockEnvironment(fetchMock);
    env.executeController();

    await new Promise((resolve) => setTimeout(resolve, 20));

    assert.strictEqual(env.elements["current-plan-status-badge"].textContent, "Active");
    assert.strictEqual(env.elements["billing-portal-btn"].classList.contains("hidden"), false);
    assert.strictEqual(env.elements["btn-upgrade-pro"].disabled, true);
    assert.strictEqual(env.elements["btn-upgrade-pro"].textContent, "Current Plan");
  });

  await t.test("7. Currency selector dynamically updates prices", async () => {
    const fetchMock = async (url) => {
      if (url.includes("/api/billing/plans")) {
        return { status: 200, ok: true, json: async () => ({ success: true, plans: mockPlans }) };
      }
      return { status: 200, ok: true, json: async () => mockStarterSubscription };
    };

    const env = createMockEnvironment(fetchMock);
    env.executeController();

    await new Promise((resolve) => setTimeout(resolve, 20));

    assert.strictEqual(env.querySelectors['[data-plan-price="PRO"]'].textContent, "$14.99");

    // Change currency to INR
    env.elements["currency-selector"].trigger("change", { target: { value: "INR" } });

    assert.strictEqual(env.querySelectors['[data-plan-price="PRO"]'].textContent, "₹799");
    assert.strictEqual(
      env.querySelectors['[data-plan-price="POWER_BIDDER"]'].textContent,
      "₹2,999",
    );
  });

  await t.test("8. Upgrade checkout action triggers Stripe checkout redirect", async () => {
    let checkoutPayload = null;
    const fetchMock = async (url, opts) => {
      if (url === "/api/billing/checkout") {
        checkoutPayload = JSON.parse(opts.body);
        return {
          status: 200,
          ok: true,
          json: async () => ({
            success: true,
            sessionId: "cs_test_123",
            checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test_123",
          }),
        };
      }
      if (url.includes("/api/billing/plans")) {
        return { status: 200, ok: true, json: async () => ({ success: true, plans: mockPlans }) };
      }
      return { status: 200, ok: true, json: async () => mockStarterSubscription };
    };

    const env = createMockEnvironment(fetchMock);
    env.executeController();
    await new Promise((resolve) => setTimeout(resolve, 20));

    // Click Upgrade to Pro
    env.elements["btn-upgrade-pro"].click();
    await new Promise((resolve) => setTimeout(resolve, 20));

    assert.deepStrictEqual(checkoutPayload, { planId: "PRO", version: 1 });
    assert.strictEqual(
      env.window.location.assignUrl,
      "https://checkout.stripe.com/c/pay/cs_test_123",
    );
  });

  await t.test("9. Unsafe checkout URL rejection", async () => {
    const fetchMock = async (url) => {
      if (url === "/api/billing/checkout") {
        return {
          status: 200,
          ok: true,
          json: async () => ({
            success: true,
            sessionId: "cs_bad",
            checkoutUrl: "javascript:alert(1)",
          }),
        };
      }
      if (url.includes("/api/billing/plans")) {
        return { status: 200, ok: true, json: async () => ({ success: true, plans: mockPlans }) };
      }
      return { status: 200, ok: true, json: async () => mockStarterSubscription };
    };

    const env = createMockEnvironment(fetchMock);
    env.executeController();
    await new Promise((resolve) => setTimeout(resolve, 20));

    env.elements["btn-upgrade-pro"].click();
    await new Promise((resolve) => setTimeout(resolve, 20));

    // Should NOT have assigned javascript URL
    assert.notStrictEqual(env.window.location.assignUrl, "javascript:alert(1)");
    assert.match(env.elements["billing-toast-msg"].textContent, /insecure or invalid/i);
  });

  await t.test("10. Customer portal action triggers Stripe Portal redirect", async () => {
    const fetchMock = async (url) => {
      if (url === "/api/billing/portal") {
        return {
          status: 200,
          ok: true,
          json: async () => ({
            success: true,
            portalUrl: "https://billing.stripe.com/p/session/portal_123",
          }),
        };
      }
      if (url.includes("/api/billing/plans")) {
        return { status: 200, ok: true, json: async () => ({ success: true, plans: mockPlans }) };
      }
      return { status: 200, ok: true, json: async () => mockPaidSubscription };
    };

    const env = createMockEnvironment(fetchMock);
    env.executeController();
    await new Promise((resolve) => setTimeout(resolve, 20));

    env.elements["billing-portal-btn"].click();
    await new Promise((resolve) => setTimeout(resolve, 20));

    assert.strictEqual(
      env.window.location.assignUrl,
      "https://billing.stripe.com/p/session/portal_123",
    );
  });

  await t.test("11. Unsafe portal URL rejection", async () => {
    const fetchMock = async (url) => {
      if (url === "/api/billing/portal") {
        return {
          status: 200,
          ok: true,
          json: async () => ({
            success: true,
            portalUrl: "data:text/html,<script>alert(1)</script>",
          }),
        };
      }
      if (url.includes("/api/billing/plans")) {
        return { status: 200, ok: true, json: async () => ({ success: true, plans: mockPlans }) };
      }
      return { status: 200, ok: true, json: async () => mockPaidSubscription };
    };

    const env = createMockEnvironment(fetchMock);
    env.executeController();
    await new Promise((resolve) => setTimeout(resolve, 20));

    env.elements["billing-portal-btn"].click();
    await new Promise((resolve) => setTimeout(resolve, 20));

    assert.notStrictEqual(
      env.window.location.assignUrl,
      "data:text/html,<script>alert(1)</script>",
    );
    assert.match(env.elements["billing-toast-msg"].textContent, /insecure or invalid/i);
  });

  await t.test("12. Error state and retry action", async () => {
    let callCount = 0;
    const fetchMock = async (url) => {
      callCount++;
      if (callCount <= 2) {
        return { status: 500, ok: false, json: async () => ({ error: "Database error" }) };
      }
      if (url.includes("/api/billing/plans")) {
        return { status: 200, ok: true, json: async () => ({ success: true, plans: mockPlans }) };
      }
      return { status: 200, ok: true, json: async () => mockStarterSubscription };
    };

    const env = createMockEnvironment(fetchMock);
    env.executeController();
    await new Promise((resolve) => setTimeout(resolve, 20));

    assert.strictEqual(env.elements["billing-error"].classList.contains("hidden"), false);
    assert.strictEqual(env.elements["billing-content"].classList.contains("hidden"), true);

    // Click retry
    env.elements["billing-error-retry"].click();
    await new Promise((resolve) => setTimeout(resolve, 20));

    assert.strictEqual(env.elements["billing-error"].classList.contains("hidden"), true);
    assert.strictEqual(env.elements["billing-content"].classList.contains("hidden"), false);
  });

  await t.test("13. Safe XSS rendering of plan and subscription content", async () => {
    const maliciousPlans = [
      {
        planId: "PRO",
        code: "pro_v1",
        name: "<script>alert('xss')</script>",
        description: "<img src=x onerror=alert('xss')>",
        lifecycleState: "ACTIVE",
        features: ["<svg onload=alert(1)>"],
        limits: {
          jobScans: { type: "LIMITED", value: 50 },
          aiProposals: { type: "LIMITED", value: 10 },
          maxWorkspaces: { type: "LIMITED", value: 1 },
        },
        prices: [
          {
            region: "GLOBAL",
            currency: "USD",
            amountMinor: 1499,
            formatted: "<script>alert(1)</script>",
            interval: "MONTHLY",
            version: 1,
          },
        ],
      },
    ];

    const fetchMock = async (url) => {
      if (url.includes("/api/billing/plans")) {
        return {
          status: 200,
          ok: true,
          json: async () => ({ success: true, plans: maliciousPlans }),
        };
      }
      return {
        status: 200,
        ok: true,
        json: async () => ({
          ...mockStarterSubscription,
          planName: "<script>alert('plan')</script>",
        }),
      };
    };

    const env = createMockEnvironment(fetchMock);
    env.executeController();
    await new Promise((resolve) => setTimeout(resolve, 20));

    assert.strictEqual(
      env.elements["current-plan-name"].textContent,
      "<script>alert('plan')</script>",
    );
    assert.strictEqual(
      env.querySelectors['[data-plan-price="PRO"]'].textContent,
      "<script>alert(1)</script>",
    );
  });

  await t.test("14. URL helper and external URL validation", () => {
    const env = createMockEnvironment(async () => ({}));
    const ctrl = env.executeController();

    assert.strictEqual(ctrl.isSafeExternalUrl("https://checkout.stripe.com/pay/123"), true);
    assert.strictEqual(ctrl.isSafeExternalUrl("https://billing.stripe.com/session/456"), true);
    assert.strictEqual(ctrl.isSafeExternalUrl("http://localhost:3000/billing.html"), true);
    assert.strictEqual(ctrl.isSafeExternalUrl("javascript:alert(1)"), false);
    assert.strictEqual(ctrl.isSafeExternalUrl("data:text/html;base64,PHNjcmlwdD4="), false);
    assert.strictEqual(ctrl.isSafeExternalUrl("http://evil.com"), false);
    assert.strictEqual(ctrl.isSafeExternalUrl("//evil.example"), false);
    assert.strictEqual(ctrl.isSafeExternalUrl("\\\\evil.example"), false);
    assert.strictEqual(ctrl.isSafeExternalUrl("vbscript:alert(1)"), false);
    assert.strictEqual(ctrl.isSafeExternalUrl(""), false);
    assert.strictEqual(ctrl.isSafeExternalUrl(null), false);
    assert.strictEqual(ctrl.isSafeExternalUrl("https://"), false);
  });

  await t.test("15. Power Bidder Active subscription state rendering", async () => {
    const mockPowerBidderSub = {
      success: true,
      planId: "POWER_BIDDER",
      planName: "Power Bidder Plan",
      source: "SUBSCRIPTION",
      status: "active",
      billingInterval: "MONTHLY",
      period: {
        type: "BILLING_CYCLE",
        startedAt: "2026-08-01T00:00:00.000Z",
        endsAt: "2026-09-01T00:00:00.000Z",
      },
      trialDaysRemaining: null,
      limits: {
        jobScans: { type: "UNLIMITED" },
        aiProposals: { type: "LIMITED", value: 200 },
        maxWorkspaces: { type: "UNLIMITED" },
      },
      usage: {
        jobScans: 150,
        aiProposals: 89,
      },
      hasCustomer: true,
    };

    const fetchMock = async (url) => {
      if (url.includes("/api/billing/plans")) {
        return { status: 200, ok: true, json: async () => ({ success: true, plans: mockPlans }) };
      }
      return { status: 200, ok: true, json: async () => mockPowerBidderSub };
    };

    const env = createMockEnvironment(fetchMock);
    env.executeController();
    await new Promise((resolve) => setTimeout(resolve, 20));

    assert.strictEqual(env.elements["current-plan-name"].textContent, "Power Bidder Plan");
    assert.strictEqual(env.elements["current-plan-status-badge"].textContent, "Active");
    assert.strictEqual(env.elements["btn-upgrade-power-bidder"].disabled, true);
    assert.strictEqual(env.elements["btn-upgrade-power-bidder"].textContent, "Current Plan");
    assert.strictEqual(env.elements["btn-upgrade-pro"].disabled, true);
    assert.strictEqual(env.elements["btn-upgrade-pro"].textContent, "Pro Tier");
    assert.strictEqual(env.elements["usage-workspaces-val"].textContent, "Unlimited workspaces");
  });

  await t.test("16. Past Due and Canceled subscription status badges", async () => {
    const mockPastDueSub = {
      ...mockPaidSubscription,
      status: "past_due",
    };

    const fetchMock = async (url) => {
      if (url.includes("/api/billing/plans")) {
        return { status: 200, ok: true, json: async () => ({ success: true, plans: mockPlans }) };
      }
      return { status: 200, ok: true, json: async () => mockPastDueSub };
    };

    const env = createMockEnvironment(fetchMock);
    env.executeController();
    await new Promise((resolve) => setTimeout(resolve, 20));

    assert.strictEqual(env.elements["current-plan-status-badge"].textContent, "Past Due");

    // Test Canceled
    mockPastDueSub.status = "canceled";
    env.window.__billingController.renderSubscriptionAndUsage();
    assert.strictEqual(env.elements["current-plan-status-badge"].textContent, "Canceled");
  });

  await t.test("17. In-flight double-click protection on checkout and portal", async () => {
    let checkoutCalls = 0;
    let portalCalls = 0;

    const fetchMock = async (url) => {
      if (url === "/api/billing/checkout") {
        checkoutCalls++;
        await new Promise((r) => setTimeout(r, 50));
        return {
          status: 200,
          ok: true,
          json: async () => ({
            success: true,
            sessionId: "cs_123",
            checkoutUrl: "https://checkout.stripe.com/pay/123",
          }),
        };
      }
      if (url === "/api/billing/portal") {
        portalCalls++;
        await new Promise((r) => setTimeout(r, 50));
        return {
          status: 200,
          ok: true,
          json: async () => ({
            success: true,
            portalUrl: "https://billing.stripe.com/session/123",
          }),
        };
      }
      if (url.includes("/api/billing/plans")) {
        return { status: 200, ok: true, json: async () => ({ success: true, plans: mockPlans }) };
      }
      return { status: 200, ok: true, json: async () => mockPaidSubscription };
    };

    const env = createMockEnvironment(fetchMock);
    env.executeController();
    await new Promise((resolve) => setTimeout(resolve, 20));

    // Rapid double-clicks on checkout
    env.elements["btn-upgrade-power-bidder"].click();
    env.elements["btn-upgrade-power-bidder"].click();
    await new Promise((resolve) => setTimeout(resolve, 80));

    assert.strictEqual(checkoutCalls, 1);

    // Rapid double-clicks on portal
    env.elements["billing-portal-btn"].click();
    env.elements["billing-portal-btn"].click();
    await new Promise((resolve) => setTimeout(resolve, 80));

    assert.strictEqual(portalCalls, 1);
  });

  await t.test("18. Missing usage data fallback renders safely without error", async () => {
    const mockEmptyUsageSub = {
      success: true,
      planId: "STARTER",
      planName: "Starter Plan",
      source: "STARTER",
      status: "free",
      billingInterval: "MONTHLY",
      period: null,
      trialDaysRemaining: null,
      limits: null,
      usage: null,
      hasCustomer: false,
    };

    const fetchMock = async (url) => {
      if (url.includes("/api/billing/plans")) {
        return { status: 200, ok: true, json: async () => ({ success: true, plans: [] }) };
      }
      return { status: 200, ok: true, json: async () => mockEmptyUsageSub };
    };

    const env = createMockEnvironment(fetchMock);
    env.executeController();
    await new Promise((resolve) => setTimeout(resolve, 20));

    assert.strictEqual(env.elements["current-plan-name"].textContent, "Starter Plan");
    assert.strictEqual(env.elements["current-plan-status-badge"].textContent, "Free");
    assert.strictEqual(env.elements["current-plan-period"].textContent, "Active billing period");
  });
});
