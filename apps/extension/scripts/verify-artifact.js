import fs from "fs";
import path from "path";

const distPath = path.resolve("dist");
const manifestPath = path.join(distPath, "manifest.json");

if (!fs.existsSync(manifestPath)) {
  console.error("FAIL: dist/manifest.json does not exist");
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
let hasErrors = false;

function verify(relPath, desc) {
  if (relPath.startsWith("dist/")) {
    console.error(`FAIL: ${desc} contains dist/ prefix: ${relPath}`);
    hasErrors = true;
  }
  const resolved = path.resolve(distPath, relPath);
  if (!resolved.startsWith(distPath)) {
    console.error(`FAIL: ${desc} points outside dist: ${relPath}`);
    hasErrors = true;
  }
  if (!fs.existsSync(resolved)) {
    console.error(`FAIL: ${desc} file not found: ${resolved}`);
    hasErrors = true;
  } else {
    console.log(`PASS: ${desc} -> ${relPath}`);
  }
}

// Background
if (manifest.background?.service_worker) {
  verify(manifest.background.service_worker, "background.service_worker");
}

// Content Scripts
if (manifest.content_scripts) {
  manifest.content_scripts.forEach((cs, i) => {
    cs.js?.forEach((js, j) => {
      verify(js, `content_scripts[${i}].js[${j}]`);
    });
  });
}

// Popup
if (manifest.action?.default_popup) {
  verify(manifest.action.default_popup, "action.default_popup");
}

// Options
if (manifest.options_page) {
  verify(manifest.options_page, "options_page");
}

// Icons
if (manifest.icons) {
  for (const [size, iconPath] of Object.entries(manifest.icons)) {
    verify(iconPath, `icons[${size}]`);
  }
}

// Web Accessible Resources
if (manifest.web_accessible_resources) {
  manifest.web_accessible_resources.forEach((war, i) => {
    war.resources?.forEach((res, j) => {
      // wildcards are tricky to verify directly, just checking no dist/ prefix
      if (res.startsWith("dist/")) {
        console.error(`FAIL: web_accessible_resources[${i}].resources[${j}] contains dist/: ${res}`);
        hasErrors = true;
      } else {
        console.log(`PASS: web_accessible_resources[${i}].resources[${j}] -> ${res}`);
      }
    });
  });
}

if (hasErrors) {
  console.error("MANIFEST VALIDATION FAILED");
  process.exit(1);
} else {
  console.log("MANIFEST VALIDATION PASSED");
}
