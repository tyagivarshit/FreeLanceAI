// 1. deepFreeze helper
function deepFreeze(obj) {
    if (obj === null || typeof obj !== "object") {
        return obj;
    }
    Object.freeze(obj);
    Object.keys(obj).forEach((key) => {
        const val = obj[key];
        if (val !== null && typeof val === "object") {
            deepFreeze(val);
        }
    });
    return obj;
}
export class ScopeRuleType {
    _value;
    constructor(value) {
        if (!value || value.trim() === "") {
            throw new Error("Rule type is required.");
        }
        const cleanValue = value.trim().toUpperCase();
        const validTypes = [
            "INCLUSION",
            "EXCLUSION",
            "REQUIREMENT",
            "CONSTRAINT",
            "DEPENDENCY",
            "CONTRADICTION",
            "COMPLETENESS",
            "BOUNDARY",
        ];
        if (!validTypes.includes(cleanValue)) {
            throw new Error(`Unsupported rule type: ${value}`);
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
export class ScopeRule {
    _ruleId;
    _ruleType;
    _description;
    _parameters;
    constructor(properties) {
        if (!properties.ruleId || properties.ruleId.trim() === "") {
            throw new Error("Rule identifier is required.");
        }
        if (!properties.ruleType) {
            throw new Error("Rule type is required.");
        }
        if (!properties.description || properties.description.trim() === "") {
            throw new Error("Rule description is required.");
        }
        if (!properties.parameters) {
            throw new Error("Rule parameters is required.");
        }
        this._ruleId = properties.ruleId.trim();
        this._ruleType = properties.ruleType;
        this._description = properties.description.trim();
        this._parameters = deepFreeze(JSON.parse(JSON.stringify(properties.parameters)));
        Object.freeze(this);
    }
    get ruleId() {
        return this._ruleId;
    }
    get ruleType() {
        return this._ruleType;
    }
    get description() {
        return this._description;
    }
    get parameters() {
        return this._parameters;
    }
}
// 4. Scope Rule Set
export class ScopeRuleSet {
    _rules;
    constructor(rules) {
        if (!rules) {
            throw new Error("Rules list is required.");
        }
        this._rules = [...rules];
        Object.freeze(this._rules);
        Object.freeze(this);
    }
    get rules() {
        return Object.freeze([...this._rules]);
    }
}
// 5. Scope Decision
export var ScopeDecisionValue;
(function (ScopeDecisionValue) {
    ScopeDecisionValue["ACCEPT"] = "ACCEPT";
    ScopeDecisionValue["REJECT"] = "REJECT";
    ScopeDecisionValue["REQUIRES_REVIEW"] = "REQUIRES_REVIEW";
})(ScopeDecisionValue || (ScopeDecisionValue = {}));
export class ScopeDecision {
    _value;
    constructor(value) {
        if (!value || value.trim() === "") {
            throw new Error("Decision value is required.");
        }
        const cleanValue = value.trim().toUpperCase();
        if (cleanValue !== "ACCEPT" && cleanValue !== "REJECT" && cleanValue !== "REQUIRES_REVIEW") {
            throw new Error(`Unsupported decision value: ${value}`);
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
export class ScopeRuleViolation {
    _ruleId;
    _factId;
    _reasonCode;
    _explanation;
    _relatedReferences;
    constructor(properties) {
        if (!properties.ruleId || properties.ruleId.trim() === "") {
            throw new Error("Rule identifier is required.");
        }
        if (!properties.reasonCode || properties.reasonCode.trim() === "") {
            throw new Error("Reason code is required.");
        }
        if (!properties.explanation || properties.explanation.trim() === "") {
            throw new Error("Explanation is required.");
        }
        this._ruleId = properties.ruleId.trim();
        this._factId = properties.factId;
        this._reasonCode = properties.reasonCode.trim();
        this._explanation = properties.explanation.trim();
        this._relatedReferences = properties.relatedReferences ? [...properties.relatedReferences] : [];
        Object.freeze(this._relatedReferences);
        Object.freeze(this);
    }
    get ruleId() {
        return this._ruleId;
    }
    get factId() {
        return this._factId;
    }
    get reasonCode() {
        return this._reasonCode;
    }
    get explanation() {
        return this._explanation;
    }
    get relatedReferences() {
        return Object.freeze([...this._relatedReferences]);
    }
}
export class ScopeEvaluation {
    _evaluationId;
    _extractionId;
    _ruleSet;
    _decision;
    _violations;
    _evaluatedAt;
    constructor(properties) {
        if (!properties.evaluationId || properties.evaluationId.trim() === "") {
            throw new Error("Evaluation identifier is required.");
        }
        if (!properties.extractionId || properties.extractionId.trim() === "") {
            throw new Error("Extraction identifier is required.");
        }
        if (!properties.ruleSet) {
            throw new Error("Rule set is required.");
        }
        if (!properties.decision) {
            throw new Error("Decision is required.");
        }
        if (!properties.violations) {
            throw new Error("Violations array is required.");
        }
        if (!properties.evaluatedAt) {
            throw new Error("Evaluated timestamp is required.");
        }
        this._evaluationId = properties.evaluationId.trim();
        this._extractionId = properties.extractionId.trim();
        this._ruleSet = properties.ruleSet;
        this._decision = properties.decision;
        this._violations = [...properties.violations];
        this._evaluatedAt = new Date(properties.evaluatedAt.getTime());
        Object.freeze(this._violations);
        Object.freeze(this);
    }
    get evaluationId() {
        return this._evaluationId;
    }
    get extractionId() {
        return this._extractionId;
    }
    get ruleSet() {
        return this._ruleSet;
    }
    get decision() {
        return this._decision;
    }
    get violations() {
        return Object.freeze([...this._violations]);
    }
    get evaluatedAt() {
        return new Date(this._evaluatedAt.getTime());
    }
}
export class ScopeEvaluationCompletedEvent {
    aggregateId;
    eventName = "SCOPE_EVALUATION_COMPLETED";
    timestamp;
    payload;
    constructor(aggregateId, decision, violationsCount, timestamp) {
        this.aggregateId = aggregateId;
        this.timestamp = new Date(timestamp.getTime());
        this.payload = { decision, violationsCount };
        Object.freeze(this.payload);
        Object.freeze(this);
    }
}
// 9. Rules Evaluation Engine
export class ScopeRulesEngine {
    static evaluate(evaluationId, extraction, ruleSet) {
        const violations = [];
        const facts = extraction.facts;
        for (const rule of ruleSet.rules) {
            if (rule.ruleType.value === "EXCLUSION") {
                const prohibitedType = rule.parameters.prohibitedType;
                const prohibitedKeyword = rule.parameters.prohibitedKeyword;
                for (const fact of facts) {
                    if (prohibitedType && fact.factType.value === prohibitedType) {
                        violations.push(new ScopeRuleViolation({
                            ruleId: rule.ruleId,
                            factId: fact.factId,
                            reasonCode: "EXCLUSION_VIOLATION",
                            explanation: `Fact type ${fact.factType.value} is prohibited.`,
                        }));
                    }
                    else if (prohibitedKeyword &&
                        fact.factValue.description.toLowerCase().includes(prohibitedKeyword.toLowerCase())) {
                        violations.push(new ScopeRuleViolation({
                            ruleId: rule.ruleId,
                            factId: fact.factId,
                            reasonCode: "EXCLUSION_VIOLATION",
                            explanation: `Fact contains prohibited keyword: ${prohibitedKeyword}.`,
                        }));
                    }
                }
            }
            else if (rule.ruleType.value === "REQUIREMENT") {
                const requiredType = rule.parameters.requiredType;
                const requiredKeyword = rule.parameters.requiredKeyword;
                let satisfied = false;
                if (requiredType) {
                    satisfied = facts.some((f) => f.factType.value === requiredType);
                }
                else if (requiredKeyword) {
                    satisfied = facts.some((f) => f.factValue.description.toLowerCase().includes(requiredKeyword.toLowerCase()));
                }
                if (!satisfied) {
                    violations.push(new ScopeRuleViolation({
                        ruleId: rule.ruleId,
                        reasonCode: "MISSING_REQUIREMENT",
                        explanation: `Required scope criteria was not satisfied: ${requiredType || requiredKeyword}.`,
                    }));
                }
            }
            else if (rule.ruleType.value === "DEPENDENCY") {
                const ifFactId = rule.parameters.ifFactId;
                const thenRequiredType = rule.parameters.thenRequiredType;
                if (ifFactId && thenRequiredType) {
                    const sourceFactPresent = facts.some((f) => f.factId === ifFactId);
                    if (sourceFactPresent) {
                        const targetFactPresent = facts.some((f) => f.factType.value === thenRequiredType);
                        if (!targetFactPresent) {
                            violations.push(new ScopeRuleViolation({
                                ruleId: rule.ruleId,
                                factId: ifFactId,
                                reasonCode: "DEPENDENCY_VIOLATION",
                                explanation: `Fact ${ifFactId} is present but dependent type ${thenRequiredType} is missing.`,
                            }));
                        }
                    }
                }
            }
            else if (rule.ruleType.value === "CONTRADICTION") {
                for (const factA of facts) {
                    if (factA.factType.value === "DELIVERABLE" || factA.factType.value === "REQUIREMENT") {
                        const descA = factA.factValue.description.toLowerCase().trim();
                        for (const factB of facts) {
                            if (factB.factType.value === "EXCLUSION") {
                                const descB = factB.factValue.description.toLowerCase().trim();
                                if (descA === descB) {
                                    violations.push(new ScopeRuleViolation({
                                        ruleId: rule.ruleId,
                                        factId: factA.factId,
                                        reasonCode: "CONTRADICTION_DETECTED",
                                        explanation: `Contradiction detected: '${factA.factValue.description}' is both demanded and excluded.`,
                                        relatedReferences: [factB.factId],
                                    }));
                                }
                            }
                        }
                    }
                }
            }
        }
        let decisionValue;
        if (violations.length === 0) {
            decisionValue = ScopeDecisionValue.ACCEPT;
        }
        else {
            const hasContradiction = violations.some((v) => v.reasonCode === "CONTRADICTION_DETECTED");
            if (hasContradiction) {
                decisionValue = ScopeDecisionValue.REQUIRES_REVIEW;
            }
            else {
                decisionValue = ScopeDecisionValue.REJECT;
            }
        }
        return new ScopeEvaluation({
            evaluationId,
            extractionId: extraction.extractionId,
            ruleSet,
            decision: new ScopeDecision(decisionValue),
            violations,
            evaluatedAt: new Date(),
        });
    }
}
