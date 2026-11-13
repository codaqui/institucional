// Tipos compartilhados das ilhas de gestão C4P (admin) e do relatório PDF.
export interface Criterion {
  key: string;
  label: string;
  weight: number;
}

export interface ManageCall {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  managedEventId: string | null;
  communityId: string | null;
  status: "draft" | "open" | "closed";
  submissionOpenAt: string | null;
  submissionCloseAt: string | null;
  criteria: Criterion[];
  publicResults: boolean;
  finalizedAt: string | null;
  createdAt: string;
  talksCount?: number;
  evaluatorsActiveCount?: number;
  votesCount?: number;
}

export interface ManageTalk {
  id: string;
  callId: string;
  speakerName: string;
  speakerEmail: string;
  title: string;
  track: string | null;
  level: string | null;
  origin: "public_form" | "csv_import";
  consentAt: string | null;
  createdAt: string;
}

export interface EvaluatorSummary {
  designationId: string;
  status: "pending" | "active" | "removed" | "ended";
  since: string;
  member: { id: string; name: string; handle: string; avatarUrl: string | null };
}

export interface RankingRow {
  talkId: string;
  position: number | null;
  title: string;
  speakerName: string;
  track: string | null;
  level: string | null;
  avgTotal: number | null;
  votesCount: number;
  avgCriteria: Record<string, number>;
  selected: boolean;
}

export interface C4pDashboard {
  totals: {
    talks: number;
    evaluators: number;
    votes: number;
    expected: number;
    completionPercent: number;
  };
  progressByEvaluator: Array<{
    designationId: string;
    member: { name: string; handle: string };
    done: number;
    total: number;
    complete: boolean;
  }>;
  ranking: RankingRow[];
  criteriaAverages: Array<{ key: string; label: string; average: number }>;
  byTrack: Array<{ value: string; count: number }>;
  byLevel: Array<{ value: string; count: number }>;
}

export interface C4pReport {
  call: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    finalizedAt: string | null;
  };
  criteria: Criterion[];
  selectedTalkIds: string[];
  ranking: RankingRow[];
  votes: Array<{
    talkId: string;
    evaluatorName: string;
    scores: Record<string, number>;
    comment: string | null;
    updatedAt: string;
  }>;
}
