import { isValidEmailFormat } from "./validation.js";

// Abstract States
export type ClientStatus = "Lead" | "Active" | "Suspended" | "Archived" | "Closed";

// Globally Unique Immutable Identifier
export type ClientId = string;

// Value Objects
export interface ClientProfile {
  name: string;
  website?: string;
  phone?: string;
}

export interface BillingAddress {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string; // ISO 3166-1 alpha-2 (2 letters uppercase)
}

export interface BillingDetails {
  taxRegistrationId?: string;
  currency: string; // ISO 4217 (3 letters uppercase)
  billingAddress: BillingAddress;
}

export interface PrimaryContact {
  firstName: string;
  lastName: string;
  email: string;
}

export interface SystemMetadata {
  createdAt: Date;
  updatedAt: Date;
  archivedAt?: Date;
  closedAt?: Date;
  suspendedAt?: Date;
}

export interface ClientProperties {
  id: ClientId;
  ownerId: string;
  status: ClientStatus;
  profile: ClientProfile;
  billingDetails?: Partial<BillingDetails> | undefined;
  primaryContact?: Partial<PrimaryContact> | undefined;
  systemMetadata: SystemMetadata;
}

// Query Projections
export interface ClientQueryProjection {
  id: string;
  ownerId: string;
  name: string;
  email: string;
  status: string;
  updatedAt: Date;
}

// Logical Domain Events
export const CLIENT_CREATED = "CLIENT_CREATED";
export const CLIENT_UPDATED = "CLIENT_UPDATED";
export const CLIENT_ARCHIVED = "CLIENT_ARCHIVED";
export const CLIENT_REACTIVATED = "CLIENT_REACTIVATED";

export type ClientDomainEventName =
  | typeof CLIENT_CREATED
  | typeof CLIENT_UPDATED
  | typeof CLIENT_ARCHIVED
  | typeof CLIENT_REACTIVATED;

export interface EventPublisher {
  publish(event: ClientDomainEventName, metadata: Record<string, unknown>): Promise<void>;
}

// Domain Persistence Contract & Aggregate Store
export interface DomainPersistenceContract {
  checkUniqueTaxId(ownerId: string, taxId: string, excludeClientId?: ClientId): Promise<boolean>;
  checkUniqueEmail(ownerId: string, email: string, excludeClientId?: ClientId): Promise<boolean>;
}

export interface AggregateStore {
  save(client: Client): Promise<void>;
  findById(id: ClientId, ownerId: string): Promise<Client | null>;
}

// Client Aggregate Root
export class Client {
  private _id: ClientId;
  private _ownerId: string;
  private _status: ClientStatus;
  private _profile: ClientProfile;
  private _billingDetails: Partial<BillingDetails> | undefined;
  private _primaryContact: Partial<PrimaryContact> | undefined;
  private _systemMetadata: SystemMetadata;
  private _domainEvents: Array<{
    event: ClientDomainEventName;
    metadata: Record<string, unknown>;
  }> = [];

  constructor(properties: ClientProperties) {
    if (!properties.id || properties.id.trim() === "") {
      throw new Error("Client ID is required.");
    }
    if (!properties.ownerId || properties.ownerId.trim() === "") {
      throw new Error("Owner ID is required.");
    }

    this._id = properties.id;
    this._ownerId = properties.ownerId;
    this._status = properties.status;
    this._profile = properties.profile;
    this._billingDetails = properties.billingDetails;
    this._primaryContact = properties.primaryContact;
    this._systemMetadata = properties.systemMetadata;

    this.validateInvariants();
  }

  // Getters
  get id(): ClientId {
    return this._id;
  }

  get ownerId(): string {
    return this._ownerId;
  }

  get status(): ClientStatus {
    return this._status;
  }

  get profile(): ClientProfile {
    return this._profile;
  }

  get billingDetails(): Partial<BillingDetails> | undefined {
    return this._billingDetails;
  }

  get primaryContact(): Partial<PrimaryContact> | undefined {
    return this._primaryContact;
  }

  get systemMetadata(): SystemMetadata {
    return this._systemMetadata;
  }

  get domainEvents() {
    return this._domainEvents;
  }

  public clearDomainEvents() {
    this._domainEvents = [];
  }

  private addDomainEvent(event: ClientDomainEventName, metadata: Record<string, unknown>) {
    this._domainEvents.push({ event, metadata });
  }

  // Factory Creation Method
  public static create(
    id: ClientId,
    ownerId: string,
    profile: ClientProfile,
    billingDetails?: Partial<BillingDetails> | undefined,
    primaryContact?: Partial<PrimaryContact> | undefined,
  ): Client {
    const now = new Date();
    const client = new Client({
      id,
      ownerId,
      status: "Lead",
      profile,
      billingDetails,
      primaryContact,
      systemMetadata: {
        createdAt: now,
        updatedAt: now,
      },
    });

    client.addDomainEvent(CLIENT_CREATED, {
      clientId: id,
      ownerId,
    });

    return client;
  }

