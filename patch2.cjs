const fs = require('fs');
let serverJs = fs.readFileSync('apps/web/server.js', 'utf8');

const deleteRoute = `
  // DELETE /api/attachments
  if (pathname === "/api/attachments" && req.method === "DELETE") {
    const auth = await authenticateRequest(req, res);
    if (!auth) return;

    const attachmentId = parsed.searchParams.get("id");
    if (!attachmentId) {
       res.writeHead(400, { "Content-Type": "application/json" });
       res.end(JSON.stringify({ success: false, error: "Missing id" }));
       return;
    }

    const attachment = await attachmentRepo.findById(attachmentId, auth.userId);
    if (!attachment) {
       res.writeHead(404, { "Content-Type": "application/json" });
       res.end(JSON.stringify({ success: false, error: "Not found" }));
       return;
    }
    
    // Wire ATTACHMENT_DELETED event
    attachment.delete(auth.userId);
    
    // TODO: move to queue-based retry
    const storageKey = attachment.metadata.storageKey || attachment.attachmentId;
    try {
      await storageClient.deleteFile(storageKey);
    } catch (e) {
      logger.warn({ err: e }, "Failed to delete file from storage backend");
    }
    
    // DB actually doesn't have a direct delete in the aggregate, so we need to run a delete query
    // In our model we only change status to "Deleted" and save
    await attachmentRepo.save(attachment);

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true }));
    return;
  }
`;

serverJs = serverJs.replace('// Static File Hosting', deleteRoute + '\n  // Static File Hosting');
fs.writeFileSync('apps/web/server.js', serverJs);
console.log('Added DELETE route');
