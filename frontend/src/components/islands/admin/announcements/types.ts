export type AnnouncementSeverity = "info" | "success" | "warning" | "error";

export interface Announcement {
  id: string;
  text: string;
  severity: AnnouncementSeverity;
  linkUrl: string | null;
  linkLabel: string | null;
  startsAt: string | null;
  endsAt: string | null;
  active: boolean;
  createdById?: string;
  updatedById?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AnnouncementInput {
  text: string;
  severity: AnnouncementSeverity;
  linkUrl: string;
  linkLabel: string;
  startsAt: string;
  endsAt: string;
  active: boolean;
}
