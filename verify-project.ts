import { db, users, clients, projects } from "./packages/db/src/index.js";
import { PostgresProjectRepository } from "./packages/db/src/repository/project-repository.js";
import { Project, ProjectMetadata, ProjectVisibility } from "./packages/core/src/project.js";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

async function run() {
  console.log("=== Setting up test data ===");
  const repo = new PostgresProjectRepository();

  const tenant1Id = randomUUID();
  const tenant2Id = randomUUID();
  const client1Id = randomUUID();

  // Create Users (Tenants)
  await db.insert(users).values([
    { id: tenant1Id, email: "t1@example.com", normalizedEmail: "t1@example.com", status: "active" },
    { id: tenant2Id, email: "t2@example.com", normalizedEmail: "t2@example.com", status: "active" },
  ]);

  // Create Client
  await db.insert(clients).values({
    id: client1Id,
    tenantId: tenant1Id,
    ownerId: tenant1Id,
    status: "Active",
    profile: { name: "Test Client" },
  });

  console.log("1. Tenant isolation (one tenant can't see another's projects)");
  const proj1 = Project.create(
    randomUUID(),
    tenant1Id,
    client1Id,
    tenant1Id,
    "REF-123",
    new ProjectMetadata({ title: "T1 Project", description: "Desc" }),
    new ProjectVisibility("Confidential")
  );
  await repo.save(proj1);

  const foundByT1 = await repo.findById(proj1.projectId, tenant1Id);
  const foundByT2 = await repo.findById(proj1.projectId, tenant2Id);
  console.log("Found by T1:", foundByT1?.metadata?.title);
  console.log("Found by T2:", foundByT2?.metadata?.title ?? "null");

  console.log("\n2. User deletion blocked by tenant restrict");
  try {
    await db.delete(users).where(eq(users.id, tenant1Id));
    console.log("ERROR: User was deleted, but it should have been restricted!");
  } catch (err: any) {
    console.log("Blocked user deletion:", err.message);
  }

  console.log("\n3. Concurrent duplicate project_reference correctly rejected via real DB constraint");
  const proj2 = Project.create(
    randomUUID(),
    tenant1Id,
    client1Id,
    tenant1Id,
    "REF-123", // Duplicate ref
    new ProjectMetadata({ title: "T1 Project Dup", description: "Desc" }),
    new ProjectVisibility("Confidential")
  );
  try {
    await repo.save(proj2);
    console.log("ERROR: Duplicate reference was saved!");
  } catch (err: any) {
    console.log("Duplicate creation rejected:", err.message);
  }

  console.log("\n4. Status transition guards still work correctly");
  try {
    proj1.complete(tenant1Id); // Cannot complete from Draft
    await repo.save(proj1);
  } catch (err: any) {
    console.log("Status transition rejected:", err.message);
  }
  
  // Valid transition to prove update works
  proj1.plan(tenant1Id, new ProjectMetadata({ title: "T1 Project Planned", description: "Desc" }), new ProjectVisibility("Confidential"));
  await repo.save(proj1);
  const reloadedProj1 = await repo.findById(proj1.projectId, tenant1Id);
  console.log("Project successfully planned, status:", reloadedProj1?.status);

  console.log("\n5. Cascade behavior on client hard-delete");
  await db.delete(clients).where(eq(clients.id, client1Id));
  const projAfterClientDelete = await repo.findById(proj1.projectId, tenant1Id);
  console.log("Project after client hard-delete:", projAfterClientDelete ? "Exists" : "null (Cascaded)");

  console.log("\nCleaning up...");
  await db.delete(users).where(eq(users.id, tenant1Id));
  await db.delete(users).where(eq(users.id, tenant2Id));
  console.log("Done.");
  process.exit(0);
}

run().catch(console.error);
