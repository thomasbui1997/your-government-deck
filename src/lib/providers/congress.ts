import "server-only";
import type { ActivityItem, Party } from "@/lib/types";

const BASE = "https://api.congress.gov/v3";
const DAY = 86400;
const HOUR = 3600;

async function cg<T>(
  path: string,
  params: Record<string, string | number> = {},
  revalidate = HOUR,
): Promise<T> {
  const key = process.env.CONGRESS_API_KEY;
  if (!key) throw new Error("CONGRESS_API_KEY is not set in .env.local");
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  url.searchParams.set("format", "json");
  url.searchParams.set("api_key", key);
  const res = await fetch(url, { next: { revalidate } });
  if (!res.ok) throw new Error(`Congress.gov ${res.status} for ${path}`);
  return res.json() as Promise<T>;
}

/** Congress number and session in effect for a date (sessions: odd year = 1). */
export function currentCongress(now = new Date()) {
  const year = now.getFullYear();
  return {
    congress: Math.floor((year - 1789) / 2) + 1,
    session: year % 2 === 1 ? 1 : 2,
  };
}

export function partyFromName(name: string): Party {
  if (name.startsWith("Democrat")) return "D";
  if (name.startsWith("Republican")) return "R";
  if (name.startsWith("Independent")) return "I";
  return "NP";
}

// ---- Members ---------------------------------------------------------------

interface CgMemberListItem {
  bioguideId: string;
  name: string; // "Lynch, Stephen F."
  partyName: string;
  district?: number | null;
  depiction?: { imageUrl?: string };
  terms: { item: { chamber: string; startYear: number }[] };
}

export interface DelegationMember {
  bioguideId: string;
  invertedName: string;
  party: Party;
  chamber: "Senate" | "House";
  district?: number;
  imageUrl?: string;
  firstYear: number;
}

/** Current senators and House members for a state. */
export async function getDelegation(state: string): Promise<DelegationMember[]> {
  const data = await cg<{ members: CgMemberListItem[] }>(
    `/member/${state}`,
    { currentMember: "true", limit: 250 },
    DAY,
  );
  return data.members.map((m) => {
    const terms = m.terms.item;
    const latest = terms[terms.length - 1];
    return {
      bioguideId: m.bioguideId,
      invertedName: m.name,
      party: partyFromName(m.partyName),
      chamber: latest.chamber === "Senate" ? "Senate" : "House",
      district: m.district ?? 0,
      imageUrl: m.depiction?.imageUrl,
      firstYear: Math.min(...terms.map((t) => t.startYear)),
    };
  });
}

interface CgMemberDetail {
  bioguideId: string;
  directOrderName: string;
  partyHistory: { partyName: string }[];
  state: string;
  depiction?: { imageUrl?: string };
  officialWebsiteUrl?: string;
  addressInformation?: { officeAddress?: string; phoneNumber?: string };
  sponsoredLegislation?: { count: number };
  cosponsoredLegislation?: { count: number };
  terms: {
    chamber: string;
    memberType: string;
    stateCode: string;
    district?: number;
    startYear: number;
  }[];
}

export async function getMember(bioguideId: string) {
  const data = await cg<{ member: CgMemberDetail }>(`/member/${bioguideId}`, {}, DAY);
  return data.member;
}

// ---- Bills -----------------------------------------------------------------

interface CgBill {
  congress: number;
  type: string | null;
  number: string | null;
  title: string | null;
  introducedDate: string;
  latestAction?: { actionDate: string; text: string };
  // Amendments show up in these lists too; they carry amendmentNumber instead.
  amendmentNumber?: string;
}

const billPath: Record<string, string> = {
  HR: "house-bill",
  S: "senate-bill",
  HRES: "house-resolution",
  SRES: "senate-resolution",
  HJRES: "house-joint-resolution",
  SJRES: "senate-joint-resolution",
  HCONRES: "house-concurrent-resolution",
  SCONRES: "senate-concurrent-resolution",
};

const billLabel: Record<string, string> = {
  HR: "H.R.",
  S: "S.",
  HRES: "H.Res.",
  SRES: "S.Res.",
  HJRES: "H.J.Res.",
  SJRES: "S.J.Res.",
  HCONRES: "H.Con.Res.",
  SCONRES: "S.Con.Res.",
};

export function billNumberLabel(type: string, number: string | number) {
  const t = type.toUpperCase();
  return `${billLabel[t] ?? t} ${number}`;
}

