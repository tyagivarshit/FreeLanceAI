import { fetchJson } from "./api.js";
import type {
  ProfileResponse,
  SessionsResponse,
  ExtensionResponse,
  DataExportResponse,
} from "../types/settings.js";

export const settingsService = {
  async getProfile(signal?: AbortSignal): Promise<ProfileResponse> {
    return fetchJson<ProfileResponse>("/api/settings/profile", signal ? { signal } : undefined);
  },

  async getSessions(signal?: AbortSignal): Promise<SessionsResponse> {
    return fetchJson<SessionsResponse>(
      "/api/settings/security/sessions",
      signal ? { signal } : undefined,
    );
  },

  async changePassword(payload: {
    currentPassword: string;
    newPassword: string;
  }): Promise<{ success: boolean; error?: string }> {
    return fetchJson<{ success: boolean; error?: string }>("/api/settings/security/password", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async revokeSession(sessionId: string): Promise<{ success: boolean; error?: string }> {
    return fetchJson<{ success: boolean; error?: string }>(
      `/api/settings/security/sessions/${encodeURIComponent(sessionId)}`,
      {
        method: "DELETE",
      },
    );
  },

  async revokeAllOtherSessions(): Promise<{ success: boolean; error?: string }> {
    return fetchJson<{ success: boolean; error?: string }>("/api/settings/security/sessions", {
      method: "DELETE",
    });
  },

  async getExtensionSettings(signal?: AbortSignal): Promise<ExtensionResponse> {
    return fetchJson<ExtensionResponse>("/api/settings/extension", signal ? { signal } : undefined);
  },

  async getDataExport(): Promise<DataExportResponse> {
    return fetchJson<DataExportResponse>("/api/settings/data/export");
  },
};
