import { test, describe } from "node:test";
import assert from "node:assert";
import { EmbeddingReference, EmbeddingSourceReference, EmbeddingVector } from "./embedding.js";
import {
  QueryEmbedding,
  SearchScope,
  SearchFilter,
  SimilarityMetric,
  SimilarityScore,
  SearchLimit,
  SearchCandidate,
  VectorSearchResult,
  VectorSearchRequest,
} from "./vector-search.js";
import type {
  VectorSearchContract,
  VectorSearchProvider,
  VectorSearchRepository,
} from "./vector-search.js";

describe("Vector Search Domain and Boundary Tests", () => {
  const defaultEmbeddingRef = new EmbeddingReference("embedding.ref-001");
  const defaultSourceRef = new EmbeddingSourceReference("conversation-import-123");
  const defaultVector = new EmbeddingVector([0.15, -0.3, 0.45]);

  const defaultQueryEmbedding = new QueryEmbedding(defaultEmbeddingRef);
  const defaultMetric = new SimilarityMetric("Cosine");
  const defaultLimit = new SearchLimit(10);
  const defaultScope = new SearchScope({
    clientReference: "client-123",
    embeddingSpace: "space.test",
  });
  const defaultFilter = new SearchFilter(defaultScope);

  test("Search request creation and parameters mapping", () => {
    const request = new VectorSearchRequest({
      queryEmbedding: defaultQueryEmbedding,
      scope: defaultScope,
      filter: defaultFilter,
      similarityMetric: defaultMetric,
      limit: defaultLimit,
    });

    assert.ok(request.queryEmbedding.equals(defaultQueryEmbedding));
    assert.ok(request.scope);
    assert.strictEqual(request.scope.clientReference, "client-123");
    assert.ok(request.filter);
    assert.ok(request.similarityMetric.equals(defaultMetric));
    assert.strictEqual(request.limit.value, 10);
  });

  test("QueryEmbedding immutability and equality", () => {
    const q1 = new QueryEmbedding(defaultEmbeddingRef);
    const q2 = new QueryEmbedding(defaultVector);

    assert.ok(q1.reference);
    assert.ok(!q1.vector);
    assert.ok(q2.vector);
    assert.ok(!q2.reference);

    assert.throws(() => {
      (q1 as unknown as Record<string, unknown>).reference = defaultVector;
    }, TypeError);
  });

  test("Search scope validations and immutability", () => {
    assert.throws(() => {
      new SearchScope({ clientReference: "Client..123" });
    }, /Invalid client reference format/);

    const scope = new SearchScope({ clientReference: "client-123" });
    assert.throws(() => {
      (scope as unknown as Record<string, unknown>).clientReference = "mutated";
    }, TypeError);
  });

  test("Search filter wrapper immutability", () => {
    const filter = new SearchFilter(defaultScope);
    assert.throws(() => {
      (filter as unknown as Record<string, unknown>).scope = new SearchScope({});
    }, TypeError);
  });

  test("Similarity metric validation and immutability", () => {
    assert.strictEqual(new SimilarityMetric("cosine").value, "Cosine");
    assert.strictEqual(new SimilarityMetric("dot-product").value, "DotProduct");
    assert.strictEqual(new SimilarityMetric("euclidean").value, "Euclidean");

    assert.throws(() => {
      new SimilarityMetric("Manhattan");
    }, /Unsupported similarity metric/);

    const metric = new SimilarityMetric("Cosine");
    assert.throws(() => {
      (metric as unknown as Record<string, unknown>).value = "Euclidean";
    }, TypeError);
  });

  test("Similarity score validation and immutability", () => {
    // Should accept values outside 0..1 (Euclidean distance or raw dot products)
    assert.strictEqual(new SimilarityScore(-2.5).value, -2.5);
    assert.strictEqual(new SimilarityScore(500.8).value, 500.8);

    assert.throws(() => {
      new SimilarityScore(NaN);
    }, /Similarity score must be a finite number/);

    assert.throws(() => {
      new SimilarityScore(Infinity);
    }, /Similarity score must be a finite number/);

    const score = new SimilarityScore(0.95);
    assert.throws(() => {
      (score as unknown as Record<string, unknown>).value = 0.99;
    }, TypeError);
  });

  test("Search limit validation", () => {
    assert.throws(() => {
      new SearchLimit(0);
    }, /Search limit must be a positive integer/);

    assert.throws(() => {
      new SearchLimit(-5);
    }, /Search limit must be a positive integer/);

    assert.throws(() => {
      new SearchLimit(10.5);
    }, /Search limit must be a positive integer/);
  });

  test("Search candidate immutability", () => {
    const score = new SimilarityScore(0.85);
    const candidate = new SearchCandidate({
      embeddingReference: defaultEmbeddingRef,
      sourceReference: defaultSourceRef,
      similarityScore: score,
    });

    assert.ok(candidate.embeddingReference.equals(defaultEmbeddingRef));
    assert.ok(candidate.sourceReference.equals(defaultSourceRef));
    assert.ok(candidate.similarityScore.equals(score));

    assert.throws(() => {
      (candidate as unknown as Record<string, unknown>).embeddingReference = defaultEmbeddingRef;
    }, TypeError);
  });

  test("Search result collection immutability", () => {
    const score = new SimilarityScore(0.85);
    const candidate = new SearchCandidate({
      embeddingReference: defaultEmbeddingRef,
      sourceReference: defaultSourceRef,
      similarityScore: score,
    });

    const result = new VectorSearchResult([candidate]);
    assert.strictEqual(result.candidates.length, 1);

    // Array elements modification block check
    assert.throws(() => {
      (result.candidates as unknown as unknown[]).push({});
    }, TypeError);
  });

  test("Empty result behavior", () => {
    const result = new VectorSearchResult([]);
    assert.strictEqual(result.candidates.length, 0);
  });

  test("Mock contracts compliance verification", async () => {
    const request = new VectorSearchRequest({
      queryEmbedding: defaultQueryEmbedding,
      similarityMetric: defaultMetric,
      limit: defaultLimit,
    });

    const mockService: VectorSearchContract = {
      search: async (req: VectorSearchRequest) => {
        assert.ok(req);
        return new VectorSearchResult([]);
      },
    };

    const mockProvider: VectorSearchProvider = {
      searchCandidates: async (req: VectorSearchRequest) => {
        assert.ok(req);
        return new VectorSearchResult([]);
      },
    };

    const mockRepo: VectorSearchRepository = {
      querySimilarity: async (req: VectorSearchRequest) => {
        assert.ok(req);
        return new VectorSearchResult([]);
      },
    };

    const res1 = await mockService.search(request);
    const res2 = await mockProvider.searchCandidates(request);
    const res3 = await mockRepo.querySimilarity(request);

    assert.strictEqual(res1.candidates.length, 0);
    assert.strictEqual(res2.candidates.length, 0);
    assert.strictEqual(res3.candidates.length, 0);
  });

  // Boundary Validation Assertions
  test("5B Boundary Verification: Vector Search does NOT generate embeddings or depend on DBs", () => {
    const request = new VectorSearchRequest({
      queryEmbedding: defaultQueryEmbedding,
      similarityMetric: defaultMetric,
      limit: defaultLimit,
    });

    // 1. Verify absence of database dependencies or generation modules
    const keys = Object.keys(request);
    assert.ok(!keys.includes("_vectorDbAdapter"));
    assert.ok(!keys.includes("_modelClient"));

    // 2. Verify no hybrid fusion / lexical tokens
    assert.ok(!keys.includes("_lexicalKeywords"));
    assert.ok(!keys.includes("_rrfWeights"));

    // 3. Verify no ranking reordering components
    assert.ok(!keys.includes("_rerankStrategy"));
  });
});
