// Payment States
export type PaymentState =
  | "Pending"
  | "Authorized"
  | "Captured"
  | "Completed"
  | "Failed"
  | "Cancelled"
  | "Expired";

// Domain Events
export const PAYMENT_CREATED = "PAYMENT_CREATED";
export const PAYMENT_AUTHORIZED = "PAYMENT_AUTHORIZED";
export const PAYMENT_CAPTURED = "PAYMENT_CAPTURED";
export const PAYMENT_COMPLETED = "PAYMENT_COMPLETED";
export const PAYMENT_FAILED = "PAYMENT_FAILED";
export const PAYMENT_CANCELLED = "PAYMENT_CANCELLED";

export type PaymentDomainEventName =
  | typeof PAYMENT_CREATED
  | typeof PAYMENT_AUTHORIZED
  | typeof PAYMENT_CAPTURED
  | typeof PAYMENT_COMPLETED
  | typeof PAYMENT_FAILED
  | typeof PAYMENT_CANCELLED;

export interface PaymentEventPublisher {
  publish(event: PaymentDomainEventName, metadata: Record<string, unknown>): Promise<void>;
}

// Money Value Object
export class Money {
  private readonly _amount: number;
  private readonly _currency: string;

  constructor(amount: number, currency: string) {
    this._amount = amount;
    this._currency = currency;
  }

  get amount(): number {
    return this._amount;
  }

  get currency(): string {
    return this._currency;
  }

  public equals(other: Money): boolean {
    return this._amount === other.amount && this._currency === other.currency;
  }
}

// Monetary Policy Interface
export interface MonetaryPolicy {
  validate(money: Money): void;
}

// Payment Aggregate Root Properties
export interface PaymentProperties {
  paymentId: string;
  clientId: string;
  ownerId: string;
  money: Money;
  status: PaymentState;
  paymentReference: string;
  createdAt: Date;
  updatedAt: Date;
}

// Payment Aggregate Root
export class Payment {
  private readonly _paymentId: string;
  private readonly _clientId: string;
  private readonly _ownerId: string;
  private readonly _money: Money;
  private _status: PaymentState;
  private readonly _paymentReference: string;
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _domainEvents: Array<{
    event: PaymentDomainEventName;
    metadata: Record<string, unknown>;
  }> = [];

  constructor(properties: PaymentProperties, policy?: MonetaryPolicy) {
    if (!properties.paymentId || properties.paymentId.trim() === "") {
      throw new Error("Payment ID is required.");
    }
    if (!properties.clientId || properties.clientId.trim() === "") {
      throw new Error("Client ID reference is required.");
    }
    if (!properties.ownerId || properties.ownerId.trim() === "") {
      throw new Error("Owner ID reference is required.");
    }
    if (!properties.paymentReference || properties.paymentReference.trim() === "") {
      throw new Error("Payment reference is required.");
    }
    if (!properties.money) {
      throw new Error("Money Value Object is required.");
    }

    this._paymentId = properties.paymentId;
    this._clientId = properties.clientId;
    this._ownerId = properties.ownerId;
    this._money = properties.money;
    this._status = properties.status;
    this._paymentReference = properties.paymentReference;
    this._createdAt = properties.createdAt;
    this._updatedAt = properties.updatedAt;

    if (policy) {
      policy.validate(this._money);
    }

    this.validateInvariants();
  }

  get paymentId(): string {
    return this._paymentId;
  }

  get clientId(): string {
    return this._clientId;
  }

  get ownerId(): string {
    return this._ownerId;
  }

  get money(): Money {
    return this._money;
  }

  get status(): PaymentState {
    return this._status;
  }

