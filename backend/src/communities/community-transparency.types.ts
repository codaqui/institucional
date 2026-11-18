export interface CommunityTransparencyActivity {
  key: string;
  title: string;
  kind: 'managed' | 'external';
  startAt: string;
}

export interface CommunityTransparencyResponsible {
  id: string;
  name: string;
  githubHandle: string;
  avatarUrl: string | null;
}

export interface CommunityTransparencyResult {
  community: { slug: string; name: string };
  responsible: CommunityTransparencyResponsible | null;
  year: number | null;
  availableYears: number[];
  metrics: {
    events: number;
    participations: number;
    certificates: number;
    eventHours: number;
  };
  upcomingActivities: CommunityTransparencyActivity[];
  recentActivities: CommunityTransparencyActivity[];
}
