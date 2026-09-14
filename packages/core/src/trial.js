/**
 * =====================================================================
 * Trial Domain Model & Abuse Prevention
 * =====================================================================
 */
/**
 * Calculates a trial expiration date exactly 7 days in the future.
 * Calculation is performed using UTC milliseconds.
 */
export function calculateTrialExpiration(startedAt) {
    if (!startedAt) {
        throw new Error("Start date is required to calculate trial expiration.");
    }
    const durationMs = 7 * 24 * 60 * 60 * 1000; // exactly 7 days in milliseconds
    return new Date(startedAt.getTime() + durationMs);
}
/**
 * TrialEligibility is a provider-independent value object that evaluates
 * trial eligibility based on authoritative identity signals.
 */
export class TrialEligibility {
    _isEligible;
    _rejectionReason;
    constructor(isEligible, rejectionReason) {
        this._isEligible = isEligible;
        this._rejectionReason = rejectionReason;
        Object.freeze(this);
    }
    get isEligible() {
        return this._isEligible;
    }
    get rejectionReason() {
        return this._rejectionReason;
    }
    /**
     * Authoritatively evaluates eligibility by checking current signals against historical grants.
     * Crucially, email address alone MUST NOT determine eligibility.
     */
    static evaluate(currentSignals, historicalGrants) {
        if (!currentSignals) {
            return new TrialEligibility(false, "No identity signals provided.");
        }
        // 1. Ensure email address alone is not the sole signal.
        // If only verifiedEmail is provided (or nothing at all), and no account or payment signal is present,
        // we must reject to prevent email-cycling trial creation.
        const hasAccountSignal = Boolean(currentSignals.accountId);
        const hasBillingSignal = Boolean(currentSignals.billingCustomerId);
        const hasPaymentSignal = Boolean(currentSignals.paymentMethodId);
        const hasPriorGrantIds = Boolean(currentSignals.priorTrialGrantIds && currentSignals.priorTrialGrantIds.length > 0);
        if (!hasAccountSignal && !hasBillingSignal && !hasPaymentSignal && !hasPriorGrantIds) {
            return new TrialEligibility(false, "Email address alone cannot determine trial eligibility. An account or billing/payment signal is required.");
        }
        // 2. Check explicit flags
        if (currentSignals.hasExistingAccountOwnership) {
            return new TrialEligibility(false, "User ineligible due to existing account ownership.");
        }
        // 3. Check current signals against their prior trial grant IDs list
        if (hasPriorGrantIds) {
            return new TrialEligibility(false, "User ineligible due to prior trial grants listed in identity signals.");
        }
        // 4. Check historical grants for matching authoritative signals
        for (const grant of historicalGrants) {
            // Check accountId match
            if (currentSignals.accountId && grant.userId === currentSignals.accountId) {
                return new TrialEligibility(false, `User ineligible due to prior trial grant (${grant.grantId}) associated with account.`);
            }
            // Check billingCustomerId match
            if (currentSignals.billingCustomerId &&
                grant.identitySignals.billingCustomerId === currentSignals.billingCustomerId) {
                return new TrialEligibility(false, `User ineligible due to prior trial grant (${grant.grantId}) associated with billing identity.`);
            }
            // Check paymentMethodId match
            if (currentSignals.paymentMethodId &&
                grant.identitySignals.paymentMethodId === currentSignals.paymentMethodId) {
                return new TrialEligibility(false, `User ineligible due to prior trial grant (${grant.grantId}) associated with payment identity.`);
            }
            // Check verifiedEmail match (as a secondary check, but not the sole check)
            if (currentSignals.verifiedEmail &&
                grant.identitySignals.verifiedEmail === currentSignals.verifiedEmail) {
                return new TrialEligibility(false, `User ineligible due to prior trial grant (${grant.grantId}) associated with verified email.`);
            }
        }
        return new TrialEligibility(true);
    }
}
/**
 * TrialGrant represents the aggregate root or domain model of an issued trial.
 * Once issued, start and end timestamps are strictly immutable.
 */
