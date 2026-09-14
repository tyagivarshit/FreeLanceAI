import nodemailer from "nodemailer";
import { runtimeConfig } from "@freelanceos/config";
import { logger } from "@freelanceos/logger";
/**
 * Nodemailer SMTP Email Service
 * Connects to standard SMTP servers (Gmail, SendGrid, Amazon SES, Brevo, Mailgun, Mailtrap, etc.)
 */
export class NodemailerEmailService {
    transporter;
    constructor(customTransporter) {
        if (customTransporter) {
            this.transporter = customTransporter;
        }
        else {
            const port = runtimeConfig.SMTP_PORT || 587;
            const secure = runtimeConfig.SMTP_SECURE ?? port === 465;
            this.transporter = nodemailer.createTransport({
                host: runtimeConfig.SMTP_HOST,
                port,
                secure,
                auth: runtimeConfig.SMTP_USER && runtimeConfig.SMTP_PASS
                    ? {
                        user: runtimeConfig.SMTP_USER,
                        pass: runtimeConfig.SMTP_PASS,
                    }
                    : undefined,
            });
        }
    }
    async sendEmail(payload) {
        const from = runtimeConfig.EMAIL_FROM || "FreelanceOS <noreply@freelanceos.com>";
        logger.info({
            message: `[Nodemailer Email Service] Sending email via SMTP to ${payload.to}`,
            host: runtimeConfig.SMTP_HOST,
            subject: payload.subject,
        });
        const info = await this.transporter.sendMail({
            from,
            to: payload.to,
            subject: payload.subject,
            text: payload.text,
            html: payload.html,
        });
        logger.info({
            message: `[Nodemailer Email Service] Successfully sent email to ${payload.to}`,
            messageId: info.messageId,
        });
        return {
            success: true,
            messageId: info.messageId,
            provider: "smtp",
        };
    }
}
/**
 * Resend API Email Service
 * Direct HTTP API integration with Resend (https://resend.com)
 */
export class ResendEmailService {
    apiKey;
    constructor(apiKey) {
        this.apiKey = apiKey || runtimeConfig.RESEND_API_KEY || "";
    }
    async sendEmail(payload) {
        const from = runtimeConfig.EMAIL_FROM || "FreelanceOS <noreply@freelanceos.com>";
        logger.info({
            message: `[Resend Email Service] Sending email via Resend API to ${payload.to}`,
            subject: payload.subject,
        });
        const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${this.apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                from,
                to: [payload.to],
                subject: payload.subject,
                text: payload.text,
                html: payload.html,
            }),
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Resend API error (${response.status}): ${errorText}`);
        }
        const data = (await response.json());
        logger.info({
            message: `[Resend Email Service] Successfully sent email to ${payload.to}`,
            messageId: data.id,
        });
        return {
            success: true,
            messageId: data.id,
            provider: "resend",
        };
    }
}
/**
 * Console Fallback Email Service
 * Used in local development when no real SMTP credentials or API keys are configured.
 */
export class ConsoleFallbackEmailService {
    async sendEmail(payload) {
        logger.warn({
            message: "[Email Service] No real SMTP/Resend credentials configured. Email logged to console.",
            to: payload.to,
            subject: payload.subject,
            preview: payload.text,
        });
        console.log("=================================================================");
        console.log(`[TRANSACTIONAL EMAIL DISPATCHED TO: ${payload.to}]`);
        console.log(`Subject: ${payload.subject}`);
        console.log("-----------------------------------------------------------------");
        console.log(payload.text);
        console.log("=================================================================");
        return {
            success: true,
            messageId: `mock_${Date.now()}`,
            provider: "console_fallback",
        };
    }
}
/**
 * Factory to instantiate the appropriate email service based on environment configuration.
 */
export function createEmailService() {
    if (runtimeConfig.RESEND_API_KEY && runtimeConfig.RESEND_API_KEY.trim() !== "") {
        return new ResendEmailService();
    }
    if (runtimeConfig.SMTP_HOST && runtimeConfig.SMTP_HOST.trim() !== "") {
        return new NodemailerEmailService();
    }
    return new ConsoleFallbackEmailService();
}
let activeEmailService = null;
export function getEmailService() {
    if (!activeEmailService) {
        activeEmailService = createEmailService();
    }
    return activeEmailService;
}
export function setEmailService(service) {
    activeEmailService = service;
}
export function resetEmailService() {
    activeEmailService = null;
}
/**
 * Creates responsive HTML and plain-text email templates for email verification.
 */
export function createVerificationEmail(params) {
    const base = params.appUrl || runtimeConfig.APP_URL || "http://localhost:4000";
    const cleanBase = base.endsWith("/") ? base.slice(0, -1) : base;
    const verificationUrl = `${cleanBase}/api/auth/verify-email?token=${encodeURIComponent(params.token)}`;
    const subject = "Verify your FreelanceOS account";
    const text = `Welcome to FreelanceOS!

Please verify your email address to activate your account by clicking the link below:

${verificationUrl}

This verification link will expire in 24 hours.

If you did not create a FreelanceOS account, you can safely ignore this email.`;
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #0d1117;
      color: #e6edf3;
      margin: 0;
      padding: 40px 20px;
    }
    .card {
      max-width: 560px;
      margin: 0 auto;
      background-color: #161b22;
      border: 1px solid #30363d;
      border-radius: 12px;
      padding: 36px 32px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.4);
    }
    .logo {
      display: inline-block;
      width: 44px;
      height: 44px;
      line-height: 44px;
      text-align: center;
      background: linear-gradient(135deg, #3b82f6, #8b5cf6);
      color: #ffffff;
      font-weight: 800;
      font-size: 22px;
      border-radius: 10px;
      margin-bottom: 24px;
    }
    h1 {
      font-size: 22px;
      font-weight: 700;
      margin: 0 0 16px;
      color: #ffffff;
    }
    p {
      font-size: 15px;
      line-height: 1.6;
      color: #8b949e;
      margin: 0 0 20px;
    }
    .btn-container {
      text-align: center;
      margin: 28px 0;
    }
    .btn {
      display: inline-block;
      background: linear-gradient(135deg, #3b82f6, #6366f1);
      color: #ffffff !important;
      text-decoration: none;
      font-weight: 600;
      font-size: 15px;
      padding: 14px 32px;
      border-radius: 8px;
      box-shadow: 0 4px 14px rgba(59, 130, 246, 0.35);
    }
    .link-container {
      background-color: #0d1117;
      border: 1px solid #30363d;
      border-radius: 8px;
      padding: 12px 16px;
      margin: 20px 0;
    }
    .link-text {
      word-break: break-all;
      color: #58a6ff;
      font-size: 13px;
      line-height: 1.5;
    }
    .footer {
      border-top: 1px solid #21262d;
      padding-top: 20px;
      margin-top: 28px;
      font-size: 12px;
      color: #6e7681;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">F</div>
    <h1>Verify your email address</h1>
    <p>Welcome to FreelanceOS! Please verify your email address to complete your registration and activate your account.</p>
    <div class="btn-container">
      <a href="${verificationUrl}" class="btn" target="_blank" rel="noopener noreferrer">Verify Email Address</a>
    </div>
    <p>If the button above does not work, copy and paste this link into your browser:</p>
    <div class="link-container">
      <a href="${verificationUrl}" class="link-text">${verificationUrl}</a>
    </div>
    <div class="footer">
      <p>This link is valid for 24 hours. If you did not create a FreelanceOS account, you can safely ignore this email.</p>
      <p>&copy; FreelanceOS. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
    return { subject, text, html, verificationUrl };
}
