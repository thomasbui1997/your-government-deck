// Finds and reads archived campaign pages from the Wayback Machine.

export interface ArchivedPage {
  url: string; // original URL
  archiveUrl: string; // permanent Wayback link, used as the promise source
  timestamp: string; // YYYYMMDDhhmmss
  title: string;
  text: string;
}

const CDX = "https://web.archive.org/cdx/search/cdx";

const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");

/**
 * Lists a site's pages captured in the months before an election, keeping the capture
 * closest to election day for each URL whose path matches one of `include`.
 */
export async function findCampaignPages(
  domain: string,
  electionDate: string,
  include: string[],
): Promise<{ url: string; timestamp: string }[]> {
  const election = new Date(electionDate);
  const from = new Date(election.getTime() - 180 * 86400000);
  const params = new URLSearchParams({
    url: `${domain}/*`,
    from: ymd(from),
    to: ymd(election),
    output: "json",
    fl: "timestamp,original",
    filter: "statuscode:200",
    limit: "5000",
  });
  const res = await fetch(`${CDX}?${params}`);
  if (!res.ok) throw new Error(`Wayback CDX ${res.status}`);
  const rows: string[][] = (await res.json()).slice(1);

  const patterns = include.map((p) => new RegExp(p));
  const latest = new Map<string, string>();
  for (const [timestamp, original] of rows) {
    const u = new URL(original);
    if (u.search || !patterns.some((p) => p.test(u.pathname))) continue;
    const key = `${u.host.replace(/^www\./, "")}${u.pathname}`;
    // Rows are sorted by time, so later captures overwrite earlier ones.
    latest.set(key, timestamp);
  }
  return [...latest].map(([key, timestamp]) => ({ url: `https://${key}`, timestamp }));
}

const ENTITIES: Record<string, string> = {
  "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " ",
  "&rsquo;": "’", "&lsquo;": "‘", "&ldquo;": "“", "&rdquo;": "”", "&mdash;": "—", "&ndash;": "–",
  "&hellip;": "…",
};

function decode(s: string) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&[a-z]+;/gi, (e) => ENTITIES[e.toLowerCase()] ?? e);
}

/** Main-content text of a page: drops scripts, navigation, headers, and footers. */
export function htmlToText(html: string) {
  const main = html.match(/<main[\s\S]*?<\/main>/i)?.[0] ?? html;
  return decode(
    main
      .replace(/<(script|style|noscript|svg|nav|header|footer|form)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<\/(p|div|li|h[1-6]|section|article|br)>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<li[^>]*>/gi, "• ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}

export async function readArchivedPage(url: string, timestamp: string): Promise<ArchivedPage> {
  // "id_" returns the original HTML without the Wayback toolbar.
  const res = await fetch(`https://web.archive.org/web/${timestamp}id_/${url}`);
  if (!res.ok) throw new Error(`Wayback ${res.status} for ${url}`);
  const html = await res.text();
  const title = decode(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? url).trim();
  return {
    url,
    archiveUrl: `https://web.archive.org/web/${timestamp}/${url}`,
    timestamp,
    title,
    text: htmlToText(html),
  };
}

/** Whitespace/quote/case-insensitive containment check for verifying quotes. */
export function containsQuote(pageText: string, quote: string) {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[—–]/g, "-")
      .replace(/\s+/g, " ")
      .trim();
  return norm(pageText).includes(norm(quote));
}
