import { test, describe } from "node:test";
import assert from "node:assert";
import {
  Prompt,
  PromptDefinition,
  PromptMetadata,
  LogicalVisibilityClassification,
  PROMPT_REGISTERED,
  PROMPT_UPDATED,
  PROMPT_PUBLISHED,
  PROMPT_DEPRECATED,
  PROMPT_ARCHIVED,
} from "./prompt-registry.js";
import type {
  PromptAggregateStore,
  PromptPersistenceContract,
  PromptQueryProjection,
} from "./prompt-registry.js";

describe("Prompt Registry Domain Aggregate Tests", () => {
  const defaultDefinition = new PromptDefinition({
    promptTextSpecification: "Hello {{name}}, welcome to FreelanceOS!",
  });

  const alternativeDefinition = new PromptDefinition({
    promptTextSpecification: "Welcome {{name}}! Let's get started on your project.",
  });

  const defaultMetadata = new PromptMetadata({
    displayName: "Welcome Client",
    description: "Welcome prompt sent to onboarding freelance clients.",
    purpose: "Client Onboarding",
    classification: "Support",
    versionSummary: "Initial version",
  });

  const alternativeMetadata = new PromptMetadata({
    displayName: "Welcome Client - v2",
    description: "Updated welcome prompt with clearer milestones.",
    purpose: "Client Onboarding",
    classification: "Support",
    versionSummary: "Refined prompt structure",
  });

  const defaultVisibility = new LogicalVisibilityClassification("LogicalClassificationA");
  const alternativeVisibility = new LogicalVisibilityClassification("LogicalClassificationB");

  test("Prompt creation success: initial status Draft, version 1 draft snapshot, and event emitted", () => {
    const prompt = Prompt.create(
      "prompt-1",
      "client.onboarding.welcome",
      "owner-123",
      defaultDefinition,
      defaultMetadata,
      defaultVisibility,
    );

    assert.strictEqual(prompt.id, "prompt-1");
    assert.strictEqual(prompt.reference, "client.onboarding.welcome");
    assert.strictEqual(prompt.ownerId, "owner-123");
    assert.strictEqual(prompt.status, "Draft");
    assert.strictEqual(
      prompt.definition.promptTextSpecification,
      "Hello {{name}}, welcome to FreelanceOS!",
    );
    assert.strictEqual(prompt.metadata.displayName, "Welcome Client");
    assert.strictEqual(prompt.visibility.value, "LogicalClassificationA");

    // Check version list
    assert.strictEqual(prompt.versions.length, 1);
    const ver = prompt.versions[0]!;
    assert.strictEqual(ver.versionNumber, 1);
    assert.strictEqual(ver.state, "Draft");
    assert.strictEqual(
      ver.definitionSnapshot.promptTextSpecification,
      defaultDefinition.promptTextSpecification,
    );
    assert.strictEqual(ver.metadataSnapshot.displayName, defaultMetadata.displayName);
    assert.strictEqual(ver.visibilitySnapshot.value, defaultVisibility.value);

    // Event checking
    assert.strictEqual(prompt.domainEvents.length, 1);
    const event = prompt.domainEvents[0]!;
    assert.strictEqual(event.eventType, PROMPT_REGISTERED);
    assert.strictEqual(event.promptId, "prompt-1");
    assert.strictEqual(event.reference, "client.onboarding.welcome");
    assert.strictEqual(event.ownerId, "owner-123");
  });

  test("Prompt reference format validation rejects invalid strings", () => {
    assert.throws(() => {
      Prompt.create(
        "prompt-1",
        "client..onboarding.welcome", // double dots
        "owner-123",
        defaultDefinition,
        defaultMetadata,
        defaultVisibility,
      );
    }, /Invalid prompt reference format/);

    assert.throws(() => {
      Prompt.create(
        "prompt-1",
        "Client.Onboarding", // Upper-case
        "owner-123",
        defaultDefinition,
        defaultMetadata,
        defaultVisibility,
      );
    }, /Invalid prompt reference format/);

    assert.throws(() => {
      Prompt.create(
        "prompt-1",
        "client-onboarding", // hyphens instead of dots
        "owner-123",
        defaultDefinition,
        defaultMetadata,
        defaultVisibility,
      );
    }, /Invalid prompt reference format/);
  });

  test("Prompt owner validation blocks operations with mismatched owner ID", () => {
    const prompt = Prompt.create(
      "prompt-1",
      "client.onboarding.welcome",
      "owner-123",
      defaultDefinition,
      defaultMetadata,
      defaultVisibility,
    );

    assert.throws(() => {
      prompt.updateDraft(
        "unauthorized-owner",
        alternativeDefinition,
        defaultMetadata,
        defaultVisibility,
      );
    }, /Ownership validation failed: unauthorized owner context/);

    assert.throws(() => {
      prompt.publish("unauthorized-owner");
    }, /Ownership validation failed: unauthorized owner context/);
  });

  test("Missing owner identity in context throws error", () => {
    const prompt = Prompt.create(
      "prompt-1",
      "client.onboarding.welcome",
      "owner-123",
      defaultDefinition,
      defaultMetadata,
      defaultVisibility,
    );

    assert.throws(() => {
      prompt.publish("");
    }, /Missing owner identity in caller context/);
  });

  test("Updating a draft successfully replaces metadata value object and updates existing version snapshot", () => {
    const prompt = Prompt.create(
      "prompt-1",
      "client.onboarding.welcome",
      "owner-123",
      defaultDefinition,
      defaultMetadata,
      defaultVisibility,
    );

    prompt.clearDomainEvents();

    prompt.updateDraft(
      "owner-123",
      alternativeDefinition,
      alternativeMetadata,
      alternativeVisibility,
    );

    assert.strictEqual(prompt.definition.equals(alternativeDefinition), true);
    assert.strictEqual(prompt.metadata.equals(alternativeMetadata), true);
    assert.strictEqual(prompt.visibility.equals(alternativeVisibility), true);

    // Verify snapshot inside versions is also updated for version 1
    assert.strictEqual(prompt.versions.length, 1);
    const ver = prompt.versions[0]!;
    assert.strictEqual(
      ver.definitionSnapshot.promptTextSpecification,
      alternativeDefinition.promptTextSpecification,
    );
    assert.strictEqual(ver.metadataSnapshot.displayName, alternativeMetadata.displayName);

    // Assert PROMPT_UPDATED event
    assert.strictEqual(prompt.domainEvents.length, 1);
    const event = prompt.domainEvents[0]!;
    assert.strictEqual(event.eventType, PROMPT_UPDATED);
    if (event.eventType === PROMPT_UPDATED) {
      assert.strictEqual(event.versionNumber, 1);
      assert.strictEqual(event.promptId, "prompt-1");
    }
  });

  test("Publishing a draft transitions state to Published and freezes version 1 snapshot", () => {
    const prompt = Prompt.create(
      "prompt-1",
      "client.onboarding.welcome",
      "owner-123",
      defaultDefinition,
      defaultMetadata,
      defaultVisibility,
    );

    prompt.clearDomainEvents();
    prompt.publish("owner-123");

    assert.strictEqual(prompt.status, "Published");
    assert.strictEqual(prompt.versions.length, 1);
    assert.strictEqual(prompt.versions[0]!.state, "Published");
    assert.ok(prompt.versions[0]!.publishedAt);

    assert.strictEqual(prompt.domainEvents.length, 1);
    const event = prompt.domainEvents[0]!;
    assert.strictEqual(event.eventType, PROMPT_PUBLISHED);
    if (event.eventType === PROMPT_PUBLISHED) {
      assert.strictEqual(event.versionNumber, 1);
    }
  });

  test("Creating a new draft from Published increments version number and leaves published version frozen", () => {
    const prompt = Prompt.create(
      "prompt-1",
      "client.onboarding.welcome",
      "owner-123",
      defaultDefinition,
      defaultMetadata,
      defaultVisibility,
    );

    prompt.publish("owner-123");
    prompt.clearDomainEvents();

    prompt.createNewDraft(
      "owner-123",
      alternativeDefinition,
      alternativeMetadata,
      alternativeVisibility,
    );

    assert.strictEqual(prompt.status, "Draft");
    assert.strictEqual(prompt.versions.length, 2);

    // Verify V1 remains frozen as Published
    const v1 = prompt.versions[0]!;
    assert.strictEqual(v1.versionNumber, 1);
    assert.strictEqual(v1.state, "Published");
    assert.strictEqual(
      v1.definitionSnapshot.promptTextSpecification,
      defaultDefinition.promptTextSpecification,
    );

    // Verify V2 is in Draft state
    const v2 = prompt.versions[1]!;
    assert.strictEqual(v2.versionNumber, 2);
    assert.strictEqual(v2.state, "Draft");
    assert.strictEqual(
      v2.definitionSnapshot.promptTextSpecification,
      alternativeDefinition.promptTextSpecification,
    );

    // Assert Domain Event is PROMPT_UPDATED with version number 2
    assert.strictEqual(prompt.domainEvents.length, 1);
    const event = prompt.domainEvents[0]!;
    assert.strictEqual(event.eventType, PROMPT_UPDATED);
    if (event.eventType === PROMPT_UPDATED) {
      assert.strictEqual(event.versionNumber, 2);
    }
  });

  test("Lifecycle flow: Published -> Deprecated -> Archived transitions correctly", () => {
    const prompt = Prompt.create(
      "prompt-1",
      "client.onboarding.welcome",
      "owner-123",
      defaultDefinition,
      defaultMetadata,
      defaultVisibility,
    );

    // 1. Draft -> Published
    prompt.publish("owner-123");
    assert.strictEqual(prompt.status, "Published");
    assert.strictEqual(prompt.versions[0]!.state, "Published");

    // 2. Published -> Deprecated
    prompt.clearDomainEvents();
    prompt.deprecate("owner-123");
    assert.strictEqual(prompt.status, "Deprecated");
    assert.strictEqual(prompt.versions[0]!.state, "Published"); // remains Published
    assert.strictEqual(prompt.domainEvents[0]!.eventType, PROMPT_DEPRECATED);

    // 3. Deprecated -> Archived
    prompt.clearDomainEvents();
    prompt.archive("owner-123");
    assert.strictEqual(prompt.status, "Archived");
    assert.strictEqual(prompt.versions[0]!.state, "Published"); // remains Published
    assert.strictEqual(prompt.domainEvents[0]!.eventType, PROMPT_ARCHIVED);
  });

  test("Draft -> Archived transition functions correctly", () => {
    const prompt = Prompt.create(
      "prompt-1",
      "client.onboarding.welcome",
      "owner-123",
      defaultDefinition,
      defaultMetadata,
      defaultVisibility,
    );

    prompt.archive("owner-123");
    assert.strictEqual(prompt.status, "Archived");
    assert.strictEqual(prompt.versions[0]!.state, "Draft"); // remains Draft
  });

  test("Published -> Archived transition functions correctly", () => {
    const prompt = Prompt.create(
      "prompt-1",
      "client.onboarding.welcome",
      "owner-123",
      defaultDefinition,
      defaultMetadata,
      defaultVisibility,
    );

    prompt.publish("owner-123");
    prompt.archive("owner-123");
    assert.strictEqual(prompt.status, "Archived");
    assert.strictEqual(prompt.versions[0]!.state, "Published"); // remains Published
  });

  test("Double archiving throws an error", () => {
    const prompt = Prompt.create(
      "prompt-1",
      "client.onboarding.welcome",
      "owner-123",
      defaultDefinition,
      defaultMetadata,
      defaultVisibility,
    );

    prompt.archive("owner-123");
    assert.throws(() => {
      prompt.archive("owner-123");
    }, /Prompt is already archived/);
  });

  test("Invalid transition: Cannot publish an archived prompt", () => {
    const prompt = Prompt.create(
      "prompt-1",
      "client.onboarding.welcome",
      "owner-123",
      defaultDefinition,
      defaultMetadata,
      defaultVisibility,
    );

    prompt.archive("owner-123");
    assert.throws(() => {
      prompt.publish("owner-123");
    }, /Cannot publish prompt when in status: Archived/);
  });

  test("Invalid transition: Cannot deprecate draft prompt", () => {
    const prompt = Prompt.create(
      "prompt-1",
      "client.onboarding.welcome",
      "owner-123",
      defaultDefinition,
      defaultMetadata,
      defaultVisibility,
    );

    assert.throws(() => {
      prompt.deprecate("owner-123");
    }, /Cannot deprecate prompt in status: Draft/);
  });

  test("Mock store interface compliance check", async () => {
    const mockStore: PromptAggregateStore = {
      save: async (prompt: Prompt) => {
        assert.ok(prompt.id);
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

    const prompt = Prompt.create(
      "prompt-1",
      "client.onboarding.welcome",
      "owner-123",
      defaultDefinition,
      defaultMetadata,
      defaultVisibility,
    );

    await mockStore.save(prompt);
  });

  test("Mock persistence unique reference check interface compliance", async () => {
    const mockPersist: PromptPersistenceContract = {
      checkUniqueReference: async (
        ownerId: string,
        reference: string,
        excludePromptId?: string,
      ) => {
        assert.ok(ownerId);
        assert.ok(reference);
        if (excludePromptId) {
          assert.ok(excludePromptId);
        }
        return true;
      },
    };

    const unique = await mockPersist.checkUniqueReference("owner-123", "client.onboarding.welcome");
    assert.strictEqual(unique, true);
  });

  test("Mock projection values compliance check", () => {
    const projection: PromptQueryProjection = {
      id: "prompt-1",
      reference: "client.onboarding.welcome",
      ownerId: "owner-123",
      displayName: "Welcome Prompt",
      status: "Published",
      latestVersionNumber: 1,
      updatedAt: new Date(),
    };

    assert.strictEqual(projection.id, "prompt-1");
  });
});
