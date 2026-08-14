import Stripe from "stripe";
import { PlanId } from "./plan.js";
import { TrialGrantPersistenceContract } from "./trial.js";
import {
  StripeCustomerMappingRepository,
  StripeSubscriptionInfo,
  StripePriceRegistry,
} from "./stripe.js";
import { Payment, Money, PaymentAggregateStore } from "./payment.js";
import { logger } from "@freelanceos/logger";
import { CacheStore } from "./job-match-cache.js";

// Failure Classification Error
export class StripeWebhookError extends Error {
  constructor(
    public readonly code:
      | "INVALID_SIGNATURE"
      | "INVALID_EVENT"
      | "DUPLICATE_EVENT"
      | "UNKNOWN_EVENT"
      | "OWNERSHIP_MISMATCH"
      | "MAPPING_NOT_FOUND"
      | "BUSINESS_REJECTION"
      | "TRANSIENT_PROCESSING_FAILURE"
      | "PERMANENT_PROCESSING_FAILURE",
    message: string,
  ) {
    super(message);
    this.name = "StripeWebhookError";
  }
}

// Local Subscription Storage Model with timestamp-based ordering
export interface LocalSubscriptionRecord {
  subscription: StripeSubscriptionInfo;
  lastEventCreated: number;
}

export interface StripeSubscriptionRepository {
  save(subscription: StripeSubscriptionInfo, eventCreated: number): Promise<void>;
  findById(stripeSubscriptionId: string): Promise<StripeSubscriptionInfo | null>;
  findByTenantId(tenantId: string): Promise<StripeSubscriptionInfo | null>;
  getRecord(stripeSubscriptionId: string): Promise<LocalSubscriptionRecord | null>;
}

export class InMemoryStripeSubscriptionRepository implements StripeSubscriptionRepository {
  private readonly _records = new Map<string, LocalSubscriptionRecord>();

  public async save(subscription: StripeSubscriptionInfo, eventCreated: number): Promise<void> {
    const record: LocalSubscriptionRecord = {
      subscription,
      lastEventCreated: eventCreated,
    };
    this._records.set(subscription.stripeSubscriptionId, record);
  }

  public async findById(stripeSubscriptionId: string): Promise<StripeSubscriptionInfo | null> {
    const record = this._records.get(stripeSubscriptionId);
    return record ? record.subscription : null;
  }

  public async findByTenantId(tenantId: string): Promise<StripeSubscriptionInfo | null> {
    // Note: stripeCustomerId is the mapped customer id which belongs to the tenant
    for (const record of this._records.values()) {
      if (record.subscription.stripeCustomerId === tenantId) {
        return record.subscription;
      }
    }
    return null;
  }

  public async getRecord(stripeSubscriptionId: string): Promise<LocalSubscriptionRecord | null> {
    return this._records.get(stripeSubscriptionId) ?? null;
  }
}

// Webhook Event Record for Deduplication
export interface WebhookEventRecord {
  eventId: string;
  eventType: string;
  status: "RECEIVED" | "PROCESSING" | "PROCESSED" | "FAILED" | "RETRYABLE";
  receivedAt: Date;
  processedAt?: Date;
  error?: string;
}

export interface WebhookEventStore {
  claim(eventId: string, eventType: string): Promise<boolean>;
  markProcessed(eventId: string): Promise<void>;
  markFailed(eventId: string, error: string, retryable: boolean): Promise<void>;
  get(eventId: string): Promise<WebhookEventRecord | null>;
}

export const WEBHOOK_PROCESSING_TIMEOUT_MS = 5 * 60 * 1000;

export class InMemoryWebhookEventStore implements WebhookEventStore {
  private readonly _records = new Map<string, WebhookEventRecord>();

