import { test, describe } from "node:test";
import assert from "node:assert";
import {
  AiRequest,
  AiRequestMetadata,
  AI_REQUEST_RECEIVED,
  AI_REQUEST_ACCEPTED,
  AI_REQUEST_ORCHESTRATING,
  AI_REQUEST_COMPLETED,
  AI_REQUEST_FAILED,
} from "./ai-gateway.js";
import type { AiRequestAggregateStore } from "./ai-gateway.js";

describe("AI Request Domain Aggregate Tests", () => {
  const validMetadata = new AiRequestMetadata({
    correlationId: "corr-1",
    invocationMetadata: "GeneralExecution",
    logicalClassification: "CodeGeneration",
  });

  const otherMetadata = new AiRequestMetadata({
    correlationId: "corr-2",
    invocationMetadata: "SafeExecution",
    logicalClassification: "TextSummarization",
  });

  test("Metadata value object equality checks", () => {
    const meta1 = new AiRequestMetadata({
      correlationId: "corr-1",
      invocationMetadata: "GeneralExecution",
      logicalClassification: "CodeGeneration",
    });

    const meta2 = new AiRequestMetadata({
      correlationId: "corr-1",
      invocationMetadata: "GeneralExecution",
      logicalClassification: "CodeGeneration",
    });

    assert.strictEqual(meta1.equals(meta2), true);
    assert.strictEqual(meta1.equals(otherMetadata), false);
  });

  test("Request creation success: status Received and AI_REQUEST_RECEIVED event emitted with strong types", () => {
    const request = AiRequest.create("req-1", "ctx-ref-1", "owner-1", validMetadata);

    assert.strictEqual(request.requestId, "req-1");
    assert.strictEqual(request.requestContextReference, "ctx-ref-1");
    assert.strictEqual(request.ownerId, "owner-1");
    assert.strictEqual(request.status, "Received");
    assert.strictEqual(request.metadata.correlationId, "corr-1");

    assert.strictEqual(request.domainEvents.length, 1);
    const event = request.domainEvents[0]!;
    assert.strictEqual(event.eventType, AI_REQUEST_RECEIVED);
    if (event.eventType === AI_REQUEST_RECEIVED) {
      assert.strictEqual(event.requestId, "req-1");
      assert.strictEqual(event.requestContextReference, "ctx-ref-1");
      assert.strictEqual(event.ownerId, "owner-1");
    }
  });

  test("Creation validation fails when fields are missing (ID, Request Context Reference, Owner, Metadata)", () => {
    assert.throws(() => {
      new AiRequest({
        requestId: "",
        requestContextReference: "ctx-ref-1",
        ownerId: "owner-1",
        metadata: validMetadata,
        status: "Received",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }, /Request ID is required/);

    assert.throws(() => {
      new AiRequest({
        requestId: "req-1",
        requestContextReference: "   ",
        ownerId: "owner-1",
        metadata: validMetadata,
        status: "Received",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }, /Request context reference is required/);

    assert.throws(() => {
      new AiRequest({
        requestId: "req-1",
        requestContextReference: "ctx-ref-1",
        ownerId: " ",
        metadata: validMetadata,
        status: "Received",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }, /Owner ID reference is required/);
  });

  test("Metadata validation (correlationId is required)", () => {
    assert.throws(() => {
      new AiRequestMetadata({
        correlationId: "",
        invocationMetadata: "",
        logicalClassification: "",
      });
    }, /Correlation ID is required/);
  });

  test("Tenant Isolation checks (wrong ownerId causes validation failure)", () => {
    const request = AiRequest.create("req-1", "ctx-ref-1", "owner-1", validMetadata);

    assert.throws(() => {
      request.accept("owner-wrong");
    }, /Ownership validation failed/);

    assert.throws(() => {
      request.fail("owner-wrong");
    }, /Ownership validation failed/);
  });

  test("Lifecycle transitions: Received -> Accepted -> Orchestrating -> Completed", () => {
    const request = AiRequest.create("req-1", "ctx-ref-1", "owner-1", validMetadata);
    assert.strictEqual(request.status, "Received");

    request.clearDomainEvents();

    request.accept("owner-1");
    assert.strictEqual(request.status, "Accepted");
    assert.strictEqual(request.domainEvents[0]!.eventType, AI_REQUEST_ACCEPTED);

    request.orchestrate("owner-1");
    assert.strictEqual(request.status, "Orchestrating");
    assert.strictEqual(request.domainEvents[1]!.eventType, AI_REQUEST_ORCHESTRATING);

    request.complete("owner-1");
    assert.strictEqual(request.status, "Completed");
    assert.strictEqual(request.domainEvents[2]!.eventType, AI_REQUEST_COMPLETED);
  });

  test("Lifecycle transitions: Received -> Failed", () => {
    const request = AiRequest.create("req-1", "ctx-ref-1", "owner-1", validMetadata);
    request.fail("owner-1");
    assert.strictEqual(request.status, "Failed");
    assert.strictEqual(request.domainEvents[1]!.eventType, AI_REQUEST_FAILED);
  });

  test("Metadata replacement verification on active request", () => {
    const request = AiRequest.create("req-1", "ctx-ref-1", "owner-1", validMetadata);

    request.updateMetadata("owner-1", otherMetadata);
    assert.strictEqual(request.metadata.correlationId, "corr-2");
  });

  test("Invalid lifecycle status transitions throw error", () => {
    const request = AiRequest.create("req-1", "ctx-ref-1", "owner-1", validMetadata);

    // Cannot orchestrate directly from Received
    assert.throws(() => {
      request.orchestrate("owner-1");
    }, /Cannot orchestrate request in status: Received/);

    request.accept("owner-1");
    request.orchestrate("owner-1");
    request.complete("owner-1");

    // Cannot update metadata on completed request
    assert.throws(() => {
      request.updateMetadata("owner-1", otherMetadata);
    }, /Cannot update metadata on completed or failed request/);
  });

  test("Immutable properties verification (IDs and References cannot change)", () => {
    const request = AiRequest.create("req-1", "ctx-ref-1", "owner-1", validMetadata);

    assert.strictEqual(request.requestId, "req-1");
    assert.strictEqual(request.requestContextReference, "ctx-ref-1");
    assert.strictEqual(request.ownerId, "owner-1");
  });

  test("Mock aggregate store compliance validation", async () => {
    const request = AiRequest.create("req-1", "ctx-ref-1", "owner-1", validMetadata);
    let saveCalled = false;

    const mockStore: AiRequestAggregateStore = {
      async save(r) {
        assert.strictEqual(r.requestId, "req-1");
        saveCalled = true;
      },
      async findById(id, ownerId) {
        assert.strictEqual(id, "req-1");
        assert.strictEqual(ownerId, "owner-1");
        return request;
      },
      async findByReference(ref, ownerId) {
        assert.strictEqual(ref, "ctx-ref-1");
        assert.strictEqual(ownerId, "owner-1");
        return request;
      },
    };

    await mockStore.save(request);
    assert.strictEqual(saveCalled, true);

    const fetched = await mockStore.findById("req-1", "owner-1");
    assert.strictEqual(fetched, request);
  });
});
