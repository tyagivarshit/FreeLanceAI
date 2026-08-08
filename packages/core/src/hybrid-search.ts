import { EmbeddingReference, EmbeddingSourceReference } from "./embedding.js";
import {
  SearchScope,
  SearchFilter,
  SearchLimit,
  SearchCandidate,
  SimilarityScore,
} from "./vector-search.js";

// 1. Fusion Strategy
export type FusionStrategyValue = "WeightedScoreFusion" | "ReciprocalRankFusion";

export class FusionStrategy {
  private readonly _value: FusionStrategyValue;

  constructor(value: string) {
    if (!value || value.trim() === "") {
      throw new Error("Fusion strategy is required.");
    }
    const cleanValue = value.trim().toLowerCase();
    let matched: FusionStrategyValue;
    if (
      cleanValue === "weightedscorefusion" ||
      cleanValue === "weighted-score-fusion" ||
      cleanValue === "weighted_score_fusion"
    ) {
      matched = "WeightedScoreFusion";
    } else if (
      cleanValue === "reciprocalrankfusion" ||
      cleanValue === "reciprocal-rank-fusion" ||
      cleanValue === "reciprocal_rank_fusion" ||
      cleanValue === "rrf"
    ) {
      matched = "ReciprocalRankFusion";
    } else {
      throw new Error(`Unsupported fusion strategy: ${value}`);
    }
    this._value = matched;
    Object.freeze(this);
  }

  get value(): FusionStrategyValue {
    return this._value;
  }

  public equals(other: FusionStrategy): boolean {
    if (!other) {
      return false;
    }
    return this._value === other.value;
  }
}

// 2. Fusion Weight
export class FusionWeight {
  private readonly _value: number;

  constructor(value: number) {
    if (typeof value !== "number" || !Number.isFinite(value) || Number.isNaN(value)) {
      throw new Error("Fusion weight must be a finite number.");
    }
    if (value < 0) {
      throw new Error("Fusion weight must be non-negative.");
    }
    this._value = value;
    Object.freeze(this);
  }

  get value(): number {
    return this._value;
  }

  public equals(other: FusionWeight): boolean {
    if (!other) {
      return false;
    }
    return this._value === other.value;
  }
}

// 3. Fusion Score
export class FusionScore {
  private readonly _value: number;

  constructor(value: number) {
    if (typeof value !== "number" || !Number.isFinite(value) || Number.isNaN(value)) {
      throw new Error("Fusion score must be a finite number.");
    }
    this._value = value;
    Object.freeze(this);
  }

  get value(): number {
    return this._value;
  }

  public equals(other: FusionScore): boolean {
    if (!other) {
      return false;
    }
    return this._value === other.value;
  }
}

// 4. Lexical Candidate
export interface LexicalCandidateProperties {
  embeddingReference: EmbeddingReference;
  sourceReference: EmbeddingSourceReference;
  lexicalScore: SimilarityScore;
}

export class LexicalCandidate {
  private readonly _embeddingReference: EmbeddingReference;
  private readonly _sourceReference: EmbeddingSourceReference;
  private readonly _lexicalScore: SimilarityScore;

  constructor(properties: LexicalCandidateProperties) {
    if (!properties.embeddingReference) {
      throw new Error("Embedding reference is required.");
    }
    if (!properties.sourceReference) {
      throw new Error("Source reference is required.");
    }
    if (!properties.lexicalScore) {
      throw new Error("Lexical score is required.");
    }
    this._embeddingReference = properties.embeddingReference;
    this._sourceReference = properties.sourceReference;
    this._lexicalScore = properties.lexicalScore;
    Object.freeze(this);
  }

  get embeddingReference(): EmbeddingReference {
    return this._embeddingReference;
  }

  get sourceReference(): EmbeddingSourceReference {
    return this._sourceReference;
  }

  get lexicalScore(): SimilarityScore {
    return this._lexicalScore;
  }
}

// 5. Hybrid Search Candidate (Fused Candidate)
export interface HybridSearchCandidateProperties {
  embeddingReference: EmbeddingReference;
  sourceReference: EmbeddingSourceReference;
  vectorScore: SimilarityScore | undefined;
  lexicalScore: SimilarityScore | undefined;
  fusionScore: FusionScore;
}

