import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const USER_DATA_DIR = "D:\\FreelanceAI\\apps\\web\\.chrome-user-data";
const SCREENSHOTS_DIR = "C:\\Users\\tyagi\\.gemini\\antigravity-cli\\brain\\c388a92e-f2c4-4fee-b7a9-f5d0dcbdc80f\\scratch\\screenshots";

fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

class BrowserSession {
  constructor(chromeProcess, ws) {
    this.chromeProcess = chromeProcess;
    this.ws = ws;
    this.messageId = 1;
    this.pending = new Map();
    this.consoleErrors = [];
    this.failedRequests = [];

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      } else if (msg.method === "Runtime.exceptionThrown") {
        this.consoleErrors.push(msg.params.exceptionDetails.text || msg.params.exceptionDetails.exception?.description);
      } else if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
        const argText = msg.params.args.map((a) => a.value || a.description || "").join(" ");
        this.consoleErrors.push(argText);
      } else if (msg.method === "Network.responseReceived") {
        const { status, url } = msg.params.response;
        if (status >= 400 && !url.includes("/api/auth/verify-email?token=invalid")) {
          this.failedRequests.push({ url, status });
        }
      }
    };
  }

  send(method, params = {}) {
    const id = this.messageId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async init() {
    await this.send("Page.enable");
    await this.send("Runtime.enable");
    await this.send("Network.enable");
  }

  async setViewport(width, height, mobile = false) {
    await this.send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile,
    });
  }

  async navigate(url, waitMs = 1200) {
    this.consoleErrors = [];
    this.failedRequests = [];
    await this.send("Page.navigate", { url });
    await sleep(waitMs);
  }

  async evaluate(expression) {
    const res = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (res.exceptionDetails) {
      throw new Error("Evaluation failed: " + JSON.stringify(res.exceptionDetails));
    }
    return res.result?.value;
  }

  async captureScreenshot(filename) {
    const shot = await this.send("Page.captureScreenshot", { format: "png" });
    const fullPath = path.join(SCREENSHOTS_DIR, filename);
    fs.writeFileSync(fullPath, Buffer.from(shot.data, "base64"));
    return fullPath;
  }

  async checkOverflow() {
    return await this.evaluate(`
      document.documentElement.scrollWidth > window.innerWidth
    `);
  }

  async close() {
    try {
      this.ws.close();
    } catch {}
    try {
      this.chromeProcess.kill();
    } catch {}
  }
}

async function launchBrowser() {
  const chrome = spawn(CHROME_PATH, [
    "--headless=new",
    "--remote-debugging-port=9222",
    `--user-data-dir=${USER_DATA_DIR}`,
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    "--window-size=1280,800",
  ]);

  for (let i = 0; i < 20; i++) {
    await sleep(500);
    try {
      const res = await fetch("http://127.0.0.1:9222/json/version");
      if (res.ok) break;
    } catch {}
  }

  let targets = await (await fetch("http://127.0.0.1:9222/json/list")).json();
  let tab = targets.find((t) => t.type === "page");
  if (!tab) {
    const tabRes = await fetch("http://127.0.0.1:9222/json/new", { method: "PUT" });
    tab = await tabRes.json();
  }

  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve) => {
    ws.onopen = resolve;
  });

  const session = new BrowserSession(chrome, ws);
  await session.init();
  return session;
}

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 800, mobile: false },
  { name: "tablet", width: 768, height: 1024, mobile: true },
  { name: "mobile", width: 375, height: 812, mobile: true },
];

