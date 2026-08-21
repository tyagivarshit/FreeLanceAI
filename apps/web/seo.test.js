import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";
import { server } from "./server.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const landingHtml = fs.readFileSync(path.join(__dirname, "landing.html"), "utf-8");
const indexHtml = fs.readFileSync(path.join(__dirname, "index.html"), "utf-8");
const loginHtml = fs.readFileSync(path.join(__dirname, "login.html"), "utf-8");
const dashboardHtml = fs.readFileSync(path.join(__dirname, "dashboard.html"), "utf-8");
const clientsHtml = fs.readFileSync(path.join(__dirname, "clients.html"), "utf-8");
const clientDetailHtml = fs.readFileSync(path.join(__dirname, "client-detail.html"), "utf-8");
const matchingHtml = fs.readFileSync(path.join(__dirname, "matching.html"), "utf-8");
const searchHtml = fs.readFileSync(path.join(__dirname, "search.html"), "utf-8");
const billingHtml = fs.readFileSync(path.join(__dirname, "billing.html"), "utf-8");
const settingsHtml = fs.readFileSync(path.join(__dirname, "settings.html"), "utf-8");
const robotsTxt = fs.readFileSync(path.join(__dirname, "robots.txt"), "utf-8");
const sitemapXml = fs.readFileSync(path.join(__dirname, "sitemap.xml"), "utf-8");

function makeRequest(pathName, method = "GET", headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "127.0.0.1",
      port: 0,
      path: pathName,
      method,
      headers,
    };

    const srv = http.createServer(server.listeners("request")[0]);
    srv.listen(0, "127.0.0.1", () => {
      const address = srv.address();
      options.port = address.port;

      const req = http.request(options, (res) => {
        let rawData = "";
        res.on("data", (chunk) => {
          rawData += chunk;
        });
        res.on("end", () => {
          srv.close(() => {
            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              body: rawData,
            });
          });
        });
      });

      req.on("error", (err) => {
        srv.close(() => reject(err));
      });

      req.end();
    });
  });
}

// =====================================================================
// Phase 12C: SEO Test Suite
// =====================================================================

test("SEO 1. GET /robots.txt returns 200 publicly", async () => {
  const res = await makeRequest("/robots.txt", "GET");
  assert.strictEqual(res.statusCode, 200);
});

test("SEO 2. robots.txt Content-Type is text/plain", async () => {
  const res = await makeRequest("/robots.txt", "GET");
  assert.match(res.headers["content-type"] || "", /text\/plain/i);
});

test("SEO 3. robots.txt contains User-agent: *", () => {
  assert.match(robotsTxt, /User-agent:\s*\*/i);
});

test("SEO 4. robots.txt allows public routes (/ , /index.html, /login.html)", () => {
  assert.match(robotsTxt, /Allow:\s*\/\s*$/m);
  assert.match(robotsTxt, /Allow:\s*\/index\.html/m);
  assert.match(robotsTxt, /Allow:\s*\/login\.html/m);
});

