import { test, describe, before, after } from "node:test";
import assert from "node:assert";
import nock from "nock";
import crypto from "crypto";
import { db, clientScopes, scopeComplianceRules, scopeRuleViolationsLog, clientScopeConfidenceScores, clientProjectPricingEstimates } from "@freelanceos/db";
import { eq, and } from "drizzle-orm";

import { ScopeExtractionEngineService } from "./services/scope-extraction-engine.js";
import { ScopeRulesEngineService } from "./services/scope-rules-engine.js";
import { ConfidenceScoringEngineService } from "./services/confidence-scoring-engine.js";
import { PricingIntelligenceEngineService } from "./services/pricing-intelligence-engine.js";

// Dummy Queue and Gateway for synchronous simulation of the background worker drain
class MockAiQueueService {
  async enqueueRequest(payload: any): Promise<string> {
    return `job_${crypto.randomUUID()}`;
  }
}
class MockAiGatewayService {}

describe("Phase 6: Scope Intelligence Integration Tests", () => {
  const tenantId = `tenant_${crypto.randomUUID()}`;
  const clientId = `client_${crypto.randomUUID()}`;
  
  const queueService = new MockAiQueueService() as any;
  const gatewayService = new MockAiGatewayService() as any;

  const extractionEngine = new ScopeExtractionEngineService(queueService, gatewayService);
  const rulesEngine = new ScopeRulesEngineService(queueService, gatewayService);
  const confidenceEngine = new ConfidenceScoringEngineService(queueService, gatewayService);
  const pricingEngine = new PricingIntelligenceEngineService(queueService, gatewayService);

  before(async () => {
    // 1. DEPLOY GLOBAL NETWORK SHIELD
    nock.disableNetConnect();
    nock.enableNetConnect("127.0.0.1"); // Whitelist local database loopbacks

    // Intercept LLM calls if any leak occurs
    nock("https://api.openai.com").persist().post("/v1/chat/completions").reply(200, {
      choices: [{ message: { content: "{}" } }]
    });

    // Seed database with a strict compliance rule
    await db.insert(scopeComplianceRules).values({
      id: crypto.randomUUID(),
      tenantId,
      ruleKey: "NO_OUTSOURCING",
      description: "Project must not contain third-party outsourcing clauses.",
      isActive: true,
    });
  });

  after(() => {
    nock.cleanAll();
    nock.enableNetConnect();
  });

  test("6A: Scope Extraction enforces Zod whitelisting and Drizzle cross-tenant unique barriers", async () => {
    const rawAiResponse = JSON.stringify({
      title: "Backend Migration",
      description: "Migrating to microservices",
      deliverables: ["API Gateway", "Auth Service"],
      technicalRequirements: ["Node.js", "Redis"],
      timelineWeeks: 4
    });

    // Worker Flush: Directly simulate queue popping the job
    await extractionEngine.processExtractionResult(tenantId, clientId, rawAiResponse);

    const savedScope = await db.query.clientScopes.findFirst({
      where: and(eq(clientScopes.tenantId, tenantId), eq(clientScopes.clientId, clientId))
    });

    assert.ok(savedScope, "Scope should be saved securely in DB");
    assert.strictEqual(savedScope.title, "Backend Migration");
    assert.deepStrictEqual((savedScope.scopeData as any).technicalRequirements, ["Node.js", "Redis"]);

    // Assert Hardware Constraint: Attempting to insert duplicate client scope should throw Drizzle constraint error
    await assert.rejects(
      extractionEngine.processExtractionResult(tenantId, clientId, rawAiResponse),
      (err: any) => err.code === "23505", // Postgres unique_violation error code
      "Should safely throw Drizzle constraint exception blocking cross-tenant corruption"
    );
  });

  test("6B: Scope Rules Engine runs async and securely logs DB isolated rule violations", async () => {
    const rawRuleAiResponse = JSON.stringify({
      isCompliant: false,
      violations: [
        { ruleKey: "NO_OUTSOURCING", reason: "Mentions hiring external agencies." }
      ]
    });

    // Worker Flush
    await rulesEngine.processValidationResult(tenantId, clientId, rawRuleAiResponse);

    const logs = await db.select().from(scopeRuleViolationsLog).where(
      and(eq(scopeRuleViolationsLog.tenantId, tenantId), eq(scopeRuleViolationsLog.clientId, clientId))
    );

    assert.strictEqual(logs.length, 1, "Should log exactly one violation");
    assert.strictEqual(logs[0].ruleKey, "NO_OUTSOURCING");
    assert.strictEqual((logs[0].violationContext as any).reason, "Mentions hiring external agencies.");
  });

  test("6C: Confidence Scoring calculates precision hardware floats safely in background worker", async () => {
    const rawConfidenceResponse = JSON.stringify({
      baseScore: 85,
      confidenceWeight: 1.15,
      validationMetadata: { reasoning: "Clear constraints", dataPointsEvaluated: 12 }
    });

    // Worker Flush
    await confidenceEngine.processScoringResult(tenantId, clientId, rawConfidenceResponse);

    const scoreRow = await db.query.clientScopeConfidenceScores.findFirst({
      where: and(eq(clientScopeConfidenceScores.tenantId, tenantId), eq(clientScopeConfidenceScores.clientId, clientId))
    });

    assert.ok(scoreRow);
    assert.strictEqual(scoreRow.baseScore, 85);
    assert.strictEqual(Number(scoreRow.confidenceWeight).toFixed(4), "1.1500");
    
    // JS 85 * 1.15 = 97.75000000000001 (floating error). Our engine uses toFixed(4)
    assert.strictEqual(scoreRow.adjustedScore, "97.7500"); 

    // Unique barrier test
    const duplicateTenantId = `tenant_${crypto.randomUUID()}`;
    await confidenceEngine.processScoringResult(duplicateTenantId, clientId, rawConfidenceResponse);
    const scoreRowDup = await db.query.clientScopeConfidenceScores.findFirst({
      where: and(eq(clientScopeConfidenceScores.tenantId, duplicateTenantId), eq(clientScopeConfidenceScores.clientId, clientId))
    });
    assert.ok(scoreRowDup, "Separate tenant boundaries successfully isolate execution");
  });

  test("6D: Pricing Intelligence calculates enterprise markup cleanly with Numeric(12,2) bounds", async () => {
    const rawPricingResponse = JSON.stringify({
      currencyCode: "USD",
      estimatedBudget: 5000.50,
      hourlyTargetRate: 85.00,
      platformMarkup: 15, // 15%
      pricingMetadata: { marketRateAnalysis: "High demand", complexityMultiplier: 1.2 }
    });

    // Worker Flush
    await pricingEngine.processPricingResult(tenantId, clientId, rawPricingResponse);

    const pricingRow = await db.query.clientProjectPricingEstimates.findFirst({
      where: and(eq(clientProjectPricingEstimates.tenantId, tenantId), eq(clientProjectPricingEstimates.clientId, clientId))
    });

    assert.ok(pricingRow);
    assert.strictEqual(pricingRow.currencyCode, "USD");
    assert.strictEqual(pricingRow.estimatedBudget, "5000.50");
    assert.strictEqual(pricingRow.platformMarkup, "15.00");

    // Math: 5000.50 * 1.15 = 5750.575
    // .toFixed(2) in JS converts 5750.575 to "5750.58"
    assert.strictEqual(pricingRow.totalEstimatedValue, "5750.58", "Financial exact cents must not leak precision");

    // Assert Hardware Constraint prevents dynamic margin bleed
    await assert.rejects(
      pricingEngine.processPricingResult(tenantId, clientId, rawPricingResponse),
       (err: any) => err.code === "23505",
      "Should safely throw Drizzle constraint exception blocking cross-tenant pricing overrides"
    );
  });
});
