/**
 * =====================================================================
 * Plan, Price Model & Regional pricing
 * =====================================================================
 */

export type PlanId = "STARTER" | "PRO" | "POWER_BIDDER";
export type PlanLifecycleState = "DRAFT" | "ACTIVE" | "DEPRECATED" | "RETIRED";
export type PricingRegion = "INDIA" | "NORTH_AMERICA" | "UK" | "EUROPE" | "GLOBAL";
export type BillingInterval = "MONTHLY";

export type PlanFeature =
  | "JOB_SCAN"
  | "AI_PROPOSAL"
  | "UPWORK"
  | "LINKEDIN"
  | "BASIC_MATCHING"
  | "ADVANCED_MATCHING"
  | "PRIORITY_WEIGHT_SCORING"
  | "FULL_MATCH_EXPLANATION"
  | "PRIORITY_AI_GENERATION"
  | "MULTI_WORKSPACE";

export type UsageLimitValue = { type: "UNLIMITED" } | { type: "LIMITED"; value: number };

export interface UsageLimits {
  jobScans: UsageLimitValue;
  aiProposals: UsageLimitValue;
  maxWorkspaces: UsageLimitValue;
}

export type PlanLimits = Partial<UsageLimits>;

export type UsagePeriodType = "CALENDAR_MONTH" | "BILLING_CYCLE" | "TRIAL_DURATION";

export interface UsagePeriod {
  type: UsagePeriodType;
  startedAt: Date;
  endsAt: Date;
}

export interface PlanPrice {
  priceId: string;
  region: PricingRegion;
  currency: string;
  amountMinor: number; // Integer minor units (e.g. cents/paise)
  interval: BillingInterval;
  version: number;
}

export interface PlanProperties {
  planId: PlanId;
  code: string;
  displayName: string;
  lifecycleState: PlanLifecycleState;
  prices: PlanPrice[];
  features: Set<PlanFeature> | ReadonlySet<PlanFeature>;
  limits: UsageLimits;
}

export interface PriceResolutionMetadata {
  evaluatedCountry: string;
  clientCountry: string | undefined;
  clientCurrency: string | undefined;
  resolvedRegion: PricingRegion;
  resolvedCurrency: string;
  resolvedAmountMinor: number;
  isMismatch: boolean; // True if client-provided country/currency does not match resolved canonical country/currency
  validationRequired: boolean; // True if client tried to specify a mismatch or custom pricing that requires downstream Stripe verification
}

export const EU_COUNTRIES = new Set<string>([
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
]);

/**
 * Calculates calendar month period (start of UTC month to start of next UTC month).
 */
export function calculateCalendarMonthPeriod(from: Date): UsagePeriod {
  const startedAt = new Date(from.getTime());
  startedAt.setUTCHours(0, 0, 0, 0);
  startedAt.setUTCDate(1);
  const endsAt = new Date(startedAt.getTime());
  endsAt.setUTCMonth(endsAt.getUTCMonth() + 1);
  return {
    type: "CALENDAR_MONTH",
    startedAt,
    endsAt,
  };
}

/**
 * Calculates trial period based on start and end dates.
 */
export function calculateTrialPeriod(startedAt: Date, endsAt: Date): UsagePeriod {
  return {
    type: "TRIAL_DURATION",
    startedAt: new Date(startedAt.getTime()),
    endsAt: new Date(endsAt.getTime()),
  };
}

/**
 * Validates compatibility between a currency and a pricing region.
 */
export function validateCurrencyRegionCompatibility(currency: string, region: PricingRegion): void {
  const canonical = currency.trim().toUpperCase();
  if (region === "INDIA" && canonical !== "INR") {
    throw new Error(`Currency ${canonical} is incompatible with region INDIA. INDIA requires INR.`);
  }
  if (region === "NORTH_AMERICA" && canonical !== "USD") {
    throw new Error(
      `Currency ${canonical} is incompatible with region NORTH_AMERICA. NORTH_AMERICA requires USD.`,
    );
  }
  if (region === "UK" && canonical !== "GBP") {
    throw new Error(`Currency ${canonical} is incompatible with region UK. UK requires GBP.`);
  }
  if (region === "EUROPE" && canonical !== "EUR") {
    throw new Error(
      `Currency ${canonical} is incompatible with region EUROPE. EUROPE requires EUR.`,
    );
  }
  if (region === "GLOBAL" && canonical !== "USD") {
    throw new Error(
      `Currency ${canonical} is incompatible with region GLOBAL. GLOBAL requires USD.`,
    );
  }
}

