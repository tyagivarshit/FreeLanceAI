import { test } from "node:test";
import assert from "node:assert";
import { PostgresClientRepository } from "./src/repository/client-repository.js";
import { Client } from "@freelanceos/core";
import { v4 as uuidv4 } from "uuid";
import { db } from "./src/client.js";
import { users } from "./src/schema/auth.js";

test("Multi-user team workspaces (Bug 1 & 2)", async () => {
  const repo = new PostgresClientRepository();
  
  const tenant1 = uuidv4();
  const user1 = uuidv4();
  const user2 = uuidv4(); 
  
  const tenant2 = uuidv4();
  const user3 = uuidv4(); 
  
  await db.execute('DELETE FROM users WHERE email IN (\'t1@example.com\', \'u1@example.com\', \'u2@example.com\', \'t2@example.com\', \'u3@example.com\')'); await db.insert(users).values([
    { id: tenant1, email: "t1@example.com", normalizedEmail: "T1@EXAMPLE.COM", name: "T1", passwordHash: "h1" },
    { id: user1, email: "u1@example.com", normalizedEmail: "U1@EXAMPLE.COM", name: "U1", passwordHash: "h2" },
    { id: user2, email: "u2@example.com", normalizedEmail: "U2@EXAMPLE.COM", name: "U2", passwordHash: "h3" },
    { id: tenant2, email: "t2@example.com", normalizedEmail: "T2@EXAMPLE.COM", name: "T2", passwordHash: "h4" },
    { id: user3, email: "u3@example.com", normalizedEmail: "U3@EXAMPLE.COM", name: "U3", passwordHash: "h5" }
  ]);
  
  const clientId = uuidv4();
  const clientEmail = "shared@client.com";

  console.log(`\n[SETUP] Initializing mock teams...`);
  console.log(`-> Tenant 1 (ID: ${tenant1}): Includes User1, User2`);
  console.log(`-> Tenant 2 (ID: ${tenant2}): Includes User3`);

  const c1 = Client.create(
    clientId,
    tenant1,
    user1,
    { name: "Team Client" },
    { currency: "USD", taxRegistrationId: "TAX1", billingAddress: { street: "1", city: "NY", state: "NY", postalCode: "1", country: "US" } },
    { firstName: "John", lastName: "Doe", email: clientEmail }
  );
  
  await repo.create(c1);
  console.log(`\n[ACTION] User1 (Tenant 1) created Client ID: ${clientId} with email ${clientEmail}`);

  console.log(`\n[ASSERT 1] User2 (Tenant 1) attempts to view Client ID: ${clientId}`);
  const foundUser2 = await repo.findById(clientId, tenant1);
  assert.ok(foundUser2, "User2 should see the client");
  console.log(`-> SUCCESS: User2 fetched client ID: ${foundUser2.id}`);
  
  const listUser2 = await repo.list(tenant1);
  console.log(`-> SUCCESS: User2 listed clients, found IDs: ${listUser2.items.map(c => c.id).join(", ")}`);

  console.log(`\n[ASSERT 2] User3 (Tenant 2) attempts to view Client ID: ${clientId}`);
  const foundUser3 = await repo.findById(clientId, tenant2);
  assert.ok(!foundUser3, "User3 should NOT see the client");
  console.log(`-> SUCCESS: User3 returned null for findById`);
  
  const listUser3 = await repo.list(tenant2);
  console.log(`-> SUCCESS: User3 listed clients, found ${listUser3.items.length} items (expected 0)`);

  console.log(`\n[ASSERT 3] User2 (Tenant 1) attempts to create duplicate client with email: ${clientEmail}`);
  const c2 = Client.create(
    uuidv4(),
    tenant1,
    user2,
    { name: "Duplicate Client" },
    undefined,
    { firstName: "Jane", lastName: "Doe", email: clientEmail }
  );
  
  try {
    await repo.create(c2);
    assert.fail("Should have thrown uniqueness error");
  } catch (err: any) {
    console.log(`-> SUCCESS: Rejected with error: "${err.message}"`);
    assert.match(err.message, /Duplicate client identity/);
  }
  
  console.log("\nAll Bug 1 & 2 tests passed!");
});
