export type VenueType =
  | "bar"
  | "restaurante"
  | "auditorio"
  | "campus"
  | "online"
  | "outro";

export const ADULT_CONTENT_BADGE = "+18";
export const ADULT_CONTENT_NOTICE_TITLE =
  "Evento destinado a maiores de 18 anos";
export const ADULT_CONTENT_NOTICE_BODY =
  "Este evento acontece em local, horário ou contexto destinado a maiores. Menores de idade devem participar acompanhados de um responsável legal. A sinalização é informativa e não substitui as regras do local nem a verificação de responsabilidade do organizador.";

export function shouldSuggestAdult({
  venueType,
  localHour,
}: {
  venueType: VenueType | "" | null;
  localHour: number | null;
}): boolean {
  return (
    (venueType === "bar" || venueType === "restaurante") &&
    localHour !== null &&
    localHour >= 18
  );
}

export function getEventLocalHour(
  startAt: string,
  timezone: string,
): number | null {
  const wallClock = /^\d{4}-\d{2}-\d{2}T(\d{2}):\d{2}$/.exec(startAt);
  if (wallClock) {
    const date = new Date(startAt);
    return Number.isNaN(date.getTime()) ? null : Number(wallClock[1]);
  }

  const date = new Date(startAt);
  if (Number.isNaN(date.getTime())) return null;
  try {
    const hour = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone || "America/Sao_Paulo",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(date);
    return Number(hour);
  } catch {
    return null;
  }
}
