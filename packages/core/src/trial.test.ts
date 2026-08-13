import { test, describe } from "node:test";
import assert from "node:assert";
import {
  TrialGrant,
  TrialEligibility,
  TrialService,
  calculateTrialExpiration,
  InMemoryTrialGrantPersistence,
} from "./trial.js";

describe("10A Trial Domain Model & Abuse Prevention Requirements", () => {
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  test("31. First eligible user receives trial", async () => {
    const persistence = new InMemoryTrialGrantPersistence();
    const service = new TrialService(persistence);
    const start = new Date("2026-08-13T12:00:00Z");

    const grant = await service.issueTrialGrant({
      grantId: "grant-first-user",
      userId: "account-first-user",
      planId: "PRO",
      trialStartedAt: start,
      identitySignals: {
        accountId: "account-first-user",
        verifiedEmail: "first@example.com",
      },
    });

    assert.strictEqual(grant.grantId, "grant-first-user");
    assert.strictEqual(grant.status, "ACTIVE");
  });

  test("32. Trial duration exactly 7 days", () => {
    const start = new Date("2026-08-13T12:00:00Z");
    const calculatedEnd = calculateTrialExpiration(start);

    // Verify exact millisecond duration difference
    assert.strictEqual(calculatedEnd.getTime() - start.getTime(), sevenDaysMs);
    assert.strictEqual(calculatedEnd.toISOString(), "2026-08-20T12:00:00.000Z");
  });

  test("33. Trial start immutable: mutation of start Date object does not affect stored value", () => {
    const start = new Date("2026-08-13T12:00:00Z");
    const end = calculateTrialExpiration(start);
    const grant = new TrialGrant({
      grantId: "grant-start-mut",
      userId: "user-1",
      planId: "PRO",
      status: "ACTIVE",
      trialStartedAt: start,
      trialEndsAt: end,
      identitySignals: { accountId: "account-1" },
    });

    // Mutate source date object
    start.setTime(0);

    // Stored date remains unaffected
    assert.strictEqual(grant.trialStartedAt.toISOString(), "2026-08-13T12:00:00.000Z");
  });

  test("34. Trial end immutable: mutation of end Date object does not affect stored value", () => {
    const start = new Date("2026-08-13T12:00:00Z");
    const end = calculateTrialExpiration(start);
    const grant = new TrialGrant({
      grantId: "grant-end-mut",
      userId: "user-1",
      planId: "PRO",
      status: "ACTIVE",
      trialStartedAt: start,
      trialEndsAt: end,
      identitySignals: { accountId: "account-1" },
    });

    // Mutate source date object
    end.setTime(0);

    // Stored date remains unaffected
    assert.strictEqual(grant.trialEndsAt.toISOString(), "2026-08-20T12:00:00.000Z");
  });

  test("35. Duplicate grant rejected: cannot issue two grants with same ID", async () => {
    const persistence = new InMemoryTrialGrantPersistence();
    const service = new TrialService(persistence);
    const start = new Date("2026-08-13T12:00:00Z");

    await service.issueTrialGrant({
      grantId: "grant-duplicate-id",
      userId: "account-1",
      planId: "PRO",
      trialStartedAt: start,
      identitySignals: { accountId: "account-1", verifiedEmail: "user1@example.com" },
    });

    // Issuing again with same ID throws
    await assert.rejects(async () => {
      await service.issueTrialGrant({
        grantId: "grant-duplicate-id",
        userId: "account-2",
        planId: "PRO",
        trialStartedAt: start,
        identitySignals: { accountId: "account-2", verifiedEmail: "user2@example.com" },
      });
    }, /Duplicate grant creation rejected/);
  });

  test("36. Same account cannot restart trial", async () => {
    const persistence = new InMemoryTrialGrantPersistence();
    const service = new TrialService(persistence);
    const start = new Date("2026-08-13T12:00:00Z");

    // First trial
    await service.issueTrialGrant({
      grantId: "grant-user-1-first",
      userId: "account-user-1",
      planId: "PRO",
      trialStartedAt: start,
      identitySignals: { accountId: "account-user-1", verifiedEmail: "u1@example.com" },
    });

    // Second trial request with different grant ID but same account throws
    await assert.rejects(async () => {
      await service.issueTrialGrant({
        grantId: "grant-user-1-second",
        userId: "account-user-1", // same user/account ID
        planId: "PRO",
        trialStartedAt: start,
        identitySignals: { accountId: "account-user-1", verifiedEmail: "u1@example.com" },
      });
    }, /User is ineligible for a trial: User ineligible due to prior trial grant/);
  });

  test("37. Different email alone cannot bypass eligibility", () => {
    const start = new Date("2026-08-13T12:00:00Z");
    const end = calculateTrialExpiration(start);

    const priorGrant = new TrialGrant({
      grantId: "grant-original",
      userId: "account-1",
      planId: "PRO",
      status: "ACTIVE",
      trialStartedAt: start,
      trialEndsAt: end,
      identitySignals: {
        accountId: "account-1",
        verifiedEmail: "emailA@example.com",
      },
    });

    // Client requests trial under same account-1 but using emailB@example.com (bypass attempt)
    const result = TrialEligibility.evaluate(
      {
        accountId: "account-1",
        verifiedEmail: "emailB@example.com",
      },
      [priorGrant],
    );

    assert.strictEqual(result.isEligible, false);
    assert.match(result.rejectionReason!, /associated with account/);
  });

  test("38. Logout/login cannot reset trial", () => {
    const start = new Date("2026-08-13T12:00:00Z");
    const end = calculateTrialExpiration(start);

    const priorGrant = new TrialGrant({
      grantId: "grant-original",
      userId: "account-1",
      planId: "PRO",
      status: "ACTIVE",
      trialStartedAt: start,
      trialEndsAt: end,
      identitySignals: {
        accountId: "account-1",
        verifiedEmail: "emailA@example.com",
      },
    });

    // Attempting access with verified email (as email is cached in browser session etc.)
    // Even if client resets their state, prior trial grant exists under their verified email
    const result = TrialEligibility.evaluate(
      {
        accountId: "account-new-browser-session",
        verifiedEmail: "emailA@example.com",
      },
      [priorGrant],
    );

    assert.strictEqual(result.isEligible, false);
    assert.match(result.rejectionReason!, /associated with verified email/);
  });

  test("39. Trial expiration: state shifts to EXPIRED after trial duration", () => {
    const start = new Date("2026-08-13T12:00:00Z");
    const end = calculateTrialExpiration(start);
    const grant = new TrialGrant({
      grantId: "grant-exp",
      userId: "user-1",
      planId: "PRO",
      status: "ACTIVE",
      trialStartedAt: start,
      trialEndsAt: end,
      identitySignals: { accountId: "account-1" },
    });

    // 1 hour after start (ACTIVE)
    const checkActive = new Date(start.getTime() + 60 * 60 * 1000);
    assert.strictEqual(grant.getStatusAt(checkActive), "ACTIVE");

    // 1 second after end (EXPIRED)
    const checkExpired = new Date(end.getTime() + 1000);
    assert.strictEqual(grant.getStatusAt(checkExpired), "EXPIRED");
  });

  test("40. Exact expiration boundary tests", () => {
    const start = new Date("2026-08-13T12:00:00Z");
    const end = calculateTrialExpiration(start);
    const grant = new TrialGrant({
      grantId: "grant-boundary",
      userId: "user-1",
      planId: "PRO",
      status: "ACTIVE",
      trialStartedAt: start,
      trialEndsAt: end,
      identitySignals: { accountId: "account-1" },
    });

    // Exact start boundary (ACTIVE)
    assert.strictEqual(grant.getStatusAt(start), "ACTIVE");

    // Exact end boundary (EXPIRED)
    assert.strictEqual(grant.getStatusAt(end), "EXPIRED");
  });

  test("41. Trial cancellation shifts state to CANCELLED permanently", () => {
    const start = new Date("2026-08-13T12:00:00Z");
    const end = calculateTrialExpiration(start);
    const grant = new TrialGrant({
      grantId: "grant-cancel",
      userId: "user-1",
      planId: "PRO",
      status: "ACTIVE",
      trialStartedAt: start,
      trialEndsAt: end,
      identitySignals: { accountId: "account-1" },
    });

    assert.strictEqual(grant.status, "ACTIVE");

    grant.transitionTo("CANCELLED");
    assert.strictEqual(grant.status, "CANCELLED");

    // Remains CANCELLED even after time check beyond expiration
    assert.strictEqual(grant.getStatusAt(new Date(end.getTime() + 10000)), "CANCELLED");

    // Further transitions throw
    assert.throws(() => {
      grant.transitionTo("ACTIVE");
    }, /Cannot transition trial from terminal state/);
  });

  test("42. Trial conversion state shifts to CONVERTED permanently", () => {
    const start = new Date("2026-08-13T12:00:00Z");
    const end = calculateTrialExpiration(start);
    const grant = new TrialGrant({
      grantId: "grant-conv",
      userId: "user-1",
      planId: "PRO",
      status: "ACTIVE",
      trialStartedAt: start,
      trialEndsAt: end,
      identitySignals: { accountId: "account-1" },
    });

    assert.strictEqual(grant.status, "ACTIVE");

    grant.transitionTo("CONVERTED");
    assert.strictEqual(grant.status, "CONVERTED");

    // Remains CONVERTED even after time check beyond expiration
    assert.strictEqual(grant.getStatusAt(new Date(end.getTime() + 10000)), "CONVERTED");

    // Further transitions throw
    assert.throws(() => {
      grant.transitionTo("CANCELLED");
    }, /Cannot transition trial from terminal state/);
  });

  test("43. UTC correctness: timestamps are strictly compared in UTC milliseconds", () => {
    const start = new Date("2026-08-13T12:00:00Z");
    const end = calculateTrialExpiration(start);
    const grant = new Date(end.getTime());

    assert.strictEqual(start.getUTCHours(), 12);
    assert.strictEqual(start.getUTCMinutes(), 0);
    assert.strictEqual(grant.getUTCHours(), 12);
    assert.strictEqual(grant.getUTCMinutes(), 0);
  });

  test("44. Timezone correctness: inputs with different zone offsets are correctly resolved to absolute UTC time", () => {
    // 12:00 IST translates to 06:30 UTC
    const startIST = new Date("2026-08-13T12:00:00+05:30");
    const endIST = calculateTrialExpiration(startIST);

    const grant = new TrialGrant({
      grantId: "grant-tz",
      userId: "user-1",
      planId: "PRO",
      status: "ACTIVE",
      trialStartedAt: startIST,
      trialEndsAt: endIST,
      identitySignals: { accountId: "account-1" },
    });

    // Checking exactly at 06:30 UTC (which is 12:00 IST start time)
    assert.strictEqual(grant.getStatusAt(new Date("2026-08-13T06:30:00Z")), "ACTIVE");

    // Checking exactly at 06:30 UTC 7 days later (which is 12:00 IST end time)
    assert.strictEqual(grant.getStatusAt(new Date("2026-08-20T06:30:00Z")), "EXPIRED");
  });

  test("45. DST boundary: crossing DST boundary does not affect UTC millisecond duration", () => {
    // Crossing DST shift (e.g. Europe/London clocks backward in October)
    const dstStart = new Date("2026-10-23T02:00:00Z");
    const dstEnd = calculateTrialExpiration(dstStart);

    // Duration is exactly 7 days in milliseconds
    assert.strictEqual(dstEnd.getTime() - dstStart.getTime(), sevenDaysMs);
  });
});
