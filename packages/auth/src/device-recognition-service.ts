import { db, sessions } from "@freelanceos/db";
import { eq, and, isNull, gt } from "drizzle-orm";
import { eventDispatcher } from "./dispatcher.js";

export interface DeviceTelemetryInput {
  userAgent: string;
  ipAddress: string;
}

export interface ParsedDeviceMetadata {
  userAgent: string;
  ipAddress: string;
  platform: string;
  browser: string;
  deviceName: string;
}

/**
 * Parses user agent string to extract platform and browser metadata.
 */
export function parseUserAgent(userAgent: string, ipAddress: string): ParsedDeviceMetadata {
  let platform = "unknown";
  if (userAgent.includes("Windows")) {
    platform = "Windows";
  } else if (userAgent.includes("Macintosh")) {
    platform = "macOS";
  } else if (userAgent.includes("Linux")) {
    platform = "Linux";
  } else if (userAgent.includes("Android")) {
    platform = "Android";
  } else if (userAgent.includes("iPhone")) {
    platform = "iOS";
  }

  let browser = "unknown";
  if (userAgent.includes("Chrome")) {
    browser = "Chrome";
  } else if (userAgent.includes("Firefox")) {
    browser = "Firefox";
  } else if (userAgent.includes("Safari")) {
    browser = "Safari";
  }

  return {
    userAgent,
    ipAddress,
    platform,
    browser,
    deviceName: platform,
  };
}

/**
 * Service to handle device identification, telemetry, comparison, and new device alerts.
 */
export class DeviceRecognitionService {
  async evaluateDevice(userId: string, input: DeviceTelemetryInput): Promise<ParsedDeviceMetadata> {
    const parsed = parseUserAgent(input.userAgent, input.ipAddress);

    // 1. Retrieve active historical sessions for user
    const historicalSessions = await db
      .select({
        platform: sessions.platform,
        browser: sessions.browser,
      })
      .from(sessions)
      .where(
        and(
          eq(sessions.userId, userId),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, new Date()),
        ),
      );

    // 2. Perform comparison against historical platforms and browsers
    const isRecognizedDevice =
      historicalSessions.length === 0 ||
      historicalSessions.some(
        (s) => s.platform === (parsed.platform || null) && s.browser === (parsed.browser || null),
      );

    // 3. Emit alert event if device is unrecognized
    if (!isRecognizedDevice) {
      await eventDispatcher.publish("NEW_DEVICE_DETECTED", {
        userId,
        ipAddress: parsed.ipAddress,
        browser: parsed.browser,
        platform: parsed.platform,
      });
    }

    return parsed;
  }
}

export const deviceRecognitionService = new DeviceRecognitionService();
