import { test, describe } from "node:test";
import assert from "node:assert";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const extensionRoot = path.resolve(__dirname, "../..");

describe("Chapter 9A — Extension Manifest V3 & Security Foundation", () => {
  const manifestPath = path.join(extensionRoot, "manifest.json");

  // 1. Manifest parsing
  test("Manifest exists and parses as valid JSON", () => {
    assert.ok(fs.existsSync(manifestPath), "manifest.json should exist");
    const raw = fs.readFileSync(manifestPath, "utf-8");
    const manifest = JSON.parse(raw);
    assert.strictEqual(typeof manifest, "object");
  });

  // 2. MV3 Compatibility
  test("Manifest version must be exactly 3", () => {
    const raw = fs.readFileSync(manifestPath, "utf-8");
    const manifest = JSON.parse(raw);
    assert.strictEqual(manifest.manifest_version, 3);
  });

  // 3. Extension Metadata
  test("Required metadata name, description, and version must be present", () => {
    const raw = fs.readFileSync(manifestPath, "utf-8");
    const manifest = JSON.parse(raw);
    assert.ok(manifest.name && manifest.name.trim() !== "", "Name is required");
    assert.ok(
      manifest.description && manifest.description.trim() !== "",
      "Description is required",
    );
    assert.ok(manifest.version && manifest.version.trim() !== "", "Version is required");
  });

  // 4. Service Worker declaration
  test("Service worker must be declared and the referenced file must exist", () => {
    const raw = fs.readFileSync(manifestPath, "utf-8");
    const manifest = JSON.parse(raw);
    assert.ok(
      manifest.background?.service_worker,
      "Service worker background script must be declared",
    );

    // Check that the referenced background script exists (either typescript source or transpiled js)
    const swPath = path.join(extensionRoot, manifest.background.service_worker);
    const tsSwPath = path.join(
      extensionRoot,
      manifest.background.service_worker.replace("dist/", "").replace(/\.js$/, ".ts"),
    );
    assert.ok(
      fs.existsSync(swPath) || fs.existsSync(tsSwPath),
      `Service worker file not found at: ${manifest.background.service_worker}`,
    );
  });

  // 5. Content Script declarations
  test("Content scripts must be declared and files must exist in source or dist", () => {
    const raw = fs.readFileSync(manifestPath, "utf-8");
    const manifest = JSON.parse(raw);
    assert.ok(Array.isArray(manifest.content_scripts), "content_scripts should be an array");
    assert.ok(
      manifest.content_scripts.length > 0,
      "At least one content script should be declared",
    );

    for (const cs of manifest.content_scripts) {
      assert.ok(
        cs.matches && cs.matches.length > 0,
        "Content script matches rule must be declared",
      );
      if (cs.js) {
        for (const jsFile of cs.js) {
          const jsPath = path.join(extensionRoot, jsFile);
          const tsPath = path.join(
            extensionRoot,
            jsFile.replace("dist/", "").replace(/\.js$/, ".ts"),
          );
          assert.ok(
            fs.existsSync(jsPath) || fs.existsSync(tsPath),
            `Content script file not found: ${jsFile}`,
          );
        }
      }
    }
  });

  // 6. Permission least-privilege
  test("Requested browser permissions are strictly limited to approved set", () => {
    const raw = fs.readFileSync(manifestPath, "utf-8");
    const manifest = JSON.parse(raw);
    const approved = ["storage"];

    if (manifest.permissions) {
      for (const perm of manifest.permissions) {
        assert.ok(approved.includes(perm), `Unauthorized browser permission requested: ${perm}`);
      }
    }
  });

  // 7. Host Permission limits
  test("Host permissions are least-privilege with no broad wildcards", () => {
    const raw = fs.readFileSync(manifestPath, "utf-8");
    const manifest = JSON.parse(raw);

    if (manifest.host_permissions) {
      for (const host of manifest.host_permissions) {
        assert.notStrictEqual(host, "<all_urls>", "Host permissions must not request <all_urls>");
        assert.notStrictEqual(host, "*://*/*", "Host permissions must not request broad wildcards");
      }
    }
  });

  // 8. CSP strict checks
  test("CSP policy must not allow unsafe-eval or remote executable JavaScript", () => {
    const raw = fs.readFileSync(manifestPath, "utf-8");
    const manifest = JSON.parse(raw);
    const csp = manifest.content_security_policy?.extension_pages;

    if (csp) {
      assert.ok(!csp.includes("unsafe-eval"), "CSP must not include 'unsafe-eval'");

      const tokens = csp.split(";").map((t: string) => t.trim());
      for (const token of tokens) {
        if (token.startsWith("script-src")) {
          const sources = token.split(/\s+/).slice(1);
          for (const src of sources) {
            // Only 'self', 'none', and 'wasm-unsafe-eval' are permitted script sources in strict MV3 CSP
            assert.ok(
              src === "'self'" || src === "'none'" || src === "'wasm-unsafe-eval'",
              `Script source '${src}' violates remote code isolation policies.`,
            );
          }
        }
      }
    }
  });

  // 9. Config environmental validation
  test("Production config must not target local development api urls", () => {
    const configPath = path.join(extensionRoot, "src", "config.ts");
    assert.ok(fs.existsSync(configPath), "config.ts must exist");

    const configText = fs.readFileSync(configPath, "utf-8");
    const envMatch = configText.match(/CURRENT_ENV:\s*ExtensionEnv\s*=\s*["']([^"']+)["']/);

    if (envMatch && envMatch[1] === "production") {
      const urlMatch = configText.match(/production:\s*["']([^"']+)["']/);
      assert.ok(urlMatch);
      const productionUrl = urlMatch?.[1];
      assert.ok(productionUrl);
      assert.ok(
        !productionUrl.includes("localhost"),
        "Production apiUrl must not target localhost",
      );
    }
  });

  // 10. Version consistency checks
  test("Manifest version matches workspace package version", () => {
    const rawManifest = fs.readFileSync(manifestPath, "utf-8");
    const manifest = JSON.parse(rawManifest);

    const rawPkg = fs.readFileSync(path.join(extensionRoot, "package.json"), "utf-8");
    const pkg = JSON.parse(rawPkg);

    assert.strictEqual(
      manifest.version,
      pkg.version,
      "Manifest and Package versions must be aligned",
    );
  });

  // 11. Secrets protection check
  test("No secrets or credentials should be present in configuration or source code", () => {
    const configPath = path.join(extensionRoot, "src", "config.ts");
    const content = fs.readFileSync(configPath, "utf-8");

    const secretsKeyworkds = ["apikey", "api_key", "password", "jwt_secret", "private_key"];

    for (const kw of secretsKeyworkds) {
      // Validate that no literal values are assigned to keys containing these names
      const pattern = new RegExp(`${kw}\\s*=\\s*["'][^"']{3,}["']`, "i");
      if (pattern.test(content)) {
        // Assert fail if key name matches standard credential assignments
        assert.fail(
          `Possible secret leakage: credential keyword '${kw}' matches suspicious value signature in config.ts`,
        );
      }
    }
  });
});
