import { isValidEmailFormat } from "./validation.js";
// Logical Domain Events
export const CLIENT_CREATED = "CLIENT_CREATED";
export const CLIENT_UPDATED = "CLIENT_UPDATED";
export const CLIENT_ARCHIVED = "CLIENT_ARCHIVED";
export const CLIENT_REACTIVATED = "CLIENT_REACTIVATED";
// Client Aggregate Root
export class Client {
    _id;
    _tenantId;
    _ownerId;
    _status;
    _profile;
    _billingDetails;
    _primaryContact;
    _systemMetadata;
    _domainEvents = [];
    constructor(properties) {
        if (!properties.id || properties.id.trim() === "") {
            throw new Error("Client ID is required.");
        }
        if (!properties.tenantId || properties.tenantId.trim() === "") {
            throw new Error("Tenant ID is required.");
        }
        if (!properties.ownerId || properties.ownerId.trim() === "") {
            throw new Error("Owner ID is required.");
        }
        this._id = properties.id;
        this._tenantId = properties.tenantId;
        this._ownerId = properties.ownerId;
        this._status = properties.status;
        this._profile = properties.profile;
        this._billingDetails = properties.billingDetails;
        this._primaryContact = properties.primaryContact;
        this._systemMetadata = properties.systemMetadata;
        this.validateInvariants();
    }
    // Getters
    get id() {
        return this._id;
    }
    get tenantId() {
        return this._tenantId;
    }
    get ownerId() {
        return this._ownerId;
    }
    get status() {
        return this._status;
    }
    get profile() {
        return this._profile;
    }
    get billingDetails() {
        return this._billingDetails;
    }
    get primaryContact() {
        return this._primaryContact;
    }
    get systemMetadata() {
        return this._systemMetadata;
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
    static create(id, tenantId, ownerId, profile, billingDetails, primaryContact) {
        const now = new Date();
        const client = new Client({
            id,
            tenantId,
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
            tenantId,
            ownerId,
        });
        return client;
    }
    transitionTo(newStatus, actorId) {
        if ((newStatus === "Archived" || newStatus === "Closed") && actorId !== this._ownerId) {
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
        }
        else if (newStatus === "Closed") {
            this._systemMetadata.closedAt = now;
        }
        else if (newStatus === "Suspended") {
            this._systemMetadata.suspendedAt = now;
        }
        const oldStatus = this._status;
        this._status = newStatus;
        try {
            this.validateInvariants();
        }
        catch (err) {
            // Revert status on validation failure
            this._status = oldStatus;
            throw err;
        }
        if (newStatus === "Archived") {
            this.addDomainEvent(CLIENT_ARCHIVED, {
                clientId: this._id,
                tenantId: this._tenantId,
                ownerId: this._ownerId,
            });
        }
        else if (newStatus === "Active" && (oldStatus === "Archived" || oldStatus === "Suspended")) {
            this.addDomainEvent(CLIENT_REACTIVATED, {
                clientId: this._id,
                tenantId: this._tenantId,
                ownerId: this._ownerId,
            });
        }
    }
    updateProfile(profile, billingDetails, primaryContact) {
        if (this._status === "Closed" || this._status === "Archived") {
            throw new Error(`Cannot update profile in ${this._status} state.`);
        }
        const oldProfile = this._profile;
        const oldBilling = this._billingDetails;
        const oldContact = this._primaryContact;
        const oldUpdatedAt = this._systemMetadata.updatedAt;
        this._profile = profile;
        this._billingDetails = billingDetails;
        this._primaryContact = primaryContact;
        this._systemMetadata.updatedAt = new Date();
        try {
            this.validateInvariants();
        }
        catch (err) {
            // Revert changes on validation failure
            this._profile = oldProfile;
            this._billingDetails = oldBilling;
            this._primaryContact = oldContact;
            this._systemMetadata.updatedAt = oldUpdatedAt;
            throw err;
        }
        this.addDomainEvent(CLIENT_UPDATED, {
            clientId: this._id,
            tenantId: this._tenantId,
            ownerId: this._ownerId,
        });
    }
    // Uniqueness validation checks using the Persistence boundary
    async validateUniqueness(persistence) {
        if (this._primaryContact?.email) {
            const isUniqueEmail = await persistence.checkUniqueEmail(this._tenantId, this._primaryContact.email, this._id);
            if (!isUniqueEmail) {
                throw new Error("Duplicate client identity: email already exists for this tenant.");
            }
        }
        if (this._billingDetails?.taxRegistrationId) {
            const isUniqueTaxId = await persistence.checkUniqueTaxId(this._tenantId, this._billingDetails.taxRegistrationId, this._id);
            if (!isUniqueTaxId) {
                throw new Error("Duplicate client identity: Tax ID already exists for this tenant.");
            }
        }
    }
    // Invariants checking
    validateInvariants() {
        // Client Name must be non-empty and 2-100 characters
        if (!this._profile.name ||
            this._profile.name.trim().length < 2 ||
            this._profile.name.trim().length > 100) {
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
    validateActivePrerequisites() {
        if (!this._primaryContact ||
            !this._primaryContact.firstName ||
            !this._primaryContact.lastName ||
            !this._primaryContact.email) {
            throw new Error("Active client must have a complete primary contact.");
        }
        if (!this._billingDetails) {
            throw new Error("Active client must have billing details.");
        }
        if (!this._billingDetails.currency) {
            throw new Error("Active client must have a billing currency.");
        }
        const address = this._billingDetails.billingAddress;
        if (!address ||
            !address.street ||
            !address.city ||
            !address.state ||
            !address.postalCode ||
            !address.country) {
            throw new Error("Active client must have a complete billing address.");
        }
        if (address.postalCode.length > 10) {
            throw new Error("Postal code must not exceed 10 characters.");
        }
    }
}
