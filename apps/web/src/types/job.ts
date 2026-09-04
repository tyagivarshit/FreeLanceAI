export interface Job {
  id: string;
  title: string;
  platform?: string;
  budget?: string | null;
  skills?: string[];
  score?: number | null;
  matchExplanation?: string | null;
  createdAt?: string;
  url?: string;
}

export interface JobsResponse {
  success?: boolean;
  jobs: Job[];
  error?: string;
}

export interface JobMatchResult {
  success?: boolean;
  score: number;
  matchExplanation?: string;
  reason?: string;
  error?: string;
}
