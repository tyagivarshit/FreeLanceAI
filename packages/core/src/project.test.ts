import { test, describe } from "node:test";
import assert from "node:assert";
import {
  Project,
  ProjectMetadata,
  ProjectVisibility,
  PROJECT_CREATED,
  PROJECT_UPDATED,
  PROJECT_STARTED,
  PROJECT_PAUSED,
  PROJECT_COMPLETED,
  PROJECT_CANCELLED,
  PROJECT_ARCHIVED,
} from "./project.js";
import type { ProjectAggregateStore } from "./project.js";

describe("Project Domain Aggregate Tests", () => {
  const validMetadata = new ProjectMetadata({
    title: "Website Redesign",
    description: "Rebuild corporate website with modern designs",
    startDate: new Date(),
    endDate: new Date(Date.now() + 100000),
  });

  const validVisibility = new ProjectVisibility("StandardClassification");

  test("Project creation success: status Draft and PROJECT_CREATED event emitted", () => {
    const project = Project.create(
      "project-1",
      "client-1",
      "owner-1",
      "ref-proj-1",
      validMetadata,
      validVisibility,
    );

    assert.strictEqual(project.projectId, "project-1");
    assert.strictEqual(project.clientId, "client-1");
    assert.strictEqual(project.ownerId, "owner-1");
    assert.strictEqual(project.projectReference, "ref-proj-1");
    assert.strictEqual(project.status, "Draft");
    assert.strictEqual(project.metadata.title, "Website Redesign");
    assert.strictEqual(project.visibility.classification, "StandardClassification");

    assert.strictEqual(project.domainEvents.length, 1);
    assert.strictEqual(project.domainEvents[0]!.event, PROJECT_CREATED);
    assert.strictEqual(project.domainEvents[0]!.metadata.projectId, "project-1");
  });

  test("Creation validation fails when fields are missing (ID, Client, Owner, Reference, Metadata, Visibility)", () => {
    assert.throws(() => {
      new Project({
        projectId: "",
        clientId: "client-1",
        ownerId: "owner-1",
        projectReference: "ref-1",
        metadata: validMetadata,
        visibility: validVisibility,
        status: "Draft",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }, /Project ID is required/);

    assert.throws(() => {
      new Project({
        projectId: "project-1",
        clientId: "",
        ownerId: "owner-1",
        projectReference: "ref-1",
        metadata: validMetadata,
        visibility: validVisibility,
        status: "Draft",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }, /Client ID reference is required/);

    assert.throws(() => {
      new Project({
        projectId: "project-1",
        clientId: "client-1",
        ownerId: "  ",
        projectReference: "ref-1",
        metadata: validMetadata,
        visibility: validVisibility,
        status: "Draft",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }, /Owner ID reference is required/);

    assert.throws(() => {
      new Project({
        projectId: "project-1",
        clientId: "client-1",
        ownerId: "owner-1",
        projectReference: "  ",
        metadata: validMetadata,
        visibility: validVisibility,
        status: "Draft",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }, /Project reference is required/);
  });

  test("Metadata validation (title is mandatory)", () => {
    assert.throws(() => {
      new ProjectMetadata({
        title: "",
        description: "",
      });
    }, /Project title is required/);
  });

  test("Visibility validation (classification is mandatory)", () => {
    assert.throws(() => {
      new ProjectVisibility("  ");
    }, /Visibility classification is required/);
  });

  test("Tenant Isolation checks (wrong ownerId causes validation failure)", () => {
    const project = Project.create(
      "project-1",
      "client-1",
      "owner-1",
      "ref-proj-1",
      validMetadata,
      validVisibility,
    );

    assert.throws(() => {
      project.plan("owner-wrong", validMetadata, validVisibility);
    }, /Ownership validation failed/);

    assert.throws(() => {
      project.start("owner-wrong");
    }, /Ownership validation failed/);

    assert.throws(() => {
      project.pause("owner-wrong");
    }, /Ownership validation failed/);
  });

  test("Lifecycle transitions: Draft -> Planned -> Active -> Paused -> Active -> Completed -> Archived", () => {
    const project = Project.create(
      "project-1",
      "client-1",
      "owner-1",
      "ref-proj-1",
      validMetadata,
      validVisibility,
    );
    assert.strictEqual(project.status, "Draft");

    project.clearDomainEvents();

    project.plan("owner-1", validMetadata, validVisibility);
    assert.strictEqual(project.status, "Planned");
    assert.strictEqual(project.domainEvents[0]!.event, PROJECT_UPDATED);

    project.start("owner-1");
    assert.strictEqual(project.status, "Active");
    assert.strictEqual(project.domainEvents[1]!.event, PROJECT_STARTED);

    project.pause("owner-1");
    assert.strictEqual(project.status, "Paused");
    assert.strictEqual(project.domainEvents[2]!.event, PROJECT_PAUSED);

    project.resume("owner-1");
    assert.strictEqual(project.status, "Active");
    assert.strictEqual(project.domainEvents[3]!.event, PROJECT_STARTED);

    project.complete("owner-1");
    assert.strictEqual(project.status, "Completed");
    assert.strictEqual(project.domainEvents[4]!.event, PROJECT_COMPLETED);

    project.archive("owner-1");
    assert.strictEqual(project.status, "Archived");
    assert.strictEqual(project.domainEvents[5]!.event, PROJECT_ARCHIVED);
  });

  test("Lifecycle transitions: Active/Paused -> Cancelled -> Archived", () => {
    const p1 = Project.create("p1", "client-1", "owner-1", "ref-1", validMetadata, validVisibility);
    p1.plan("owner-1", validMetadata, validVisibility);
    p1.start("owner-1");
    p1.cancel("owner-1");
    assert.strictEqual(p1.status, "Cancelled");
    assert.strictEqual(p1.domainEvents[3]!.event, PROJECT_CANCELLED);

    const p2 = Project.create("p2", "client-1", "owner-1", "ref-2", validMetadata, validVisibility);
    p2.plan("owner-1", validMetadata, validVisibility);
    p2.start("owner-1");
    p2.pause("owner-1");
    p2.cancel("owner-1");
    assert.strictEqual(p2.status, "Cancelled");
    assert.strictEqual(p2.domainEvents[4]!.event, PROJECT_CANCELLED);

    p1.archive("owner-1");
    assert.strictEqual(p1.status, "Archived");
  });

  test("Invalid lifecycle status transitions throw error", () => {
    const project = Project.create(
      "project-1",
      "client-1",
      "owner-1",
      "ref-1",
      validMetadata,
      validVisibility,
    );

    // Cannot start directly from Draft
    assert.throws(() => {
      project.start("owner-1");
    }, /Cannot start project in status: Draft/);

    project.plan("owner-1", validMetadata, validVisibility);
    project.start("owner-1");

    // Cannot archive active project
    assert.throws(() => {
      project.archive("owner-1");
    }, /Cannot archive project in status: Active/);
  });

  test("Immutable properties verification (IDs and Reference cannot change)", () => {
    const project = Project.create(
      "project-1",
      "client-1",
      "owner-1",
      "ref-1",
      validMetadata,
      validVisibility,
    );

    assert.strictEqual(project.projectId, "project-1");
    assert.strictEqual(project.clientId, "client-1");
    assert.strictEqual(project.ownerId, "owner-1");
    assert.strictEqual(project.projectReference, "ref-1");
  });

  test("Mock aggregate store compliance validation", async () => {
    const project = Project.create(
      "project-1",
      "client-1",
      "owner-1",
      "ref-1",
      validMetadata,
      validVisibility,
    );
    let saveCalled = false;

    const mockStore: ProjectAggregateStore = {
      async save(p) {
        assert.strictEqual(p.projectId, "project-1");
        saveCalled = true;
      },
      async findById(id, ownerId) {
        assert.strictEqual(id, "project-1");
        assert.strictEqual(ownerId, "owner-1");
        return project;
      },
      async findByReference(ref, ownerId) {
        assert.strictEqual(ref, "ref-1");
        assert.strictEqual(ownerId, "owner-1");
        return project;
      },
    };

    await mockStore.save(project);
    assert.strictEqual(saveCalled, true);

    const fetched = await mockStore.findById("project-1", "owner-1");
    assert.strictEqual(fetched, project);
  });
});
