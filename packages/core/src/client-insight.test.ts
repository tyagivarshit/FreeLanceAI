import { test, describe } from "node:test";
import assert from "node:assert";
import {
  InsightContent,
  InsightClassification,
  InsightConfidence,
  InsightSourceReference,
  InsightMetadata,
  InsightFingerprint,
  InsightReference,
  ClientInsightSnapshot,
  ClientInsight,
  CLIENT_INSIGHT_IDENTIFIED,
  CLIENT_INSIGHT_VALIDATED,
  CLIENT_INSIGHT_PUBLISHED,
  CLIENT_INSIGHT_ARCHIVED,
} from "./client-insight.js";
import type {
  ClientInsightPersistenceContract,
  ClientInsightAggregateStore,
  ClientInsightQueryProjection,
} from "./client-insight.js";

describe("Client Insights Domain Model & Invariants Tests", () => {
  const createDefaultContent = () =>
    new InsightContent({
      observation: "The client requests weekly sync calls.",
      implication: "Adjust project delivery timeline for weekly touchpoints.",
      evidenceSummary: "Weekly meetings request mentioned in onboarding document.",
    });

  const createAlternativeContent = () =>
    new InsightContent({
      observation: "Client is extremely sensitive to billing delays.",
      implication: "Invoice exactly on the first of each month.",
      evidenceSummary: "Expressed concern in onboarding email.",
    });

  const defaultReference = new InsightReference("insight.reference-001");
  const alternativeReference = new InsightReference("insight.reference-002");

  const defaultClassification = new InsightClassification("Preference");
  const alternativeClassification = new InsightClassification("Risk");

  const defaultConfidence = new InsightConfidence("High");
  const alternativeConfidence = new InsightConfidence("Moderate");

  const defaultSourceReference = new InsightSourceReference("conversation-import-123");
  const alternativeSourceReference = new InsightSourceReference("conversation-import-456");

  const createDefaultMetadata = () =>
    new InsightMetadata({
      displayName: "Weekly Call Preference",
      description: "Desire for weekly touchpoint meeting",
      purpose: "Client communication coordination",
      scope: "Client project onboard",
    });

  const createAlternativeMetadata = () =>
    new InsightMetadata({
      displayName: "Billing Alert",
      description: "Concern about delays in invoicing",
      purpose: "Avoid payment delays",
      scope: "Billing workflow",
    });

  const defaultFingerprint = new InsightFingerprint("logical-fingerprint-v1");
  const alternativeFingerprint = new InsightFingerprint("logical-fingerprint-v2");

  test("Aggregate creation: status Draft, snapshot version 1, properties matched", () => {
    const content = createDefaultContent();
    const metadata = createDefaultMetadata();

    const insight = ClientInsight.create(
      "insight-123",
      defaultReference,
      "client-456",
      "owner-789",
      content,
      defaultClassification,
      defaultConfidence,
      defaultSourceReference,
      metadata,
      defaultFingerprint,
    );

    assert.strictEqual(insight.id, "insight-123");
    assert.ok(insight.insightReference.equals(defaultReference));
    assert.strictEqual(insight.clientId, "client-456");
    assert.strictEqual(insight.ownerId, "owner-789");
    assert.ok(insight.content.equals(content));
    assert.ok(insight.classification.equals(defaultClassification));
    assert.ok(insight.confidence.equals(defaultConfidence));
    assert.ok(insight.sourceReference.equals(defaultSourceReference));
    assert.ok(insight.metadata.equals(metadata));
    assert.ok(insight.fingerprint.equals(defaultFingerprint));
    assert.strictEqual(insight.lifecycle, "Draft");

    // Version 1 Snapshot checking
    assert.strictEqual(insight.snapshots.length, 1);
    const snap = insight.snapshots[0]!;
    assert.strictEqual(snap.version, 1);
    assert.strictEqual(snap.lifecycle, "Draft");
    assert.ok(snap.insightReference.equals(defaultReference));
    assert.strictEqual(snap.clientId, "client-456");
    assert.strictEqual(snap.ownerId, "owner-789");
    assert.ok(snap.content.equals(content));
    assert.ok(snap.classification.equals(defaultClassification));
    assert.ok(snap.confidence.equals(defaultConfidence));
    assert.ok(snap.sourceReference.equals(defaultSourceReference));
    assert.ok(snap.metadata.equals(metadata));
    assert.ok(snap.fingerprint.equals(defaultFingerprint));
    assert.ok(snap.createdAt instanceof Date);

    assert.strictEqual(insight.domainEvents.length, 0);
  });

  test("Value Object Invariants: formats and classifications", () => {
    // Classification case-insensitivity support
    assert.strictEqual(new InsightClassification("preference").value, "Preference");
    assert.strictEqual(new InsightClassification("GOAL").value, "Goal");

    assert.throws(() => {
      new InsightClassification("InvalidCategory");
    }, /Invalid Insight classification category/);

    // Confidence case-insensitivity support
    assert.strictEqual(new InsightConfidence("high").value, "High");
    assert.strictEqual(new InsightConfidence("MODERATE").value, "Moderate");

    assert.throws(() => {
      new InsightConfidence("SuperHigh");
    }, /Invalid Insight confidence/);

    // Reference pattern validations
    assert.ok(new InsightReference("insight-v1.test"));
    assert.throws(() => {
      new InsightReference("Insight..123");
    }, /Invalid insight reference format/);

    assert.ok(new InsightSourceReference("source.ref-abc.123"));
    assert.throws(() => {
      new InsightSourceReference("source..ref");
    }, /Invalid source reference format/);
  });

  test("Date immutability: defensive copy on constructors and getters", () => {
    const originalDate = new Date("2026-08-08T12:00:00Z");
    const content = createDefaultContent();
    const metadata = createDefaultMetadata();

    const insight = new ClientInsight({
      id: "insight-123",
      insightReference: defaultReference,
      clientId: "client-456",
      ownerId: "owner-789",
      content,
      classification: defaultClassification,
      confidence: defaultConfidence,
      sourceReference: defaultSourceReference,
      metadata,
      fingerprint: defaultFingerprint,
      lifecycle: "Draft",
      snapshots: [],
      createdAt: originalDate,
      updatedAt: originalDate,
    });

    // 1. Modifying original Date must not mutate the aggregate state
    originalDate.setTime(0);
    assert.notStrictEqual(insight.createdAt.getTime(), 0);
    assert.notStrictEqual(insight.updatedAt.getTime(), 0);

    // 2. Modifying returned Date must not mutate the aggregate state
    const retrievedCreated = insight.createdAt;
    retrievedCreated.setTime(9999);
    assert.notStrictEqual(insight.createdAt.getTime(), 9999);

    const retrievedUpdated = insight.updatedAt;
    retrievedUpdated.setTime(7777);
    assert.notStrictEqual(insight.updatedAt.getTime(), 7777);
  });

  test("ClientInsightSnapshot Date immutability", () => {
    const originalDate = new Date("2026-08-08T12:00:00Z");
    const snap = new ClientInsightSnapshot({
      version: 1,
      createdAt: originalDate,
      insightReference: defaultReference,
      clientId: "client-456",
      ownerId: "owner-789",
      content: createDefaultContent(),
      classification: defaultClassification,
      confidence: defaultConfidence,
      sourceReference: defaultSourceReference,
      metadata: createDefaultMetadata(),
      fingerprint: defaultFingerprint,
      lifecycle: "Draft",
    });

    originalDate.setTime(0);
    assert.notStrictEqual(snap.createdAt.getTime(), 0);

    const retrieved = snap.createdAt;
    retrieved.setTime(8888);
    assert.notStrictEqual(snap.createdAt.getTime(), 8888);
  });

  test("Snapshot history append-only and immutability", () => {
    const insight = ClientInsight.create(
      "insight-123",
      defaultReference,
      "client-456",
      "owner-789",
      createDefaultContent(),
      defaultClassification,
      defaultConfidence,
      defaultSourceReference,
      createDefaultMetadata(),
      defaultFingerprint,
    );

    const altContent = createAlternativeContent();
    const altMeta = createAlternativeMetadata();

    insight.update(
      "owner-789",
      altContent,
      alternativeClassification,
      alternativeConfidence,
      alternativeSourceReference,
      altMeta,
      alternativeFingerprint,
    );

    assert.strictEqual(insight.snapshots.length, 2);
    const snap1 = insight.snapshots[0]!;
    const snap2 = insight.snapshots[1]!;

    assert.strictEqual(snap1.version, 1);
    assert.strictEqual(snap2.version, 2);

    // Try modifying snapshots array
    assert.throws(() => {
      (insight.snapshots as unknown as unknown[]).push({});
    }, TypeError);

    // Try modifying snapshot property
    assert.throws(() => {
      (snap1 as unknown as Record<string, unknown>).version = 99;
    }, TypeError);
  });

  test("Lifecycle transitions: valid flows and domain events", () => {
    const insight = ClientInsight.create(
      "insight-123",
      defaultReference,
      "client-456",
      "owner-789",
      createDefaultContent(),
      defaultClassification,
      defaultConfidence,
      defaultSourceReference,
      createDefaultMetadata(),
      defaultFingerprint,
    );

    assert.strictEqual(insight.lifecycle, "Draft");

    // Transition: Draft -> Identified
    insight.identify("owner-789");
    assert.strictEqual(insight.lifecycle, "Identified");
    assert.strictEqual(insight.snapshots.length, 2);
    assert.strictEqual(insight.domainEvents.length, 1);
    assert.strictEqual(insight.domainEvents[0]!.eventType, CLIENT_INSIGHT_IDENTIFIED);
    // Payload Purity Check (only identifiers)
    assert.deepStrictEqual(insight.domainEvents[0], {
      eventType: CLIENT_INSIGHT_IDENTIFIED,
      insightId: "insight-123",
      insightReference: defaultReference.value,
      clientId: "client-456",
      ownerId: "owner-789",
      snapshotVersion: 2,
    });

    // Transition: Identified -> Validated
    insight.validate("owner-789");
    assert.strictEqual(insight.lifecycle, "Validated");
    assert.strictEqual(insight.snapshots.length, 3);
    assert.strictEqual(insight.domainEvents.length, 2);
    assert.strictEqual(insight.domainEvents[1]!.eventType, CLIENT_INSIGHT_VALIDATED);

    // Transition: Validated -> Published
    insight.publish("owner-789");
    assert.strictEqual(insight.lifecycle, "Published");
    assert.strictEqual(insight.snapshots.length, 4);
    assert.strictEqual(insight.domainEvents.length, 3);
    assert.strictEqual(insight.domainEvents[2]!.eventType, CLIENT_INSIGHT_PUBLISHED);

    // Transition: Published -> Archived
    insight.archive("owner-789");
    assert.strictEqual(insight.lifecycle, "Archived");
    assert.strictEqual(insight.snapshots.length, 5);
    assert.strictEqual(insight.domainEvents.length, 4);
    assert.strictEqual(insight.domainEvents[3]!.eventType, CLIENT_INSIGHT_ARCHIVED);
  });

  test("Lifecycle transitions: invalid path validation", () => {
    const insight = ClientInsight.create(
      "insight-123",
      defaultReference,
      "client-456",
      "owner-789",
      createDefaultContent(),
      defaultClassification,
      defaultConfidence,
      defaultSourceReference,
      createDefaultMetadata(),
      defaultFingerprint,
    );

    // Cannot validate or publish directly from Draft
    assert.throws(() => {
      insight.validate("owner-789");
    }, /Cannot validate/);

    assert.throws(() => {
      insight.publish("owner-789");
    }, /Cannot publish/);

    // Cannot update once Published or Archived
    insight.identify("owner-789");
    insight.validate("owner-789");
    insight.publish("owner-789");
    assert.throws(() => {
      insight.update(
        "owner-789",
        createAlternativeContent(),
        alternativeClassification,
        alternativeConfidence,
        alternativeSourceReference,
        createAlternativeMetadata(),
        alternativeFingerprint,
      );
    }, /Cannot update/);
  });

  test("Ownership context check", () => {
    const insight = ClientInsight.create(
      "insight-123",
      defaultReference,
      "client-456",
      "owner-789",
      createDefaultContent(),
      defaultClassification,
      defaultConfidence,
      defaultSourceReference,
      createDefaultMetadata(),
      defaultFingerprint,
    );

    assert.throws(() => {
      insight.identify("wrong-owner-id");
    }, /Ownership validation failed/);
  });

  test("Aggregate invariant enforcement on properties", () => {
    // Missing ID throws
    assert.throws(() => {
      new ClientInsight({
        id: "",
        insightReference: defaultReference,
        clientId: "client-456",
        ownerId: "owner-789",
        content: createDefaultContent(),
        classification: defaultClassification,
        confidence: defaultConfidence,
        sourceReference: defaultSourceReference,
        metadata: createDefaultMetadata(),
        fingerprint: defaultFingerprint,
        lifecycle: "Draft",
        snapshots: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }, /Insight Identity is required/);
  });

  test("Mock interfaces contract compliance check", async () => {
    const mockStore: ClientInsightAggregateStore = {
      save: async (insightObj: ClientInsight) => {
        assert.ok(insightObj.id);
      },
      findById: async (id: string, ownerId: string) => {
        assert.ok(id);
        assert.ok(ownerId);
        return null;
      },
      findByReference: async (reference: string, ownerId: string) => {
        assert.ok(reference);
        assert.ok(ownerId);
        return null;
      },
    };

    const insightObj = ClientInsight.create(
      "insight-123",
      defaultReference,
      "client-456",
      "owner-789",
      createDefaultContent(),
      defaultClassification,
      defaultConfidence,
      defaultSourceReference,
      createDefaultMetadata(),
      defaultFingerprint,
    );

    await mockStore.save(insightObj);

    const mockPersist: ClientInsightPersistenceContract = {
      checkUniqueReference: async (
        ownerId: string,
        reference: string,
        excludeInsightId?: string,
      ) => {
        assert.ok(ownerId);
        assert.ok(reference);
        if (excludeInsightId) {
          assert.ok(excludeInsightId);
        }
        return true;
      },
    };

    const unique = await mockPersist.checkUniqueReference("owner-789", "insight.reference-001");
    assert.strictEqual(unique, true);

    const projection: ClientInsightQueryProjection = {
      id: "insight-123",
      insightReference: "insight.reference-001",
      clientId: "client-456",
      ownerId: "owner-789",
      lifecycle: "Draft",
      category: "Preference",
      confidence: "High",
      versionCount: 1,
      updatedAt: new Date(),
    };

    assert.strictEqual(projection.id, "insight-123");
    assert.strictEqual(projection.category, "Preference");
  });

  test("ClientInsight properties immutability checks", () => {
    const insight = ClientInsight.create(
      "insight-123",
      defaultReference,
      "client-456",
      "owner-789",
      createDefaultContent(),
      defaultClassification,
      defaultConfidence,
      defaultSourceReference,
      createDefaultMetadata(),
      defaultFingerprint,
    );

    // Invariant: properties are read-only and throw TypeError on modification
    assert.throws(() => {
      (insight as unknown as Record<string, unknown>).id = "mutated-id";
    }, TypeError);

    assert.throws(() => {
      (insight as unknown as Record<string, unknown>).insightReference = alternativeReference;
    }, TypeError);

    assert.throws(() => {
      (insight as unknown as Record<string, unknown>).clientId = "client-mutated";
    }, TypeError);

    assert.throws(() => {
      (insight as unknown as Record<string, unknown>).ownerId = "owner-mutated";
    }, TypeError);

    assert.throws(() => {
      (insight as unknown as Record<string, unknown>).content = createAlternativeContent();
    }, TypeError);

    assert.throws(() => {
      (insight as unknown as Record<string, unknown>).classification = alternativeClassification;
    }, TypeError);

    assert.throws(() => {
      (insight as unknown as Record<string, unknown>).confidence = alternativeConfidence;
    }, TypeError);

    assert.throws(() => {
      (insight as unknown as Record<string, unknown>).sourceReference = alternativeSourceReference;
    }, TypeError);

    assert.throws(() => {
      (insight as unknown as Record<string, unknown>).metadata = createAlternativeMetadata();
    }, TypeError);

    assert.throws(() => {
      (insight as unknown as Record<string, unknown>).fingerprint = alternativeFingerprint;
    }, TypeError);
  });
});
