import { ScopeExtraction } from "./scope-extraction.js";

// 1. deepFreeze helper
function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }
  Object.freeze(obj);
  Object.keys(obj).forEach((key) => {
    const val = (obj as Record<string, unknown>)[key];
    if (val !== null && typeof val === "object") {
      deepFreeze(val);
    }
  });
  return obj;
}

// 2. Rule Types
export type ScopeRuleTypeValue =
  | "INCLUSION"
  | "EXCLUSION"
  | "REQUIREMENT"
  | "CONSTRAINT"
  | "DEPENDENCY"
  | "CONTRADICTION"
  | "COMPLETENESS"
  | "BOUNDARY";

export class ScopeRuleType {
  private readonly _value: ScopeRuleTypeValue;

  constructor(value: string) {
    if (!value || value.trim() === "") {
      throw new Error("Rule type is required.");
    }
    const cleanValue = value.trim().toUpperCase();
    const validTypes: ScopeRuleTypeValue[] = [
      "INCLUSION",
      "EXCLUSION",
      "REQUIREMENT",
      "CONSTRAINT",
      "DEPENDENCY",
      "CONTRADICTION",
      "COMPLETENESS",
      "BOUNDARY",
    ];
    if (!validTypes.includes(cleanValue as ScopeRuleTypeValue)) {
      throw new Error(`Unsupported rule type: ${value}`);
    }
    this._value = cleanValue as ScopeRuleTypeValue;
    Object.freeze(this);
  }

  get value(): ScopeRuleTypeValue {
    return this._value;
  }

  public equals(other: ScopeRuleType): boolean {
    if (!other) {
      return false;
    }
    return this._value === other.value;
  }
}

// 3. Scope Rule
export interface ScopeRuleProperties {
  ruleId: string;
  ruleType: ScopeRuleType;
  description: string;
  parameters: Record<string, unknown>;
}

export class ScopeRule {
  private readonly _ruleId: string;
  private readonly _ruleType: ScopeRuleType;
  private readonly _description: string;
  private readonly _parameters: Record<string, unknown>;

  constructor(properties: ScopeRuleProperties) {
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

  get ruleId(): string {
    return this._ruleId;
  }

  get ruleType(): ScopeRuleType {
    return this._ruleType;
  }

  get description(): string {
    return this._description;
  }

  get parameters(): Record<string, unknown> {
    return this._parameters;
  }
}

// 4. Scope Rule Set
export class ScopeRuleSet {
  private readonly _rules: ScopeRule[];

  constructor(rules: ScopeRule[]) {
    if (!rules) {
      throw new Error("Rules list is required.");
    }
    this._rules = [...rules];
    Object.freeze(this._rules);
    Object.freeze(this);
  }

  get rules(): ReadonlyArray<ScopeRule> {
    return Object.freeze([...this._rules]);
  }
}

// 5. Scope Decision
export enum ScopeDecisionValue {
  ACCEPT = "ACCEPT",
  REJECT = "REJECT",
  REQUIRES_REVIEW = "REQUIRES_REVIEW",
}

export class ScopeDecision {
  private readonly _value: ScopeDecisionValue;

  constructor(value: string) {
    if (!value || value.trim() === "") {
      throw new Error("Decision value is required.");
    }
    const cleanValue = value.trim().toUpperCase();
    if (cleanValue !== "ACCEPT" && cleanValue !== "REJECT" && cleanValue !== "REQUIRES_REVIEW") {
      throw new Error(`Unsupported decision value: ${value}`);
    }
    this._value = cleanValue as ScopeDecisionValue;
    Object.freeze(this);
  }

  get value(): ScopeDecisionValue {
    return this._value;
  }

  public equals(other: ScopeDecision): boolean {
    if (!other) {
      return false;
    }
    return this._value === other.value;
  }
}

// 6. Scope Rule Violation
export interface ScopeRuleViolationProperties {
  ruleId: string;
  factId?: string;
  reasonCode: string;
  explanation: string;
  relatedReferences?: string[];
}

export class ScopeRuleViolation {
  private readonly _ruleId: string;
  private readonly _factId: string | undefined;
  private readonly _reasonCode: string;
  private readonly _explanation: string;
  private readonly _relatedReferences: string[];

  constructor(properties: ScopeRuleViolationProperties) {
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

  get ruleId(): string {
    return this._ruleId;
  }

  get factId(): string | undefined {
    return this._factId;
  }

  get reasonCode(): string {
    return this._reasonCode;
  }

  get explanation(): string {
    return this._explanation;
  }

  get relatedReferences(): ReadonlyArray<string> {
    return Object.freeze([...this._relatedReferences]);
  }
}

// 7. Scope Evaluation
export interface ScopeEvaluationProperties {
  evaluationId: string;
  extractionId: string;
  ruleSet: ScopeRuleSet;
  decision: ScopeDecision;
  violations: ScopeRuleViolation[];
  evaluatedAt: Date;
}

export class ScopeEvaluation {
  private readonly _evaluationId: string;
  private readonly _extractionId: string;
  private readonly _ruleSet: ScopeRuleSet;
  private readonly _decision: ScopeDecision;
  private readonly _violations: ScopeRuleViolation[];
  private readonly _evaluatedAt: Date;

