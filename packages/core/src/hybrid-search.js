export class FusionStrategy {
    _value;
    constructor(value) {
        if (!value || value.trim() === "") {
            throw new Error("Fusion strategy is required.");
        }
        const cleanValue = value.trim().toLowerCase();
        let matched;
        if (cleanValue === "weightedscorefusion" ||
            cleanValue === "weighted-score-fusion" ||
            cleanValue === "weighted_score_fusion") {
            matched = "WeightedScoreFusion";
        }
        else if (cleanValue === "reciprocalrankfusion" ||
            cleanValue === "reciprocal-rank-fusion" ||
            cleanValue === "reciprocal_rank_fusion" ||
            cleanValue === "rrf") {
            matched = "ReciprocalRankFusion";
        }
        else {
            throw new Error(`Unsupported fusion strategy: ${value}`);
        }
        this._value = matched;
        Object.freeze(this);
    }
    get value() {
        return this._value;
    }
    equals(other) {
        if (!other) {
            return false;
        }
        return this._value === other.value;
    }
}
// 2. Fusion Weight
export class FusionWeight {
    _value;
    constructor(value) {
        if (typeof value !== "number" || !Number.isFinite(value) || Number.isNaN(value)) {
            throw new Error("Fusion weight must be a finite number.");
        }
        if (value < 0) {
            throw new Error("Fusion weight must be non-negative.");
        }
        this._value = value;
        Object.freeze(this);
    }
    get value() {
        return this._value;
    }
    equals(other) {
        if (!other) {
            return false;
        }
        return this._value === other.value;
    }
}
// 3. Fusion Score
export class FusionScore {
    _value;
    constructor(value) {
        if (typeof value !== "number" || !Number.isFinite(value) || Number.isNaN(value)) {
            throw new Error("Fusion score must be a finite number.");
        }
        this._value = value;
        Object.freeze(this);
    }
    get value() {
        return this._value;
    }
    equals(other) {
        if (!other) {
            return false;
        }
        return this._value === other.value;
    }
}
export class LexicalCandidate {
    _embeddingReference;
    _sourceReference;
    _lexicalScore;
    constructor(properties) {
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
    get embeddingReference() {
        return this._embeddingReference;
    }
    get sourceReference() {
        return this._sourceReference;
    }
    get lexicalScore() {
        return this._lexicalScore;
    }
}
export class HybridSearchCandidate {
    _embeddingReference;
    _sourceReference;
    _vectorScore;
    _lexicalScore;
    _fusionScore;
    constructor(properties) {
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
    get embeddingReference() {
        return this._embeddingReference;
    }
    get sourceReference() {
        return this._sourceReference;
    }
    get vectorScore() {
        return this._vectorScore;
    }
    get lexicalScore() {
        return this._lexicalScore;
    }
    get fusionScore() {
        return this._fusionScore;
    }
}
// 6. Hybrid Search Result
export class HybridSearchResult {
    _candidates;
    constructor(candidates) {
        if (!candidates) {
            throw new Error("Candidates array is required.");
        }
        this._candidates = [...candidates];
        Object.freeze(this._candidates);
        Object.freeze(this);
    }
    get candidates() {
        return Object.freeze([...this._candidates]);
    }
    /**
     * Static Factory fusing candidate signals using the strategy.
     *
     * RRF parameters: constant k = 60
     */
    static fuse(vectorCandidates, lexicalCandidates, strategy, vectorWeight, lexicalWeight, limit) {
        const fusedMap = new Map();
        // Sort vector candidates descending by score to assign ranks
        const sortedVector = [...vectorCandidates].sort((a, b) => b.similarityScore.value - a.similarityScore.value);
        // Sort lexical candidates descending by score to assign ranks
        const sortedLexical = [...lexicalCandidates].sort((a, b) => b.lexicalScore.value - a.lexicalScore.value);
        // Track Ranks
        const vectorRankMap = new Map();
        sortedVector.forEach((candidate, index) => {
            const key = candidate.embeddingReference.value;
            vectorRankMap.set(key, index + 1);
            fusedMap.set(key, {
                embeddingReference: candidate.embeddingReference,
                sourceReference: candidate.sourceReference,
                vectorScore: candidate.similarityScore,
            });
        });
        const lexicalRankMap = new Map();
        sortedLexical.forEach((candidate, index) => {
            const key = candidate.embeddingReference.value;
            lexicalRankMap.set(key, index + 1);
            const existing = fusedMap.get(key);
            if (existing) {
                existing.lexicalScore = candidate.lexicalScore;
            }
            else {
                fusedMap.set(key, {
                    embeddingReference: candidate.embeddingReference,
                    sourceReference: candidate.sourceReference,
                    lexicalScore: candidate.lexicalScore,
                });
            }
        });
        const fusedCandidates = [];
        for (const [key, val] of fusedMap.entries()) {
            let finalScore = 0;
            if (strategy.value === "WeightedScoreFusion") {
                const vScore = val.vectorScore ? val.vectorScore.value : 0;
                const lScore = val.lexicalScore ? val.lexicalScore.value : 0;
                finalScore = vectorWeight.value * vScore + lexicalWeight.value * lScore;
            }
            else if (strategy.value === "ReciprocalRankFusion") {
                const vRank = vectorRankMap.get(key);
                const lRank = lexicalRankMap.get(key);
                const k = 60;
                const termVector = vRank !== undefined ? 1 / (k + vRank) : 0;
                const termLexical = lRank !== undefined ? 1 / (k + lRank) : 0;
                finalScore = termVector + termLexical;
            }
            fusedCandidates.push(new HybridSearchCandidate({
                embeddingReference: val.embeddingReference,
                sourceReference: val.sourceReference,
                vectorScore: val.vectorScore,
                lexicalScore: val.lexicalScore,
                fusionScore: new FusionScore(finalScore),
            }));
        }
        // Sort resulting fused candidates by score descending
        fusedCandidates.sort((a, b) => b.fusionScore.value - a.fusionScore.value);
        // Apply limits
        const limited = fusedCandidates.slice(0, limit.value);
        return new HybridSearchResult(limited);
    }
}
export class HybridSearchRequest {
    _queryReference;
    _scope;
    _filter;
    _vectorCandidates;
    _lexicalCandidates;
    _fusionStrategy;
    _vectorWeight;
    _lexicalWeight;
    _limit;
    constructor(properties) {
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
    get queryReference() {
        return this._queryReference;
    }
    get scope() {
        return this._scope;
    }
    get filter() {
        return this._filter;
    }
    get vectorCandidates() {
        return Object.freeze([...this._vectorCandidates]);
    }
    get lexicalCandidates() {
        return Object.freeze([...this._lexicalCandidates]);
    }
    get fusionStrategy() {
        return this._fusionStrategy;
    }
    get vectorWeight() {
        return this._vectorWeight;
    }
    get lexicalWeight() {
        return this._lexicalWeight;
    }
    get limit() {
        return this._limit;
    }
}
