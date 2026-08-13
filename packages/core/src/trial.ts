/**
 * =====================================================================
 * Trial Domain Model & Abuse Prevention
 * =====================================================================
 */

/**
 * Explicit trial states.
 */
export type TrialState = "NOT_STARTED" | "ACTIVE" | "EXPIRED" | "CONVERTED" | "CANCELLED";

/**
 * Authoritative identity signals used to evaluate trial eligibility and prevent abuse.
 * These are provider-independent signals.
 */
export interface TrialIdentitySignals {
  accountId?: string | undefined;
  verifiedEmail?: string | undefined;
  priorTrialGrantIds?: string[] | undefined;
  billingCustomerId?: string | undefined;
  paymentMethodId?: string | undefined;
  hasExistingAccountOwnership?: boolean | undefined;
}

/**
 * Properties required to construct or restore a TrialGrant.
 */
export interface TrialGrantProperties {
  grantId: string;
  userId: string;
  planId: string;
  status: TrialState;
  trialStartedAt: Date;
  trialEndsAt: Date;
  identitySignals: TrialIdentitySignals;
}

/**
 * Calculates a trial expiration date exactly 7 days in the future.
 * Calculation is performed using UTC milliseconds.
 */
export function calculateTrialExpiration(startedAt: Date): Date {
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
  private readonly _isEligible: boolean;
  private readonly _rejectionReason: string | undefined;

  constructor(isEligible: boolean, rejectionReason?: string | undefined) {
    this._isEligible = isEligible;
    this._rejectionReason = rejectionReason;
    Object.freeze(this);
  }

  get isEligible(): boolean {
    return this._isEligible;
  }

  get rejectionReason(): string | undefined {
    return this._rejectionReason;
  }

  /**
   * Authoritatively evaluates eligibility by checking current signals against historical grants.
   * Crucially, email address alone MUST NOT determine eligibility.
   */
  public static evaluate(
    currentSignals: TrialIdentitySignals,
    historicalGrants: TrialGrant[],
  ): TrialEligibility {
    if (!currentSignals) {
      return new TrialEligibility(false, "No identity signals provided.");
    }

    // 1. Ensure email address alone is not the sole signal.
    // If only verifiedEmail is provided (or nothing at all), and no account or payment signal is present,
    // we must reject to prevent email-cycling trial creation.
    const hasAccountSignal = Boolean(currentSignals.accountId);
    const hasBillingSignal = Boolean(currentSignals.billingCustomerId);
    const hasPaymentSignal = Boolean(currentSignals.paymentMethodId);
    const hasPriorGrantIds = Boolean(
      currentSignals.priorTrialGrantIds && currentSignals.priorTrialGrantIds.length > 0,
    );

    if (!hasAccountSignal && !hasBillingSignal && !hasPaymentSignal && !hasPriorGrantIds) {
      return new TrialEligibility(
        false,
        "Email address alone cannot determine trial eligibility. An account or billing/payment signal is required.",
      );
    }

    // 2. Check explicit flags
    if (currentSignals.hasExistingAccountOwnership) {
      return new TrialEligibility(false, "User ineligible due to existing account ownership.");
    }

    // 3. Check current signals against their prior trial grant IDs list
    if (hasPriorGrantIds) {
      return new TrialEligibility(
        false,
        "User ineligible due to prior trial grants listed in identity signals.",
      );
    }

    // 4. Check historical grants for matching authoritative signals
    for (const grant of historicalGrants) {
      // Check accountId match
      if (currentSignals.accountId && grant.userId === currentSignals.accountId) {
        return new TrialEligibility(
          false,
          `User ineligible due to prior trial grant (${grant.grantId}) associated with account.`,
        );
      }

      // Check billingCustomerId match
      if (
        currentSignals.billingCustomerId &&
        grant.identitySignals.billingCustomerId === currentSignals.billingCustomerId
      ) {
        return new TrialEligibility(
          false,
          `User ineligible due to prior trial grant (${grant.grantId}) associated with billing identity.`,
        );
      }

      // Check paymentMethodId match
      if (
        currentSignals.paymentMethodId &&
        grant.identitySignals.paymentMethodId === currentSignals.paymentMethodId
      ) {
        return new TrialEligibility(
          false,
          `User ineligible due to prior trial grant (${grant.grantId}) associated with payment identity.`,
        );
      }

      // Check verifiedEmail match (as a secondary check, but not the sole check)
      if (
        currentSignals.verifiedEmail &&
        grant.identitySignals.verifiedEmail === currentSignals.verifiedEmail
      ) {
        return new TrialEligibility(
          false,
          `User ineligible due to prior trial grant (${grant.grantId}) associated with verified email.`,
        );
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
  private readonly _grantId: string;
  private readonly _userId: string;
  private readonly _planId: string;
  private _status: TrialState;
  private readonly _trialStartedAt: Date;
  private readonly _trialEndsAt: Date;
  private readonly _identitySignals: TrialIdentitySignals;

  constructor(properties: TrialGrantProperties) {
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

  get grantId(): string {
    return this._grantId;
  }

  get userId(): string {
    return this._userId;
  }

  get planId(): string {
    return this._planId;
  }

  get status(): TrialState {
    return this._status;
  }

  get trialStartedAt(): Date {
    return new Date(this._trialStartedAt.getTime());
  }

  get trialEndsAt(): Date {
    return new Date(this._trialEndsAt.getTime());
  }

  get identitySignals(): TrialIdentitySignals {
    return { ...this._identitySignals };
  }

  /**
   * Updates the state of the trial grant, validating transitions.
   */
  public transitionTo(newStatus: TrialState) {
    if (
      this._status === "CONVERTED" ||
      this._status === "CANCELLED" ||
      this._status === "EXPIRED"
    ) {
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
  public getStatusAt(currentTime: Date): TrialState {
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
 * Persistence contract for managing and checking trial grant uniqueness.
 */
export interface TrialGrantPersistenceContract {
  save(grant: TrialGrant): Promise<void>;
  findById(grantId: string): Promise<TrialGrant | null>;
  findByUserId(userId: string): Promise<TrialGrant[]>;
  findBySignal(signalType: keyof TrialIdentitySignals, value: string): Promise<TrialGrant[]>;
}

/**
 * In-memory implementation of TrialGrantPersistenceContract for unit tests.
 */
export class InMemoryTrialGrantPersistence implements TrialGrantPersistenceContract {
  private readonly _grants = new Map<string, TrialGrant>();

  public async save(grant: TrialGrant): Promise<void> {
    this._grants.set(grant.grantId, grant);
  }

  public async findById(grantId: string): Promise<TrialGrant | null> {
    return this._grants.get(grantId) || null;
  }

  public async findByUserId(userId: string): Promise<TrialGrant[]> {
    return Array.from(this._grants.values()).filter((g) => g.userId === userId);
  }

  public async findBySignal(
    signalType: keyof TrialIdentitySignals,
    value: string,
  ): Promise<TrialGrant[]> {
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
  private readonly _persistence: TrialGrantPersistenceContract;

  constructor(persistence: TrialGrantPersistenceContract) {
    this._persistence = persistence;
  }

  /**
   * Evaluates eligibility and issues a trial grant.
   * Enforces that duplicate grants are rejected and start/end dates are immutable.
   */
  public async issueTrialGrant(properties: {
    grantId: string;
    userId: string;
    planId: string;
    trialStartedAt: Date;
    identitySignals: TrialIdentitySignals;
  }): Promise<TrialGrant> {
    // 1. Check duplicate grant ID
    const existingById = await this._persistence.findById(properties.grantId);
    if (existingById) {
      throw new Error(
        `Duplicate grant creation rejected. Trial grant with ID ${properties.grantId} already exists.`,
      );
    }

    // 2. Fetch historical grants for the user/signals to check eligibility
    const historicalGrants: TrialGrant[] = [];

    const userGrants = await this._persistence.findByUserId(properties.userId);
    historicalGrants.push(...userGrants);

    if (properties.identitySignals.verifiedEmail) {
      const emailGrants = await this._persistence.findBySignal(
        "verifiedEmail",
        properties.identitySignals.verifiedEmail,
      );
      historicalGrants.push(...emailGrants);
    }
    if (properties.identitySignals.billingCustomerId) {
      const billingGrants = await this._persistence.findBySignal(
        "billingCustomerId",
        properties.identitySignals.billingCustomerId,
      );
      historicalGrants.push(...billingGrants);
    }
    if (properties.identitySignals.paymentMethodId) {
      const paymentGrants = await this._persistence.findBySignal(
        "paymentMethodId",
        properties.identitySignals.paymentMethodId,
      );
      historicalGrants.push(...paymentGrants);
    }

    // De-duplicate historicalGrants by grantId
    const uniqueHistoricalGrants = Array.from(
      new Map(historicalGrants.map((g) => [g.grantId, g])).values(),
    );

    // 3. Evaluate eligibility
    const eligibility = TrialEligibility.evaluate(
      properties.identitySignals,
      uniqueHistoricalGrants,
    );
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