  // Transition status method
  public transitionTo(newStatus: ClientStatus, ownerId: string) {
    if (ownerId !== this._ownerId) {
      throw new Error("Ownership validation failed.");
    }

    const current = this._status;
    if (current === newStatus) {
      return;
    }

    let allowed = false;
    switch (current) {
      case "Lead":
        allowed = newStatus === "Active" || newStatus === "Closed";
        break;
      case "Active":
        allowed = newStatus === "Suspended" || newStatus === "Archived";
        break;
      case "Suspended":
        allowed = newStatus === "Active" || newStatus === "Closed";
        break;
      case "Archived":
        allowed = newStatus === "Active";
        break;
      case "Closed":
        allowed = newStatus === "Archived";
        break;
    }

    if (!allowed) {
      throw new Error(`Invalid lifecycle transition from ${current} to ${newStatus}.`);
    }

    const now = new Date();
    this._systemMetadata.updatedAt = now;
    if (newStatus === "Archived") {
      this._systemMetadata.archivedAt = now;
    } else if (newStatus === "Closed") {
      this._systemMetadata.closedAt = now;
    } else if (newStatus === "Suspended") {
      this._systemMetadata.suspendedAt = now;
    }

    const oldStatus = this._status;
    this._status = newStatus;

    try {
      this.validateInvariants();
    } catch (err) {
      // Revert status on validation failure
      this._status = oldStatus;
      throw err;
    }

    if (newStatus === "Archived") {
      this.addDomainEvent(CLIENT_ARCHIVED, {
        clientId: this._id,
        ownerId: this._ownerId,
      });
    } else if (newStatus === "Active" && (oldStatus === "Archived" || oldStatus === "Suspended")) {
      this.addDomainEvent(CLIENT_REACTIVATED, {
        clientId: this._id,
        ownerId: this._ownerId,
      });
    }
  }

  // Update profile attributes method
  public updateProfile(
    ownerId: string,
    profile: ClientProfile,
    billingDetails?: Partial<BillingDetails> | undefined,
    primaryContact?: Partial<PrimaryContact> | undefined,
  ) {
    if (ownerId !== this._ownerId) {
      throw new Error("Ownership validation failed.");
    }
    if (this._status === "Closed" || this._status === "Archived") {
      throw new Error(`Cannot update profile in ${this._status} state.`);
    }

    const oldProfile = this._profile;
    const oldBilling = this._billingDetails;
    const oldContact = this._primaryContact;

    this._profile = profile;
    this._billingDetails = billingDetails;
    this._primaryContact = primaryContact;
    this._systemMetadata.updatedAt = new Date();

    try {
      this.validateInvariants();
    } catch (err) {
      // Revert changes on validation failure
      this._profile = oldProfile;
      this._billingDetails = oldBilling;
      this._primaryContact = oldContact;
      throw err;
    }

    this.addDomainEvent(CLIENT_UPDATED, {
      clientId: this._id,
      ownerId: this._ownerId,
    });
  }

  // Uniqueness validation checks using the Persistence boundary
  public async validateUniqueness(persistence: DomainPersistenceContract) {
    if (this._primaryContact?.email) {
      const isUniqueEmail = await persistence.checkUniqueEmail(
        this._ownerId,
        this._primaryContact.email,
        this._id,
      );
      if (!isUniqueEmail) {
        throw new Error("Duplicate client identity: email already exists for this tenant.");
      }
    }
    if (this._billingDetails?.taxRegistrationId) {
      const isUniqueTaxId = await persistence.checkUniqueTaxId(
        this._ownerId,
        this._billingDetails.taxRegistrationId,
        this._id,
      );
      if (!isUniqueTaxId) {
        throw new Error("Duplicate client identity: Tax ID already exists for this tenant.");
      }
    }
  }

  // Invariants checking
  private validateInvariants() {
    // Client Name must be non-empty and 2-100 characters
    if (
      !this._profile.name ||
      this._profile.name.trim().length < 2 ||
      this._profile.name.trim().length > 100
    ) {
      throw new Error("Client name must be between 2 and 100 characters.");
    }

    // Validate email format if provided
    if (this._primaryContact?.email) {
      if (!isValidEmailFormat(this._primaryContact.email)) {
        throw new Error("Invalid email address format.");
      }
    }

    // Validate currency if provided
    if (this._billingDetails?.currency) {
      if (!/^[A-Z]{3}$/.test(this._billingDetails.currency)) {
        throw new Error("Currency must be a 3-letter uppercase ISO 4217 code.");
      }
    }

    // Validate ISO Country if provided
    if (this._billingDetails?.billingAddress?.country) {
      if (!/^[A-Z]{2}$/.test(this._billingDetails.billingAddress.country)) {
        throw new Error("Country must be a 2-letter uppercase ISO 3166-1 code.");
      }
    }

    // Validate specific prerequisites for Active state
    if (this._status === "Active") {
      this.validateActivePrerequisites();
    }
  }

  private validateActivePrerequisites() {
    if (
      !this._primaryContact ||
      !this._primaryContact.firstName ||
      !this._primaryContact.lastName ||
      !this._primaryContact.email
    ) {
      throw new Error("Active client must have a complete primary contact.");
    }

    if (!this._billingDetails) {
      throw new Error("Active client must have billing details.");
    }

    if (!this._billingDetails.currency) {
      throw new Error("Active client must have a billing currency.");
    }

    const address = this._billingDetails.billingAddress;
    if (
      !address ||
      !address.street ||
      !address.city ||
      !address.state ||
      !address.postalCode ||
      !address.country
    ) {
      throw new Error("Active client must have a complete billing address.");
    }

    if (address.postalCode.length > 10) {
      throw new Error("Postal code must not exceed 10 characters.");
    }
  }
}
