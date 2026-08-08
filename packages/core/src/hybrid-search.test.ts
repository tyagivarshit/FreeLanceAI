import { test, describe } from "node:test";
import assert from "node:assert";
import { EmbeddingReference, EmbeddingSourceReference } from "./embedding.js";
import {
  SearchScope,
  SearchFilter,
  SearchLimit,
  SearchCandidate,
  SimilarityScore,
} from "./vector-search.js";
import {
  FusionStrategy,
  FusionWeight,
  FusionScore,
  LexicalCandidate,
  HybridSearchCandidate,
  HybridSearchResult,
  HybridSearchRequest,
} from "./hybrid-search.js";
import type {
  HybridSearchContract,
  LexicalSearchContract,
  HybridSearchProvider,
} from "./hybrid-search.js";

describe("Hybrid Search Domain and Boundary Tests", () => {
  const embRef1 = new EmbeddingReference("embedding.ref-001");
  const embRef2 = new EmbeddingReference("embedding.ref-002");
  const embRef3 = new EmbeddingReference("embedding.ref-003");

  const sourceRef1 = new EmbeddingSourceReference("conversation-import-101");
  const sourceRef2 = new EmbeddingSourceReference("conversation-import-102");
  const sourceRef3 = new EmbeddingSourceReference("conversation-import-103");

  const defaultStrategy = new FusionStrategy("WeightedScoreFusion");
  const rrfStrategy = new FusionStrategy("ReciprocalRankFusion");

  const weightVector = new FusionWeight(0.7);
  const weightLexical = new FusionWeight(0.3);
  const defaultLimit = new SearchLimit(5);

  const defaultScope = new SearchScope({ clientReference: "client-abc" });
  const defaultFilter = new SearchFilter(defaultScope);

  // Set up mock retrieval candidate items
  // Candidates in Vector search
  const vecCandidate1 = new SearchCandidate({
    embeddingReference: embRef1,
    sourceReference: sourceRef1,
    similarityScore: new SimilarityScore(0.9),
  });
  const vecCandidate2 = new SearchCandidate({
    embeddingReference: embRef2,
    sourceReference: sourceRef2,
    similarityScore: new SimilarityScore(0.6),
  });

  // Candidates in Lexical search
  const lexCandidate2 = new LexicalCandidate({
    embeddingReference: embRef2,
    sourceReference: sourceRef2,
    lexicalScore: new SimilarityScore(0.8),
  });
  const lexCandidate3 = new LexicalCandidate({
    embeddingReference: embRef3,
    sourceReference: sourceRef3,
    lexicalScore: new SimilarityScore(0.5),
  });

  test("HybridSearchRequest creation and properties mapping", () => {
    const request = new HybridSearchRequest({
      queryReference: "onboarding-sync",
      scope: defaultScope,
      filter: defaultFilter,
      vectorCandidates: [vecCandidate1, vecCandidate2],
      lexicalCandidates: [lexCandidate2, lexCandidate3],
      fusionStrategy: defaultStrategy,
      vectorWeight: weightVector,
      lexicalWeight: weightLexical,
      limit: defaultLimit,
    });

    assert.strictEqual(request.queryReference, "onboarding-sync");
    assert.ok(request.scope);
    assert.ok(request.filter);
    assert.strictEqual(request.vectorCandidates.length, 2);
    assert.strictEqual(request.lexicalCandidates.length, 2);
    assert.ok(request.fusionStrategy.equals(defaultStrategy));
    assert.ok(request.vectorWeight.equals(weightVector));
    assert.ok(request.lexicalWeight.equals(weightLexical));
    assert.strictEqual(request.limit.value, defaultLimit.value);
  });

  test("Fusion strategy value validation and case-insensitivity", () => {
    assert.strictEqual(new FusionStrategy("rrf").value, "ReciprocalRankFusion");
    assert.strictEqual(new FusionStrategy("Weighted-Score-Fusion").value, "WeightedScoreFusion");

    assert.throws(() => {
      new FusionStrategy("InvalidStrategy");
    }, /Unsupported fusion strategy/);

    const strat = new FusionStrategy("rrf");
    assert.throws(() => {
      (strat as unknown as Record<string, unknown>).value = "WeightedScoreFusion";
    }, TypeError);
  });

  test("Fusion weight validation", () => {
    assert.throws(() => {
      new FusionWeight(-0.5);
    }, /Fusion weight must be non-negative/);

    assert.throws(() => {
      new FusionWeight(NaN);
    }, /Fusion weight must be a finite number/);
  });

  test("Fusion score validation", () => {
    assert.throws(() => {
      new FusionScore(Infinity);
    }, /Fusion score must be a finite number/);

    const score = new FusionScore(1.85);
    assert.throws(() => {
      (score as unknown as Record<string, unknown>).value = 2.0;
    }, TypeError);
  });

  test("Weighted score fusion behavior: vector-only, lexical-only, and merged candidates", () => {
    const result = HybridSearchResult.fuse(
      [vecCandidate1, vecCandidate2],
      [lexCandidate2, lexCandidate3],
      defaultStrategy,
      weightVector,
      weightLexical,
      defaultLimit,
    );

    // Should produce 3 fused candidates (embRef1, embRef2, embRef3)
    assert.strictEqual(result.candidates.length, 3);

    // Candidates must be ordered descending by fusion score
    // embRef2: both vector (0.6) and lexical (0.8) -> 0.7 * 0.6 + 0.3 * 0.8 = 0.42 + 0.24 = 0.66
    // embRef1: vector-only (0.9) -> 0.7 * 0.9 + 0.3 * 0 = 0.63
    // embRef3: lexical-only (0.5) -> 0.7 * 0 + 0.3 * 0.5 = 0.15

    const cand0 = result.candidates[0]!; // Should be embRef2 (0.66)
    const cand1 = result.candidates[1]!; // Should be embRef1 (0.63)
    const cand2 = result.candidates[2]!; // Should be embRef3 (0.15)

    assert.ok(cand0.embeddingReference.equals(embRef2));
    assert.strictEqual(cand0.vectorScore?.value, 0.6);
    assert.strictEqual(cand0.lexicalScore?.value, 0.8);
    assert.ok(Math.abs(cand0.fusionScore.value - 0.66) < 1e-9);

    assert.ok(cand1.embeddingReference.equals(embRef1));
    assert.strictEqual(cand1.vectorScore?.value, 0.9);
    assert.strictEqual(cand1.lexicalScore, undefined);
    assert.ok(Math.abs(cand1.fusionScore.value - 0.63) < 1e-9);

    assert.ok(cand2.embeddingReference.equals(embRef3));
    assert.strictEqual(cand2.vectorScore, undefined);
    assert.strictEqual(cand2.lexicalScore?.value, 0.5);
    assert.ok(Math.abs(cand2.fusionScore.value - 0.15) < 1e-9);
  });

  test("RRF score fusion behavior with rank-based calculation", () => {
    // Sorting order check:
    // Vector candidates:
    // rank 1: vecCandidate1 (score 0.9, ref-001)
    // rank 2: vecCandidate2 (score 0.6, ref-002)
    // Lexical candidates:
    // rank 1: lexCandidate2 (score 0.8, ref-002)
    // rank 2: lexCandidate3 (score 0.5, ref-003)

    const result = HybridSearchResult.fuse(
      [vecCandidate1, vecCandidate2],
      [lexCandidate2, lexCandidate3],
      rrfStrategy,
      weightVector,
      weightLexical,
      defaultLimit,
    );

    // Candidates in RRF:
    // ref-002: vector rank 2, lexical rank 1 -> 1 / (60 + 2) + 1 / (60 + 1) = 1/62 + 1/61 = 0.016129 + 0.016393 = 0.032522
    // ref-001: vector rank 1, lexical missing -> 1 / (60 + 1) = 1/61 = 0.016393
    // ref-003: vector missing, lexical rank 2 -> 1 / (60 + 2) = 1/62 = 0.016129

    const cand0 = result.candidates[0]!; // Should be ref-002 (0.032522)
    const cand1 = result.candidates[1]!; // Should be ref-001 (0.016393)
    const cand2 = result.candidates[2]!; // Should be ref-003 (0.016129)

    assert.ok(cand0.embeddingReference.equals(embRef2));
    assert.ok(cand0.fusionScore.value > 0.0325 && cand0.fusionScore.value < 0.0326);

    assert.ok(cand1.embeddingReference.equals(embRef1));
    assert.ok(cand1.fusionScore.value > 0.0163 && cand1.fusionScore.value < 0.0164);

    assert.ok(cand2.embeddingReference.equals(embRef3));
    assert.ok(cand2.fusionScore.value > 0.0161 && cand2.fusionScore.value < 0.0162);
  });

  test("Limit truncation in candidate list", () => {
    const strictLimit = new SearchLimit(2);
    const result = HybridSearchResult.fuse(
      [vecCandidate1, vecCandidate2],
      [lexCandidate2, lexCandidate3],
      defaultStrategy,
      weightVector,
      weightLexical,
      strictLimit,
    );

    assert.strictEqual(result.candidates.length, 2);
  });

  test("Hybrid result candidate list immutability", () => {
    const result = new HybridSearchResult([]);
    assert.throws(() => {
      (result.candidates as unknown as unknown[]).push({});
    }, TypeError);
  });

  test("Mock interfaces contract compliance check", async () => {
    const request = new HybridSearchRequest({
      queryReference: "sync",
      vectorCandidates: [],
      lexicalCandidates: [],
      fusionStrategy: defaultStrategy,
      vectorWeight: weightVector,
      lexicalWeight: weightLexical,
      limit: defaultLimit,
    });

    const mockService: HybridSearchContract = {
      fuseSearch: async (req: HybridSearchRequest) => {
        assert.ok(req);
        return new HybridSearchResult([]);
      },
    };

    const mockLexical: LexicalSearchContract = {
      searchLexical: async (queryText: string, scope?: SearchScope, limit?: SearchLimit) => {
        assert.ok(queryText);
        if (scope) {
          assert.ok(scope);
        }
        if (limit) {
          assert.ok(limit);
        }
        return [];
      },
    };

    const mockProvider: HybridSearchProvider = {
      retrieveMerged: async (req: HybridSearchRequest) => {
        assert.ok(req);
        return new HybridSearchResult([]);
      },
    };

    const res1 = await mockService.fuseSearch(request);
    const res2 = await mockLexical.searchLexical("test");
    const res3 = await mockProvider.retrieveMerged(request);

    assert.strictEqual(res1.candidates.length, 0);
    assert.strictEqual(res2.length, 0);
    assert.strictEqual(res3.candidates.length, 0);
  });

  test("Boundary Verification: Hybrid Search does NOT rank business objectives or interact with databases", () => {
    const request = new HybridSearchRequest({
      queryReference: "sync",
      vectorCandidates: [],
      lexicalCandidates: [],
      fusionStrategy: defaultStrategy,
      vectorWeight: weightVector,
      lexicalWeight: weightLexical,
      limit: defaultLimit,
    });

    const keys = Object.keys(request);
    // 1. Verify absence of DB and AI connections
    assert.ok(!keys.includes("_elasticClient"));
    assert.ok(!keys.includes("_pineconeStore"));

    // 2. Verify no reranking model attributes
    assert.ok(!keys.includes("_rerankWeights"));
    assert.ok(!keys.includes("_clientPriorityScale"));
  });

  test("Hybrid search candidate properties immutability check", () => {
    const cand = new HybridSearchCandidate({
      embeddingReference: embRef1,
      sourceReference: sourceRef1,
      vectorScore: new SimilarityScore(0.9),
      lexicalScore: undefined,
      fusionScore: new FusionScore(0.63),
    });

    assert.ok(cand.embeddingReference.equals(embRef1));
    assert.throws(() => {
      (cand as unknown as Record<string, unknown>).fusionScore = new FusionScore(0.9);
    }, TypeError);
  });
});
