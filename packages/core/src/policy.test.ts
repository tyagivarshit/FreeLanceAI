import { test, describe } from "node:test";
import assert from "node:assert";
import {
  Policy,
  PolicyReference,
  PolicyDefinition,
  PolicyMetadata,
  PolicyRuleSet,
  PolicyEvaluationResult,
  PolicyDecision,
  DecisionFingerprint,
  PolicySnapshot,
  POLICY_REGISTERED,
  POLICY_VALIDATED,
  POLICY_PUBLISHED,
  POLICY_ARCHIVED,
  POLICY_EVALUATED,
} from "./policy.js";
import type {
  PolicyAggregateStore,
  PolicyPersistenceContract,
  PolicyQueryProjection,
  PolicyDomainEvent,
} from "./policy.js";

describe("Policy Engine Domain Aggregate Root & Value Objects Tests", () => {
  const defaultDefinition = new PolicyDefinition(
    "Allow access to resource when role matches Admin",
  );
  const defaultMetadata = new PolicyMetadata({
    displayName: "Admin Authorization Policy",
    description: "Validates administrator governance rules.",
    purpose: "Access Control Isolation",
    policySummary: "Admin",
  });
  const defaultRuleSet = new PolicyRuleSet({
    logicalConstraints: ["RoleIsAdmin", "AccountActive"],
    complianceCriteria: ["User must have admin claim", "Account status must be verified"],
  });
  const defaultEvaluationResult = new PolicyEvaluationResult({
    decision: "ALLOW",
    reasonCode: "ROLE_MATCH",
    evaluationSummary: "All criteria matched successfully.",
    evaluatedAt: new Date(),
  });
  const defaultFingerprint = new DecisionFingerprint({
    decisionIdentifier: "dec-999",
    policyReferenceValue: "auth.admin.access",
    decisionType: "AccessApproval",
  });

  test("Policy creation success: status Draft, snapshot initialized, domain event emitted", () => {
    const policy = Policy.create(
      "pol-1",
      "auth.admin.access",
      "owner-123",
      defaultDefinition,
      defaultMetadata,
      defaultRuleSet,
      "snap-1",
    );

    assert.strictEqual(policy.id, "pol-1");
    assert.strictEqual(policy.reference, "auth.admin.access");
    assert.strictEqual(policy.ownerId, "owner-123");
    assert.strictEqual(policy.status, "Draft");
    assert.strictEqual(policy.evaluationResult, null);
    assert.strictEqual(policy.decisionFingerprint, null);

    // Snapshot completeness
    assert.strictEqual(policy.snapshots.length, 1);
    assert.strictEqual(policy.snapshots[0]!.snapshotId, "snap-1");
    assert.strictEqual(policy.snapshots[0]!.policyReferenceSnapshot.value, "auth.admin.access");
    assert.strictEqual(
      policy.snapshots[0]!.definitionSnapshot.governanceSpecification,
      "Allow access to resource when role matches Admin",
    );
    assert.strictEqual(
      policy.snapshots[0]!.metadataSnapshot.displayName,
      "Admin Authorization Policy",
    );
    assert.strictEqual(policy.snapshots[0]!.ruleSetSnapshot.logicalConstraints.length, 2);
    assert.strictEqual(policy.snapshots[0]!.evaluationResultSnapshot, null);
    assert.strictEqual(policy.snapshots[0]!.decisionFingerprintSnapshot, null);

    // Event publication
    assert.strictEqual(policy.domainEvents.length, 1);
    const event = policy.domainEvents[0] as PolicyDomainEvent;
    assert.strictEqual(event.eventType, POLICY_REGISTERED);
    assert.strictEqual(event.policyId, "pol-1");
    assert.strictEqual(event.reference, "auth.admin.access");
    assert.strictEqual(event.snapshotId, "snap-1");
    assert.strictEqual(event.ownerId, "owner-123");
  });

  test("Policy reference format validation rejects invalid keys", () => {
    assert.throws(() => {
      Policy.create(
        "pol-1",
        "auth..admin",
        "owner-123",
        defaultDefinition,
        defaultMetadata,
        defaultRuleSet,
        "snap-1",
      );
    }, /Invalid policy reference format/);

    assert.throws(() => {
      Policy.create(
        "pol-1",
        "Auth.Admin",
        "owner-123",
        defaultDefinition,
        defaultMetadata,
        defaultRuleSet,
        "snap-1",
      );
    }, /Invalid policy reference format/);
  });

  test("Missing owner throws validation error", () => {
    assert.throws(() => {
      Policy.create(
        "pol-1",
        "auth.admin.access",
        "",
        defaultDefinition,
        defaultMetadata,
        defaultRuleSet,
        "snap-1",
      );
    }, /Owner Reference is required/);
  });

  test("Metadata replacement allowed in Draft, rejected in non-Draft states", () => {
    const policy = Policy.create(
      "pol-1",
      "auth.admin.access",
      "owner-123",
      defaultDefinition,
      defaultMetadata,
      defaultRuleSet,
      "snap-1",
    );

    const newMetadata = new PolicyMetadata({
      displayName: "New Display Name",
      description: "New description.",
      purpose: "New purpose.",
      policySummary: "New summary",
    });

    policy.replaceMetadata("owner-123", newMetadata);
    assert.strictEqual(policy.metadata.displayName, "New Display Name");

    policy.validate("owner-123");
    assert.strictEqual(policy.status, "Validated");

    assert.throws(() => {
      policy.replaceMetadata("owner-123", defaultMetadata);
    }, /Cannot replace metadata when in status: Validated/);
  });

  test("Ownership validation isolates mutate operations", () => {
    const policy = Policy.create(
      "pol-1",
      "auth.admin.access",
      "owner-123",
      defaultDefinition,
      defaultMetadata,
      defaultRuleSet,
      "snap-1",
    );

    assert.throws(() => {
      policy.replaceMetadata("owner-wrong", defaultMetadata);
    }, /Ownership validation failed: unauthorized owner context/);

    assert.throws(() => {
      policy.validate("owner-wrong");
    }, /Ownership validation failed: unauthorized owner context/);
  });

  test("Invalid lifecycle status transitions throw errors", () => {
    const policy = Policy.create(
      "pol-1",
      "auth.admin.access",
      "owner-123",
      defaultDefinition,
      defaultMetadata,
      defaultRuleSet,
      "snap-1",
    );

    // Cannot publish directly from Draft
    assert.throws(() => {
      policy.publish("owner-123");
    }, /Cannot publish policy when in status: Draft/);

    // Cannot evaluate in Draft
    assert.throws(() => {
      policy.evaluate("owner-123", "snap-eval", defaultEvaluationResult, defaultFingerprint);
    }, /Cannot evaluate policy when in status: Draft/);
  });

  test("Lifecycle flow and evaluation behavior updates snapshot history", () => {
    const policy = Policy.create(
      "pol-1",
      "auth.admin.access",
      "owner-123",
      defaultDefinition,
      defaultMetadata,
      defaultRuleSet,
      "snap-1",
    );

    policy.validate("owner-123");
    assert.strictEqual(policy.status, "Validated");
    assert.strictEqual(policy.domainEvents[1]!.eventType, POLICY_VALIDATED);

    policy.publish("owner-123");
    assert.strictEqual(policy.status, "Published");
    assert.strictEqual(policy.domainEvents[2]!.eventType, POLICY_PUBLISHED);

    // Perform evaluation
    policy.clearDomainEvents();
    policy.evaluate("owner-123", "snap-2", defaultEvaluationResult, defaultFingerprint);

    assert.strictEqual(policy.status, "Published"); // Status stays Published
    assert.strictEqual(policy.evaluationResult!.decision, "ALLOW");
    assert.strictEqual(policy.evaluationResult!.reasonCode, "ROLE_MATCH");
    assert.strictEqual(policy.decisionFingerprint!.decisionIdentifier, "dec-999");
    assert.strictEqual(policy.snapshots.length, 2);
    assert.strictEqual(policy.snapshots[1]!.snapshotId, "snap-2");
    assert.strictEqual(policy.snapshots[1]!.evaluationResultSnapshot!.decision, "ALLOW");
    assert.strictEqual(
      policy.snapshots[1]!.decisionFingerprintSnapshot!.decisionIdentifier,
      "dec-999",
    );

    assert.strictEqual(policy.domainEvents.length, 1);
    assert.strictEqual(policy.domainEvents[0]!.eventType, POLICY_EVALUATED);
    assert.strictEqual(policy.domainEvents[0]!.snapshotId, "snap-2");

    // Test Archiving
    policy.clearDomainEvents();
    policy.archive("owner-123");
    assert.strictEqual(policy.status, "Archived");
    assert.strictEqual(policy.domainEvents.length, 1);
    assert.strictEqual(policy.domainEvents[0]!.eventType, POLICY_ARCHIVED);

    assert.throws(() => {
      policy.evaluate("owner-123", "snap-3", defaultEvaluationResult, defaultFingerprint);
    }, /Cannot evaluate policy when in status: Archived/);
  });

  test("Append-only snapshot history is structurally frozen", () => {
    const policy = Policy.create(
      "pol-1",
      "auth.admin.access",
      "owner-123",
      defaultDefinition,
      defaultMetadata,
      defaultRuleSet,
      "snap-1",
    );

    const snapshots = policy.snapshots;
    assert.throws(() => {
      (snapshots as unknown as PolicySnapshot[]).push(
        new PolicySnapshot({
          snapshotId: "snap-hack",
          policyReferenceSnapshot: new PolicyReference("auth.admin.access"),
          definitionSnapshot: defaultDefinition,
          metadataSnapshot: defaultMetadata,
          ruleSetSnapshot: defaultRuleSet,
          evaluationResultSnapshot: null,
          decisionFingerprintSnapshot: null,
          lifecycleSnapshot: "Draft",
          capturedAt: new Date(),
        }),
      );
    });
    assert.strictEqual(policy.snapshots.length, 1);
  });

  test("Logical References and DecisionFingerprint value objects immutability", () => {
    // 1. PolicyReference Validation
    assert.throws(() => {
      new PolicyReference("");
    }, /Policy Reference is required/);

    // 2. PolicyDefinition Validation
    assert.throws(() => {
      new PolicyDefinition("");
    }, /Governance specification is required/);

    // 3. PolicyRuleSet Validation
    assert.throws(() => {
      new PolicyRuleSet({ logicalConstraints: [], complianceCriteria: ["Criteria"] });
    }, /Logical constraints must not be empty/);

    assert.throws(() => {
      new PolicyRuleSet({ logicalConstraints: ["Rule"], complianceCriteria: [] });
    }, /Compliance criteria must not be empty/);

    // 4. PolicyEvaluationResult Validation
    assert.throws(() => {
      new PolicyEvaluationResult({
        decision: "ALLOW",
        reasonCode: "",
        evaluationSummary: "Summary",
        evaluatedAt: new Date(),
      });
    }, /Reason code is required/);

    assert.throws(() => {
      new PolicyEvaluationResult({
        decision: "ALLOW",
        reasonCode: "CODE",
        evaluationSummary: "",
        evaluatedAt: new Date(),
      });
    }, /Evaluation summary is required/);

    assert.throws(() => {
      new PolicyEvaluationResult({
        decision: "BAD_DECISION" as unknown as PolicyDecision,
        reasonCode: "CODE",
        evaluationSummary: "Summary",
        evaluatedAt: new Date(),
      });
    }, /Invalid policy decision value/);

    // 5. DecisionFingerprint Validation
    assert.throws(() => {
      new DecisionFingerprint({
        decisionIdentifier: "",
        policyReferenceValue: "auth.admin.access",
        decisionType: "AccessApproval",
      });
    }, /Decision identifier is required/);

    assert.throws(() => {
      new DecisionFingerprint({
        decisionIdentifier: "dec-1",
        policyReferenceValue: "",
        decisionType: "AccessApproval",
      });
    }, /Policy reference value is required/);

    assert.throws(() => {
      new DecisionFingerprint({
        decisionIdentifier: "dec-1",
        policyReferenceValue: "auth.admin.access",
        decisionType: "",
      });
    }, /Decision type is required/);

    // Verification of no hashing values/leakage inside DecisionFingerprint
    const fp = new DecisionFingerprint({
      decisionIdentifier: "dec-1",
      policyReferenceValue: "auth.admin.access",
      decisionType: "AccessApproval",
    });
    assert.strictEqual(fp.decisionIdentifier, "dec-1");
    assert.strictEqual(fp.policyReferenceValue, "auth.admin.access");
    assert.strictEqual(fp.decisionType, "AccessApproval");

    // Equality verification
    const fp2 = new DecisionFingerprint({
      decisionIdentifier: "dec-1",
      policyReferenceValue: "auth.admin.access",
      decisionType: "AccessApproval",
    });
    assert.strictEqual(fp.equals(fp2), true);
  });

  test("Persistence layer abstractions compliance", async () => {
    const policy = Policy.create(
      "pol-1",
      "auth.admin.access",
      "owner-123",
      defaultDefinition,
      defaultMetadata,
      defaultRuleSet,
      "snap-1",
    );

    const mockStore: PolicyAggregateStore = {
      save: async (p) => {
        assert.strictEqual(p.id, "pol-1");
      },
      findById: async (id, ownerId) => {
        assert.strictEqual(id, "pol-1");
        assert.strictEqual(ownerId, "owner-123");
        return policy;
      },
      findByReference: async (ref, ownerId) => {
        assert.strictEqual(ref, "auth.admin.access");
        assert.strictEqual(ownerId, "owner-123");
        return policy;
      },
    };

    await mockStore.save(policy);
    const fetched = await mockStore.findById("pol-1", "owner-123");
    assert.strictEqual(fetched, policy);

    const mockPersistence: PolicyPersistenceContract = {
      checkUniqueReference: async (ownerId, ref) => {
        assert.strictEqual(ownerId, "owner-123");
        assert.strictEqual(ref, "auth.admin.access");
        return true;
      },
    };

    const isUnique = await mockPersistence.checkUniqueReference("owner-123", "auth.admin.access");
    assert.strictEqual(isUnique, true);

    const projection: PolicyQueryProjection = {
      id: "pol-1",
      reference: "auth.admin.access",
      ownerId: "owner-123",
      displayName: "Admin Authorization Policy",
      status: "Published",
      updatedAt: new Date(),
    };

    assert.strictEqual(projection.status, "Published");
  });
});
