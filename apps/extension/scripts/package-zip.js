import archiver from "archiver";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function packageZip() {
  console.log("[FreelanceOS] Initiating Chrome Web Store ZIP compilation...");

  const outputDir = path.resolve(__dirname, "..");
  const zipFilePath = path.join(outputDir, "extension-release.zip");
  
  const output = fs.createWriteStream(zipFilePath);
  
  // 3. AUTOMATED PRODUCTION COMPRESSION COMPONENT
  // Uses archiver module to bundle final output into a standalone zip package
  const archive = archiver("zip", {
    zlib: { level: 9 } // Maximum compression ratio
  });

  output.on("close", () => {
    console.log(`[FreelanceOS] Standalone package created: extension-release.zip`);
    console.log(`[FreelanceOS] Total size: ${(archive.pointer() / 1024).toFixed(2)} KB`);
    console.log(`[FreelanceOS] Ready for Chrome Web Store Developer Console deployment.`);
  });

  archive.on("error", (err) => {
    throw err;
  });

  archive.pipe(output);

  // Bundle the bundled dist folder (which contains only V3 safe binaries and static assets)
  archive.directory(path.join(outputDir, "dist"), false);
  
  await archive.finalize();
}

packageZip();
