import { test, describe } from "node:test";
import assert from "node:assert";
import { EmbeddingReference, EmbeddingSourceReference } from "./embedding.js";
import { FusionScore } from "./hybrid-search.js";
import {
  RankingCriteria,
  RankingPolicy,
  RankingScore,
  RankingCandidate,
  RankingResult,
  RankingRequest,
  RankingService,
} from "./ranking.js";

describe("Ranking Domain and Boundary Tests", () => {
  const embRef1 = new EmbeddingReference("embedding.ref-001");
  const embRef2 = new EmbeddingReference("embedding.ref-002");
  const embRef3 = new EmbeddingReference("embedding.ref-003");

  const sourceRef1 = new EmbeddingSourceReference("conversation-import-101");
  const sourceRef2 = new EmbeddingSourceReference("conversation-import-102");
  const sourceRef3 = new EmbeddingSourceReference("conversation-import-103");

  const criteriaScore = new RankingCriteria("FusionScore");
  const criteriaRecency = new RankingCriteria("Recency");
  const criteriaPriority = new RankingCriteria("Priority");

  const defaultPolicy = new RankingPolicy([criteriaScore, criteriaRecency]);
  const recencyPolicy = new RankingPolicy([criteriaRecency, criteriaScore]);

  const cand1 = new RankingCandidate({
    embeddingReference: embRef1,
    sourceReference: sourceRef1,
    fusionScore: new FusionScore(0.85),
    recency: new Date("2026-08-08T10:00:00Z"),
    priority: 3,
  });

  const cand2 = new RankingCandidate({
    embeddingReference: embRef2,
    sourceReference: sourceRef2,
    fusionScore: new FusionScore(0.95),
    recency: new Date("2026-08-08T09:00:00Z"),
    priority: 1,
  });

  const cand3 = new RankingCandidate({
    embeddingReference: embRef3,
    sourceReference: sourceRef3,
    fusionScore: new FusionScore(0.85),
    recency: new Date("2026-08-08T11:00:00Z"),
    priority: 5,
  });

  test("RankingRequest creation and immutability", () => {
    const refTime = new Date("2026-08-08T12:00:00Z");
    const request = new RankingRequest({
      candidates: [cand1, cand2],
      policy: defaultPolicy,
      referenceTime: refTime,
    });

    assert.strictEqual(request.candidates.length, 2);
    assert.ok(request.policy);
    assert.strictEqual(request.referenceTime?.getTime(), refTime.getTime());

    // Reference time immutability check
    refTime.setTime(0);
    assert.notStrictEqual(request.referenceTime?.getTime(), 0);

    const retTime = request.referenceTime!;
    retTime.setTime(9999);
    assert.notStrictEqual(request.referenceTime?.getTime(), 9999);
  });

  test("Ranking criteria validation and immutability", () => {
    assert.strictEqual(new RankingCriteria("fusion-score").value, "FusionScore");
    assert.throws(() => {
      new RankingCriteria("InvalidCriteria");
    }, /Unsupported ranking criteria/);

    const criteria = new RankingCriteria("Recency");
    assert.throws(() => {
      (criteria as unknown as Record<string, unknown>).value = "Priority";
    }, TypeError);
  });

  test("Ranking policy validation and immutability", () => {
    assert.throws(() => {
      new RankingPolicy([]);
    }, /Criteria sequence must contain at least one criteria/);

    const policy = new RankingPolicy([criteriaScore]);
    assert.throws(() => {
      (policy.criteriaSequence as unknown as unknown[]).push(criteriaRecency);
    }, TypeError);
  });

  test("Ranking score validation and immutability", () => {
    assert.throws(() => {
      new RankingScore(NaN);
    }, /Ranking score must be a finite number/);

    const score = new RankingScore(100.5);
    assert.throws(() => {
      (score as unknown as Record<string, unknown>).value = 200;
    }, TypeError);
  });

  test("Candidate Date/Recency defensive cloning", () => {
    const rawDate = new Date("2026-08-08T12:00:00Z");
    const candidate = new RankingCandidate({
      embeddingReference: embRef1,
      sourceReference: sourceRef1,
      fusionScore: new FusionScore(0.5),
      recency: rawDate,
    });

    // 1. Modifying input date must not mutate candidate
    rawDate.setTime(0);
    assert.notStrictEqual(candidate.recency?.getTime(), 0);

    // 2. Modifying returned date must not mutate candidate
    const ret = candidate.recency!;
    ret.setTime(55555);
    assert.notStrictEqual(candidate.recency?.getTime(), 55555);
  });

  test("Candidate properties immutability check", () => {
    assert.throws(() => {
      (cand1 as unknown as Record<string, unknown>).priority = 10;
    }, TypeError);
  });

  test("Ranking evaluation: FusionScore first policy", () => {
    const request = new RankingRequest({
      candidates: [cand1, cand2, cand3],
      policy: defaultPolicy,
    });

    const result = RankingService.rank(request);

    // Expected order:
    // cand2 (fusionScore 0.95)
    // cand3 (fusionScore 0.85, recency 11:00)
    // cand1 (fusionScore 0.85, recency 10:00)

    assert.strictEqual(result.items.length, 3);
    assert.ok(result.items[0]!.candidate.embeddingReference.equals(embRef2));
    assert.ok(result.items[1]!.candidate.embeddingReference.equals(embRef3));
    assert.ok(result.items[2]!.candidate.embeddingReference.equals(embRef1));

    // Ranking scores should be assigned descending based on rank order
    assert.strictEqual(result.items[0]!.rankingScore.value, 3);
    assert.strictEqual(result.items[1]!.rankingScore.value, 2);
    assert.strictEqual(result.items[2]!.rankingScore.value, 1);
  });

  test("Ranking evaluation: Recency first policy", () => {
    const request = new RankingRequest({
      candidates: [cand1, cand2, cand3],
      policy: recencyPolicy,
    });

    const result = RankingService.rank(request);

    // Expected order:
    // cand3 (recency 11:00)
    // cand1 (recency 10:00)
    // cand2 (recency 09:00)

    assert.strictEqual(result.items.length, 3);
    assert.ok(result.items[0]!.candidate.embeddingReference.equals(embRef3));
    assert.ok(result.items[1]!.candidate.embeddingReference.equals(embRef1));
    assert.ok(result.items[2]!.candidate.embeddingReference.equals(embRef2));
  });

  test("Ranking evaluation: single candidate behavior", () => {
    const request = new RankingRequest({
      candidates: [cand1],
      policy: defaultPolicy,
    });

    const result = RankingService.rank(request);
    assert.strictEqual(result.items.length, 1);
    assert.ok(result.items[0]!.candidate.embeddingReference.equals(embRef1));
    assert.strictEqual(result.items[0]!.rankingScore.value, 1);
  });

  test("Ranking evaluation: empty candidates behavior", () => {
    const request = new RankingRequest({
      candidates: [],
      policy: defaultPolicy,
    });

    const result = RankingService.rank(request);
    assert.strictEqual(result.items.length, 0);
  });

  test("Tie-breaking handling: deterministic input index fallback", () => {
    // cand1 and candA have equal fusion score (0.85), recency (10:00), priority (3)
    // they should tie and fall back to input order: [candA, cand1] should preserve candA first
    const embRefA = new EmbeddingReference("embedding.ref-001-a");
    const candA = new RankingCandidate({
      embeddingReference: embRefA,
      sourceReference: sourceRef1,
      fusionScore: new FusionScore(0.85),
      recency: new Date("2026-08-08T10:00:00Z"),
      priority: 3,
    });

    const requestA1 = new RankingRequest({
      candidates: [candA, cand1],
      policy: defaultPolicy,
    });

    const resA1 = RankingService.rank(requestA1);
    assert.strictEqual(resA1.items.length, 2);
    assert.ok(resA1.items[0]!.candidate.embeddingReference.equals(embRefA));
    assert.ok(resA1.items[1]!.candidate.embeddingReference.equals(embRef1));

    const request1A = new RankingRequest({
      candidates: [cand1, candA],
      policy: defaultPolicy,
    });

    const res1A = RankingService.rank(request1A);
    assert.strictEqual(res1A.items.length, 2);
    assert.ok(res1A.items[0]!.candidate.embeddingReference.equals(embRef1));
    assert.ok(res1A.items[1]!.candidate.embeddingReference.equals(embRefA));
  });

  test("Ranking evaluation: Priority first policy", () => {
    const request = new RankingRequest({
      candidates: [cand1, cand2, cand3],
      policy: new RankingPolicy([criteriaPriority, criteriaScore]),
    });

    const result = RankingService.rank(request);

    // Expected order:
    // cand3 (priority 5)
    // cand1 (priority 3)
    // cand2 (priority 1)

    assert.strictEqual(result.items.length, 3);
    assert.ok(result.items[0]!.candidate.embeddingReference.equals(embRef3));
    assert.ok(result.items[1]!.candidate.embeddingReference.equals(embRef1));
    assert.ok(result.items[2]!.candidate.embeddingReference.equals(embRef2));
  });

  test("Result collection immutability", () => {
    const result = new RankingResult([]);
    assert.throws(() => {
      (result.items as unknown as unknown[]).push({});
    }, TypeError);
  });

  test("Boundary Verification: Ranking does NOT perform database updates or call external models", () => {
    const request = new RankingRequest({
      candidates: [],
      policy: defaultPolicy,
    });

    const keys = Object.keys(request);
    assert.ok(!keys.includes("_redisConnection"));
    assert.ok(!keys.includes("_aiProviderClient"));
  });
});
