export class RankingCriteria {
    _value;
    constructor(value) {
        if (!value || value.trim() === "") {
            throw new Error("Ranking criteria is required.");
        }
        const cleanValue = value.trim().toLowerCase();
        let matched;
        if (cleanValue === "fusionscore" ||
            cleanValue === "fusion_score" ||
            cleanValue === "fusion-score") {
            matched = "FusionScore";
        }
        else if (cleanValue === "recency") {
            matched = "Recency";
        }
        else if (cleanValue === "priority") {
            matched = "Priority";
        }
        else {
            throw new Error(`Unsupported ranking criteria: ${value}`);
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
// 2. Ranking Policy
export class RankingPolicy {
    _criteriaSequence;
    constructor(criteriaSequence) {
        if (!criteriaSequence || criteriaSequence.length === 0) {
            throw new Error("Criteria sequence must contain at least one criteria.");
        }
        this._criteriaSequence = [...criteriaSequence];
        Object.freeze(this._criteriaSequence);
        Object.freeze(this);
    }
    get criteriaSequence() {
        return Object.freeze([...this._criteriaSequence]);
    }
}
// 3. Ranking Score
export class RankingScore {
    _value;
    constructor(value) {
        if (typeof value !== "number" || !Number.isFinite(value) || Number.isNaN(value)) {
            throw new Error("Ranking score must be a finite number.");
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
export class RankingCandidate {
    _embeddingReference;
    _sourceReference;
    _fusionScore;
    _recency;
    _priority;
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
        this._fusionScore = properties.fusionScore;
        if (properties.recency) {
            this._recency = new Date(properties.recency.getTime());
        }
        this._priority = properties.priority;
        Object.freeze(this);
    }
    get embeddingReference() {
        return this._embeddingReference;
    }
    get sourceReference() {
        return this._sourceReference;
    }
    get fusionScore() {
        return this._fusionScore;
    }
    get recency() {
        return this._recency ? new Date(this._recency.getTime()) : undefined;
    }
    get priority() {
        return this._priority;
    }
}
export class RankedItem {
    _candidate;
    _rankingScore;
    constructor(properties) {
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
    get candidate() {
        return this._candidate;
    }
    get rankingScore() {
        return this._rankingScore;
    }
}
// 6. Ranking Result
export class RankingResult {
    _items;
    constructor(items) {
        if (!items) {
            throw new Error("Items array is required.");
        }
        this._items = [...items];
        Object.freeze(this._items);
        Object.freeze(this);
    }
    get items() {
        return Object.freeze([...this._items]);
    }
}
export class RankingRequest {
    _candidates;
    _policy;
    _referenceTime;
    constructor(properties) {
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
    get candidates() {
        return Object.freeze([...this._candidates]);
    }
    get policy() {
        return this._policy;
    }
    get referenceTime() {
        return this._referenceTime ? new Date(this._referenceTime.getTime()) : undefined;
    }
}
// 8. Domain Ranking Service
export class RankingService {
    static rank(request) {
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
                }
                else if (criteria.value === "Recency") {
                    const aTime = a.cand.recency ? a.cand.recency.getTime() : 0;
                    const bTime = b.cand.recency ? b.cand.recency.getTime() : 0;
                    const diff = bTime - aTime;
                    if (diff !== 0) {
                        return diff;
                    }
                }
                else if (criteria.value === "Priority") {
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
