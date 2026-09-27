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
  id: { bioguide: string; lis?: string; fec?: string[] };
  name: { first: string; last: string; nickname?: string; official_full?: string };
  terms: {
    type: "sen" | "rep";
    state: string;
    district?: number;
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
  /** Every FEC candidate ID they've had (one per office they've run for). */
  fecIds: string[];
  chamber: "Senate" | "House";
  state: string;
  district?: number;
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
      fecIds: l.id.fec ?? [],
      chamber: term.type === "sen" ? "Senate" : "House",
      state: term.state,
      district: term.district,
      termEnd: term.end,
      website: term.url,
      phone: term.phone,
      office: term.address ?? term.office,
      socials: socialLinks(socialsById.get(l.id.bioguide) ?? {}),
    });
  }
  return index;
}

// ---- Committees ------------------------------------------------------------

const COMMITTEES =
  "https://raw.githubusercontent.com/unitedstates/congress-legislators/gh-pages/committees-current.json";
const MEMBERSHIP =
  "https://raw.githubusercontent.com/unitedstates/congress-legislators/gh-pages/committee-membership-current.json";

interface RawCommittee {
  thomas_id: string;
  name: string;
  subcommittees?: { thomas_id: string; name: string }[];
}

export interface CommitteeSeat {
  name: string;
  /** Leadership title as listed, e.g. "Chair", "Ranking Member". */
  role?: string;
  /** Set for subcommittees: the full committee's name. */
  parent?: string;
}

/**
 * Committees a member sits on, plus any subcommittee they lead. Plain subcommittee seats are
 * left out; there are too many to be informative.
 */
export async function getCommittees(bioguideId: string): Promise<CommitteeSeat[]> {
  const [cRes, mRes] = await Promise.all([
    fetch(COMMITTEES, { next: { revalidate: 86400 } }),
    fetch(MEMBERSHIP, { next: { revalidate: 86400 } }),
  ]);
  if (!cRes.ok || !mRes.ok) throw new Error("congress-legislators committees unavailable");
  const committees: RawCommittee[] = await cRes.json();
  const membership: Record<string, { bioguide: string; title?: string }[]> = await mRes.json();

  const names = new Map<string, { name: string; parent?: string }>();
  for (const c of committees) {
    names.set(c.thomas_id, { name: c.name });
    for (const sub of c.subcommittees ?? []) {
      names.set(c.thomas_id + sub.thomas_id, { name: sub.name, parent: c.name });
    }
  }

  const seats: CommitteeSeat[] = [];
  for (const [id, members] of Object.entries(membership)) {
    const me = members.find((m) => m.bioguide === bioguideId);
    const committee = names.get(id);
    if (!me || !committee) continue;
    if (committee.parent && !me.title) continue;
    seats.push({ ...committee, ...(me.title ? { role: me.title } : {}) });
  }
  // Full committees first, then led subcommittees.
  return seats.sort((a, b) => Number(!!a.parent) - Number(!!b.parent) || a.name.localeCompare(b.name));
}
