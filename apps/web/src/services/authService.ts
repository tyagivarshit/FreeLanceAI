import { fetchJson } from "./api.js";
import type {
  SessionResponse,
  SignupResponse,
  LoginResponse,
  LogoutResponse,
} from "../types/auth.js";

export const authService = {
  async getSession(signal?: AbortSignal): Promise<SessionResponse> {
    return fetchJson<SessionResponse>("/api/session", signal ? { signal } : undefined);
  },

  async signup(payload: { email: string; password: string }): Promise<SignupResponse> {
    return fetchJson<SignupResponse>("/api/signup", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async login(payload: { email: string; password: string }): Promise<LoginResponse> {
    return fetchJson<LoginResponse>("/api/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async logout(options: { global?: boolean } = {}): Promise<LogoutResponse> {
    return fetchJson<LogoutResponse>("/api/logout", {
      method: "POST",
      body: JSON.stringify({ global: options.global ?? false }),
    });
  },

  async verifyEmail(token: string): Promise<{ success: boolean; message?: string }> {
    return fetchJson<{ success: boolean; message?: string }>("/api/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ token }),
    });
  },
};
