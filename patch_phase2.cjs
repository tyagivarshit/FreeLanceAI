const fs = require('fs');

// 1. payment-repository.ts
let paymentRepo = fs.readFileSync('packages/db/src/repository/payment-repository.ts', 'utf8');
paymentRepo = paymentRepo.replace(
  `.where(eq(payments.id, payment.paymentId))`,
  `.where(and(eq(payments.id, payment.paymentId), eq(payments.tenantId, payment.tenantId)))`
);
fs.writeFileSync('packages/db/src/repository/payment-repository.ts', paymentRepo);

// 2. payment.ts
let paymentAggregate = fs.readFileSync('packages/core/src/payment.ts', 'utf8');
paymentAggregate = paymentAggregate.replace(
  `  private verifyOwnership(ownerId: string) {
    if (ownerId !== this._ownerId) {
      throw new Error("Ownership validation failed.");
    }
  }`,
  `  private verifyOwnership(ownerId: string, tenantId?: string) {
    if (ownerId !== this._ownerId) {
      throw new Error("Ownership validation failed.");
    }
    if (tenantId && tenantId !== this._tenantId) {
      throw new Error("Tenant boundary violation.");
    }
  }`
);
fs.writeFileSync('packages/core/src/payment.ts', paymentAggregate);

// 3. timeline-repository.ts
let timelineRepo = fs.readFileSync('packages/db/src/repository/timeline-repository.ts', 'utf8');
timelineRepo = timelineRepo.replace(
  `          set: {
            status: timeline.status,
            updatedAt: timeline.updatedAt,
          },
        });`,
  `          set: {
            status: timeline.status,
            updatedAt: timeline.updatedAt,
          },
          where: eq(clientTimelines.tenantId, timeline.tenantId)
        });`
);
fs.writeFileSync('packages/db/src/repository/timeline-repository.ts', timelineRepo);

// 4. timeline.ts
let timelineAggregate = fs.readFileSync('packages/core/src/timeline.ts', 'utf8');
timelineAggregate = timelineAggregate.replace(
  `  private verifyOwnership(tenantId: string) {
    if (tenantId !== this._tenantId) {
      throw new Error("Ownership validation failed.");
    }
  }`,
  `  private verifyOwnership(tenantId: string, actorId?: string) {
    if (tenantId !== this._tenantId) {
      throw new Error("Ownership validation failed.");
    }
    if (actorId && this._ownerId && actorId !== this._ownerId) {
      throw new Error("Ownership validation failed.");
    }
  }`
);
timelineAggregate = timelineAggregate.replace(
  `  public archive(tenantId: string, actorId: string) {
    this.verifyOwnership(tenantId);`,
  `  public archive(tenantId: string, actorId: string) {
    this.verifyOwnership(tenantId, actorId);`
);
timelineAggregate = timelineAggregate.replace(
  `  public reactivate(tenantId: string, _actorId: string) {
    this.verifyOwnership(tenantId);`,
  `  public reactivate(tenantId: string, _actorId: string) {
    this.verifyOwnership(tenantId, _actorId);`
);
timelineAggregate = timelineAggregate.replace(
  `  public appendEntry(
    tenantId: string,
    actorId: string,
    properties: {
      entryId: string;
      category: TimelineEventCategory;
      timestamp: Date;
      metadata: Record<string, unknown>;
      visibility: VisibilityClassification;
      eventRef?: string;
    },
  ) {
    this.verifyOwnership(tenantId);`,
  `  public appendEntry(
    tenantId: string,
    actorId: string,
    properties: {
      entryId: string;
      category: TimelineEventCategory;
      timestamp: Date;
      metadata: Record<string, unknown>;
      visibility: VisibilityClassification;
      eventRef?: string;
    },
  ) {
    this.verifyOwnership(tenantId, actorId);`
);
fs.writeFileSync('packages/core/src/timeline.ts', timelineAggregate);

// 5. client.ts
let clientAggregate = fs.readFileSync('packages/core/src/client.ts', 'utf8');
clientAggregate = clientAggregate.replace(
  `  public transitionTo(newStatus: ClientStatus, actorId: string) {
    if ((newStatus === "Archived" || newStatus === "Closed") && actorId !== this._ownerId) {
      throw new Error("Ownership validation failed.");
    }`,
  `  public transitionTo(newStatus: ClientStatus, actorId: string) {
    if (actorId !== this._ownerId) {
      throw new Error("Ownership validation failed.");
    }`
);
clientAggregate = clientAggregate.replace(
  `  public updateProfile(
    profile: ClientProfile,
    billingDetails?: Partial<BillingDetails> | undefined,
    primaryContact?: Partial<PrimaryContact> | undefined,
  ) {
    if (this._status === "Closed" || this._status === "Archived") {
      throw new Error(\`Cannot update profile in \${this._status} state.\`);
    }`,
  `  public updateProfile(
    actorId: string,
    profile: ClientProfile,
    billingDetails?: Partial<BillingDetails> | undefined,
    primaryContact?: Partial<PrimaryContact> | undefined,
  ) {
    if (actorId !== this._ownerId) {
      throw new Error("Ownership validation failed.");
    }
    if (this._status === "Closed" || this._status === "Archived") {
      throw new Error(\`Cannot update profile in \${this._status} state.\`);
    }`
);
fs.writeFileSync('packages/core/src/client.ts', clientAggregate);

console.log("Patched all phase 2 aggregates and repositories");
