import { PlatformContext } from "./types.js";

export function createPlatformContext(
  rawUrl: string,
  tabId: number,
  frameId: number,
): PlatformContext {
  // Safe URL parsing
  let urlObj: URL;
  try {
    urlObj = new URL(rawUrl);
  } catch {
    throw new Error(`Invalid context URL: ${rawUrl}`);
  }

  // Validate bounds
  if (!Number.isInteger(tabId) || tabId < 0) {
    throw new Error(`Invalid tabId context: ${tabId}`);
  }
  if (!Number.isInteger(frameId) || frameId < 0) {
    throw new Error(`Invalid frameId context: ${frameId}`);
  }

  return {
    url: rawUrl,
    origin: urlObj.origin,
    hostname: urlObj.hostname,
    pathname: urlObj.pathname,
    tabId,
    frameId,
    timestamp: Date.now(),
  };
}

export function validateContext(context: unknown): PlatformContext {
  if (!context || typeof context !== "object") {
    throw new Error("Context must be a valid object.");
  }

  const pCtx = context as Partial<PlatformContext>;

  if (typeof pCtx.url !== "string" || pCtx.url.trim() === "") {
    throw new Error("Missing or invalid URL in platform context.");
  }

  if (typeof pCtx.tabId !== "number" || !Number.isInteger(pCtx.tabId) || pCtx.tabId < 0) {
    throw new Error("Missing or invalid tabId in platform context.");
  }

  if (typeof pCtx.frameId !== "number" || !Number.isInteger(pCtx.frameId) || pCtx.frameId < 0) {
    throw new Error("Missing or invalid frameId in platform context.");
  }

  // Recalculate parameters dynamically to prevent forgery
  return createPlatformContext(pCtx.url, pCtx.tabId, pCtx.frameId);
}
