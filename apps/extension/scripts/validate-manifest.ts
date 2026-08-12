/* eslint-disable no-console, @typescript-eslint/no-explicit-any */
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const extensionRoot = path.resolve(__dirname, "../..");

function logSuccess(msg: string) {
  console.log(`\x1b[32m✔ ${msg}\x1b[0m`);
}

function logFail(msg: string) {
  console.error(`\x1b[31m✖ Validation Failed: ${msg}\x1b[0m`);
  process.exit(1);
}

// 1. Check Manifest Exists & parses
const manifestPath = path.join(extensionRoot, "manifest.json");
if (!fs.existsSync(manifestPath)) {
  logFail("manifest.json does not exist in root.");
}

let manifest: any;
try {
  const content = fs.readFileSync(manifestPath, "utf-8");
  manifest = JSON.parse(content);
} catch (err: any) {
  logFail(`manifest.json is not valid JSON: ${err.message}`);
}

logSuccess("manifest.json parsed successfully.");

// 2. manifest_version
if (manifest.manifest_version !== 3) {
  logFail(`manifest_version must be exactly 3. Found: ${manifest.manifest_version}`);
}
logSuccess("Manifest V3 verified.");

// 3. Metadata
if (!manifest.name || manifest.name.trim() === "") {
  logFail("manifest.json name is missing or empty.");
}
if (!manifest.description || manifest.description.trim() === "") {
  logFail("manifest.json description is missing or empty.");
}
if (!manifest.version || manifest.version.trim() === "") {
  logFail("manifest.json version is missing or empty.");
}
logSuccess("Required metadata exists.");

// 4. Version Consistency
const packagePath = path.join(extensionRoot, "package.json");
let pkg: any;
try {
  pkg = JSON.parse(fs.readFileSync(packagePath, "utf-8"));
} catch (err: any) {
  logFail(`package.json parsing error: ${err.message}`);
}
if (manifest.version !== pkg.version) {
  logFail(
    `Version mismatch! manifest.json version is ${manifest.version} but package.json version is ${pkg.version}`,
  );
}
logSuccess(`Version consistency verified: ${manifest.version}`);

// 5. File Integrity check
const checkFileExists = (relPath: string) => {
  // Normalize dist/ references to actual built assets or source files for validation
  const targetPath = path.join(extensionRoot, relPath);
  if (relPath.startsWith("dist/")) {
    // If it's a built JS asset, check both typescript source or transpiled asset
    const srcPath = path.join(extensionRoot, relPath.replace("dist/", "").replace(/\.js$/, ".ts"));
    if (!fs.existsSync(targetPath) && !fs.existsSync(srcPath)) {
      logFail(`Referenced resource does not exist in source or build directory: ${relPath}`);
    }
  } else {
    if (!fs.existsSync(targetPath)) {
      logFail(`Referenced resource does not exist: ${relPath}`);
    }
  }
};

// Check UI popup html
if (manifest.action?.default_popup) {
  checkFileExists(manifest.action.default_popup);
}
// Check Options html
if (manifest.options_page) {
  checkFileExists(manifest.options_page);
}
// Check Service Worker
if (manifest.background?.service_worker) {
  checkFileExists(manifest.background.service_worker);
}
// Check Content Scripts
if (manifest.content_scripts) {
  for (const cs of manifest.content_scripts) {
    if (cs.js) {
      for (const jsFile of cs.js) {
        checkFileExists(jsFile);
      }
    }
  }
}
logSuccess("Manifest file references verified.");

// 6. Security Boundaries / CSP
const csp = manifest.content_security_policy?.extension_pages;
if (csp) {
  if (csp.includes("unsafe-eval")) {
    logFail("Security violation: extension_pages CSP contains 'unsafe-eval'.");
  }
  if (csp.includes("http://") || csp.includes("https://") || csp.includes("*")) {
    // Check if it includes remote script sources
    const tokens = csp.split(";").map((t: string) => t.trim());
    for (const token of tokens) {
      if (token.startsWith("script-src")) {
        const sources = token.split(/\s+/).slice(1);
        for (const src of sources) {
          if (src !== "'self'" && src !== "'none'" && src !== "'wasm-unsafe-eval'") {
            logFail(`Security violation: script-src contains remote or unsafe source: ${src}`);
          }
        }
      }
    }
  }
}
logSuccess("CSP security verification passed.");

// 7. Permissions checks
const approvedPermissions = ["storage"];
if (manifest.permissions) {
  for (const perm of manifest.permissions) {
    if (!approvedPermissions.includes(perm)) {
      logFail(`Security violation: unauthorized or speculative permission requested: ${perm}`);
    }
  }
}
logSuccess("Approved browser permissions only.");

// 8. Host permissions wildcards check
if (manifest.host_permissions) {
  for (const host of manifest.host_permissions) {
    if (host === "<all_urls>" || host === "*://*/*") {
      logFail("Security violation: global wildcards (<all_urls>) are forbidden.");
    }
  }
}
logSuccess("Least privilege host permissions verified.");

// 9. Environment validation on config.ts
const configSrcPath = path.join(extensionRoot, "src", "config.ts");
if (fs.existsSync(configSrcPath)) {
  const configText = fs.readFileSync(configSrcPath, "utf-8");
  const envMatch = configText.match(/CURRENT_ENV:\s*ExtensionEnv\s*=\s*["']([^"']+)["']/);
  if (envMatch) {
    const activeEnv = envMatch[1];
    if (activeEnv === "production") {
      // In production config, verify API Url does not point to local development port
      const urlMatch = configText.match(/production:\s*["']([^"']+)["']/);
      if (urlMatch && urlMatch[1]?.includes("localhost")) {
        logFail(
          "Build aborted: production environment config points to local development localhost.",
        );
      }
    }
  }
}
logSuccess("Environment settings validation passed.");

// 10. Secrets and credentials scanning
const scanFileForSecrets = (filePath: string) => {
  const content = fs.readFileSync(filePath, "utf-8");
  // Simple regex scans for suspicious assignment signatures
  const secretPatterns = [
    /api_key\s*=\s*["'][A-Za-z0-9_-]{10,}["']/i,
    /apikey\s*=\s*["'][A-Za-z0-9_-]{10,}["']/i,
    /password\s*=\s*["'][^"']{4,}["']/i,
    /jwt_secret\s*=\s*["'][^"']{8,}["']/i,
    /private_key\s*=\s*["'][^"']{20,}["']/i,
  ];

  for (const pattern of secretPatterns) {
    if (pattern.test(content)) {
      logFail(
        `Secret leakage warning: suspicious credentials found in ${path.relative(extensionRoot, filePath)}`,
      );
    }
  }
};

const srcDir = path.join(extensionRoot, "src");
if (fs.existsSync(srcDir)) {
  const files = fs.readdirSync(srcDir);
  for (const file of files) {
    const fullPath = path.join(srcDir, file);
    if (fs.statSync(fullPath).isFile() && (file.endsWith(".ts") || file.endsWith(".html"))) {
      scanFileForSecrets(fullPath);
    }
  }
}
logSuccess("Secret scanning completed. No secrets detected.");

console.log("\x1b[32m✔ Extension packaging validation succeeded.\x1b[0m");
