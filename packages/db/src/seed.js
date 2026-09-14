import { db } from "./client.js";
import { users, userPasswordHashes, clients } from "./index.js";
async function runSeed() {
    console.log("Starting database seed...");
    // Create a standard test user ID
    const testUserId = "00000000-0000-4000-8000-000000000001";
    const testEmail = "test@freelanceos.dev";
    const testNormalizedEmail = testEmail.toUpperCase();
    // 1. Upsert Test User
    const [user] = await db.insert(users).values({
        id: testUserId,
        email: testEmail,
        normalizedEmail: testNormalizedEmail,
        emailVerifiedAt: new Date(),
        status: "active",
    }).onConflictDoUpdate({
        target: users.id,
        set: { email: testEmail, status: "active" }
    }).returning();
    if (user) {
        console.log(`✅ User ensured: ${user.id} (${user.email})`);
        console.log(`🔑 Test Credentials -> Email: ${testEmail} | Password: password123`);
    }
    // 2. Upsert Test Password (password123)
    const passwordHash = "f4a8baab655570cf5fbc4ca9cbfe2df1:c1fae4cad2fb3d2888c821fbe5dfce25d63bb02f95fe3a8ccc9fd07409a8c7cf4f42d4db41a8c262dce0fb54f1ab34858a76857973c45c47bedc33faf34fb6bb";
    await db.insert(userPasswordHashes).values({
        userId: testUserId,
        passwordHash: passwordHash,
        algorithm: "scrypt",
        hashVersion: JSON.stringify({ N: 16384, r: 8, p: 1 }),
        passwordChangedAt: new Date(),
        credentialVersion: 1
    }).onConflictDoUpdate({
        target: userPasswordHashes.userId,
        set: {
            passwordHash: passwordHash,
            algorithm: "scrypt",
            hashVersion: JSON.stringify({ N: 16384, r: 8, p: 1 }),
            passwordChangedAt: new Date()
        }
    });
    console.log(`✅ User password hash ensured for user: ${testUserId}`);
    // 3. Upsert Test Client
    const testClientId = "00000000-0000-4000-8000-000000000002";
    const [client] = await db.insert(clients).values({
        id: testClientId,
        tenantId: testUserId,
        ownerId: testUserId,
        status: "Lead",
        profile: { name: "Test Client LLC", website: "https://example.com" },
        primaryContact: { email: "contact@example.com", name: "John Doe" },
    }).onConflictDoUpdate({
        target: clients.id,
        set: { profile: { name: "Test Client LLC", website: "https://example.com" } }
    }).returning();
    if (client) {
        console.log(`✅ Client ensured: ${client.id}`);
    }
    console.log("✅ Seed complete.");
    process.exit(0);
}
runSeed().catch(err => {
    console.error("Seed failed:", err);
    process.exit(1);
});
