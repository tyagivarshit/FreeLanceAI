import { db } from "./packages/db/src/client.js";
import { users, userPasswordHashes } from "./packages/db/src/index.js";
import { hashPassword } from "./packages/auth/src/hash.js";
import { normalizeEmailAddress } from "./packages/core/src/index.js";
async function run() {
    const mockId = "00000000-0000-0000-0000-000000000000";
    const routes = [
        { method: "GET", path: "/healthz", public: true },
        { method: "GET", path: "/api/health", public: true },
        { method: "POST", path: "/api/signup", public: true, body: { email: "new@example.com", password: "Password123!" } },
        { method: "POST", path: "/api/login", public: true, body: { email: "tester@example.com", password: "Password123!" } },
        { method: "POST", path: "/api/logout", public: true },
        { method: "POST", path: "/api/webhooks/stripe", public: true },
        { method: "GET", path: "/api/billing/plans", public: true },
        // Protected
        { method: "GET", path: "/api/session", public: false },
        { method: "GET", path: "/api/search?q=test", public: false },
        { method: "POST", path: "/api/feedback", public: false },
        { method: "GET", path: "/api/matches", public: false },
        { method: "GET", path: `/api/matches/${mockId}`, public: false },
        { method: "PATCH", path: `/api/matches/${mockId}`, public: false },
        { method: "POST", path: "/api/brain/analyses", public: false },
        { method: "GET", path: "/api/brain/analyses", public: false },
        { method: "GET", path: `/api/brain/analyses/${mockId}`, public: false },
        { method: "GET", path: "/api/clients", public: false },
        { method: "POST", path: "/api/clients", public: false },
        { method: "GET", path: `/api/clients/${mockId}`, public: false },
        { method: "PATCH", path: `/api/clients/${mockId}`, public: false },
        { method: "GET", path: `/api/clients/${mockId}/timeline`, public: false },
        { method: "GET", path: "/api/entitlements", public: false },
        { method: "GET", path: "/api/billing/subscription", public: false },
        { method: "POST", path: "/api/billing/checkout", public: false },
        { method: "POST", path: "/api/billing/portal", public: false },
        { method: "GET", path: "/api/jobs", public: false },
        { method: "POST", path: "/api/jobs/import", public: false },
        { method: "POST", path: "/api/jobs/detect", public: false },
        { method: "POST", path: `/api/jobs/${mockId}/match`, public: false },
        { method: "GET", path: "/api/analytics/test", public: false },
        { method: "GET", path: "/api/activity", public: false },
        { method: "GET", path: "/api/settings/profile", public: false },
        { method: "POST", path: "/api/settings/security/password", public: false },
        { method: "GET", path: "/api/settings/security/sessions", public: false },
        { method: "DELETE", path: `/api/settings/security/sessions/${mockId}`, public: false },
        { method: "DELETE", path: "/api/settings/security/sessions", public: false },
        { method: "GET", path: "/api/settings/data/export", public: false },
        { method: "GET", path: "/api/settings/extension", public: false },
    ];
    const email = "tester@example.com";
    const pass = "Password123!";
    const { passwordHash, algorithm, hashVersion } = await hashPassword(pass);
    const norm = normalizeEmailAddress(email, { stripSubaddress: true, stripDots: true });
    let user = (await db.insert(users).values({ email, normalizedEmail: norm, status: "active" }).onConflictDoUpdate({ target: users.normalizedEmail, set: { status: "active" } }).returning())[0];
    await db.insert(userPasswordHashes).values({ userId: user.id, passwordHash, algorithm, hashVersion, passwordChangedAt: new Date() }).onConflictDoUpdate({ target: userPasswordHashes.userId, set: { passwordHash, credentialVersion: 1 } });
    const resLogin = await fetch("http://localhost:4001/api/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: pass })
    });
    const cookieHeader = resLogin.headers.get("set-cookie");
    const tokenCookie = cookieHeader ? cookieHeader.split(";")[0] : "";
    console.log("--- ROUTE STATUS TABLE (UNAUTHENTICATED) ---");
    for (const route of routes) {
        const res = await fetch(`http://localhost:4001${route.path}`, {
            method: route.method,
            headers: { "Content-Type": "application/json" },
            body: route.body ? JSON.stringify(route.body) : undefined
        });
        console.log(`${route.method.padEnd(6)} ${route.path.padEnd(45)} | STATUS: ${res.status}`);
    }
    console.log("\n--- ROUTE STATUS TABLE (AUTHENTICATED) ---");
    for (const route of routes) {
        if (route.public)
            continue;
        const res = await fetch(`http://localhost:4001${route.path}`, {
            method: route.method,
            headers: { "Content-Type": "application/json", "Cookie": tokenCookie },
            body: route.body ? JSON.stringify(route.body) : undefined
        });
        console.log(`${route.method.padEnd(6)} ${route.path.padEnd(45)} | STATUS: ${res.status}`);
    }
    console.log("\n--- HTML SHELLS ---");
    const dashRes = await fetch("http://localhost:4001/dashboard.html");
    console.log("DASHBOARD STATUS:", dashRes.status, "CONTENT LENGTH:", (await dashRes.text()).length);
    const setRes = await fetch("http://localhost:4001/settings.html");
    console.log("SETTINGS STATUS:", setRes.status, "CONTENT LENGTH:", (await setRes.text()).length);
    console.log("\n--- BENCHMARK (100 CONCURRENT GET /api/session) ---");
    const start = performance.now();
    const promises = [];
    for (let i = 0; i < 100; i++) {
        const pStart = performance.now();
        promises.push(fetch("http://localhost:4001/api/session", { headers: { "Cookie": tokenCookie } })
            .then(() => performance.now() - pStart));
    }
    const times = await Promise.all(promises);
    const total = performance.now() - start;
    times.sort((a, b) => a - b);
    const p50 = times[Math.floor(times.length * 0.5)];
    const p95 = times[Math.floor(times.length * 0.95)];
    console.log(`100 requests took ${total.toFixed(2)}ms total.`);
    console.log(`p50 Latency: ${p50.toFixed(2)}ms`);
    console.log(`p95 Latency: ${p95.toFixed(2)}ms`);
    console.log("\n--- BENCHMARK (500 CONCURRENT GET /api/session) ---");
    const start500 = performance.now();
    const promises500 = [];
    for (let i = 0; i < 500; i++) {
        const pStart = performance.now();
        promises500.push(fetch("http://localhost:4001/api/session", { headers: { "Cookie": tokenCookie } })
            .then(res => res.status === 200 ? performance.now() - pStart : -1));
    }
    const times500 = await Promise.all(promises500);
    const total500 = performance.now() - start500;
    const validTimes = times500.filter(t => t > 0).sort((a, b) => a - b);
    const p50_500 = validTimes[Math.floor(validTimes.length * 0.5)] || 0;
    const p95_500 = validTimes[Math.floor(validTimes.length * 0.95)] || 0;
    console.log(`500 requests took ${total500.toFixed(2)}ms total.`);
    console.log(`Successful requests: ${validTimes.length}/500`);
    console.log(`p50 Latency: ${p50_500.toFixed(2)}ms`);
    console.log(`p95 Latency: ${p95_500.toFixed(2)}ms`);
    process.exit(0);
}
run();
