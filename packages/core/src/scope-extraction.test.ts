import { test, describe } from "node:test";
import assert from "node:assert";
import {
  ScopeExtractionLifecycle,
  ScopeFactType,
  ScopeFactValue,
  ScopeSourceReference,
  ScopeEvidence,
  ScopeFact,
  ScopeExtractionSnapshot,
  ScopeExtraction,
} from "./scope-extraction.js";
import type {
  ScopeExtractionPersistenceContract,
  ScopeExtractionAggregateStore,
  ScopeExtractionQueryProjection,
} from "./scope-extraction.js";

describe("Scope Extraction Domain and Boundary Tests", () => {
  const defaultSource = new ScopeSourceReference({
    sourceId: "conversation-import-123",
    sourceType: "CONVERSATION",
    locationReference: "message-4",
  });

  const defaultEvidence = new ScopeEvidence({
    sourceReference: defaultSource,
    contentSnippet: "We need a standard authentication gateway configured within 3 weeks.",
    locationRange: "lines-12-15",
  });

  const factType = new ScopeFactType("deliverable");
  const factValue = new ScopeFactValue({
    description: "Standard authentication gateway",
    parameters: { durationWeeks: 3 },
  });

  test("Aggregate creation (Draft status) and default properties", () => {
    const aggregate = ScopeExtraction.draft("ext-001", "client-abc");

    assert.strictEqual(aggregate.extractionId, "ext-001");
    assert.strictEqual(aggregate.clientReference, "client-abc");
    assert.strictEqual(aggregate.state, ScopeExtractionLifecycle.DRAFT);
    assert.strictEqual(aggregate.facts.length, 0);
    assert.strictEqual(aggregate.snapshots.length, 0);
    assert.strictEqual(aggregate.domainEvents.length, 1);
    assert.strictEqual(aggregate.domainEvents[0]!.eventName, "SCOPE_EXTRACTION_DRAFTED");
  });

  test("Scope fact type validation and normalized uppercase", () => {
    assert.strictEqual(new ScopeFactType("Deliverable").value, "DELIVERABLE");
    assert.strictEqual(new ScopeFactType("scope_boundary").value, "SCOPE_BOUNDARY");

    assert.throws(() => {
      new ScopeFactType("INVALID_FACT_TYPE");
    }, /Unsupported fact type/);

    const factT = new ScopeFactType("Constraint");
    assert.throws(() => {
      (factT as unknown as Record<string, unknown>).value = "DEADLINE";
    }, TypeError);
  });

  test("Scope source reference properties validation", () => {
    assert.throws(() => {
      new ScopeSourceReference({
        sourceId: "",
        sourceType: "CONVERSATION",
      });
    }, /Source identifier is required/);

    assert.throws(() => {
      new ScopeSourceReference({
        sourceId: "doc-1",
        sourceType: "INVALID" as "DOCUMENT",
      });
    }, /Unsupported source type/);
  });

  test("Scope fact value parameters deep freeze", () => {
    const params = { subtasks: ["mfa", "login"] };
    const value = new ScopeFactValue({
      description: "User Authentication",
      parameters: params,
    });

    assert.throws(() => {
      (value.parameters as unknown as Record<string, unknown>).subtasks = [];
    }, TypeError);
  });

  test("Scope fact properties validation and immutability", () => {
    const fact = new ScopeFact({
      factId: "fact-1",
      factType,
      factValue,
      sourceReference: defaultSource,
      evidence: defaultEvidence,
      metadata: { sourceConfidence: 0.95 },
    });

    assert.strictEqual(fact.factId, "fact-1");
    assert.ok(fact.factType.equals(factType));
    assert.strictEqual(fact.factValue.description, "Standard authentication gateway");
    assert.strictEqual(fact.metadata?.sourceConfidence, 0.95);

    assert.throws(() => {
      (fact as unknown as Record<string, unknown>).factId = "new-id";
    }, TypeError);

    assert.throws(() => {
      (fact.metadata as unknown as Record<string, unknown>).sourceConfidence = 1.0;
    }, TypeError);
  });

  test("Snapshot creation and defensive date copying", () => {
    const rawDate = new Date("2026-08-08T12:00:00Z");
    const snapshot = new ScopeExtractionSnapshot({
      version: 1,
      facts: [],
      timestamp: rawDate,
      state: ScopeExtractionLifecycle.DRAFT,
    });

    rawDate.setTime(0);
    assert.notStrictEqual(snapshot.timestamp.getTime(), 0);

    const ret = snapshot.timestamp;
    ret.setTime(9999);
    assert.notStrictEqual(snapshot.timestamp.getTime(), 9999);
  });

  test("Aggregate facts management (add/remove) and collection immutability", () => {
    const aggregate = ScopeExtraction.draft("ext-001", "client-abc");
    const fact = new ScopeFact({
      factId: "fact-1",
      factType,
      factValue,
      sourceReference: defaultSource,
      evidence: defaultEvidence,
    });

    aggregate.addFact(fact);
    assert.strictEqual(aggregate.facts.length, 1);
    assert.ok(aggregate.facts[0]!.factType.equals(factType));

    // Duplicate ID prevention
    assert.throws(() => {
      aggregate.addFact(fact);
    }, /Fact with identifier fact-1 already exists/);

    // Collection immutability
    assert.throws(() => {
      (aggregate.facts as unknown as unknown[]).push({});
    }, TypeError);

    aggregate.removeFact("fact-1");
    assert.strictEqual(aggregate.facts.length, 0);

    assert.throws(() => {
      aggregate.removeFact("fact-1");
    }, /Fact with identifier fact-1 not found/);
  });

  test("Aggregate lifecycle transitions and snapshots history", () => {
    const aggregate = ScopeExtraction.draft("ext-001", "client-abc");
    const fact = new ScopeFact({
      factId: "fact-1",
      factType,
      factValue,
      sourceReference: defaultSource,
      evidence: defaultEvidence,
    });
    aggregate.addFact(fact);

    // DRAFT -> EXTRACTED
    aggregate.completeExtraction();
    assert.strictEqual(aggregate.state, ScopeExtractionLifecycle.EXTRACTED);
    assert.strictEqual(aggregate.snapshots.length, 1);
    assert.strictEqual(aggregate.snapshots[0]!.version, 1);
    assert.strictEqual(aggregate.snapshots[0]!.facts.length, 1);
    assert.strictEqual(aggregate.snapshots[0]!.state, ScopeExtractionLifecycle.EXTRACTED);

    // Invalid transition
    assert.throws(() => {
      aggregate.completeExtraction();
    }, /Invalid lifecycle transition/);

    // EXTRACTED -> COMMITTED
    aggregate.commitExtraction();
    assert.strictEqual(aggregate.state, ScopeExtractionLifecycle.COMMITTED);
    assert.strictEqual(aggregate.snapshots.length, 2);
    assert.strictEqual(aggregate.snapshots[1]!.state, ScopeExtractionLifecycle.COMMITTED);

    // Mutation blocks in committed status
    assert.throws(() => {
      aggregate.addFact(fact);
    }, /Cannot add fact in state/);

    assert.throws(() => {
      aggregate.removeFact("fact-1");
    }, /Cannot remove fact in state/);

    // COMMITTED -> ARCHIVED
    aggregate.archiveExtraction();
    assert.strictEqual(aggregate.state, ScopeExtractionLifecycle.ARCHIVED);

    // Snapshots immutability check
    assert.throws(() => {
      (aggregate.snapshots as unknown as unknown[]).push({});
    }, TypeError);
  });

  test("Domain events validation and payload purity", () => {
    const aggregate = ScopeExtraction.draft("ext-001", "client-abc");
    aggregate.completeExtraction();

    const completedEvent = aggregate.domainEvents.find(
      (ev) => ev.eventName === "SCOPE_EXTRACTION_COMPLETED",
    );
    assert.ok(completedEvent);
    assert.strictEqual(completedEvent.aggregateId, "ext-001");
    assert.strictEqual(completedEvent.payload.factsCount, 0);

    const keys = Object.keys(completedEvent.payload);
    assert.ok(!keys.includes("rawDocument"));
    assert.ok(!keys.includes("promptText"));
    assert.ok(!keys.includes("modelResponse"));
  });

  test("Mock contracts compliance verification", async () => {
    const aggregate = ScopeExtraction.draft("ext-001", "client-abc");

    const mockPersistence: ScopeExtractionPersistenceContract = {
      save: async (agg: ScopeExtraction) => {
        assert.ok(agg);
      },
      findById: async (id: string) => {
        assert.strictEqual(id, "ext-001");
        return aggregate;
      },
    };

    const mockStore: ScopeExtractionAggregateStore = {
      save: async (agg: ScopeExtraction) => {
        assert.ok(agg);
      },
      load: async (id: string) => {
        assert.strictEqual(id, "ext-001");
        return aggregate;
      },
    };

    const mockQuery: ScopeExtractionQueryProjection = {
      getFactsByClient: async (client: string) => {
        assert.strictEqual(client, "client-abc");
        return [];
      },
    };

    await mockPersistence.save(aggregate);
    const aggP = await mockPersistence.findById("ext-001");
    assert.ok(aggP);

    await mockStore.save(aggregate);
    const aggS = await mockStore.load("ext-001");
    assert.ok(aggS);

    const factsQ = await mockQuery.getFactsByClient("client-abc");
    assert.strictEqual(factsQ.length, 0);
  });

  test("Boundary Verification: Scope Extraction does NOT evaluate rules, confidence, or pricing", () => {
    const aggregate = ScopeExtraction.draft("ext-001", "client-abc");
    const keys = Object.keys(aggregate);

    // 1. Verify rules logic exclusion
    assert.ok(!keys.includes("_validationRules"));
    assert.ok(!keys.includes("_rulesEngine"));

    // 2. Verify confidence engine exclusion
    assert.ok(!keys.includes("_authoritativeConfidence"));
    assert.ok(!keys.includes("_confidenceCalibrator"));

    // 3. Verify pricing context exclusion
    assert.ok(!keys.includes("_packageRates"));
    assert.ok(!keys.includes("_currencyConverter"));

    // 4. Verify AI provider context exclusion
    assert.ok(!keys.includes("_openAiClient"));
    assert.ok(!keys.includes("_anthropicClient"));
  });
});
