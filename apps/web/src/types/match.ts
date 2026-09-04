export interface ScoreBreakdown {
  skills?: number;
  semantic?: number;
  experience?: string;
  budget?: string;
  jobType?: string;
  location?: string;
}

export interface MatchItem {
  id: string;
  jobId?: string;
  jobTitle: string;
  platform: string;
  score: number;
  status: "CREATED" | "EVALUATED" | "ARCHIVED" | string;
  cacheState?: "CACHED" | "FRESH" | string;
  explanation?: string;
  strengths?: string[];
  gaps?: string[];
  risks?: string;
  recommendations?: string;
  budget?: string;
  jobDescription?: string;
  canonicalUrl?: string;
  scoreBreakdown?: ScoreBreakdown;
  createdAt?: string;
  updatedAt?: string;
}

export interface MatchesResponse {
  success: boolean;
  matches: MatchItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  count: number;
  error?: string;
}

export interface MatchDetailResponse {
  success: boolean;
  match: MatchItem;
  error?: string;
}
