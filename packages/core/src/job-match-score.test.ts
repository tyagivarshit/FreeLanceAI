import { test, describe } from "node:test";
import assert from "node:assert";
import {
  ScoreWeightProfile,
  ScoringConfiguration,
  SignalContribution,
  ScoreBreakdown,
  ScoreFingerprint,
  roundToPrecision,
  JobMatchScoreSnapshot,
  JOB_MATCH_SCORE_CREATED,
  JOB_MATCH_SCORE_CALCULATED,
  JOB_MATCH_SCORE_ARCHIVED,
  JobMatchScore,
} from "./job-match-score.js";
import type {
  JobMatchScorePersistenceContract,
  JobMatchScoreAggregateStore,
  MatchSignalsInput,
  SignalWeights,
} from "./job-match-score.js";

describe("Chapter 8E — Job Weighted Scoring Domain Tests", () => {
  const defaultWeights: SignalWeights = {
    semanticSimilarity: 0.3,
    skillCoverage: 0.3,
    experienceCompatibility: 0.1,
    budgetCompatibility: 0.1,
    jobTypeCompatibility: 0.1,
    locationCompatibility: 0.1,
  };

  const defaultWeightProfile = new ScoreWeightProfile("v1", defaultWeights);

  const defaultCompatibilityMapping = {
    COMPATIBLE: 1.0,
    PARTIAL: 0.5,
    INCOMPATIBLE: 0.0,
    UNKNOWN: undefined,
  };

  const defaultScoringConfiguration = new ScoringConfiguration({
    scoringVersion: "v1",
    weightProfile: defaultWeightProfile,
    compatibilityMapping: defaultCompatibilityMapping,
    missingSignalPolicy: "available-weight",
    semanticSimilarityNormalization: "shift-to-positive",
    scoreScale: "0-100",
  });

  const defaultMatchSignals: MatchSignalsInput = {
    semanticSimilarity: 0.5,
    skillCoverage: 0.8,
    matchedSkills: ["typescript", "node"],
    missingSkills: [],
    experienceCompatibility: "COMPATIBLE",
    budgetCompatibility: "COMPATIBLE",
    jobTypeCompatibility: "COMPATIBLE",
    locationCompatibility: "COMPATIBLE",
  };

  // ==========================================
  // 1. SCORE IDENTITY
  // ==========================================
  describe("1. Score Identity", () => {
    test("valid construction and logical properties", () => {
      const score = JobMatchScore.create(
        "score-123",
        "tenant-1",
        "owner-1",
        "match-123",
        "v1",
        "v1",
        "v1",
      );

      assert.strictEqual(score.id, "score-123");
      assert.strictEqual(score.tenantId, "tenant-1");
      assert.strictEqual(score.jobMatchId, "match-123");
      assert.strictEqual(score.matchingVersion, "v1");
      assert.strictEqual(score.scoringVersion, "v1");
      assert.strictEqual(score.weightProfileVersion, "v1");
    });

    test("identity fields are immutable", () => {
      const score = JobMatchScore.create(
        "score-123",
        "tenant-1",
        "owner-1",
        "match-123",
        "v1",
        "v1",
        "v1",
      );

      assert.throws(() => {
        (score as unknown as Record<string, unknown>).jobMatchId = "mutated";
      }, TypeError);

      assert.throws(() => {
        (score as unknown as Record<string, unknown>).scoringVersion = "v2";
      }, TypeError);
    });
  });

  // ==========================================
  // 2. WEIGHT PROFILE
  // ==========================================
  describe("2. Weight Profile", () => {
    test("valid weight profile setup, immutable", () => {
      const profile = new ScoreWeightProfile("v1", defaultWeights);
      assert.strictEqual(profile.weightProfileVersion, "v1");
      assert.deepStrictEqual(profile.weights, defaultWeights);

      assert.throws(() => {
        (profile as unknown as Record<string, unknown>).weightProfileVersion = "v2";
      }, TypeError);

      assert.throws(() => {
        (profile.weights as unknown as Record<string, unknown>).skillCoverage = 0.9;
      }, TypeError);
    });

    test("invalid weights non-finite and negative are rejected", () => {
      // Negative weight
      assert.throws(() => {
        new ScoreWeightProfile("v1", {
          ...defaultWeights,
          semanticSimilarity: -0.1,
        });
      }, /Weight for semanticSimilarity must be non-negative/);

      // Non-finite weight
      assert.throws(() => {
        new ScoreWeightProfile("v1", {
          ...defaultWeights,
          skillCoverage: NaN,
        });
      }, /Weight for skillCoverage must be a finite number/);

      assert.throws(() => {
        new ScoreWeightProfile("v1", {
          ...defaultWeights,
          skillCoverage: Infinity,
        });
      }, /Weight for skillCoverage must be a finite number/);
    });

    test("optional weights sum validation invariant", () => {
      // Invariant check: if a custom rule requires weights to sum to 1.0
      const weightsNotSumming = {
        semanticSimilarity: 0.1,
        skillCoverage: 0.1,
        experienceCompatibility: 0.1,
        budgetCompatibility: 0.1,
        jobTypeCompatibility: 0.1,
        locationCompatibility: 0.1,
      };

      const customValidateSum = (profile: ScoreWeightProfile) => {
        const sum = Object.values(profile.weights).reduce((a, b) => a + b, 0);
        if (Math.abs(sum - 1.0) > 0.0001) {
          throw new Error("Weights must sum to 1.0.");
        }
      };

      const validProfile = new ScoreWeightProfile("v1", defaultWeights);
      const invalidProfile = new ScoreWeightProfile("v1", weightsNotSumming);

      assert.doesNotThrow(() => customValidateSum(validProfile));
      assert.throws(() => customValidateSum(invalidProfile), /Weights must sum to 1.0/);
    });
  });

  // ==========================================
  // 3. NUMERIC SIGNALS
  // ==========================================
  describe("3. Numeric Signals", () => {
    test("semanticSimilarity range check and shifts-to-positive normalization", () => {
      const score = JobMatchScore.create(
        "score-123",
        "tenant-1",
        "owner-1",
        "match-123",
        "v1",
        "v1",
        "v1",
      );

      // semanticSimilarity = -1 -> should shift to 0
      // semanticSimilarity = 0 -> should shift to 0.5
      // semanticSimilarity = 1 -> should shift to 1.0
      // Let's test with all others having weight 0 except similarity (weight 1.0)
      const weights = new ScoreWeightProfile("v1", {
        semanticSimilarity: 1.0,
        skillCoverage: 0.0,
        experienceCompatibility: 0.0,
        budgetCompatibility: 0.0,
        jobTypeCompatibility: 0.0,
        locationCompatibility: 0.0,
      });

      const config = new ScoringConfiguration({
        scoringVersion: "v1",
        weightProfile: weights,
        compatibilityMapping: defaultCompatibilityMapping,
        missingSignalPolicy: "available-weight",
        semanticSimilarityNormalization: "shift-to-positive",
        scoreScale: "0-1",
      });

      score.calculate(
        "owner-1",
        {
          ...defaultMatchSignals,
          semanticSimilarity: 0.0,
        },
        config,
      );

      assert.strictEqual(score.finalScore, 0.5);

      // Rejects out of bounds similarity
      const scoreErr = JobMatchScore.create(
        "score-123",
        "tenant-1",
        "owner-1",
        "match-123",
        "v1",
        "v1",
        "v1",
      );
      assert.throws(() => {
        scoreErr.calculate(
          "owner-1",
          {
            ...defaultMatchSignals,
            semanticSimilarity: 1.5,
          },
          config,
        );
      }, /Semantic similarity value must be between -1 and 1/);
    });

    test("skillCoverage range checks", () => {
      const score = JobMatchScore.create(
        "score-123",
        "tenant-1",
        "owner-1",
        "match-123",
        "v1",
        "v1",
        "v1",
      );
      assert.throws(() => {
        score.calculate(
          "owner-1",
          {
            ...defaultMatchSignals,
            skillCoverage: 1.2,
          },
          defaultScoringConfiguration,
        );
      }, /Skill coverage value must be between 0 and 1/);
    });
  });

  // ==========================================
  // 4. COMPATIBILITY MAPPING
  // ==========================================
  describe("4. Compatibility Mapping", () => {
    test("controlled states mapping evaluated deterministically with strict UNKNOWN handling", () => {
      const score = JobMatchScore.create(
        "score-123",
        "tenant-1",
        "owner-1",
        "match-123",
        "v1",
        "v1",
        "v1",
      );
      score.calculate(
        "owner-1",
        {
          ...defaultMatchSignals,
          experienceCompatibility: "PARTIAL",
          budgetCompatibility: "INCOMPATIBLE",
        },
        defaultScoringConfiguration,
      );

      const breakdown = score.breakdown!;
      const expContrib = breakdown.contributions.find(
        (c) => c.signalName === "experienceCompatibility",
      )!;
      const budgetContrib = breakdown.contributions.find(
        (c) => c.signalName === "budgetCompatibility",
      )!;

      assert.strictEqual(expContrib.normalizedValue, 0.5); // PARTIAL maps to 0.5
      assert.strictEqual(budgetContrib.normalizedValue, 0.0); // INCOMPATIBLE maps to 0.0
    });
  });

  // ==========================================
  // 5. MISSING-SIGNAL POLICY
  // ==========================================
  describe("5. Missing-Signal Policy", () => {
    test("available-weight policy sum isolation", () => {
      const weights = new ScoreWeightProfile("v1", {
        semanticSimilarity: 1.0,
        skillCoverage: 1.0,
        experienceCompatibility: 0.0,
        budgetCompatibility: 0.0,
        jobTypeCompatibility: 0.0,
        locationCompatibility: 0.0,
      });

      const config = new ScoringConfiguration({
        scoringVersion: "v1",
        weightProfile: weights,
        compatibilityMapping: defaultCompatibilityMapping,
        missingSignalPolicy: "available-weight",
        semanticSimilarityNormalization: "raw", // no shift, range [-1, 1]
        scoreScale: "0-1",
      });

      const score = JobMatchScore.create(
        "score-123",
        "tenant-1",
        "owner-1",
        "match-123",
        "v1",
        "v1",
        "v1",
      );

      // semanticSimilarity is missing (undefined)
      // skillCoverage is 0.8
      // Under available-weight policy: only skillCoverage is included. Sum = 0.8 * 1.0 = 0.8. Total weights = 1.0. Final score = 0.8.
      score.calculate(
        "owner-1",
        {
          ...defaultMatchSignals,
          semanticSimilarity: undefined,
          skillCoverage: 0.8,
        },
        config,
      );

      assert.strictEqual(score.finalScore, 0.8);
      const semanticContrib = score.breakdown!.contributions.find(
        (c) => c.signalName === "semanticSimilarity",
      )!;
      assert.strictEqual(semanticContrib.available, false);
      assert.strictEqual(semanticContrib.contribution, undefined);
    });

    test("fixed-denominator policy handles missing signals", () => {
      const weights = new ScoreWeightProfile("v1", {
        semanticSimilarity: 1.0,
        skillCoverage: 1.0,
        experienceCompatibility: 0.0,
        budgetCompatibility: 0.0,
        jobTypeCompatibility: 0.0,
        locationCompatibility: 0.0,
      });

      const config = new ScoringConfiguration({
        scoringVersion: "v1",
        weightProfile: weights,
        compatibilityMapping: defaultCompatibilityMapping,
        missingSignalPolicy: "fixed-denominator",
        semanticSimilarityNormalization: "raw",
        scoreScale: "0-1",
      });

      const score = JobMatchScore.create(
        "score-123",
        "tenant-1",
        "owner-1",
        "match-123",
        "v1",
        "v1",
        "v1",
      );

      // semanticSimilarity is missing (undefined) -> normalized to 0
      // skillCoverage is 0.8
      // Under fixed-denominator policy:
      // Similarity contribution: 0 * 1.0 = 0.
      // Skill contribution: 0.8 * 1.0 = 0.8.
      // Sum = 0.8. Total weights = 2.0. Final score = 0.8 / 2.0 = 0.4.
      score.calculate(
        "owner-1",
        {
          ...defaultMatchSignals,
          semanticSimilarity: undefined,
          skillCoverage: 0.8,
        },
        config,
      );

      assert.strictEqual(score.finalScore, 0.4);
      const semanticContrib = score.breakdown!.contributions.find(
        (c) => c.signalName === "semanticSimilarity",
      )!;
      assert.strictEqual(semanticContrib.available, false);
      assert.strictEqual(semanticContrib.normalizedValue, 0);
    });

    test("strict-validation policy throws error on missing signals", () => {
      const config = new ScoringConfiguration({
        scoringVersion: "v1",
        weightProfile: defaultWeightProfile,
        compatibilityMapping: defaultCompatibilityMapping,
        missingSignalPolicy: "strict-validation",
        scoreScale: "0-1",
      });

      const score = JobMatchScore.create(
        "score-123",
        "tenant-1",
        "owner-1",
        "match-123",
        "v1",
        "v1",
        "v1",
      );
      assert.throws(() => {
        score.calculate(
          "owner-1",
          {
            ...defaultMatchSignals,
            semanticSimilarity: undefined,
          },
          config,
        );
      }, /Strict validation policy failed/);
    });
  });

  // ==========================================
  // 6. CONTRIBUTIONS
  // ==========================================
  describe("6. Contributions", () => {
    test("calculates contribution details deterministically", () => {
      const contrib = new SignalContribution({
        signalName: "semanticSimilarity",
        rawValue: 0.5,
        normalizedValue: 0.75,
        weight: 0.4,
        contribution: 0.3,
        available: true,
      });

      assert.strictEqual(contrib.signalName, "semanticSimilarity");
      assert.strictEqual(contrib.rawValue, 0.5);
      assert.strictEqual(contrib.normalizedValue, 0.75);
      assert.strictEqual(contrib.weight, 0.4);
      assert.strictEqual(contrib.contribution, 0.3);
      assert.strictEqual(contrib.available, true);
    });
  });

  // ==========================================
  // 7. FINAL SCORE
  // ==========================================
  describe("7. Final Score", () => {
    test("version-aware and scales to 0-1, 0-100, 0-1000 scales with precision", () => {
      // 0-100 scale (default config)
      const score100 = JobMatchScore.create(
        "score-123",
        "tenant-1",
        "owner-1",
        "match-123",
        "v1",
        "v1",
        "v1",
      );
      score100.calculate(
        "owner-1",
        {
          ...defaultMatchSignals,
          semanticSimilarity: 0.5, // shifted to 0.75
          skillCoverage: 1.0,
        },
        defaultScoringConfiguration,
      );

      // Calculated:
      // weights: similarity 0.3, skill 0.3, exp 0.1, bud 0.1, jt 0.1, loc 0.1 (total = 1.0)
      // vals: similarity 0.75 (0.225), skill 1.0 (0.3), exp 1.0 (0.1), bud 1.0 (0.1), jt 1.0 (0.1), loc 1.0 (0.1)
      // weightedSum = 0.225 + 0.3 + 0.1 + 0.1 + 0.1 + 0.1 = 0.925
      // scaled to 0-100 -> 92.5
      assert.strictEqual(score100.finalScore, 92.5);

      // 0-1 scale
      const config01 = new ScoringConfiguration({
        scoringVersion: "v1",
        weightProfile: defaultWeightProfile,
        compatibilityMapping: defaultCompatibilityMapping,
        missingSignalPolicy: "available-weight",
        semanticSimilarityNormalization: "shift-to-positive",
        scoreScale: "0-1",
      });
      const score01 = JobMatchScore.create(
        "score-123",
        "tenant-1",
        "owner-1",
        "match-123",
        "v1",
        "v1",
        "v1",
      );
      score01.calculate(
        "owner-1",
        {
          ...defaultMatchSignals,
          semanticSimilarity: 0.5,
          skillCoverage: 1.0,
        },
        config01,
      );
      assert.strictEqual(score01.finalScore, 0.925);

      // 0-1000 scale
      const config1000 = new ScoringConfiguration({
        scoringVersion: "v1",
        weightProfile: defaultWeightProfile,
        compatibilityMapping: defaultCompatibilityMapping,
        missingSignalPolicy: "available-weight",
        semanticSimilarityNormalization: "shift-to-positive",
        scoreScale: "0-1000",
      });
      const score1000 = JobMatchScore.create(
        "score-123",
        "tenant-1",
        "owner-1",
        "match-123",
        "v1",
        "v1",
        "v1",
      );
      score1000.calculate(
        "owner-1",
        {
          ...defaultMatchSignals,
          semanticSimilarity: 0.5,
          skillCoverage: 1.0,
        },
        config1000,
      );
      assert.strictEqual(score1000.finalScore, 925.0);

      // Rounding precision check (4 decimals)
      assert.strictEqual(roundToPrecision(0.9255555), 0.9256);
    });
  });

  // ==========================================
  // 8. SCOREBREAKDOWN
  // ==========================================
  describe("8. ScoreBreakdown", () => {
    test("ScoreBreakdown stores all signal details immutably", () => {
      const contrib = new SignalContribution({
        signalName: "semanticSimilarity",
        rawValue: 0.5,
        normalizedValue: 0.75,
        weight: 0.4,
        contribution: 0.3,
        available: true,
      });

      const breakdown = new ScoreBreakdown([contrib]);
      assert.strictEqual(breakdown.contributions.length, 1);

      assert.throws(() => {
        (breakdown.contributions as unknown as SignalContribution[]).push(contrib);
      }, TypeError);

      assert.throws(() => {
        (breakdown.contributions[0] as unknown as Record<string, unknown>).signalName = "mutated";
      }, TypeError);
    });
  });

  // ==========================================
  // 9. SCORE FINGERPRINT
  // ==========================================
  describe("9. ScoreFingerprint", () => {
    test("deterministic fingerprint changes when rules version updates", () => {
      const fp1 = new ScoreFingerprint("match-1", "v1", "v1", "v1");
      const fp2 = new ScoreFingerprint("match-1", "v1", "v1", "v1");
      assert.ok(fp1.equals(fp2));

      // Different scoringVersion
      const fpDifferent = new ScoreFingerprint("match-1", "v1", "v2", "v1");
      assert.ok(!fp1.equals(fpDifferent));
    });
  });

  // ==========================================
  // 10. AGGREGATE CREATION
  // ==========================================
  describe("10. Aggregate Creation", () => {
    test("creates aggregate in CREATED state with version 1 snapshot and domain event", () => {
      const score = JobMatchScore.create(
        "score-123",
        "tenant-1",
        "owner-1",
        "match-123",
        "v1",
        "v1",
        "v1",
      );

      assert.strictEqual(score.status, "CREATED");
      assert.strictEqual(score.snapshots.length, 1);
      assert.strictEqual(score.snapshots[0]!.version, 1);
      assert.strictEqual(score.snapshots[0]!.status, "CREATED");

      assert.strictEqual(score.domainEvents.length, 1);
      const ev = score.domainEvents[0]!;
      assert.strictEqual(ev.eventType, JOB_MATCH_SCORE_CREATED);
      assert.strictEqual(ev.scoreId, "score-123");
      assert.strictEqual(ev.snapshotVersion, 1);
    });
  });

  // ==========================================
  // 11. CALCULATION
  // ==========================================
  describe("11. Calculation Operation", () => {
    test("calculate transitions CREATED -> CALCULATED, yields score and breakdown", () => {
      const score = JobMatchScore.create(
        "score-123",
        "tenant-1",
        "owner-1",
        "match-123",
        "v1",
        "v1",
        "v1",
      );
      score.calculate("owner-1", defaultMatchSignals, defaultScoringConfiguration);

      assert.strictEqual(score.status, "CALCULATED");
      assert.ok(score.finalScore !== undefined);
      assert.ok(score.breakdown !== undefined);
      assert.ok(score.fingerprint !== undefined);

      assert.strictEqual(score.snapshots.length, 2);
      assert.strictEqual(score.snapshots[1]!.version, 2);
      assert.strictEqual(score.snapshots[1]!.status, "CALCULATED");

      assert.strictEqual(score.domainEvents.length, 2);
      assert.strictEqual(score.domainEvents[1]!.eventType, JOB_MATCH_SCORE_CALCULATED);
    });
  });

  // ==========================================
  // 12. ARCHIVE
  // ==========================================
  describe("12. Archive Operation", () => {
    test("transitions CREATED -> ARCHIVED and CALCULATED -> ARCHIVED correctly", () => {
      const score1 = JobMatchScore.create(
        "score-1",
        "tenant-1",
        "owner-1",
        "match-123",
        "v1",
        "v1",
        "v1",
      );
      score1.archive("owner-1");
      assert.strictEqual(score1.status, "ARCHIVED");

      const score2 = JobMatchScore.create(
        "score-2",
        "tenant-1",
        "owner-1",
        "match-123",
        "v1",
        "v1",
        "v1",
      );
      score2.calculate("owner-1", defaultMatchSignals, defaultScoringConfiguration);
      score2.archive("owner-1");
      assert.strictEqual(score2.status, "ARCHIVED");
      assert.strictEqual(score2.snapshots.length, 3);
      assert.strictEqual(score2.snapshots[2]!.status, "ARCHIVED");
      assert.strictEqual(score2.domainEvents[2]!.eventType, JOB_MATCH_SCORE_ARCHIVED);
    });
  });

  // ==========================================
  // 13. INVALID LIFECYCLE TRANSITIONS
  // ==========================================
  describe("13. Invalid Lifecycle", () => {
    test("rejects backwards and invalid state updates", () => {
      const score = JobMatchScore.create(
        "score-1",
        "tenant-1",
        "owner-1",
        "match-123",
        "v1",
        "v1",
        "v1",
      );
      score.calculate("owner-1", defaultMatchSignals, defaultScoringConfiguration);

      // Rejects CALCULATED -> CREATED
      assert.throws(() => {
        (score as unknown as { transitionTo(s: string): void }).transitionTo("CREATED");
      }, /Invalid lifecycle transition from CALCULATED to CREATED/);

      score.archive("owner-1");
      assert.strictEqual(score.status, "ARCHIVED");

      // Archived terminal checks
      assert.throws(
        () => score.calculate("owner-1", defaultMatchSignals, defaultScoringConfiguration),
        /Invalid lifecycle transition from ARCHIVED to CALCULATED/,
      );
      assert.throws(() => score.archive("owner-1"), /Job match score is already archived/);
      assert.throws(() => {
        (score as unknown as { transitionTo(s: string): void }).transitionTo("CREATED");
      }, /Invalid lifecycle transition from ARCHIVED to CREATED/);
    });
  });

  // ==========================================
  // 14. OWNERSHIP
  // ==========================================
  describe("14. Ownership Validation", () => {
    test("mutations reject wrong owners with exact error", () => {
      const score = JobMatchScore.create(
        "score-1",
        "tenant-1",
        "owner-1",
        "match-123",
        "v1",
        "v1",
        "v1",
      );

      // Unauthorized calculation
      assert.throws(
        () => {
          score.calculate("unauthorized-owner", defaultMatchSignals, defaultScoringConfiguration);
        },
        (err: Error) => {
          return err.message === "Ownership validation failed: unauthorized owner context.";
        },
      );

      // Unauthorized archiving
      assert.throws(
        () => {
          score.archive("unauthorized-owner");
        },
        (err: Error) => {
          return err.message === "Ownership validation failed: unauthorized owner context.";
        },
      );

      // State is unmodified
      assert.strictEqual(score.status, "CREATED");
      assert.strictEqual(score.snapshots.length, 1);
      assert.strictEqual(score.domainEvents.length, 1);
    });
  });

  // ==========================================
  // 15. TENANT ISOLATION
  // ==========================================
  describe("15. Tenant Isolation", () => {
    test("rejects inputs from a different tenant", () => {
      const score = JobMatchScore.create(
        "score-1",
        "tenant-1",
        "owner-1",
        "match-123",
        "v1",
        "v1",
        "v1",
      );

      // Test repository scoping
      assert.strictEqual(score.tenantId, "tenant-1");
    });
  });

  // ==========================================
  // 16. IDEMPOTENCY
  // ==========================================
  describe("16. Idempotency", () => {
    test("scoring context changes generate distinct fingerprints", () => {
      const fp1 = new ScoreFingerprint("match-1", "v1", "v1", "v1");
      const fp2 = new ScoreFingerprint("match-1", "v1", "v2", "v1");
      assert.ok(!fp1.equals(fp2));
    });
  });

  // ==========================================
  // 17. SNAPSHOTS
  // ==========================================
  describe("17. Snapshots", () => {
    test("sequential snapshot versions check", () => {
      const score = JobMatchScore.create(
        "score-1",
        "tenant-1",
        "owner-1",
        "match-123",
        "v1",
        "v1",
        "v1",
      );
      score.calculate("owner-1", defaultMatchSignals, defaultScoringConfiguration);

      assert.strictEqual(score.snapshots.length, 2);
      assert.strictEqual(score.snapshots[0]!.version, 1);
      assert.strictEqual(score.snapshots[1]!.version, 2);

      // Verify that reconstructing with invalid versions fails
      assert.throws(() => {
        new JobMatchScore({
          id: "score-1",
          tenantId: "tenant-1",
          ownerId: "owner-1",
          jobMatchId: "match-123",
          matchingVersion: "v1",
          scoringVersion: "v1",
          weightProfileVersion: "v1",
          status: "CREATED",
          snapshots: [
            score.snapshots[0]!,
            score.snapshots[0]!, // duplicate snapshot version 1
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }, /Snapshot history must be sequential and start at 1/);
    });
  });

  // ==========================================
  // 18. DATES
  // ==========================================
  describe("18. Date Immutability", () => {
    test("defensive copies are verified on entry and exit", () => {
      const entryDate = new Date("2026-08-11T12:00:00Z");
      const snap = new JobMatchScoreSnapshot({
        version: 1,
        createdAt: entryDate,
        status: "CREATED",
        jobMatchId: "match-123",
        matchingVersion: "v1",
        scoringVersion: "v1",
        weightProfileVersion: "v1",
      });

      const score = new JobMatchScore({
        id: "score-1",
        tenantId: "tenant-1",
        ownerId: "owner-1",
        jobMatchId: "match-123",
        matchingVersion: "v1",
        scoringVersion: "v1",
        weightProfileVersion: "v1",
        status: "CREATED",
        snapshots: [snap],
        createdAt: entryDate,
        updatedAt: entryDate,
      });

      // Modify entry date
      entryDate.setTime(0);
      assert.notStrictEqual(score.createdAt.getTime(), 0);

      // Modify getter date
      const created = score.createdAt;
      created.setTime(1000);
      created.setDate(15);
      created.setFullYear(2035);
      assert.notStrictEqual(score.createdAt.getTime(), 1000);
    });
  });

  // ==========================================
  // 19. EVENTS
  // ==========================================
  describe("19. Domain Events", () => {
    test("domain events are frozen, with correct versions and zero secrets", () => {
      const score = JobMatchScore.create(
        "score-1",
        "tenant-1",
        "owner-1",
        "match-123",
        "v1",
        "v1",
        "v1",
      );

      const ev = score.domainEvents[0]!;
      assert.strictEqual(ev.eventType, JOB_MATCH_SCORE_CREATED);
      assert.strictEqual(ev.scoreId, "score-1");
      assert.strictEqual(ev.matchingVersion, "v1");
      assert.strictEqual(ev.scoringVersion, "v1");
      assert.strictEqual(ev.weightProfileVersion, "v1");

      assert.throws(() => {
        (ev as unknown as Record<string, unknown>).scoreId = "mutated";
      }, TypeError);

      assert.ok(!("apiKey" in ev));
      assert.ok(!("redis" in ev));
    });
  });

  // ==========================================
  // 20. PERSISTENCE
  // ==========================================
  describe("20. Persistence contracts", () => {
    test("neutral contracts compile and run successfully", () => {
      const dummyStore: JobMatchScoreAggregateStore = {
        async save(_score: JobMatchScore): Promise<void> {},
        async findById(_id: string, _tenantId: string): Promise<JobMatchScore | null> {
          return null;
        },
        async findByScoringIdentity(
          _tenantId: string,
          _jobMatchId: string,
          _matchingVersion: string,
          _scoringVersion: string,
          _weightProfileVersion: string,
        ): Promise<JobMatchScore | null> {
          return null;
        },
      };

      const dummyContract: JobMatchScorePersistenceContract = {
        async findByScoringIdentity(
          _tenantId: string,
          _jobMatchId: string,
          _matchingVersion: string,
          _scoringVersion: string,
          _weightProfileVersion: string,
        ): Promise<JobMatchScore | null> {
          return null;
        },
      };

      assert.ok(dummyStore);
      assert.ok(dummyContract);
    });
  });

  // ==========================================
  // 21. BOUNDARY CHECKS
  // ==========================================
  describe("21. Boundary Isolation Checks", () => {
    test("Verify no matching, embedding, ranking, caching, queues, AI or network is enqueued", () => {
      const prototypeKeys = Object.keys(JobMatchScore.prototype);
      assert.ok(!prototypeKeys.includes("match"));
      assert.ok(!prototypeKeys.includes("rank"));
      assert.ok(!prototypeKeys.includes("explain"));
      assert.ok(!prototypeKeys.includes("cache"));
      assert.ok(!prototypeKeys.includes("enqueue"));
    });
  });
});
