import * as esbuild from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runBuild() {
  console.log("Building FreelanceOS Web (React + TypeScript)...");
  try {
    await esbuild.build({
      entryPoints: [path.join(__dirname, "src", "index.tsx")],
      bundle: true,
      outfile: path.join(__dirname, "dist", "bundle.js"),
      format: "esm",
      target: "es2022",
      sourcemap: true,
      platform: "browser",
      define: {
        "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV || "development"),
      },
    });
    console.log("Build completed successfully -> dist/bundle.js");
  } catch (err) {
    console.error("Build failed:", err);
    process.exit(1);
  }
}

runBuild();
