import { EmbeddingReference, EmbeddingSourceReference, EmbeddingVector } from "./embedding.js";

// 1. Query Embedding
export class QueryEmbedding {
  private readonly _reference?: EmbeddingReference;
  private readonly _vector?: EmbeddingVector;

  constructor(source: EmbeddingReference | EmbeddingVector) {
    if (!source) {
      throw new Error("Query embedding source is required.");
    }
    if (source instanceof EmbeddingReference) {
      this._reference = source;
    } else if (source instanceof EmbeddingVector) {
      this._vector = source;
    } else {
      throw new Error("Invalid query embedding source type.");
    }
    Object.freeze(this);
  }

  get reference(): EmbeddingReference | undefined {
    return this._reference;
  }

  get vector(): EmbeddingVector | undefined {
    return this._vector;
  }

  public equals(other: QueryEmbedding): boolean {
    if (!other) {
      return false;
    }
    if (this._reference && other.reference) {
      return this._reference.equals(other.reference);
    }
    if (this._vector && other.vector) {
      return this._vector.equals(other.vector);
    }
    return false;
  }
}

// 2. Search Scope
export interface SearchScopeProperties {
  clientReference?: string;
  ownerReference?: string;
  sourceReference?: string;
  embeddingSpace?: string;
  classification?: string;
}

export class SearchScope {
  private readonly _clientReference?: string;
  private readonly _ownerReference?: string;
  private readonly _sourceReference?: string;
  private readonly _embeddingSpace?: string;
  private readonly _classification?: string;

  constructor(properties: SearchScopeProperties) {
    const pattern = /^[a-z0-9]+([.-][a-z0-9]+)*$/;

    if (properties.clientReference) {
      const clean = properties.clientReference.trim();
      if (!pattern.test(clean)) {
        throw new Error("Invalid client reference format in search scope.");
      }
      this._clientReference = clean;
    }

    if (properties.ownerReference) {
      const clean = properties.ownerReference.trim();
      if (!pattern.test(clean)) {
        throw new Error("Invalid owner reference format in search scope.");
      }
      this._ownerReference = clean;
    }

    if (properties.sourceReference) {
      const clean = properties.sourceReference.trim();
      if (!pattern.test(clean)) {
        throw new Error("Invalid source reference format in search scope.");
      }
      this._sourceReference = clean;
    }

    if (properties.embeddingSpace) {
      const clean = properties.embeddingSpace.trim();
      if (!pattern.test(clean)) {
        throw new Error("Invalid embedding space format in search scope.");
      }
      this._embeddingSpace = clean;
    }

    if (properties.classification) {
      const clean = properties.classification.trim();
      if (!pattern.test(clean)) {
        throw new Error("Invalid classification format in search scope.");
      }
      this._classification = clean;
    }

    Object.freeze(this);
  }

  get clientReference(): string | undefined {
    return this._clientReference;
  }

  get ownerReference(): string | undefined {
    return this._ownerReference;
  }

  get sourceReference(): string | undefined {
    return this._sourceReference;
  }

  get embeddingSpace(): string | undefined {
    return this._embeddingSpace;
  }

  get classification(): string | undefined {
    return this._classification;
  }
}

// 3. Search Filters
export class SearchFilter {
  private readonly _scope: SearchScope;

  constructor(scope: SearchScope) {
    if (!scope) {
      throw new Error("Search scope is required for filtering.");
    }
    this._scope = scope;
    Object.freeze(this);
  }

  get scope(): SearchScope {
    return this._scope;
  }
}

// 4. Similarity Metric
export type SimilarityMetricValue = "Cosine" | "DotProduct" | "Euclidean";

export class SimilarityMetric {
  private readonly _value: SimilarityMetricValue;

  constructor(value: string) {
    if (!value || value.trim() === "") {
      throw new Error("Similarity metric is required.");
    }
    const cleanValue = value.trim().toLowerCase();
    let matched: SimilarityMetricValue;
    if (cleanValue === "cosine") {
      matched = "Cosine";
    } else if (
      cleanValue === "dotproduct" ||
      cleanValue === "dot_product" ||
      cleanValue === "dot-product"
    ) {
      matched = "DotProduct";
    } else if (cleanValue === "euclidean") {
      matched = "Euclidean";
    } else {
      throw new Error(`Unsupported similarity metric: ${value}`);
    }
    this._value = matched;
    Object.freeze(this);
  }

  get value(): SimilarityMetricValue {
    return this._value;
  }

