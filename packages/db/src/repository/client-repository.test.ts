/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, describe, beforeEach, afterEach, before } from "node:test";
import assert from "node:assert";
import { db, pool } from "../client.js";
import { clients } from "../schema/clients.js";
import { PostgresClientRepository } from "./client-repository.js";
import { PostgresTimelineRepository } from "./timeline-repository.js";
import {
  deleteTestUsers,
  ensureMigrationsApplied,
  isPostgresAvailable,
  listMigrationFiles,
  truncateClientDomainTables,
} from "./postgres-integration-helper.js";
import { Client, ClientTimeline, AuthorizedSearchScope, SearchQuery } from "@freelanceos/core";

const originalSelect = db.select;
const originalInsert = db.insert;

describe("PostgresClientRepository Unit Tests", () => {
  let selectMockResult: any[] = [];
  let insertedValues: any[] = [];

  beforeEach(() => {
    selectMockResult = [];
    insertedValues = [];

    // @ts-expect-error db.select is read-only
    db.select = function () {
      const builder = {
        from: () => builder,
        where: () => builder,
        orderBy: () => builder,
        limit: () => {
          const promise = Promise.resolve(selectMockResult);
          // @ts-expect-error offset chain helper
          promise.offset = () => Promise.resolve(selectMockResult);
          return promise;
        },
      };
      return builder;
    };

    // @ts-expect-error db.insert is read-only
    db.insert = function (table: any) {
      return {
        values: (val: any) => {
          insertedValues.push({ table, val });
          return {
            onConflictDoUpdate: () => Promise.resolve([{ id: val.id }]),
          };
        },
      };
    };
  });

  afterEach(() => {
    db.select = originalSelect;
    db.insert = originalInsert;
  });

  test("1. Saves and serializes Client aggregate correctly", async () => {
    const repo = new PostgresClientRepository();
    const client = Client.create(
      "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      "8b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      {
        name: "Acme Corp",
        website: "https://acme.com",
      },
    );

    await repo.save(client);

    assert.strictEqual(insertedValues.length, 1);
    assert.strictEqual(insertedValues[0].table, clients);
    assert.strictEqual(insertedValues[0].val.id, "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d");
    assert.strictEqual(insertedValues[0].val.tenantId, "8b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d");
    assert.strictEqual(insertedValues[0].val.ownerId, "8b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d");
    assert.strictEqual(insertedValues[0].val.status, "Lead");
    assert.strictEqual(insertedValues[0].val.profile.name, "Acme Corp");
  });

  test("2. Retrieves and maps Client aggregate in findById", async () => {
    const repo = new PostgresClientRepository();
    selectMockResult = [
      {
        id: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
        tenantId: "8b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
        ownerId: "8b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
        status: "Lead",
        profile: { name: "Acme Corp" },
        billingDetails: null,
        primaryContact: { firstName: "Jane", lastName: "Doe", email: "jane@acme.com" },
        archivedAt: null,
        closedAt: null,
        suspendedAt: null,
        createdAt: new Date("2026-08-14T00:00:00.000Z"),
        updatedAt: new Date("2026-08-14T00:00:00.000Z"),
      },
    ];

    const result = await repo.findById(
      "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      "8b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    );

    assert.ok(result);
    assert.strictEqual(result.id, "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d");
    assert.strictEqual(result.profile.name, "Acme Corp");
    assert.strictEqual(result.primaryContact?.email, "jane@acme.com");
  });

  test("3. searchClients performs scoped matching and returns bounded result list", async () => {
    const repo = new PostgresClientRepository();
    selectMockResult = [
      {
        id: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
        tenantId: "8b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
        ownerId: "8b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
        status: "Active",
        profile: { name: "Acme Corp", website: "https://acme.com" },
        billingDetails: null,
        primaryContact: { firstName: "Jane", lastName: "Doe", email: "jane@acme.com" },
        createdAt: new Date("2026-08-14T00:00:00.000Z"),
        updatedAt: new Date("2026-08-14T00:00:00.000Z"),
      },
    ];

    const scope = new AuthorizedSearchScope({
      tenantId: "8b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      ownerId: "8b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    });

    const res = await repo.searchClients("Acme", scope, 1, 10);
    assert.strictEqual(res.items.length, 1);
    assert.strictEqual(res.items[0]?.name, "Acme Corp");
    assert.strictEqual(res.items[0]?.email, "jane@acme.com");
    assert.strictEqual(res.items[0]?.website, "https://acme.com");
    assert.strictEqual(res.page, 1);
    assert.strictEqual(res.pageSize, 10);
  });

  test("4. search provider executes search query and returns canonical SearchResultSet", async () => {
    const repo = new PostgresClientRepository();
    selectMockResult = [
      {
        id: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
        tenantId: "8b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
        ownerId: "8b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
        status: "Active",
        profile: { name: "Acme Corp", website: "https://acme.com" },
        billingDetails: null,
        primaryContact: { firstName: "Jane", lastName: "Doe", email: "jane@acme.com" },
        createdAt: new Date("2026-08-14T00:00:00.000Z"),
        updatedAt: new Date("2026-08-14T00:00:00.000Z"),
      },
    ];

    const scope = new AuthorizedSearchScope({
      tenantId: "8b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      ownerId: "8b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    });
    const query = new SearchQuery({ query: "Acme" });

    const resultSet = await repo.search(query, scope);
    assert.strictEqual(resultSet.count, 1);
    assert.strictEqual(resultSet.results[0]?.resultType, "CLIENT");
    assert.strictEqual(resultSet.results[0]?.entityId, "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d");
    assert.strictEqual(resultSet.results[0]?.display.title, "Acme Corp");
  });
});

