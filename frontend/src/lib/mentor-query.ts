import type { PublicMentor } from "../data/mentors";

export function findMentorByQuery(
  mentors: PublicMentor[],
  value: string | null,
): PublicMentor | null {
  const query = value?.trim();
  if (!query) return null;
  return mentors.find((mentor) => mentor.id === query
    || mentor.handle.toLowerCase() === query.toLowerCase()) ?? null;
}
