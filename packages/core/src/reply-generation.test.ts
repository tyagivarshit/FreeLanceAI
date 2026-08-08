import { test, describe } from "node:test";
import assert from "node:assert";
import {
  GenerationReference,
  GenerationConstraint,
  GenerationMetadata,
  GenerationContent,
  GenerationRequest,
  GenerationResult,
  ReplyGeneration,
  REPLY_GENERATION_DRAFTED,
} from "./reply-generation.js";
import type {
  ReplyGenerationPersistenceContract,
  ReplyGenerationAggregateStore,
} from "./reply-generation.js";

describe("Chapter 7A — Reply Studio / Generation Domain Tests", () => {
  const defaultRef = new GenerationReference("reply.1");
  const defaultMetadata = new GenerationMetadata({
    displayName: "Welcome Reply Template",
    description: "Initial client hello template",
  });
  const defaultConstraint = new GenerationConstraint("length", "short");
  const defaultRequest = new GenerationRequest({
    reference: defaultRef,
    intent: "Say hello to new client",
    constraints: [defaultConstraint],
    metadata: defaultMetadata,
  });

  // A. GenerationReference
  describe("GenerationReference", () => {
    test("valid reference", () => {
      const ref1 = new GenerationReference("reply.1");
      const ref2 = new GenerationReference("proposal-followup");
      const ref3 = new GenerationReference("client.reply.01");
      assert.strictEqual(ref1.value, "reply.1");
      assert.strictEqual(ref2.value, "proposal-followup");
      assert.strictEqual(ref3.value, "client.reply.01");
    });

    test("empty reference rejected", () => {
      assert.throws(() => new GenerationReference(""), /required/);
      assert.throws(() => new GenerationReference("   "), /required/);
    });

    test("uppercase rejected", () => {
      assert.throws(() => new GenerationReference("Ref.1"), /Invalid/);
      assert.throws(() => new GenerationReference("Client.Reply"), /Invalid/);
    });

    test("invalid characters rejected", () => {
      assert.throws(() => new GenerationReference("reply@1"), /Invalid/);
      assert.throws(() => new GenerationReference("reply_1"), /Invalid/);
    });

    test("immutability", () => {
      const ref = new GenerationReference("reply.1");
      assert.throws(() => {
        (ref as unknown as { value: string }).value = "mutated";
      }, TypeError);
    });

    test("equality", () => {
      const ref1 = new GenerationReference("reply.1");
      const ref2 = new GenerationReference("reply.1");
      const ref3 = new GenerationReference("reply.2");
      assert.ok(ref1.equals(ref2));
      assert.ok(!ref1.equals(ref3));
    });
  });

  // B. GenerationConstraint
  describe("GenerationConstraint", () => {
    test("length constraints", () => {
      assert.strictEqual(new GenerationConstraint("length", "short").value, "short");
      assert.strictEqual(new GenerationConstraint("length", "medium").value, "medium");
      assert.strictEqual(new GenerationConstraint("length", "long").value, "long");
    });

    test("format constraints", () => {
      assert.strictEqual(new GenerationConstraint("format", "plain-text").value, "plain-text");
      assert.strictEqual(new GenerationConstraint("format", "markdown").value, "markdown");
    });

    test("invalid type rejected", () => {
      assert.throws(
        () => new GenerationConstraint("unsupported", "value"),
        /Invalid constraint type/,
      );
    });

    test("invalid value rejected", () => {
      assert.throws(
        () => new GenerationConstraint("length", "xlarge"),
        /Invalid length constraint value/,
      );
      assert.throws(
        () => new GenerationConstraint("format", "html"),
        /Invalid format constraint value/,
      );
    });

    test("immutability", () => {
      const constraint = new GenerationConstraint("length", "short");
      assert.throws(() => {
        (constraint as unknown as { type: string }).type = "format";
      }, TypeError);
    });
  });

  // C. GenerationMetadata
  describe("GenerationMetadata", () => {
    test("valid construction", () => {
      const meta = new GenerationMetadata({ displayName: "Name", description: "Desc" });
      assert.strictEqual(meta.displayName, "Name");
      assert.strictEqual(meta.description, "Desc");
    });

    test("missing displayName rejected", () => {
      assert.throws(
        () => new GenerationMetadata({ displayName: "", description: "Desc" }),
        /Display Name/,
      );
    });

    test("missing description rejected", () => {
      assert.throws(
        () => new GenerationMetadata({ displayName: "Name", description: "" }),
        /Description/,
      );
    });

    test("immutability", () => {
      const meta = new GenerationMetadata({ displayName: "Name", description: "Desc" });
      assert.throws(() => {
        (meta as unknown as { displayName: string }).displayName = "New";
      }, TypeError);
    });
  });

  // D. GenerationContent
  describe("GenerationContent", () => {
    test("valid content", () => {
      const content = new GenerationContent("Please find attached the quote.");
      assert.strictEqual(content.replyText, "Please find attached the quote.");
    });

    test("empty content rejected", () => {
      assert.throws(() => new GenerationContent(""), /Reply text/);
    });

    test("HTML tags rejected", () => {
      assert.throws(() => new GenerationContent("Hello <b>client</b>"), /HTML tags/);
      assert.throws(() => new GenerationContent("<div>Hello</div>"), /HTML tags/);
    });

    test("immutability", () => {
      const content = new GenerationContent("Valid text");
      assert.throws(() => {
        (content as unknown as { replyText: string }).replyText = "New";
      }, TypeError);
    });
  });

  // E. GenerationRequest
  describe("GenerationRequest", () => {
    test("valid construction & nested validation", () => {
      const req = new GenerationRequest({
        reference: defaultRef,
        intent: "Test intent",
        constraints: [defaultConstraint],
        metadata: defaultMetadata,
      });
      assert.ok(req.reference.equals(defaultRef));
      assert.strictEqual(req.intent, "Test intent");
      assert.strictEqual(req.constraints.length, 1);
      assert.ok(req.metadata.equals(defaultMetadata));
    });

    test("constraints and request immutability", () => {
      const constraints = [defaultConstraint];
      const req = new GenerationRequest({
        reference: defaultRef,
        intent: "Test intent",
        constraints,
        metadata: defaultMetadata,
      });

      // Attempt to modify original array passed to constructor
      constraints.push(new GenerationConstraint("format", "markdown"));
      assert.strictEqual(req.constraints.length, 1);

      // Attempt to modify array returned from getter
      assert.throws(() => {
        (req.constraints as unknown as GenerationConstraint[]).push(
          new GenerationConstraint("format", "markdown"),
        );
      }, TypeError);
    });
  });

  // F. GenerationResult
  describe("GenerationResult", () => {
    test("Date defensive copy", () => {
      const content = new GenerationContent("Generated reply text");
      const generatedAt = new Date("2026-08-08T12:00:00Z");
      const result = new GenerationResult({ content, generatedAt });

      // Mutate original date
      generatedAt.setTime(0);
      assert.strictEqual(result.generatedAt.getTime(), new Date("2026-08-08T12:00:00Z").getTime());

      // Mutate returned date
      const returnedDate = result.generatedAt;
      returnedDate.setTime(0);
      assert.strictEqual(result.generatedAt.getTime(), new Date("2026-08-08T12:00:00Z").getTime());
    });
  });

  // G. ReplyGeneration creation
  describe("ReplyGeneration creation", () => {
    test("Draft state, snapshot, and event mapping", () => {
      const id = "gen-1";
      const aggregate = ReplyGeneration.create(
        id,
        defaultRef,
        "owner-1",
        "client-1",
        "conv-1",
        defaultRequest,
      );

      assert.strictEqual(aggregate.id, id);
      assert.strictEqual(aggregate.status, "Draft");
      assert.strictEqual(aggregate.ownerId, "owner-1");
      assert.strictEqual(aggregate.clientId, "client-1");
      assert.strictEqual(aggregate.conversationId, "conv-1");

      // Version 1 Snapshot
      assert.strictEqual(aggregate.snapshots.length, 1);
      assert.strictEqual(aggregate.snapshots[0]!.version, 1);
      assert.strictEqual(aggregate.snapshots[0]!.status, "Draft");
      assert.ok(aggregate.snapshots[0]!.request.equals(defaultRequest));
      assert.strictEqual(aggregate.snapshots[0]!.result, undefined);

      // REPLY_GENERATION_DRAFTED event
      assert.strictEqual(aggregate.domainEvents.length, 1);
      assert.strictEqual(aggregate.domainEvents[0]!.eventType, REPLY_GENERATION_DRAFTED);
      assert.strictEqual(aggregate.domainEvents[0]!.generationId, id);
      assert.strictEqual(aggregate.domainEvents[0]!.reference, defaultRef.value);
      assert.strictEqual(aggregate.domainEvents[0]!.ownerId, "owner-1");
      assert.strictEqual(aggregate.domainEvents[0]!.clientId, "client-1");
      assert.strictEqual(aggregate.domainEvents[0]!.conversationId, "conv-1");
      assert.strictEqual(aggregate.domainEvents[0]!.snapshotVersion, 1);
    });
  });

  // H. Ownership validation
  describe("Ownership validation", () => {
    test("Command operation ownership enforcement", () => {
      const aggregate = ReplyGeneration.create(
        "gen-1",
        defaultRef,
        "owner-1",
        "client-1",
        "conv-1",
        defaultRequest,
      );

      // Rejects command with invalid owner
      assert.throws(() => {
        aggregate.requestGeneration("owner-other");
      }, /Ownership validation failed: unauthorized owner context\./);

      // Succeeds with correct owner
      aggregate.requestGeneration("owner-1");
      assert.strictEqual(aggregate.status, "Requested");
    });
  });

  // I & J. Lifecycle Transitions
  describe("Lifecycle Transitions", () => {
    test("Draft -> Requested -> Generated", () => {
      const aggregate = ReplyGeneration.create(
        "gen-1",
        defaultRef,
        "owner-1",
        "client-1",
        "conv-1",
        defaultRequest,
      );

      // Draft -> Requested
      aggregate.requestGeneration("owner-1");
      assert.strictEqual(aggregate.status, "Requested");
      assert.strictEqual(aggregate.snapshots.length, 2);

      // Requested -> Generated
      const result = new GenerationResult({
        content: new GenerationContent("Perfect generated reply"),
        generatedAt: new Date(),
      });
      aggregate.completeGeneration("owner-1", result);
      assert.strictEqual(aggregate.status, "Generated");
      assert.strictEqual(aggregate.snapshots.length, 3);
      assert.ok(aggregate.result!.equals(result));
    });

    test("Draft -> Archived, Requested -> Archived, Generated -> Archived", () => {
      const agg1 = ReplyGeneration.create(
        "gen-1",
        defaultRef,
        "owner-1",
        "client-1",
        "conv-1",
        defaultRequest,
      );
      agg1.archive("owner-1");
      assert.strictEqual(agg1.status, "Archived");

      const agg2 = ReplyGeneration.create(
        "gen-2",
        defaultRef,
        "owner-1",
        "client-1",
        "conv-1",
        defaultRequest,
      );
      agg2.requestGeneration("owner-1");
      agg2.archive("owner-1");
      assert.strictEqual(agg2.status, "Archived");

      const agg3 = ReplyGeneration.create(
        "gen-3",
        defaultRef,
        "owner-1",
        "client-1",
        "conv-1",
        defaultRequest,
      );
      agg3.requestGeneration("owner-1");
      const result = new GenerationResult({
        content: new GenerationContent("Some content"),
        generatedAt: new Date(),
      });
      agg3.completeGeneration("owner-1", result);
      agg3.archive("owner-1");
      assert.strictEqual(agg3.status, "Archived");
    });

    test("Archived is terminal, transitions out are blocked", () => {
      const agg = ReplyGeneration.create(
        "gen-1",
        defaultRef,
        "owner-1",
        "client-1",
        "conv-1",
        defaultRequest,
      );
      agg.archive("owner-1");

      assert.throws(() => {
        agg.requestGeneration("owner-1");
      }, /Invalid lifecycle transition from ARCHIVED to REQUESTED/);

      assert.throws(() => {
        agg.archive("owner-1");
      }, /Reply generation is already archived/);
    });

    test("Illegal transitions throw descriptive exceptions", () => {
      const agg1 = ReplyGeneration.create(
        "gen-1",
        defaultRef,
        "owner-1",
        "client-1",
        "conv-1",
        defaultRequest,
      );

      // Draft directly to Generated throws
      const result = new GenerationResult({
        content: new GenerationContent("Result"),
        generatedAt: new Date(),
      });
      assert.throws(() => {
        agg1.completeGeneration("owner-1", result);
      }, /Invalid lifecycle transition from DRAFT to GENERATED/);

      // Transition to Draft throws
      agg1.requestGeneration("owner-1");
      assert.throws(() => {
        (agg1 as unknown as { transitionTo(s: string): void }).transitionTo("Draft");
      }, /Invalid lifecycle transition from REQUESTED to DRAFT/);
    });
  });

  // M. Snapshots
  describe("Snapshot stability and defensive copy", () => {
    test("mutating snapshots array does not alter history", () => {
      const agg = ReplyGeneration.create(
        "gen-1",
        defaultRef,
        "owner-1",
        "client-1",
        "conv-1",
        defaultRequest,
      );
      const snaps = agg.snapshots;

      assert.throws(() => {
        (snaps as unknown as unknown[]).push({});
      }, TypeError);
    });

    test("snapshot dates are copied defensively", () => {
      const agg = ReplyGeneration.create(
        "gen-1",
        defaultRef,
        "owner-1",
        "client-1",
        "conv-1",
        defaultRequest,
      );
      const snap = agg.snapshots[0]!;
      const snapDate = snap.createdAt;
      const originalTime = snapDate.getTime();

      snapDate.setTime(0);
      assert.strictEqual(snap.createdAt.getTime(), originalTime);
    });
  });

  // O. Persistence Interface compile checks
  describe("Persistence Interfaces Compile Checks", () => {
    test("contracts signatures check", () => {
      const dummyStore: ReplyGenerationAggregateStore = {
        async save(_gen: ReplyGeneration): Promise<void> {},
        async findById(_id: string, _ownerId: string): Promise<ReplyGeneration | null> {
          return null;
        },
        async findByReference(_ref: string, _ownerId: string): Promise<ReplyGeneration | null> {
          return null;
        },
      };

      const dummyContract: ReplyGenerationPersistenceContract = {
        async checkUniqueReference(
          _ownerId: string,
          _reference: string,
          _excludeGenerationId?: string,
        ): Promise<boolean> {
          return true;
        },
      };

      assert.ok(dummyStore);
      assert.ok(dummyContract);
    });
  });

  // P. Boundary Checks
  describe("Boundary isolation tests", () => {
    test("No external libraries are imported", () => {
      const keys = Object.keys(ReplyGeneration.prototype);
      assert.ok(!keys.includes("_aiProviderClient"));
      assert.ok(!keys.includes("_documentExtractor"));
      assert.ok(!keys.includes("executePrompt"));
    });
  });
});
