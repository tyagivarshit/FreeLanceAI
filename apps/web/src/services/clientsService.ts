import { fetchJson } from "./api.js";
import type {
  ClientsListResponse,
  ClientDetailResponse,
  ClientTimelineResponse,
} from "../types/client.js";

export const clientsService = {
  async getClients(params: {
    page?: number;
    pageSize?: number;
    status?: string;
    signal?: AbortSignal;
  }): Promise<ClientsListResponse> {
    const searchParams = new URLSearchParams({
      page: String(params.page || 1),
      pageSize: String(params.pageSize || 20),
    });
    if (params.status) {
      searchParams.set("status", params.status);
    }
    return fetchJson<ClientsListResponse>(
      `/api/clients?${searchParams.toString()}`,
      params.signal ? { signal: params.signal } : undefined,
    );
  },

  async getClient(id: string, signal?: AbortSignal): Promise<ClientDetailResponse> {
    return fetchJson<ClientDetailResponse>(
      `/api/clients/${encodeURIComponent(id)}`,
      signal ? { signal } : undefined,
    );
  },

  async getClientTimeline(
    id: string,
    params: { page?: number; pageSize?: number; signal?: AbortSignal } = {},
  ): Promise<ClientTimelineResponse> {
    const searchParams = new URLSearchParams({
      page: String(params.page || 1),
      pageSize: String(params.pageSize || 20),
    });
    return fetchJson<ClientTimelineResponse>(
      `/api/clients/${encodeURIComponent(id)}/timeline?${searchParams.toString()}`,
      params.signal ? { signal: params.signal } : undefined,
    );
  },
};