  get paymentReference(): string {
    return this._paymentReference;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  get domainEvents() {
    return this._domainEvents;
  }

  public clearDomainEvents() {
    this._domainEvents = [];
  }

  private addDomainEvent(event: PaymentDomainEventName, metadata: Record<string, unknown>) {
    this._domainEvents.push({ event, metadata });
  }

  // Factory Creation Method
  public static create(
    paymentId: string,
    clientId: string,
    ownerId: string,
    money: Money,
    paymentReference: string,
    policy?: MonetaryPolicy,
  ): Payment {
    const now = new Date();
    const payment = new Payment(
      {
        paymentId,
        clientId,
        ownerId,
        money,
        status: "Pending",
        paymentReference,
        createdAt: now,
        updatedAt: now,
      },
      policy,
    );

    payment.addDomainEvent(PAYMENT_CREATED, {
      paymentId: payment.paymentId,
      clientId: payment.clientId,
      ownerId: payment.ownerId,
      amount: payment.money.amount,
      currency: payment.money.currency,
    });

    return payment;
  }

  public authorize(ownerId: string) {
    this.verifyOwnership(ownerId);
    if (this._status !== "Pending") {
      throw new Error(`Cannot authorize payment in state: ${this._status}`);
    }
    this._status = "Authorized";
    this._updatedAt = new Date();
    this.addDomainEvent(PAYMENT_AUTHORIZED, { paymentId: this._paymentId });
  }

  public capture(ownerId: string) {
    this.verifyOwnership(ownerId);
    if (this._status !== "Pending" && this._status !== "Authorized") {
      throw new Error(`Cannot capture payment in state: ${this._status}`);
    }
    this._status = "Captured";
    this._updatedAt = new Date();
    this.addDomainEvent(PAYMENT_CAPTURED, { paymentId: this._paymentId });
  }

  public complete(ownerId: string) {
    this.verifyOwnership(ownerId);
    if (this._status !== "Captured") {
      throw new Error(`Cannot complete payment in state: ${this._status}`);
    }
    this._status = "Completed";
    this._updatedAt = new Date();
    this.addDomainEvent(PAYMENT_COMPLETED, { paymentId: this._paymentId });
  }

  public fail(ownerId: string) {
    this.verifyOwnership(ownerId);
    if (
      this._status !== "Pending" &&
      this._status !== "Authorized" &&
      this._status !== "Captured" &&
      this._status !== "Completed"
    ) {
      throw new Error(`Cannot mark payment as failed in state: ${this._status}`);
    }
    this._status = "Failed";
    this._updatedAt = new Date();
    this.addDomainEvent(PAYMENT_FAILED, { paymentId: this._paymentId });
  }

  public cancel(ownerId: string) {
    this.verifyOwnership(ownerId);
    if (
      this._status !== "Authorized" &&
      this._status !== "Captured" &&
      this._status !== "Completed"
    ) {
      throw new Error(`Cannot cancel payment in state: ${this._status}`);
    }
    this._status = "Cancelled";
    this._updatedAt = new Date();
    this.addDomainEvent(PAYMENT_CANCELLED, { paymentId: this._paymentId });
  }

  public expire(ownerId: string) {
    this.verifyOwnership(ownerId);
    if (this._status !== "Pending" && this._status !== "Authorized") {
      throw new Error(`Cannot expire payment in state: ${this._status}`);
    }
    this._status = "Expired";
    this._updatedAt = new Date();
  }

  private verifyOwnership(ownerId: string) {
    if (ownerId !== this._ownerId) {
      throw new Error("Ownership validation failed.");
    }
  }

  private validateInvariants() {
    if (!this._paymentId || this._paymentId.trim() === "") {
      throw new Error("Payment ID is required.");
    }
    if (!this._clientId || this._clientId.trim() === "") {
      throw new Error("Client ID reference is required.");
    }
    if (!this._ownerId || this._ownerId.trim() === "") {
      throw new Error("Owner ID reference is required.");
    }
  }

  // Idempotent Payment Intent Strategy Invariant Validation
  public async validateIntentUniqueness(
    persistence: PaymentPersistenceContract,
    paymentReference: string,
  ): Promise<void> {
    const isUnique = await persistence.checkUniqueIntent(
      this._ownerId,
      paymentReference,
      this._paymentId,
    );
    if (!isUnique) {
      throw new Error(
        "Duplicate payment intent: payment aggregate already exists for this intent.",
      );
    }
  }
}

// Domain Persistence Contract for aggregate store / uniqueness checking
export interface PaymentPersistenceContract {
  checkUniqueIntent(
    ownerId: string,
    paymentReference: string,
    paymentId?: string,
  ): Promise<boolean>;
}

// Payment Aggregate Store
export interface PaymentAggregateStore {
  save(payment: Payment): Promise<void>;
  findById(paymentId: string, ownerId: string): Promise<Payment | null>;
  findByReference(paymentReference: string, ownerId: string): Promise<Payment | null>;
}

// Query-side Projection Contract
export interface PaymentQueryProjection {
  id: string;
  clientId: string;
  ownerId: string;
  amount: number;
  currency: string;
  status: string;
  paymentReference: string;
}
