// Domain Events
export const PAYMENT_CREATED = "PAYMENT_CREATED";
export const PAYMENT_AUTHORIZED = "PAYMENT_AUTHORIZED";
export const PAYMENT_CAPTURED = "PAYMENT_CAPTURED";
export const PAYMENT_COMPLETED = "PAYMENT_COMPLETED";
export const PAYMENT_FAILED = "PAYMENT_FAILED";
export const PAYMENT_CANCELLED = "PAYMENT_CANCELLED";
// Money Value Object
export class Money {
    _amount;
    _currency;
    constructor(amount, currency) {
        if (!Number.isInteger(amount)) {
            throw new Error("Money amount must be an integer (smallest currency unit, e.g. cents).");
        }
        if (amount < 0) {
            throw new Error("Money amount cannot be negative. Use a separate Refund concept instead.");
        }
        this._amount = amount;
        this._currency = currency.toUpperCase();
    }
    get amount() {
        return this._amount;
    }
    get currency() {
        return this._currency;
    }
    equals(other) {
        return this._amount === other.amount && this._currency === other.currency;
    }
    static sum(monies, expectedCurrency) {
        let total = 0;
        const currency = expectedCurrency.toUpperCase();
        for (const m of monies) {
            if (m.currency !== currency) {
                throw new Error(`Cannot sum mixed currencies. Expected ${currency}, got ${m.currency}`);
            }
            total += m.amount;
        }
        return new Money(total, currency);
    }
}
// Payment Aggregate Root
export class Payment {
    _paymentId;
    _tenantId;
    _clientId;
    _ownerId;
    _money;
    _status;
    _paymentReference;
    _createdAt;
    _updatedAt;
    _domainEvents = [];
    constructor(properties, policy) {
        if (!properties.paymentId || properties.paymentId.trim() === "") {
            throw new Error("Payment ID is required.");
        }
        if (!properties.tenantId || properties.tenantId.trim() === "") {
            throw new Error("Tenant ID reference is required.");
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
        this._tenantId = properties.tenantId;
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
    get paymentId() {
        return this._paymentId;
    }
    get tenantId() {
        return this._tenantId;
    }
    get clientId() {
        return this._clientId;
    }
    get ownerId() {
        return this._ownerId;
    }
    get money() {
        return this._money;
    }
    get status() {
        return this._status;
    }
    get paymentReference() {
        return this._paymentReference;
    }
    get createdAt() {
        return this._createdAt;
    }
    get updatedAt() {
        return this._updatedAt;
    }
    get domainEvents() {
        return this._domainEvents;
    }
    clearDomainEvents() {
        this._domainEvents = [];
    }
    addDomainEvent(event, metadata) {
        this._domainEvents.push({ event, metadata });
    }
    // Factory Creation Method
    static create(paymentId, tenantId, clientId, ownerId, money, paymentReference, policy) {
        const now = new Date();
        const payment = new Payment({
            paymentId,
            tenantId,
            clientId,
            ownerId,
            money,
            status: "Pending",
            paymentReference,
            createdAt: now,
            updatedAt: now,
        }, policy);
        payment.addDomainEvent(PAYMENT_CREATED, {
            paymentId: payment.paymentId,
            tenantId: payment.tenantId,
            clientId: payment.clientId,
            ownerId: payment.ownerId,
            amount: payment.money.amount,
            currency: payment.money.currency,
        });
        return payment;
    }
    authorize(ownerId) {
        this.verifyOwnership(ownerId);
        if (this._status !== "Pending") {
            throw new Error(`Cannot authorize payment in state: ${this._status}`);
        }
        this._status = "Authorized";
        this._updatedAt = new Date();
        this.addDomainEvent(PAYMENT_AUTHORIZED, { paymentId: this._paymentId });
    }
    capture(ownerId) {
        this.verifyOwnership(ownerId);
        if (this._status !== "Pending" && this._status !== "Authorized") {
            throw new Error(`Cannot capture payment in state: ${this._status}`);
        }
        this._status = "Captured";
        this._updatedAt = new Date();
        this.addDomainEvent(PAYMENT_CAPTURED, { paymentId: this._paymentId });
    }
    complete(ownerId) {
        this.verifyOwnership(ownerId);
        if (this._status !== "Captured") {
            throw new Error(`Cannot complete payment in state: ${this._status}`);
        }
        this._status = "Completed";
        this._updatedAt = new Date();
        this.addDomainEvent(PAYMENT_COMPLETED, { paymentId: this._paymentId });
    }
    fail(ownerId) {
        this.verifyOwnership(ownerId);
        if (this._status !== "Pending" &&
            this._status !== "Authorized" &&
            this._status !== "Captured") {
            throw new Error(`Cannot mark payment as failed in state: ${this._status}`);
        }
        this._status = "Failed";
        this._updatedAt = new Date();
        this.addDomainEvent(PAYMENT_FAILED, { paymentId: this._paymentId });
    }
    cancel(ownerId) {
        this.verifyOwnership(ownerId);
        if (this._status !== "Pending" &&
            this._status !== "Authorized" &&
            this._status !== "Captured") {
            throw new Error(`Cannot cancel payment in state: ${this._status}`);
        }
        this._status = "Cancelled";
        this._updatedAt = new Date();
        this.addDomainEvent(PAYMENT_CANCELLED, { paymentId: this._paymentId });
    }
    expire(ownerId) {
        this.verifyOwnership(ownerId);
        if (this._status !== "Pending" && this._status !== "Authorized") {
            throw new Error(`Cannot expire payment in state: ${this._status}`);
        }
        this._status = "Expired";
        this._updatedAt = new Date();
    }
    verifyOwnership(ownerId) {
        if (ownerId !== this._ownerId) {
            throw new Error("Ownership validation failed.");
        }
    }
    validateInvariants() {
        if (!this._paymentId || this._paymentId.trim() === "") {
            throw new Error("Payment ID is required.");
        }
        if (!this._tenantId || this._tenantId.trim() === "") {
            throw new Error("Tenant ID reference is required.");
        }
        if (!this._clientId || this._clientId.trim() === "") {
            throw new Error("Client ID reference is required.");
        }
        if (!this._ownerId || this._ownerId.trim() === "") {
            throw new Error("Owner ID reference is required.");
        }
    }
    // Idempotent Payment Intent Strategy Invariant Validation
    async validateIntentUniqueness(persistence, paymentReference) {
        const isUnique = await persistence.checkUniqueIntent(this._ownerId, paymentReference, this._paymentId);
        if (!isUnique) {
            throw new Error("Duplicate payment intent: payment aggregate already exists for this intent.");
        }
    }
}
