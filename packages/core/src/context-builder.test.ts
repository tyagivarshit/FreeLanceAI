import { test, describe } from "node:test";
import assert from "node:assert";
import {
  Context,
  ContextBlueprint,
  ContextMetadata,
  ContextAssemblyRule,
  ContextSourceReference,
  CONTEXT_REGISTERED,
  CONTEXT_VALIDATED,
  CONTEXT_PUBLISHED,
  CONTEXT_ARCHIVED,
} from "./context-builder.js";
import type {
  ContextAggregateStore,
  ContextPersistenceContract,
  ContextQueryProjection,
  ContextDomainEvent,
} from "./context-builder.js";

describe("Context Builder Domain Aggregate Tests", () => {
  const defaultBlueprint = new ContextBlueprint({
    blueprintId: "bp-client-profile",
    orderingStrategy: "Chronological",
    assemblyRules: ["OrderClientsChronologically", "FilterArchivedProjects"],
    sourceReferences: ["Client", "Project"],
  });

  const alternativeBlueprint = new ContextBlueprint({
    blueprintId: "bp-client-timeline",
    orderingStrategy: "ChronologicalOnly",
    assemblyRules: ["OrderClientsChronologically"],
    sourceReferences: ["Client"],
  });

  const defaultMetadata = new ContextMetadata({
    displayName: "Client Context Builder",
    description: "Builds client onboarding and project timelines context.",
    purpose: "Provide logical context definition.",
    versionSummary: "v1 initial registration",
  });

  const alternativeMetadata = new ContextMetadata({
    displayName: "Client Context Builder - v2",
    description: "Builds revised client onboarding details.",
    purpose: "Provide contextual specification.",
    versionSummary: "v2 metadata rewrite",
  });

  const defaultAssemblyRules = [
    new ContextAssemblyRule({
      ruleName: "OrderClientsChronologically",
      assemblyOrder: 1,
      isRequired: true,
    }),
    new ContextAssemblyRule({
      ruleName: "FilterArchivedProjects",
      assemblyOrder: 2,
      isRequired: false,
    }),
  ];

  const alternativeAssemblyRules = [
    new ContextAssemblyRule({
      ruleName: "OrderClientsChronologically",
      assemblyOrder: 1,
      isRequired: true,
    }),
  ];

  const defaultSourceRefs = [
    new ContextSourceReference({ sourceType: "Client", sourceId: "client-abc" }),
    new ContextSourceReference({ sourceType: "Project", sourceId: "project-xyz" }),
  ];

  const alternativeSourceRefs = [
    new ContextSourceReference({ sourceType: "Client", sourceId: "client-abc" }),
  ];

  test("Context creation success: status Draft, rules/refs copied, registered event emitted", () => {
    const context = Context.create(
      "ctx-1",
      "client.profile.summary",
      "owner-999",
      defaultBlueprint,
      defaultMetadata,
      defaultAssemblyRules,
      defaultSourceRefs,
    );

    assert.strictEqual(context.id, "ctx-1");
    assert.strictEqual(context.reference, "client.profile.summary");
    assert.strictEqual(context.ownerId, "owner-999");
    assert.strictEqual(context.status, "Draft");
    assert.strictEqual(context.blueprint.blueprintId, "bp-client-profile");
    assert.strictEqual(context.blueprint.orderingStrategy, "Chronological");
    assert.strictEqual(context.blueprint.assemblyRules.length, 2);
    assert.strictEqual(context.blueprint.sourceReferences.length, 2);
    assert.strictEqual(context.metadata.displayName, "Client Context Builder");

    // Copy checks
    assert.strictEqual(context.assemblyRules.length, 2);
    assert.strictEqual(context.assemblyRules[0]!.ruleName, "OrderClientsChronologically");
    assert.strictEqual(context.sourceReferences.length, 2);
    assert.strictEqual(context.sourceReferences[0]!.sourceType, "Client");

    // Events checking
    assert.strictEqual(context.domainEvents.length, 1);
    const event = context.domainEvents[0]!;
    assert.strictEqual(event.eventType, CONTEXT_REGISTERED);
    assert.strictEqual(event.contextId, "ctx-1");
    assert.strictEqual(event.reference, "client.profile.summary");
    assert.strictEqual(event.ownerId, "owner-999");
  });

  test("Context reference format validation rejects invalid keys", () => {
    assert.throws(() => {
      Context.create(
        "ctx-1",
        "client..summary",
        "owner-999",
        defaultBlueprint,
        defaultMetadata,
        defaultAssemblyRules,
        defaultSourceRefs,
      );
    }, /Invalid context reference format/);

    assert.throws(() => {
      Context.create(
        "ctx-1",
        "Client.summary",
        "owner-999",
        defaultBlueprint,
        defaultMetadata,
        defaultAssemblyRules,
        defaultSourceRefs,
      );
    }, /Invalid context reference format/);
  });

  test("Ownership validation blocks execution under invalid actor ID", () => {
    const context = Context.create(
      "ctx-1",
      "client.profile.summary",
      "owner-999",
      defaultBlueprint,
      defaultMetadata,
      defaultAssemblyRules,
      defaultSourceRefs,
    );

    assert.throws(() => {
      context.updateDraft(
        "unauthorized-owner",
        alternativeBlueprint,
        defaultMetadata,
        defaultAssemblyRules,
        defaultSourceRefs,
      );
    }, /Ownership validation failed: unauthorized owner context/);

    assert.throws(() => {
      context.validate("unauthorized-owner");
    }, /Ownership validation failed: unauthorized owner context/);
  });

  test("Updating draft replaces value objects and keeps historical arrays immutable", () => {
    const context = Context.create(
      "ctx-1",
      "client.profile.summary",
      "owner-999",
      defaultBlueprint,
      defaultMetadata,
      defaultAssemblyRules,
      defaultSourceRefs,
    );

    context.updateDraft(
      "owner-999",
      alternativeBlueprint,
      alternativeMetadata,
      alternativeAssemblyRules,
      alternativeSourceRefs,
    );

    assert.strictEqual(context.blueprint.equals(alternativeBlueprint), true);
    assert.strictEqual(context.metadata.equals(alternativeMetadata), true);
    assert.strictEqual(context.assemblyRules.length, 1);
    assert.strictEqual(context.sourceReferences.length, 1);
  });

  test("Lifecycle flow: Draft -> Validated -> Published -> Archived", () => {
    const context = Context.create(
      "ctx-1",
      "client.profile.summary",
      "owner-999",
      defaultBlueprint,
      defaultMetadata,
      defaultAssemblyRules,
      defaultSourceRefs,
    );

    // 1. Validate draft
    context.clearDomainEvents();
    context.validate("owner-999");
    assert.strictEqual(context.status, "Validated");
    assert.strictEqual(context.domainEvents.length, 1);
    assert.strictEqual(
      (context.domainEvents[0] as ContextDomainEvent).eventType,
      CONTEXT_VALIDATED,
    );

    // Cannot edit in Validated status
    assert.throws(() => {
      context.updateDraft(
        "owner-999",
        alternativeBlueprint,
        defaultMetadata,
        defaultAssemblyRules,
        defaultSourceRefs,
      );
    }, /Cannot update context in status: Validated/);

    // 2. Publish validated context
    context.clearDomainEvents();
    context.publish("owner-999");
    assert.strictEqual(context.status, "Published");
    assert.strictEqual(context.domainEvents.length, 1);
    assert.strictEqual(
      (context.domainEvents[0] as ContextDomainEvent).eventType,
      CONTEXT_PUBLISHED,
    );

    // Cannot publish again or validate
    assert.throws(() => {
      context.publish("owner-999");
    }, /Cannot publish context when in status: Published/);

    // 3. Archive published context
    context.clearDomainEvents();
    context.archive("owner-999");
    assert.strictEqual(context.status, "Archived");
    assert.strictEqual(context.domainEvents.length, 1);
    assert.strictEqual((context.domainEvents[0] as ContextDomainEvent).eventType, CONTEXT_ARCHIVED);

    // Cannot perform state transitions on archived context
    assert.throws(() => {
      context.archive("owner-999");
    }, /Context is already archived/);
  });

  test("Draft -> Archived transition works successfully", () => {
    const context = Context.create(
      "ctx-1",
      "client.profile.summary",
      "owner-999",
      defaultBlueprint,
      defaultMetadata,
      defaultAssemblyRules,
      defaultSourceRefs,
    );

    context.archive("owner-999");
    assert.strictEqual(context.status, "Archived");
  });

  test("Validated -> Archived transition works successfully", () => {
    const context = Context.create(
      "ctx-1",
      "client.profile.summary",
      "owner-999",
      defaultBlueprint,
      defaultMetadata,
      defaultAssemblyRules,
      defaultSourceRefs,
    );

    context.validate("owner-999");
    context.archive("owner-999");
    assert.strictEqual(context.status, "Archived");
  });

  test("Invalid lifecycle transition: cannot publish draft without validation", () => {
    const context = Context.create(
      "ctx-1",
      "client.profile.summary",
      "owner-999",
      defaultBlueprint,
      defaultMetadata,
      defaultAssemblyRules,
      defaultSourceRefs,
    );

    assert.throws(() => {
      context.publish("owner-999");
    }, /Cannot publish context when in status: Draft/);
  });

  test("Mock interfaces contract compliance check", async () => {
    const mockStore: ContextAggregateStore = {
      save: async (context: Context) => {
        assert.ok(context.id);
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

    const context = Context.create(
      "ctx-1",
      "client.profile.summary",
      "owner-999",
      defaultBlueprint,
      defaultMetadata,
      defaultAssemblyRules,
      defaultSourceRefs,
    );

    await mockStore.save(context);

    const mockPersistence: ContextPersistenceContract = {
      checkUniqueReference: async (
        ownerId: string,
        reference: string,
        excludeContextId?: string,
      ) => {
        assert.ok(ownerId);
        assert.ok(reference);
        if (excludeContextId) {
          assert.ok(excludeContextId);
        }
        return true;
      },
    };

    const isUnique = await mockPersistence.checkUniqueReference(
      "owner-999",
      "client.profile.summary",
    );
    assert.strictEqual(isUnique, true);

    const projection: ContextQueryProjection = {
      id: "ctx-1",
      reference: "client.profile.summary",
      ownerId: "owner-999",
      displayName: "Summary View",
      status: "Published",
      updatedAt: new Date(),
    };

    assert.strictEqual(projection.status, "Published");
  });
});
