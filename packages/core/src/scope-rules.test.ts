import { test, describe } from "node:test";
import assert from "node:assert";
import {
  ScopeExtraction,
  ScopeFact,
  ScopeFactType,
  ScopeFactValue,
  ScopeSourceReference,
  ScopeEvidence,
} from "./scope-extraction.js";
import {
  ScopeRuleType,
  ScopeRule,
  ScopeRuleSet,
  ScopeDecision,
  ScopeDecisionValue,
  ScopeRuleViolation,
  ScopeEvaluation,
  ScopeEvaluationCompletedEvent,
  ScopeRulesEngine,
} from "./scope-rules.js";
import type {
  ScopeRulePersistenceContract,
  ScopeRuleAggregateStore,
  ScopeRuleQueryProjection,
} from "./scope-rules.js";

describe("Scope Rules Domain and Boundary Tests", () => {
  const defaultSource = new ScopeSourceReference({
    sourceId: "conversation-import-123",
    sourceType: "CONVERSATION",
  });

  const defaultEvidence = new ScopeEvidence({
    sourceReference: defaultSource,
    contentSnippet: "We need standard dashboard configurations.",
  });

  // Setup extraction facts for testing
  const fact1 = new ScopeFact({
    factId: "fact-1",
    factType: new ScopeFactType("deliverable"),
    factValue: new ScopeFactValue({ description: "Standard authentication gateway" }),
    sourceReference: defaultSource,
    evidence: defaultEvidence,
  });

  const fact2 = new ScopeFact({
    factId: "fact-2",
    factType: new ScopeFactType("exclusion"),
    factValue: new ScopeFactValue({ description: "Mobile application support" }),
    sourceReference: defaultSource,
    evidence: defaultEvidence,
  });

  test("Rule creation, type validation and immutability", () => {
    const ruleType = new ScopeRuleType("requirement");
    const rule = new ScopeRule({
      ruleId: "rule-101",
      ruleType,
      description: "Must have at least one deliverable fact.",
      parameters: { requiredType: "DELIVERABLE" },
    });

    assert.strictEqual(rule.ruleId, "rule-101");
    assert.ok(rule.ruleType.equals(ruleType));
    assert.strictEqual(rule.parameters.requiredType, "DELIVERABLE");

    assert.throws(() => {
      new ScopeRuleType("INVALID_RULE_TYPE");
    }, /Unsupported rule type/);

    assert.throws(() => {
      (rule as unknown as Record<string, unknown>).description = "new description";
    }, TypeError);

    assert.throws(() => {
      (rule.parameters as unknown as Record<string, unknown>).requiredType = "EXCLUSION";
    }, TypeError);
  });

  test("Rule set immutability", () => {
    const rule = new ScopeRule({
      ruleId: "rule-1",
      ruleType: new ScopeRuleType("requirement"),
      description: "Desc",
      parameters: {},
    });

    const ruleSet = new ScopeRuleSet([rule]);
    assert.strictEqual(ruleSet.rules.length, 1);

    assert.throws(() => {
      (ruleSet.rules as unknown as unknown[]).push({});
    }, TypeError);
  });

  test("Scope decision validation", () => {
    const decision = new ScopeDecision("Accept");
    assert.strictEqual(decision.value, ScopeDecisionValue.ACCEPT);

    assert.throws(() => {
      new ScopeDecision("INVALID_DECISION");
    }, /Unsupported decision value/);
  });

  test("Scope rule violation parameters immutability", () => {
    const violation = new ScopeRuleViolation({
      ruleId: "rule-1",
      factId: "fact-1",
      reasonCode: "EXCLUSION_VIOLATION",
      explanation: "Prohibited item found.",
      relatedReferences: ["ref-1"],
    });

    assert.strictEqual(violation.ruleId, "rule-1");
    assert.throws(() => {
      (violation.relatedReferences as unknown as unknown[]).push("ref-2");
    }, TypeError);
  });

  test("Scope evaluation date defensive copying", () => {
    const rawDate = new Date("2026-08-08T12:00:00Z");
    const evaluation = new ScopeEvaluation({
      evaluationId: "eval-001",
      extractionId: "ext-001",
      ruleSet: new ScopeRuleSet([]),
      decision: new ScopeDecision("Accept"),
      violations: [],
      evaluatedAt: rawDate,
    });

    rawDate.setTime(0);
    assert.notStrictEqual(evaluation.evaluatedAt.getTime(), 0);

    const ret = evaluation.evaluatedAt;
    ret.setTime(9999);
    assert.notStrictEqual(evaluation.evaluatedAt.getTime(), 9999);
  });

  test("Engine evaluation: ACCEPT result with empty violations", () => {
    const extraction = ScopeExtraction.draft("ext-001", "client-abc");
    extraction.addFact(fact1);

    const rule = new ScopeRule({
      ruleId: "rule-1",
      ruleType: new ScopeRuleType("requirement"),
      description: "Must contain deliverable.",
      parameters: { requiredType: "DELIVERABLE" },
    });

    const ruleSet = new ScopeRuleSet([rule]);
    const evaluation = ScopeRulesEngine.evaluate("eval-1", extraction, ruleSet);

    assert.strictEqual(evaluation.decision.value, ScopeDecisionValue.ACCEPT);
    assert.strictEqual(evaluation.violations.length, 0);
  });

  test("Engine evaluation: REJECT result for missing requirement", () => {
    const extraction = ScopeExtraction.draft("ext-001", "client-abc");
    extraction.addFact(fact2); // Contains only Exclusion

    const rule = new ScopeRule({
      ruleId: "rule-1",
      ruleType: new ScopeRuleType("requirement"),
      description: "Must contain deliverable.",
      parameters: { requiredType: "DELIVERABLE" },
    });

    const ruleSet = new ScopeRuleSet([rule]);
    const evaluation = ScopeRulesEngine.evaluate("eval-1", extraction, ruleSet);

    assert.strictEqual(evaluation.decision.value, ScopeDecisionValue.REJECT);
    assert.strictEqual(evaluation.violations.length, 1);
    assert.strictEqual(evaluation.violations[0]!.reasonCode, "MISSING_REQUIREMENT");
  });

  test("Engine evaluation: REJECT result for exclusion violation", () => {
    const extraction = ScopeExtraction.draft("ext-001", "client-abc");
    extraction.addFact(fact1); // Contains authentication gateway

    const rule = new ScopeRule({
      ruleId: "rule-1",
      ruleType: new ScopeRuleType("exclusion"),
      description: "No gateway allowed.",
      parameters: { prohibitedKeyword: "gateway" },
    });

    const ruleSet = new ScopeRuleSet([rule]);
    const evaluation = ScopeRulesEngine.evaluate("eval-1", extraction, ruleSet);

    assert.strictEqual(evaluation.decision.value, ScopeDecisionValue.REJECT);
    assert.strictEqual(evaluation.violations.length, 1);
    assert.strictEqual(evaluation.violations[0]!.reasonCode, "EXCLUSION_VIOLATION");
    assert.strictEqual(evaluation.violations[0]!.factId, "fact-1");
  });

  test("Engine evaluation: REQUIRES_REVIEW for contradiction detection", () => {
    const extraction = ScopeExtraction.draft("ext-001", "client-abc");
    // Add fact 1 (standard authentication gateway - DELIVERABLE)
    // Add fact 3 (standard authentication gateway - EXCLUSION)
    const fact3 = new ScopeFact({
      factId: "fact-3",
      factType: new ScopeFactType("exclusion"),
      factValue: new ScopeFactValue({ description: "Standard authentication gateway" }),
      sourceReference: defaultSource,
      evidence: defaultEvidence,
    });

    extraction.addFact(fact1);
    extraction.addFact(fact3);

    const rule = new ScopeRule({
      ruleId: "rule-1",
      ruleType: new ScopeRuleType("contradiction"),
      description: "No opposing terms allowed.",
      parameters: {},
    });

    const ruleSet = new ScopeRuleSet([rule]);
    const evaluation = ScopeRulesEngine.evaluate("eval-1", extraction, ruleSet);

    assert.strictEqual(evaluation.decision.value, ScopeDecisionValue.REQUIRES_REVIEW);
    assert.strictEqual(evaluation.violations.length, 1);
    assert.strictEqual(evaluation.violations[0]!.reasonCode, "CONTRADICTION_DETECTED");
  });

  test("Non-contradictory facts with shared words do not trigger a contradiction", () => {
    const extraction = ScopeExtraction.draft("ext-001", "client-abc");

    const deliverableFact = new ScopeFact({
      factId: "fact-d",
      factType: new ScopeFactType("deliverable"),
      factValue: new ScopeFactValue({ description: "Mobile responsive website" }),
      sourceReference: defaultSource,
      evidence: defaultEvidence,
    });

    const exclusionFact = new ScopeFact({
      factId: "fact-e",
      factType: new ScopeFactType("exclusion"),
      factValue: new ScopeFactValue({ description: "Native mobile application" }),
      sourceReference: defaultSource,
      evidence: defaultEvidence,
    });

    extraction.addFact(deliverableFact);
    extraction.addFact(exclusionFact);

    const rule = new ScopeRule({
      ruleId: "rule-1",
      ruleType: new ScopeRuleType("contradiction"),
      description: "No opposing terms allowed.",
      parameters: {},
    });

    const ruleSet = new ScopeRuleSet([rule]);
    const evaluation = ScopeRulesEngine.evaluate("eval-1", extraction, ruleSet);

    // They should not trigger contradiction since they are not exact matches
    assert.strictEqual(evaluation.decision.value, ScopeDecisionValue.ACCEPT);
    assert.strictEqual(evaluation.violations.length, 0);
  });

  test("Engine evaluation: dependency rules verification", () => {
    const extraction = ScopeExtraction.draft("ext-001", "client-abc");
    extraction.addFact(fact1); // contains fact-1

    const rule = new ScopeRule({
      ruleId: "rule-1",
      ruleType: new ScopeRuleType("dependency"),
      description: "If fact-1 is present, must have constraint.",
      parameters: { ifFactId: "fact-1", thenRequiredType: "CONSTRAINT" },
    });

    const ruleSet = new ScopeRuleSet([rule]);
    const evaluation = ScopeRulesEngine.evaluate("eval-1", extraction, ruleSet);

    assert.strictEqual(evaluation.decision.value, ScopeDecisionValue.REJECT);
    assert.strictEqual(evaluation.violations.length, 1);
    assert.strictEqual(evaluation.violations[0]!.reasonCode, "DEPENDENCY_VIOLATION");
    assert.strictEqual(evaluation.violations[0]!.factId, "fact-1");
  });

  test("Domain event payload verification", () => {
    const event = new ScopeEvaluationCompletedEvent("eval-001", "REJECT", 1, new Date());
    assert.strictEqual(event.eventName, "SCOPE_EVALUATION_COMPLETED");
    assert.strictEqual(event.payload.decision, "REJECT");
    assert.strictEqual(event.payload.violationsCount, 1);

    const keys = Object.keys(event.payload);
    assert.ok(!keys.includes("rawConversation"));
    assert.ok(!keys.includes("credentials"));
  });

  test("Mock contracts compliance verification", async () => {
    const evaluation = new ScopeEvaluation({
      evaluationId: "eval-001",
      extractionId: "ext-001",
      ruleSet: new ScopeRuleSet([]),
      decision: new ScopeDecision("Accept"),
      violations: [],
      evaluatedAt: new Date(),
    });

    const mockPersistence: ScopeRulePersistenceContract = {
      save: async (evalObj) => {
        assert.ok(evalObj);
      },
      findById: async (id) => {
        assert.strictEqual(id, "eval-001");
        return evaluation;
      },
    };

    const mockStore: ScopeRuleAggregateStore = {
      save: async (evalObj) => {
        assert.ok(evalObj);
      },
      load: async (id) => {
        assert.strictEqual(id, "eval-001");
        return evaluation;
      },
    };

    const mockQuery: ScopeRuleQueryProjection = {
      getEvaluationsByExtraction: async (id) => {
        assert.strictEqual(id, "ext-001");
        return [];
      },
    };

    await mockPersistence.save(evaluation);
    const evalP = await mockPersistence.findById("eval-001");
    assert.ok(evalP);

    await mockStore.save(evaluation);
    const evalS = await mockStore.load("eval-001");
    assert.ok(evalS);

    const factsQ = await mockQuery.getEvaluationsByExtraction("ext-001");
    assert.strictEqual(factsQ.length, 0);
  });

  test("Boundary Verification: Scope Rules does NOT extract facts or call AI providers", () => {
    const rule = new ScopeRule({
      ruleId: "rule-1",
      ruleType: new ScopeRuleType("requirement"),
      description: "Description",
      parameters: {},
    });

    const keys = Object.keys(rule);
    assert.ok(!keys.includes("_aiProviderClient"));
    assert.ok(!keys.includes("_documentExtractor"));
  });

  test("Scope Rule validation: missing required fields", () => {
    const rType = new ScopeRuleType("requirement");

    assert.throws(() => {
      new ScopeRule({
        ruleId: "",
        ruleType: rType,
        description: "Desc",
        parameters: {},
      });
    }, /Rule identifier is required/);

    assert.throws(() => {
      new ScopeRule({
        ruleId: "r-1",
        ruleType: null as unknown as ScopeRuleType,
        description: "Desc",
        parameters: {},
      });
    }, /Rule type is required/);

    assert.throws(() => {
      new ScopeRule({
        ruleId: "r-1",
        ruleType: rType,
        description: "",
        parameters: {},
      });
    }, /Rule description is required/);

    assert.throws(() => {
      new ScopeRule({
        ruleId: "r-1",
        ruleType: rType,
        description: "Desc",
        parameters: null as unknown as Record<string, unknown>,
      });
    }, /Rule parameters is required/);
  });

  test("Scope Rule Violation validation: empty fields", () => {
    assert.throws(() => {
      new ScopeRuleViolation({
        ruleId: "",
        reasonCode: "CODE",
        explanation: "Expl",
      });
    }, /Rule identifier is required/);

    assert.throws(() => {
      new ScopeRuleViolation({
        ruleId: "r-1",
        reasonCode: "",
        explanation: "Expl",
      });
    }, /Reason code is required/);

    assert.throws(() => {
      new ScopeRuleViolation({
        ruleId: "r-1",
        reasonCode: "CODE",
        explanation: "",
      });
    }, /Explanation is required/);
  });

  test("Detailed Date Immutability Matrix for evaluation (setTime, setDate, setFullYear)", () => {
    const rawDate = new Date("2026-08-08T12:00:00Z");
    const originalTime = rawDate.getTime();
    const evaluation = new ScopeEvaluation({
      evaluationId: "eval-001",
      extractionId: "ext-001",
      ruleSet: new ScopeRuleSet([]),
      decision: new ScopeDecision("Accept"),
      violations: [],
      evaluatedAt: rawDate,
    });

    // Mutate constructor input date
    rawDate.setTime(0);
    assert.strictEqual(evaluation.evaluatedAt.getTime(), originalTime);
    rawDate.setDate(15);
    assert.strictEqual(evaluation.evaluatedAt.getDate(), 8); // original date
    rawDate.setFullYear(2030);
    assert.strictEqual(evaluation.evaluatedAt.getFullYear(), 2026); // original year

    // Mutate getter output date
    const outDate = evaluation.evaluatedAt;
    outDate.setTime(0);
    assert.strictEqual(evaluation.evaluatedAt.getTime(), originalTime);
    outDate.setDate(15);
    assert.strictEqual(evaluation.evaluatedAt.getDate(), 8);
    outDate.setFullYear(2030);
    assert.strictEqual(evaluation.evaluatedAt.getFullYear(), 2026);

    // Event date check
    const freshDate = new Date("2026-08-08T12:00:00Z");
    const event = new ScopeEvaluationCompletedEvent("eval-001", "ACCEPT", 0, freshDate);

    // Mutate constructor input date of event
    freshDate.setTime(0);
    assert.strictEqual(event.timestamp.getTime(), originalTime);
  });

  test("Rules Engine evaluation is strictly deterministic", () => {
    const extraction = ScopeExtraction.draft("ext-001", "client-abc");
    extraction.addFact(fact1);
    extraction.addFact(fact2);

    const rule = new ScopeRule({
      ruleId: "rule-1",
      ruleType: new ScopeRuleType("requirement"),
      description: "Must contain deliverable.",
      parameters: { requiredType: "DELIVERABLE" },
    });
    const ruleSet = new ScopeRuleSet([rule]);

    const eval1 = ScopeRulesEngine.evaluate("eval-001", extraction, ruleSet);
    const eval2 = ScopeRulesEngine.evaluate("eval-001", extraction, ruleSet);

    assert.strictEqual(eval1.decision.value, eval2.decision.value);
    assert.strictEqual(eval1.violations.length, eval2.violations.length);
    assert.strictEqual(eval1.extractionId, eval2.extractionId);
    assert.strictEqual(eval1.evaluationId, eval2.evaluationId);
  });

  test("Contradiction check requires case-insensitive and trimmed EXACT match", () => {
    const extraction = ScopeExtraction.draft("ext-001", "client-abc");

    const delFact = new ScopeFact({
      factId: "fact-d",
      factType: new ScopeFactType("deliverable"),
      factValue: new ScopeFactValue({ description: "   Standard auth gateway   " }), // padded spaces
      sourceReference: defaultSource,
      evidence: defaultEvidence,
    });

    const exclFact = new ScopeFact({
      factId: "fact-e",
      factType: new ScopeFactType("exclusion"),
      factValue: new ScopeFactValue({ description: "standard Auth Gateway" }), // different casing
      sourceReference: defaultSource,
      evidence: defaultEvidence,
    });

    extraction.addFact(delFact);
    extraction.addFact(exclFact);

    const rule = new ScopeRule({
      ruleId: "contradiction-rule",
      ruleType: new ScopeRuleType("contradiction"),
      description: "No opposing terms allowed.",
      parameters: {},
    });

    const ruleSet = new ScopeRuleSet([rule]);
    const evaluation = ScopeRulesEngine.evaluate("eval-1", extraction, ruleSet);

    // Exact matches should trigger contradiction
    assert.strictEqual(evaluation.decision.value, ScopeDecisionValue.REQUIRES_REVIEW);
    assert.strictEqual(evaluation.violations.length, 1);
    assert.strictEqual(evaluation.violations[0]!.reasonCode, "CONTRADICTION_DETECTED");
  });

  test("Unimplemented/ignored rules types pass without violations", () => {
    const extraction = ScopeExtraction.draft("ext-001", "client-abc");
    extraction.addFact(fact1);

    const boundaryRule = new ScopeRule({
      ruleId: "r-boundary",
      ruleType: new ScopeRuleType("boundary"),
      description: "Testing non-evaluated rule types",
      parameters: {},
    });

    const ruleSet = new ScopeRuleSet([boundaryRule]);
    const evaluation = ScopeRulesEngine.evaluate("eval-1", extraction, ruleSet);

    // Should simply ignore rules it does not know, passing with ACCEPT
    assert.strictEqual(evaluation.decision.value, ScopeDecisionValue.ACCEPT);
    assert.strictEqual(evaluation.violations.length, 0);
  });
});
