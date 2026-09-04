export interface KpiMetric {
  value: number | string;
  trend?: string;
}

export interface OpportunityPulse {
  description?: string;
  active?: boolean;
}

export interface ActivityItem {
  id?: string;
  message: string;
  timestamp: string;
}

export interface ActivityResponse {
  success?: boolean;
  activity: ActivityItem[];
  error?: string;
}