export class HybridSearchCandidate {
  private readonly _embeddingReference: EmbeddingReference;
  private readonly _sourceReference: EmbeddingSourceReference;
  private readonly _vectorScore: SimilarityScore | undefined;
  private readonly _lexicalScore: SimilarityScore | undefined;
  private readonly _fusionScore: FusionScore;

  constructor(properties: HybridSearchCandidateProperties) {
    if (!properties.embeddingReference) {
      throw new Error("Embedding reference is required.");
    }
    if (!properties.sourceReference) {
      throw new Error("Source reference is required.");
    }
    if (!properties.fusionScore) {
      throw new Error("Fusion score is required.");
    }
    this._embeddingReference = properties.embeddingReference;
    this._sourceReference = properties.sourceReference;
    this._vectorScore = properties.vectorScore;
    this._lexicalScore = properties.lexicalScore;
    this._fusionScore = properties.fusionScore;
    Object.freeze(this);
  }

  get embeddingReference(): EmbeddingReference {
    return this._embeddingReference;
  }

  get sourceReference(): EmbeddingSourceReference {
    return this._sourceReference;
  }

  get vectorScore(): SimilarityScore | undefined {
    return this._vectorScore;
  }

  get lexicalScore(): SimilarityScore | undefined {
    return this._lexicalScore;
  }

  get fusionScore(): FusionScore {
    return this._fusionScore;
  }
}

// 6. Hybrid Search Result
export class HybridSearchResult {
  private readonly _candidates: HybridSearchCandidate[];

  constructor(candidates: HybridSearchCandidate[]) {
    if (!candidates) {
      throw new Error("Candidates array is required.");
    }
    this._candidates = [...candidates];
    Object.freeze(this._candidates);
    Object.freeze(this);
  }

  get candidates(): ReadonlyArray<HybridSearchCandidate> {
    return Object.freeze([...this._candidates]);
  }

  /**
   * Static Factory fusing candidate signals using the strategy.
   *
   * RRF parameters: constant k = 60
   */
  public static fuse(
    vectorCandidates: SearchCandidate[],
    lexicalCandidates: LexicalCandidate[],
    strategy: FusionStrategy,
    vectorWeight: FusionWeight,
    lexicalWeight: FusionWeight,
    limit: SearchLimit,
  ): HybridSearchResult {
    const fusedMap = new Map<
      string,
      {
        embeddingReference: EmbeddingReference;
        sourceReference: EmbeddingSourceReference;
        vectorScore?: SimilarityScore;
        lexicalScore?: SimilarityScore;
      }
    >();

    // Sort vector candidates descending by score to assign ranks
    const sortedVector = [...vectorCandidates].sort(
      (a, b) => b.similarityScore.value - a.similarityScore.value,
    );

    // Sort lexical candidates descending by score to assign ranks
    const sortedLexical = [...lexicalCandidates].sort(
      (a, b) => b.lexicalScore.value - a.lexicalScore.value,
    );

    // Track Ranks
    const vectorRankMap = new Map<string, number>();
    sortedVector.forEach((candidate, index) => {
      const key = candidate.embeddingReference.value;
      vectorRankMap.set(key, index + 1);

      fusedMap.set(key, {
        embeddingReference: candidate.embeddingReference,
        sourceReference: candidate.sourceReference,
        vectorScore: candidate.similarityScore,
      });
    });

    const lexicalRankMap = new Map<string, number>();
    sortedLexical.forEach((candidate, index) => {
      const key = candidate.embeddingReference.value;
      lexicalRankMap.set(key, index + 1);

      const existing = fusedMap.get(key);
      if (existing) {
        existing.lexicalScore = candidate.lexicalScore;
      } else {
        fusedMap.set(key, {
          embeddingReference: candidate.embeddingReference,
          sourceReference: candidate.sourceReference,
          lexicalScore: candidate.lexicalScore,
        });
      }
    });

    const fusedCandidates: HybridSearchCandidate[] = [];

    for (const [key, val] of fusedMap.entries()) {
      let finalScore = 0;

      if (strategy.value === "WeightedScoreFusion") {
        const vScore = val.vectorScore ? val.vectorScore.value : 0;
        const lScore = val.lexicalScore ? val.lexicalScore.value : 0;
        finalScore = vectorWeight.value * vScore + lexicalWeight.value * lScore;
      } else if (strategy.value === "ReciprocalRankFusion") {
        const vRank = vectorRankMap.get(key);
        const lRank = lexicalRankMap.get(key);
        const k = 60;

        const termVector = vRank !== undefined ? 1 / (k + vRank) : 0;
        const termLexical = lRank !== undefined ? 1 / (k + lRank) : 0;
        finalScore = termVector + termLexical;
      }

      fusedCandidates.push(
        new HybridSearchCandidate({
          embeddingReference: val.embeddingReference,
          sourceReference: val.sourceReference,
          vectorScore: val.vectorScore,
          lexicalScore: val.lexicalScore,
          fusionScore: new FusionScore(finalScore),
        }),
      );
    }

    // Sort resulting fused candidates by score descending
    fusedCandidates.sort((a, b) => b.fusionScore.value - a.fusionScore.value);

    // Apply limits
    const limited = fusedCandidates.slice(0, limit.value);

    return new HybridSearchResult(limited);
  }
}