/**
 * Validates a plan price model.
 */
export function validatePlanPrice(price: PlanPrice): void {
  if (price.amountMinor < 0) {
    throw new Error("Price amountMinor must be non-negative.");
  }
  if (!Number.isInteger(price.amountMinor)) {
    throw new Error("Price amountMinor must be an integer.");
  }
  if (price.interval !== "MONTHLY") {
    throw new Error(
      `Unsupported billing interval: ${price.interval}. Only MONTHLY is supported in 10A.`,
    );
  }
  const canonicalCurrency = price.currency.trim().toUpperCase();
  const allowedCurrencies = ["INR", "USD", "GBP", "EUR"];
  if (!allowedCurrencies.includes(canonicalCurrency)) {
    throw new Error(`Unsupported currency: ${price.currency}. Must be one of: INR, USD, GBP, EUR.`);
  }
  validateCurrencyRegionCompatibility(canonicalCurrency, price.region);
}

export class PricingRegionResolver {
  /**
   * Translates country codes into central pricing regions and their canonical currencies.
   * Ensures that region determination is centralized.
   */
  public static resolveRegionAndCurrency(countryCode?: string): {
    region: PricingRegion;
    currency: string;
    normalizedCountry: string;
  } {
    if (!countryCode || typeof countryCode !== "string") {
      return { region: "GLOBAL", currency: "USD", normalizedCountry: "UNKNOWN" };
    }

    const trimmed = countryCode.trim().toUpperCase();

    // Check code format (must be ISO-3166-1 alpha-2, i.e., 2 alphabetical characters)
    if (!/^[A-Z]{2}$/.test(trimmed)) {
      return { region: "GLOBAL", currency: "USD", normalizedCountry: trimmed };
    }

    if (trimmed === "IN") {
      return { region: "INDIA", currency: "INR", normalizedCountry: trimmed };
    }

    if (trimmed === "US" || trimmed === "CA") {
      return { region: "NORTH_AMERICA", currency: "USD", normalizedCountry: trimmed };
    }

    if (trimmed === "GB") {
      return { region: "UK", currency: "GBP", normalizedCountry: trimmed };
    }

    if (EU_COUNTRIES.has(trimmed)) {
      return { region: "EUROPE", currency: "EUR", normalizedCountry: trimmed };
    }

    return { region: "GLOBAL", currency: "USD", normalizedCountry: trimmed };
  }
}

const ALLOWED_TRANSITIONS: Record<PlanLifecycleState, PlanLifecycleState[]> = {
  DRAFT: ["ACTIVE", "RETIRED"],
  ACTIVE: ["DEPRECATED", "RETIRED"],
  DEPRECATED: ["RETIRED"],
  RETIRED: [],
};

export class Plan {
  private readonly _planId: PlanId;
  private readonly _code: string;
  private _displayName: string;
  private _lifecycleState: PlanLifecycleState;
  private readonly _prices: PlanPrice[];
  private readonly _features: Set<PlanFeature>;
  private readonly _limits: UsageLimits;

  constructor(properties: PlanProperties) {
    if (!properties.planId) {
      throw new Error("Plan ID is required.");
    }
    if (!properties.code || properties.code.trim() === "") {
      throw new Error("Plan code is required.");
    }
    if (!properties.displayName || properties.displayName.trim() === "") {
      throw new Error("Display name is required.");
    }
    if (!properties.lifecycleState) {
      throw new Error("Lifecycle state is required.");
    }
    if (!properties.prices || properties.prices.length === 0) {
      throw new Error("Prices are required.");
    }

    this._planId = properties.planId;
    this._code = properties.code.trim();
    this._displayName = properties.displayName.trim();
    this._lifecycleState = properties.lifecycleState;
    const featuresSet = new Set(properties.features);
    featuresSet.add = () => {
      throw new Error("Cannot mutate read-only set");
    };
    featuresSet.clear = () => {
      throw new Error("Cannot mutate read-only set");
    };
    featuresSet.delete = () => {
      throw new Error("Cannot mutate read-only set");
    };
    Object.freeze(featuresSet);
    this._features = featuresSet;
    this._limits = { ...properties.limits };

    // Validate prices and ensure they are frozen (locking historical price values)
    const priceKeys = new Set<string>();
    this._prices = properties.prices.map((p) => {
      validatePlanPrice(p);
      const key = `${p.region}_${p.interval}_${p.version}`;
      if (priceKeys.has(key)) {
        throw new Error(
          `Duplicate price version rejected: multiple prices for region ${p.region}, interval ${p.interval}, and version ${p.version}.`,
        );
      }
      priceKeys.add(key);
      const frozenPrice = { ...p };
      Object.freeze(frozenPrice);
      return frozenPrice;
    });

    // Enforce fallback GLOBAL region pricing is always defined at version 1
    const hasGlobal = this._prices.some((p) => p.region === "GLOBAL");
    if (!hasGlobal) {
      throw new Error("A fallback GLOBAL pricing region must be provided for every plan.");
    }

    Object.freeze(this._prices);
    Object.freeze(this._limits);
  }