  public equals(other: SimilarityMetric): boolean {
    if (!other) {
      return false;
    }
    return this._value === other.value;
  }
}

// 5. Similarity Score
export class SimilarityScore {
  private readonly _value: number;

  constructor(value: number) {
    if (typeof value !== "number" || !Number.isFinite(value) || Number.isNaN(value)) {
      throw new Error("Similarity score must be a finite number.");
    }
    this._value = value;
    Object.freeze(this);
  }

  get value(): number {
    return this._value;
  }

  public equals(other: SimilarityScore): boolean {
    if (!other) {
      return false;
    }
    return this._value === other.value;
  }
}

// 6. Search Limit
export class SearchLimit {
  private readonly _value: number;

  constructor(value: number) {
    if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
      throw new Error("Search limit must be a positive integer.");
    }
    this._value = value;
    Object.freeze(this);
  }

  get value(): number {
    return this._value;
  }
}

// 7. Search Candidate
export interface SearchCandidateProperties {
  embeddingReference: EmbeddingReference;
  sourceReference: EmbeddingSourceReference;
  similarityScore: SimilarityScore;
}

export class SearchCandidate {
  private readonly _embeddingReference: EmbeddingReference;
  private readonly _sourceReference: EmbeddingSourceReference;
  private readonly _similarityScore: SimilarityScore;

  constructor(properties: SearchCandidateProperties) {
    if (!properties.embeddingReference) {
      throw new Error("Embedding reference is required.");
    }
    if (!properties.sourceReference) {
      throw new Error("Source reference is required.");
    }
    if (!properties.similarityScore) {
      throw new Error("Similarity score is required.");
    }
    this._embeddingReference = properties.embeddingReference;
    this._sourceReference = properties.sourceReference;
    this._similarityScore = properties.similarityScore;
    Object.freeze(this);
  }

  get embeddingReference(): EmbeddingReference {
    return this._embeddingReference;
  }

  get sourceReference(): EmbeddingSourceReference {
    return this._sourceReference;
  }

  get similarityScore(): SimilarityScore {
    return this._similarityScore;
  }
}

// 8. Search Result
export class VectorSearchResult {
  private readonly _candidates: SearchCandidate[];

  constructor(candidates: SearchCandidate[]) {
    if (!candidates) {
      throw new Error("Candidates array is required.");
    }
    this._candidates = [...candidates];
    Object.freeze(this._candidates);
    Object.freeze(this);
  }

  get candidates(): ReadonlyArray<SearchCandidate> {
    return Object.freeze([...this._candidates]);
  }
}

// 9. Vector Search Request
export interface VectorSearchRequestProperties {
  queryEmbedding: QueryEmbedding;
  scope?: SearchScope;
  filter?: SearchFilter;
  similarityMetric: SimilarityMetric;
  limit: SearchLimit;
}

export class VectorSearchRequest {
  private readonly _queryEmbedding: QueryEmbedding;
  private readonly _scope: SearchScope | undefined;
  private readonly _filter: SearchFilter | undefined;
  private readonly _similarityMetric: SimilarityMetric;
  private readonly _limit: SearchLimit;

  constructor(properties: VectorSearchRequestProperties) {
    if (!properties.queryEmbedding) {
      throw new Error("Query embedding is required.");
    }
    if (!properties.similarityMetric) {
      throw new Error("Similarity metric is required.");
    }
    if (!properties.limit) {
      throw new Error("Search limit is required.");
    }

    this._queryEmbedding = properties.queryEmbedding;
    this._scope = properties.scope;
    this._filter = properties.filter;
    this._similarityMetric = properties.similarityMetric;
    this._limit = properties.limit;
    Object.freeze(this);
  }

  get queryEmbedding(): QueryEmbedding {
    return this._queryEmbedding;
  }

  get scope(): SearchScope | undefined {
    return this._scope;
  }

  get filter(): SearchFilter | undefined {
    return this._filter;
  }

  get similarityMetric(): SimilarityMetric {
    return this._similarityMetric;
  }

  get limit(): SearchLimit {
    return this._limit;
  }
}

// 10. Technology-neutral Service / Repository / Provider contracts
export interface VectorSearchContract {
  search(request: VectorSearchRequest): Promise<VectorSearchResult>;
}

export interface VectorSearchProvider {
  searchCandidates(request: VectorSearchRequest): Promise<VectorSearchResult>;
}

export interface VectorSearchRepository {
  querySimilarity(request: VectorSearchRequest): Promise<VectorSearchResult>;
}
