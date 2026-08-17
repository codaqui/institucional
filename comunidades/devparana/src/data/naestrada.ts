export interface ScheduleItem {
  time: string;
  label: string;
}

export interface SponsorshipTier {
  name: string;
  value: string;
  benefits: string[];
}

export interface NaEstradaEdition {
  year: number;
  status: "upcoming" | "ongoing" | "past";
  period: string;
  cities: string[];
  formats: {
    meetup: { schedule: ScheduleItem[] };
    workshop: { price: string; schedule: ScheduleItem[] };
  };
  sponsorshipTiers: SponsorshipTier[];
}

import data from "./naestrada.json";

export const naEstrada2026: NaEstradaEdition = data.edition as NaEstradaEdition;
