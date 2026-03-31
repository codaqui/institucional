/**
 * OpenCollective configuration and type definitions.
 * All OC-related constants live here — never hardcode the slug elsewhere.
 */

export const OC_SLUG = "codaqui";
export const OC_BASE_URL = "https://opencollective.com";
export const OC_COLLECTIVE_URL = `${OC_BASE_URL}/${OC_SLUG}`;
export const OC_DONATE_URL = `${OC_COLLECTIVE_URL}/donate`;
export const OC_MEMBERS_API = `${OC_COLLECTIVE_URL}/members.json`;

/** Roles returned by the OpenCollective members API */
export type OCRole = "ADMIN" | "BACKER" | "MEMBER" | "FOLLOWER" | "HOST" | "CONTRIBUTOR";

export interface OCMember {
  MemberId: number;
  createdAt: string;
  type: "USER" | "ORGANIZATION";
  role: OCRole;
  tier?: string;
  isActive: boolean;
  totalAmountDonated: number;
  currency: string;
  lastTransactionAt: string;
  lastTransactionAmount: number;
  profile: string;
  name: string;
  company: string | null;
  description: string | null;
  image: string | null;
  website: string | null;
  twitter: string | null;
  github: string | null;
}
