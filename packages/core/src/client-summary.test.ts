import { test, describe } from "node:test";
import assert from "node:assert";
import {
  SummaryContent,
  SummaryScope,
  SummaryMetadata,
  SummaryClassification,
  SummaryFingerprint,
  SummaryReference,
  SummarySnapshot,
  ClientSummary,
  CLIENT_SUMMARY_REGISTERED,
  CLIENT_SUMMARY_GENERATED,
  CLIENT_SUMMARY_VALIDATED,
  CLIENT_SUMMARY_PUBLISHED,
  CLIENT_SUMMARY_ARCHIVED,
} from "./client-summary.js";
import type {
  ClientSummaryPersistenceContract,
  ClientSummaryAggregateStore,
  ClientSummaryQueryProjection,
} from "./client-summary.js";

describe("Client Summary Domain Aggregate & Value Objects Tests", () => {
  const createDefaultContent = () =>
    new SummaryContent({
      businessSummary: "Company X is a scaling SaaS provider.",
      relationshipSummary: "Client onboarded last month with positive feedback.",
      currentSituation: "Preparing for launch next quarter.",
      knownGoals: ["Integrate Stripe payments", "Improve lighthouse score"],
      knownConstraints: ["Strict deadline of Sep 30", "Limited budget"],
      openTopics: ["Choose hosting provider", "Configure CI/CD pipelines"],
    });

  const createAlternativeContent = () =>
    new SummaryContent({
      businessSummary: "Company Y specializes in e-commerce logistics.",
      relationshipSummary: "Negotiating retainer terms.",
      currentSituation: "Refactoring database schemas.",
      knownGoals: ["Optimize queries", "Add warehouse tracking API"],
      knownConstraints: ["Zero downtime requirement"],
      openTopics: ["Evaluate Postgres vs DynamoDB"],
    });

  const defaultScope = new SummaryScope("GlobalScope");
  const alternativeScope = new SummaryScope("ProjectScope");

  const createDefaultMetadata = () =>
    new SummaryMetadata({
      displayName: "Standard Onboarding Summary",
      description: "Overview of onboarding notes and objectives.",
      purpose: "Alignment",
      scope: defaultScope,
    });

  const createAlternativeMetadata = () =>
    new SummaryMetadata({
      displayName: "Q3 Project Review Summary",
      description: "Detailed analysis of Q3 milestones and blockers.",
      purpose: "Quarterly Evaluation",
      scope: alternativeScope,
    });

  const defaultClassification = new SummaryClassification("Operational");
  const alternativeClassification = new SummaryClassification("Strategic");

  const defaultFingerprint = new SummaryFingerprint("logical-onboarding-v1");
  const alternativeFingerprint = new SummaryFingerprint("logical-q3-review-v1");

  const defaultReference = new SummaryReference("client.summary.abc-123");

  test("Aggregate creation success: initial status Draft, version 1 snapshot, registered event emitted", () => {
    const content = createDefaultContent();
    const metadata = createDefaultMetadata();
    const summary = ClientSummary.create(
      "sum-1",
      defaultReference,
      "client-123",
      "owner-456",
      content,
      metadata,
      defaultClassification,
      defaultScope,
      defaultFingerprint,
    );

    assert.strictEqual(summary.id, "sum-1");
    assert.strictEqual(summary.reference.value, "client.summary.abc-123");
    assert.strictEqual(summary.clientId, "client-123");
    assert.strictEqual(summary.ownerId, "owner-456");
    assert.strictEqual(summary.lifecycle, "Draft");
    assert.ok(summary.content.equals(content));
    assert.ok(summary.metadata.equals(metadata));
    assert.ok(summary.classification.equals(defaultClassification));
    assert.ok(summary.scope.equals(defaultScope));
    assert.ok(summary.fingerprint.equals(defaultFingerprint));

    // Snapshot history completeness
    assert.strictEqual(summary.snapshots.length, 1);
    const snap = summary.snapshots[0]!;
    assert.strictEqual(snap.version, 1);
    assert.strictEqual(snap.lifecycle, "Draft");
    assert.ok(snap.content.equals(content));
    assert.ok(snap.metadata.equals(metadata));
    assert.ok(snap.classification.equals(defaultClassification));
    assert.ok(snap.scope.equals(defaultScope));
    assert.ok(snap.fingerprint.equals(defaultFingerprint));
    assert.ok(snap.createdAt instanceof Date);

    // Event emitted
    assert.strictEqual(summary.domainEvents.length, 1);
    const event = summary.domainEvents[0]!;
    assert.strictEqual(event.eventType, CLIENT_SUMMARY_REGISTERED);
    assert.strictEqual(event.summaryId, "sum-1");
    assert.strictEqual(event.reference, "client.summary.abc-123");
    assert.strictEqual(event.clientId, "client-123");
    assert.strictEqual(event.ownerId, "owner-456");
  });

  test("Immutable Summary content value object", () => {
    const content = createDefaultContent();
    assert.throws(() => {
      (content as unknown as Record<string, unknown>).businessSummary = "Mutated value";
    }, TypeError);
    assert.throws(() => {
      (content.knownGoals as unknown as string[])[0] = "Mutated goal";
    }, TypeError);
  });

  test("Metadata immutability", () => {
    const metadata = createDefaultMetadata();
    assert.throws(() => {
      (metadata as unknown as Record<string, unknown>).displayName = "New Display Name";
    }, TypeError);
  });

  test("Classification immutability", () => {
    const classification = defaultClassification;
    assert.throws(() => {
      (classification as unknown as Record<string, unknown>).value = "New Classification";
    }, TypeError);
  });

  test("Scope immutability", () => {
    const scope = defaultScope;
    assert.throws(() => {
      (scope as unknown as Record<string, unknown>).value = "New Scope";
    }, TypeError);
  });

  test("Fingerprint immutability", () => {
    const fingerprint = defaultFingerprint;
    assert.throws(() => {
      (fingerprint as unknown as Record<string, unknown>).value = "New Fingerprint";
    }, TypeError);
  });

  test("Fingerprint rejects hashes and provider identifiers", () => {
    // Rejects MD5
    assert.throws(() => {
      new SummaryFingerprint("d41d8cd98f00b204e9800998ecf8427e");
    }, /Fingerprint cannot be a hash\./);

    // Rejects SHA-256
    assert.throws(() => {
      new SummaryFingerprint("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    }, /Fingerprint cannot be a hash\./);

    // Rejects Provider identifiers
    assert.throws(() => {
      new SummaryFingerprint("onboarding-openai-v1");
    }, /Fingerprint cannot contain provider identifiers\./);

    assert.throws(() => {
      new SummaryFingerprint("gemini-analysis-results");
    }, /Fingerprint cannot contain provider identifiers\./);
  });

  test("Summary reference format validation", () => {
    // Valid references
    assert.ok(new SummaryReference("client.summary.test"));
    assert.ok(new SummaryReference("client-summary-v2"));

    // Invalid format throws
    assert.throws(() => {
      new SummaryReference("client..summary");
    }, /Invalid summary reference format/);

    assert.throws(() => {
      new SummaryReference("Client.Summary");
    }, /Invalid summary reference format/);
  });

  test("Append-only Snapshot History and completeness", () => {
    const summary = ClientSummary.create(
      "sum-1",
      defaultReference,
      "client-123",
      "owner-456",
      createDefaultContent(),
      createDefaultMetadata(),
      defaultClassification,
      defaultScope,
      defaultFingerprint,
    );

    // First update: should append snapshot version 2
    const alternativeContent = createAlternativeContent();
    summary.update(
      "owner-456",
      alternativeContent,
      createAlternativeMetadata(),
      alternativeClassification,
      alternativeScope,
      alternativeFingerprint,
    );

    assert.strictEqual(summary.snapshots.length, 2);
    const snap1 = summary.snapshots[0]!;
    const snap2 = summary.snapshots[1]!;

    assert.strictEqual(snap1.version, 1);
    assert.strictEqual(snap2.version, 2);

    // Assert snap1 did not change (is immutable historical snapshot)
    assert.ok(snap1.content.equals(createDefaultContent()));
    assert.ok(snap2.content.equals(alternativeContent));

    // Try mutating history array
    assert.throws(() => {
      (summary.snapshots as unknown as unknown[]).push({});
    }, TypeError);
  });

  test("Historical Snapshot immutability", () => {
    const summary = ClientSummary.create(
      "sum-1",
      defaultReference,
      "client-123",
      "owner-456",
      createDefaultContent(),
      createDefaultMetadata(),
      defaultClassification,
      defaultScope,
      defaultFingerprint,
    );

    const snap = summary.snapshots[0]!;
    assert.throws(() => {
      (snap as unknown as Record<string, unknown>).version = 99;
    }, TypeError);
  });

  test("Lifecycle transitions: valid paths", () => {
    const summary = ClientSummary.create(
      "sum-1",
      defaultReference,
      "client-123",
      "owner-456",
      createDefaultContent(),
      createDefaultMetadata(),
      defaultClassification,
      defaultScope,
      defaultFingerprint,
    );

    assert.strictEqual(summary.lifecycle, "Draft");

    // Transition: Draft -> Generated
    summary.transitionTo("Generated", "owner-456");
    assert.strictEqual(summary.lifecycle, "Generated");
    assert.strictEqual(summary.snapshots.length, 2);
    assert.strictEqual(summary.snapshots[1]!.lifecycle, "Generated");

    // Transition: Generated -> Validated
    summary.transitionTo("Validated", "owner-456");
    assert.strictEqual(summary.lifecycle, "Validated");
    assert.strictEqual(summary.snapshots.length, 3);
    assert.strictEqual(summary.snapshots[2]!.lifecycle, "Validated");

    // Transition: Validated -> Published
    summary.transitionTo("Published", "owner-456");
    assert.strictEqual(summary.lifecycle, "Published");
    assert.strictEqual(summary.snapshots.length, 4);
    assert.strictEqual(summary.snapshots[3]!.lifecycle, "Published");

    // Transition: Published -> Archived
    summary.transitionTo("Archived", "owner-456");
    assert.strictEqual(summary.lifecycle, "Archived");
    assert.strictEqual(summary.snapshots.length, 5);
    assert.strictEqual(summary.snapshots[4]!.lifecycle, "Archived");

    // Confirm lifecycle transition events were fired in correct order
    const events = summary.domainEvents;
    assert.strictEqual(events.length, 5);
    assert.strictEqual(events[0]!.eventType, CLIENT_SUMMARY_REGISTERED);
    assert.strictEqual(events[1]!.eventType, CLIENT_SUMMARY_GENERATED);
    assert.strictEqual(events[2]!.eventType, CLIENT_SUMMARY_VALIDATED);
    assert.strictEqual(events[3]!.eventType, CLIENT_SUMMARY_PUBLISHED);
    assert.strictEqual(events[4]!.eventType, CLIENT_SUMMARY_ARCHIVED);
  });

  test("Invalid lifecycle transitions throw errors", () => {
    // 1. Direct Draft to Published should fail
    const summary = ClientSummary.create(
      "sum-1",
      defaultReference,
      "client-123",
      "owner-456",
      createDefaultContent(),
      createDefaultMetadata(),
      defaultClassification,
      defaultScope,
      defaultFingerprint,
    );

    assert.throws(() => {
      summary.transitionTo("Published", "owner-456");
    }, /Invalid lifecycle transition from Draft to Published/);

    // 2. Draft to Generated is fine, but Generated to Published should fail
    summary.transitionTo("Generated", "owner-456");
    assert.throws(() => {
      summary.transitionTo("Published", "owner-456");
    }, /Invalid lifecycle transition from Generated to Published/);

    // 3. Archived is terminal, transition from Archived should fail
    summary.transitionTo("Archived", "owner-456");
    assert.throws(() => {
      summary.transitionTo("Draft", "owner-456");
    }, /Invalid lifecycle transition/);
  });

  test("Ownership validation works correctly", () => {
    const summary = ClientSummary.create(
      "sum-1",
      defaultReference,
      "client-123",
      "owner-456",
      createDefaultContent(),
      createDefaultMetadata(),
      defaultClassification,
      defaultScope,
      defaultFingerprint,
    );

    // Wrong owner ID on update
    assert.throws(() => {
      summary.update(
        "wrong-owner",
        createAlternativeContent(),
        createAlternativeMetadata(),
        alternativeClassification,
        alternativeScope,
        alternativeFingerprint,
      );
    }, /Ownership validation failed/);

    // Wrong owner ID on transition
    assert.throws(() => {
      summary.transitionTo("Generated", "wrong-owner");
    }, /Ownership validation failed/);
  });

  test("Aggregate invariant enforcement on properties", () => {
    const content = createDefaultContent();
    const metadata = createDefaultMetadata();

    // Missing id throws
    assert.throws(() => {
      new ClientSummary({
        id: "",
        reference: defaultReference,
        clientId: "client-123",
        ownerId: "owner-456",
        content,
        metadata,
        classification: defaultClassification,
        scope: defaultScope,
        fingerprint: defaultFingerprint,
        lifecycle: "Draft",
        snapshots: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }, /Summary Identity is required/);

    // Missing clientId throws
    assert.throws(() => {
      new ClientSummary({
        id: "sum-1",
        reference: defaultReference,
        clientId: "",
        ownerId: "owner-456",
        content,
        metadata,
        classification: defaultClassification,
        scope: defaultScope,
        fingerprint: defaultFingerprint,
        lifecycle: "Draft",
        snapshots: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }, /Client Reference is required/);
  });

  test("Mock store interface compliance check", async () => {
    const mockStore: ClientSummaryAggregateStore = {
      save: async (summary: ClientSummary) => {
        assert.ok(summary.id);
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

    const summary = ClientSummary.create(
      "sum-1",
      defaultReference,
      "client-123",
      "owner-456",
      createDefaultContent(),
      createDefaultMetadata(),
      defaultClassification,
      defaultScope,
      defaultFingerprint,
    );

    await mockStore.save(summary);
  });

  test("Mock persistence unique reference check compliance", async () => {
    const mockPersist: ClientSummaryPersistenceContract = {
      checkUniqueReference: async (
        ownerId: string,
        reference: string,
        excludeSummaryId?: string,
      ) => {
        assert.ok(ownerId);
        assert.ok(reference);
        if (excludeSummaryId) {
          assert.ok(excludeSummaryId);
        }
        return true;
      },
    };

    const unique = await mockPersist.checkUniqueReference("owner-456", "client.summary.abc-123");
    assert.strictEqual(unique, true);
  });

  test("Mock projection values compliance check", () => {
    const projection: ClientSummaryQueryProjection = {
      id: "sum-1",
      reference: "client.summary.abc-123",
      clientId: "client-123",
      ownerId: "owner-456",
      displayName: "Q3 Review Summary",
      lifecycle: "Published",
      versionCount: 4,
      updatedAt: new Date(),
    };

    assert.strictEqual(projection.id, "sum-1");
    assert.strictEqual(projection.lifecycle, "Published");
    assert.strictEqual(projection.versionCount, 4);
  });

  test("ClientSummary Date immutability: defensive copy on constructor and getters", () => {
    const originalDate = new Date("2026-08-08T12:00:00Z");
    const content = createDefaultContent();
    const metadata = createDefaultMetadata();

    const summary = new ClientSummary({
      id: "sum-1",
      reference: defaultReference,
      clientId: "client-123",
      ownerId: "owner-456",
      content,
      metadata,
      classification: defaultClassification,
      scope: defaultScope,
      fingerprint: defaultFingerprint,
      lifecycle: "Draft",
      snapshots: [],
      createdAt: originalDate,
      updatedAt: originalDate,
    });

    // 1. Modifying originalDate should not affect summary
    originalDate.setTime(0);
    assert.notStrictEqual(summary.createdAt.getTime(), 0);
    assert.notStrictEqual(summary.updatedAt.getTime(), 0);

    // 2. Modifying returned dates should not affect summary
    const retrievedCreated = summary.createdAt;
    retrievedCreated.setTime(9999);
    assert.notStrictEqual(summary.createdAt.getTime(), 9999);

    const retrievedUpdated = summary.updatedAt;
    retrievedUpdated.setDate(25);
    retrievedUpdated.setFullYear(2050);
    assert.notStrictEqual(summary.updatedAt.getFullYear(), 2050);
  });

  test("SummarySnapshot Date immutability: defensive copy on constructor and getter", () => {
    const originalDate = new Date("2026-08-08T12:00:00Z");
    const snap = new SummarySnapshot({
      version: 1,
      createdAt: originalDate,
      content: createDefaultContent(),
      metadata: createDefaultMetadata(),
      classification: defaultClassification,
      scope: defaultScope,
      fingerprint: defaultFingerprint,
      lifecycle: "Draft",
    });

    originalDate.setTime(0);
    assert.notStrictEqual(snap.createdAt.getTime(), 0);

    const retrieved = snap.createdAt;
    retrieved.setTime(88888);
    assert.notStrictEqual(snap.createdAt.getTime(), 88888);
  });
});
