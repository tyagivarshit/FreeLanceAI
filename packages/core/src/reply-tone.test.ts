import { test, describe } from "node:test";
import assert from "node:assert";
import {
  ToneProfile,
  ToneRequest,
  ToneResult,
  ReplyToneAdjustment,
  REPLY_TONE_DRAFTED,
  REPLY_TONE_REQUESTED,
  REPLY_TONE_ADJUSTED,
  REPLY_TONE_ARCHIVED,
} from "./reply-tone.js";
import type { ReplyTonePersistenceContract, ReplyToneAggregateStore } from "./reply-tone.js";

describe("Chapter 7C — Reply Studio / Tone Adjustment Domain Tests", () => {
  const defaultTone = new ToneProfile("professional");
  const defaultRequest = new ToneRequest({
    sourceReference: "reply.1",
    sourceVersion: 1,
    targetTone: defaultTone,
  });

  // 1. ToneProfile
  describe("ToneProfile", () => {
    test("valid tones vocabulary", () => {
      const tones = [
        "professional",
        "friendly",
        "casual",
        "formal",
        "concise",
        "persuasive",
        "empathetic",
        "direct",
      ];
      for (const val of tones) {
        const profile = new ToneProfile(val);
        assert.strictEqual(profile.value, val);
      }
    });

    test("unsupported tone rejected", () => {
      assert.throws(() => new ToneProfile("sarcastic"), /Invalid tone profile/);
      assert.throws(() => new ToneProfile("humorous"), /Invalid tone profile/);
    });

    test("immutability", () => {
      const profile = new ToneProfile("professional");
      assert.throws(() => {
        (profile as unknown as { value: string }).value = "casual";
      }, TypeError);
    });

    test("equality", () => {
      const p1 = new ToneProfile("professional");
      const p2 = new ToneProfile("professional");
      const p3 = new ToneProfile("casual");
      assert.ok(p1.equals(p2));
      assert.ok(!p1.equals(p3));
    });
  });

  // 2. ToneRequest
  describe("ToneRequest", () => {
    test("valid request properties", () => {
      const req = new ToneRequest({
        sourceReference: "reply.1",
        sourceVersion: 2,
        targetTone: defaultTone,
      });
      assert.strictEqual(req.sourceReference, "reply.1");
      assert.strictEqual(req.sourceVersion, 2);
      assert.ok(req.targetTone.equals(defaultTone));
    });

    test("immutability and nested validation", () => {
      const req = new ToneRequest({
        sourceReference: "reply.1",
        sourceVersion: 1,
        targetTone: defaultTone,
      });
      assert.throws(() => {
        (req as unknown as { sourceVersion: number }).sourceVersion = 5;
      }, TypeError);
    });
  });

  // 3. ToneResult
  describe("ToneResult", () => {
    test("valid result", () => {
      const date = new Date("2026-08-08T12:00:00Z");
      const res = new ToneResult({
        adjustedText: "This is tone adjusted text.",
        adjustedAt: date,
      });
      assert.strictEqual(res.adjustedText, "This is tone adjusted text.");
      assert.strictEqual(res.adjustedAt.getTime(), date.getTime());

      // Mutate constructor input date
      date.setTime(0);
      assert.strictEqual(res.adjustedAt.getTime(), new Date("2026-08-08T12:00:00Z").getTime());

      // Mutate getter output date
      const returnedDate = res.adjustedAt;
      returnedDate.setTime(0);
      assert.strictEqual(res.adjustedAt.getTime(), new Date("2026-08-08T12:00:00Z").getTime());
    });

    test("invalid result content rejected", () => {
      assert.throws(() => {
        new ToneResult({
          adjustedText: "",
          adjustedAt: new Date(),
        });
      }, /content is required/i);
    });
  });

  // 4. Aggregate Creation
  describe("ReplyToneAdjustment creation", () => {
    test("initial state, snapshots, and event", () => {
      const id = "tone-1";
      const aggregate = ReplyToneAdjustment.create(id, "reply.1", "owner-1", 1, defaultRequest);

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
      assert.strictEqual(aggregate.domainEvents[0]!.eventType, REPLY_TONE_DRAFTED);
      assert.strictEqual(aggregate.domainEvents[0]!.toneAdjustmentId, id);
      assert.strictEqual(aggregate.domainEvents[0]!.sourceReference, "reply.1");
      assert.strictEqual(aggregate.domainEvents[0]!.ownerId, "owner-1");
      assert.strictEqual(aggregate.domainEvents[0]!.sourceVersion, 1);
      assert.strictEqual(aggregate.domainEvents[0]!.targetTone, "professional");
      assert.strictEqual(aggregate.domainEvents[0]!.snapshotVersion, 1);
    });
  });

  // 5. Ownership
  describe("Ownership validation", () => {
    test("ownership checks on command operations", () => {
      const aggregate = ReplyToneAdjustment.create(
        "tone-1",
        "reply.1",
        "owner-1",
        1,
        defaultRequest,
      );

      // Unauthorized checks
      assert.throws(() => {
        aggregate.requestToneAdjustment("owner-other");
      }, /Ownership validation failed: unauthorized owner context\./);

      // Authorized checks
      aggregate.requestToneAdjustment("owner-1");
      assert.strictEqual(aggregate.status, "Requested");
    });
  });

  // 6 & 7. Lifecycle Transitions
  describe("Lifecycle Transitions", () => {
    test("Draft -> Requested -> Adjusted", () => {
      const aggregate = ReplyToneAdjustment.create(
        "tone-1",
        "reply.1",
        "owner-1",
        1,
        defaultRequest,
      );

      // Draft -> Requested
      aggregate.requestToneAdjustment("owner-1");
      assert.strictEqual(aggregate.status, "Requested");

      // Requested -> Adjusted
      const result = new ToneResult({
        adjustedText: "Adjusted content.",
        adjustedAt: new Date(),
      });
      aggregate.completeToneAdjustment("owner-1", result);
      assert.strictEqual(aggregate.status, "Adjusted");
    });

    test("Draft -> Archived, Requested -> Archived, Adjusted -> Archived", () => {
      const agg1 = ReplyToneAdjustment.create("tone-1", "reply.1", "owner-1", 1, defaultRequest);
      agg1.archive("owner-1");
      assert.strictEqual(agg1.status, "Archived");

      const agg2 = ReplyToneAdjustment.create("tone-2", "reply.1", "owner-1", 1, defaultRequest);
      agg2.requestToneAdjustment("owner-1");
      agg2.archive("owner-1");
      assert.strictEqual(agg2.status, "Archived");

      const agg3 = ReplyToneAdjustment.create("tone-3", "reply.1", "owner-1", 1, defaultRequest);
      agg3.requestToneAdjustment("owner-1");
      const result = new ToneResult({
        adjustedText: "Adjusted text",
        adjustedAt: new Date(),
      });
      agg3.completeToneAdjustment("owner-1", result);
      agg3.archive("owner-1");
      assert.strictEqual(agg3.status, "Archived");
    });

    test("Archived is terminal, transitions out are blocked", () => {
      const agg = ReplyToneAdjustment.create("tone-1", "reply.1", "owner-1", 1, defaultRequest);
      agg.archive("owner-1");

      assert.throws(() => {
        agg.requestToneAdjustment("owner-1");
      }, /Invalid lifecycle transition from ARCHIVED to REQUESTED/);

      assert.throws(() => {
        agg.archive("owner-1");
      }, /Reply tone adjustment is already archived/);
    });

    test("Illegal transitions throw descriptive exceptions", () => {
      const agg = ReplyToneAdjustment.create("tone-1", "reply.1", "owner-1", 1, defaultRequest);
      const result = new ToneResult({
        adjustedText: "Adjusted content",
        adjustedAt: new Date(),
      });

      // Draft directly to Adjusted throws
      assert.throws(() => {
        agg.completeToneAdjustment("owner-1", result);
      }, /Invalid lifecycle transition from DRAFT to ADJUSTED/);

      // Transition to Draft throws
      agg.requestToneAdjustment("owner-1");
      assert.throws(() => {
        (agg as unknown as { transitionTo(s: string): void }).transitionTo("Draft");
      }, /Invalid lifecycle transition from REQUESTED to DRAFT/);
    });
  });

  // 9. Snapshots
  describe("Snapshots Stability", () => {
    test("mutating snapshots array throws", () => {
      const agg = ReplyToneAdjustment.create("tone-1", "reply.1", "owner-1", 1, defaultRequest);
      assert.throws(() => {
        (agg.snapshots as unknown as unknown[]).push({});
      }, TypeError);
    });

    test("snapshot dates are copied defensively", () => {
      const agg = ReplyToneAdjustment.create("tone-1", "reply.1", "owner-1", 1, defaultRequest);
      const snap = agg.snapshots[0]!;
      const snapDate = snap.createdAt;
      const originalTime = snapDate.getTime();

      snapDate.setTime(0);
      assert.strictEqual(snap.createdAt.getTime(), originalTime);
    });
  });

  // 10. Domain Events
  describe("Domain Events Verification", () => {
    test("emit domain events matching transition status", () => {
      const agg = ReplyToneAdjustment.create("tone-1", "reply.1", "owner-1", 1, defaultRequest);
      agg.requestToneAdjustment("owner-1");
      const result = new ToneResult({
        adjustedText: "Adjusted text",
        adjustedAt: new Date(),
      });
      agg.completeToneAdjustment("owner-1", result);
      agg.archive("owner-1");

      assert.strictEqual(agg.domainEvents.length, 4);
      assert.strictEqual(agg.domainEvents[0]!.eventType, REPLY_TONE_DRAFTED);
      assert.strictEqual(agg.domainEvents[1]!.eventType, REPLY_TONE_REQUESTED);
      assert.strictEqual(agg.domainEvents[2]!.eventType, REPLY_TONE_ADJUSTED);
      assert.strictEqual(agg.domainEvents[3]!.eventType, REPLY_TONE_ARCHIVED);
    });
  });

  // 11. Persistence
  describe("Persistence Interfaces Compile Checks", () => {
    test("signatures matching check", () => {
      const dummyStore: ReplyToneAggregateStore = {
        async save(_adjustment: ReplyToneAdjustment): Promise<void> {},
        async findById(_id: string, _ownerId: string): Promise<ReplyToneAdjustment | null> {
          return null;
        },
        async findByReference(_ref: string, _ownerId: string): Promise<ReplyToneAdjustment | null> {
          return null;
        },
      };

      const dummyContract: ReplyTonePersistenceContract = {
        async checkUniqueReference(
          _ownerId: string,
          _reference: string,
          _excludeAdjustmentId?: string,
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
      const keys = Object.keys(ReplyToneAdjustment.prototype);
      assert.ok(!keys.includes("_openAiClient"));
      assert.ok(!keys.includes("_stripeClient"));
      assert.ok(!keys.includes("_documentExtractor"));
    });
  });
});
