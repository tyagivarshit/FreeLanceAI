import { eq, and, desc, sql, ne } from "drizzle-orm";
import { db } from "../client.js";
import { clients } from "../schema/clients.js";
import {
  Client,
  AggregateStore,
  DomainPersistenceContract,
  ClientStatus,
  ClientProfile,
  BillingDetails,
  PrimaryContact,
  SystemMetadata,
} from "@freelanceos/core";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export interface ClientListOptions {
  page?: number;
  pageSize?: number;
  status?: ClientStatus;
}

export type ClientExternalIdentity =
  | {
      type: "primaryContactEmail";
      value: string;
    }
  | {
      type: "taxRegistrationId";
      value: string;
    };

export interface ClientListResult {
  items: Client[];
  total: number;
  page: number;
  pageSize: number;
}

export class PostgresClientRepository implements AggregateStore, DomainPersistenceContract {
  public async create(client: Client): Promise<void> {
    await client.validateUniqueness(this);
    await this.save(client);
  }

  public async save(client: Client): Promise<void> {
    const tenantId = client.ownerId;
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

    await db
      .insert(clients)
      .values(values)
      .onConflictDoUpdate({
        target: [clients.id, clients.ownerId],
        set: {
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

  public async update(client: Client, ownerId: string): Promise<void> {
    if (client.ownerId !== ownerId) {
      throw new Error("Ownership validation failed.");
    }

    const existing = await this.findById(client.id, ownerId);
    if (!existing) {
      throw new Error("Client not found.");
    }

    await client.validateUniqueness(this);
    await this.save(client);
  }

  public async getById(id: string, ownerId: string): Promise<Client | null> {
    return this.findById(id, ownerId);
  }

  public async findById(id: string, ownerId: string): Promise<Client | null> {
    const rows = await db
      .select()
      .from(clients)
      .where(and(eq(clients.id, id), eq(clients.ownerId, ownerId)))
      .limit(1);

    if (rows.length === 0) {
      return null;
    }
    return this.mapToAggregate(rows[0]!);
  }

  /**
   * Tenant-scoped primary contact email lookup.
   * The Phase 8 Client domain defines email uniqueness per owner, not platform external IDs.
   */
  public async findByPrimaryContactEmail(ownerId: string, email: string): Promise<Client | null> {
    const normalizedEmail = email.trim().toLowerCase();
    const rows = await db
      .select()
      .from(clients)
      .where(
        and(
          eq(clients.ownerId, ownerId),
          sql`lower(trim(${clients.primaryContact}->>'email')) = ${normalizedEmail}`,
        ),
      )
      .limit(1);

    if (rows.length === 0) {
      return null;
    }
    return this.mapToAggregate(rows[0]!);
  }

  public async getByExternalIdentity(
    ownerId: string,
    identity: ClientExternalIdentity,
  ): Promise<Client | null> {
    if (identity.type === "primaryContactEmail") {
      return this.findByPrimaryContactEmail(ownerId, identity.value);
    }

    const normalizedTaxId = identity.value.trim();
    const rows = await db
      .select()
      .from(clients)
      .where(
        and(
          eq(clients.ownerId, ownerId),
          sql`trim(${clients.billingDetails}->>'taxRegistrationId') = ${normalizedTaxId}`,
        ),
      )
      .limit(1);

    if (rows.length === 0) {
      return null;
    }
    return this.mapToAggregate(rows[0]!);
  }

  public async checkUniqueEmail(
    ownerId: string,
    email: string,
    excludeClientId?: string,
  ): Promise<boolean> {
    const normalizedEmail = email.trim().toLowerCase();
    const conditions = [
      eq(clients.ownerId, ownerId),
      sql`lower(trim(${clients.primaryContact}->>'email')) = ${normalizedEmail}`,
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

  public async checkUniqueTaxId(
    ownerId: string,
    taxId: string,
    excludeClientId?: string,
  ): Promise<boolean> {
    const normalizedTaxId = taxId.trim();
    const conditions = [
      eq(clients.ownerId, ownerId),
      sql`trim(${clients.billingDetails}->>'taxRegistrationId') = ${normalizedTaxId}`,
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

  public async list(ownerId: string, options: ClientListOptions = {}): Promise<ClientListResult> {
    const page = Math.max(1, options.page ?? 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, options.pageSize ?? DEFAULT_PAGE_SIZE));
    const offset = (page - 1) * pageSize;

    const conditions = [eq(clients.ownerId, ownerId)];

    if (options.status) {
      conditions.push(eq(clients.status, options.status));
    }

    const whereClause = and(...conditions);

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
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

  private mapToAggregate(row: typeof clients.$inferSelect): Client {
    const profile = row.profile as ClientProfile;
    const billingDetails = (row.billingDetails as Partial<BillingDetails> | null) ?? undefined;
    const primaryContact = (row.primaryContact as Partial<PrimaryContact> | null) ?? undefined;

    const systemMetadata: SystemMetadata = {
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
      ownerId: row.ownerId,
      status: row.status,
      profile,
      billingDetails,
      primaryContact,
      systemMetadata,
    });
  }
}

function normalizePrimaryContactForStorage(
  contact: Partial<PrimaryContact> | undefined,
): Record<string, unknown> | null {
  if (!contact) {
    return null;
  }

  const normalized: Record<string, unknown> = { ...contact };

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
