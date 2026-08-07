/*
 * =====================================================================
 * @freelanceos/core Workspace API Boundary & Architectural Governance
 * =====================================================================
 *
 * [CURRENT IMPLEMENTATION STATE]
 * This package acts as the core business logic and domain layer boundary.
 * It is currently a skeleton workspace shell containing NO business logic,
 * use-cases, validators, DTOs, or domain aggregates. It is entirely
 * dependency-free to protect domain isolation.
 *
 * 1. Domain Layering Model:
 *    - Application Layer:
 *      * Responsibility: Coordinates execution processes, maps DTO boundaries,
 *        and resolves transactions.
 *    - Enterprise Domain Layer (Core):
 *      * Responsibility: Business entities, rules, invariants, and value objects.
 *    - Repository Contracts (Ports):
 *      * Responsibility: Interfaces defining data persistence schemas.
 *    - Infrastructure / Adapter Layer:
 *      * Responsibility: Specific adapter implementations (Drizzle repos,
 *        BullMQ queue workers, Stripe clients, HTTP route controllers).
 *    - External Services / Engines:
 *      * Responsibility: Relational engines (Postgres), cache stores (Redis),
 *        and API vendors (OpenAI).
 *
 *    *Constraint*: Lower layers must NEVER import or depend on higher layers.
 *
 * 2. Dependency Matrix:
 *    - Allowed Imports:
 *      * Outgoing: None (strictly dependency-free).
 *    - Forbidden Imports:
 *      * Outgoing: Core must NEVER import from `@freelanceos/db`, `@freelanceos/config`,
 *        or any `apps/*` files.
 *      * Circular Prevention: Banning reverse imports prevents reference cycles.
 *
 * 3. Framework Independence Policy (Permanent Architectural Rule):
 *    Core must NEVER directly import or depend on:
 *    * Web/App frameworks (Fastify, Next.js)
 *    * ORM libraries (Drizzle ORM)
 *    * Task queue brokers (BullMQ)
 *    * API SDKs (OpenAI SDK, Stripe SDK)
 *    * Database drivers (Postgres, Redis clients)
 *    * Browser/HTTP request APIs
 *
 * 4. Dependency Inversion Policy (Permanent Engineering Rule):
 *    - Core defines the abstractions (Repository contracts, port interfaces).
 *    - Infrastructure implements these contracts (Adapters).
 *    - Dependency direction must always point inward toward the Core.
 *
 * 5. Public API Governance Policy:
 *    - Exposes: Stable business contracts, domain abstractions, and public
 *      architectural contracts.
 *    - Hides: Framework configurations, infrastructure details, and database drivers.
 *
 * 6. Future Extension Governance:
 *    - Domain Models:        [Future Responsibility - Not Implemented]
 *    - Repository Contracts: [Future Responsibility - Not Implemented]
 *    - Use Cases:            [Future Responsibility - Not Implemented]
 *    - Value Objects:        [Future Responsibility - Not Implemented]
 *    - Domain Events:        [Future Responsibility - Not Implemented]
 *    - Policies:             [Future Responsibility - Not Implemented]
 *    - Specifications:       [Future Responsibility - Not Implemented]
 *    - Factories:            [Future Responsibility - Not Implemented]
 */
export { isValidEmailFormat, normalizeEmailAddress, validatePasswordStrength, } from "./validation.js";
//# sourceMappingURL=index.js.map