  get planId(): PlanId {
    return this._planId;
  }

  get code(): string {
    return this._code;
  }

  get displayName(): string {
    return this._displayName;
  }

  get lifecycleState(): PlanLifecycleState {
    return this._lifecycleState;
  }

  get prices(): ReadonlyArray<PlanPrice> {
    return this._prices;
  }

  get features(): ReadonlySet<PlanFeature> {
    return this._features;
  }

  get limits(): UsageLimits {
    return { ...this._limits };
  }

  /**
   * Retrieves a specific price version by priceId and version.
   */
  public getPriceByVersion(priceId: string, version: number): PlanPrice | undefined {
    return this._prices.find((p) => p.priceId === priceId && p.version === version);
  }

  /**
   * Finds the latest version of a price for a specific region and interval.
   */
  public getLatestPrice(region: PricingRegion, interval: BillingInterval): PlanPrice | undefined {
    const regionalPrices = this._prices.filter(
      (p) => p.region === region && p.interval === interval,
    );
    if (regionalPrices.length === 0) {
      return undefined;
    }
    // Sort descending by version
    regionalPrices.sort((a, b) => b.version - a.version);
    return regionalPrices[0];
  }

  /**
   * Checks if a specific feature is enabled on this plan.
   * Prevents "if (plan === 'PRO')" scattered checks.
   */
  public hasFeature(feature: PlanFeature): boolean {
    return this._features.has(feature);
  }

  /**
   * Returns a specific limit value from the plan.
   */
  public getLimit<K extends keyof UsageLimits>(key: K): UsageLimits[K] {
    return this._limits[key];
  }

  /**
   * Updates the display name (this does not affect the stable identifier planId).
   */
  public updateDisplayName(newName: string) {
    if (!newName || newName.trim() === "") {
      throw new Error("Display name cannot be empty.");
    }
    this._displayName = newName.trim();
  }

  /**
   * Validates and transitions the lifecycle state of the plan.
   */
  public transitionTo(targetState: PlanLifecycleState) {
    if (this._lifecycleState === targetState) {
      return; // No-op, same state
    }
    const allowed = ALLOWED_TRANSITIONS[this._lifecycleState];
    if (!allowed.includes(targetState)) {
      throw new Error(
        `Invalid plan lifecycle transition from ${this._lifecycleState} to ${targetState}.`,
      );
    }
    this._lifecycleState = targetState;
  }

  // Predefined Plan Creators
  public static createStarter(): Plan {
    return new Plan({
      planId: "STARTER",
      code: "starter_monthly",
      displayName: "Starter Plan",
      lifecycleState: "ACTIVE",
      features: new Set<PlanFeature>([
        "JOB_SCAN",
        "AI_PROPOSAL",
        "UPWORK",
        "LINKEDIN",
        "BASIC_MATCHING",
      ]),
      limits: {
        jobScans: { type: "LIMITED", value: 5 },
        aiProposals: { type: "LIMITED", value: 3 },
        maxWorkspaces: { type: "LIMITED", value: 1 },
      },
      prices: [
        {
          priceId: "starter-global",
          region: "GLOBAL",
          currency: "USD",
          amountMinor: 0,
          interval: "MONTHLY",
          version: 1,
        },
        {
          priceId: "starter-india",
          region: "INDIA",
          currency: "INR",
          amountMinor: 0,
          interval: "MONTHLY",
          version: 1,
        },
        {
          priceId: "starter-na",
          region: "NORTH_AMERICA",
          currency: "USD",
          amountMinor: 0,
          interval: "MONTHLY",
          version: 1,
        },
        {
          priceId: "starter-uk",
          region: "UK",
          currency: "GBP",
          amountMinor: 0,
          interval: "MONTHLY",
          version: 1,
        },
        {
          priceId: "starter-eu",
          region: "EUROPE",
          currency: "EUR",
          amountMinor: 0,
          interval: "MONTHLY",
          version: 1,
        },
      ],
    });
  }

