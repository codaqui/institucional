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

const DATETIME_LOCAL_TIMEZONE = "America/Sao_Paulo";

function timezoneOffset(timezone: string, date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values: Record<string, number> = {};
  for (const part of parts) {
    if (part.type !== "literal") values[part.type] = Number(part.value);
  }
  const wallClockAsUtc = Date.UTC(
    values.year,
    values.month - 1,
    values.day,
    values.hour,
    values.minute,
    values.second,
  );
  return wallClockAsUtc - date.getTime();
}

function parseDateTimeLocal(startAt: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(startAt);
  if (!match) return new Date(Number.NaN);
  const [, year, month, day, hour, minute] = match;
  const wallClockAsUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
  );
  let instant = new Date(wallClockAsUtc);
  for (let iteration = 0; iteration < 2; iteration += 1) {
    const offset = timezoneOffset(DATETIME_LOCAL_TIMEZONE, instant);
    const next = new Date(wallClockAsUtc - offset);
    if (next.getTime() === instant.getTime()) break;
    instant = next;
  }
  return instant;
}

export function getEventLocalHour(
  startAt: string,
  timezone: string,
): number | null {
  try {
    const date = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(startAt)
      ? parseDateTimeLocal(startAt)
      : new Date(startAt);
    if (Number.isNaN(date.getTime())) return null;
    const hour = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone || DATETIME_LOCAL_TIMEZONE,
      hour: "2-digit",
      hourCycle: "h23",
    }).format(date);
    return Number(hour);
  } catch {
    return null;
  }
}