export class TrialGrant {
    _grantId;
    _userId;
    _planId;
    _status;
    _trialStartedAt;
    _trialEndsAt;
    _identitySignals;
    constructor(properties) {
        if (!properties.grantId || properties.grantId.trim() === "") {
            throw new Error("Grant ID is required.");
        }
        if (!properties.userId || properties.userId.trim() === "") {
            throw new Error("User ID is required.");
        }
        if (!properties.planId || properties.planId.trim() === "") {
            throw new Error("Plan ID is required.");
        }
        if (!properties.trialStartedAt) {
            throw new Error("Trial started timestamp is required.");
        }
        if (!properties.trialEndsAt) {
            throw new Error("Trial ends timestamp is required.");
        }
        if (!properties.status) {
            throw new Error("Trial status is required.");
        }
        if (!properties.identitySignals) {
            throw new Error("Identity signals are required.");
        }
        // Force internal date objects to copy their references to avoid outside mutations
        const started = new Date(properties.trialStartedAt.getTime());
        const ends = new Date(properties.trialEndsAt.getTime());
        if (ends <= started) {
            throw new Error("Trial end date must be after start date.");
        }
        // Validate trial duration is exactly 7 days
        const durationMs = ends.getTime() - started.getTime();
        const expectedDurationMs = 7 * 24 * 60 * 60 * 1000;
        if (durationMs !== expectedDurationMs) {
            throw new Error("Trial duration must be exactly 7 days.");
        }
        this._grantId = properties.grantId;
        this._userId = properties.userId;
        this._planId = properties.planId;
        this._status = properties.status;
        this._trialStartedAt = started;
        this._trialEndsAt = ends;
        this._identitySignals = { ...properties.identitySignals };
        Object.freeze(this._identitySignals);
    }
    get grantId() {
        return this._grantId;
    }
    get userId() {
        return this._userId;
    }
    get planId() {
        return this._planId;
    }
    get status() {
        return this._status;
    }
    get trialStartedAt() {
        return new Date(this._trialStartedAt.getTime());
    }
    get trialEndsAt() {
        return new Date(this._trialEndsAt.getTime());
    }
    get identitySignals() {
        return { ...this._identitySignals };
    }
    /**
     * Updates the state of the trial grant, validating transitions.
     */
    transitionTo(newStatus) {
        if (this._status === "CONVERTED" ||
            this._status === "CANCELLED" ||
            this._status === "EXPIRED") {
            throw new Error(`Cannot transition trial from terminal state: ${this._status}`);
        }
        if (newStatus === "NOT_STARTED") {
            throw new Error("Cannot transition back to NOT_STARTED.");
        }
        this._status = newStatus;
    }
    /**
     * Computes the state of the trial at a given UTC time representation.
     */
    getStatusAt(currentTime) {
        if (this._status === "CONVERTED" || this._status === "CANCELLED") {
            return this._status;
        }
        const timeMs = currentTime.getTime();
        if (timeMs < this._trialStartedAt.getTime()) {
            return "NOT_STARTED";
        }
        if (timeMs >= this._trialEndsAt.getTime()) {
            return "EXPIRED";
        }
        return "ACTIVE";
    }
}
/**
 * In-memory implementation of TrialGrantPersistenceContract for unit tests.
 */
export class InMemoryTrialGrantPersistence {
    _grants = new Map();
    async save(grant) {
        this._grants.set(grant.grantId, grant);
    }
    async findById(grantId) {
        return this._grants.get(grantId) || null;
    }
    async findByUserId(userId) {
        return Array.from(this._grants.values()).filter((g) => g.userId === userId);
    }
    async findBySignal(signalType, value) {
        return Array.from(this._grants.values()).filter((g) => {
            const signals = g.identitySignals;
            if (signalType === "verifiedEmail" && signals.verifiedEmail === value) {
                return true;
            }
            if (signalType === "billingCustomerId" && signals.billingCustomerId === value) {
                return true;
            }
            if (signalType === "paymentMethodId" && signals.paymentMethodId === value) {
                return true;
            }
            return false;
        });
    }
}
/**
 * Domain Service for coordinating trial grants and enforcing business invariants.
 */
export class TrialService {
    _persistence;
    constructor(persistence) {
        this._persistence = persistence;
    }
    /**
     * Evaluates eligibility and issues a trial grant.
     * Enforces that duplicate grants are rejected and start/end dates are immutable.
     */
    async issueTrialGrant(properties) {
        // 1. Check duplicate grant ID
        const existingById = await this._persistence.findById(properties.grantId);
        if (existingById) {
            throw new Error(`Duplicate grant creation rejected. Trial grant with ID ${properties.grantId} already exists.`);
        }
        // 2. Fetch historical grants for the user/signals to check eligibility
        const historicalGrants = [];
        const userGrants = await this._persistence.findByUserId(properties.userId);
        historicalGrants.push(...userGrants);
        if (properties.identitySignals.verifiedEmail) {
            const emailGrants = await this._persistence.findBySignal("verifiedEmail", properties.identitySignals.verifiedEmail);
            historicalGrants.push(...emailGrants);
        }
        if (properties.identitySignals.billingCustomerId) {
            const billingGrants = await this._persistence.findBySignal("billingCustomerId", properties.identitySignals.billingCustomerId);
            historicalGrants.push(...billingGrants);
        }
        if (properties.identitySignals.paymentMethodId) {
            const paymentGrants = await this._persistence.findBySignal("paymentMethodId", properties.identitySignals.paymentMethodId);
            historicalGrants.push(...paymentGrants);
        }
        // De-duplicate historicalGrants by grantId
        const uniqueHistoricalGrants = Array.from(new Map(historicalGrants.map((g) => [g.grantId, g])).values());
        // 3. Evaluate eligibility
        const eligibility = TrialEligibility.evaluate(properties.identitySignals, uniqueHistoricalGrants);
        if (!eligibility.isEligible) {
            throw new Error(`User is ineligible for a trial: ${eligibility.rejectionReason}`);
        }
        // 4. Calculate trialEndsAt using UTC calculation
        const trialEndsAt = calculateTrialExpiration(properties.trialStartedAt);
        // 5. Create new TrialGrant
        const newGrant = new TrialGrant({
            grantId: properties.grantId,
            userId: properties.userId,
            planId: properties.planId,
            status: "ACTIVE",
            trialStartedAt: properties.trialStartedAt,
            trialEndsAt,
            identitySignals: properties.identitySignals,
        });
        // 6. Persist
        await this._persistence.save(newGrant);
        return newGrant;
    }
}
