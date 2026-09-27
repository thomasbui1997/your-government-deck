import "server-only";
import { type SocialLink, socialLinks } from "@/lib/socials";

// github.com/unitedstates/congress-legislators: public-domain roster details that
// Congress.gov lacks (term end dates, nicknames, Senate LIS IDs used by senate.gov votes).
const CURRENT =
  "https://raw.githubusercontent.com/unitedstates/congress-legislators/gh-pages/legislators-current.json";
const SOCIAL =
  "https://raw.githubusercontent.com/unitedstates/congress-legislators/gh-pages/legislators-social-media.json";

interface RawSocial {
  id: { bioguide: string };
  social: Record<string, string>;
}

interface RawLegislator {
  id: { bioguide: string; lis?: string };
  name: { first: string; last: string; nickname?: string; official_full?: string };
  terms: {
    type: "sen" | "rep";
    end: string;
    url?: string;
    phone?: string;
    office?: string;
    address?: string;
  }[];
}

export interface LegislatorInfo {
  displayName: string;
  lisId?: string;
  termEnd: string;
  website?: string;
  phone?: string;
  office?: string;
  socials: SocialLink[];
}

export async function getLegislatorIndex(): Promise<Map<string, LegislatorInfo>> {
  const [res, socialRes] = await Promise.all([
    fetch(CURRENT, { next: { revalidate: 86400 } }),
    fetch(SOCIAL, { next: { revalidate: 86400 } }),
  ]);
  if (!res.ok) throw new Error(`congress-legislators ${res.status}`);
  const raw: RawLegislator[] = await res.json();
  // Social handles are nice-to-have; a failed fetch just means no links.
  const social: RawSocial[] = socialRes.ok ? await socialRes.json() : [];
  const socialsById = new Map(social.map((s) => [s.id.bioguide, s.social]));

  const index = new Map<string, LegislatorInfo>();
  for (const l of raw) {
    const term = l.terms[l.terms.length - 1];
    // Prefer how they're commonly known ("Ed Markey"), else the official full name without
    // middle initials ("Stephen F. Lynch" → "Stephen Lynch", "Eleanor Holmes Norton" stays).
    const displayName = l.name.nickname
      ? `${l.name.nickname} ${l.name.last}`
      : (l.name.official_full ?? `${l.name.first} ${l.name.last}`).replace(/ [A-Z]\. /g, " ");
    index.set(l.id.bioguide, {
      displayName,
      lisId: l.id.lis,
      termEnd: term.end,
      website: term.url,
      phone: term.phone,
      office: term.address ?? term.office,
      socials: socialLinks(socialsById.get(l.id.bioguide) ?? {}),
    });
  }
  return index;
}
