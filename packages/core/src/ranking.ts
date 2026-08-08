import { EmbeddingReference, EmbeddingSourceReference } from "./embedding.js";
import { FusionScore } from "./hybrid-search.js";

// 1. Ranking Criteria
export type RankingCriteriaValue = "FusionScore" | "Recency" | "Priority";

export class RankingCriteria {
  private readonly _value: RankingCriteriaValue;

  constructor(value: string) {
    if (!value || value.trim() === "") {
      throw new Error("Ranking criteria is required.");
    }
    const cleanValue = value.trim().toLowerCase();
    let matched: RankingCriteriaValue;
    if (
      cleanValue === "fusionscore" ||
      cleanValue === "fusion_score" ||
      cleanValue === "fusion-score"
    ) {
      matched = "FusionScore";
    } else if (cleanValue === "recency") {
      matched = "Recency";
    } else if (cleanValue === "priority") {
      matched = "Priority";
    } else {
      throw new Error(`Unsupported ranking criteria: ${value}`);
    }
    this._value = matched;
    Object.freeze(this);
  }

  get value(): RankingCriteriaValue {
    return this._value;
  }

  public equals(other: RankingCriteria): boolean {
    if (!other) {
      return false;
    }
    return this._value === other.value;
  }
}

// 2. Ranking Policy
export class RankingPolicy {
  private readonly _criteriaSequence: RankingCriteria[];

  constructor(criteriaSequence: RankingCriteria[]) {
    if (!criteriaSequence || criteriaSequence.length === 0) {
      throw new Error("Criteria sequence must contain at least one criteria.");
    }
    this._criteriaSequence = [...criteriaSequence];
    Object.freeze(this._criteriaSequence);
    Object.freeze(this);
  }

  get criteriaSequence(): ReadonlyArray<RankingCriteria> {
    return Object.freeze([...this._criteriaSequence]);
  }
}

// 3. Ranking Score
export class RankingScore {
  private readonly _value: number;

  constructor(value: number) {
    if (typeof value !== "number" || !Number.isFinite(value) || Number.isNaN(value)) {
      throw new Error("Ranking score must be a finite number.");
    }
    this._value = value;
    Object.freeze(this);
  }

  get value(): number {
    return this._value;
  }

  public equals(other: RankingScore): boolean {
    if (!other) {
      return false;
    }
    return this._value === other.value;
  }
}

// 4. Ranking Candidate
export interface RankingCandidateProperties {
  embeddingReference: EmbeddingReference;
  sourceReference: EmbeddingSourceReference;
  fusionScore: FusionScore;
  recency?: Date;
  priority?: number;
}

export class RankingCandidate {
  private readonly _embeddingReference: EmbeddingReference;
  private readonly _sourceReference: EmbeddingSourceReference;
  private readonly _fusionScore: FusionScore;
  private readonly _recency: Date | undefined;
  private readonly _priority: number | undefined;

  constructor(properties: RankingCandidateProperties) {
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
    this._fusionScore = properties.fusionScore;
    if (properties.recency) {
      this._recency = new Date(properties.recency.getTime());
    }
    this._priority = properties.priority;
    Object.freeze(this);
  }

  get embeddingReference(): EmbeddingReference {
    return this._embeddingReference;
  }

  get sourceReference(): EmbeddingSourceReference {
    return this._sourceReference;
  }

  get fusionScore(): FusionScore {
    return this._fusionScore;
  }

  get recency(): Date | undefined {
    return this._recency ? new Date(this._recency.getTime()) : undefined;
  }

  get priority(): number | undefined {
    return this._priority;
  }
}

// 5. Ranked Item
export interface RankedItemProperties {
  candidate: RankingCandidate;
  rankingScore: RankingScore;
}

export class RankedItem {
  private readonly _candidate: RankingCandidate;
  private readonly _rankingScore: RankingScore;

  constructor(properties: RankedItemProperties) {
    if (!properties.candidate) {
      throw new Error("Candidate is required.");
    }
    if (!properties.rankingScore) {
      throw new Error("Ranking score is required.");
    }
    this._candidate = properties.candidate;
    this._rankingScore = properties.rankingScore;
    Object.freeze(this);
  }

  get candidate(): RankingCandidate {
    return this._candidate;
  }

  get rankingScore(): RankingScore {
    return this._rankingScore;
  }
}

// 6. Ranking Result
export class RankingResult {
  private readonly _items: RankedItem[];

  constructor(items: RankedItem[]) {
    if (!items) {
      throw new Error("Items array is required.");
    }
    this._items = [...items];
    Object.freeze(this._items);
    Object.freeze(this);
  }

  get items(): ReadonlyArray<RankedItem> {
    return Object.freeze([...this._items]);
  }
}

// 7. Ranking Request
export interface RankingRequestProperties {
  candidates: RankingCandidate[];
  policy: RankingPolicy;
  referenceTime?: Date;
}

export class RankingRequest {
  private readonly _candidates: RankingCandidate[];
  private readonly _policy: RankingPolicy;
  private readonly _referenceTime: Date | undefined;

  constructor(properties: RankingRequestProperties) {
    if (!properties.candidates) {
      throw new Error("Candidates list is required.");
    }
    if (!properties.policy) {
      throw new Error("Ranking policy is required.");
    }
    this._candidates = [...properties.candidates];
    this._policy = properties.policy;
    if (properties.referenceTime) {
      this._referenceTime = new Date(properties.referenceTime.getTime());
    }

    Object.freeze(this._candidates);
    Object.freeze(this);
  }

  get candidates(): ReadonlyArray<RankingCandidate> {
    return Object.freeze([...this._candidates]);
  }

  get policy(): RankingPolicy {
    return this._policy;
  }

  get referenceTime(): Date | undefined {
    return this._referenceTime ? new Date(this._referenceTime.getTime()) : undefined;
  }
}

// 8. Domain Ranking Service
export class RankingService {
  public static rank(request: RankingRequest): RankingResult {
    const policy = request.policy;

    // Map candidates to their original input index to enable stable input-order tie-breaker
    const candidatesWithIndex = request.candidates.map((cand, index) => ({
      cand,
      index,
    }));

    candidatesWithIndex.sort((a, b) => {
      for (const criteria of policy.criteriaSequence) {
        if (criteria.value === "FusionScore") {
          const diff = b.cand.fusionScore.value - a.cand.fusionScore.value;
          if (Math.abs(diff) > 1e-9) {
            return diff;
          }
        } else if (criteria.value === "Recency") {
          const aTime = a.cand.recency ? a.cand.recency.getTime() : 0;
          const bTime = b.cand.recency ? b.cand.recency.getTime() : 0;
          const diff = bTime - aTime;
          if (diff !== 0) {
            return diff;
          }
        } else if (criteria.value === "Priority") {
          const aPri = a.cand.priority ?? 0;
          const bPri = b.cand.priority ?? 0;
          const diff = bPri - aPri;
          if (diff !== 0) {
            return diff;
          }
        }
      }

      // Tie-breaking fallback: preserve original input index order (stable sorting)
      return a.index - b.index;
    });

    const rankedItems = candidatesWithIndex.map((item, index) => {
      const scoreValue = candidatesWithIndex.length - index;
      return new RankedItem({
        candidate: item.cand,
        rankingScore: new RankingScore(scoreValue),
      });
    });

    return new RankingResult(rankedItems);
  }
}