// 7. Hybrid Search Request
export interface HybridSearchRequestProperties {
  queryReference: string;
  scope?: SearchScope;
  filter?: SearchFilter;
  vectorCandidates: SearchCandidate[];
  lexicalCandidates: LexicalCandidate[];
  fusionStrategy: FusionStrategy;
  vectorWeight: FusionWeight;
  lexicalWeight: FusionWeight;
  limit: SearchLimit;
}

export class HybridSearchRequest {
  private readonly _queryReference: string;
  private readonly _scope: SearchScope | undefined;
  private readonly _filter: SearchFilter | undefined;
  private readonly _vectorCandidates: SearchCandidate[];
  private readonly _lexicalCandidates: LexicalCandidate[];
  private readonly _fusionStrategy: FusionStrategy;
  private readonly _vectorWeight: FusionWeight;
  private readonly _lexicalWeight: FusionWeight;
  private readonly _limit: SearchLimit;

  constructor(properties: HybridSearchRequestProperties) {
    if (!properties.queryReference || properties.queryReference.trim() === "") {
      throw new Error("Query reference is required.");
    }
    if (!properties.vectorCandidates) {
      throw new Error("Vector candidates collection is required.");
    }
    if (!properties.lexicalCandidates) {
      throw new Error("Lexical candidates collection is required.");
    }
    if (!properties.fusionStrategy) {
      throw new Error("Fusion strategy is required.");
    }
    if (!properties.vectorWeight) {
      throw new Error("Vector weight is required.");
    }
    if (!properties.lexicalWeight) {
      throw new Error("Lexical weight is required.");
    }
    if (!properties.limit) {
      throw new Error("Search limit is required.");
    }

    this._queryReference = properties.queryReference.trim();
    this._scope = properties.scope;
    this._filter = properties.filter;
    this._vectorCandidates = [...properties.vectorCandidates];
    this._lexicalCandidates = [...properties.lexicalCandidates];
    this._fusionStrategy = properties.fusionStrategy;
    this._vectorWeight = properties.vectorWeight;
    this._lexicalWeight = properties.lexicalWeight;
    this._limit = properties.limit;

    Object.freeze(this._vectorCandidates);
    Object.freeze(this._lexicalCandidates);
    Object.freeze(this);
  }

  get queryReference(): string {
    return this._queryReference;
  }

  get scope(): SearchScope | undefined {
    return this._scope;
  }

  get filter(): SearchFilter | undefined {
    return this._filter;
  }

  get vectorCandidates(): ReadonlyArray<SearchCandidate> {
    return Object.freeze([...this._vectorCandidates]);
  }

  get lexicalCandidates(): ReadonlyArray<LexicalCandidate> {
    return Object.freeze([...this._lexicalCandidates]);
  }

  get fusionStrategy(): FusionStrategy {
    return this._fusionStrategy;
  }

  get vectorWeight(): FusionWeight {
    return this._vectorWeight;
  }

  get lexicalWeight(): FusionWeight {
    return this._lexicalWeight;
  }

  get limit(): SearchLimit {
    return this._limit;
  }
}

// 8. Service / Query Contracts
export interface HybridSearchContract {
  fuseSearch(request: HybridSearchRequest): Promise<HybridSearchResult>;
}

export interface LexicalSearchContract {
  searchLexical(
    queryText: string,
    scope?: SearchScope,
    limit?: SearchLimit,
  ): Promise<LexicalCandidate[]>;
}

export interface HybridSearchProvider {
  retrieveMerged(request: HybridSearchRequest): Promise<HybridSearchResult>;
}
