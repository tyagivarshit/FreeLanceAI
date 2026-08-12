export type ExtractionStatus = "SUCCESS" | "PARTIAL" | "FAILED" | "UNSUPPORTED";

export interface PlatformContext {
  url: string;
  origin: string;
  hostname: string;
  pathname: string;
  tabId: number;
  frameId: number;
  timestamp: number;
}

export interface PlatformJobIdentity {
  platform: string;
  externalId: string;
  canonicalUrl: string;
}

export interface ExtractionPayload {
  title?: string;
  description?: string;
  budget?: string;
  skills?: string[];
  experience?: string;
  metadata?: Record<string, string>;
}

export interface ExtractionWarning {
  code: string;
  message: string;
}

export interface ExtractionResult {
  status: ExtractionStatus;
  jobId?: PlatformJobIdentity | undefined;
  extractedAt: number;
  data?: ExtractionPayload | undefined;
  warnings?: ExtractionWarning[] | undefined;
  error?: { code: string; message: string } | undefined;
}

export interface PlatformAdapter {
  readonly identity: string;
  canHandle(context: PlatformContext): boolean;
  detect(context: PlatformContext): Promise<boolean>;
  identify(context: PlatformContext): Promise<PlatformJobIdentity>;
  extract(context: PlatformContext, signal?: AbortSignal): Promise<ExtractionResult>;
}