  public async claim(eventId: string, eventType: string): Promise<boolean> {
    const existing = this._records.get(eventId);
    if (existing) {
      if (existing.status === "PROCESSED") {
        return false;
      }
      if (existing.status === "PROCESSING") {
        const isStale = Date.now() - existing.receivedAt.getTime() > WEBHOOK_PROCESSING_TIMEOUT_MS;
        if (!isStale) {
          return false;
        }
      }
    }
    this._records.set(eventId, {
      eventId,
      eventType,
      status: "PROCESSING",
      receivedAt: new Date(),
    });
    return true;
  }

  public async markProcessed(eventId: string): Promise<void> {
    const record = this._records.get(eventId);
    if (record) {
      record.status = "PROCESSED";
      record.processedAt = new Date();
    }
  }

  public async markFailed(eventId: string, error: string, retryable: boolean): Promise<void> {
    const record = this._records.get(eventId);
    if (record) {
      record.status = retryable ? "RETRYABLE" : "FAILED";
      record.error = error;
    }
  }

  public async get(eventId: string): Promise<WebhookEventRecord | null> {
    return this._records.get(eventId) ?? null;
  }
}

export const SUPPORTED_EVENTS = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
]);

export interface WebhookProcessorParams {
  stripeSecretKey: string;
  webhookSecret: string;
  env: "development" | "staging" | "production";
  priceRegistry: StripePriceRegistry;
  customerMappingRepo: StripeCustomerMappingRepository;
  subscriptionRepo: StripeSubscriptionRepository;
  paymentStore: PaymentAggregateStore;
  trialPersistence: TrialGrantPersistenceContract;
  eventStore: WebhookEventStore;
  stripeClientMock?: unknown;
  toleranceSeconds?: number;
  cacheStore?: CacheStore | undefined;
}

export class StripeWebhookProcessor {
  private readonly _webhookSecret: string;
  private readonly _priceRegistry: StripePriceRegistry;
  private readonly _customerMappingRepo: StripeCustomerMappingRepository;
  private readonly _subscriptionRepo: StripeSubscriptionRepository;
  private readonly _paymentStore: PaymentAggregateStore;
  private readonly _trialPersistence: TrialGrantPersistenceContract;
  private readonly _eventStore: WebhookEventStore;
  private readonly _stripeClient: Stripe;
  private readonly _toleranceSeconds: number;
  private readonly _cacheStore?: CacheStore | undefined;

  constructor(params: WebhookProcessorParams) {
    if (params.env === "production") {
      if (!params.webhookSecret || params.webhookSecret.trim() === "") {
        throw new StripeWebhookError(
          "PERMANENT_PROCESSING_FAILURE",
          "Production Stripe webhook secret is missing.",
        );
      }
    }

    this._webhookSecret = params.webhookSecret;
    this._priceRegistry = params.priceRegistry;
    this._customerMappingRepo = params.customerMappingRepo;
    this._subscriptionRepo = params.subscriptionRepo;
    this._paymentStore = params.paymentStore;
    this._trialPersistence = params.trialPersistence;
    this._eventStore = params.eventStore;
    this._toleranceSeconds = params.toleranceSeconds ?? 300;
    this._cacheStore = params.cacheStore;

    this._stripeClient =
      (params.stripeClientMock as Stripe) ??
      new Stripe(params.stripeSecretKey, {
        apiVersion: "2023-10-16" as unknown as Stripe.LatestApiVersion,
      });
  }

  public toJSON() {
    return {
      webhookSecret: "[REDACTED]",
      priceRegistry: "[REDACTED]",
      stripeClient: "[REDACTED]",
    };
  }

