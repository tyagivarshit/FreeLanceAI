import { test, describe } from "node:test";
import assert from "node:assert";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { sanitizePrivateData } from "../src/storage/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const extensionRoot = path.resolve(__dirname, "../..");
const repoRoot = path.resolve(extensionRoot, "../..");

describe("Phase 12D — Chrome Web Store Readiness Test Suite", () => {
  const manifestPath = path.join(extensionRoot, "manifest.json");
  const manifestRaw = fs.readFileSync(manifestPath, "utf-8");
  const manifest = JSON.parse(manifestRaw);

  // =========================================================================
  // 1. Manifest V3 & Metadata Structure
  // =========================================================================
  describe("1. Manifest V3 & Store Metadata", () => {
    test("manifest.json exists, is valid JSON, and specifies manifest_version 3", () => {
      assert.ok(fs.existsSync(manifestPath), "manifest.json must exist");
      assert.strictEqual(manifest.manifest_version, 3, "manifest_version must be exactly 3");
    });

    test("Manifest contains valid name, description, and semantic version", () => {
      assert.ok(manifest.name && typeof manifest.name === "string", "name is required");
      assert.ok(manifest.name.length > 0, "name must not be empty");
      assert.ok(
        manifest.description && typeof manifest.description === "string",
        "description is required",
      );
      assert.ok(manifest.description.length > 0, "description must not be empty");
      assert.ok(manifest.version && typeof manifest.version === "string", "version is required");
      assert.match(manifest.version, /^\d+\.\d+\.\d+/, "version must be valid semver");
    });

    test("Manifest declares valid action popup and options page", () => {
      assert.ok(manifest.action?.default_popup, "action.default_popup must be declared");
      const popupPath = path.join(extensionRoot, manifest.action.default_popup);
      assert.ok(fs.existsSync(popupPath), `Popup file not found at: ${popupPath}`);

      assert.ok(manifest.options_page, "options_page must be declared");
      const optionsPath = path.join(extensionRoot, manifest.options_page);
      assert.ok(fs.existsSync(optionsPath), `Options page file not found at: ${optionsPath}`);
    });

    test("Manifest declares module-based service worker", () => {
      assert.ok(manifest.background?.service_worker, "background.service_worker must be declared");
      assert.strictEqual(manifest.background?.type, "module", "service worker must be type module");
    });
  });

  // =========================================================================
  // 2. Permission Least-Privilege Verification
  // =========================================================================
  describe("2. Permission Least-Privilege & Boundary Enforcement", () => {
    test("Permissions are strictly limited to the minimal approved list (storage only)", () => {
      const approvedPermissions = ["storage"];
      const requestedPermissions: string[] = manifest.permissions || [];

      for (const perm of requestedPermissions) {
        assert.ok(
          approvedPermissions.includes(perm),
          `Unauthorized permission requested in manifest: ${perm}`,
        );
      }
    });

    test("Prohibited high-risk browser permissions are completely excluded", () => {
      const prohibitedPermissions = [
        "tabs",
        "cookies",
        "webRequest",
        "webRequestBlocking",
        "webNavigation",
        "management",
        "nativeMessaging",
        "geolocation",
        "clipboardRead",
        "clipboardWrite",
        "debugger",
        "privacy",
        "proxy",
      ];
      const requestedPermissions: string[] = manifest.permissions || [];

      for (const prohibited of prohibitedPermissions) {
        assert.strictEqual(
          requestedPermissions.includes(prohibited),
          false,
          `High-risk permission '${prohibited}' must not be declared`,
        );
      }
    });

    test("Host permissions are strictly restricted to Upwork, LinkedIn, and backend API", () => {
      const requestedHosts: string[] = manifest.host_permissions || [];
      assert.ok(
        requestedHosts.length > 0,
        "Host permissions must be declared for platform adapters",
      );

      for (const host of requestedHosts) {
        assert.notStrictEqual(host, "<all_urls>", "<all_urls> wildcard is prohibited");
        assert.notStrictEqual(host, "*://*/*", "*://*/* broad wildcard is prohibited");
        assert.notStrictEqual(host, "http://*/*", "http broad wildcard is prohibited");
        assert.notStrictEqual(host, "https://*/*", "https broad wildcard is prohibited");

        const isAllowedDomain =
          host.includes("upwork.com") ||
          host.includes("linkedin.com") ||
          host.includes("localhost") ||
          host.includes("freelanceos.com");

        assert.ok(isAllowedDomain, `Unapproved host domain requested: ${host}`);
      }
    });
  });

  // =========================================================================
  // 3. Security, CSP & Remote Code Checks
  // =========================================================================
  describe("3. CSP, Remote Code & Code Safety", () => {
    test("CSP enforces script-src 'self' and object-src 'self' without unsafe-eval", () => {
      const csp = manifest.content_security_policy?.extension_pages;
      assert.ok(csp, "content_security_policy.extension_pages must be configured");

      assert.strictEqual(csp.includes("unsafe-eval"), false, "CSP must not allow 'unsafe-eval'");
      assert.strictEqual(
        csp.includes("unsafe-inline"),
        false,
        "CSP must not allow 'unsafe-inline'",
      );

      const tokens = csp.split(";").map((t: string) => t.trim());
      for (const token of tokens) {
        if (token.startsWith("script-src")) {
          const sources = token.split(/\s+/).slice(1);
          for (const src of sources) {
            assert.ok(
              src === "'self'" || src === "'none'" || src === "'wasm-unsafe-eval'",
              `Disallowed script-src token: ${src}`,
            );
          }
        }
      }
    });

    test("Source code contains zero eval, new Function, or remote script injection", () => {
      const srcDir = path.join(extensionRoot, "src");
      const files = fs.readdirSync(srcDir, { recursive: true }) as string[];

      for (const file of files) {
        const fullPath = path.join(srcDir, file);
        if (fs.statSync(fullPath).isFile() && fullPath.endsWith(".ts")) {
          const content = fs.readFileSync(fullPath, "utf-8");

          assert.strictEqual(
            /\beval\s*\(/.test(content),
            false,
            `Prohibited eval() call found in ${file}`,
          );
          assert.strictEqual(
            /\bnew\s+Function\s*\(/.test(content),
            false,
            `Prohibited new Function() found in ${file}`,
          );
          assert.strictEqual(
            /document\.write\s*\(/.test(content),
            false,
            `Prohibited document.write() found in ${file}`,
          );
          assert.strictEqual(
            /https?:\/\/.*\.js/.test(content),
            false,
            `Prohibited remote JS reference found in ${file}`,
          );
        }
      }
    });

    test("Source code contains zero secret keys or credentials", () => {
      const srcDir = path.join(extensionRoot, "src");
      const files = fs.readdirSync(srcDir, { recursive: true }) as string[];

      for (const file of files) {
        const fullPath = path.join(srcDir, file);
        if (fs.statSync(fullPath).isFile() && fullPath.endsWith(".ts")) {
          const content = fs.readFileSync(fullPath, "utf-8");

          assert.strictEqual(content.includes("sk_live_"), false, `Live stripe key in ${file}`);
          assert.strictEqual(content.includes("sk_test_"), false, `Test stripe key in ${file}`);
          assert.strictEqual(
            /password\s*=\s*["'][^"']{5,}["']/i.test(content),
            false,
            `Hardcoded password in ${file}`,
          );
          assert.strictEqual(
            /jwt_secret\s*=\s*["'][^"']{5,}["']/i.test(content),
            false,
            `JWT secret in ${file}`,
          );
        }
      }
    });
  });

  // =========================================================================
  // 4. Privacy & Sensitive Field Sanitization
  // =========================================================================
  describe("4. Privacy Boundary & Credential Sanitization", () => {
    test("sanitizePrivateData strips tokens, passwords, cookies, and auth headers", () => {
      const rawPayload = {
        id: "job-101",
        title: "Senior Fullstack Engineer",
        description: "Build Next.js app",
        accessToken: "secret_access_token_123",
        refreshToken: "secret_refresh_token_456",
        password: "super_secret_password",
        cookie: "session=xyz",
        authorization: "Bearer sensitive_token",
        nested: {
          skills: ["React", "Node.js"],
          AccessToken: "nested_token",
          Cookie: "nested_cookie",
          safeMeta: "valid_info",
        },
      };

      const sanitized = sanitizePrivateData(rawPayload) as typeof rawPayload;

      assert.strictEqual(sanitized.id, "job-101");
      assert.strictEqual(sanitized.title, "Senior Fullstack Engineer");
      assert.strictEqual((sanitized as Record<string, unknown>).accessToken, undefined);
      assert.strictEqual((sanitized as Record<string, unknown>).refreshToken, undefined);
      assert.strictEqual((sanitized as Record<string, unknown>).password, undefined);
      assert.strictEqual((sanitized as Record<string, unknown>).cookie, undefined);
      assert.strictEqual((sanitized as Record<string, unknown>).authorization, undefined);

      assert.deepStrictEqual(sanitized.nested.skills, ["React", "Node.js"]);
      assert.strictEqual(sanitized.nested.safeMeta, "valid_info");
      assert.strictEqual((sanitized.nested as Record<string, unknown>).AccessToken, undefined);
      assert.strictEqual((sanitized.nested as Record<string, unknown>).Cookie, undefined);
    });
  });

  // =========================================================================
  // 5. Store Documentation Verification
  // =========================================================================
  describe("5. Store Documentation & Policy Files", () => {
    test("docs/chrome-store-listing.md exists and contains required listing copy", () => {
      const listingPath = path.join(repoRoot, "docs", "chrome-store-listing.md");
      assert.ok(fs.existsSync(listingPath), "docs/chrome-store-listing.md must exist");
      const content = fs.readFileSync(listingPath, "utf-8");

      assert.match(content, /Single-Purpose Statement/i);
      assert.match(content, /Short Description/i);
      assert.match(content, /Detailed Description/i);
      assert.match(content, /Upwork/i);
      assert.match(content, /LinkedIn/i);
      assert.match(content, /Visual Asset Specifications/i);
      assert.match(content, /16x16/i);
      assert.match(content, /48x48/i);
      assert.match(content, /128x128/i);
      assert.match(content, /1280\s*×\s*800/i);
    });

    test("docs/chrome-store-permission-justification.md exists and contains reviewer justifications", () => {
      const justPath = path.join(repoRoot, "docs", "chrome-store-permission-justification.md");
      assert.ok(
        fs.existsSync(justPath),
        "docs/chrome-store-permission-justification.md must exist",
      );
      const content = fs.readFileSync(justPath, "utf-8");

      assert.match(content, /storage/i);
      assert.match(content, /upwork\.com/i);
      assert.match(content, /linkedin\.com/i);
      assert.match(content, /Omitted High-Risk Permissions/i);
      assert.match(content, /<all_urls>/i);
      assert.match(content, /tabs/i);
      assert.match(content, /cookies/i);
    });

    test("docs/chrome-store-privacy-disclosure.md exists and contains data safety declarations", () => {
      const privPath = path.join(repoRoot, "docs", "chrome-store-privacy-disclosure.md");
      assert.ok(fs.existsSync(privPath), "docs/chrome-store-privacy-disclosure.md must exist");
      const content = fs.readFileSync(privPath, "utf-8");

      assert.match(content, /Single-Purpose/i);
      assert.match(content, /Public Job Data Extracted/i);
      assert.match(content, /Data NOT Accessed/i);
      assert.match(content, /sanitizePrivateData/i);
      assert.match(content, /24 hours/i);
      assert.match(content, /IndexedDB/i);
    });
  });

  // =========================================================================
  // 6. Build & Packaging Validation
  // =========================================================================
  describe("6. Build & Packaging Integrity", () => {
    test("Manifest version matches package.json version", () => {
      const pkgPath = path.join(extensionRoot, "package.json");
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      assert.strictEqual(manifest.version, pkg.version);
    });

    test("All manifest referenced files exist in repository", () => {
      if (manifest.action?.default_popup) {
        assert.ok(fs.existsSync(path.join(extensionRoot, manifest.action.default_popup)));
      }
      if (manifest.options_page) {
        assert.ok(fs.existsSync(path.join(extensionRoot, manifest.options_page)));
      }
      if (manifest.background?.service_worker) {
        const swPath = path.join(extensionRoot, manifest.background.service_worker);
        const tsSwPath = path.join(
          extensionRoot,
          manifest.background.service_worker.replace("dist/", "").replace(/\.js$/, ".ts"),
        );
        assert.ok(fs.existsSync(swPath) || fs.existsSync(tsSwPath));
      }
    });
  });
});
