// 2. Confidence Score
export class ConfidenceScore {
  private readonly _value: number;

  constructor(value: number) {
    if (typeof value !== "number" || !Number.isFinite(value) || Number.isNaN(value)) {
      throw new Error("Confidence score must be a finite number.");
    }
    if (value < 0.0 || value > 1.0) {
      throw new Error("Confidence score must be between 0.0 and 1.0 inclusive.");
    }
    this._value = value;
    Object.freeze(this);
  }

  get value(): number {
    return this._value;
  }

  public equals(other: ConfidenceScore): boolean {
    if (!other) {
      return false;
    }
    return this._value === other.value;
  }
}

// 3. Confidence Level
export type ConfidenceLevelValue = "HIGH" | "MEDIUM" | "LOW";

export class ConfidenceLevel {
  private readonly _value: ConfidenceLevelValue;

  constructor(value: string) {
    if (!value || value.trim() === "") {
      throw new Error("Confidence level is required.");
    }
    const cleanValue = value.trim().toUpperCase();
    if (cleanValue !== "HIGH" && cleanValue !== "MEDIUM" && cleanValue !== "LOW") {
      throw new Error(`Unsupported confidence level: ${value}`);
    }
    this._value = cleanValue as ConfidenceLevelValue;
    Object.freeze(this);
  }

  get value(): ConfidenceLevelValue {
    return this._value;
  }

  public equals(other: ConfidenceLevel): boolean {
    if (!other) {
      return false;
    }
    return this._value === other.value;
  }
}

// 4. Confidence Reason
export type ConfidenceReasonValue =
  | "STRONG_EVIDENCE"
  | "MULTIPLE_SUPPORTING_FACTS"
  | "DIRECT_SOURCE"
  | "MISSING_INFORMATION"
  | "CONFLICTING_FACTS"
  | "WEAK_EVIDENCE"
  | "AMBIGUOUS_SCOPE"
  | "RULE_REVIEW_REQUIRED";

export class ConfidenceReason {
  private readonly _value: ConfidenceReasonValue;

  constructor(value: string) {
    if (!value || value.trim() === "") {
      throw new Error("Confidence reason is required.");
    }
    const cleanValue = value.trim().toUpperCase().replace(/-/g, "_");
    const validReasons: ConfidenceReasonValue[] = [
      "STRONG_EVIDENCE",
      "MULTIPLE_SUPPORTING_FACTS",
      "DIRECT_SOURCE",
      "MISSING_INFORMATION",
      "CONFLICTING_FACTS",
      "WEAK_EVIDENCE",
      "AMBIGUOUS_SCOPE",
      "RULE_REVIEW_REQUIRED",
    ];
    if (!validReasons.includes(cleanValue as ConfidenceReasonValue)) {
      throw new Error(`Unsupported confidence reason: ${value}`);
    }
    this._value = cleanValue as ConfidenceReasonValue;
    Object.freeze(this);
  }

  get value(): ConfidenceReasonValue {
    return this._value;
  }

  public equals(other: ConfidenceReason): boolean {
    if (!other) {
      return false;
    }
    return this._value === other.value;
  }
}

// 5. Confidence Evidence Linkage
export interface ConfidenceEvidenceProperties {
  sourceId: string;
  factId?: string;
  evaluationId?: string;
}

export class ConfidenceEvidence {
  private readonly _sourceId: string;
  private readonly _factId: string | undefined;
  private readonly _evaluationId: string | undefined;

  constructor(properties: ConfidenceEvidenceProperties) {
    if (!properties.sourceId || properties.sourceId.trim() === "") {
      throw new Error("Source identifier is required.");
    }
    this._sourceId = properties.sourceId.trim();
    this._factId = properties.factId;
    this._evaluationId = properties.evaluationId;
    Object.freeze(this);
  }

  get sourceId(): string {
    return this._sourceId;
  }

  get factId(): string | undefined {
    return this._factId;
  }

  get evaluationId(): string | undefined {
    return this._evaluationId;
  }
}

// 6. Confidence Assessment
export interface ConfidenceAssessmentProperties {
  assessmentId: string;
  evaluationId: string;
  extractionId: string;
  score: ConfidenceScore;
  level: ConfidenceLevel;
  reasons: ConfidenceReason[];
  evidenceList: ConfidenceEvidence[];
  assessedAt: Date;
}

export class ConfidenceAssessment {
  private readonly _assessmentId: string;
  private readonly _evaluationId: string;
  private readonly _extractionId: string;
  private readonly _score: ConfidenceScore;
  private readonly _level: ConfidenceLevel;
  private readonly _reasons: ConfidenceReason[];
  private readonly _evidenceList: ConfidenceEvidence[];
  private readonly _assessedAt: Date;

  constructor(properties: ConfidenceAssessmentProperties) {
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

  get assessmentId(): string {
    return this._assessmentId;
  }

  get evaluationId(): string {
    return this._evaluationId;
  }

  get extractionId(): string {
    return this._extractionId;
  }

  get score(): ConfidenceScore {
    return this._score;
  }

  get level(): ConfidenceLevel {
    return this._level;
  }

  get reasons(): ReadonlyArray<ConfidenceReason> {
    return Object.freeze([...this._reasons]);
  }

  get evidenceList(): ReadonlyArray<ConfidenceEvidence> {
    return Object.freeze([...this._evidenceList]);
  }

  get assessedAt(): Date {
    return new Date(this._assessedAt.getTime());
  }
}

// 7. Domain Event
export interface ConfidenceDomainEvent {
  eventName: string;
  aggregateId: string;
  timestamp: Date;
  payload: Record<string, unknown>;
}

export class ConfidenceAssessedEvent implements ConfidenceDomainEvent {
  public readonly eventName = "CONFIDENCE_ASSESSED";
  public readonly timestamp: Date;
  public readonly payload: { score: number; level: string };

  constructor(
    public readonly aggregateId: string,
    score: number,
    level: string,
    timestamp: Date,
  ) {
    this.timestamp = new Date(timestamp.getTime());
    this.payload = { score, level };
    Object.freeze(this.payload);
    Object.freeze(this);
  }
}

// 9. Persistence / Provider Abstractions
export interface ConfidencePersistenceContract {
  save(assessment: ConfidenceAssessment): Promise<void>;
  findById(assessmentId: string): Promise<ConfidenceAssessment | null>;
}

export interface ConfidenceAggregateStore {
  save(assessment: ConfidenceAssessment): Promise<void>;
  load(assessmentId: string): Promise<ConfidenceAssessment>;
}

export interface ConfidenceQueryProjection {
  getAssessmentsByExtraction(extractionId: string): Promise<ConfidenceAssessment[]>;
}
