import { test, describe } from "node:test";
import assert from "node:assert";
import {
  PromptBuilder,
  PromptCompositionReference,
  PromptComposition,
  CompositionMetadata,
  CompositionStrategy,
  CompositionFingerprint,
  CompositionSnapshot,
  PromptDefinitionReference,
  ContextSpecificationReference,
  MemoryReference,
  EmbeddingReference,
  CompositionStrategyReference,
  PROMPT_COMPOSITION_REGISTERED,
  PROMPT_COMPOSED,
  PROMPT_COMPOSITION_VALIDATED,
  PROMPT_COMPOSITION_PUBLISHED,
  PROMPT_COMPOSITION_ARCHIVED,
} from "./prompt-builder.js";
import type {
  PromptBuilderAggregateStore,
  PromptBuilderPersistenceContract,
  PromptBuilderQueryProjection,
  PromptBuilderDomainEvent,
} from "./prompt-builder.js";

describe("PromptBuilder Aggregate Root and Value Objects Domain Tests", () => {
  const defaultComposition = new PromptComposition({
    promptDefinitionReference: new PromptDefinitionReference("client.onboarding.rules"),
    contextSpecificationReference: new ContextSpecificationReference("client.context.spec"),
    memoryReference: new MemoryReference("client.onboarding.memory"),
    embeddingReference: new EmbeddingReference("client.onboarding.embedding"),
    compositionStrategyReference: new CompositionStrategyReference("default.strategy"),
  });

  const defaultMetadata = new CompositionMetadata({
    displayName: "Client Onboarding Prompt Builder",
    description: "Builds prompts for onboarding onboarding sequences.",
    purpose: "Canonical logic mapping.",
    compositionSummary: "Client",
  });

  const alternativeMetadata = new CompositionMetadata({
    displayName: "Client Onboarding Prompt Builder - Updated",
    description: "Builds prompts for onboarding onboarding sequences updated.",
    purpose: "Canonical logic mapping.",
    compositionSummary: "ClientUpdated",
  });

  const defaultStrategy = new CompositionStrategy({
    assemblyOrder: 1,
    compositionRules: ["Rule1", "Rule2"],
    referenceInclusionRules: ["IncludeMemory", "IncludeContext"],
  });

  const defaultFingerprint = new CompositionFingerprint({
    fingerprintIdentifier: "fp-abc-123",
    fingerprintStrategyReference: "MD5Ref",
  });

  const alternativeFingerprint = new CompositionFingerprint({
    fingerprintIdentifier: "fp-xyz-999",
    fingerprintStrategyReference: "MD5Ref",
  });

  test("PromptBuilder creation success: state Draft, snapshots initialized, registered event emitted", () => {
    const builder = PromptBuilder.create(
      "bld-1",
      "client.onboarding.builder",
      "owner-123",
      defaultComposition,
      defaultMetadata,
      defaultStrategy,
      "snap-1",
      defaultFingerprint,
    );

    assert.strictEqual(builder.id, "bld-1");
    assert.strictEqual(builder.reference, "client.onboarding.builder");
    assert.strictEqual(builder.ownerId, "owner-123");
    assert.strictEqual(builder.status, "Draft");
    assert.strictEqual(builder.metadata.displayName, "Client Onboarding Prompt Builder");

    // Snapshot completeness checks
    assert.strictEqual(builder.snapshots.length, 1);
    assert.strictEqual(builder.snapshots[0]!.snapshotId, "snap-1");
    assert.strictEqual(
      builder.snapshots[0]!.builderReferenceSnapshot.value,
      "client.onboarding.builder",
    );
    assert.strictEqual(
      builder.snapshots[0]!.fingerprintSnapshot.fingerprintIdentifier,
      "fp-abc-123",
    );
    assert.strictEqual(
      builder.snapshots[0]!.promptCompositionSnapshot.promptDefinitionReference.value,
      "client.onboarding.rules",
    );
    assert.strictEqual(builder.snapshots[0]!.strategySnapshot.assemblyOrder, 1);

    // Events validation
    assert.strictEqual(builder.domainEvents.length, 1);
    const event = builder.domainEvents[0] as PromptBuilderDomainEvent;
    assert.strictEqual(event.eventType, PROMPT_COMPOSITION_REGISTERED);
    assert.strictEqual(event.builderId, "bld-1");
    assert.strictEqual(event.reference, "client.onboarding.builder");
    assert.strictEqual(event.snapshotId, "snap-1");
    assert.strictEqual(event.ownerId, "owner-123");
  });

  test("PromptBuilder reference format validation rejects invalid keys", () => {
    assert.throws(() => {
      PromptBuilder.create(
        "bld-1",
        "client..builder",
        "owner-123",
        defaultComposition,
        defaultMetadata,
        defaultStrategy,
        "snap-1",
        defaultFingerprint,
      );
    }, /Invalid prompt composition reference format/);

    assert.throws(() => {
      PromptBuilder.create(
        "bld-1",
        "Client.builder",
        "owner-123",
        defaultComposition,
        defaultMetadata,
        defaultStrategy,
        "snap-1",
        defaultFingerprint,
      );
    }, /Invalid prompt composition reference format/);
  });

  test("PromptCompositionReference validation checks", () => {
    assert.throws(() => {
      new PromptCompositionReference("");
    }, /Prompt Composition Reference is required/);

    assert.throws(() => {
      new PromptCompositionReference("Client.builder");
    }, /Invalid prompt composition reference format/);

    const ref = new PromptCompositionReference("client.onboarding.builder");
    assert.strictEqual(ref.value, "client.onboarding.builder");
  });

  test("Logical References validation and equality checks", () => {
    assert.throws(() => {
      new PromptDefinitionReference("");
    }, /Prompt definition reference is required/);

    assert.throws(() => {
      new ContextSpecificationReference("");
    }, /Context specification reference is required/);

    assert.throws(() => {
      new MemoryReference("");
    }, /Memory reference is required/);

    assert.throws(() => {
      new EmbeddingReference("");
    }, /Embedding reference is required/);

    assert.throws(() => {
      new CompositionStrategyReference("");
    }, /Composition strategy reference is required/);

    const ref1 = new PromptDefinitionReference("def-1");
    const ref2 = new PromptDefinitionReference("def-1");
    const ref3 = new PromptDefinitionReference("def-2");

    assert.strictEqual(ref1.equals(ref2), true);
    assert.strictEqual(ref1.equals(ref3), false);
  });

  test("Ownership validation blocks unauthorized owners", () => {
    const builder = PromptBuilder.create(
      "bld-1",
      "client.onboarding.builder",
      "owner-123",
      defaultComposition,
      defaultMetadata,
      defaultStrategy,
      "snap-1",
      defaultFingerprint,
    );

    assert.throws(() => {
      builder.replaceMetadata("unauthorized-owner", alternativeMetadata);
    }, /Ownership validation failed: unauthorized owner context/);

    assert.throws(() => {
      builder.compose("unauthorized-owner", "snap-2", alternativeFingerprint);
    }, /Ownership validation failed: unauthorized owner context/);

    assert.throws(() => {
      builder.validate("unauthorized-owner");
    }, /Ownership validation failed: unauthorized owner context/);
  });

  test("Missing owner throws error", () => {
    const builder = PromptBuilder.create(
      "bld-1",
      "client.onboarding.builder",
      "owner-123",
      defaultComposition,
      defaultMetadata,
      defaultStrategy,
      "snap-1",
      defaultFingerprint,
    );

    assert.throws(() => {
      builder.replaceMetadata("", alternativeMetadata);
    }, /Missing owner identity in caller context/);
  });

  test("Metadata replacement is allowed in Draft but rejected in non-Draft states", () => {
    const builder = PromptBuilder.create(
      "bld-1",
      "client.onboarding.builder",
      "owner-123",
      defaultComposition,
      defaultMetadata,
      defaultStrategy,
      "snap-1",
      defaultFingerprint,
    );

    // 1. Success in Draft
    builder.replaceMetadata("owner-123", alternativeMetadata);
    assert.strictEqual(builder.metadata.equals(alternativeMetadata), true);

    // 2. Reject in Composed
    builder.compose("owner-123", "snap-2", alternativeFingerprint);
    assert.strictEqual(builder.status, "Composed");

    assert.throws(() => {
      builder.replaceMetadata("owner-123", defaultMetadata);
    }, /Cannot replace metadata when in status: Composed/);
  });

  test("Append snapshot to history is append-only and previous snapshots are immutable", () => {
    const builder = PromptBuilder.create(
      "bld-1",
      "client.onboarding.builder",
      "owner-123",
      defaultComposition,
      defaultMetadata,
      defaultStrategy,
      "snap-1",
      defaultFingerprint,
    );

    builder.compose("owner-123", "snap-2", alternativeFingerprint);

    assert.strictEqual(builder.snapshots.length, 2);
    assert.strictEqual(builder.snapshots[0]!.snapshotId, "snap-1");
    assert.strictEqual(builder.snapshots[1]!.snapshotId, "snap-2");
    assert.strictEqual(
      builder.snapshots[1]!.fingerprintSnapshot.equals(alternativeFingerprint),
      true,
    );
    assert.strictEqual(
      builder.snapshots[1]!.builderReferenceSnapshot.value,
      "client.onboarding.builder",
    );

    // Verify snapshots array immutability from outside
    const outsideSnapshots = builder.snapshots;
    assert.throws(() => {
      (outsideSnapshots as unknown as CompositionSnapshot[]).push(
        new CompositionSnapshot({
          snapshotId: "snap-hack",
          builderReferenceSnapshot: new PromptCompositionReference("client.onboarding.builder"),
          promptCompositionSnapshot: defaultComposition,
          metadataSnapshot: defaultMetadata,
          strategySnapshot: defaultStrategy,
          fingerprintSnapshot: defaultFingerprint,
          lifecycleSnapshot: "Draft",
          capturedAt: new Date(),
        }),
      );
    });
    assert.strictEqual(builder.snapshots.length, 2);
  });

  test("Lifecycle flow: Draft -> Composed -> Validated -> Published -> Archived", () => {
    const builder = PromptBuilder.create(
      "bld-1",
      "client.onboarding.builder",
      "owner-123",
      defaultComposition,
      defaultMetadata,
      defaultStrategy,
      "snap-1",
      defaultFingerprint,
    );

    // 1. Draft -> Composed (via composition generation)
    builder.clearDomainEvents();
    builder.compose("owner-123", "snap-2", alternativeFingerprint);
    assert.strictEqual(builder.status, "Composed");
    assert.strictEqual(builder.domainEvents.length, 1);
    const compEvent = builder.domainEvents[0] as PromptBuilderDomainEvent;
    assert.strictEqual(compEvent.eventType, PROMPT_COMPOSED);
    assert.strictEqual(compEvent.builderId, "bld-1");
    assert.strictEqual(compEvent.snapshotId, "snap-2");

    // 2. Composed -> Validated
    builder.clearDomainEvents();
    builder.validate("owner-123");
    assert.strictEqual(builder.status, "Validated");
    assert.strictEqual(builder.domainEvents.length, 1);
    const valEvent = builder.domainEvents[0] as PromptBuilderDomainEvent;
    assert.strictEqual(valEvent.eventType, PROMPT_COMPOSITION_VALIDATED);
    assert.strictEqual(valEvent.builderId, "bld-1");
    assert.strictEqual(valEvent.snapshotId, "snap-2");

    // Cannot validate again
    assert.throws(() => {
      builder.validate("owner-123");
    }, /Cannot validate prompt builder when in status: Validated/);

    // 3. Validated -> Published
    builder.clearDomainEvents();
    builder.publish("owner-123");
    assert.strictEqual(builder.status, "Published");
    assert.strictEqual(builder.domainEvents.length, 1);
    const pubEvent = builder.domainEvents[0] as PromptBuilderDomainEvent;
    assert.strictEqual(pubEvent.eventType, PROMPT_COMPOSITION_PUBLISHED);
    assert.strictEqual(pubEvent.builderId, "bld-1");
    assert.strictEqual(pubEvent.snapshotId, "snap-2");

    // Cannot publish again
    assert.throws(() => {
      builder.publish("owner-123");
    }, /Cannot publish prompt builder when in status: Published/);

    // 4. Published -> Archived
    builder.clearDomainEvents();
    builder.archive("owner-123");
    assert.strictEqual(builder.status, "Archived");
    assert.strictEqual(builder.domainEvents.length, 1);
    const archEvent = builder.domainEvents[0] as PromptBuilderDomainEvent;
    assert.strictEqual(archEvent.eventType, PROMPT_COMPOSITION_ARCHIVED);
    assert.strictEqual(archEvent.builderId, "bld-1");
    assert.strictEqual(archEvent.snapshotId, "snap-2");

    // Already archived blocks mutation
    assert.throws(() => {
      builder.archive("owner-123");
    }, /Prompt builder is already archived/);

    assert.throws(() => {
      builder.compose("owner-123", "snap-3", defaultFingerprint);
    }, /Cannot compose prompt when in status: Archived/);
  });

  test("Invalid lifecycle transition: cannot validate or publish directly from Draft", () => {
    const builder = PromptBuilder.create(
      "bld-1",
      "client.onboarding.builder",
      "owner-123",
      defaultComposition,
      defaultMetadata,
      defaultStrategy,
      "snap-1",
      defaultFingerprint,
    );

    assert.throws(() => {
      builder.validate("owner-123");
    }, /Cannot validate prompt builder when in status: Draft/);

    assert.throws(() => {
      builder.publish("owner-123");
    }, /Cannot publish prompt builder when in status: Draft/);
  });

  test("Value Objects equality checks", () => {
    // 1. PromptComposition
    const comp2 = new PromptComposition({
      promptDefinitionReference: new PromptDefinitionReference("client.onboarding.rules"),
      contextSpecificationReference: new ContextSpecificationReference("client.context.spec"),
      memoryReference: new MemoryReference("client.onboarding.memory"),
      embeddingReference: new EmbeddingReference("client.onboarding.embedding"),
      compositionStrategyReference: new CompositionStrategyReference("default.strategy"),
    });
    assert.strictEqual(defaultComposition.equals(comp2), true);

    // 2. CompositionStrategy
    const strat2 = new CompositionStrategy({
      assemblyOrder: 1,
      compositionRules: ["Rule1", "Rule2"],
      referenceInclusionRules: ["IncludeMemory", "IncludeContext"],
    });
    assert.strictEqual(defaultStrategy.equals(strat2), true);

    // 3. CompositionFingerprint
    const fp2 = new CompositionFingerprint({
      fingerprintIdentifier: "fp-abc-123",
      fingerprintStrategyReference: "MD5Ref",
    });
    assert.strictEqual(defaultFingerprint.equals(fp2), true);
  });

  test("Mock store interface compliance check", async () => {
    const mockStore: PromptBuilderAggregateStore = {
      save: async (builder: PromptBuilder) => {
        assert.ok(builder.id);
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

    const builder = PromptBuilder.create(
      "bld-1",
      "client.onboarding.builder",
      "owner-123",
      defaultComposition,
      defaultMetadata,
      defaultStrategy,
      "snap-1",
      defaultFingerprint,
    );

    await mockStore.save(builder);

    const mockPersistence: PromptBuilderPersistenceContract = {
      checkUniqueReference: async (
        ownerId: string,
        reference: string,
        excludeBuilderId?: string,
      ) => {
        assert.ok(ownerId);
        assert.ok(reference);
        if (excludeBuilderId) {
          assert.ok(excludeBuilderId);
        }
        return true;
      },
    };

    const isUnique = await mockPersistence.checkUniqueReference(
      "owner-123",
      "client.onboarding.builder",
    );
    assert.strictEqual(isUnique, true);

    const projection: PromptBuilderQueryProjection = {
      id: "bld-1",
      reference: "client.onboarding.builder",
      ownerId: "owner-123",
      displayName: "Summary View",
      status: "Published",
      updatedAt: new Date(),
    };

    assert.strictEqual(projection.status, "Published");
  });
});