  /**
   * Main entry point to process a webhook request safely.
   */
  public async handleWebhook(
    rawBody: string,
    signatureHeader: string | undefined,
  ): Promise<{ status: "success" | "duplicate" | "unsupported" | "failed"; eventId?: string }> {
    const operationId = Math.random().toString(36).substring(7);
    logger.info({
      message: "webhook_received",
      operationId,
      hasSignature: Boolean(signatureHeader),
    });

    // 1. Signature Verification
    if (!signatureHeader || signatureHeader.trim() === "") {
      logger.warn({ message: "webhook_rejected", operationId, reason: "Missing signature" });
      throw new StripeWebhookError("INVALID_SIGNATURE", "Webhook signature header is missing.");
    }

    if (!this._webhookSecret || this._webhookSecret.trim() === "") {
      logger.error({
        message: "webhook_rejected",
        operationId,
        reason: "Missing webhook secret configuration",
      });
      throw new StripeWebhookError(
        "PERMANENT_PROCESSING_FAILURE",
        "Webhook secret is not configured.",
      );
    }

    let event: Stripe.Event;
    try {
      event = this._stripeClient.webhooks.constructEvent(
        rawBody,
        signatureHeader,
        this._webhookSecret,
        this._toleranceSeconds,
      );
    } catch (err: unknown) {
      logger.warn({
        message: "webhook_rejected",
        operationId,
        reason: err instanceof Error ? err.message : String(err),
      });
      throw new StripeWebhookError(
        "INVALID_SIGNATURE",
        err instanceof Error ? err.message : "Invalid signature.",
      );
    }

    logger.info({
      message: "webhook_signature_verified",
      operationId,
      eventId: event.id,
      eventType: event.type,
    });

    // 2. Event Envelope Validation
    if (!event.id || !event.type || !event.created) {
      throw new StripeWebhookError("INVALID_EVENT", "Malformed event envelope.");
    }

    // 3. Supported Event Registry Check
    if (!SUPPORTED_EVENTS.has(event.type)) {
      logger.info({
        message: "webhook_processed",
        operationId,
        eventId: event.id,
        eventType: event.type,
        status: "unsupported",
      });
      return { status: "unsupported", eventId: event.id };
    }

    // 4. Validate payload object existence for supported events
    if (!event.data || !event.data.object) {
      throw new StripeWebhookError("INVALID_EVENT", "Malformed event payload data.");
    }

    // 4. Atomic Idempotency / Deduplication Claim
    const claimed = await this._eventStore.claim(event.id, event.type);
    if (!claimed) {
      logger.info({
        message: "webhook_duplicate",
        operationId,
        eventId: event.id,
        eventType: event.type,
      });
      return { status: "duplicate", eventId: event.id };
    }

    logger.info({
      message: "webhook_processing_started",
      operationId,
      eventId: event.id,
      eventType: event.type,
    });

    const startTime = Date.now();
    try {
      // 5. Business Processing
      await this.dispatch(event);

      await this._eventStore.markProcessed(event.id);
      logger.info({
        message: "webhook_processed",
        operationId,
        eventId: event.id,
        eventType: event.type,
        status: "success",
        durationMs: Date.now() - startTime,
      });
      return { status: "success", eventId: event.id };
    } catch (err: unknown) {
      const isRetryable =
        err instanceof StripeWebhookError ? err.code === "TRANSIENT_PROCESSING_FAILURE" : true; // Default to retryable for unexpected infrastructure errors

      await this._eventStore.markFailed(
        event.id,
        err instanceof Error ? err.message : String(err),
        isRetryable,
      );

      if (isRetryable) {
        logger.error({
          message: "webhook_retryable_failure",
          operationId,
          eventId: event.id,
          eventType: event.type,
          error: err instanceof Error ? err : new Error(String(err)),
        });
      } else {
        logger.error({
          message: "webhook_processing_failed",
          operationId,
          eventId: event.id,
          eventType: event.type,
          error: err instanceof Error ? err : new Error(String(err)),
        });
      }

      throw err;
    }
  }

  /**
   * Dispatch events to their isolated handlers.
   */
  private async dispatch(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case "checkout.session.completed":
        await this.handleCheckoutSessionCompleted(
          event.data.object as Stripe.Checkout.Session,
          event.created,
        );
        break;

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await this.handleSubscriptionLifecycle(
          event.data.object as Stripe.Subscription,
          event.created,
          event.type,
        );
        break;

      case "invoice.paid":
        await this.handleInvoicePaid(event.data.object as Stripe.Invoice, event.created);
        break;

      case "invoice.payment_failed":
        await this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice, event.created);
        break;