describe("PostgresClientRepository PostgreSQL Integration Tests", () => {
  const tenantA = "11111111-1111-4111-8111-111111111111";
  const tenantB = "22222222-2222-4222-8222-222222222222";
  const clientA = "33333333-3333-4333-8333-333333333333";
  const clientB = "44444444-4444-4444-8444-444444444444";
  const timelineId = "55555555-5555-4555-8555-555555555555";
  const timelineEntryId = "66666666-6666-4666-8666-666666666666";
  const jobId = "77777777-7777-4777-8777-777777777777";
  const matchId = "88888888-8888-4888-8888-888888888888";

  let postgresAvailable = false;

  before(async () => {
    postgresAvailable = await isPostgresAvailable();
    if (!postgresAvailable) {
      return;
    }

    await ensureMigrationsApplied();
  });

  beforeEach(async () => {
    if (!postgresAvailable) {
      return;
    }

    await truncateClientDomainTables();
    await deleteTestUsers([tenantA, tenantB]);
    await pool.query(
      `
        INSERT INTO users (id, email, normalized_email, status)
        VALUES
          ($1, 'tenant-a@example.com', 'tenant-a@example.com', 'active'),
          ($2, 'tenant-b@example.com', 'tenant-b@example.com', 'active')
      `,
      [tenantA, tenantB],
    );
  });

  afterEach(async () => {
    if (!postgresAvailable) {
      return;
    }

    await truncateClientDomainTables();
    await deleteTestUsers([tenantA, tenantB]);
  });

  test("1. applies client migration and exposes the clients table", async (t) => {
    if (!postgresAvailable) {
      t.skip("PostgreSQL is not available for integration verification.");
      return;
    }

    await ensureMigrationsApplied();

    assert.ok(listMigrationFiles().includes("0003_client_domain_foundation.sql"));

    const tableResult = await pool.query<{ to_regclass: string | null }>(
      "SELECT to_regclass('public.clients')",
    );
    assert.strictEqual(tableResult.rows[0]?.to_regclass, "clients");
  });

  test("2. creates, reads, updates, and looks up a tenant-owned client", async (t) => {
    if (!postgresAvailable) {
      t.skip("PostgreSQL is not available for integration verification.");
      return;
    }

    const repo = new PostgresClientRepository();
    const created = new Date("2026-08-14T10:00:00.000Z");
    const client = new Client({
      id: clientA,
      ownerId: tenantA,
      status: "Lead",
      profile: { name: "Acme Corp", website: "https://acme.com" },
      primaryContact: { firstName: "Jane", lastName: "Doe", email: "jane@acme.com" },
      systemMetadata: { createdAt: created, updatedAt: created },
    });

    await repo.create(client);

    const read = await repo.getById(clientA, tenantA);
    assert.ok(read);
    assert.strictEqual(read.profile.name, "Acme Corp");
    assert.strictEqual(read.primaryContact?.email, "jane@acme.com");
    assert.strictEqual(read.systemMetadata.createdAt.toISOString(), created.toISOString());

    read.updateProfile(tenantA, { name: "Acme Studio", website: "https://acme.com" }, undefined, {
      firstName: "Jane",
      lastName: "Doe",
      email: "jane@acme.com",
    });
    await repo.update(read, tenantA);

    const updated = await repo.getByExternalIdentity(tenantA, {
      type: "primaryContactEmail",
      value: "  JANE@ACME.COM  ",
    });
    assert.ok(updated);
    assert.strictEqual(updated.profile.name, "Acme Studio");
    assert.ok(updated.systemMetadata.updatedAt instanceof Date);
  });

  test("3. rejects duplicate identity and cross-tenant access", async (t) => {
    if (!postgresAvailable) {
      t.skip("PostgreSQL is not available for integration verification.");
      return;
    }

    const repo = new PostgresClientRepository();
    const base = Client.create(clientA, tenantA, { name: "Acme Corp" }, undefined, {
      firstName: "Jane",
      lastName: "Doe",
      email: "dupe@acme.com",
    });
    await repo.create(base);

    const duplicate = Client.create(clientB, tenantA, { name: "Acme Duplicate" }, undefined, {
      firstName: "Janet",
      lastName: "Roe",
      email: "DUPE@ACME.COM",
    });
    await assert.rejects(() => repo.create(duplicate), /Duplicate client identity|duplicate key/);

    assert.strictEqual(await repo.getById(clientA, tenantB), null);

    await assert.rejects(() => repo.update(base, tenantB), /Ownership validation failed/);
  });

  test("4. bounds pagination with deterministic ordering", async (t) => {
    if (!postgresAvailable) {
      t.skip("PostgreSQL is not available for integration verification.");
      return;
    }

    const repo = new PostgresClientRepository();
    const clientsToCreate = [
      new Client({
        id: clientA,
        ownerId: tenantA,
        status: "Lead",
        profile: { name: "Alpha Client" },
        systemMetadata: {
          createdAt: new Date("2026-08-14T10:00:00.000Z"),
          updatedAt: new Date("2026-08-14T10:00:00.000Z"),
        },
      }),
      new Client({
        id: clientB,
        ownerId: tenantA,
        status: "Lead",
        profile: { name: "Beta Client" },
        systemMetadata: {
          createdAt: new Date("2026-08-15T10:00:00.000Z"),
          updatedAt: new Date("2026-08-15T10:00:00.000Z"),
        },
      }),
      new Client({
        id: "99999999-9999-4999-8999-999999999999",
        ownerId: tenantA,
        status: "Lead",
        profile: { name: "Gamma Client" },
        systemMetadata: {
          createdAt: new Date("2026-08-16T10:00:00.000Z"),
          updatedAt: new Date("2026-08-16T10:00:00.000Z"),
        },
      }),
    ];

    for (const item of clientsToCreate) {
      await repo.create(item);
    }

    const page = await repo.list(tenantA, { page: 1, pageSize: 2 });
    assert.strictEqual(page.total, 3);
    assert.strictEqual(page.pageSize, 2);
    assert.deepStrictEqual(
      page.items.map((item) => item.profile.name),
      ["Gamma Client", "Beta Client"],
    );

    const capped = await repo.list(tenantA, { page: 1, pageSize: 500 });
    assert.strictEqual(capped.pageSize, 100);
  });

  test("5. enforces concurrent duplicate protection at the database layer", async (t) => {
    if (!postgresAvailable) {
      t.skip("PostgreSQL is not available for integration verification.");
      return;
    }

    const concurrentA = Client.create(
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      tenantA,
      { name: "Concurrent One" },
      undefined,
      { firstName: "Same", lastName: "Email", email: "race@acme.com" },
    );
    const concurrentB = Client.create(
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      tenantA,
      { name: "Concurrent Two" },
      undefined,
      { firstName: "Same", lastName: "Email", email: "RACE@ACME.COM" },
    );

    const results = await Promise.allSettled([
      new PostgresClientRepository().create(concurrentA),
      new PostgresClientRepository().create(concurrentB),
    ]);

    assert.strictEqual(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.strictEqual(results.filter((result) => result.status === "rejected").length, 1);
  });

  test("6. verifies job, match, and timeline relationships", async (t) => {
    if (!postgresAvailable) {
      t.skip("PostgreSQL is not available for integration verification.");
      return;
    }

    const repo = new PostgresClientRepository();
    await repo.create(
      Client.create(clientA, tenantA, { name: "Relationship Client" }, undefined, {
        firstName: "Rhea",
        lastName: "Link",
        email: "relationship@acme.com",
      }),
    );

    await pool.query(
      `
        INSERT INTO job_imports (
          id, tenant_id, owner_id, client_id, source, external_job_id, imported_at,
          raw_payload, fingerprint, status
        )
        VALUES ($1, $2, $2, $3, 'upwork', 'job-client-1', now(), '{}'::jsonb, 'fp-client-1', 'RECEIVED')
      `,
      [jobId, tenantA, clientA],
    );

    await pool.query(
      `
        INSERT INTO job_matches (
          id, tenant_id, owner_id, freelancer_id, job_id, job_normalization_id,
          normalization_version, matching_version, status
        )
        VALUES ($1, $2, $2, $2, $3, 'norm-client-1', 'v1', 'v1', 'CREATED')
      `,
      [matchId, tenantA, jobId],
    );

    const joinResult = await pool.query<{ client_id: string }>(
      `
        SELECT c.id AS client_id
        FROM job_matches jm
        JOIN job_imports ji ON ji.id = jm.job_id AND ji.tenant_id = jm.tenant_id
        JOIN clients c ON c.id = ji.client_id AND c.tenant_id = ji.tenant_id
        WHERE jm.id = $1 AND jm.tenant_id = $2
      `,
      [matchId, tenantA],
    );
    assert.strictEqual(joinResult.rows[0]?.client_id, clientA);

    await assert.rejects(
      () =>
        pool.query(
          `
            INSERT INTO job_imports (
              id, tenant_id, owner_id, client_id, source, external_job_id, imported_at,
              raw_payload, fingerprint, status
            )
            VALUES (
              '12121212-1212-4121-8121-121212121212', $1, $1, $2, 'upwork',
              'cross-tenant-client', now(), '{}'::jsonb, 'fp-cross-client', 'RECEIVED'
            )
          `,
          [tenantB, clientA],
        ),
      /foreign key|violates/,
    );

    const timeline = ClientTimeline.create(timelineId, clientA, tenantA);
    timeline.appendEntry(tenantA, tenantA, {
      entryId: timelineEntryId,
      category: "Lifecycle Event",
      timestamp: new Date("2026-08-14T10:00:00.000Z"),
      metadata: { source: "client-domain-test" },
      visibility: "Internal",
    });

    const timelineRepo = new PostgresTimelineRepository();
    await timelineRepo.save(timeline);

    const loadedTimeline = await timelineRepo.findByClientId(clientA, tenantA);
    assert.ok(loadedTimeline);
    assert.strictEqual(loadedTimeline.entries.length, 1);
  });

  test("7. rejects malformed client data and excludes secret columns", async (t) => {
    if (!postgresAvailable) {
      t.skip("PostgreSQL is not available for integration verification.");
      return;
    }

    assert.throws(
      () =>
        Client.create(clientA, tenantA, { name: "A" }, undefined, {
          firstName: "Bad",
          lastName: "Email",
          email: "not-an-email",
        }),
      /Client name must be between 2 and 100 characters/,
    );

    const columns = await pool.query<{ column_name: string }>(
      `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'clients'
      `,
    );
    const columnNames = columns.rows.map((row) => row.column_name);
    assert.strictEqual(columnNames.includes("password"), false);
    assert.strictEqual(columnNames.includes("token"), false);
    assert.strictEqual(columnNames.includes("session_cookie"), false);
    assert.strictEqual(columnNames.includes("stripe_secret"), false);
  });

  test("8. performs bounded client search with deterministic ordering and tenant isolation", async (t) => {
    if (!postgresAvailable) {
      t.skip("PostgreSQL is not available for integration verification.");
      return;
    }

    const repo = new PostgresClientRepository();
    const client1 = Client.create(
      "12345678-1234-4234-8234-123456789001",
      tenantA,
      { name: "Searchable Alpha Inc", website: "https://alpha.com" },
      undefined,
      { firstName: "Alice", lastName: "Smith", email: "alice@alpha.com" },
    );
    const client2 = Client.create(
      "12345678-1234-4234-8234-123456789002",
      tenantA,
      { name: "Alpha Technologies LLC", website: "https://alphatech.com" },
      undefined,
      { firstName: "Aaron", lastName: "Adams", email: "aaron@alphatech.com" },
    );
    const foreignClient = Client.create(
      "12345678-1234-4234-8234-123456789003",
      tenantB,
      { name: "Foreign Alpha Corp", website: "https://foreign-alpha.com" },
      undefined,
      { firstName: "Arthur", lastName: "Foreign", email: "arthur@foreign.com" },
    );

    await repo.create(client1);
    await repo.create(client2);
    await repo.create(foreignClient);

    const scopeA = new AuthorizedSearchScope({ tenantId: tenantA, ownerId: tenantA });
    const searchRes = await repo.search(new SearchQuery({ query: "Alpha" }), scopeA);

    assert.strictEqual(searchRes.total, 2);
    assert.strictEqual(searchRes.count, 2);
    for (const item of searchRes.results) {
      assert.notStrictEqual(item.entityId, "12345678-1234-4234-8234-123456789003");
    }
  });
});
