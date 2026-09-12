# Master Execution Playbook Audit (Phase 0 to Phase 2)

## 📌 Project Overview
The project is a multi-tenant SaaS foundation (FreelanceAI / FreelanceOS) using a strict **Domain-Driven Design (DDD)** and **Monorepo** architecture (`pnpm` workspaces). The backend leverages a very lightweight raw Node.js `http.createServer` for maximum performance instead of Express/NestJS, paired with **PostgreSQL**, **Drizzle ORM**, and **Redis** for state/caching.

### 🏗️ Tech Stack
- **Compute/API**: Raw Node.js `http` module (No Express/Fastify), minimizing overhead.
- **Database**: PostgreSQL 16
- **ORM**: Drizzle ORM
- **Caching/State**: Redis (`ioredis`)
- **Architecture**: Monorepo (`apps/web`, `packages/core`, `packages/db`, `packages/auth`)

---

## ✅ Completed Milestones (Phase 0 - Phase 2)

### **Phase 0: Project Foundation**
- **0A Workspace Initialization**: Monorepo structure (`apps/*`, `packages/*`) is correctly scaffolded. Strict dependency rules are in place (e.g., `db` cannot import from `core`).
- **0B Developer Tooling**: Shared ESLint (`packages/eslint-config`) and TypeScript (`packages/ts-config`) setups are intact.
- **0C Docker / CI**: Foundation for isolated services exists.
- **0D Database Bootstrap**: Postgres connection pooling and schema initialization module (`packages/db/src/client.ts`) is established.
- **0E Health Validation**: `/healthz`, `/livez`, `/readyz` endpoints are actively wired in `server.js`.

### **Phase 1: Authentication**
- **1A Database Models**: `users`, `user_password_hashes`, `user_mfa_settings`, `sessions`, `email_verifications`, and `password_resets` exist in `packages/db/src/schema/auth.ts`.
- **1B Session Architecture**: Refresh Token Rotation is fully modeled with `rotation_counter` and IP/Device tracking.
- **1C-1E Signup/Login/Logout**: Wired manually in `apps/web/server.js` using isolated HTTP handlers (`/api/signup`, `/api/login`, `/api/logout`).
- **1F Middleware**: Extracted correctly using HTTP cookie parsing and stateful JWT access tokens.
- **1G Auth Tests**: Comprehensive test files (`signup.test.ts`, `login.test.ts`) are populated in `packages/auth/src`.

### **Phase 2: Client Domain**
- **2A Client Aggregate**: Implemented via DDD in `packages/core`.
- **2B-2E Related Entities**: Timelines, Payments, Projects, and Attachments schemas have been established and exported.
- **2F Repositories**: Data access layers (e.g., `PostgresClientRepository`) correctly abstract Drizzle from the core business logic.
- **2G Tests**: Robust repository integration tests exist in `packages/db/src/repository`.

---

## 🚨 Deep Audit: Bugs, Bottlenecks, & Architectural Weaknesses

While the foundation is highly optimized, the following unwired paths and design choices will severely cripple the app at large scale:

### 1. Database Indexing & Search Bottlenecks (Phase 2)
In `PostgresClientRepository`, the `searchClients` and `findByPrimaryContactEmail` methods run queries like:
```sql
lower(profile->>'name') LIKE '%query%'
```
**The Problem**: PostgreSQL cannot use standard B-Tree indexes for `LIKE '%...%'` queries, especially inside JSONB columns. This forces a **Sequential Scan** (full table scan) on the `clients` table.
**The Fix**: You must wire a `pg_trgm` (Trigram) GIN index on these JSONB extraction paths in `schema/clients.ts`, otherwise database CPU usage will max out at merely 10,000+ client rows.

### 2. Session Activity Contention (Phase 1)
The `sessions` table tracks `lastActivityAt`. If your auth middleware updates `lastActivityAt` in the Postgres database on *every single request* to keep the session alive, you will encounter extreme write contention and row locking overhead.
**The Fix**: Debounce session updates. Use Redis to cache the `lastActivityAt` timestamp and flush it to PostgreSQL asynchronously via a background worker or chron job.

### 3. Raw Node.js Server Scaling (Phase 0/1)
`apps/web/server.js` uses a gigantic `http.createServer` block (`if (pathname === '/api/...`) for routing. 
**The Problem**: 
- Missing automated CORS preflight caching.
- As the file grows, parsing giant JSON bodies manually via `req.on('data')` blocks the event loop and exposes you to slowloris attacks. (There is currently only basic size limiting implemented on the Stripe webhook).
- Managing Middleware execution order (e.g., Rate Limiting -> Auth -> Parsing) natively is highly error-prone.
**The Fix**: Even if you avoid heavy frameworks, consider a tiny radix-tree router (like `find-my-way`) and `busboy` for stream parsing to protect the event loop.

### 4. Database Dead Token Bloat (Phase 1)
The tables `email_verifications`, `password_resets`, and `sessions` hold expired rows.
**The Problem**: There is no automated cleanup mechanism (TTL). Over time, these tables will bloat with dead tokens, slowing down index lookups and consuming expensive storage.
**The Fix**: Implement a background cron job (or pg_cron) to securely `DELETE FROM sessions WHERE expires_at < NOW()` daily.

### 5. Drizzle `updatedAt` Overwrites
In `PostgresClientRepository.ts`, `save()` explicitly forces `updatedAt: new Date()`.
**The Problem**: In strict DDD, the Core Aggregate is supposed to own the time modification (e.g., `client.updateName(...)` modifies its internal `updatedAt`). By letting the Repository blindly overwrite it, you lose microsecond precision audit trails generated in the Core layer.
**The Fix**: Ensure `updatedAt: client.systemMetadata.updatedAt` is passed directly from the Aggregate instead of generating a new Date in the Repository.

---

## 🏁 Summary Check
The codebase structure is extremely clean and enforces impressive dependency discipline. If the JSONB Trigram indexes and Session debouncing fixes are wired in, this architecture will effortlessly scale to millions of concurrent requests.
