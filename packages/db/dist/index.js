/*
 * =====================================================================
 * @freelanceos/db Workspace Public API & Database Governance
 * =====================================================================
 *
 * [CURRENT IMPLEMENTATION STATE]
 * This package acts as the boundary gateway for database interactions.
 * It provides database runtime pool lifecycle management, transaction boundary
 * definition, schema helper exports, connection verification, and graceful
 * shutdown handlers. No feature-specific schemas or repository adapters exist.
 *
 * 1. Architecture Layering Model:
 *    Applications (Next.js dashboard, Chrome Extension, workers)
 *    ↓
 *    Application Layer (Core business use-cases)
 *    ↓
 *    Repository Contracts (Interfaces defining data access ports)
 *    ↓
 *    Database Workspace (@freelanceos/db - Encapsulates ORM and drivers)
 *    ↓
 *    ORM (Drizzle compile schemas)
 *    ↓
 *    Database Engine (PostgreSQL instance with pgvector)
 *
 *    *Constraint*: Lower layers must NEVER import or depend on higher layers.
 *
 * 2. Dependency Matrix:
 *    - Allowed Imports:
 *      * Outgoing: `@freelanceos/config` (exclusively for loading runtime variables).
 *    - Forbidden Imports:
 *      * Outgoing: This workspace must NEVER import from `@freelanceos/core` or any `apps/*`.
 *      * Circular Prevention: Banning reverse imports prevents reference cycles.
 *
 * 3. Public API Governance Policy:
 *    - Raw ORM clients, PostgreSQL connection pool instances, or raw query builders
 *      must NEVER be exposed as part of this package's public API contracts.
 *    - Stable Public Exports: Only stable architectural database abstractions,
 *      approved contracts, and database boundary interfaces may be exported.
 *
 * 4. UUID & Key Governance:
 *    - The official primary key strategy uses standard PostgreSQL UUIDs.
 *    - Drizzle `.defaultRandom()` maps to PostgreSQL's native `gen_random_uuid()` generator
 *      (producing standard UUIDv4 keys). This is supported out of the box in Postgres v16,
 *      ensuring setup simplicity and eliminating custom generator function dependencies.
 *
 * 5. Soft Delete Governance:
 *    - Soft delete is NOT the default.
 *    - Any use of soft deletes requires an approved ADR and explicit business justification.
 *    - Database archiving (moving deactivated records to dedicated archive tables) remains
 *      the preferred strategy unless a domain explicitly requires logical deletion.
 *
 * 6. Audit Timestamp Ownership:
 *    - The `updated_at` column is updated at the application layer by the Repository Adapter
 *      before executing update queries, maintaining database-agnostic model structures.
 *
 * 7. PostgreSQL Version Governance:
 *    - Supported Version: PostgreSQL 16 (minimum v16.0).
 *    - Major upgrades require an approved ADR and schema validation.
 *    - PostgreSQL 16 is chosen for its advanced native JSON performance, improved indexing
 *      options, and full compatibility with the pgvector extension.
 *
 * 8. Transaction & Timeout Governance:
 *    - Opaque Transaction Context: Only `@freelanceos/db` is allowed to convert or cast
 *      between the opaque TransactionContext and the internal Drizzle transaction object.
 *      Outer packages (like `@freelanceos/core` or `apps/*`) must NEVER perform casts.
 *      Repository adapters residing inside this workspace own this translation.
 *    - Isolation Level Governance: The IsolationLevel API exposes supported PostgreSQL isolation
 *      levels. However, using isolation levels other than "read committed" (such as "repeatable read"
 *      or "serializable") is governed strictly by architectural policies, requiring an approved ADR.
 *    - Transaction Timeout Ownership: The PostgreSQL server configuration owns the timeout
 *      policy (via statement_timeout). While application-level cancellation signals can propagate
 *      to pools, the database engine remains the ultimate authority for resource safety.
 *    - Retry Governance: Retries are recommended ONLY for idempotent operations. Retries must
 *      never duplicate external side effects (e.g. payment APIs, email, webhooks, or AI requests
 *      must never be retried inside transaction boundaries).
 *    - Nested Transactions: SAVEPOINT creation, naming, lifecycle, and rollback sequencing
 *      are completely owned by the ORM engine. Applications must never manipulate savepoints directly.
 *
 * 9. Future Optimizations (Not Implemented - Future Responsibility):
 *    - pgvector cosine similarity search indexes (HNSW)
 *    - Table partitioning for large-scale transaction logs
 *    - Read-replica connection routing
 *
 * 10. Migration Governance:
 *    - Generation: Developers compile schema updates into versioned SQL files locally.
 *    - Review: Migrations undergo double-review in Pull Requests by Senior Engineers.
 *    - Approval: Production migrations must be approved by the Principal Architect.
 *    - Execution: CD pipelines run migrations automatically before code deployments.
 *    - Rollbacks: Reversing migrations requires a rollback SQL file and database owner approval.
 *    - Safety: Direct manual schema alterations on production databases are strictly prohibited.
 *
 * 11. Future Extension & Outbox Governance:
 *    - Outbox Governance: External events (emails, webhooks, queue publishing) must occur
 *      ONLY after a successful database commit. Never publish external effects while the transaction
 *      is still open. [Future Responsibility - Not Implemented]
 *    - Repositories: [Future Responsibility - Not Implemented]
 *    - Transactions: [Future Responsibility - Not Implemented]
 *    - ORM Adapters: [Future Responsibility - Not Implemented]
 *    - Migrations:   [Future Responsibility - Not Implemented]
 *    - Client Pool:  [Future Responsibility - Not Implemented]
 */
export { verifyConnection, closeDatabaseConnection, db } from "./client.js";
export { runInTransaction } from "./transaction.js";
export { tenantIdColumn, primaryKeyColumn, auditTimestamps } from "./schema/helpers.js";
// Export Authentication Domain Schemas and Relations
export { users, userStatusEnum, userPasswordHashes, sessions, emailVerifications, passwordResets, usersRelations, userPasswordHashesRelations, sessionsRelations, emailVerificationsRelations, passwordResetsRelations, } from "./schema/auth.js";
// Export Jobs Domain Schemas
export { jobImports, jobImportStatusEnum } from "./schema/jobs.js";
// Export Matches Domain Schemas
export { jobMatches, jobMatchLifecycleEnum } from "./schema/matches.js";
// Export Timelines Domain Schemas
export { clientTimelines, timelineEntries, timelineStatusEnum, timelineEventCategoryEnum, visibilityClassificationEnum, } from "./schema/timeline.js";
// Export Repositories
export { PostgresJobsRepository } from "./repository/jobs-repository.js";
export { PostgresJobMatchRepository } from "./repository/match-repository.js";
export { PostgresTimelineRepository } from "./repository/timeline-repository.js";
//# sourceMappingURL=index.js.map