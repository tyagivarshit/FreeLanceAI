import { test } from "node:test";
import assert from "node:assert";
import { db } from "./src/client.js";
import { clients } from "./src/schema/clients.js";
import { users } from "./src/schema/auth.js";
import { clientTimelines } from "./src/schema/timeline.js";
import { jobImports } from "./src/schema/jobs.js";
import { v4 as uuidv4 } from "uuid";
import { eq } from "drizzle-orm";

test("Bug 3: cascade deletes", async () => {
  const tenant1 = uuidv4();
  const clientId = uuidv4();
  const timelineId = uuidv4();
  const jobId = uuidv4();
  
  await db.execute('DELETE FROM users WHERE email = \'del@example.com\''); await db.insert(users).values([
    { id: tenant1, email: "del@example.com", normalizedEmail: "DEL@EXAMPLE.COM", name: "D", passwordHash: "h1" }
  ]);
  
  console.log(`\n[SETUP] Creating Client ID: ${clientId}`);
  await db.insert(clients).values({
    id: clientId, tenantId: tenant1, ownerId: tenant1, status: "Lead",
    profile: { name: "To Delete" },
    createdAt: new Date(), updatedAt: new Date()
  });
  
  console.log(`[SETUP] Creating related Timeline ID: ${timelineId}`);
  await db.insert(clientTimelines).values({
    id: timelineId, clientId: clientId, ownerId: tenant1, status: "Active",
    createdAt: new Date(), updatedAt: new Date()
  });
  
  console.log(`[SETUP] Creating related JobImport ID: ${jobId}`);
  await db.insert(jobImports).values({
    id: jobId, tenantId: tenant1, ownerId: tenant1, clientId: clientId, source: "src",
    externalJobId: "ext1", importedAt: new Date(), rawPayload: {}, fingerprint: "f1",
    status: "RECEIVED", createdAt: new Date(), updatedAt: new Date()
  });

  const jobsBefore = await db.select().from(jobImports).where(eq(jobImports.id, jobId));
  const timelinesBefore = await db.select().from(clientTimelines).where(eq(clientTimelines.id, timelineId));
  console.log(`\n[PRE-CHECK] Found ${jobsBefore.length} job_imports and ${timelinesBefore.length} client_timelines referencing Client ID ${clientId}`);
  
  console.log(`\n[ACTION] Hard deleting Client ID: ${clientId}`);
  await db.delete(clients).where(eq(clients.id, clientId));
  
  console.log(`\n[ASSERT] Verifying cascade deletion of dependent rows...`);
  const jobsAfter = await db.select().from(jobImports).where(eq(jobImports.id, jobId));
  console.log(`-> Found ${jobsAfter.length} job_imports (Expected: 0)`);
  assert.strictEqual(jobsAfter.length, 0, "job_imports should be cascade deleted");
  
  const timelineAfter = await db.select().from(clientTimelines).where(eq(clientTimelines.id, timelineId));
  console.log(`-> Found ${timelineAfter.length} client_timelines (Expected: 0)`);
  assert.strictEqual(timelineAfter.length, 0, "client_timelines should be cascade deleted");
  
  console.log("\nBug 3 tests passed!");
});
