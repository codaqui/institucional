export const ANALYTICS_URL = "/analytics/index.json";

export interface MonthlyMetric {
  period: string;
  screenPageViews: number;
  activeUsers: number;
  sessions: number;
  averageSessionDuration: number;
  bounceRate: number;
}

export interface PageMetric {
  pagePath: string;
  screenPageViews: number;
  activeUsers: number;
}

export interface AnalyticsSnapshot {
  updatedAt: string;
  latestPeriod: string;
  totals: {
    screenPageViews: number;
    activeUsers: number;
    sessions: number;
    peakMonth: string;
    peakViews: number;
  };
  monthly: MonthlyMetric[];
  topPages: PageMetric[];
  trafficSources: Record<string, number>;
}
