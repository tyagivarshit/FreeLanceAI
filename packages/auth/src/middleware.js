import crypto from "crypto";
import { validateSession } from "./session.js";
import { eventDispatcher } from "./dispatcher.js";
import { InvalidTokenError, SessionNotFoundError, SessionExpiredError, SessionRevokedError, } from "./token.js";
import { logger } from "@freelanceos/logger";
/**
 * Intercepts request credentials and evaluates authentication validation rules.
 */
export async function authenticateRequest(input) {
    const { credentialToken, routePolicy = "Protected", ipAddress = "unknown" } = input;
    // 1. Routes classified as Anonymous bypass verification
    if (routePolicy === "Anonymous") {
        return { status: "Anonymous" };
    }
    // 2. If no credential is provided
    if (!credentialToken) {
        if (routePolicy === "Optional") {
            return { status: "Anonymous" };
        }
        // Publish fail event
        await eventDispatcher.publish("AUTHENTICATION_FAILED", {
            ipAddress,
            reason: "Missing credential token for protected route",
        });
        return { status: "Unauthenticated" };
    }
    try {
        // 3. Execute validation pipeline (now returns user email as well)
        const validated = await validateSession(credentialToken);
        const authenticatedAt = new Date();
        // Map database session ID to an opaque session reference (SHA-256 hash)
        const sessionRef = crypto.createHash("sha256").update(validated.sessionId).digest("hex");
        // Publish success event
        await eventDispatcher.publish("AUTHENTICATION_SUCCEEDED", {
            userId: validated.userId,
            sessionId: validated.sessionId,
            authenticatedAt: authenticatedAt.toISOString(),
        });
        return {
            status: "Authenticated",
            context: {
                identity: {
                    userId: validated.userId,
                    email: validated.email,
                },
                sessionRef,
                authenticatedAt,
            },
        };
    }
    catch (error) {
        if (error instanceof InvalidTokenError) {
            if (error.code === "EXPIRED") {
                await eventDispatcher.publish("AUTHENTICATION_FAILED", {
                    ipAddress,
                    reason: "Expired credential token signature",
                });
                return { status: "Expired Credentials" };
            }
            if (error.message.includes("User credentials have changed")) {
                const decodedUserId = error.userId || "unknown";
                const decodedSessionId = error.sessionId || "unknown";
                await eventDispatcher.publish("IDENTITY_INVALIDATED", {
                    userId: decodedUserId,
                    sessionId: decodedSessionId,
                });
                return { status: "Identity Invalidated" };
            }
            await eventDispatcher.publish("AUTHENTICATION_FAILED", {
                ipAddress,
                reason: error.message || "Invalid credential token",
            });
            return { status: "Unauthenticated" };
        }
        if (error instanceof SessionNotFoundError) {
            await eventDispatcher.publish("SESSION_INVALID", {
                sessionId: error.sessionId,
                reason: "revoked",
            });
            return { status: "Invalid Session" };
        }
        if (error instanceof SessionRevokedError) {
            await eventDispatcher.publish("SESSION_INVALID", {
                sessionId: error.sessionId,
                reason: "revoked",
            });
            return { status: "Invalid Session" };
        }
        if (error instanceof SessionExpiredError) {
            await eventDispatcher.publish("SESSION_INVALID", {
                sessionId: error.sessionId,
                reason: "expired",
            });
            return { status: "Invalid Session" };
        }
        // Default to Infrastructure Failure on DB or unknown errors
        logger.error({
            message: "[Authentication Middleware] Pipeline crash",
            error: error instanceof Error ? error : new Error(String(error)),
        });
        return { status: "Infrastructure Failure" };
    }
}
