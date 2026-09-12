
with open('apps/web/server.js', 'r', encoding='utf8') as f:
    c = f.read()

hook = c.find('// Component A: Wire background worker to real-time execution loop')
if hook > 0:
    orchestrator_init = '''
    // Phase 8: Worker Wake-Up Initialization
    import('@freelanceos/core').then(({ 
      JobMatchingOrchestratorService, 
      JobNormalizationEngineService, 
      JobEmbeddingEngineService, 
      JobMatchingEngineService, 
      JobMatchCacheService 
    }) => {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      const orchestrator = new JobMatchingOrchestratorService(
        new JobNormalizationEngineService(redisUrl),
        new JobEmbeddingEngineService(redisUrl),
        new JobMatchingEngineService(redisUrl),
        new JobMatchCacheService(redisUrl),
        redisUrl
      );
      orchestrator.startWorker().catch(e => console.error('Orchestrator worker crashed:', e));
      console.log('[Phase 8] Background orchestrator listening tracks activated.');
    }).catch(e => console.error('Failed to import orchestrator deps:', e));

    '''
    c = c[:hook] + orchestrator_init + c[hook:]
    with open('apps/web/server.js', 'w', encoding='utf8') as f:
        f.write(c)
    print('Added orchestrator init')

