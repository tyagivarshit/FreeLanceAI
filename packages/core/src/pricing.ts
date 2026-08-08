// 1. Pricing Amount
export class PricingAmount {
  private readonly _value: number;

  constructor(value: number) {
    if (typeof value !== "number" || !Number.isFinite(value) || Number.isNaN(value)) {
      throw new Error("Pricing amount must be a finite number.");
    }
    if (value < 0.0) {
      throw new Error("Pricing amount must be non-negative.");
    }
    this._value = value;
    Object.freeze(this);
  }

  get value(): number {
    return this._value;
  }

  public equals(other: PricingAmount): boolean {
    if (!other) {
      return false;
    }
    return this._value === other.value;
  }
}

// 2. Pricing Currency
export class PricingCurrency {
  private readonly _value: string;

  constructor(value: string) {
    if (!value || value.trim() === "") {
      throw new Error("Currency is required.");
    }
    this._value = value.trim().toUpperCase();
    Object.freeze(this);
  }

  get value(): string {
    return this._value;
  }

  public equals(other: PricingCurrency): boolean {
    if (!other) {
      return false;
    }
    return this._value === other.value;
  }
}

// 3. Pricing Component
export interface PricingComponentProperties {
  componentId: string;
  name: string;
  amount: PricingAmount;
  currency: PricingCurrency;
}

export class PricingComponent {
  private readonly _componentId: string;
  private readonly _name: string;
  private readonly _amount: PricingAmount;
  private readonly _currency: PricingCurrency;

  constructor(properties: PricingComponentProperties) {
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

  get componentId(): string {
    return this._componentId;
  }

  get name(): string {
    return this._name;
  }

  get amount(): PricingAmount {
    return this._amount;
  }

  get currency(): PricingCurrency {
    return this._currency;
  }
}

// 4. Pricing Breakdown
export interface PricingBreakdownProperties {
  baseAmount: PricingAmount;
  adjustments: PricingComponent[];
  finalAmount: PricingAmount;
}

export class PricingBreakdown {
  private readonly _baseAmount: PricingAmount;
  private readonly _adjustments: PricingComponent[];
  private readonly _finalAmount: PricingAmount;

  constructor(properties: PricingBreakdownProperties) {
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

  get baseAmount(): PricingAmount {
    return this._baseAmount;
  }

  get adjustments(): ReadonlyArray<PricingComponent> {
    return Object.freeze([...this._adjustments]);
  }

  get finalAmount(): PricingAmount {
    return this._finalAmount;
  }
}

// 5. Pricing Assessment
export interface PricingAssessmentProperties {
  assessmentId: string;
  extractionId: string;
  evaluationId: string;
  breakdown: PricingBreakdown;
  currency: PricingCurrency;
  assessedAt: Date;
}

export class PricingAssessment {
  private readonly _assessmentId: string;
  private readonly _extractionId: string;
  private readonly _evaluationId: string;
  private readonly _breakdown: PricingBreakdown;
  private readonly _currency: PricingCurrency;
  private readonly _assessedAt: Date;

  constructor(properties: PricingAssessmentProperties) {
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

  get assessmentId(): string {
    return this._assessmentId;
  }

  get extractionId(): string {
    return this._extractionId;
  }

  get evaluationId(): string {
    return this._evaluationId;
  }

  get breakdown(): PricingBreakdown {
    return this._breakdown;
  }

  get currency(): PricingCurrency {
    return this._currency;
  }

  get assessedAt(): Date {
    return new Date(this._assessedAt.getTime());
  }
}