  public static createPro(
    version: number = 1,
    amountUSDMinor = 1499,
    amountINRMinor = 79900,
  ): Plan {
    return new Plan({
      planId: "PRO",
      code: `pro_monthly_v${version}`,
      displayName: "Pro Plan",
      lifecycleState: "ACTIVE",
      features: new Set<PlanFeature>([
        "JOB_SCAN",
        "AI_PROPOSAL",
        "UPWORK",
        "LINKEDIN",
        "BASIC_MATCHING",
        "ADVANCED_MATCHING",
        "PRIORITY_WEIGHT_SCORING",
        "FULL_MATCH_EXPLANATION",
      ]),
      limits: {
        jobScans: { type: "UNLIMITED" },
        aiProposals: { type: "LIMITED", value: 50 },
        maxWorkspaces: { type: "LIMITED", value: 1 },
      },
      prices: [
        {
          priceId: "pro-global",
          region: "GLOBAL",
          currency: "USD",
          amountMinor: amountUSDMinor,
          interval: "MONTHLY",
          version,
        },
        {
          priceId: "pro-india",
          region: "INDIA",
          currency: "INR",
          amountMinor: amountINRMinor,
          interval: "MONTHLY",
          version,
        },
        {
          priceId: "pro-na",
          region: "NORTH_AMERICA",
          currency: "USD",
          amountMinor: amountUSDMinor,
          interval: "MONTHLY",
          version,
        },
        {
          priceId: "pro-uk",
          region: "UK",
          currency: "GBP",
          amountMinor: 1200,
          interval: "MONTHLY",
          version,
        },
        {
          priceId: "pro-eu",
          region: "EUROPE",
          currency: "EUR",
          amountMinor: 1400,
          interval: "MONTHLY",
          version,
        },
      ],
    });
  }

  public static createPowerBidder(
    version: number = 1,
    amountUSDMinor = 3999,
    amountINRMinor = 299900,
  ): Plan {
    return new Plan({
      planId: "POWER_BIDDER",
      code: `power_bidder_monthly_v${version}`,
      displayName: "Power Bidder Plan",
      lifecycleState: "ACTIVE",
      features: new Set<PlanFeature>([
        "JOB_SCAN",
        "AI_PROPOSAL",
        "UPWORK",
        "LINKEDIN",
        "BASIC_MATCHING",
        "ADVANCED_MATCHING",
        "PRIORITY_WEIGHT_SCORING",
        "FULL_MATCH_EXPLANATION",
        "PRIORITY_AI_GENERATION",
        "MULTI_WORKSPACE",
      ]),
      limits: {
        jobScans: { type: "UNLIMITED" },
        aiProposals: { type: "LIMITED", value: 200 },
        maxWorkspaces: { type: "UNLIMITED" },
      },
      prices: [
        {
          priceId: "pb-global",
          region: "GLOBAL",
          currency: "USD",
          amountMinor: amountUSDMinor,
          interval: "MONTHLY",
          version,
        },
        {
          priceId: "pb-india",
          region: "INDIA",
          currency: "INR",
          amountMinor: amountINRMinor,
          interval: "MONTHLY",
          version,
        },
        {
          priceId: "pb-na",
          region: "NORTH_AMERICA",
          currency: "USD",
          amountMinor: amountUSDMinor,
          interval: "MONTHLY",
          version,
        },
        {
          priceId: "pb-uk",
          region: "UK",
          currency: "GBP",
          amountMinor: 3200,
          interval: "MONTHLY",
          version,
        },
        {
          priceId: "pb-eu",
          region: "EUROPE",
          currency: "EUR",
          amountMinor: 3600,
          interval: "MONTHLY",
          version,
        },
      ],
    });
  }
}

export class PlanCatalog {
  private readonly _plans = new Map<PlanId, Plan>();

  constructor(plans: Plan[]) {
    for (const plan of plans) {
      this._plans.set(plan.planId, plan);
    }
  }