test("SEO 5. robots.txt disallows protected routes (/dashboard, /clients, /matching, /search, /billing, /settings, /api/)", () => {
  assert.match(robotsTxt, /Disallow:\s*\/dashboard/i);
  assert.match(robotsTxt, /Disallow:\s*\/clients/i);
  assert.match(robotsTxt, /Disallow:\s*\/client-detail\.html/i);
  assert.match(robotsTxt, /Disallow:\s*\/matching/i);
  assert.match(robotsTxt, /Disallow:\s*\/search/i);
  assert.match(robotsTxt, /Disallow:\s*\/billing/i);
  assert.match(robotsTxt, /Disallow:\s*\/settings/i);
  assert.match(robotsTxt, /Disallow:\s*\/api\//i);
});

test("SEO 6. robots.txt references sitemap.xml", () => {
  assert.match(robotsTxt, /Sitemap:\s*https:\/\/freelanceos\.com\/sitemap\.xml/i);
});

test("SEO 7. GET /sitemap.xml returns 200 publicly", async () => {
  const res = await makeRequest("/sitemap.xml", "GET");
  assert.strictEqual(res.statusCode, 200);
});

test("SEO 8. sitemap.xml Content-Type is application/xml", async () => {
  const res = await makeRequest("/sitemap.xml", "GET");
  assert.match(res.headers["content-type"] || "", /application\/xml/i);
});

test("SEO 9. sitemap.xml is well-formed XML with valid urlset namespace", () => {
  assert.match(sitemapXml, /<\?xml\s+version="1\.0"\s+encoding="UTF-8"\?>/i);
  assert.match(
    sitemapXml,
    /<urlset\s+xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/i,
  );
  assert.match(sitemapXml, /<\/urlset>/i);
});

test("SEO 10. sitemap.xml contains public URLs with valid priorities and change frequencies", () => {
  assert.match(sitemapXml, /<loc>https:\/\/freelanceos\.com\/<\/loc>/);
  assert.match(sitemapXml, /<priority>1\.0<\/priority>/);
  assert.match(sitemapXml, /<changefreq>weekly<\/changefreq>/);

  assert.match(sitemapXml, /<loc>https:\/\/freelanceos\.com\/index\.html<\/loc>/);
  assert.match(sitemapXml, /<priority>0\.8<\/priority>/);
  assert.match(sitemapXml, /<changefreq>monthly<\/changefreq>/);

  assert.match(sitemapXml, /<loc>https:\/\/freelanceos\.com\/login.html<\/loc>/);
  assert.match(sitemapXml, /<priority>0\.5<\/priority>/);
  assert.match(sitemapXml, /<changefreq>monthly<\/changefreq>/);
});

test("SEO 11. sitemap.xml does NOT contain private application routes or API endpoints", () => {
  assert.strictEqual(sitemapXml.includes("/dashboard"), false);
  assert.strictEqual(sitemapXml.includes("/clients"), false);
  assert.strictEqual(sitemapXml.includes("/matching"), false);
  assert.strictEqual(sitemapXml.includes("/search"), false);
  assert.strictEqual(sitemapXml.includes("/billing"), false);
  assert.strictEqual(sitemapXml.includes("/settings"), false);
  assert.strictEqual(sitemapXml.includes("/api/"), false);
});

test("SEO 12. landing.html contains canonical URL link pointing to https://freelanceos.com/", () => {
  assert.match(
    landingHtml,
    /<link\s+rel="canonical"\s+href="https:\/\/freelanceos\.com\/"\s*\/?>/i,
  );
});

test("SEO 13. landing.html contains required OpenGraph metadata tags", () => {
  assert.match(landingHtml, /<meta\s+property="og:type"\s+content="website"\s*\/?>/i);
  assert.match(
    landingHtml,
    /<meta\s+property="og:url"\s+content="https:\/\/freelanceos\.com\/"\s*\/?>/i,
  );
  assert.match(
    landingHtml,
    /<meta\s+property="og:title"\s+content="FreelanceOS — The AI Operating System for Freelancers"\s*\/?>/i,
  );
  assert.match(landingHtml, /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/i);
  assert.match(landingHtml, /<meta\s+property="og:site_name"\s+content="FreelanceOS"\s*\/?>/i);
});

test("SEO 14. landing.html contains required Twitter Card metadata tags", () => {
  assert.match(landingHtml, /<meta\s+name="twitter:card"\s+content="summary_large_image"\s*\/?>/i);
  assert.match(
    landingHtml,
    /<meta\s+name="twitter:url"\s+content="https:\/\/freelanceos\.com\/"\s*\/?>/i,
  );
  assert.match(
    landingHtml,
    /<meta\s+name="twitter:title"\s+content="FreelanceOS — The AI Operating System for Freelancers"\s*\/?>/i,
  );
  assert.match(landingHtml, /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/i);
});

test("SEO 15. landing.html contains valid static JSON-LD SoftwareApplication structured data", () => {
  const jsonLdMatch = landingHtml.match(
    /<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/i,
  );
  assert.ok(jsonLdMatch, "JSON-LD script tag must exist");

  const parsed = JSON.parse(jsonLdMatch[1].trim());
  assert.strictEqual(parsed["@context"], "https://schema.org");
  assert.strictEqual(parsed["@type"], "SoftwareApplication");
  assert.strictEqual(parsed.name, "FreelanceOS");
  assert.strictEqual(parsed.applicationCategory, "BusinessApplication");
  assert.strictEqual(parsed.operatingSystem, "Web, Chrome Extension");
  assert.ok(parsed.description);

  assert.ok(Array.isArray(parsed.offers));
  const starterOffer = parsed.offers.find((o) => o.name === "Starter");
  assert.ok(starterOffer);
  assert.strictEqual(starterOffer.price, "0");

  const proOffer = parsed.offers.find((o) => o.name === "Pro");
  assert.ok(proOffer);
  assert.strictEqual(proOffer.price, "29");

  // Verify no fabricated ratings or review metrics exist
  assert.strictEqual(parsed.aggregateRating, undefined);
  assert.strictEqual(parsed.review, undefined);
  assert.strictEqual(parsed.ratingValue, undefined);
});

test('SEO 16. Protected application pages contain <meta name="robots" content="noindex, nofollow">', () => {
  const protectedPages = [
    { name: "dashboard.html", content: dashboardHtml },
    { name: "clients.html", content: clientsHtml },
    { name: "client-detail.html", content: clientDetailHtml },
    { name: "matching.html", content: matchingHtml },
    { name: "search.html", content: searchHtml },
    { name: "billing.html", content: billingHtml },
    { name: "settings.html", content: settingsHtml },
  ];

  protectedPages.forEach(({ name, content }) => {
    assert.match(
      content,
      /<meta\s+name="robots"\s+content="noindex,\s*nofollow"\s*\/?>/i,
      `${name} must contain noindex, nofollow robots meta`,
    );
  });
});

test("SEO 17. Public pages (landing, index, login) do NOT contain noindex robots directive", () => {
  assert.strictEqual(/<meta\s+name="robots"\s+content="[^"]*noindex/i.test(landingHtml), false);
  assert.strictEqual(/<meta\s+name="robots"\s+content="[^"]*noindex/i.test(indexHtml), false);
  assert.strictEqual(/<meta\s+name="robots"\s+content="[^"]*noindex/i.test(loginHtml), false);
});

test("SEO 18. SEO assets contain zero secret keys, tokens, or credentials", () => {
  const combined = robotsTxt + " " + sitemapXml + " " + landingHtml;
  assert.strictEqual(combined.includes("sk_live_"), false);
  assert.strictEqual(combined.includes("sk_test_"), false);
  assert.strictEqual(combined.includes("stripe_price_"), false);
  assert.strictEqual(combined.includes("passwordHash"), false);
  assert.strictEqual(combined.includes("refreshTokenHash"), false);
});

test("SEO 19. SEO assets contain zero private tenant or user database identifiers", () => {
  const combined = robotsTxt + " " + sitemapXml;
  assert.strictEqual(combined.includes("tenant_"), false);
  assert.strictEqual(combined.includes("user-123"), false);
  assert.strictEqual(combined.includes("TopSecretClientCorp"), false);
});
