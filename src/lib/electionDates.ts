/** Federal Election Day: the Tuesday after the first Monday in November. ISO date. */
export function electionDay(year: number) {
  const nov1 = new Date(Date.UTC(year, 10, 1));
  const firstMonday = 1 + ((8 - nov1.getUTCDay()) % 7);
  return `${year}-11-${String(firstMonday + 1).padStart(2, "0")}`;
}

/** Polls close in the evening; count Election Day itself as still ahead (until it ends in Hawaii). */
export const isAhead = (isoDate: string, now = new Date()) =>
  now.getTime() < new Date(`${isoDate}T23:59:59-10:00`).getTime();

/** Whole days from today (US Eastern) to an ISO date; 0 on the day itself. */
export function daysUntil(isoDate: string, now = new Date()) {
  const today = now.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const ms = Date.parse(`${isoDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`);
  return Math.max(0, Math.round(ms / 86400000));
}

/** "Nov 3" in the reader's language, without time-zone drift. */
export function formatElectionDate(isoDate: string, lang: string) {
  return new Date(`${isoDate}T12:00:00Z`).toLocaleDateString(lang, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** "Aug 12, 2026" in the reader's language. */
export function formatDate(isoDate: string, lang: string) {
  return new Date(`${isoDate}T12:00:00Z`).toLocaleDateString(lang, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