  public getPlan(planId: PlanId): Plan | undefined {
    return this._plans.get(planId);
  }

  /**
   * Validates plan eligibility for a new selection.
   */
  public validateForNewSelection(planId: PlanId): void {
    const plan = this._plans.get(planId);
    if (!plan) {
      throw new Error(`Plan with ID ${planId} not found in catalog.`);
    }
    if (plan.lifecycleState !== "ACTIVE") {
      throw new Error(
        `Plan ${planId} is in ${plan.lifecycleState} state and cannot be selected for a new subscription.`,
      );
    }
  }

  /**
   * Validates plan eligibility for an existing subscription.
   */
  public validateForExistingSubscription(planId: PlanId): void {
    const plan = this._plans.get(planId);
    if (!plan) {
      throw new Error(`Plan with ID ${planId} not found in catalog.`);
    }
    if (plan.lifecycleState === "RETIRED") {
      throw new Error(
        `Plan ${planId} is RETIRED and cannot remain active for existing subscriptions.`,
      );
    }
    if (plan.lifecycleState === "DRAFT") {
      throw new Error(`Plan ${planId} is in DRAFT state and is not valid for subscriptions.`);
    }
  }

  /**
   * Resolves the authoritative regional price for a plan, validating inputs and handling all edge cases.
   * Never lets the client dictate the price. Exposes validation metadata to prevent country pricing abuse.
   */
  public resolvePrice(
    planId: PlanId,
    clientCountry?: string,
    clientCurrency?: string,
  ): PriceResolutionMetadata {
    const plan = this._plans.get(planId);
    if (!plan) {
      throw new Error(`Plan with ID ${planId} not found in catalog.`);
    }

    // 1. Centralized country-to-region mapping
    const resolved = PricingRegionResolver.resolveRegionAndCurrency(clientCountry);
    const evaluatedCountry = resolved.normalizedCountry;
    let resolvedRegion = resolved.region;

    let regionalPrice = plan.getLatestPrice(resolvedRegion, "MONTHLY");

    // 2. Handle unavailable region fallback
    if (!regionalPrice) {
      resolvedRegion = "GLOBAL";
      regionalPrice = plan.getLatestPrice("GLOBAL", "MONTHLY");
      if (!regionalPrice) {
        throw new Error(
          `Critical: Plan ${planId} does not have a GLOBAL fallback price definition.`,
        );
      }
    }

    const resolvedCurrency = regionalPrice.currency;
    const resolvedAmountMinor = regionalPrice.amountMinor;

    // 3. Prevent Country Pricing Abuse & Handle Client Input
    // We check for mismatches against the canonical currency/country resolved on the server.
    // Client input is not authoritative.
    let isMismatch = false;
    let validationRequired = false;

    if (clientCurrency) {
      const normalizedClientCurrency = clientCurrency.trim().toUpperCase();
      if (normalizedClientCurrency !== resolvedCurrency) {
        isMismatch = true;
        validationRequired = true;
      }
    }

    // If client provided a country and it resolved to a different region than a basic geoip check,
    // or if a client tries to request IN/INR but their input does not match our canonical mapping:
    if (clientCountry) {
      const normalizedClientCountry = clientCountry.trim().toUpperCase();
      const clientResolved =
        PricingRegionResolver.resolveRegionAndCurrency(normalizedClientCountry);
      // Check if client-provided country mismatches the evaluated country
      if (normalizedClientCountry !== evaluatedCountry) {
        isMismatch = true;
        validationRequired = true;
      }
      // If client asks for a mismatch country/currency combo (e.g. US country with INR currency)
      if (clientCurrency) {
        const normalizedClientCurrency = clientCurrency.trim().toUpperCase();
        if (clientResolved.currency !== normalizedClientCurrency) {
          isMismatch = true;
          validationRequired = true;
        }
      }
    }

    // In 10A, we always require validation if the pricing resolved is localized (e.g., INDIA or EUROPE or UK)
    // rather than the standard GLOBAL price, to ensure billing layers verify country-eligibility downstream.
    if (resolvedRegion !== "GLOBAL") {
      validationRequired = true;
    }

    return {
      evaluatedCountry,
      clientCountry,
      clientCurrency,
      resolvedRegion,
      resolvedCurrency,
      resolvedAmountMinor,
      isMismatch,
      validationRequired,
    };
  }
}
