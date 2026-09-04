import { test, describe } from "node:test";
import assert from "node:assert";
import {
  createVerificationEmail,
  ConsoleFallbackEmailService,
  NodemailerEmailService,
  ResendEmailService,
  EmailService,
} from "./email-service.js";
import { QueueBackgroundTaskDispatcher } from "./dispatcher.js";

describe("Email Service & Verification Template Tests", () => {
  test("1. createVerificationEmail generates valid URLs, subject, and bodies", () => {
    const email = "developer@example.com";
    const token = "abcdef1234567890abcdef1234567890";
    const appUrl = "https://app.freelanceos.com";

    const { subject, text, html, verificationUrl } = createVerificationEmail({
      email,
      token,
      appUrl,
    });

    assert.strictEqual(subject, "Verify your FreelanceOS account");
    assert.strictEqual(
      verificationUrl,
      `https://app.freelanceos.com/api/auth/verify-email?token=${token}`,
    );
    assert.ok(text.includes(verificationUrl), "Text version must contain verification URL");
    assert.ok(html.includes(verificationUrl), "HTML version must contain verification URL");
    assert.ok(html.includes("Verify your email address"), "HTML version must have title");
  });

  test("2. ConsoleFallbackEmailService logs and succeeds without external provider", async () => {
    const service = new ConsoleFallbackEmailService();
    const result = await service.sendEmail({
      to: "user@test.com",
      subject: "Test Subject",
      text: "Plain text preview",
      html: "<p>HTML preview</p>",
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.provider, "console_fallback");
  });

  test("3. NodemailerEmailService invokes sendMail on transporter", async () => {
    let sentMailParams: any = null;
    const mockTransporter = {
      sendMail: async (params: any) => {
        sentMailParams = params;
        return { messageId: "<msg-12345@smtp>" };
      },
    };

    const service = new NodemailerEmailService(mockTransporter as any);
    const result = await service.sendEmail({
      to: "inbox@example.com",
      subject: "Verification",
      text: "Please verify",
      html: "<p>Please verify</p>",
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.provider, "smtp");
    assert.strictEqual(result.messageId, "<msg-12345@smtp>");
    assert.strictEqual(sentMailParams.to, "inbox@example.com");
    assert.strictEqual(sentMailParams.subject, "Verification");
  });

  test("4. ResendEmailService formats payload and calls Resend API", async () => {
    const originalFetch = globalThis.fetch;
    let fetchCalledWith: any = null;

    globalThis.fetch = async (url: any, options: any) => {
      fetchCalledWith = { url, options };
      return {
        ok: true,
        json: async () => ({ id: "re_mock_98765" }),
      } as any;
    };

    try {
      const service = new ResendEmailService("re_test_key_123");
      const result = await service.sendEmail({
        to: "recipient@example.com",
        subject: "Hello via Resend",
        text: "Body text",
        html: "<p>Body html</p>",
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.provider, "resend");
      assert.strictEqual(result.messageId, "re_mock_98765");
      assert.strictEqual(fetchCalledWith.url, "https://api.resend.com/emails");
      assert.strictEqual(fetchCalledWith.options.headers.Authorization, "Bearer re_test_key_123");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("5. QueueBackgroundTaskDispatcher delegates verification tasks to configured EmailService", async () => {
    let dispatchedPayload: any = null;
    const mockEmailService: EmailService = {
      sendEmail: async (payload) => {
        dispatchedPayload = payload;
        return { success: true, messageId: "msg_test", provider: "mock" };
      },
    };

    const dispatcher = new QueueBackgroundTaskDispatcher(mockEmailService);

    await dispatcher.dispatch("SEND_VERIFICATION_EMAIL", {
      userId: "u-123",
      email: "newuser@example.com",
      token: "secret_raw_token_xyz",
    });

    // Wait for setImmediate to execute
    await new Promise((resolve) => setImmediate(resolve));

    assert.ok(dispatchedPayload, "EmailService must have been called");
    assert.strictEqual(dispatchedPayload.to, "newuser@example.com");
    assert.strictEqual(dispatchedPayload.subject, "Verify your FreelanceOS account");
    assert.ok(dispatchedPayload.text.includes("secret_raw_token_xyz"));
  });

  test("6. ResendEmailService throws error with status when API returns non-200", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      ({
        ok: false,
        status: 403,
        text: async () => JSON.stringify({ message: "Domain not verified" }),
      }) as any;

    try {
      const service = new ResendEmailService("re_invalid_or_unverified");
      await assert.rejects(
        async () => {
          await service.sendEmail({
            to: "user@example.com",
            subject: "Verification",
            text: "Verify link",
            html: "<p>Verify link</p>",
          });
        },
        (err: Error) => {
          assert.ok(err.message.includes("403"));
          assert.ok(err.message.includes("Domain not verified"));
          return true;
        },
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("7. QueueBackgroundTaskDispatcher handles delivery failures safely without crashing", async () => {
    const failingService: EmailService = {
      sendEmail: async () => {
        throw new Error("SMTP connection timeout to mail server");
      },
    };

    const dispatcher = new QueueBackgroundTaskDispatcher(failingService);

    // Dispatching should not throw synchronously or crash the process
    await dispatcher.dispatch("SEND_VERIFICATION_EMAIL", {
      userId: "u-999",
      email: "failed@example.com",
      token: "raw-token-123",
    });

    await new Promise((resolve) => setImmediate(resolve));
    // Test passes if process continues execution without unhandled rejection crash
    assert.ok(true);
  });
});
