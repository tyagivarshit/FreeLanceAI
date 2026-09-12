const fs = require('fs');

let serverJs = fs.readFileSync('apps/web/server.js', 'utf8');

const imports = `import busboy from "busboy";
import { fileTypeFromBuffer } from "file-type";
import { StorageClient } from "@freelanceos/storage";
import { PostgresAttachmentRepository } from "@freelanceos/db";
import { Attachment, AttachmentMetadata, AttachmentVisibility } from "@freelanceos/core";
`;

serverJs = serverJs.replace('import http from "http";', 'import http from "http";\n' + imports);

// Add initialization of repo and client
const initCode = `
const storageClient = new StorageClient({
  accountId: runtimeConfig.R2_ACCOUNT_ID,
  accessKeyId: runtimeConfig.R2_ACCESS_KEY_ID,
  secretAccessKey: runtimeConfig.R2_SECRET_ACCESS_KEY,
  bucketName: runtimeConfig.R2_BUCKET_NAME,
  endpoint: runtimeConfig.R2_ENDPOINT,
});
const attachmentRepo = new PostgresAttachmentRepository(db);
`;

serverJs = serverJs.replace('const clientRepo = new PostgresClientRepository(db);', initCode + '\nconst clientRepo = new PostgresClientRepository(db);');

// Add Route Logic
const routeLogic = `
  // POST /api/attachments
  if (pathname === "/api/attachments" && req.method === "POST") {
    const auth = await authenticateRequest(req, res);
    if (!auth) return;
    const userId = auth.userId;

    const bb = busboy({ headers: req.headers, limits: { fileSize: 25 * 1024 * 1024 } });
    
    let uploadedFile = null;
    let fileBuffer = null;
    let metadataField = null;

    bb.on('file', (name, file, info) => {
      const chunks = [];
      file.on('data', data => chunks.push(data));
      file.on('end', () => {
        if (file.truncated) {
          res.writeHead(413, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: false, error: "File too large (max 25MB)" }));
          return;
        }
        fileBuffer = Buffer.concat(chunks);
        uploadedFile = info;
      });
    });

    bb.on('field', (name, val) => {
      if (name === 'metadata') metadataField = val;
    });

    bb.on('close', async () => {
      if (!fileBuffer) {
        if (!res.writableEnded) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: false, error: "No file provided" }));
        }
        return;
      }

      try {
        const typeInfo = await fileTypeFromBuffer(fileBuffer);
        if (!typeInfo) {
           res.writeHead(400, { "Content-Type": "application/json" });
           res.end(JSON.stringify({ success: false, error: "Could not determine file type" }));
           return;
        }
        
        // Example check: block executables
        if (['exe', 'sh', 'bat'].includes(typeInfo.ext)) {
           res.writeHead(400, { "Content-Type": "application/json" });
           res.end(JSON.stringify({ success: false, error: "Executable files are not allowed" }));
           return;
        }

        const storageKey = randomUUID();
        const mimeType = typeInfo.mime;
        
        // Parse incoming metadata (e.g., parentId, reference)
        let reqMeta = {};
        try {
          if (metadataField) reqMeta = JSON.parse(metadataField);
        } catch (e) {}

        const parentId = reqMeta.parentId || userId;
        const attachmentReference = reqMeta.reference || storageKey;
        
        await storageClient.uploadFile(storageKey, fileBuffer, mimeType);

        // Path traversal is structurally impossible because storageKey is a freshly generated UUID.
        // It has no user-provided content.
        
        const attachmentId = randomUUID();
        const metadata = new AttachmentMetadata({
          displayName: uploadedFile.filename,
          logicalMediaType: mimeType,
          characteristics: "upload",
          description: reqMeta.description || "Uploaded file"
        });
        // inject storage properties which the repo expects
        (metadata as any).storageKey = storageKey;
        (metadata as any).fileSizeBytes = fileBuffer.length;

        const attachment = await Attachment.create(
          attachmentId,
          userId, // tenantId
          parentId,
          userId, // ownerId
          attachmentReference,
          metadata,
          new AttachmentVisibility("StandardClassification"),
          { checkUniqueReference: async (t, r) => (await attachmentRepo.findByReference(r, t)) === null }
        );

        await attachmentRepo.save(attachment);

        res.writeHead(201, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, attachmentId, storageKey }));
      } catch (err) {
        logger.error({ err }, "Upload failed");
        if (err.message.includes("unique")) {
           res.writeHead(409, { "Content-Type": "application/json" });
           res.end(JSON.stringify({ success: false, error: "Duplicate reference" }));
           return;
        }
        if (!res.writableEnded) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: false, error: "Upload failed" }));
        }
      }
    });

    req.pipe(bb);
    return;
  }
`;

serverJs = serverJs.replace('// Static File Hosting', routeLogic + '\n  // Static File Hosting');

fs.writeFileSync('apps/web/server.js', serverJs);
console.log('Patched server.js');
