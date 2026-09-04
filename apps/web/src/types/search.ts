export type SearchResultType = "CLIENT" | "JOB" | "MATCH" | "TIMELINE";

export interface SearchResultItem {
  resultType: SearchResultType;
  entityId: string;
  display: {
    title: string;
    subtitle?: string | null;
    snippet?: string | null;
  };
  relevance?: {
    score?: number | null;
    matchedFields?: string[];
  } | null;
}

export interface SearchResponse {
  success: boolean;
  results: SearchResultItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  count: number;
  isEmpty: boolean;
  error?: string;
}
