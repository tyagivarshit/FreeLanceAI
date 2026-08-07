import { test, describe } from "node:test";
import assert from "node:assert";
import {
  Client,
  CLIENT_CREATED,
  CLIENT_UPDATED,
  CLIENT_ARCHIVED,
  CLIENT_REACTIVATED,
} from "./client.js";
import type { DomainPersistenceContract } from "./client.js";

describe("Client Aggregate Roots & Invariants Tests", () => {
  const validProfile = { name: "Acme Corp", website: "https://acme.com", phone: "+15550100" };
  const validAddress = {
    street: "123 Main St",
    city: "Metropolis",
    state: "NY",
    postalCode: "10001",
    country: "US",
  };
  const validBilling = {
    taxRegistrationId: "TAX-123",
    currency: "USD",
    billingAddress: validAddress,
  };
  const validContact = { firstName: "John", lastName: "Doe", email: "john@acme.com" };

  test("Client creation (Lead status by default and CLIENT_CREATED event generated)", () => {
    const client = Client.create("client-1", "owner-1", validProfile);
    assert.strictEqual(client.id, "client-1");
    assert.strictEqual(client.ownerId, "owner-1");
    assert.strictEqual(client.status, "Lead");
    assert.strictEqual(client.profile.name, "Acme Corp");
    assert.strictEqual(client.domainEvents.length, 1);
    assert.strictEqual(client.domainEvents[0]!.event, CLIENT_CREATED);
    assert.strictEqual(client.domainEvents[0]!.metadata.clientId, "client-1");
    assert.strictEqual(client.domainEvents[0]!.metadata.ownerId, "owner-1");
  });

  test("Missing owner throws error", () => {
    assert.throws(() => {
      Client.create("client-1", "  ", validProfile);
    }, /Owner ID is required/);
  });

  test("Client update profile success and CLIENT_UPDATED event emitted", () => {
    const client = Client.create("client-1", "owner-1", validProfile);
    client.clearDomainEvents();

    const newProfile = { name: "Acme LLC" };
    client.updateProfile("owner-1", newProfile, validBilling, validContact);

    assert.strictEqual(client.profile.name, "Acme LLC");
    assert.strictEqual(client.domainEvents.length, 1);
    assert.strictEqual(client.domainEvents[0]!.event, CLIENT_UPDATED);
  });

  test("Client update fails if ownership validation fails", () => {
    const client = Client.create("client-1", "owner-1", validProfile);
    assert.throws(() => {
      client.updateProfile("owner-wrong", { name: "Failing Corp" });
    }, /Ownership validation failed/);
  });

  test("Transition to Active enforces required metadata", () => {
    const client = Client.create("client-1", "owner-1", validProfile);

    // Attempt to activate without billing details or contact info
    assert.throws(() => {
      client.transitionTo("Active", "owner-1");
    }, /Active client must have a complete primary contact/);

    // Provide partial contact
    assert.throws(() => {
      client.updateProfile("owner-1", validProfile, undefined, { firstName: "John" });
      client.transitionTo("Active", "owner-1");
    }, /Active client must have a complete primary contact/);

    // Complete profile, contact, and billing details
    client.updateProfile("owner-1", validProfile, validBilling, validContact);
    client.transitionTo("Active", "owner-1");
    assert.strictEqual(client.status, "Active");
  });

  test("Invalid lifecycle status transitions throw error", () => {
    const client = Client.create("client-1", "owner-1", validProfile);

    // Cannot transition from Lead directly to Suspended or Archived
    assert.throws(() => {
      client.transitionTo("Suspended", "owner-1");
    }, /Invalid lifecycle transition/);

    assert.throws(() => {
      client.transitionTo("Archived", "owner-1");
    }, /Invalid lifecycle transition/);
  });

  test("Archive transition emits CLIENT_ARCHIVED and Reactivate transition emits CLIENT_REACTIVATED", () => {
    const client = Client.create("client-1", "owner-1", validProfile);
    client.updateProfile("owner-1", validProfile, validBilling, validContact);

    // Lead -> Active
    client.transitionTo("Active", "owner-1");
    client.clearDomainEvents();

    // Active -> Archived
    client.transitionTo("Archived", "owner-1");
    assert.strictEqual(client.status, "Archived");
    assert.ok(client.systemMetadata.archivedAt instanceof Date);
    assert.strictEqual(client.domainEvents.length, 1);
    assert.strictEqual(client.domainEvents[0]!.event, CLIENT_ARCHIVED);

    // Reactivate: Archived -> Active
    client.clearDomainEvents();
    client.transitionTo("Active", "owner-1");
    assert.strictEqual(client.status, "Active");
    assert.strictEqual(client.domainEvents.length, 1);
    assert.strictEqual(client.domainEvents[0]!.event, CLIENT_REACTIVATED);
  });

  test("Aggregate invariant validation: name length, country, currency formats", () => {
    // Client Name validation
    assert.throws(() => {
      Client.create("client-1", "owner-1", { name: "A" });
    }, /Client name must be between 2 and 100/);

    // Contact Email format
    assert.throws(() => {
      Client.create("client-1", "owner-1", validProfile, undefined, { email: "bademail" });
    }, /Invalid email address format/);

    // Currency format
    assert.throws(() => {
      Client.create("client-1", "owner-1", validProfile, { currency: "USD-extra" });
    }, /Currency must be a 3-letter uppercase/);

    // Country format
    assert.throws(() => {
      Client.create("client-1", "owner-1", validProfile, {
        billingAddress: { ...validAddress, country: "USA" },
      });
    }, /Country must be a 2-letter uppercase/);
  });

  test("Duplicate identity prevention check", async () => {
    const client = Client.create("client-1", "owner-1", validProfile, validBilling, validContact);

    const mockPersistence: DomainPersistenceContract = {
      async checkUniqueEmail(_ownerId, email) {
        return email !== "john@acme.com";
      },
      async checkUniqueTaxId(_ownerId, taxId) {
        return taxId !== "TAX-123";
      },
    };

    await assert.rejects(async () => {
      await client.validateUniqueness(mockPersistence);
    }, /Duplicate client identity: email already exists/);

    const uniqueEmailClient = Client.create("client-1", "owner-1", validProfile, validBilling, {
      ...validContact,
      email: "unique@acme.com",
    });

    await assert.rejects(async () => {
      await uniqueEmailClient.validateUniqueness(mockPersistence);
    }, /Duplicate client identity: Tax ID already exists/);
  });
});
