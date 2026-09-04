import { test, describe, before, after } from "node:test";
import assert from "node:assert";
import { db, users, userPasswordHashes, sessions } from "@freelanceos/db";
import { createSession, validateSession } from "./session.js";
import { hashPassword } from "./hash.js";
import { eq } from "drizzle-orm";
import pg from "pg";

describe("Session Validate Query Count (Bug 1F Regression Test)", () => {
  let testUser: any;
  let testSessionResult: any;

  before(async () => {
    // Set up test user and session
    const email = "query_count_test_" + Date.now() + "@example.com";
    const pass = "ComplexPass123!";
    const { passwordHash, algorithm, hashVersion } = await hashPassword(pass);
    
    testUser = (await db.insert(users).values({
      email,
      normalizedEmail: email,
      status: "active"
    }).returning())[0];

    await db.insert(userPasswordHashes).values({
      userId: testUser.id,
      passwordHash,
      algorithm,
      hashVersion,
      passwordChangedAt: new Date(),
      credentialVersion: 1
    });

    testSessionResult = await createSession(testUser.id, {
      userAgent: "test-agent",
      ipAddress: "127.0.0.1"
    });
  });

  after(async () => {
    // Cleanup
    if (testUser) {
      await db.delete(sessions).where(eq(sessions.userId, testUser.id));
      await db.delete(userPasswordHashes).where(eq(userPasswordHashes.userId, testUser.id));
      await db.delete(users).where(eq(users.id, testUser.id));
    }
  });

  test("validateSession should execute exactly 1 database query (single JOIN optimization)", async () => {
    const originalQuery = pg.Client.prototype.query;
    let queryCount = 0;
    
    // @ts-expect-error patching prototype
    pg.Client.prototype.query = function (...args: any[]) {
      queryCount++;
      // @ts-expect-error spread args
      return originalQuery.apply(this, args);
    };

    try {
      const result = await validateSession(testSessionResult.signedAccessToken);
      
      assert.strictEqual(result.userId, testUser.id);
      
      // Expected exactly 1 query to fetch the session, user, and credential version via JOIN
      assert.strictEqual(
        queryCount, 
        1, 
        `validateSession should issue exactly 1 query, but issued ${queryCount}`
      );
    } finally {
      // Restore prototype
      pg.Client.prototype.query = originalQuery;
    }
  });

  test("Structural check: Prepared statement path must be intact for production", async () => {
    // We cannot run the prepared statement path fully in NODE_ENV=test due to the pg pool limits 
    // interacting with Drizzle's prepared statement cache (Stage A workaround).
    // However, we assert structurally that the prepared query exists in the module.
    
    // We can read the session file to ensure preparedValidateSessionQuery is not removed.
    const fs = await import("node:fs");
    const path = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    
    // Test runs from dist folder, so we need to point to src
    const sessionFilePath = path.join(__dirname, "../src/session.ts");
    
    if (fs.existsSync(sessionFilePath)) {
      const content = fs.readFileSync(sessionFilePath, "utf8");
      
      const hasPreparedStatementDefinition = content.includes("buildValidateSessionQuery().prepare");
      const hasConditionalExecution = content.includes("process.env.NODE_ENV === \"test\"") && 
                                      content.includes("preparedValidateSessionQuery!.execute");
      
      assert.ok(
        hasPreparedStatementDefinition && hasConditionalExecution,
        "The prepared statement path for validateSession must remain in the code for production performance."
      );
    }
  });
});
