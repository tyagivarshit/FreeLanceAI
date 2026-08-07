import { test, describe } from "node:test";
import assert from "node:assert";
import {
  Repository,
  RepositoryMetadata,
  RepositoryVisibility,
  REPOSITORY_REGISTERED,
  REPOSITORY_UPDATED,
  REPOSITORY_AVAILABLE,
  REPOSITORY_ARCHIVED,
  REPOSITORY_REMOVED,
} from "./repository.js";
import type { RepositoryAggregateStore } from "./repository.js";

describe("Repository Domain Aggregate Tests", () => {
  const validMetadata = new RepositoryMetadata({
    displayName: "freelanceos-core",
    characteristics: "StandardClassification",
    description: "Core project domain models.",
  });

  const otherMetadata = new RepositoryMetadata({
    displayName: "freelanceos-web",
    characteristics: "StandardClassification",
    description: "Web frontend application.",
  });

  const validVisibility = new RepositoryVisibility("StandardClassification");

  test("Repository Metadata value object fields and equality check", () => {
    const meta1 = new RepositoryMetadata({
      displayName: "freelanceos-core",
      characteristics: "StandardClassification",
      description: "Core project domain models.",
    });

    const meta2 = new RepositoryMetadata({
      displayName: "freelanceos-core",
      characteristics: "StandardClassification",
      description: "Core project domain models.",
    });

    assert.strictEqual(meta1.equals(meta2), true);
    assert.strictEqual(meta1.equals(otherMetadata), false);
  });

  test("Repository creation success: status Pending and REPOSITORY_REGISTERED event emitted", () => {
    const repository = Repository.create(
      "repo-1",
      "project-1",
      "owner-1",
      "ref-repo-1",
      validMetadata,
      validVisibility,
    );

    assert.strictEqual(repository.repositoryId, "repo-1");
    assert.strictEqual(repository.projectId, "project-1");
    assert.strictEqual(repository.ownerId, "owner-1");
    assert.strictEqual(repository.repositoryReference, "ref-repo-1");
    assert.strictEqual(repository.status, "Pending");
    assert.strictEqual(repository.metadata.displayName, "freelanceos-core");
    assert.strictEqual(repository.visibility.classification, "StandardClassification");

    assert.strictEqual(repository.domainEvents.length, 1);
    assert.strictEqual(repository.domainEvents[0]!.event, REPOSITORY_REGISTERED);
    assert.strictEqual(repository.domainEvents[0]!.metadata.repositoryId, "repo-1");
  });

  test("Creation validation fails when fields are missing (ID, Parent, Owner, Reference, Metadata, Visibility)", () => {
    assert.throws(() => {
      new Repository({
        repositoryId: "",
        projectId: "project-1",
        ownerId: "owner-1",
        repositoryReference: "ref-1",
        metadata: validMetadata,
        visibility: validVisibility,
        status: "Pending",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }, /Repository ID is required/);

    assert.throws(() => {
      new Repository({
        repositoryId: "repo-1",
        projectId: "  ",
        ownerId: "owner-1",
        repositoryReference: "ref-1",
        metadata: validMetadata,
        visibility: validVisibility,
        status: "Pending",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }, /Project ID reference is required/);

    assert.throws(() => {
      new Repository({
        repositoryId: "repo-1",
        projectId: "project-1",
        ownerId: "",
        repositoryReference: "ref-1",
        metadata: validMetadata,
        visibility: validVisibility,
        status: "Pending",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }, /Owner ID reference is required/);

    assert.throws(() => {
      new Repository({
        repositoryId: "repo-1",
        projectId: "project-1",
        ownerId: "owner-1",
        repositoryReference: "",
        metadata: validMetadata,
        visibility: validVisibility,
        status: "Pending",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }, /Repository reference is required/);
  });

  test("Metadata validation (displayName is required)", () => {
    assert.throws(() => {
      new RepositoryMetadata({
        displayName: "",
        characteristics: "",
        description: "",
      });
    }, /Display name is required/);
  });

  test("Visibility validation (classification is required)", () => {
    assert.throws(() => {
      new RepositoryVisibility("  ");
    }, /Visibility classification is required/);
  });

  test("Tenant Isolation checks (wrong ownerId causes validation failure)", () => {
    const repository = Repository.create(
      "repo-1",
      "project-1",
      "owner-1",
      "ref-repo-1",
      validMetadata,
      validVisibility,
    );

    assert.throws(() => {
      repository.confirmRegistration("owner-wrong");
    }, /Ownership validation failed/);

    assert.throws(() => {
      repository.cancelRegistration("owner-wrong");
    }, /Ownership validation failed/);

    assert.throws(() => {
      repository.archive("owner-wrong");
    }, /Ownership validation failed/);
  });

  test("Lifecycle transitions: Pending -> Available -> Archived -> Removed", () => {
    const repository = Repository.create(
      "repo-1",
      "project-1",
      "owner-1",
      "ref-repo-1",
      validMetadata,
      validVisibility,
    );
    assert.strictEqual(repository.status, "Pending");

    repository.clearDomainEvents();

    repository.confirmRegistration("owner-1");
    assert.strictEqual(repository.status, "Available");
    assert.strictEqual(repository.domainEvents[0]!.event, REPOSITORY_AVAILABLE);

    repository.archive("owner-1");
    assert.strictEqual(repository.status, "Archived");
    assert.strictEqual(repository.domainEvents[1]!.event, REPOSITORY_ARCHIVED);

    repository.remove("owner-1");
    assert.strictEqual(repository.status, "Removed");
    assert.strictEqual(repository.domainEvents[2]!.event, REPOSITORY_REMOVED);
  });

  test("Lifecycle transitions: Pending -> Removed (cancel registration)", () => {
    const repository = Repository.create(
      "repo-1",
      "project-1",
      "owner-1",
      "ref-repo-1",
      validMetadata,
      validVisibility,
    );
    repository.cancelRegistration("owner-1");
    assert.strictEqual(repository.status, "Removed");
  });

  test("Metadata and Visibility replacement verification on active repositories", () => {
    const repository = Repository.create(
      "repo-1",
      "project-1",
      "owner-1",
      "ref-repo-1",
      validMetadata,
      validVisibility,
    );

    repository.clearDomainEvents();

    repository.updateMetadata("owner-1", otherMetadata);
    assert.strictEqual(repository.metadata.displayName, "freelanceos-web");
    assert.strictEqual(repository.domainEvents[0]!.event, REPOSITORY_UPDATED);

    const newVisibility = new RepositoryVisibility("ConfidentialClassification");
    repository.updateVisibility("owner-1", newVisibility);
    assert.strictEqual(repository.visibility.classification, "ConfidentialClassification");
  });

  test("Invalid lifecycle status transitions throw error", () => {
    const repository = Repository.create(
      "repo-1",
      "project-1",
      "owner-1",
      "ref-repo-1",
      validMetadata,
      validVisibility,
    );

    // Cannot archive directly from Pending
    assert.throws(() => {
      repository.archive("owner-1");
    }, /Cannot archive repository in status: Pending/);

    repository.confirmRegistration("owner-1");
    repository.remove("owner-1");

    // Cannot update metadata on removed repository
    assert.throws(() => {
      repository.updateMetadata("owner-1", otherMetadata);
    }, /Cannot update metadata on removed repository/);
  });

  test("Immutable properties verification (IDs and References cannot change)", () => {
    const repository = Repository.create(
      "repo-1",
      "project-1",
      "owner-1",
      "ref-repo-1",
      validMetadata,
      validVisibility,
    );

    assert.strictEqual(repository.repositoryId, "repo-1");
    assert.strictEqual(repository.projectId, "project-1");
    assert.strictEqual(repository.ownerId, "owner-1");
    assert.strictEqual(repository.repositoryReference, "ref-repo-1");
  });

  test("Mock aggregate store compliance validation", async () => {
    const repository = Repository.create(
      "repo-1",
      "project-1",
      "owner-1",
      "ref-repo-1",
      validMetadata,
      validVisibility,
    );
    let saveCalled = false;

    const mockStore: RepositoryAggregateStore = {
      async save(r) {
        assert.strictEqual(r.repositoryId, "repo-1");
        saveCalled = true;
      },
      async findById(id, ownerId) {
        assert.strictEqual(id, "repo-1");
        assert.strictEqual(ownerId, "owner-1");
        return repository;
      },
      async findByReference(ref, ownerId) {
        assert.strictEqual(ref, "ref-repo-1");
        assert.strictEqual(ownerId, "owner-1");
        return repository;
      },
    };

    await mockStore.save(repository);
    assert.strictEqual(saveCalled, true);

    const fetched = await mockStore.findById("repo-1", "owner-1");
    assert.strictEqual(fetched, repository);
  });
});
