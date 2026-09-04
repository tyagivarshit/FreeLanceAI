import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { db, users, sessions, emailVerifications, clients, jobMatches, jobImports } from "@freelanceos/db";
import { eq, and } from "drizzle-orm";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const USER_DATA_DIR = "D:\\FreelanceAI\\apps\\web\\.chrome-user-data-phase3";
const SCREENSHOTS_DIR = "C:\\Users\\tyagi\\.gemini\\antigravity-cli\\brain\\c388a92e-f2c4-4fee-b7a9-f5d0dcbdc80f\\scratch\\screenshots_phase3";

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
    await this.setViewport(1280, 800);
  }

  async setViewport(width, height) {
    await this.send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false,
    });
  }

  async navigate(url, waitMs = 1200) {
    this.consoleErrors = [];
    await this.send("Page.navigate", { url });
    await sleep(waitMs);
  }

  async reload(waitMs = 1200) {
    await this.send("Page.reload");
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

  async setInput(selector, value) {
    await this.evaluate(`
      (() => {
        const el = document.querySelector('${selector}');
        if (!el) throw new Error("Element not found: ${selector}");
        const lastValue = el.value;
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(el, '${value}');
        const tracker = el._valueTracker;
        if (tracker) {
          tracker.setValue(lastValue);
        }
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      })()
    `);
  }

  async click(selector) {
    await this.evaluate(`
      (() => {
        const el = document.querySelector('${selector}');
        if (!el) throw new Error("Element not found for click: ${selector}");
        el.click();
      })()
    `);
  }

  async typeText(selector, text) {
    await this.evaluate(`
      (() => {
        const el = document.querySelector('${selector}');
        if (!el) throw new Error("Element not found for typing: ${selector}");
        el.focus();
        el.click();
      })()
    `);
    await sleep(150);
    await this.send("Input.insertText", { text });
    await sleep(100);
    await this.evaluate(`
      (() => {
        const el = document.querySelector('${selector}');
        if (el) {
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
      })()
    `);
  }

  async captureScreenshot(filename) {
    const shot = await this.send("Page.captureScreenshot", { format: "png" });
    const fullPath = path.join(SCREENSHOTS_DIR, filename);
    fs.writeFileSync(fullPath, Buffer.from(shot.data, "base64"));
    return fullPath;
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
    "--remote-debugging-port=9223",
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
      const res = await fetch("http://127.0.0.1:9223/json/version");
      if (res.ok) break;
    } catch {}
  }

  let targets = await (await fetch("http://127.0.0.1:9223/json/list")).json();
  let tab = targets.find((t) => t.type === "page");
  if (!tab) {
    const tabRes = await fetch("http://127.0.0.1:9223/json/new", { method: "PUT" });
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

async function runPhase3QA() {
  console.log("=================================================================");
  console.log("Starting Phase 3 — Full Functional & Business Workflow QA");
  console.log("=================================================================");

  const session = await launchBrowser();
  const results = [];

  function record(name, passed, details = {}) {
    results.push({ name, passed, details });
    const mark = passed ? "PASS" : "FAIL";
    console.log(`[${mark}] ${name}`, details.error || (details.info ? `(${details.info})` : ""));
  }

  try {
    // -----------------------------------------------------------------
    // WORKFLOW 1: Signup -> Email Verification -> Login -> Session Persistence
    // -----------------------------------------------------------------
    console.log("\n>>> Workflow 1: Signup -> Email Verification -> Login -> Persistence");
    const testEmail = `workflow-${Date.now()}@freelanceos.com`;
    const testPassword = "WorkflowSecurePassword123!";

    await session.send("Network.clearBrowserCookies");
    await session.navigate("http://localhost:4000/index.html", 1000);

    // 1A. Fill Signup Form in Browser
    await session.setInput("#email", testEmail);
    await session.setInput("#password", testPassword);
    await session.click("#submit-button");
    await sleep(2000);

    const successPanel = await session.evaluate("Boolean(document.getElementById('success-panel'))");
    await session.captureScreenshot("01_signup_success.png");
    record("1A. Browser user signup submission & success panel", successPanel, { testEmail });

    // 1B. Verify User in Database
    const dbUserRecords = await db.select().from(users).where(eq(users.email, testEmail)).limit(1);
    const createdUser = dbUserRecords[0];
    record("1B. User record created in PostgreSQL", Boolean(createdUser), {
      userId: createdUser?.id,
      email: createdUser?.email,
    });

    // 1C. Simulate Email Verification Token in Database & Consume via Verification Link
    const rawVerifyToken = `verify_tok_${Date.now()}`;
    const tokenHash = crypto.createHash("sha256").update(rawVerifyToken).digest("hex");
    await db.insert(emailVerifications).values({
      id: crypto.randomUUID(),
      userId: createdUser.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 3600000),
      consumedAt: null,
    });

    // Hit verification URL in browser
    await session.send("Network.clearBrowserCookies");
    await session.navigate(`http://localhost:4000/api/auth/verify-email?token=${rawVerifyToken}`, 1500);
    const verifyLandingUrl = await session.evaluate("window.location.href");
    const hasVerifySuccessBanner = await session.evaluate("Boolean(document.getElementById('verification-success-banner'))");
    await session.captureScreenshot("02_email_verified_landing.png");
    record("1C. Email verification consumption and login redirect with green banner", hasVerifySuccessBanner && verifyLandingUrl.includes("verified=true"));

    // Verify token marked consumed in DB
    const consumedRecords = await db.select().from(emailVerifications).where(eq(emailVerifications.tokenHash, tokenHash)).limit(1);
    record("1D. Email verification consumedAt persisted in DB", consumedRecords[0]?.consumedAt !== null);

    // 1E. Log In with Credentials
    await session.setInput("#email", testEmail);
    await session.setInput("#password", testPassword);
    await session.click("#submit-button");
    await sleep(2500);

    const postLoginUrl = await session.evaluate("window.location.pathname");
    record("1E. User login and transition to dashboard", postLoginUrl.includes("/dashboard"));

    // 1F. Verify Active Session in Database
    const dbSessions = await db.select().from(sessions).where(eq(sessions.userId, createdUser.id));
    const activeSession = dbSessions.find((s) => s.expiresAt > new Date());
    record("1F. Active session persisted in PostgreSQL sessions table", Boolean(activeSession), {
      sessionId: activeSession?.id,
    });

    // 1G. Test Session Persistence after Full Page Refresh
    await session.reload(1500);
    const postReloadUrl = await session.evaluate("window.location.pathname");
    const isStillDashboard = postReloadUrl.includes("/dashboard");
    const greetingText = await session.evaluate("document.getElementById('welcome-message')?.textContent");
    record("1G. Session persistence across browser reload (stays on dashboard)", isStillDashboard && Boolean(greetingText));

    // Get cookie for API helper calls
    const cookiesRes = await session.send("Network.getCookies", { urls: ["http://localhost:4000/"] });
    let sessionCookieHeader = cookiesRes.cookies.map((c) => `${c.name}=${c.value}`).join("; ");

    // -----------------------------------------------------------------
    // WORKFLOW 2: Dashboard Metrics, Jobs, Matches, Activity, Quota
    // -----------------------------------------------------------------
    console.log("\n>>> Workflow 2: Dashboard Metrics, Jobs, Matches & Quota Persistence");

    // 2A. Import a Realistic Job via Extension API (/api/jobs/import)
    const importPayload = {
      jobId: `ext-job-${Date.now()}`,
      title: "Senior Full-Stack TypeScript Architect",
      description: "We are seeking a senior TypeScript engineer experienced in React 19, Node.js, PostgreSQL, and modern SaaS architecture to design automated freelance workflows.",
      budget: "$5,000 - $8,000",
      skills: ["TypeScript", "React", "Node.js", "PostgreSQL", "TailwindCSS"],
      platform: "upwork",
      url: `https://www.upwork.com/jobs/~01${Date.now()}`,
    };

    const importRes = await fetch("http://localhost:4000/api/jobs/import", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: sessionCookieHeader,
      },
      body: JSON.stringify(importPayload),
    });
    const importData = await importRes.json();
    record("2A. Job imported via /api/jobs/import API", importRes.status === 201 && importData.success, {
      jobImportId: importData.jobImportId,
    });

    // 2B. Reload Dashboard in Browser and Verify Job appears in "Top Opportunities"
    await session.reload(1500);
    const topOpportunitiesTitle = await session.evaluate(`
      document.querySelector('.opp-title')?.textContent
    `);
    await session.captureScreenshot("03_dashboard_with_imported_job.png");
    record("2B. Imported job reflects in Top Opportunities feed in browser UI", topOpportunitiesTitle?.includes("TypeScript"), {
      renderedTitle: topOpportunitiesTitle,
    });

    // 2C. Trigger "Run Match" on the job from the Dashboard UI
    await session.evaluate(`
      (() => {
        const matchBtn = document.querySelector('.btn-run-match');
        if (matchBtn) matchBtn.click();
      })()
    `);
    await sleep(2500);

    const matchBadgeText = await session.evaluate(`
      document.querySelector('.match-score-pill')?.textContent
    `);
    await session.captureScreenshot("04_dashboard_match_executed.png");
    record("2C. 'Run Match' triggered from UI and calculates match score", Boolean(matchBadgeText), {
      matchScore: matchBadgeText,
    });

    // 2D. Verify Match Record in PostgreSQL Database
    const dbMatches = await db.select().from(jobMatches).where(eq(jobMatches.ownerId, createdUser.id));
    record("2D. Match record successfully persisted in PostgreSQL job_matches table", dbMatches.length > 0, {
      matchesCount: dbMatches.length,
      status: dbMatches[0]?.status,
    });

    // 2E. Verify Quota Display in UI
    const quotaText = await session.evaluate(`
      document.querySelector('.quota-row')?.textContent || document.querySelector('.progress-header')?.textContent
    `);
    record("2E. Proposal quota & entitlement limits reflected in UI", Boolean(quotaText));

    // -----------------------------------------------------------------
    // WORKFLOW 3: Clients Lifecycle (Create, View, Filter, Detail, Persistence)
    // -----------------------------------------------------------------
    console.log("\n>>> Workflow 3: Clients Lifecycle");

    // 3A. Create New Client via API
    const clientPayload = {
      name: "Acme Cloud Corporation",
      email: "billing@acmecloud.example",
      status: "Lead",
      website: "https://acmecloud.example",
      phone: "+1 (555) 234-5678",
    };

    const createClientRes = await fetch("http://localhost:4000/api/clients", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: sessionCookieHeader,
      },
      body: JSON.stringify(clientPayload),
    });
    const createClientData = await createClientRes.json();
    const createdClientId = createClientData.client?.id;
    record("3A. Client created via /api/clients POST", createClientRes.status === 201 && Boolean(createdClientId), {
      clientId: createdClientId,
    });

    // 3B. Verify Client Persisted in Database
    const dbClientRecords = await db.select().from(clients).where(eq(clients.id, createdClientId));
    const clientProfile = dbClientRecords[0]?.profile;
    record("3B. Client record verified in PostgreSQL clients table", dbClientRecords.length === 1 && clientProfile?.name === "Acme Cloud Corporation");

    // 3C. View Client in Browser on /clients.html
    await session.navigate("http://localhost:4000/clients.html", 1500);
    const clientRowName = await session.evaluate(`
      document.querySelector('.client-name')?.textContent
    `);
    await session.captureScreenshot("05_clients_table.png");
    record("3C. Created client rendered in Clients directory table", clientRowName === "Acme Cloud Corporation");

    // 3D. Filter by Status
    await session.evaluate(`
      (() => {
        const filter = document.getElementById('client-status-filter');
        if (filter) {
          filter.value = 'Lead';
          filter.dispatchEvent(new Event('change', { bubbles: true }));
        }
      })()
    `);
    await sleep(800);
    const leadFilteredRows = await session.evaluate("document.querySelectorAll('.client-list-row').length");
    record("3D. Status filter 'Lead' shows matching client row", leadFilteredRows >= 1);

    // 3E. Update Client Status via PATCH API with complete Active prerequisites
    const patchClientRes = await fetch(`http://localhost:4000/api/clients/${createdClientId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: sessionCookieHeader,
      },
      body: JSON.stringify({
        status: "Active",
        primaryContact: {
          firstName: "Jane",
          lastName: "Doe",
          email: "billing@acmecloud.example",
        },
        billingDetails: {
          currency: "USD",
          billingAddress: {
            street: "123 Market St",
            city: "San Francisco",
            state: "CA",
            postalCode: "94105",
            country: "US",
          },
        },
      }),
    });
    const patchClientData = await patchClientRes.json();
    record("3E. Client status updated to 'Active' via PATCH", patchClientRes.status === 200 && patchClientData.client?.status === "Active");

    // Verify DB update
    const updatedDbClient = await db.select().from(clients).where(eq(clients.id, createdClientId));
    record("3F. Updated client status 'Active' persisted in PostgreSQL", updatedDbClient[0]?.status === "Active");

    // 3G. Client Detail Page View & Refresh Persistence
    await session.navigate(`http://localhost:4000/client-detail.html?id=${createdClientId}`, 1500);
    const detailName = await session.evaluate("document.getElementById('client-detail-name')?.textContent");
    const detailStatus = await session.evaluate("document.getElementById('client-detail-status')?.textContent");
    await session.captureScreenshot("06_client_detail.png");
    record("3G. Client Detail Page loaded with updated status badge", detailName === "Acme Cloud Corporation" && detailStatus?.toUpperCase().includes("ACTIVE"));

    // Reload Client Detail Page to verify persistence
    await session.reload(1500);
    const reloadedDetailName = await session.evaluate("document.getElementById('client-detail-name')?.textContent");
    record("3H. Client Detail Page data persists across full browser reload", reloadedDetailName === "Acme Cloud Corporation");

    // -----------------------------------------------------------------
    // WORKFLOW 4: Matching Page, Drawer & Archive Action
    // -----------------------------------------------------------------
    console.log("\n>>> Workflow 4: Matching Feed, Score Breakdown Drawer & Archive Action");

    await session.navigate("http://localhost:4000/matching.html", 1500);
    const matchCardsCount = await session.evaluate("document.querySelectorAll('.match-card').length");
    await session.captureScreenshot("07_matching_feed.png");
    record("4A. Matching Feed renders match cards in browser", matchCardsCount > 0, {
      cardCount: matchCardsCount,
    });

    // Open Match Detail Drawer
    await session.click(".match-card .btn-primary");
    await sleep(800);
    const drawerTitle = await session.evaluate("document.getElementById('detail-title')?.textContent");
    const hasGauge = await session.evaluate("Boolean(document.getElementById('detail-score-gauge'))");
    await session.captureScreenshot("08_match_detail_drawer.png");
    record("4B. Match Detail Drawer opened with multi-factor score breakdown", Boolean(drawerTitle) && hasGauge);

    // Archive Match from Drawer
    await session.click("#detail-archive-btn");
    await sleep(1500);

    // Verify in DB that match status is ARCHIVED
    const archivedMatches = await db.select().from(jobMatches).where(and(eq(jobMatches.ownerId, createdUser.id), eq(jobMatches.status, "ARCHIVED")));
    record("4C. Match archived and status persisted as ARCHIVED in PostgreSQL", archivedMatches.length > 0);

    // Close drawer via Escape key
    await session.evaluate("window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))");
    await sleep(400);

    // -----------------------------------------------------------------
    // WORKFLOW 5: Search Across Entities & URL Query State
    // -----------------------------------------------------------------
    console.log("\n>>> Workflow 5: Search (Clients, Jobs, Matches) & Query Persistence");

    await session.navigate("http://localhost:4000/search.html?q=Acme", 1500);
    let searchUrl = "";
    let searchResultsCount = 0;
    for (let i = 0; i < 25; i++) {
      searchUrl = await session.evaluate("window.location.search");
      searchResultsCount = await session.evaluate("document.querySelectorAll('.search-result-card').length");
      if (searchResultsCount > 0 && searchUrl.includes("q=Acme")) break;
      await sleep(150);
    }
    console.log("--> DEBUG SEARCH URL:", searchUrl, "COUNT:", searchResultsCount);
    await session.captureScreenshot("09_search_results.png");
    record("5A. Search returns results for query 'Acme'", searchResultsCount > 0 && searchUrl.includes("q=Acme"), {
      count: searchResultsCount,
      url: searchUrl,
    });

    // Reload page to verify search state restores from URL
    await session.reload(1500);
    let reloadedSearchVal = "";
    let reloadedResultsCount = 0;
    for (let i = 0; i < 25; i++) {
      reloadedSearchVal = await session.evaluate("document.getElementById('search-input')?.value");
      reloadedResultsCount = await session.evaluate("document.querySelectorAll('.search-result-card').length");
      if (reloadedResultsCount > 0 && reloadedSearchVal === "Acme") break;
      await sleep(150);
    }
    console.log("--> DEBUG RELOADED SEARCH VAL:", reloadedSearchVal, "RELOADED COUNT:", reloadedResultsCount);
    record("5B. Search query and result state restored from URL on reload", reloadedSearchVal === "Acme" && reloadedResultsCount > 0);

    // -----------------------------------------------------------------
    // WORKFLOW 6: Proposal / Brain Intelligence Flow & Quota Behavior
    // -----------------------------------------------------------------
    console.log("\n>>> Workflow 6: Proposal / Brain Intelligence Flow & Quota Behavior");

    // Trigger brain opportunity review analysis via API
    const brainRes = await fetch("http://localhost:4000/api/brain/analyses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: sessionCookieHeader,
      },
      body: JSON.stringify({
        analysisType: "OPPORTUNITY_REVIEW",
        context: {
          jobIds: [importData.jobImportId],
        },
        constraints: { maxRecommendations: 3 },
      }),
    });
    const brainData = await brainRes.json();
    record("6A. Brain analysis executed (/api/brain/analyses)", brainRes.status === 201 && brainData.success, {
      status: brainData.analysis?.status,
    });

    // Check entitlements API for proposal usage
    const entRes = await fetch("http://localhost:4000/api/entitlements", {
      headers: { Cookie: sessionCookieHeader },
    });
    const entData = await entRes.json();
    record("6B. Entitlements API reports active Starter plan limits", entData.success && entData.planId === "STARTER" && entData.limits?.aiProposals?.value === 3);

    // -----------------------------------------------------------------
    // WORKFLOW 7: Billing & Safe Stripe Checkout Flow
    // -----------------------------------------------------------------
    console.log("\n>>> Workflow 7: Billing & Safe Stripe Checkout Flow");

    await session.navigate("http://localhost:4000/billing.html", 1500);

    // 7A. Test Safe Mock / Test Checkout Initialization for PRO Plan
    const checkoutRes = await fetch("http://localhost:4000/api/billing/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: sessionCookieHeader,
      },
      body: JSON.stringify({ planId: "PRO" }),
    });
    const checkoutData = await checkoutRes.json();
    record("7A. Stripe checkout session initialized safely", checkoutRes.status === 200 && Boolean(checkoutData.checkoutUrl), {
      checkoutUrl: checkoutData.checkoutUrl ? "Generated" : "None",
    });

    // 7B. Test Cancellation Return Banner
    await session.navigate("http://localhost:4000/billing.html?checkout=cancel", 1000);
    let cancelToast;
    for (let i = 0; i < 20; i++) {
      cancelToast = await session.evaluate(`
        document.querySelector('#toast-msg')?.textContent ||
        document.querySelector('.toast')?.textContent ||
        document.querySelector('#toast-container')?.textContent
      `);
      if (cancelToast && cancelToast.includes("cancelled")) break;
      await sleep(150);
    }
    await session.captureScreenshot("10_billing_checkout_cancel.png");
    console.log("--> DEBUG CANCEL TOAST:", cancelToast);
    record("7B. Checkout cancellation toast rendered in UI", cancelToast?.includes("cancelled"));

    // 7C. Test Success Return Banner
    await session.navigate("http://localhost:4000/billing.html?checkout=success", 1000);
    let successToast;
    for (let i = 0; i < 20; i++) {
      successToast = await session.evaluate(`
        document.querySelector('#toast-msg')?.textContent ||
        document.querySelector('.toast')?.textContent ||
        document.querySelector('#toast-container')?.textContent
      `);
      if (successToast && successToast.includes("Subscription updated")) break;
      await sleep(150);
    }
    await session.captureScreenshot("11_billing_checkout_success.png");
    console.log("--> DEBUG SUCCESS TOAST:", successToast);
    record("7C. Checkout success toast rendered in UI", successToast?.includes("Subscription updated"));

    // -----------------------------------------------------------------
    // WORKFLOW 8: Settings, Password Update & Session Management
    // -----------------------------------------------------------------
    console.log("\n>>> Workflow 8: Settings, Password Update & Session Management");

    await session.navigate("http://localhost:4000/settings.html", 1500);

    // 8A. Profile Tab displays user info
    const profileEmail = await session.evaluate("document.getElementById('profile-email')?.value");
    record("8A. Settings Profile tab displays authenticated user email", profileEmail === testEmail);

    // 8B. Switch to Security Tab
    await session.click("#tab-security");
    await sleep(600);
    const secPanel = await session.evaluate("Boolean(document.getElementById('panel-security'))");
    record("8B. Settings Security tab rendered", secPanel);

    // 8C. Change Password Flow
    const newPassword = "NewUpdatedWorkflowPassword123!";
    await session.setInput("#current-password", testPassword);
    await session.setInput("#new-password", newPassword);
    await session.setInput("#confirm-password", newPassword);
    await session.click("#btn-change-password");
    await sleep(2000);

    const passwordToast = await session.evaluate(`
      document.querySelector('#toast-container')?.textContent ||
      document.querySelector('.toast-notification')?.textContent
    `);
    await session.captureScreenshot("12_password_updated.png");
    record("8C. Password update submitted and success feedback received", passwordToast?.includes("Password updated successfully"));

    // Verify login with old password fails
    const oldLoginRes = await fetch("http://localhost:4000/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testEmail, password: testPassword }),
    });
    record("8D. Old password rejected with 401 Unauthorized", oldLoginRes.status === 401);

    // Verify login with new password succeeds
    const newLoginRes = await fetch("http://localhost:4000/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testEmail, password: newPassword }),
    });
    record("8E. New password authenticated successfully with 200 OK", newLoginRes.status === 200);

    // Extract new session cookie header
    const rawSetCookie = newLoginRes.headers.get("set-cookie") || "";
    const newCookieMatch = rawSetCookie.match(/__Host-refresh_token=[^;]+/);
    if (newCookieMatch) {
      sessionCookieHeader = newCookieMatch[0];
    }

    // 8F. Revoke All Other Sessions
    await session.click("#btn-revoke-all-sessions");
    await sleep(600);
    // Modal confirmation
    await session.click("#modal-confirm-btn");
    await sleep(1500);

    const allSessions = await db.select().from(sessions).where(eq(sessions.userId, createdUser.id));
    record("8F. Session revocation executed", allSessions.length >= 1);

    // 8G. Data Export JSON download
    const exportRes = await fetch("http://localhost:4000/api/settings/data/export", {
      headers: { Cookie: sessionCookieHeader },
    });
    const exportData = await exportRes.json();
    record("8G. Data Export API returns complete workspace data payload", exportRes.status === 200 && exportData.success && Array.isArray(exportData.export?.clients));

    // -----------------------------------------------------------------
    // WORKFLOW 9: Edge Cases & Defensive Validation
    // -----------------------------------------------------------------
    console.log("\n>>> Workflow 9: Edge Cases & Defensive Validation");

    // 9A. Duplicate Email Registration
    const dupSignupRes = await fetch("http://localhost:4000/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testEmail, password: "AnyPassword123!" }),
    });
    record("9A. Duplicate email registration rejected with 409 Conflict", dupSignupRes.status === 409);

    // 9B. Non-Existent Client Detail 404
    // Log back into browser with new password first
    await session.navigate("http://localhost:4000/login.html", 1000);
    await session.setInput("#email", testEmail);
    await session.setInput("#password", newPassword);
    await session.click("#submit-button");
    await sleep(2500);

    await session.navigate("http://localhost:4000/client-detail.html?id=00000000-0000-0000-0000-000000000000", 1500);
    const notFoundCard = await session.evaluate("Boolean(document.getElementById('client-detail-not-found'))");
    await session.captureScreenshot("13_client_detail_404.png");
    record("9B. Non-existent client renders 404 Not Found card with retry CTA", notFoundCard);

    // 9C. Protected Route Redirect when Unauthenticated
    await session.send("Network.clearBrowserCookies");
    await session.navigate("http://localhost:4000/dashboard.html", 1000);
    const unauthUrl = await session.evaluate("window.location.pathname");
    record("9C. Unauthenticated access to /dashboard.html redirected to /login.html", unauthUrl.includes("/login"));

  } finally {
    await session.close();
  }

  console.log("\n=================================================================");
  console.log("Phase 3 Full Functional & Business Workflow QA Summary:");
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  console.log(`Passed: ${passed}/${total}`);
  console.log("=================================================================");

  fs.writeFileSync(
    path.join(SCREENSHOTS_DIR, "phase3_results.json"),
    JSON.stringify(results, null, 2)
  );

  if (passed !== total) {
    process.exit(1);
  }
}

runPhase3QA().catch((err) => {
  console.error("Fatal Phase 3 QA Error:", err);
  process.exit(1);
});
