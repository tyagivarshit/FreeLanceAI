const fs = require('fs');
let c = fs.readFileSync('apps/web/server.js', 'utf8');
const hook = c.indexOf('// 2. Serve static pages');
if (hook > 0) {
  const routes = \  // PHASE 8: REST STREAM GATEWAY & LEADERBOARD ENTRY REGISTRATION
  if (pathname === '/api/jobs/import' && req.method === 'POST') {
    const auth = await checkAuthentication();
    const ownerId = requireAuthenticatedOwner(auth);
    if (!ownerId) return;

    const sourcePlatform = req.headers['x-source-platform'] || 'unknown';

    try {
      const { JobImportStreamEngine } = await import('@freelanceos/core');
      const engine = new JobImportStreamEngine();
      const result = await engine.ingestJobStream(req, {
        tenantId: auth.tenantId,
        ownerId,
        sourcePlatform
      });
      sendJson(202, { success: true, processed: result.processed, failed: result.failed });
    } catch (e) {
      handleClientApiError(e);
    }
    return;
  }

  if (pathname === '/api/jobs/leaderboard' && req.method === 'GET') {
    const auth = await checkAuthentication();
    const ownerId = requireAuthenticatedOwner(auth);
    if (!ownerId) return;

    const jobId = parsedUrl.searchParams.get('jobId');
    const limitParam = parsedUrl.searchParams.get('limit');
    if (!jobId) {
      sendJson(400, { success: false, error: 'jobId is required' });
      return;
    }

    try {
      const { JobLeaderboardRankingService } = await import('@freelanceos/core');
      const engine = new JobLeaderboardRankingService();
      const limit = limitParam ? parseInt(limitParam, 10) : undefined;
      const result = await engine.getJobLeaderboard({
        tenantId: auth.tenantId,
        jobId,
        limit
      });
      sendJson(200, { success: true, ...result });
    } catch (e) {
      handleClientApiError(e);
    }
    return;
  }

  if (pathname === '/api/jobs/explain' && req.method === 'POST') {
    const auth = await checkAuthentication();
    const ownerId = requireAuthenticatedOwner(auth);
    if (!ownerId) return;

    let data;
    try { data = await readJsonBody(); } catch (e) { sendJson(400, { success: false }); return; }

    if (!data.matchId) {
      sendJson(400, { success: false, error: 'matchId is required' });
      return;
    }

    try {
      const { JobMatchExplanationService, AiGatewayService } = await import('@freelanceos/core');
      const aiGateway = new AiGatewayService({} as any, {} as any, {} as any);
      const engine = new JobMatchExplanationService(aiGateway, process.env.REDIS_URL);

      const taskId = await engine.requestExplanation({
        tenantId: auth.tenantId,
        ownerId,
        matchId: data.matchId
      });

      const abortController = new AbortController();
      req.on('close', () => {
        if (!res.writableEnded) abortController.abort();
      });

      sendJson(202, { success: true, taskId });
    } catch (e) {
      handleClientApiError(e);
    }
    return;
  }
\;
  c = c.substring(0, hook) + routes + '\n    ' + c.substring(hook);
  fs.writeFileSync('apps/web/server.js', c);
  console.log('Added endpoints');
} else {
  console.log('Hook not found');
}

