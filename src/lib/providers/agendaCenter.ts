import "server-only";
import type { ActivityItem } from "@/lib/types";

// CivicPlus "Agenda Center", which many towns (including Stoughton) use to post
// agendas and minutes. There's no API, so this reads the search results page.

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const mmddyyyy = (d: Date) =>
  `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;

const clean = (s: string) =>
  s
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&rsquo;/g, "’")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Recent meetings of one board (an Agenda Center category), newest first. */
export async function getMeetings(
  agendaCenterUrl: string,
  categoryId: number,
  limit: number,
): Promise<ActivityItem[]> {
  const origin = new URL(agendaCenterUrl).origin;
  const end = new Date();
  const start = new Date(end.getTime() - 180 * 86400000);
  const url = `${agendaCenterUrl}/Search/?term=&CIDs=${categoryId},&startDate=${mmddyyyy(start)}&endDate=${mmddyyyy(end)}&dateRange=&dateSelector=`;

  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (YourGovernmentDeck)" },
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`Agenda Center ${res.status}`);
  const html = await res.text();

  const items: ActivityItem[] = [];
  for (const row of html.matchAll(/<tr[^>]*class="catAgendaRow"[^>]*>([\s\S]*?)<\/tr>/g)) {
    const cells = row[1];
    // The visible date is split by <abbr> markup; the aria-label has it whole.
    const date = cells.match(/aria-label="Agenda for ([A-Z][a-z]+) (\d{1,2}), (\d{4})"/);
    const month = date ? MONTHS.indexOf(date[1]) + 1 : 0;
    const agenda = cells.match(/href="(\/AgendaCenter\/ViewFile\/Agenda\/[^"]+)"/)?.[1];
    const minutes = cells.match(/href="(\/AgendaCenter\/ViewFile\/Minutes\/[^"]+)"/)?.[1];
    const title = clean(cells.match(/<a[^>]*ViewFile\/Agenda[^>]*>([\s\S]*?)<\/a>/)?.[1] ?? "")
      .replace(/\s*\(PDF\)$/, "");
    if (!date || !month || !agenda || !title) continue;
    items.push({
      kind: "meeting",
      date: `${date[3]}-${String(month).padStart(2, "0")}-${date[2].padStart(2, "0")}`,
      title,
      // Link the minutes once they're posted, otherwise the agenda.
      badge: minutes ? "Minutes" : "Agenda",
      url: `${origin}${minutes ?? agenda}`,
    });
  }
  // A meeting sometimes appears twice (re-posted agenda); keep the first.
  const seen = new Set<string>();
  return items
    .filter((i) => (seen.has(i.url!) ? false : (seen.add(i.url!), true)))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);
}