async function runQA() {
  console.log("=================================================");
  console.log("Starting Browser E2E Testing & UI QA Suite");
  console.log("=================================================");

  const session = await launchBrowser();
  const testResults = [];

  function record(testName, passed, details = {}) {
    testResults.push({ testName, passed, details });
    const status = passed ? "PASS" : "FAIL";
    console.log(`[${status}] ${testName}`, details.error || "");
  }

  try {
    // -----------------------------------------------------------------
    // 1. Landing Page Across Viewports
    // -----------------------------------------------------------------
    console.log("\n--- 1. Testing Landing Page ---");
    for (const vp of VIEWPORTS) {
      await session.setViewport(vp.width, vp.height, vp.mobile);
      await session.navigate("http://localhost:4000/", 1200);

      const title = await session.evaluate("document.title");
      const mounted = await session.evaluate("document.body.classList.contains('react-app-mounted')");
      const hasHero = await session.evaluate("Boolean(document.querySelector('.hero-title'))");
      const hasPreview = await session.evaluate("Boolean(document.querySelector('.preview-card'))");
      const overflow = await session.checkOverflow();

      await session.captureScreenshot(`landing_${vp.name}.png`);

      record(`Landing Page (${vp.name}) load & mount`, mounted && hasHero, {
        title,
        overflow,
        consoleErrors: session.consoleErrors,
      });

      record(`Landing Page (${vp.name}) responsive overflow check`, !overflow, {
        scrollWidth: await session.evaluate("document.documentElement.scrollWidth"),
        innerWidth: await session.evaluate("window.innerWidth"),
      });
    }

    // Interactive FAQ on Landing Page
    await session.setViewport(1280, 800);
    const faqClicked = await session.evaluate(`
      (() => {
        const firstFaq = document.querySelector('.faq-question');
        if (firstFaq) {
          firstFaq.click();
          return true;
        }
        return false;
      })()
    `);
    await sleep(400);
    const faqAnswerVisible = await session.evaluate(`
      Boolean(document.querySelector('.faq-answer'))
    `);
    record("Landing Page FAQ Accordion interaction", faqClicked && faqAnswerVisible);

    // -----------------------------------------------------------------
    // 2. Signup Flow & Password Criteria Validation
    // -----------------------------------------------------------------
    console.log("\n--- 2. Testing Signup Page & Registration ---");
    for (const vp of VIEWPORTS) {
      await session.setViewport(vp.width, vp.height, vp.mobile);
      await session.navigate("http://localhost:4000/index.html", 1000);

      const mounted = await session.evaluate("document.body.classList.contains('react-app-mounted')");
      const hasForm = await session.evaluate("Boolean(document.getElementById('signup-form'))");
      const overflow = await session.checkOverflow();

      await session.captureScreenshot(`signup_${vp.name}.png`);

      record(`Signup Page (${vp.name}) load & mount`, mounted && hasForm, {
        overflow,
        consoleErrors: session.consoleErrors,
      });
    }

    // Helper inside browser for React input setting
    await session.evaluate(`
      window.setReactInput = function(input, value) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      };
    `);

    // Test real-time password criteria updates
    await session.setViewport(1280, 800);
    await session.navigate("http://localhost:4000/index.html", 800);
    await session.evaluate(`
      window.setReactInput = function(input, value) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      };
    `);

    // Type weak password
    await session.evaluate(`
      (() => {
        const input = document.getElementById('password');
        window.setReactInput(input, 'abc');
      })()
    `);
    await sleep(300);
    const isWeak = await session.evaluate(`
      document.getElementById('strength-bar')?.classList.contains('strength-weak')
    `);
    record("Signup password strength indicator (weak)", isWeak);

    // Type strong password
    await session.evaluate(`
      (() => {
        const input = document.getElementById('password');
        window.setReactInput(input, 'StrongPass123!@#');
      })()
    `);
    await sleep(300);
    const isStrong = await session.evaluate(`
      document.getElementById('strength-bar')?.classList.contains('strength-strong')
    `);
    record("Signup password strength indicator (strong)", isStrong);

    // Submit actual registration with unique email
    const uniqueEmail = `qa-user-${Date.now()}@freelanceos.com`;
    await session.evaluate(`
      (() => {
        const email = document.getElementById('email');
        const pass = document.getElementById('password');
        window.setReactInput(email, '${uniqueEmail}');
        window.setReactInput(pass, 'ValidPass12345!@#');
        document.getElementById('signup-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      })()
    `);
    await sleep(2000);

    const successPanelVisible = await session.evaluate(`
      Boolean(document.getElementById('success-panel'))
    `);
    await session.captureScreenshot("signup_success_panel.png");
    record("Signup submission and verification link notification panel", successPanelVisible, {
      uniqueEmail,
    });

    // -----------------------------------------------------------------
    // 3. Real Email Verification Flow
    // -----------------------------------------------------------------
    console.log("\n--- 3. Testing Real Email Verification ---");
    // Clear cookies so we can test the unauthenticated verification landing pages
    await session.send("Network.clearBrowserCookies");

    const { db, emailVerifications, users } = await import("@freelanceos/db");
    const { eq } = await import("drizzle-orm");

    const createdUsers = await db.select().from(users).where(eq(users.email, uniqueEmail)).limit(1);
    const createdUser = createdUsers[0];

    // Invalid token redirect test:
    await session.navigate("http://localhost:4000/api/auth/verify-email?token=invalid_token", 1500);
    const currUrl = await session.evaluate("window.location.href");
    const hasVerifyError = currUrl.includes("verifyError=");
    const hasErrorAlert = await session.evaluate("Boolean(document.getElementById('error-alert'))");
    console.log("Invalid token redirected to:", currUrl, "hasErrorAlert:", hasErrorAlert);
    await session.captureScreenshot("login_verify_error.png");
    record("Email verification failure redirection & alert banner", hasVerifyError && hasErrorAlert, { currUrl });

    // Valid email verification simulation:
    const crypto = await import("crypto");
    const testRawToken = `e2e_tok_${Date.now()}`;
    const testHash = crypto.createHash("sha256").update(testRawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 3600000);

    if (createdUser) {
      await db.insert(emailVerifications).values({
        id: crypto.randomUUID(),
        userId: createdUser.id,
        tokenHash: testHash,
        expiresAt,
        consumedAt: null,
      });

      // Hit verification link
      await session.navigate(`http://localhost:4000/api/auth/verify-email?token=${testRawToken}`, 1500);
      const postVerifyUrl = await session.evaluate("window.location.href");
      const hasVerifiedParam = postVerifyUrl.includes("verified=true");
      const hasSuccessBanner = await session.evaluate("Boolean(document.getElementById('verification-success-banner'))");
      console.log("Valid token redirected to:", postVerifyUrl, "hasSuccessBanner:", hasSuccessBanner);
      await session.captureScreenshot("login_verify_success.png");
      record("Email verification success redirection & green banner", hasVerifiedParam && hasSuccessBanner);
    }

    // -----------------------------------------------------------------
    // 4. Login & Logout
    // -----------------------------------------------------------------
    console.log("\n--- 4. Testing Login & Logout ---");
    for (const vp of VIEWPORTS) {
      await session.setViewport(vp.width, vp.height, vp.mobile);
      await session.navigate("http://localhost:4000/login.html", 800);
      const mounted = await session.evaluate("document.body.classList.contains('react-app-mounted')");
      const overflow = await session.checkOverflow();
      await session.captureScreenshot(`login_${vp.name}.png`);
      record(`Login Page (${vp.name}) load & mount`, mounted, { overflow });
    }

    // Perform login with created user
    await session.setViewport(1280, 800);
    await session.navigate("http://localhost:4000/login.html", 800);
    await session.evaluate(`
      (() => {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        const email = document.getElementById('email');
        const pass = document.getElementById('password');
        if (email && pass) {
          setter.call(email, '${uniqueEmail}');
          email.dispatchEvent(new Event('input', { bubbles: true }));
          setter.call(pass, 'ValidPass12345!@#');
          pass.dispatchEvent(new Event('input', { bubbles: true }));
          document.getElementById('login-form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        }
      })()
    `);
    await sleep(2500);

    const loggedInUrl = await session.evaluate("window.location.pathname");
    const isDashboard = loggedInUrl === "/dashboard.html" || loggedInUrl === "/dashboard";
    record("Login authentication & redirect to /dashboard.html", isDashboard, { loggedInUrl });

    // -----------------------------------------------------------------
    // 5. Dashboard Viewport & UI State Verification
    // -----------------------------------------------------------------
    console.log("\n--- 5. Testing Dashboard ---");
    for (const vp of VIEWPORTS) {
      await session.setViewport(vp.width, vp.height, vp.mobile);
      await session.navigate("http://localhost:4000/dashboard.html", 1500);

      const hasSidebar = await session.evaluate("Boolean(document.getElementById('sidebar'))");
      const hasMetrics = await session.evaluate("Boolean(document.querySelector('.kpi-grid'))");
      const hasPulse = await session.evaluate("Boolean(document.querySelector('.pulse-container'))");
      const overflow = await session.checkOverflow();

      await session.captureScreenshot(`dashboard_${vp.name}.png`);
      record(`Dashboard (${vp.name}) responsive render & no overflow`, !overflow && hasMetrics, {
        overflow,
        hasSidebar,
      });
    }

    // -----------------------------------------------------------------
    // 6. Clients & Client Detail Pages
    // -----------------------------------------------------------------
    console.log("\n--- 6. Testing Clients & Client Detail ---");
    for (const vp of VIEWPORTS) {
      await session.setViewport(vp.width, vp.height, vp.mobile);
      await session.navigate("http://localhost:4000/clients.html", 1200);

      const mounted = await session.evaluate("document.body.classList.contains('react-app-mounted')");
      const hasFilter = await session.evaluate("Boolean(document.getElementById('client-status-filter'))");
      const overflow = await session.checkOverflow();

      await session.captureScreenshot(`clients_${vp.name}.png`);
      record(`Clients Page (${vp.name}) responsive render`, mounted && hasFilter && !overflow, {
        overflow,
      });
    }

    // Client filter interaction
    await session.setViewport(1280, 800);
    await session.evaluate(`
      (() => {
        const filter = document.getElementById('client-status-filter');
        if (filter) {
          filter.value = 'Active';
          filter.dispatchEvent(new Event('change', { bubbles: true }));
        }
      })()
    `);
    await sleep(800);
    const clientUrlParam = await session.evaluate("window.location.search");
    record("Clients status filter interaction syncs URL", clientUrlParam.includes("status=Active"));

    // Client Detail test (404 and real client)
    await session.navigate("http://localhost:4000/client-detail.html?id=non_existent_client", 1000);
    const notFoundVisible = await session.evaluate("Boolean(document.getElementById('client-detail-not-found'))");
    await session.captureScreenshot("client_detail_404.png");
    record("Client Detail 404 Not Found state", notFoundVisible);

    // -----------------------------------------------------------------
    // 7. Matching Feed & Match Detail Drawer
    // -----------------------------------------------------------------
    console.log("\n--- 7. Testing Matching & Match Detail Drawer ---");
    for (const vp of VIEWPORTS) {
      await session.setViewport(vp.width, vp.height, vp.mobile);
      await session.navigate("http://localhost:4000/matching.html", 1200);

      const mounted = await session.evaluate("document.body.classList.contains('react-app-mounted')");
      const overflow = await session.checkOverflow();

      await session.captureScreenshot(`matching_${vp.name}.png`);
      record(`Matching Page (${vp.name}) render`, mounted && !overflow, { overflow });
    }

    // Drawer interaction test
    await session.setViewport(1280, 800);
    const hasMatches = await session.evaluate("document.querySelectorAll('.match-card').length");
    console.log(`Found ${hasMatches} match cards on matching page`);
    if (hasMatches > 0) {
      await session.evaluate("document.querySelector('.match-card button')?.click()");
      await sleep(600);
      const drawerVisible = await session.evaluate("Boolean(document.querySelector('.matching-detail-modal'))");
      await session.captureScreenshot("match_detail_drawer.png");
      record("Matching Drawer opened and visible", drawerVisible);

      // Close via escape
      await session.evaluate("window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))");
      await sleep(300);
      const drawerClosed = await session.evaluate("!document.querySelector('.matching-detail-modal')");
      record("Matching Drawer closed via Escape key", drawerClosed);
    } else {
      const emptyStateVisible = await session.evaluate("Boolean(document.querySelector('.empty-state'))");
      record("Matching empty state rendered when no matches exist", emptyStateVisible);
    }

    // -----------------------------------------------------------------
    // 8. Unified Search Page & Keyboard Shortcut
    // -----------------------------------------------------------------
    console.log("\n--- 8. Testing Search Page & Keyboard Shortcut ---");
    for (const vp of VIEWPORTS) {
      await session.setViewport(vp.width, vp.height, vp.mobile);
      await session.navigate("http://localhost:4000/search.html", 1000);

      const hasSearchInput = await session.evaluate("Boolean(document.getElementById('search-input'))");
      const overflow = await session.checkOverflow();

      await session.captureScreenshot(`search_${vp.name}.png`);
      record(`Search Page (${vp.name}) render`, hasSearchInput && !overflow, { overflow });
    }

    // Keyboard shortcut interaction
    await session.setViewport(1280, 800);
    await session.evaluate(`
      (() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
      })()
    `);
    await sleep(200);
    const isInputFocused = await session.evaluate("document.activeElement === document.getElementById('search-input')");
    record("Search Page Ctrl+K shortcut focuses input", isInputFocused);

    // Search typing & debounce
    await session.evaluate(`
      (() => {
        const input = document.getElementById('search-input');
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(input, 'developer');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      })()
    `);
    await sleep(1000);
    const searchParam = await session.evaluate("window.location.search");
    record("Search input debounce and URL query sync", searchParam.includes("q=developer"));

    // -----------------------------------------------------------------
    // 9. Billing Page
    // -----------------------------------------------------------------
    console.log("\n--- 9. Testing Billing Page ---");
    for (const vp of VIEWPORTS) {
      await session.setViewport(vp.width, vp.height, vp.mobile);
      await session.navigate("http://localhost:4000/billing.html", 1200);

      const hasPlanCards = await session.evaluate("document.querySelectorAll('.plan-card').length > 0");
      const overflow = await session.checkOverflow();

      await session.captureScreenshot(`billing_${vp.name}.png`);
      record(`Billing Page (${vp.name}) plan cards render`, hasPlanCards && !overflow, {
        overflow,
      });
    }

    // -----------------------------------------------------------------
    // 10. Settings & Security Page
    // -----------------------------------------------------------------
    console.log("\n--- 10. Testing Settings & Security Page ---");
    for (const vp of VIEWPORTS) {
      await session.setViewport(vp.width, vp.height, vp.mobile);
      await session.navigate("http://localhost:4000/settings.html", 1200);

      const hasTabs = await session.evaluate("document.querySelectorAll('.settings-tab-btn').length >= 4");
      const overflow = await session.checkOverflow();

      await session.captureScreenshot(`settings_${vp.name}.png`);
      record(`Settings Page (${vp.name}) tabs render`, hasTabs && !overflow, { overflow });
    }

    // Switch Settings Tab
    await session.setViewport(1280, 800);
    await session.evaluate(`
      (() => {
        const buttons = Array.from(document.querySelectorAll('.settings-tab-btn'));
        const secBtn = buttons.find(b => b.textContent.includes('Security'));
        if (secBtn) secBtn.click();
      })()
    `);
    await sleep(600);
    const secPanelVisible = await session.evaluate("Boolean(document.getElementById('panel-security'))");
    await session.captureScreenshot("settings_security_tab.png");
    record("Settings Security tab selection", secPanelVisible);

    // -----------------------------------------------------------------
    // 11. Logout Execution
    // -----------------------------------------------------------------
    console.log("\n--- 11. Testing Logout ---");
    await session.evaluate(`
      (() => {
        const logoutBtn = document.getElementById('sidebar-logout-btn');
        if (logoutBtn) logoutBtn.click();
      })()
    `);
    await sleep(1500);
    const finalUrl = await session.evaluate("window.location.pathname");
    record("Sidebar Logout terminates session and redirects to /login.html", finalUrl.includes("/login"));

  } finally {
    await session.close();
  }

  console.log("\n=================================================");
  console.log("Summary of E2E Results:");
  const total = testResults.length;
  const passed = testResults.filter((t) => t.passed).length;
  console.log(`Passed: ${passed}/${total}`);
  console.log("=================================================");

  // Output test results as JSON to scratch
  fs.writeFileSync(
    path.join(SCREENSHOTS_DIR, "e2e_results.json"),
    JSON.stringify(testResults, null, 2)
  );
}

runQA().catch((err) => {
  console.error("Fatal QA Runner Error:", err);
  process.exit(1);
});