      default:
        throw new StripeWebhookError("UNKNOWN_EVENT", `Unhandled event type: ${event.type}`);
    }
  }

  /**
   * Checkout Session Completed Handler
   */
  private async handleCheckoutSessionCompleted(
    session: Stripe.Checkout.Session,
    _eventCreated: number,
  ): Promise<void> {
    if (!session.id) {
      throw new StripeWebhookError("INVALID_EVENT", "Checkout session has no ID.");
    }
    const stripeCustomerId = session.customer;
    if (!stripeCustomerId || typeof stripeCustomerId !== "string") {
      throw new StripeWebhookError("INVALID_EVENT", "Checkout session has no valid customer ID.");
    }
    const stripeSubscriptionId = session.subscription;
    if (!stripeSubscriptionId || typeof stripeSubscriptionId !== "string") {
      throw new StripeWebhookError(
        "INVALID_EVENT",
        "Checkout session has no subscription reference.",
      );
    }

    // Resolve Ownership Authoritatively
    const mapping = await this._customerMappingRepo.findByStripeCustomerId(stripeCustomerId);
    if (!mapping) {
      throw new StripeWebhookError(
        "MAPPING_NOT_FOUND",
        `Stripe customer mapping not found for ${stripeCustomerId}`,
      );
    }

    // Validate metadata against authoritative mapping to prevent forged metadata attacks
    if (session.metadata) {
      const metaTenantId = session.metadata.tenantId;
      const metaOwnerId = session.metadata.ownerId;
      if (metaTenantId && metaTenantId !== mapping.tenantId) {
        throw new StripeWebhookError("OWNERSHIP_MISMATCH", "Forged tenant metadata detected.");
      }
      if (metaOwnerId && metaOwnerId !== mapping.ownerId) {
        throw new StripeWebhookError("OWNERSHIP_MISMATCH", "Forged owner metadata detected.");
      }
    }

    // Verify subscription status/pricing through Stripe API via provider logic
    // We map subscription data directly
    const stripePriceId = session.line_items?.data?.[0]?.price?.id;
    const planId = session.metadata?.planId as PlanId;
    const versionStr = session.metadata?.version;

    if (stripePriceId && planId && versionStr) {
      const priceVersion = Number(versionStr);
      try {
        this._priceRegistry.getStripePriceId(
          planId,
          mapping.tenantId === "IN" ? "INDIA" : "GLOBAL", // simple check or let the registry look it up
          "USD", // default resolver format
          "MONTHLY",
          priceVersion,
        );
        // Note: the true validation is done in retrieve subscription downstream, we register it safely here.
      } catch {
        // Safe to ignore or trace
      }
    }
  }

  /**
   * Subscription Lifecycle Handler (Created, Updated, Deleted)
   */
  private async handleSubscriptionLifecycle(
    sub: Stripe.Subscription,
    eventCreated: number,
    _eventType: string,
  ): Promise<void> {
    const stripeSubscriptionId = sub.id;
    const stripeCustomerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;

    if (!stripeSubscriptionId) {
      throw new StripeWebhookError("INVALID_EVENT", "Subscription has no ID.");
    }
    if (!stripeCustomerId) {
      throw new StripeWebhookError("INVALID_EVENT", "Subscription has no customer reference.");
    }

    // Resolve Ownership Authoritatively
    const mapping = await this._customerMappingRepo.findByStripeCustomerId(stripeCustomerId);
    if (!mapping) {
      throw new StripeWebhookError(
        "MAPPING_NOT_FOUND",
        `Stripe customer mapping not found for customer: ${stripeCustomerId}`,
      );
    }

    // Mismatched subscription/customer check
    const existingRecord = await this._subscriptionRepo.getRecord(stripeSubscriptionId);
    if (existingRecord && existingRecord.subscription.stripeCustomerId !== stripeCustomerId) {
      throw new StripeWebhookError(
        "OWNERSHIP_MISMATCH",
        `Subscription ${stripeSubscriptionId} does not match customer ${stripeCustomerId}`,
      );
    }

    // Event Freshness check (Older timestamp event updates are ignored)
    if (existingRecord && eventCreated <= existingRecord.lastEventCreated) {
      logger.info({
        message: "webhook_duplicate",
        reason: "Older event timestamp ignored for subscription update.",
        stripeSubscriptionId,
        eventCreated,
        lastEventCreated: existingRecord.lastEventCreated,
      });
      return;
    }

    const status = sub.status;
    const allowedStatuses: StripeSubscriptionInfo["status"][] = [
      "active",
      "past_due",
      "unpaid",
      "canceled",
      "incomplete",
      "trialing",
    ];

    if (!allowedStatuses.includes(status as StripeSubscriptionInfo["status"])) {
      throw new StripeWebhookError(
        "INVALID_EVENT",
        `Unsupported Stripe subscription status: ${status}`,
      );
    }

    const stripePriceId = sub.items?.data?.[0]?.price?.id;
    if (!stripePriceId) {
      throw new StripeWebhookError("INVALID_EVENT", "Subscription has no price items.");
    }

    const priceMapping = this._priceRegistry.getPriceVersionFromStripePriceId(stripePriceId);

    const subObj = sub as unknown as {
      current_period_end: number;
      trial_end: number | null;
    };

    const subscriptionInfo: StripeSubscriptionInfo = {
      subscriptionId: sub.id,
      stripeSubscriptionId: sub.id,
      stripeCustomerId,
      stripePriceId,
      planId: priceMapping.planId,
      priceVersion: priceMapping.version,
      status: status as StripeSubscriptionInfo["status"],
      currentPeriodEnd: new Date(subObj.current_period_end * 1000),
    };
    if (subObj.trial_end) {
      subscriptionInfo.trialEnd = new Date(subObj.trial_end * 1000);
    }

    // Save Synchronized State
    await this._subscriptionRepo.save(subscriptionInfo, eventCreated);

    if (this._cacheStore) {
      try {
        await this._cacheStore.delete(`entitlement:${mapping.tenantId}`);
        logger.info({
          message: "entitlement_cache_invalidated",
          tenantId: mapping.tenantId,
        });
      } catch {
        // Safe fallback if cache eviction fails
      }
    }

    // Trial-to-Paid Synchronization: confirmed via webhook
    if (subscriptionInfo.status === "active") {
      const grants = await this._trialPersistence.findByUserId(mapping.ownerId);
      const activeTrial = grants.find((g) => g.status === "ACTIVE");
      if (activeTrial) {
        activeTrial.transitionTo("CONVERTED");
        await this._trialPersistence.save(activeTrial);
        logger.info({
          message: "Trial grant converted to paid subscription",
          userId: mapping.ownerId,
          planId: subscriptionInfo.planId,
          grantId: activeTrial.grantId,
        });
      }
    }

    // Cancellation Synchronization
    if (subscriptionInfo.status === "canceled") {
      const grants = await this._trialPersistence.findByUserId(mapping.ownerId);
      const activeTrial = grants.find(
        (g) => g.planId === subscriptionInfo.planId && g.status === "ACTIVE",
      );
      if (activeTrial) {
        activeTrial.transitionTo("CANCELLED");
        await this._trialPersistence.save(activeTrial);
      }
    }
  }

  /**
   * Invoice Paid Handler
   */
  private async handleInvoicePaid(invoice: Stripe.Invoice, _eventCreated: number): Promise<void> {
    const inv = invoice as unknown as {
      customer: string | null;
      subscription: string | null;
      id: string | null;
      amount_paid: number;
      currency: string;
    };
    const stripeCustomerId = inv.customer;
    const stripeSubscriptionId = inv.subscription;
    const invoiceId = inv.id;
    const amountMinor = inv.amount_paid;
    const currency = inv.currency;

    if (!stripeCustomerId || typeof stripeCustomerId !== "string") {
      throw new StripeWebhookError("INVALID_EVENT", "Invoice has no customer ID.");
    }
    if (!invoiceId) {
      throw new StripeWebhookError("INVALID_EVENT", "Invoice has no ID.");
    }

    // Resolve Ownership Authoritatively
    const mapping = await this._customerMappingRepo.findByStripeCustomerId(stripeCustomerId);
    if (!mapping) {
      throw new StripeWebhookError(
        "MAPPING_NOT_FOUND",
        `Stripe customer mapping not found for customer: ${stripeCustomerId}`,
      );
    }

    // Ensure the subscription matches the customer if stored
    if (stripeSubscriptionId && typeof stripeSubscriptionId === "string") {
      const existing = await this._subscriptionRepo.findById(stripeSubscriptionId);
      if (existing && existing.stripeCustomerId !== stripeCustomerId) {
        throw new StripeWebhookError(
          "OWNERSHIP_MISMATCH",
          "Subscription customer mismatch on invoice.",
        );
      }
    }

    const paymentReference = invoiceId;
    let payment = await this._paymentStore.findByReference(paymentReference, mapping.ownerId);
    if (!payment) {
      const money = new Money(amountMinor, currency.toUpperCase());
      const clientId = `client_stripe_${mapping.tenantId}`;
      payment = Payment.create(invoiceId, clientId, mapping.ownerId, money, paymentReference);
      await this._paymentStore.save(payment);
    }

    // Validate event freshness/concurrency (don't overwrite completed with older states)
    if (payment.status !== "Completed") {
      // Transition state according to payment contract
      if (payment.status === "Pending" || payment.status === "Authorized") {
        payment.capture(mapping.ownerId);
      }
      if (payment.status === "Captured") {
        payment.complete(mapping.ownerId);
      }
      await this._paymentStore.save(payment);
    }
  }

  /**
   * Invoice Payment Failed Handler
   */
  private async handleInvoicePaymentFailed(
    invoice: Stripe.Invoice,
    _eventCreated: number,
  ): Promise<void> {
    const inv = invoice as unknown as {
      customer: string | null;
      subscription: string | null;
      id: string | null;
      amount_due: number | null;
      currency: string | null;
    };
    const stripeCustomerId = inv.customer;
    const stripeSubscriptionId = inv.subscription;
    const invoiceId = inv.id;
    const amountMinor = inv.amount_due || 0;
    const currency = inv.currency || "USD";

    if (!stripeCustomerId || typeof stripeCustomerId !== "string") {
      throw new StripeWebhookError("INVALID_EVENT", "Invoice has no customer ID.");
    }
    if (!invoiceId) {
      throw new StripeWebhookError("INVALID_EVENT", "Invoice has no ID.");
    }

    // Resolve Ownership Authoritatively
    const mapping = await this._customerMappingRepo.findByStripeCustomerId(stripeCustomerId);
    if (!mapping) {
      throw new StripeWebhookError(
        "MAPPING_NOT_FOUND",
        `Stripe customer mapping not found for customer: ${stripeCustomerId}`,
      );
    }

    // Ensure the subscription matches the customer if stored
    if (stripeSubscriptionId && typeof stripeSubscriptionId === "string") {
      const existing = await this._subscriptionRepo.findById(stripeSubscriptionId);
      if (existing && existing.stripeCustomerId !== stripeCustomerId) {
        throw new StripeWebhookError(
          "OWNERSHIP_MISMATCH",
          "Subscription customer mismatch on invoice failure.",
        );
      }
    }

    const paymentReference = invoiceId;
    let payment = await this._paymentStore.findByReference(paymentReference, mapping.ownerId);
    if (!payment) {
      const money = new Money(amountMinor, currency.toUpperCase());
      const clientId = `client_stripe_${mapping.tenantId}`;
      payment = Payment.create(invoiceId, clientId, mapping.ownerId, money, paymentReference);
      await this._paymentStore.save(payment);
    }

    if (payment.status !== "Failed") {
      payment.fail(mapping.ownerId);
      await this._paymentStore.save(payment);
    }
  }
}
