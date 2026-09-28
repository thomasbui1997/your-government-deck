import "server-only";
import type { ActivityItem } from "@/lib/types";

// Federal Register API: free, no key. Every executive order, proclamation, memorandum, etc.
// the President signs is published here, with its signing date and official document page.
// https://www.federalregister.gov/developers/documentation/api/v1
const API = "https://www.federalregister.gov/api/v1/documents.json";

/** The sitting President's Federal Register identifier, and the day his current term began. */
const PRESIDENT = { slug: "donald-trump", termStart: "2025-01-20" };

export const federalRegisterSource = {
  title: "Federal Register: Presidential Documents",
  url: `https://www.federalregister.gov/presidential-documents`,
};

interface FrDocument {
  title: string;
  signing_date: string | null;
  publication_date: string;
  /** "Executive Order", "Proclamation", "Memorandum", "Notice", "Determination", "Presidential Order", "Other". */
  subtype: string | null;
  executive_order_number: string | null;
  proclamation_number: string | null;
  html_url: string;
  citation: string | null;
}

/**
 * The President's newest documents in the Federal Register for the current term, newest first
 * (by publication date, as the API orders them). Documents appear each weekday, so this refreshes hourly.
 */
export async function getPresidentialDocuments(limit: number): Promise<ActivityItem[]> {
  const params = new URLSearchParams({
    "conditions[type][]": "PRESDOCU",
    "conditions[president][]": PRESIDENT.slug,
    // The president slug spans both Trump terms; keep to this one.
    "conditions[signing_date][gte]": PRESIDENT.termStart,
    order: "newest",
    per_page: String(limit),
  });
  for (const f of [
    "title",
    "signing_date",
    "publication_date",
    "subtype",
    "executive_order_number",
    "proclamation_number",
    "html_url",
    "citation",
  ]) {
    params.append("fields[]", f);
  }
  const res = await fetch(`${API}?${params}`, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`Federal Register ${res.status}`);
  const data: { results?: FrDocument[] } = await res.json();

  return (data.results ?? [])
    .map((d) => {
      const number = d.executive_order_number ?? d.proclamation_number ?? undefined;
      return {
        kind: "executive",
        date: d.signing_date ?? d.publication_date,
        dateKind: d.signing_date ? "signed" : "published",
        title: d.title,
        // The Federal Register citation, e.g. "91 FR 60501".
        detail: d.citation ?? undefined,
        badge: d.subtype ?? undefined,
        badgeNumber: d.subtype ? number : undefined,
        url: d.html_url,
      } satisfies ActivityItem;
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}
