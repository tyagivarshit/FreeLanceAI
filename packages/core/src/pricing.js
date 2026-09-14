// 1. Pricing Amount
export class PricingAmount {
    _value;
    constructor(value) {
        if (typeof value !== "number" || !Number.isFinite(value) || Number.isNaN(value)) {
            throw new Error("Pricing amount must be a finite number.");
        }
        if (value < 0.0) {
            throw new Error("Pricing amount must be non-negative.");
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
// 2. Pricing Currency
export class PricingCurrency {
    _value;
    constructor(value) {
        if (!value || value.trim() === "") {
            throw new Error("Currency is required.");
        }
        this._value = value.trim().toUpperCase();
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
export class PricingComponent {
    _componentId;
    _name;
    _amount;
    _currency;
    constructor(properties) {
        if (!properties.componentId || properties.componentId.trim() === "") {
            throw new Error("Component identifier is required.");
        }
        if (!properties.name || properties.name.trim() === "") {
            throw new Error("Component name is required.");
        }
        if (!properties.amount) {
            throw new Error("Component amount is required.");
        }
        if (!properties.currency) {
            throw new Error("Component currency is required.");
        }
        this._componentId = properties.componentId.trim();
        this._name = properties.name.trim();
        this._amount = properties.amount;
        this._currency = properties.currency;
        Object.freeze(this);
    }
    get componentId() {
        return this._componentId;
    }
    get name() {
        return this._name;
    }
    get amount() {
        return this._amount;
    }
    get currency() {
        return this._currency;
    }
}
export class PricingBreakdown {
    _baseAmount;
    _adjustments;
    _finalAmount;
    constructor(properties) {
        if (!properties.baseAmount) {
            throw new Error("Base amount is required.");
        }
        if (!properties.adjustments) {
            throw new Error("Adjustments collection is required.");
        }
        if (!properties.finalAmount) {
            throw new Error("Final amount is required.");
        }
        this._baseAmount = properties.baseAmount;
        this._adjustments = [...properties.adjustments];
        this._finalAmount = properties.finalAmount;
        Object.freeze(this._adjustments);
        Object.freeze(this);
    }
    get baseAmount() {
        return this._baseAmount;
    }
    get adjustments() {
        return Object.freeze([...this._adjustments]);
    }
    get finalAmount() {
        return this._finalAmount;
    }
}
export class PricingAssessment {
    _assessmentId;
    _extractionId;
    _evaluationId;
    _breakdown;
    _currency;
    _assessedAt;
    constructor(properties) {
        if (!properties.assessmentId || properties.assessmentId.trim() === "") {
            throw new Error("Assessment identifier is required.");
        }
        if (!properties.extractionId || properties.extractionId.trim() === "") {
            throw new Error("Extraction identifier is required.");
        }
        if (!properties.evaluationId || properties.evaluationId.trim() === "") {
            throw new Error("Evaluation identifier is required.");
        }
        if (!properties.breakdown) {
            throw new Error("Pricing breakdown is required.");
        }
        if (!properties.currency) {
            throw new Error("Pricing currency is required.");
        }
        if (!properties.assessedAt) {
            throw new Error("Assessed timestamp is required.");
        }
        this._assessmentId = properties.assessmentId.trim();
        this._extractionId = properties.extractionId.trim();
        this._evaluationId = properties.evaluationId.trim();
        this._breakdown = properties.breakdown;
        this._currency = properties.currency;
        this._assessedAt = new Date(properties.assessedAt.getTime());
        Object.freeze(this);
    }
    get assessmentId() {
        return this._assessmentId;
    }
    get extractionId() {
        return this._extractionId;
    }
    get evaluationId() {
        return this._evaluationId;
    }
    get breakdown() {
        return this._breakdown;
    }
    get currency() {
        return this._currency;
    }
    get assessedAt() {
        return new Date(this._assessedAt.getTime());
    }
}
