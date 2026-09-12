import { test } from "node:test";
import assert from "node:assert";
import { PostgresClientRepository } from "./src/repository/client-repository.js";
import { PostgresTimelineRepository } from "./src/repository/timeline-repository.js";
import { Client, ClientTimeline } from "@freelanceos/core";
import { v4 as uuidv4 } from "uuid";
import { db } from "./src/client.js";
import { sql } from "drizzle-orm";
import { users } from "./src/schema/auth.js";
import { clientTimelines } from "./src/schema/timeline.js";

test("Timeline Bug 1, 2, 4 Tests", async () => {
  const clientRepo = new PostgresClientRepository();
  const timelineRepo = new PostgresTimelineRepository();
  
  const tenantId = uuidv4();
  const user1 = uuidv4();
  const user2 = uuidv4(); 
  
  await db.execute(sql`DELETE FROM users WHERE email IN ('tenant@bug.com', 'user1@bug.com', 'user2@bug.com')`); 
  await db.insert(users).values([
    { id: tenantId, email: "tenant@bug.com", normalizedEmail: "TENANT@BUG.COM", name: "T1", passwordHash: "h1" },
    { id: user1, email: "user1@bug.com", normalizedEmail: "USER1@BUG.COM", name: "U1", passwordHash: "h2" },
    { id: user2, email: "user2@bug.com", normalizedEmail: "USER2@BUG.COM", name: "U2", passwordHash: "h3" },
  ]);
  
  const clientId = uuidv4();
  
  const client = Client.create(
    clientId,
    tenantId,
    user1,
    { name: "Timeline Test Client" },
    { currency: "USD", taxRegistrationId: "TAX_TL_1", billingAddress: { street: "1", city: "NY", state: "NY", postalCode: "1", country: "US" } },
    { firstName: "John", lastName: "Doe", email: "timeline@client.com" }
  );
  
  await clientRepo.create(client);
  console.log(`\n[SETUP] Created Client ${clientId} for tenant ${tenantId}`);

  // Test Bug 1: Cross-tenant visibility and cascade delete
  let timeline = ClientTimeline.create(uuidv4(), clientId, tenantId, user1);
  timeline.appendEntry(tenantId, user1, {
    entryId: uuidv4(),
    category: "Lifecycle Event",
    timestamp: new Date(),
    metadata: { msg: "Init" },
    visibility: "Internal"
  });
  await timelineRepo.save(timeline);
  
  const rawData = await db.select().from(clientTimelines).where(sql`client_id = ${clientId}`);
  console.log("RAW TIMELINE DATA:", rawData);

  const foundByUser2 = await timelineRepo.findByClientId(clientId, tenantId);
  assert.ok(foundByUser2, "User2 (same tenant) should see the timeline");
  console.log(`-> SUCCESS: User2 fetched timeline for client via tenantId`);

  const otherTenant = uuidv4();
  const foundByOther = await timelineRepo.findByClientId(clientId, otherTenant);
  assert.ok(!foundByOther, "Other tenant should not see the timeline");
  console.log(`-> SUCCESS: Other tenant returned null`);

  // Test Cascade Delete
  await db.execute(sql`DELETE FROM users WHERE id = ${user1}`);
  const timelineAfterUserDelete = await timelineRepo.findByClientId(clientId, tenantId);
  assert.ok(timelineAfterUserDelete, "Timeline should survive user deletion");
  assert.strictEqual(timelineAfterUserDelete.ownerId, null, "ownerId should be SET NULL");
  console.log(`-> SUCCESS: Timeline survived creator deletion, ownerId is null`);

  // Test Bug 2: Deterministic Ordering
  // Create 5 events at the EXACT same millisecond
  const now = new Date();
  const events = Array.from({length: 5}, (_, i) => ({
    entryId: uuidv4(),
    category: "Status Event" as any,
    timestamp: now,
    metadata: { order: i },
    visibility: "Internal" as any
  }));

  for (const e of events) {
    timelineAfterUserDelete.appendEntry(tenantId, user2, e);
  }
  await timelineRepo.save(timelineAfterUserDelete);

  const entriesPage = await timelineRepo.findTimelineEntriesByTenant(tenantId, { page: 1, pageSize: 10 });
  // The first 5 entries should be the ones we just added, ordered by sequence DESC
  const addedEntries = entriesPage.items.slice(0, 5);
  console.log(`-> Entries Order (sequenceNumber): ${addedEntries.map(e => e.sequenceNumber).join(', ')}`);
  
  // Test Bug 4: Transactional Rollback
  const client2 = Client.create(
    uuidv4(),
    tenantId,
    user2,
    { name: "Tx Test Client" },
    { currency: "USD", taxRegistrationId: "TAX_TL_2", billingAddress: { street: "1", city: "NY", state: "NY", postalCode: "1", country: "US" } },
    { firstName: "Jane", lastName: "Doe", email: "tx@client.com" }
  );
  await clientRepo.create(client2);
  let tl2 = ClientTimeline.create(uuidv4(), client2.id, tenantId, user2);

  try {
    await db.transaction(async (tx) => {
      client2.transitionTo("Active", user2);
      await clientRepo.update(client2, tenantId, tx);
      
      tl2.appendEntry(tenantId, user2, {
        entryId: uuidv4(),
        category: "Status Event",
        timestamp: new Date(),
        metadata: { msg: "Active" },
        visibility: "Internal"
      });
      // Simulate error in timeline append
      throw new Error("Simulated timeline write failure");
      await timelineRepo.save(tl2, tx);
    });
  } catch (err: any) {
    console.log(`-> Transaction failed as expected: ${err.message}`);
  }

  // Verify client status rolled back
  const client2After = await clientRepo.findById(client2.id, tenantId);
  assert.strictEqual(client2After?.status, "Lead", "Client status should have rolled back to Lead");
  console.log(`-> SUCCESS: Client status successfully rolled back (current: ${client2After?.status})`);
});
