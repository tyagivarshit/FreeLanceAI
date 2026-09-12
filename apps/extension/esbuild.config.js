import * as esbuild from "esbuild";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function build() {
  console.log("[FreelanceOS] Starting surgical esbuild pipeline...");

  // Copy manifest and static assets to dist first
  if (!fs.existsSync("dist")) {
    fs.mkdirSync("dist", { recursive: true });
  }
  
  if (fs.existsSync("manifest.json")) {
    fs.copyFileSync("manifest.json", "dist/manifest.json");
  }
  
  if (fs.existsSync("src/icons")) {
    fs.cpSync("src/icons", "dist/icons", { recursive: true });
  }
  
  // Create dummy icons if they don't exist to prevent extension load failure
  if (!fs.existsSync("dist/icons")) {
    fs.mkdirSync("dist/icons", { recursive: true });
    fs.writeFileSync("dist/icons/icon16.png", "");
    fs.writeFileSync("dist/icons/icon48.png", "");
    fs.writeFileSync("dist/icons/icon128.png", "");
  }
  
  try {
    // 2. NATIVE ESBUILD SURGICAL BUNDLER
    await esbuild.build({
      entryPoints: [
        "src/background.ts",
        "src/content-script.ts"
      ],
      bundle: true,
      outdir: "dist",
      platform: "browser",
      target: ["es2022"],
      format: "esm",
      minify: true,
      
      // Completely disable eval source mapping styles for MV3 Content Security Policy compliance
      sourcemap: false, 
      treeShaking: true,
      
      // STUB NODE DRIVERS: 
      // Surgically stub out core Node drivers (Postgres/Redis hooks) to prevent payload bloat.
      alias: {
        "pg": "./src/__mock__/empty.js",
        "ioredis": "./src/__mock__/empty.js",
        "crypto": "./src/__mock__/crypto-polyfill.js"
      },
      
      external: ["fs", "path", "os"]
    });
    
    console.log("[FreelanceOS] Build complete. Manifest V3 artifacts deployed to dist/.");
  } catch (err) {
    console.error("Build failed:", err);
    process.exit(1);
  }
}

build();
