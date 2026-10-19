const relative = new Intl.RelativeTimeFormat("fr-FR", { numeric: "auto" });

const dateTime = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

/** « il y a 5 minutes », « hier »... (`now` passé par l'appelant : rendu déterministe). */
export function timeAgo(ms: number, now: number): string {
  const minutes = Math.round((ms - now) / 60_000);
  if (Math.abs(minutes) < 60) return relative.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return relative.format(hours, "hour");
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return relative.format(days, "day");
  return relative.format(Math.round(days / 30), "month");
}

export function formatDateTime(ms: number): string {
  return dateTime.format(ms);
}
