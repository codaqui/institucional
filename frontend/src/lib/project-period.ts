const projectDateFormatter = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" });

export function formatProjectPeriod(from: string | null, to: string | null): string {
  if (from && to) return `${projectDateFormatter.format(new Date(from))} a ${projectDateFormatter.format(new Date(to))}`;
  if (from) return `a partir de ${projectDateFormatter.format(new Date(from))}`;
  if (to) return `até ${projectDateFormatter.format(new Date(to))}`;
  return "A definir";
}