  constructor(properties: ScopeEvaluationProperties) {
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

  get evaluationId(): string {
    return this._evaluationId;
  }

  get extractionId(): string {
    return this._extractionId;
  }

  get ruleSet(): ScopeRuleSet {
    return this._ruleSet;
  }

  get decision(): ScopeDecision {
    return this._decision;
  }

  get violations(): ReadonlyArray<ScopeRuleViolation> {
    return Object.freeze([...this._violations]);
  }

  get evaluatedAt(): Date {
    return new Date(this._evaluatedAt.getTime());
  }
}

// 8. Domain Event
export interface ScopeRulesDomainEvent {
  eventName: string;
  aggregateId: string;
  timestamp: Date;
  payload: Record<string, unknown>;
}

export class ScopeEvaluationCompletedEvent implements ScopeRulesDomainEvent {
  public readonly eventName = "SCOPE_EVALUATION_COMPLETED";
  public readonly timestamp: Date;
  public readonly payload: { decision: string; violationsCount: number };

  constructor(
    public readonly aggregateId: string,
    decision: string,
    violationsCount: number,
    timestamp: Date,
  ) {
    this.timestamp = new Date(timestamp.getTime());
    this.payload = { decision, violationsCount };
    Object.freeze(this.payload);
    Object.freeze(this);
  }
}

// 9. Rules Evaluation Engine
export class ScopeRulesEngine {
  public static evaluate(
    evaluationId: string,
    extraction: ScopeExtraction,
    ruleSet: ScopeRuleSet,
  ): ScopeEvaluation {
    const violations: ScopeRuleViolation[] = [];
    const facts = extraction.facts;

    for (const rule of ruleSet.rules) {
      if (rule.ruleType.value === "EXCLUSION") {
        const prohibitedType = rule.parameters.prohibitedType as string | undefined;
        const prohibitedKeyword = rule.parameters.prohibitedKeyword as string | undefined;

        for (const fact of facts) {
          if (prohibitedType && fact.factType.value === prohibitedType) {
            violations.push(
              new ScopeRuleViolation({
                ruleId: rule.ruleId,
                factId: fact.factId,
                reasonCode: "EXCLUSION_VIOLATION",
                explanation: `Fact type ${fact.factType.value} is prohibited.`,
              }),
            );
          } else if (
            prohibitedKeyword &&
            fact.factValue.description.toLowerCase().includes(prohibitedKeyword.toLowerCase())
          ) {
            violations.push(
              new ScopeRuleViolation({
                ruleId: rule.ruleId,
                factId: fact.factId,
                reasonCode: "EXCLUSION_VIOLATION",
                explanation: `Fact contains prohibited keyword: ${prohibitedKeyword}.`,
              }),
            );
          }
        }
      } else if (rule.ruleType.value === "REQUIREMENT") {
        const requiredType = rule.parameters.requiredType as string | undefined;
        const requiredKeyword = rule.parameters.requiredKeyword as string | undefined;

        let satisfied = false;
        if (requiredType) {
          satisfied = facts.some((f) => f.factType.value === requiredType);
        } else if (requiredKeyword) {
          satisfied = facts.some((f) =>
            f.factValue.description.toLowerCase().includes(requiredKeyword.toLowerCase()),
          );
        }

        if (!satisfied) {
          violations.push(
            new ScopeRuleViolation({
              ruleId: rule.ruleId,
              reasonCode: "MISSING_REQUIREMENT",
              explanation: `Required scope criteria was not satisfied: ${
                requiredType || requiredKeyword
              }.`,
            }),
          );
        }
      } else if (rule.ruleType.value === "DEPENDENCY") {
        const ifFactId = rule.parameters.ifFactId as string | undefined;
        const thenRequiredType = rule.parameters.thenRequiredType as string | undefined;

        if (ifFactId && thenRequiredType) {
          const sourceFactPresent = facts.some((f) => f.factId === ifFactId);
          if (sourceFactPresent) {
            const targetFactPresent = facts.some((f) => f.factType.value === thenRequiredType);
            if (!targetFactPresent) {
              violations.push(
                new ScopeRuleViolation({
                  ruleId: rule.ruleId,
                  factId: ifFactId,
                  reasonCode: "DEPENDENCY_VIOLATION",
                  explanation: `Fact ${ifFactId} is present but dependent type ${thenRequiredType} is missing.`,
                }),
              );
            }
          }
        }
      } else if (rule.ruleType.value === "CONTRADICTION") {
        for (const factA of facts) {
          if (factA.factType.value === "DELIVERABLE" || factA.factType.value === "REQUIREMENT") {
            const descA = factA.factValue.description.toLowerCase().trim();
            for (const factB of facts) {
              if (factB.factType.value === "EXCLUSION") {
                const descB = factB.factValue.description.toLowerCase().trim();
                if (descA === descB) {
                  violations.push(
                    new ScopeRuleViolation({
                      ruleId: rule.ruleId,
                      factId: factA.factId,
                      reasonCode: "CONTRADICTION_DETECTED",
                      explanation: `Contradiction detected: '${factA.factValue.description}' is both demanded and excluded.`,
                      relatedReferences: [factB.factId],
                    }),
                  );
                }
              }
            }
          }
        }
      }
    }

    let decisionValue: ScopeDecisionValue;
    if (violations.length === 0) {
      decisionValue = ScopeDecisionValue.ACCEPT;
    } else {
      const hasContradiction = violations.some((v) => v.reasonCode === "CONTRADICTION_DETECTED");
      if (hasContradiction) {
        decisionValue = ScopeDecisionValue.REQUIRES_REVIEW;
      } else {
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

// 10. Persistence / Provider Abstractions
export interface ScopeRulePersistenceContract {
  save(evaluation: ScopeEvaluation): Promise<void>;
  findById(evaluationId: string): Promise<ScopeEvaluation | null>;
}

export interface ScopeRuleAggregateStore {
  save(evaluation: ScopeEvaluation): Promise<void>;
  load(evaluationId: string): Promise<ScopeEvaluation>;
}

export interface ScopeRuleQueryProjection {
  getEvaluationsByExtraction(extractionId: string): Promise<ScopeEvaluation[]>;
}
