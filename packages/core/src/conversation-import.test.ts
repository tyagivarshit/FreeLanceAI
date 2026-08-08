import { test, describe } from "node:test";
import assert from "node:assert";
import {
  ImportMetadata,
  ImportScope,
  ImportFingerprint,
  ImportReference,
  ConversationReference,
  SourceClassification,
  ConversationImportSnapshot,
  ConversationImport,
  CONVERSATION_IMPORT_REGISTERED,
  CONVERSATION_IMPORT_VALIDATED,
  CONVERSATION_IMPORT_COMPLETED,
  CONVERSATION_IMPORT_ARCHIVED,
} from "./conversation-import.js";
import type {
  ConversationImportPersistenceContract,
  ConversationImportAggregateStore,
  ConversationImportQueryProjection,
} from "./conversation-import.js";

describe("Conversation Import Domain Aggregate & Value Objects Tests", () => {
  const createDefaultMetadata = () =>
    new ImportMetadata({
      displayName: "Slack Alignment Import",
      description: "Importing conversation history for client onboard notes.",
      purpose: "Client Context Setup",
      importScopeSummary: "Slack onboarding channel history",
    });

  const createAlternativeMetadata = () =>
    new ImportMetadata({
      displayName: "Slack Support Update",
      description: "Importing recent support transcripts.",
      purpose: "Issue Resolution",
      importScopeSummary: "Slack q3-support channel notes",
    });

  const defaultScope = new ImportScope("FullConversation");
  const alternativeScope = new ImportScope("PartialConversation");

  const defaultFingerprint = new ImportFingerprint("logical-slack-import-v1");
  const alternativeFingerprint = new ImportFingerprint("logical-slack-import-v2");

  const defaultSource = new SourceClassification("Slack");

  const defaultImportRef = new ImportReference("import.slack.abc-123");
  const defaultConvRef = new ConversationReference("conv.slack.general");

  test("Aggregate creation success: initial status Draft, version 1 snapshot", () => {
    const metadata = createDefaultMetadata();
    const importObj = ConversationImport.create(
      "import-1",
      defaultImportRef,
      defaultConvRef,
      "client-123",
      "owner-456",
      defaultSource,
      metadata,
      defaultScope,
      defaultFingerprint,
    );

    assert.strictEqual(importObj.id, "import-1");
    assert.ok(importObj.importReference.equals(defaultImportRef));
    assert.ok(importObj.conversationReference.equals(defaultConvRef));
    assert.strictEqual(importObj.clientId, "client-123");
    assert.strictEqual(importObj.ownerId, "owner-456");
    assert.strictEqual(importObj.lifecycle, "Draft");
    assert.ok(importObj.sourceClassification.equals(defaultSource));
    assert.ok(importObj.metadata.equals(metadata));
    assert.ok(importObj.scope.equals(defaultScope));
    assert.ok(importObj.fingerprint.equals(defaultFingerprint));

    // Assert version 1 snapshot completeness
    assert.strictEqual(importObj.snapshots.length, 1);
    const snap = importObj.snapshots[0]!;
    assert.strictEqual(snap.version, 1);
    assert.strictEqual(snap.lifecycle, "Draft");
    assert.ok(snap.conversationReference.equals(defaultConvRef));
    assert.ok(snap.sourceClassification.equals(defaultSource));
    assert.ok(snap.metadata.equals(metadata));
    assert.ok(snap.scope.equals(defaultScope));
    assert.ok(snap.fingerprint.equals(defaultFingerprint));
    assert.ok(snap.importReference.equals(defaultImportRef));
    assert.ok(snap.createdAt instanceof Date);

    // Initial Draft has no domain events
    assert.strictEqual(importObj.domainEvents.length, 0);
  });

  test("ImportFingerprint rejects cryptographic hashes and provider keywords", () => {
    // Rejects MD5
    assert.throws(() => {
      new ImportFingerprint("5d41402abc4b2a76b9719d911017c592");
    }, /Fingerprint cannot be a cryptographic hash\./);

    // Rejects SHA-256
    assert.throws(() => {
      new ImportFingerprint("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    }, /Fingerprint cannot be a cryptographic hash\./);

    // Rejects Provider identifiers
    assert.throws(() => {
      new ImportFingerprint("openai-sync-123");
    }, /Fingerprint cannot contain provider identifiers\./);

    assert.throws(() => {
      new ImportFingerprint("gemini-transcript-import");
    }, /Fingerprint cannot contain provider identifiers\./);
  });

  test("References format validation", () => {
    // Valid patterns
    assert.ok(new ImportReference("slack.chat.channel-1"));
    assert.ok(new ConversationReference("conv-ref-v2"));

    // Invalid patterns throw
    assert.throws(() => {
      new ImportReference("Slack..channel");
    }, /Invalid import reference format/);

    assert.throws(() => {
      new ConversationReference("conv..general");
    }, /Invalid conversation reference format/);
  });

  test("SourceClassification validates valid providers case-insensitively", () => {
    assert.ok(new SourceClassification("slack"));
    assert.ok(new SourceClassification("WhatsApp"));
    assert.ok(new SourceClassification("gmail"));
    assert.ok(new SourceClassification("Custom"));

    // Invalid source throws
    assert.throws(() => {
      new SourceClassification("invalid-platform");
    }, /Invalid source classification:/);
  });

  test("Append-only Snapshot History and immutability", () => {
    const importObj = ConversationImport.create(
      "import-1",
      defaultImportRef,
      defaultConvRef,
      "client-123",
      "owner-456",
      defaultSource,
      createDefaultMetadata(),
      defaultScope,
      defaultFingerprint,
    );

    const alternativeMeta = createAlternativeMetadata();
    importObj.update("owner-456", alternativeMeta, alternativeScope, alternativeFingerprint);

    assert.strictEqual(importObj.snapshots.length, 2);
    const snap1 = importObj.snapshots[0]!;
    const snap2 = importObj.snapshots[1]!;

    assert.strictEqual(snap1.version, 1);
    assert.strictEqual(snap2.version, 2);

    // Historical snapshots are frozen and immutable
    assert.throws(() => {
      (snap1 as unknown as Record<string, unknown>).version = 99;
    }, TypeError);

    assert.throws(() => {
      (importObj.snapshots as unknown as unknown[]).push({});
    }, TypeError);
  });

  test("Lifecycle operations and events", () => {
    const importObj = ConversationImport.create(
      "import-1",
      defaultImportRef,
      defaultConvRef,
      "client-123",
      "owner-456",
      defaultSource,
      createDefaultMetadata(),
      defaultScope,
      defaultFingerprint,
    );

    assert.strictEqual(importObj.lifecycle, "Draft");

    // Operations and transitions: Draft -> Registered
    importObj.register("owner-456");
    assert.strictEqual(importObj.lifecycle, "Registered");
    assert.strictEqual(importObj.snapshots.length, 2);
    assert.strictEqual(importObj.snapshots[1]!.lifecycle, "Registered");
    assert.strictEqual(importObj.domainEvents.length, 1);
    assert.strictEqual(importObj.domainEvents[0]!.eventType, CONVERSATION_IMPORT_REGISTERED);

    // Transition: Registered -> Validated
    importObj.validate("owner-456");
    assert.strictEqual(importObj.lifecycle, "Validated");
    assert.strictEqual(importObj.snapshots.length, 3);
    assert.strictEqual(importObj.domainEvents.length, 2);
    assert.strictEqual(importObj.domainEvents[1]!.eventType, CONVERSATION_IMPORT_VALIDATED);

    // Transition: Validated -> Completed
    importObj.complete("owner-456");
    assert.strictEqual(importObj.lifecycle, "Completed");
    assert.strictEqual(importObj.snapshots.length, 4);
    assert.strictEqual(importObj.domainEvents.length, 3);
    assert.strictEqual(importObj.domainEvents[2]!.eventType, CONVERSATION_IMPORT_COMPLETED);

    // Transition: Completed -> Archived
    importObj.archive("owner-456");
    assert.strictEqual(importObj.lifecycle, "Archived");
    assert.strictEqual(importObj.snapshots.length, 5);
    assert.strictEqual(importObj.domainEvents.length, 4);
    assert.strictEqual(importObj.domainEvents[3]!.eventType, CONVERSATION_IMPORT_ARCHIVED);
  });

  test("Invalid lifecycle operations throw errors", () => {
    const importObj = ConversationImport.create(
      "import-1",
      defaultImportRef,
      defaultConvRef,
      "client-123",
      "owner-456",
      defaultSource,
      createDefaultMetadata(),
      defaultScope,
      defaultFingerprint,
    );

    // Cannot validate or complete from Draft state directly
    assert.throws(() => {
      importObj.validate("owner-456");
    }, /Cannot validate/);

    assert.throws(() => {
      importObj.complete("owner-456");
    }, /Cannot complete/);

    // Reaching Archived is terminal
    importObj.archive("owner-456");
    assert.throws(() => {
      importObj.register("owner-456");
    }, /Cannot register/);
  });

  test("Ownership validation on operations", () => {
    const importObj = ConversationImport.create(
      "import-1",
      defaultImportRef,
      defaultConvRef,
      "client-123",
      "owner-456",
      defaultSource,
      createDefaultMetadata(),
      defaultScope,
      defaultFingerprint,
    );

    assert.throws(() => {
      importObj.register("wrong-owner-id");
    }, /Ownership validation failed/);
  });

  test("Aggregate invariant enforcement on properties", () => {
    const metadata = createDefaultMetadata();

    // Missing ID throws
    assert.throws(() => {
      new ConversationImport({
        id: "",
        importReference: defaultImportRef,
        conversationReference: defaultConvRef,
        clientId: "client-123",
        ownerId: "owner-456",
        sourceClassification: defaultSource,
        metadata,
        scope: defaultScope,
        fingerprint: defaultFingerprint,
        lifecycle: "Draft",
        snapshots: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }, /Import Identity is required/);
  });

  test("Date immutability: defensive copy on constructor and getters", () => {
    const originalDate = new Date("2026-08-08T12:00:00Z");
    const metadata = createDefaultMetadata();

    const importObj = new ConversationImport({
      id: "import-1",
      importReference: defaultImportRef,
      conversationReference: defaultConvRef,
      clientId: "client-123",
      ownerId: "owner-456",
      sourceClassification: defaultSource,
      metadata,
      scope: defaultScope,
      fingerprint: defaultFingerprint,
      lifecycle: "Draft",
      snapshots: [],
      createdAt: originalDate,
      updatedAt: originalDate,
    });

    // 1. Modifying originalDate should not affect ConversationImport
    originalDate.setTime(0);
    assert.notStrictEqual(importObj.createdAt.getTime(), 0);
    assert.notStrictEqual(importObj.updatedAt.getTime(), 0);

    // 2. Modifying returned dates should not affect ConversationImport
    const retrievedCreated = importObj.createdAt;
    retrievedCreated.setTime(9999);
    assert.notStrictEqual(importObj.createdAt.getTime(), 9999);

    const retrievedUpdated = importObj.updatedAt;
    retrievedUpdated.setTime(7777);
    assert.notStrictEqual(importObj.updatedAt.getTime(), 7777);
  });

  test("ConversationImportSnapshot Date immutability", () => {
    const originalDate = new Date("2026-08-08T12:00:00Z");
    const snap = new ConversationImportSnapshot({
      version: 1,
      createdAt: originalDate,
      conversationReference: defaultConvRef,
      clientId: "client-123",
      ownerId: "owner-456",
      sourceClassification: defaultSource,
      metadata: createDefaultMetadata(),
      scope: defaultScope,
      fingerprint: defaultFingerprint,
      lifecycle: "Draft",
      importReference: defaultImportRef,
    });

    originalDate.setTime(0);
    assert.notStrictEqual(snap.createdAt.getTime(), 0);

    const retrieved = snap.createdAt;
    retrieved.setTime(88888);
    assert.notStrictEqual(snap.createdAt.getTime(), 88888);
  });

  test("Mock store interface compliance check", async () => {
    const mockStore: ConversationImportAggregateStore = {
      save: async (importObj: ConversationImport) => {
        assert.ok(importObj.id);
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

    const importObj = ConversationImport.create(
      "import-1",
      defaultImportRef,
      defaultConvRef,
      "client-123",
      "owner-456",
      defaultSource,
      createDefaultMetadata(),
      defaultScope,
      defaultFingerprint,
    );

    await mockStore.save(importObj);
  });

  test("Mock persistence unique reference check compliance", async () => {
    const mockPersist: ConversationImportPersistenceContract = {
      checkUniqueReference: async (
        ownerId: string,
        reference: string,
        excludeImportId?: string,
      ) => {
        assert.ok(ownerId);
        assert.ok(reference);
        if (excludeImportId) {
          assert.ok(excludeImportId);
        }
        return true;
      },
    };

    const unique = await mockPersist.checkUniqueReference("owner-456", "import.slack.abc-123");
    assert.strictEqual(unique, true);
  });

  test("Mock projection values compliance check", () => {
    const projection: ConversationImportQueryProjection = {
      id: "import-1",
      importReference: "import.slack.abc-123",
      clientId: "client-123",
      ownerId: "owner-456",
      lifecycle: "Completed",
      source: "Slack",
      versionCount: 4,
      updatedAt: new Date(),
    };

    assert.strictEqual(projection.id, "import-1");
    assert.strictEqual(projection.lifecycle, "Completed");
    assert.strictEqual(projection.versionCount, 4);
  });

  test("ConversationImport mandatory fields immutability checks", () => {
    const importObj = ConversationImport.create(
      "import-1",
      defaultImportRef,
      defaultConvRef,
      "client-123",
      "owner-456",
      defaultSource,
      createDefaultMetadata(),
      defaultScope,
      defaultFingerprint,
    );

    // Aggregate ID immutability
    assert.throws(() => {
      (importObj as unknown as Record<string, unknown>).id = "mutated-id";
    }, TypeError);

    // Import Reference immutability
    assert.throws(() => {
      (importObj as unknown as Record<string, unknown>).importReference = new ImportReference(
        "import.slack.new",
      );
    }, TypeError);

    // Client Reference immutability
    assert.throws(() => {
      (importObj as unknown as Record<string, unknown>).clientId = "mutated-client";
    }, TypeError);

    // Owner Reference immutability
    assert.throws(() => {
      (importObj as unknown as Record<string, unknown>).ownerId = "mutated-owner";
    }, TypeError);

    // Conversation Reference immutability
    assert.throws(() => {
      (importObj as unknown as Record<string, unknown>).conversationReference =
        new ConversationReference("conv.slack.mutated");
    }, TypeError);

    // Source Classification immutability
    assert.throws(() => {
      (importObj as unknown as Record<string, unknown>).sourceClassification =
        new SourceClassification("WhatsApp");
    }, TypeError);

    // Import Metadata immutability
    assert.throws(() => {
      (importObj as unknown as Record<string, unknown>).metadata = createAlternativeMetadata();
    }, TypeError);

    // Import Scope immutability
    assert.throws(() => {
      (importObj as unknown as Record<string, unknown>).scope = alternativeScope;
    }, TypeError);

    // Import Fingerprint immutability
    assert.throws(() => {
      (importObj as unknown as Record<string, unknown>).fingerprint = alternativeFingerprint;
    }, TypeError);
  });
});
