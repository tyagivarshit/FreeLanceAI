export type ClientStatus = "Lead" | "Active" | "Suspended" | "Archived" | "Closed";

export interface Client {
  id: string;
  name: string;
  email: string | null;
  phone?: string | null;
  website: string | null;
  status: ClientStatus | string;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface ClientTimelineEntry {
  id: string;
  eventRef?: string | null;
  category: string;
  timestamp: string;
  message?: string | null;
  visibility?: string | null;
}

export interface ClientTimeline {
  id?: string | null;
  clientId?: string | null;
  status?: string;
  entries: ClientTimelineEntry[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ClientsListResponse {
  success: boolean;
  clients: Client[];
  total: number;
  page: number;
  pageSize: number;
  error?: string;
}

export interface ClientDetailResponse {
  success: boolean;
  client: Client;
  error?: string;
}

export interface ClientTimelineResponse {
  success: boolean;
  timeline: ClientTimeline;
  error?: string;
}
