import { test } from "node:test";
import assert from "node:assert";
import { PostgresClientRepository } from "./src/repository/client-repository.js";
import { PostgresTimelineRepository } from "./src/repository/timeline-repository.js";
import { Client, ClientTimeline } from "@freelanceos/core";
import { v4 as uuidv4 } from "uuid";
import { db } from "./src/client.js";
import { sql } from "drizzle-orm";
import { users } from "./src/schema/auth.js";
test("Timeline Bug 1 & 2 Revisions", async () => {
    const clientRepo = new PostgresClientRepository();
    const timelineRepo = new PostgresTimelineRepository();
    const tenantId = uuidv4();
    const user1 = uuidv4();
    await db.execute(sql `DELETE FROM users WHERE email IN ('restrict@bug.com', 'u1@bug.com')`);
    await db.insert(users).values([
        { id: tenantId, email: "restrict@bug.com", normalizedEmail: "RESTRICT@BUG.COM", name: "T1", passwordHash: "h1" },
        { id: user1, email: "u1@bug.com", normalizedEmail: "U1@BUG.COM", name: "U1", passwordHash: "h2" },
    ]);
    const clientId = uuidv4();
    const client = Client.create(clientId, tenantId, user1, { name: "Timeline Restrict Client" }, undefined, { firstName: "Jane", lastName: "Doe", email: "restrict@client.com" });
    await clientRepo.create(client);
    let timeline = ClientTimeline.create(uuidv4(), clientId, tenantId, user1);
    timeline.appendEntry(tenantId, user1, {
        entryId: uuidv4(),
        category: "Lifecycle Event",
        timestamp: new Date(),
        metadata: { msg: "Init" },
        visibility: "Internal"
    });
    await timelineRepo.save(timeline);
    console.log(`\n[SETUP] Created timeline data under tenantId: ${tenantId}`);
    console.log(`\n[ASSERT] Attempting to delete the user serving as tenantId...`);
    try {
        await db.execute(sql `DELETE FROM users WHERE id = ${tenantId}`);
        assert.fail("Should have thrown a foreign key constraint violation");
    }
    catch (err) {
        console.log(`-> SUCCESS: Blocked user deletion with error: "${err.message}"`);
        assert.match(err.message, /violates foreign key constraint/);
    }
    console.log("\nAll revisions passed!");
});