export function billUrl(congress: number, type: string, number: string | number) {
  const path = billPath[type.toUpperCase()];
  return path ? `https://www.congress.gov/bill/${congress}th-congress/${path}/${number}` : undefined;
}

export async function getBills(
  bioguideId: string,
  kind: "sponsored" | "cosponsored",
  limit: number,
): Promise<ActivityItem[]> {
  const key = kind === "sponsored" ? "sponsoredLegislation" : "cosponsoredLegislation";
  const data = await cg<Record<string, CgBill[]>>(
    `/member/${bioguideId}/${kind}-legislation`,
    // Over-fetch because amendments are filtered out below.
    { limit: limit * 2 },
    HOUR,
  );
  return (data[key] ?? [])
    .filter((b) => b.type && b.number && b.title)
    .slice(0, limit)
    .map((b) => ({
      kind: kind === "sponsored" ? "bill" : "cosponsor",
      date: b.introducedDate,
      title: b.title!,
      badge: billNumberLabel(b.type!, b.number!),
      detail: b.latestAction ? `Latest: ${b.latestAction.text}` : undefined,
      url: billUrl(b.congress, b.type!, b.number!),
    }));
}

// ---- House votes -----------------------------------------------------------

interface CgHouseVote {
  congress: number;
  sessionNumber: number;
  rollCallNumber: number;
  startDate: string;
  result: string;
  legislationType?: string;
  legislationNumber?: string;
  legislationUrl?: string;
}

interface CgHouseVoteMembers {
  houseRollCallVoteMemberVotes: CgHouseVote & {
    voteQuestion: string;
    results: { bioguideID: string; voteCast: string }[];
  };
}

async function listHouseVotes(congress: number, session: number): Promise<CgHouseVote[]> {
  const all: CgHouseVote[] = [];
  for (let offset = 0; ; offset += 250) {
    const page = await cg<{
      houseRollCallVotes?: CgHouseVote[];
      pagination: { count: number };
    }>(`/house-vote/${congress}/${session}`, { limit: 250, offset }, HOUR);
    all.push(...(page.houseRollCallVotes ?? []));
    if (all.length >= page.pagination.count || !page.houseRollCallVotes?.length) break;
  }
  return all;
}

async function getBillTitle(congress: number, type: string, number: string) {
  try {
    const data = await cg<{ bill: { title: string } }>(
      `/bill/${congress}/${type.toLowerCase()}/${number}`,
      {},
      7 * DAY,
    );
    return data.bill.title;
  } catch {
    return undefined;
  }
}

/** The member's votes on the most recent House roll calls. */
export async function getHouseVotes(bioguideId: string, limit: number): Promise<ActivityItem[]> {
  const { congress } = currentCongress();
  let { session } = currentCongress();
  let votes = await listHouseVotes(congress, session);
  if (!votes.length && session === 2) votes = await listHouseVotes(congress, (session = 1));

  const recent = votes.sort((a, b) => b.rollCallNumber - a.rollCallNumber).slice(0, limit);

  const items = await Promise.all(
    recent.map(async (v) => {
      // Past roll calls never change, so cache them for a week.
      const detail = await cg<CgHouseVoteMembers>(
        `/house-vote/${congress}/${session}/${v.rollCallNumber}/members`,
        {},
        7 * DAY,
      );
      const r = detail.houseRollCallVoteMemberVotes;
      const cast = r.results.find((m) => m.bioguideID === bioguideId)?.voteCast;
      if (!cast) return null;
      const bill =
        r.legislationType && r.legislationNumber
          ? billNumberLabel(r.legislationType, r.legislationNumber)
          : undefined;
      const title =
        (r.legislationType && r.legislationNumber
          ? await getBillTitle(congress, r.legislationType, r.legislationNumber)
          : undefined) ?? r.voteQuestion;
      return {
        kind: "vote",
        date: r.startDate.slice(0, 10),
        title,
        badge: cast,
        detail: [bill, r.voteQuestion, r.result].filter(Boolean).join(" · "),
        url: r.legislationUrl ?? `https://clerk.house.gov/Votes/${new Date(r.startDate).getFullYear()}${r.rollCallNumber}`,
      } satisfies ActivityItem;
    }),
  );
  return items.filter((i): i is NonNullable<typeof i> => i !== null);
}
