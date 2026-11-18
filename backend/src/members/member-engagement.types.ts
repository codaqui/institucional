export interface MemberEngagement {
  designations: Array<{ key: string; label: string }>;
  communities: Array<{ slug: string; name: string; href: string }>;
  mentor: { id: string; href: string } | null;
}
