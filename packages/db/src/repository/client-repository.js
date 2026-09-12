import { eq, and, or, desc, sql, ne } from "drizzle-orm";
import { db } from "../client.js";
import { clients } from "../schema/clients.js";
import { Client, ClientSearchEngine, } from "@freelanceos/core";
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
export class PostgresClientRepository {
    async create(client, tx) {
        await client.validateUniqueness(this);
        await this.save(client, tx);
    }
    async save(client, tx) {
        const tenantId = client.tenantId; // Use actual tenantId
        const metadata = client.systemMetadata;
        const values = {
            id: client.id,
            tenantId,
            ownerId: client.ownerId,
            status: client.status,
            profile: client.profile,
            billingDetails: client.billingDetails ?? null,
            primaryContact: normalizePrimaryContactForStorage(client.primaryContact),
            archivedAt: metadata.archivedAt ?? null,
            closedAt: metadata.closedAt ?? null,
            suspendedAt: metadata.suspendedAt ?? null,
            createdAt: metadata.createdAt,
            updatedAt: new Date(),
        };
        const t = tx || db;
        await t
            .insert(clients)
            .values(values)
            .onConflictDoUpdate({
            target: [clients.id, clients.tenantId],
            set: {
                ownerId: values.ownerId,
                status: values.status,
                profile: values.profile,
                billingDetails: values.billingDetails,
                primaryContact: values.primaryContact,
                archivedAt: values.archivedAt,
                closedAt: values.closedAt,
                suspendedAt: values.suspendedAt,
                updatedAt: values.updatedAt,
            },
        });
    }
    async update(client, tenantId, tx) {
        if (client.tenantId !== tenantId) {
            throw new Error("Tenant validation failed.");
        }
        const existing = await this.findById(client.id, tenantId);
        if (!existing) {
            throw new Error("Client not found.");
        }
        await client.validateUniqueness(this);
        await this.save(client, tx);
    }
    async getById(id, tenantId) {
        return this.findById(id, tenantId);
    }
    async findById(id, tenantId) {
        const rows = await db
            .select()
            .from(clients)
            .where(and(eq(clients.id, id), eq(clients.tenantId, tenantId)))
            .limit(1);
        if (rows.length === 0) {
            return null;
        }
        return this.mapToAggregate(rows[0]);
    }
    /**
     * Tenant-scoped primary contact email lookup.
     * The Phase 8 Client domain defines email uniqueness per tenant, not platform external IDs.
     */
    async findByPrimaryContactEmail(tenantId, email) {
        const normalizedEmail = email.trim().toLowerCase();
        const rows = await db
            .select()
            .from(clients)
            .where(and(eq(clients.tenantId, tenantId), sql `lower(trim(${clients.primaryContact}->>'email')) = ${normalizedEmail}`))
            .limit(1);
        if (rows.length === 0) {
            return null;
        }
        return this.mapToAggregate(rows[0]);
    }
    async getByExternalIdentity(tenantId, identity) {
        if (identity.type === "primaryContactEmail") {
            return this.findByPrimaryContactEmail(tenantId, identity.value);
        }
        const normalizedTaxId = identity.value.trim();
        const rows = await db
            .select()
            .from(clients)
            .where(and(eq(clients.tenantId, tenantId), sql `trim(${clients.billingDetails}->>'taxRegistrationId') = ${normalizedTaxId}`))
            .limit(1);
        if (rows.length === 0) {
            return null;
        }
        return this.mapToAggregate(rows[0]);
    }
    async checkUniqueEmail(tenantId, email, excludeClientId) {
        const normalizedEmail = email.trim().toLowerCase();
        const conditions = [
            eq(clients.tenantId, tenantId),
            sql `lower(trim(${clients.primaryContact}->>'email')) = ${normalizedEmail}`,
        ];
        if (excludeClientId) {
            conditions.push(ne(clients.id, excludeClientId));
        }
        const rows = await db
            .select({ id: clients.id })
            .from(clients)
            .where(and(...conditions))
            .limit(1);
        return rows.length === 0;
    }
    async checkUniqueTaxId(tenantId, taxId, excludeClientId) {
        const normalizedTaxId = taxId.trim();
        const conditions = [
            eq(clients.tenantId, tenantId),
            sql `trim(${clients.billingDetails}->>'taxRegistrationId') = ${normalizedTaxId}`,
        ];
        if (excludeClientId) {
            conditions.push(ne(clients.id, excludeClientId));
        }
        const rows = await db
            .select({ id: clients.id })
            .from(clients)
            .where(and(...conditions))
            .limit(1);
        return rows.length === 0;
    }
    async list(tenantId, options = {}) {
        const page = Math.max(1, options.page ?? 1);
        const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, options.pageSize ?? DEFAULT_PAGE_SIZE));
        const offset = (page - 1) * pageSize;
        const conditions = [eq(clients.tenantId, tenantId)];
        if (options.status) {
            conditions.push(eq(clients.status, options.status));
        }
        const whereClause = and(...conditions);
        const countResult = await db
            .select({ count: sql `count(*)` })
            .from(clients)
            .where(whereClause);
        const total = Number(countResult[0]?.count || 0);
        const rows = await db
            .select()
            .from(clients)
            .where(whereClause)
            .orderBy(desc(clients.createdAt), desc(clients.id))
            .limit(pageSize)
            .offset(offset);
        return {
            items: rows.map((row) => this.mapToAggregate(row)),
            total,
            page,
            pageSize,
        };
    }
    async searchClients(queryText, scope, page = DEFAULT_PAGE_SIZE, pageSize = DEFAULT_PAGE_SIZE) {
        const boundedPage = Math.max(1, page);
        const boundedPageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, pageSize));
        const offset = (boundedPage - 1) * boundedPageSize;
        const normalizedQuery = queryText.trim().toLowerCase();
        const searchPattern = `%${normalizedQuery}%`;
        const scopeCondition = and(eq(clients.ownerId, scope.ownerId), eq(clients.tenantId, scope.tenantId));
        const searchCondition = or(sql `lower(${clients.profile}->>'name') LIKE ${searchPattern}`, sql `lower(${clients.primaryContact}->>'email') LIKE ${searchPattern}`, sql `lower(${clients.profile}->>'website') LIKE ${searchPattern}`, sql `lower(${clients.primaryContact}->>'firstName') LIKE ${searchPattern}`, sql `lower(${clients.primaryContact}->>'lastName') LIKE ${searchPattern}`, sql `lower(${clients.profile}->>'phone') LIKE ${searchPattern}`);
        const whereClause = and(scopeCondition, searchCondition);
        const countResult = await db
            .select({ count: sql `count(*)` })
            .from(clients)
            .where(whereClause);
        const total = Number(countResult[0]?.count || 0);
        const rows = await db
            .select()
            .from(clients)
            .where(whereClause)
            .orderBy(desc(clients.createdAt), desc(clients.id))
            .limit(boundedPageSize)
            .offset(offset);
        const items = rows.map((row) => {
            const profile = row.profile;
            const primaryContact = row.primaryContact ?? undefined;
            return {
                id: row.id,
                name: profile.name,
                status: row.status,
                email: primaryContact?.email,
                website: profile.website,
                firstName: primaryContact?.firstName,
                lastName: primaryContact?.lastName,
                phone: profile.phone,
                createdAt: row.createdAt,
            };
        });
        return {
            items,
            total,
            page: boundedPage,
            pageSize: boundedPageSize,
        };
    }
    async search(query, scope) {
        const engine = new ClientSearchEngine(this);
        return engine.search(query, scope);
    }
    mapToAggregate(row) {
        const profile = row.profile;
        const billingDetails = row.billingDetails ?? undefined;
        const primaryContact = row.primaryContact ?? undefined;
        const systemMetadata = {
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        };
        if (row.archivedAt) {
            systemMetadata.archivedAt = row.archivedAt;
        }
        if (row.closedAt) {
            systemMetadata.closedAt = row.closedAt;
        }
        if (row.suspendedAt) {
            systemMetadata.suspendedAt = row.suspendedAt;
        }
        return new Client({
            id: row.id,
            tenantId: row.tenantId,
            ownerId: row.ownerId,
            status: row.status,
            profile,
            billingDetails,
            primaryContact,
            systemMetadata,
        });
    }
}
function normalizePrimaryContactForStorage(contact) {
    if (!contact) {
        return null;
    }
    const normalized = { ...contact };
    if (typeof contact.firstName === "string") {
        normalized.firstName = contact.firstName.trim();
    }
    if (typeof contact.lastName === "string") {
        normalized.lastName = contact.lastName.trim();
    }
    if (typeof contact.email === "string") {
        normalized.email = contact.email.trim();
    }
    return normalized;
}
