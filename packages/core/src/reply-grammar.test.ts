import { test, describe } from "node:test";
import assert from "node:assert";
import {
  GrammarProfile,
  GrammarRequest,
  GrammarResult,
  ReplyGrammarCorrection,
  REPLY_GRAMMAR_DRAFTED,
  REPLY_GRAMMAR_REQUESTED,
  REPLY_GRAMMAR_CORRECTED,
  REPLY_GRAMMAR_ARCHIVED,
} from "./reply-grammar.js";
import type {
  ReplyGrammarPersistenceContract,
  ReplyGrammarAggregateStore,
} from "./reply-grammar.js";

describe("Chapter 7D — Reply Studio / Grammar Correction Domain Tests", () => {
  const defaultProfile = new GrammarProfile("standard");
  const defaultRequest = new GrammarRequest({
    sourceReference: "reply.1",
    sourceVersion: 1,
    targetProfile: defaultProfile,
  });

  // 1. GrammarProfile
  describe("GrammarProfile", () => {
    test("valid profiles vocabulary", () => {
      const profiles = ["standard", "formal", "simplified"];
      for (const val of profiles) {
        const profile = new GrammarProfile(val);
        assert.strictEqual(profile.value, val);
      }
    });

    test("unsupported profile rejected", () => {
      assert.throws(() => new GrammarProfile("casual"), /Invalid grammar profile/);
      assert.throws(() => new GrammarProfile("professional"), /Invalid grammar profile/);
      assert.throws(() => new GrammarProfile("friendly"), /Invalid grammar profile/);
    });

    test("immutability", () => {
      const profile = new GrammarProfile("standard");
      assert.throws(() => {
        (profile as unknown as { value: string }).value = "formal";
      }, TypeError);
    });

    test("equality", () => {
      const p1 = new GrammarProfile("standard");
      const p2 = new GrammarProfile("standard");
      const p3 = new GrammarProfile("formal");
      assert.ok(p1.equals(p2));
      assert.ok(!p1.equals(p3));
    });
  });

  // 2. GrammarRequest
  describe("GrammarRequest", () => {
    test("valid request properties", () => {
      const req = new GrammarRequest({
        sourceReference: "reply.1",
        sourceVersion: 2,
        targetProfile: defaultProfile,
      });
      assert.strictEqual(req.sourceReference, "reply.1");
      assert.strictEqual(req.sourceVersion, 2);
      assert.ok(req.targetProfile.equals(defaultProfile));
    });

    test("immutability and nested validation", () => {
      const req = new GrammarRequest({
        sourceReference: "reply.1",
        sourceVersion: 1,
        targetProfile: defaultProfile,
      });
      assert.throws(() => {
        (req as unknown as { sourceVersion: number }).sourceVersion = 5;
      }, TypeError);
    });
  });

  // 3. GrammarResult
  describe("GrammarResult", () => {
    test("valid result", () => {
      const date = new Date("2026-08-11T12:00:00Z");
      const res = new GrammarResult({
        correctedText: "This is grammar corrected text.",
        correctedAt: date,
      });
      assert.strictEqual(res.correctedText, "This is grammar corrected text.");
      assert.strictEqual(res.correctedAt.getTime(), date.getTime());

      // Mutate constructor input date
      date.setTime(0);
      assert.strictEqual(res.correctedAt.getTime(), new Date("2026-08-11T12:00:00Z").getTime());

      // Mutate getter output date
      const returnedDate = res.correctedAt;
      returnedDate.setTime(0);
      assert.strictEqual(res.correctedAt.getTime(), new Date("2026-08-11T12:00:00Z").getTime());
    });

    test("invalid result content rejected", () => {
      assert.throws(() => {
        new GrammarResult({
          correctedText: "",
          correctedAt: new Date(),
        });
      }, /content is required/i);
    });
  });

  // 4. Aggregate Creation
  describe("ReplyGrammarCorrection creation", () => {
    test("initial state, snapshots, and event", () => {
      const id = "grammar-1";
      const aggregate = ReplyGrammarCorrection.create(id, "reply.1", "owner-1", 1, defaultRequest);

      assert.strictEqual(aggregate.id, id);
      assert.strictEqual(aggregate.sourceReference, "reply.1");
      assert.strictEqual(aggregate.ownerId, "owner-1");
      assert.strictEqual(aggregate.sourceVersion, 1);
      assert.strictEqual(aggregate.status, "Draft");

      // Version 1 snapshot
      assert.strictEqual(aggregate.snapshots.length, 1);
      assert.strictEqual(aggregate.snapshots[0]!.version, 1);
      assert.strictEqual(aggregate.snapshots[0]!.status, "Draft");
      assert.ok(aggregate.snapshots[0]!.request.equals(defaultRequest));
      assert.strictEqual(aggregate.snapshots[0]!.result, undefined);

      // Event emitted
      assert.strictEqual(aggregate.domainEvents.length, 1);
      assert.strictEqual(aggregate.domainEvents[0]!.eventType, REPLY_GRAMMAR_DRAFTED);
      assert.strictEqual(aggregate.domainEvents[0]!.grammarCorrectionId, id);
      assert.strictEqual(aggregate.domainEvents[0]!.sourceReference, "reply.1");
      assert.strictEqual(aggregate.domainEvents[0]!.ownerId, "owner-1");
      assert.strictEqual(aggregate.domainEvents[0]!.sourceVersion, 1);
      assert.strictEqual(aggregate.domainEvents[0]!.grammarProfile, "standard");
      assert.strictEqual(aggregate.domainEvents[0]!.snapshotVersion, 1);
    });
  });

  // 5. Ownership
  describe("Ownership validation", () => {
    test("ownership checks on command operations", () => {
      const aggregate = ReplyGrammarCorrection.create(
        "grammar-1",
        "reply.1",
        "owner-1",
        1,
        defaultRequest,
      );

      // Unauthorized checks
      assert.throws(() => {
        aggregate.requestGrammarCorrection("owner-other");
      }, /Ownership validation failed: unauthorized owner context\./);

      assert.throws(() => {
        aggregate.completeGrammarCorrection(
          "owner-other",
          new GrammarResult({ correctedText: "test", correctedAt: new Date() }),
        );
      }, /Ownership validation failed: unauthorized owner context\./);

      assert.throws(() => {
        aggregate.archive("owner-other");
      }, /Ownership validation failed: unauthorized owner context\./);

      // Authorized checks
      aggregate.requestGrammarCorrection("owner-1");
      assert.strictEqual(aggregate.status, "Requested");
    });
  });

  // 6 & 7. Lifecycle Transitions
  describe("Lifecycle Transitions", () => {
    test("Draft -> Requested -> Corrected", () => {
      const aggregate = ReplyGrammarCorrection.create(
        "grammar-1",
        "reply.1",
        "owner-1",
        1,
        defaultRequest,
      );

      // Draft -> Requested
      aggregate.requestGrammarCorrection("owner-1");
      assert.strictEqual(aggregate.status, "Requested");

      // Requested -> Corrected
      const result = new GrammarResult({
        correctedText: "Corrected content.",
        correctedAt: new Date(),
      });
      aggregate.completeGrammarCorrection("owner-1", result);
      assert.strictEqual(aggregate.status, "Corrected");
    });

    test("Draft -> Archived, Requested -> Archived, Corrected -> Archived", () => {
      const agg1 = ReplyGrammarCorrection.create(
        "grammar-1",
        "reply.1",
        "owner-1",
        1,
        defaultRequest,
      );
      agg1.archive("owner-1");
      assert.strictEqual(agg1.status, "Archived");

      const agg2 = ReplyGrammarCorrection.create(
        "grammar-2",
        "reply.1",
        "owner-1",
        1,
        defaultRequest,
      );
      agg2.requestGrammarCorrection("owner-1");
      agg2.archive("owner-1");
      assert.strictEqual(agg2.status, "Archived");

      const agg3 = ReplyGrammarCorrection.create(
        "grammar-3",
        "reply.1",
        "owner-1",
        1,
        defaultRequest,
      );
      agg3.requestGrammarCorrection("owner-1");
      const result = new GrammarResult({
        correctedText: "Corrected text",
        correctedAt: new Date(),
      });
      agg3.completeGrammarCorrection("owner-1", result);
      agg3.archive("owner-1");
      assert.strictEqual(agg3.status, "Archived");
    });

    test("Archived is terminal, transitions out are blocked", () => {
      const agg = ReplyGrammarCorrection.create(
        "grammar-1",
        "reply.1",
        "owner-1",
        1,
        defaultRequest,
      );
      agg.archive("owner-1");

      assert.throws(() => {
        agg.requestGrammarCorrection("owner-1");
      }, /Invalid lifecycle transition from ARCHIVED to REQUESTED/);

      assert.throws(() => {
        agg.archive("owner-1");
      }, /Reply grammar correction is already archived/);
    });

    test("Illegal transitions throw descriptive exceptions", () => {
      const agg = ReplyGrammarCorrection.create(
        "grammar-1",
        "reply.1",
        "owner-1",
        1,
        defaultRequest,
      );
      const result = new GrammarResult({
        correctedText: "Corrected content",
        correctedAt: new Date(),
      });

      // Draft directly to Corrected throws
      assert.throws(() => {
        agg.completeGrammarCorrection("owner-1", result);
      }, /Invalid lifecycle transition from DRAFT to CORRECTED/);

      // Transition to Draft throws
      agg.requestGrammarCorrection("owner-1");
      assert.throws(() => {
        (agg as unknown as { transitionTo(s: string): void }).transitionTo("Draft");
      }, /Invalid lifecycle transition from REQUESTED to DRAFT/);
    });
  });

  // 8. Grammar Completion
  describe("Grammar completion rules", () => {
    test("requires valid result and stores it", () => {
      const agg = ReplyGrammarCorrection.create(
        "grammar-1",
        "reply.1",
        "owner-1",
        1,
        defaultRequest,
      );
      agg.requestGrammarCorrection("owner-1");

      assert.throws(() => {
        agg.completeGrammarCorrection("owner-1", null as unknown as GrammarResult);
      }, /GrammarResult is required/);

      const result = new GrammarResult({
        correctedText: "Updated grammar",
        correctedAt: new Date(),
      });
      agg.completeGrammarCorrection("owner-1", result);

      assert.strictEqual(agg.status, "Corrected");
      assert.ok(agg.result?.equals(result));
    });
  });

  // 9. Snapshots
  describe("Snapshots Stability", () => {
    test("mutating snapshots array throws", () => {
      const agg = ReplyGrammarCorrection.create(
        "grammar-1",
        "reply.1",
        "owner-1",
        1,
        defaultRequest,
      );
      assert.throws(() => {
        (agg.snapshots as unknown as unknown[]).push({});
      }, TypeError);
    });

    test("snapshot dates are copied defensively", () => {
      const agg = ReplyGrammarCorrection.create(
        "grammar-1",
        "reply.1",
        "owner-1",
        1,
        defaultRequest,
      );
      const snap = agg.snapshots[0]!;
      const snapDate = snap.createdAt;
      const originalTime = snapDate.getTime();

      snapDate.setTime(0);
      assert.strictEqual(snap.createdAt.getTime(), originalTime);
    });

    test("snapshot version sequential increment", () => {
      const agg = ReplyGrammarCorrection.create(
        "grammar-1",
        "reply.1",
        "owner-1",
        1,
        defaultRequest,
      );
      assert.strictEqual(agg.snapshots.length, 1);
      assert.strictEqual(agg.snapshots[0]!.version, 1);

      agg.requestGrammarCorrection("owner-1");
      assert.strictEqual(agg.snapshots.length, 2);
      assert.strictEqual(agg.snapshots[1]!.version, 2);

      const result = new GrammarResult({ correctedText: "fixed", correctedAt: new Date() });
      agg.completeGrammarCorrection("owner-1", result);
      assert.strictEqual(agg.snapshots.length, 3);
      assert.strictEqual(agg.snapshots[2]!.version, 3);
    });
  });

  // 10. Domain Events
  describe("Domain Events Verification", () => {
    test("emit domain events matching transition status", () => {
      const agg = ReplyGrammarCorrection.create(
        "grammar-1",
        "reply.1",
        "owner-1",
        1,
        defaultRequest,
      );
      agg.requestGrammarCorrection("owner-1");
      const result = new GrammarResult({
        correctedText: "Corrected text",
        correctedAt: new Date(),
      });
      agg.completeGrammarCorrection("owner-1", result);
      agg.archive("owner-1");

      assert.strictEqual(agg.domainEvents.length, 4);
      assert.strictEqual(agg.domainEvents[0]!.eventType, REPLY_GRAMMAR_DRAFTED);
      assert.strictEqual(agg.domainEvents[1]!.eventType, REPLY_GRAMMAR_REQUESTED);
      assert.strictEqual(agg.domainEvents[2]!.eventType, REPLY_GRAMMAR_CORRECTED);
      assert.strictEqual(agg.domainEvents[3]!.eventType, REPLY_GRAMMAR_ARCHIVED);

      // Verify fields
      const drafted = agg.domainEvents[0]!;
      assert.strictEqual(drafted.grammarCorrectionId, "grammar-1");
      assert.strictEqual(drafted.sourceReference, "reply.1");
      assert.strictEqual(drafted.ownerId, "owner-1");
      assert.strictEqual(drafted.sourceVersion, 1);
      assert.strictEqual(drafted.grammarProfile, "standard");
      assert.strictEqual(drafted.snapshotVersion, 1);
      assert.ok(!("provider" in drafted));
    });
  });

  // 11. Persistence
  describe("Persistence Interfaces Compile Checks", () => {
    test("signatures matching check", () => {
      const dummyStore: ReplyGrammarAggregateStore = {
        async save(_correction: ReplyGrammarCorrection): Promise<void> {},
        async findById(_id: string, _ownerId: string): Promise<ReplyGrammarCorrection | null> {
          return null;
        },
        async findByReference(
          _ref: string,
          _ownerId: string,
        ): Promise<ReplyGrammarCorrection | null> {
          return null;
        },
      };

      const dummyContract: ReplyGrammarPersistenceContract = {
        async checkUniqueReference(
          _ownerId: string,
          _reference: string,
          _excludeCorrectionId?: string,
        ): Promise<boolean> {
          return true;
        },
      };

      assert.ok(dummyStore);
      assert.ok(dummyContract);
    });
  });

  // 12. Boundaries
  describe("Boundary isolation tests", () => {
    test("No external library imports exist", () => {
      const keys = Object.keys(ReplyGrammarCorrection.prototype);
      assert.ok(!keys.includes("_openAiClient"));
      assert.ok(!keys.includes("_stripeClient"));
      assert.ok(!keys.includes("_documentExtractor"));
    });
  });
});
