// 2. Confidence Score
export class ConfidenceScore {
    _value;
    constructor(value) {
        if (typeof value !== "number" || !Number.isFinite(value) || Number.isNaN(value)) {
            throw new Error("Confidence score must be a finite number.");
        }
        if (value < 0.0 || value > 1.0) {
            throw new Error("Confidence score must be between 0.0 and 1.0 inclusive.");
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
export class ConfidenceLevel {
    _value;
    constructor(value) {
        if (!value || value.trim() === "") {
            throw new Error("Confidence level is required.");
        }
        const cleanValue = value.trim().toUpperCase();
        if (cleanValue !== "HIGH" && cleanValue !== "MEDIUM" && cleanValue !== "LOW") {
            throw new Error(`Unsupported confidence level: ${value}`);
        }
        this._value = cleanValue;
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
export class ConfidenceReason {
    _value;
    constructor(value) {
        if (!value || value.trim() === "") {
            throw new Error("Confidence reason is required.");
        }
        const cleanValue = value.trim().toUpperCase().replace(/-/g, "_");
        const validReasons = [
            "STRONG_EVIDENCE",
            "MULTIPLE_SUPPORTING_FACTS",
            "DIRECT_SOURCE",
            "MISSING_INFORMATION",
            "CONFLICTING_FACTS",
            "WEAK_EVIDENCE",
            "AMBIGUOUS_SCOPE",
            "RULE_REVIEW_REQUIRED",
        ];
        if (!validReasons.includes(cleanValue)) {
            throw new Error(`Unsupported confidence reason: ${value}`);
        }
        this._value = cleanValue;
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
export class ConfidenceEvidence {
    _sourceId;
    _factId;
    _evaluationId;
    constructor(properties) {
        if (!properties.sourceId || properties.sourceId.trim() === "") {
            throw new Error("Source identifier is required.");
        }
        this._sourceId = properties.sourceId.trim();
        this._factId = properties.factId;
        this._evaluationId = properties.evaluationId;
        Object.freeze(this);
    }
    get sourceId() {
        return this._sourceId;
    }
    get factId() {
        return this._factId;
    }
    get evaluationId() {
        return this._evaluationId;
    }
}
export class ConfidenceAssessment {
    _assessmentId;
    _evaluationId;
    _extractionId;
    _score;
    _level;
    _reasons;
    _evidenceList;
    _assessedAt;
    constructor(properties) {
        if (!properties.assessmentId || properties.assessmentId.trim() === "") {
            throw new Error("Assessment identifier is required.");
        }
        if (!properties.evaluationId || properties.evaluationId.trim() === "") {
            throw new Error("Evaluation identifier is required.");
        }
        if (!properties.extractionId || properties.extractionId.trim() === "") {
            throw new Error("Extraction identifier is required.");
        }
        if (!properties.score) {
            throw new Error("Confidence score is required.");
        }
        if (!properties.level) {
            throw new Error("Confidence level is required.");
        }
        if (!properties.reasons) {
            throw new Error("Reasons collection is required.");
        }
        if (!properties.evidenceList) {
            throw new Error("Evidence collection is required.");
        }
        if (!properties.assessedAt) {
            throw new Error("Assessment timestamp is required.");
        }
        this._assessmentId = properties.assessmentId.trim();
        this._evaluationId = properties.evaluationId.trim();
        this._extractionId = properties.extractionId.trim();
        this._score = properties.score;
        this._level = properties.level;
        this._reasons = [...properties.reasons];
        this._evidenceList = [...properties.evidenceList];
        this._assessedAt = new Date(properties.assessedAt.getTime());
        Object.freeze(this._reasons);
        Object.freeze(this._evidenceList);
        Object.freeze(this);
    }
    get assessmentId() {
        return this._assessmentId;
    }
    get evaluationId() {
        return this._evaluationId;
    }
    get extractionId() {
        return this._extractionId;
    }
    get score() {
        return this._score;
    }
    get level() {
        return this._level;
    }
    get reasons() {
        return Object.freeze([...this._reasons]);
    }
    get evidenceList() {
        return Object.freeze([...this._evidenceList]);
    }
    get assessedAt() {
        return new Date(this._assessedAt.getTime());
    }
}
export class ConfidenceAssessedEvent {
    aggregateId;
    eventName = "CONFIDENCE_ASSESSED";
    timestamp;
    payload;
    constructor(aggregateId, score, level, timestamp) {
        this.aggregateId = aggregateId;
        this.timestamp = new Date(timestamp.getTime());
        this.payload = { score, level };
        Object.freeze(this.payload);
        Object.freeze(this);
    }
}
