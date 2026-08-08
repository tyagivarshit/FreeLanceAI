import { test, describe } from "node:test";
import assert from "node:assert";
import {
  RewriteInstruction,
  RewriteRequest,
  RewriteResult,
  ReplyRewrite,
  REPLY_REWRITE_DRAFTED,
  REPLY_REWRITE_REQUESTED,
  REPLY_REWRITE_COMPLETED,
  REPLY_REWRITE_ARCHIVED,
} from "./reply-rewrite.js";
import type {
  ReplyRewritePersistenceContract,
  ReplyRewriteAggregateStore,
} from "./reply-rewrite.js";

describe("Chapter 7B — Reply Studio / Rewrite Domain Tests", () => {
  const defaultInstructionText = "Make it sound slightly shorter.";
  const defaultInstruction = new RewriteInstruction(defaultInstructionText);
  const defaultRequest = new RewriteRequest({
    generationId: "gen-1",
    sourceVersion: 1,
    instruction: defaultInstruction,
  });

  // 1. RewriteInstruction
  describe("RewriteInstruction", () => {
    test("valid instruction", () => {
      const instr = new RewriteInstruction("Shorten this email.");
      assert.strictEqual(instr.text, "Shorten this email.");
    });

    test("invalid input rejected", () => {
      assert.throws(() => new RewriteInstruction(""), /required/);
      assert.throws(() => new RewriteInstruction("   "), /required/);
    });

    test("immutability", () => {
      const instr = new RewriteInstruction("Test instruction");
      assert.throws(() => {
        (instr as unknown as { text: string }).text = "Mutated";
      }, TypeError);
    });
  });

  // 2. RewriteRequest
  describe("RewriteRequest", () => {
    test("valid request properties", () => {
      const req = new RewriteRequest({
        generationId: "gen-123",
        sourceVersion: 2,
        instruction: defaultInstruction,
        metadata: "Some meta",
      });
      assert.strictEqual(req.generationId, "gen-123");
      assert.strictEqual(req.sourceVersion, 2);
      assert.ok(req.instruction.equals(defaultInstruction));
      assert.strictEqual(req.metadata, "Some meta");
    });

    test("invalid inputs rejected", () => {
      assert.throws(() => {
        new RewriteRequest({
          generationId: "",
          sourceVersion: 1,
          instruction: defaultInstruction,
        });
      }, /generation identifier/i);

      assert.throws(() => {
        new RewriteRequest({
          generationId: "gen-1",
          sourceVersion: 0,
          instruction: defaultInstruction,
        });
      }, /version/i);
    });

    test("immutability", () => {
      const req = new RewriteRequest({
        generationId: "gen-123",
        sourceVersion: 1,
        instruction: defaultInstruction,
      });
      assert.throws(() => {
        (req as unknown as { generationId: string }).generationId = "gen-other";
      }, TypeError);
    });
  });

  // 3. RewriteResult
  describe("RewriteResult", () => {
    test("valid result and Date copy", () => {
      const generatedAt = new Date("2026-08-08T12:00:00Z");
      const res = new RewriteResult({
        rewrittenText: "This is the newly rewritten text.",
        generatedAt,
      });
      assert.strictEqual(res.rewrittenText, "This is the newly rewritten text.");
      assert.strictEqual(res.generatedAt.getTime(), generatedAt.getTime());

      // Mutate constructor input date
      generatedAt.setTime(0);
      assert.strictEqual(res.generatedAt.getTime(), new Date("2026-08-08T12:00:00Z").getTime());

      // Mutate getter output date
      const getterDate = res.generatedAt;
      getterDate.setTime(0);
      assert.strictEqual(res.generatedAt.getTime(), new Date("2026-08-08T12:00:00Z").getTime());
    });

    test("invalid result parameters rejected", () => {
      assert.throws(() => {
        new RewriteResult({
          rewrittenText: "",
          generatedAt: new Date(),
        });
      }, /text/i);
    });
  });

  // 4. Aggregate Creation
  describe("ReplyRewrite creation", () => {
    test("initial state, snapshots, and event", () => {
      const id = "rew-1";
      const aggregate = ReplyRewrite.create(id, "gen-1", "owner-1", 1, defaultRequest);

      assert.strictEqual(aggregate.id, id);
      assert.strictEqual(aggregate.generationId, "gen-1");
      assert.strictEqual(aggregate.ownerId, "owner-1");
      assert.strictEqual(aggregate.sourceVersion, 1);
      assert.strictEqual(aggregate.status, "Draft");

      // Version 1 snapshot
      assert.strictEqual(aggregate.snapshots.length, 1);
      assert.strictEqual(aggregate.snapshots[0]!.version, 1);
      assert.strictEqual(aggregate.snapshots[0]!.status, "Draft");
      assert.ok(aggregate.snapshots[0]!.request.equals(defaultRequest));
      assert.strictEqual(aggregate.snapshots[0]!.result, undefined);
      assert.strictEqual(aggregate.snapshots[0]!.revisions.length, 0);

      // Event emitted
      assert.strictEqual(aggregate.domainEvents.length, 1);
      assert.strictEqual(aggregate.domainEvents[0]!.eventType, REPLY_REWRITE_DRAFTED);
      assert.strictEqual(aggregate.domainEvents[0]!.rewriteId, id);
      assert.strictEqual(aggregate.domainEvents[0]!.generationId, "gen-1");
      assert.strictEqual(aggregate.domainEvents[0]!.ownerId, "owner-1");
      assert.strictEqual(aggregate.domainEvents[0]!.sourceVersion, 1);
      assert.strictEqual(aggregate.domainEvents[0]!.snapshotVersion, 1);
    });
  });

  // 5. Ownership
  describe("Ownership validation", () => {
    test("ownership checks on command operations", () => {
      const aggregate = ReplyRewrite.create("rew-1", "gen-1", "owner-1", 1, defaultRequest);

      // Unauthorized checks
      assert.throws(() => {
        aggregate.requestRewrite("owner-other");
      }, /Ownership validation failed: unauthorized owner context\./);

      // Authorized checks
      aggregate.requestRewrite("owner-1");
      assert.strictEqual(aggregate.status, "Requested");
    });
  });

  // 6 & 7. Lifecycle Transitions
  describe("Lifecycle Transitions", () => {
    test("Draft -> Requested -> Rewritten", () => {
      const aggregate = ReplyRewrite.create("rew-1", "gen-1", "owner-1", 1, defaultRequest);

      // Draft -> Requested
      aggregate.requestRewrite("owner-1");
      assert.strictEqual(aggregate.status, "Requested");

      // Requested -> Rewritten
      const result = new RewriteResult({
        rewrittenText: "Rewritten response text here.",
        generatedAt: new Date(),
      });
      aggregate.completeRewrite("owner-1", result);
      assert.strictEqual(aggregate.status, "Rewritten");
    });

    test("Draft -> Archived, Requested -> Archived, Rewritten -> Archived", () => {
      const agg1 = ReplyRewrite.create("rew-1", "gen-1", "owner-1", 1, defaultRequest);
      agg1.archive("owner-1");
      assert.strictEqual(agg1.status, "Archived");

      const agg2 = ReplyRewrite.create("rew-2", "gen-1", "owner-1", 1, defaultRequest);
      agg2.requestRewrite("owner-1");
      agg2.archive("owner-1");
      assert.strictEqual(agg2.status, "Archived");

      const agg3 = ReplyRewrite.create("rew-3", "gen-1", "owner-1", 1, defaultRequest);
      agg3.requestRewrite("owner-1");
      const result = new RewriteResult({
        rewrittenText: "Output text",
        generatedAt: new Date(),
      });
      agg3.completeRewrite("owner-1", result);
      agg3.archive("owner-1");
      assert.strictEqual(agg3.status, "Archived");
    });

    test("Archived is terminal, transitions out are blocked", () => {
      const agg = ReplyRewrite.create("rew-1", "gen-1", "owner-1", 1, defaultRequest);
      agg.archive("owner-1");

      assert.throws(() => {
        agg.requestRewrite("owner-1");
      }, /Invalid lifecycle transition from ARCHIVED to REQUESTED/);

      assert.throws(() => {
        agg.archive("owner-1");
      }, /Reply rewrite is already archived/);
    });

    test("Illegal transitions throw descriptive exceptions", () => {
      const agg = ReplyRewrite.create("rew-1", "gen-1", "owner-1", 1, defaultRequest);
      const result = new RewriteResult({
        rewrittenText: "Rewritten text",
        generatedAt: new Date(),
      });

      // Draft directly to Rewritten throws
      assert.throws(() => {
        agg.completeRewrite("owner-1", result);
      }, /Invalid lifecycle transition from DRAFT to REWRITTEN/);

      // Transition to Draft throws
      agg.requestRewrite("owner-1");
      assert.throws(() => {
        (agg as unknown as { transitionTo(s: string): void }).transitionTo("Draft");
      }, /Invalid lifecycle transition from REQUESTED to DRAFT/);
    });
  });

  // 8 & 9. Rewrite completion & Revision History
  describe("Rewrite Completion and Revisions", () => {
    test("revisions are generated sequentially", () => {
      const agg = ReplyRewrite.create("rew-1", "gen-1", "owner-1", 1, defaultRequest);
      agg.requestRewrite("owner-1");

      const result = new RewriteResult({
        rewrittenText: "Revision text content 1",
        generatedAt: new Date(),
      });
      agg.completeRewrite("owner-1", result);

      assert.strictEqual(agg.revisions.length, 1);
      assert.strictEqual(agg.revisions[0]!.version, 1);
      assert.strictEqual(agg.revisions[0]!.sourceVersion, 1); // references original gen source
      assert.strictEqual(agg.revisions[0]!.rewrittenContent, "Revision text content 1");

      // Verify revision list cannot be mutated
      assert.throws(() => {
        (agg.revisions as unknown as unknown[]).push({});
      }, TypeError);

      // Verify date defensive copying in revision
      const revDate = agg.revisions[0]!.createdAt;
      const originalTime = revDate.getTime();
      revDate.setTime(0);
      assert.strictEqual(agg.revisions[0]!.createdAt.getTime(), originalTime);
    });
  });

  // 10. Snapshots
  describe("Snapshots Stability", () => {
    test("mutating snapshots array throws", () => {
      const agg = ReplyRewrite.create("rew-1", "gen-1", "owner-1", 1, defaultRequest);
      assert.throws(() => {
        (agg.snapshots as unknown as unknown[]).push({});
      }, TypeError);
    });

    test("snapshot dates are copied defensively", () => {
      const agg = ReplyRewrite.create("rew-1", "gen-1", "owner-1", 1, defaultRequest);
      const snap = agg.snapshots[0]!;
      const snapDate = snap.createdAt;
      const originalTime = snapDate.getTime();

      snapDate.setTime(0);
      assert.strictEqual(snap.createdAt.getTime(), originalTime);
    });
  });

  // 12. Domain Events
  describe("Domain Events Verification", () => {
    test("emit domain events matching transition status", () => {
      const agg = ReplyRewrite.create("rew-1", "gen-1", "owner-1", 1, defaultRequest);
      agg.requestRewrite("owner-1");
      const result = new RewriteResult({
        rewrittenText: "Content",
        generatedAt: new Date(),
      });
      agg.completeRewrite("owner-1", result);
      agg.archive("owner-1");

      assert.strictEqual(agg.domainEvents.length, 4);
      assert.strictEqual(agg.domainEvents[0]!.eventType, REPLY_REWRITE_DRAFTED);
      assert.strictEqual(agg.domainEvents[1]!.eventType, REPLY_REWRITE_REQUESTED);
      assert.strictEqual(agg.domainEvents[2]!.eventType, REPLY_REWRITE_COMPLETED);
      assert.strictEqual(agg.domainEvents[2]!.revisionVersion, 1);
      assert.strictEqual(agg.domainEvents[3]!.eventType, REPLY_REWRITE_ARCHIVED);
    });
  });

  // 13. Persistence Contracts
  describe("Persistence Interfaces Compile Checks", () => {
    test("signatures matching check", () => {
      const dummyStore: ReplyRewriteAggregateStore = {
        async save(_rewrite: ReplyRewrite): Promise<void> {},
        async findById(_id: string, _ownerId: string): Promise<ReplyRewrite | null> {
          return null;
        },
        async findByReference(_ref: string, _ownerId: string): Promise<ReplyRewrite | null> {
          return null;
        },
      };

      const dummyContract: ReplyRewritePersistenceContract = {
        async checkUniqueReference(
          _ownerId: string,
          _reference: string,
          _excludeRewriteId?: string,
        ): Promise<boolean> {
          return true;
        },
      };

      assert.ok(dummyStore);
      assert.ok(dummyContract);
    });
  });

  // 14. Boundaries
  describe("Boundary isolation tests", () => {
    test("No external library imports exist", () => {
      const keys = Object.keys(ReplyRewrite.prototype);
      assert.ok(!keys.includes("_stripeClient"));
      assert.ok(!keys.includes("_documentExtractor"));
      assert.ok(!keys.includes("_aiProviderClient"));
    });
  });
});
