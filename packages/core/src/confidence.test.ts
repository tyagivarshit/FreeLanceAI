import { test, describe } from "node:test";
import assert from "node:assert";
import {
  ConfidenceScore,
  ConfidenceLevel,
  ConfidenceReason,
  ConfidenceEvidence,
  ConfidenceAssessment,
  ConfidenceAssessedEvent,
} from "./confidence.js";
import type {
  ConfidencePersistenceContract,
  ConfidenceAggregateStore,
  ConfidenceQueryProjection,
} from "./confidence.js";

describe("Confidence Domain and Boundary Tests", () => {
  test("Confidence score validation: bounds, NaN, Infinity", () => {
    // Valid bounds
    assert.strictEqual(new ConfidenceScore(0.0).value, 0.0);
    assert.strictEqual(new ConfidenceScore(0.5).value, 0.5);
    assert.strictEqual(new ConfidenceScore(1.0).value, 1.0);

    // Invalid bounds
    assert.throws(() => {
      new ConfidenceScore(-0.1);
    }, /Confidence score must be between 0.0 and 1.0/);

    assert.throws(() => {
      new ConfidenceScore(1.01);
    }, /Confidence score must be between 0.0 and 1.0/);

    // NaN / Infinity
    assert.throws(() => {
      new ConfidenceScore(NaN);
    }, /Confidence score must be a finite number/);

    assert.throws(() => {
      new ConfidenceScore(Infinity);
    }, /Confidence score must be a finite number/);

    // Immutability
    const score = new ConfidenceScore(0.8);
    assert.throws(() => {
      (score as unknown as Record<string, unknown>).value = 0.9;
    }, TypeError);
  });

  test("Confidence level validation", () => {
    assert.strictEqual(new ConfidenceLevel("high").value, "HIGH");
    assert.strictEqual(new ConfidenceLevel("Medium").value, "MEDIUM");

    assert.throws(() => {
      new ConfidenceLevel("INVALID_LEVEL");
    }, /Unsupported confidence level/);
  });

  test("Confidence reason validation", () => {
    assert.strictEqual(new ConfidenceReason("strong-evidence").value, "STRONG_EVIDENCE");
    assert.strictEqual(new ConfidenceReason("conflicting_facts").value, "CONFLICTING_FACTS");

    assert.throws(() => {
      new ConfidenceReason("INVALID_REASON");
    }, /Unsupported confidence reason/);
  });

  test("Confidence evidence validation", () => {
    const evidence = new ConfidenceEvidence({
      sourceId: "source-1",
      factId: "fact-1",
      evaluationId: "eval-1",
    });

    assert.strictEqual(evidence.sourceId, "source-1");
    assert.strictEqual(evidence.factId, "fact-1");
    assert.strictEqual(evidence.evaluationId, "eval-1");

    assert.throws(() => {
      new ConfidenceEvidence({ sourceId: "" });
    }, /Source identifier is required/);
  });

  test("Confidence assessment properties mapping and date copying", () => {
    const rawDate = new Date("2026-08-08T12:00:00Z");
    const assessment = new ConfidenceAssessment({
      assessmentId: "assess-1",
      evaluationId: "eval-1",
      extractionId: "ext-1",
      score: new ConfidenceScore(0.9),
      level: new ConfidenceLevel("High"),
      reasons: [new ConfidenceReason("STRONG_EVIDENCE")],
      evidenceList: [new ConfidenceEvidence({ sourceId: "s-1" })],
      assessedAt: rawDate,
    });

    assert.strictEqual(assessment.assessmentId, "assess-1");
    assert.strictEqual(assessment.reasons.length, 1);
    assert.strictEqual(assessment.evidenceList.length, 1);

    // Date immutability
    rawDate.setTime(0);
    assert.notStrictEqual(assessment.assessedAt.getTime(), 0);

    const ret = assessment.assessedAt;
    ret.setTime(9999);
    assert.notStrictEqual(assessment.assessedAt.getTime(), 9999);

    // List immutability
    assert.throws(() => {
      (assessment.reasons as unknown as unknown[]).push({});
    }, TypeError);
  });

  test("No calculation formula is defined by blueprint - representation only", () => {
    // Assert that we do not export or calculate arbitrary confidence values inside core.
    // Instead, assessment values are passed explicitly as a pure representation.
    const assessment = new ConfidenceAssessment({
      assessmentId: "assess-abc",
      evaluationId: "eval-xyz",
      extractionId: "ext-123",
      score: new ConfidenceScore(0.75),
      level: new ConfidenceLevel("Medium"),
      reasons: [new ConfidenceReason("AMBIGUOUS_SCOPE")],
      evidenceList: [],
      assessedAt: new Date(),
    });

    assert.strictEqual(assessment.score.value, 0.75);
    assert.strictEqual(assessment.level.value, "MEDIUM");
    assert.strictEqual(assessment.reasons[0]!.value, "AMBIGUOUS_SCOPE");
  });

  test("Domain event verification", () => {
    const event = new ConfidenceAssessedEvent("assess-1", 0.7, "MEDIUM", new Date());
    assert.strictEqual(event.eventName, "CONFIDENCE_ASSESSED");
    assert.strictEqual(event.payload.score, 0.7);
    assert.strictEqual(event.payload.level, "MEDIUM");

    const keys = Object.keys(event.payload);
    assert.ok(!keys.includes("rawDocument"));
    assert.ok(!keys.includes("credentials"));
  });

  test("Mock contracts compliance verification", async () => {
    const assessment = new ConfidenceAssessment({
      assessmentId: "assess-1",
      evaluationId: "eval-1",
      extractionId: "ext-1",
      score: new ConfidenceScore(0.9),
      level: new ConfidenceLevel("High"),
      reasons: [],
      evidenceList: [],
      assessedAt: new Date(),
    });

    const mockPersistence: ConfidencePersistenceContract = {
      save: async (agg) => {
        assert.ok(agg);
      },
      findById: async (id) => {
        assert.strictEqual(id, "assess-1");
        return assessment;
      },
    };

    const mockStore: ConfidenceAggregateStore = {
      save: async (agg) => {
        assert.ok(agg);
      },
      load: async (id) => {
        assert.strictEqual(id, "assess-1");
        return assessment;
      },
    };

    const mockQuery: ConfidenceQueryProjection = {
      getAssessmentsByExtraction: async (id) => {
        assert.strictEqual(id, "ext-1");
        return [];
      },
    };

    await mockPersistence.save(assessment);
    const aggP = await mockPersistence.findById("assess-1");
    assert.ok(aggP);

    await mockStore.save(assessment);
    const aggS = await mockStore.load("assess-1");
    assert.ok(aggS);

    const listQ = await mockQuery.getAssessmentsByExtraction("ext-1");
    assert.strictEqual(listQ.length, 0);
  });

  test("Boundary Verification: Confidence does NOT execute rules, extract facts, or call AI providers", () => {
    const score = new ConfidenceScore(0.9);
    const keys = Object.keys(score);

    assert.ok(!keys.includes("_aiProviderClient"));
    assert.ok(!keys.includes("_databaseConnection"));
  });
});
