export interface UserProfile {
  userId: string;
  email: string;
  status: string;
  createdAt: string;
}

export interface ProfileResponse {
  success: boolean;
  profile: UserProfile;
  error?: string;
}

export interface UserSession {
  sessionId: string;
  userId?: string;
  ipAddress?: string;
  browser?: string;
  platform?: string;
  deviceName?: string;
  lastActivityAt?: string;
  createdAt?: string;
  isCurrent?: boolean;
}

export interface SessionsResponse {
  success: boolean;
  sessions: UserSession[];
  currentSessionId?: string;
  error?: string;
}

export interface ExtensionPlatform {
  id: string;
  name: string;
  supported: boolean;
  matchPattern?: string;
}

export interface ExtensionSettings {
  name: string;
  version: string;
  manifestVersion?: number;
  supportedPlatforms: ExtensionPlatform[];
  syncPreferences?: {
    autoImport?: boolean;
    backgroundSync?: boolean;
  };
  connectionStatus?: string;
}

export interface ExtensionResponse {
  success: boolean;
  extension: ExtensionSettings;
  error?: string;
}

export interface DataExportResponse {
  success: boolean;
  export?: Record<string, unknown>;
  error?: string;
}
