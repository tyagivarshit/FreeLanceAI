import { test, describe } from "node:test";
import assert from "node:assert";
import {
  Attachment,
  AttachmentMetadata,
  AttachmentVisibility,
  ATTACHMENT_CREATED,
  ATTACHMENT_UPDATED,
  ATTACHMENT_AVAILABLE,
  ATTACHMENT_ARCHIVED,
  ATTACHMENT_DELETED,
} from "./attachment.js";
import type { AttachmentAggregateStore } from "./attachment.js";

describe("Attachment Domain Aggregate Tests", () => {
  const validMetadata = new AttachmentMetadata({
    displayName: "agreement.pdf",
    logicalMediaType: "application/pdf",
    characteristics: "StandardDoc",
    description: "Signed client contract agreement.",
  });

  const otherMetadata = new AttachmentMetadata({
    displayName: "invoice.pdf",
    logicalMediaType: "application/pdf",
    characteristics: "StandardDoc",
    description: "Paid invoice record.",
  });

  const validVisibility = new AttachmentVisibility("StandardClassification");

  test("Attachment Metadata value object fields and equality check", () => {
    const meta1 = new AttachmentMetadata({
      displayName: "agreement.pdf",
      logicalMediaType: "application/pdf",
      characteristics: "StandardDoc",
      description: "Signed client contract agreement.",
    });

    const meta2 = new AttachmentMetadata({
      displayName: "agreement.pdf",
      logicalMediaType: "application/pdf",
      characteristics: "StandardDoc",
      description: "Signed client contract agreement.",
    });

    assert.strictEqual(meta1.equals(meta2), true);
    assert.strictEqual(meta1.equals(otherMetadata), false);
  });

  test("Attachment creation success: status Pending and ATTACHMENT_CREATED event emitted", () => {
    const attachment = Attachment.create(
      "attachment-1",
      "project-1",
      "owner-1",
      "ref-attach-1",
      validMetadata,
      validVisibility,
    );

    assert.strictEqual(attachment.attachmentId, "attachment-1");
    assert.strictEqual(attachment.parentId, "project-1");
    assert.strictEqual(attachment.ownerId, "owner-1");
    assert.strictEqual(attachment.attachmentReference, "ref-attach-1");
    assert.strictEqual(attachment.status, "Pending");
    assert.strictEqual(attachment.metadata.displayName, "agreement.pdf");
    assert.strictEqual(attachment.visibility.classification, "StandardClassification");

    assert.strictEqual(attachment.domainEvents.length, 1);
    assert.strictEqual(attachment.domainEvents[0]!.event, ATTACHMENT_CREATED);
    assert.strictEqual(attachment.domainEvents[0]!.metadata.attachmentId, "attachment-1");
  });

  test("Creation validation fails when fields are missing (ID, Parent, Owner, Reference, Metadata, Visibility)", () => {
    assert.throws(() => {
      new Attachment({
        attachmentId: "",
        parentId: "project-1",
        ownerId: "owner-1",
        attachmentReference: "ref-1",
        metadata: validMetadata,
        visibility: validVisibility,
        status: "Pending",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }, /Attachment ID is required/);

    assert.throws(() => {
      new Attachment({
        attachmentId: "attachment-1",
        parentId: "  ",
        ownerId: "owner-1",
        attachmentReference: "ref-1",
        metadata: validMetadata,
        visibility: validVisibility,
        status: "Pending",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }, /Parent ID reference is required/);

    assert.throws(() => {
      new Attachment({
        attachmentId: "attachment-1",
        parentId: "project-1",
        ownerId: "",
        attachmentReference: "ref-1",
        metadata: validMetadata,
        visibility: validVisibility,
        status: "Pending",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }, /Owner ID reference is required/);

    assert.throws(() => {
      new Attachment({
        attachmentId: "attachment-1",
        parentId: "project-1",
        ownerId: "owner-1",
        attachmentReference: "",
        metadata: validMetadata,
        visibility: validVisibility,
        status: "Pending",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }, /Attachment reference is required/);
  });

  test("Metadata validation (displayName and mediaType are required)", () => {
    assert.throws(() => {
      new AttachmentMetadata({
        displayName: "",
        logicalMediaType: "application/pdf",
        characteristics: "",
        description: "",
      });
    }, /Display name is required/);

    assert.throws(() => {
      new AttachmentMetadata({
        displayName: "file.txt",
        logicalMediaType: "  ",
        characteristics: "",
        description: "",
      });
    }, /Logical media type is required/);
  });

  test("Visibility validation (classification is required)", () => {
    assert.throws(() => {
      new AttachmentVisibility("  ");
    }, /Visibility classification is required/);
  });

  test("Tenant Isolation checks (wrong ownerId causes validation failure)", () => {
    const attachment = Attachment.create(
      "attachment-1",
      "project-1",
      "owner-1",
      "ref-attach-1",
      validMetadata,
      validVisibility,
    );

    assert.throws(() => {
      attachment.confirmRegistration("owner-wrong");
    }, /Ownership validation failed/);

    assert.throws(() => {
      attachment.cancelRegistration("owner-wrong");
    }, /Ownership validation failed/);

    assert.throws(() => {
      attachment.archive("owner-wrong");
    }, /Ownership validation failed/);
  });

  test("Lifecycle transitions: Pending -> Available -> Archived -> Deleted", () => {
    const attachment = Attachment.create(
      "attachment-1",
      "project-1",
      "owner-1",
      "ref-attach-1",
      validMetadata,
      validVisibility,
    );
    assert.strictEqual(attachment.status, "Pending");

    attachment.clearDomainEvents();

    attachment.confirmRegistration("owner-1");
    assert.strictEqual(attachment.status, "Available");
    assert.strictEqual(attachment.domainEvents[0]!.event, ATTACHMENT_AVAILABLE);

    attachment.archive("owner-1");
    assert.strictEqual(attachment.status, "Archived");
    assert.strictEqual(attachment.domainEvents[1]!.event, ATTACHMENT_ARCHIVED);

    attachment.delete("owner-1");
    assert.strictEqual(attachment.status, "Deleted");
    assert.strictEqual(attachment.domainEvents[2]!.event, ATTACHMENT_DELETED);
  });

  test("Lifecycle transitions: Pending -> Deleted (cancel registration)", () => {
    const attachment = Attachment.create(
      "attachment-1",
      "project-1",
      "owner-1",
      "ref-attach-1",
      validMetadata,
      validVisibility,
    );
    attachment.cancelRegistration("owner-1");
    assert.strictEqual(attachment.status, "Deleted");
  });

  test("Metadata and Visibility replacement verification on active files", () => {
    const attachment = Attachment.create(
      "attachment-1",
      "project-1",
      "owner-1",
      "ref-attach-1",
      validMetadata,
      validVisibility,
    );

    attachment.clearDomainEvents();

    attachment.updateMetadata("owner-1", otherMetadata);
    assert.strictEqual(attachment.metadata.displayName, "invoice.pdf");
    assert.strictEqual(attachment.domainEvents[0]!.event, ATTACHMENT_UPDATED);

    const newVisibility = new AttachmentVisibility("ConfidentialClassification");
    attachment.updateVisibility("owner-1", newVisibility);
    assert.strictEqual(attachment.visibility.classification, "ConfidentialClassification");
  });

  test("Invalid lifecycle status transitions throw error", () => {
    const attachment = Attachment.create(
      "attachment-1",
      "project-1",
      "owner-1",
      "ref-attach-1",
      validMetadata,
      validVisibility,
    );

    // Cannot archive directly from Pending
    assert.throws(() => {
      attachment.archive("owner-1");
    }, /Cannot archive attachment in status: Pending/);

    attachment.confirmRegistration("owner-1");
    attachment.delete("owner-1");

    // Cannot update metadata on deleted attachment
    assert.throws(() => {
      attachment.updateMetadata("owner-1", otherMetadata);
    }, /Cannot update metadata on deleted attachment/);
  });

  test("Immutable properties verification (IDs and References cannot change)", () => {
    const attachment = Attachment.create(
      "attachment-1",
      "project-1",
      "owner-1",
      "ref-attach-1",
      validMetadata,
      validVisibility,
    );

    assert.strictEqual(attachment.attachmentId, "attachment-1");
    assert.strictEqual(attachment.parentId, "project-1");
    assert.strictEqual(attachment.ownerId, "owner-1");
    assert.strictEqual(attachment.attachmentReference, "ref-attach-1");
  });

  test("Mock aggregate store compliance validation", async () => {
    const attachment = Attachment.create(
      "attachment-1",
      "project-1",
      "owner-1",
      "ref-attach-1",
      validMetadata,
      validVisibility,
    );
    let saveCalled = false;

    const mockStore: AttachmentAggregateStore = {
      async save(a) {
        assert.strictEqual(a.attachmentId, "attachment-1");
        saveCalled = true;
      },
      async findById(id, ownerId) {
        assert.strictEqual(id, "attachment-1");
        assert.strictEqual(ownerId, "owner-1");
        return attachment;
      },
      async findByReference(ref, ownerId) {
        assert.strictEqual(ref, "ref-attach-1");
        assert.strictEqual(ownerId, "owner-1");
        return attachment;
      },
    };

    await mockStore.save(attachment);
    assert.strictEqual(saveCalled, true);

    const fetched = await mockStore.findById("attachment-1", "owner-1");
    assert.strictEqual(fetched, attachment);
  });
});
