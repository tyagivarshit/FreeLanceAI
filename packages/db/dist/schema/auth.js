import { pgTable, varchar, timestamp, integer, text, pgEnum, uuid, uniqueIndex, index, } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { auditTimestamps } from "./helpers.js";
// User lifecycle status enum
export const userStatusEnum = pgEnum("user_status", [
    "invited",
    "pending",
    "active",
    "locked",
    "suspended",
    "disabled",
]);
// 1. Users Table
export const users = pgTable("users", {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 255 }).notNull(),
    normalizedEmail: varchar("normalized_email", { length: 255 }).notNull(),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    status: userStatusEnum("status").default("pending").notNull(),
    ...auditTimestamps,
}, (table) => {
    return {
        normalizedEmailIdx: uniqueIndex("users_normalized_email_unique_idx").on(table.normalizedEmail),
    };
});
// 2. User Password Hashes Table
export const userPasswordHashes = pgTable("user_password_hashes", {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
        .references(() => users.id, { onDelete: "cascade" })
        .notNull()
        .unique(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    algorithm: varchar("algorithm", { length: 50 }).notNull(),
    hashVersion: varchar("hash_version", { length: 100 }).notNull(),
    passwordChangedAt: timestamp("password_changed_at", { withTimezone: true }).notNull(),
    credentialVersion: integer("credential_version").default(1).notNull(),
    ...auditTimestamps,
}, (table) => {
    return {
        userIdIdx: index("user_password_hashes_user_id_idx").on(table.userId),
    };
});
// 3. Sessions Table (Embedded Refresh Token Rotation strategy)
export const sessions = pgTable("sessions", {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
        .references(() => users.id, { onDelete: "cascade" })
        .notNull(),
    refreshTokenHash: varchar("refresh_token_hash", { length: 255 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    deviceName: varchar("device_name", { length: 255 }),
    platform: varchar("platform", { length: 255 }),
    browser: varchar("browser", { length: 255 }),
    userAgent: text("user_agent").notNull(),
    ipAddress: varchar("ip_address", { length: 45 }).notNull(), // Maximum size for IPv6 mapped addresses is 45 characters
    rotationCounter: integer("rotation_counter").default(0).notNull(),
    ...auditTimestamps,
}, (table) => {
    return {
        refreshTokenHashIdx: uniqueIndex("sessions_refresh_token_hash_unique_idx").on(table.refreshTokenHash),
        userIdIdx: index("sessions_user_id_idx").on(table.userId),
        userIdRevokedExpiresIdx: index("sessions_user_id_revoked_at_expires_at_idx").on(table.userId, table.revokedAt, table.expiresAt),
    };
});
// 4. Email Verifications Table
export const emailVerifications = pgTable("email_verifications", {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
        .references(() => users.id, { onDelete: "cascade" })
        .notNull(),
    tokenHash: varchar("token_hash", { length: 255 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    attemptCount: integer("attempt_count").default(0).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => {
    return {
        tokenHashIdx: uniqueIndex("email_verifications_token_hash_unique_idx").on(table.tokenHash),
        userIdIdx: index("email_verifications_user_id_idx").on(table.userId),
    };
});
// 5. Password Resets Table
export const passwordResets = pgTable("password_resets", {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
        .references(() => users.id, { onDelete: "cascade" })
        .notNull(),
    tokenHash: varchar("token_hash", { length: 255 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    attemptCount: integer("attempt_count").default(0).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => {
    return {
        tokenHashIdx: uniqueIndex("password_resets_token_hash_unique_idx").on(table.tokenHash),
        userIdIdx: index("password_resets_user_id_idx").on(table.userId),
    };
});
// =====================================================================
// Relations Mappings
// =====================================================================
export const usersRelations = relations(users, ({ one, many }) => ({
    passwordHash: one(userPasswordHashes, {
        fields: [users.id],
        references: [userPasswordHashes.userId],
    }),
    sessions: many(sessions),
    emailVerifications: many(emailVerifications),
    passwordResets: many(passwordResets),
}));
export const userPasswordHashesRelations = relations(userPasswordHashes, ({ one }) => ({
    user: one(users, {
        fields: [userPasswordHashes.userId],
        references: [users.id],
    }),
}));
export const sessionsRelations = relations(sessions, ({ one }) => ({
    user: one(users, {
        fields: [sessions.userId],
        references: [users.id],
    }),
}));
export const emailVerificationsRelations = relations(emailVerifications, ({ one }) => ({
    user: one(users, {
        fields: [emailVerifications.userId],
        references: [users.id],
    }),
}));
export const passwordResetsRelations = relations(passwordResets, ({ one }) => ({
    user: one(users, {
        fields: [passwordResets.userId],
        references: [users.id],
    }),
}));
//# sourceMappingURL=auth.js.map