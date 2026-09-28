import "server-only";
import { unstable_cache } from "next/cache";
import type { StatePerson } from "./openstates";
import type { ActivityItem, OfficialBio } from "@/lib/types";

// The official Massachusetts Legislature site (malegislature.gov): member roster, biography
// and committee pages, and its public API (https://malegislature.gov/api/swagger) for
// bills, committees, and leadership. Everything stays as published (English).

/** The 194th General Court sits 2025–2026; the 195th begins in January 2027. */
export const GENERAL_COURT = 194;

const SITE = "https://malegislature.gov";
const API = `${SITE}/api/GeneralCourts/${GENERAL_COURT}`;
const DAY = 86400;

// ---------------------------------------------------------------------------------------------
// HTML helpers

const NAMED: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“",
  ndash: "–", mdash: "—", hellip: "…", bull: "•",
};

function decode(s: string) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return NAMED[e.toLowerCase()] ?? m;
  });
}

/** Tags out, entities decoded, whitespace collapsed. */
const textOf = (html: string) => decode(html.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();

async function page(path: string) {
  const res = await fetch(`${SITE}${path}`, { next: { revalidate: DAY } });
  if (!res.ok) throw new Error(`malegislature.gov ${res.status} for ${path}`);
  return res.text();
}

// ---------------------------------------------------------------------------------------------
// Roster and matching

interface RosterMember {
  code: string;
  branch: "Senate" | "House";
  first: string;
  last: string;
  district: string;
}

/** Current members from the official House and Senate member lists (vacant seats skipped). */
async function getRoster(): Promise<RosterMember[]> {
  const branches = ["Senate", "House"] as const;
  const pages = await Promise.all(branches.map((b) => page(`/Legislators/Members/${b}`)));
  return pages.flatMap((html, i) => {
    const body = html.slice(html.indexOf("<tbody"), html.indexOf("</tbody>"));
    return body
      .split("<tr")
      .slice(1)
      .flatMap((row) => {
        if (row.includes("vacantStarPlaceholder")) return [];
        const code = /href="\/Legislators\/Profile\/([^"/.]+)"/.exec(row)?.[1];
        const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => textOf(m[1]));
        // Columns: follow, photo, first name, last name, district, party, room, phone, email.
        if (!code || cells.length < 5) return [];
        return [{
          code: decodeURIComponent(code),
          branch: branches[i],
          first: cells[2],
          last: cells[3],
          district: cells[4],
        }];
      });
  });
}

const ORDINALS: Record<string, number> = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5,
  sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
};

const fold = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * "Third Middlesex", "3rd Middlesex", and "Norfolk, Plymouth and Bristol" → comparable keys.
 * (The official list spells Senate ordinals out; the API and Open States use "3rd".)
 */
function maDistrictKey(name: string) {
  return fold(name)
    .replace(new RegExp(`\\b(${Object.keys(ORDINALS).join("|")})\\b`, "g"), (w) => String(ORDINALS[w]))
    .replace(/\b(\d+)(st|nd|rd|th)\b/g, "$1")
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !["state", "house", "senate", "district", "and", "of"].includes(w))
    .join("");
}

const letters = (s: string) => fold(s).replace(/[^a-z]/g, "");

/**
 * The MemberCode for an Open States legislator: same branch, same district, and the official
 * last name appears in their name. Anything else is logged and left unmatched.
 */
export async function findMemberCode(person: StatePerson): Promise<string | undefined> {
  if (person.state !== "MA" || (person.kind !== "upper" && person.kind !== "lower")) return undefined;
  const branch = person.kind === "upper" ? "Senate" : "House";
  const key = maDistrictKey(person.role);
  const seat = (await getRoster()).filter((m) => m.branch === branch && maDistrictKey(m.district) === key);
  const match = seat.filter((m) => letters(person.name).includes(letters(m.last)));
  if (match.length === 1) return match[0].code;
  console.warn(
    `[malegislature] no member matched ${person.name} (${branch}, ${person.role}); seat lists: ` +
      (seat.map((m) => `${m.first} ${m.last} ${m.code}`).join(", ") || "nobody"),
  );
  return undefined;
}

// ---------------------------------------------------------------------------------------------
// API member record

interface ApiSponsor {
  Id: string;
  Name: string;
  ResponseDate?: string;
}

interface ApiBill {
  BillNumber: string | null;
  DocketNumber: string | null;
  Title: string;
  PrimarySponsor: ApiSponsor | null;
  Cosponsors: ApiSponsor[] | null;
}

interface ApiMember {
  Name: string;
  Branch: string;
  District: string;
  Party: string;
  EmailAddress: string | null;
  PhoneNumber: string | null;
  RoomNumber: string | null;
  LeadershipPosition: string | null;
  SponsoredBills: ApiBill[] | null;
  CoSponsoredBills: ApiBill[] | null;
  Committees: { CommitteeCode: string }[] | null;
}

export interface MaBill {
  /** "S992", or the docket number ("SD3404") before a bill number is assigned. */
  number: string;
  title: string;
  /** When they filed it (sponsor) or signed on (cosponsor), from the API's response date. */
  date: string;
}

export interface MaMember {
  code: string;
  name: string;
  branch: string;
  district: string;
  email?: string;
  phone?: string;
  room?: string;
  leadership?: string;
  committeeCodes: string[];
  sponsoredCount: number;
  /** Most recent first, capped. */
  sponsored: MaBill[];
  cosponsored: MaBill[];
}

const KEEP_BILLS = 25;

const billNumber = (b: ApiBill) => b.BillNumber ?? b.DocketNumber ?? "";
const newestFirst = (a: MaBill, b: MaBill) => b.date.localeCompare(a.date);

// A member record is 1–2 MB (every bill with every cosponsor), too big for the fetch cache,
// so only the slim result is cached.
const loadMember = unstable_cache(
  async (code: string): Promise<MaMember | null> => {
    const res = await fetch(`${API}/LegislativeMembers/${encodeURIComponent(code)}`, { cache: "no-store" });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`malegislature.gov API ${res.status} for member ${code}`);
    const m: ApiMember = await res.json();

    const sponsoredAll = (m.SponsoredBills ?? []).filter((b) => b.PrimarySponsor?.Id === code);
    const sponsored = sponsoredAll
      .map((b) => ({ number: billNumber(b), title: b.Title, date: b.PrimarySponsor?.ResponseDate?.slice(0, 10) ?? "" }))
      .filter((b) => b.number && b.date)
      .sort(newestFirst)
      .slice(0, KEEP_BILLS);

    // The API's co-sponsored list includes bills the member isn't on (checked against the
    // bill records), so keep only bills that list them as a cosponsor, and not their own.
    const cosponsored = (m.CoSponsoredBills ?? [])
      .flatMap((b) => {
        const me = b.Cosponsors?.find((c) => c.Id === code);
        if (!me?.ResponseDate || b.PrimarySponsor?.Id === code) return [];
        return [{ number: billNumber(b), title: b.Title, date: me.ResponseDate.slice(0, 10) }];
      })
      .filter((b) => b.number)
      .sort(newestFirst)
      .slice(0, KEEP_BILLS);

    return {
      code,
      name: m.Name,
      branch: m.Branch,
      district: m.District,
      email: m.EmailAddress || undefined,
      phone: m.PhoneNumber || undefined,
      room: m.RoomNumber || undefined,
      leadership: m.LeadershipPosition || undefined,
      committeeCodes: (m.Committees ?? []).map((c) => c.CommitteeCode),
      sponsoredCount: sponsoredAll.length,
      sponsored,
      cosponsored,
    };
  },
  ["malegislature-member", String(GENERAL_COURT)],
  { revalidate: DAY },
);

/** The member's API record, checked against the Open States person's branch and district. */
export async function getMaMember(code: string, person: StatePerson): Promise<MaMember | null> {
  const m = await loadMember(code);
  if (!m) return null;
  const branch = person.kind === "upper" ? "Senate" : "House";
  if (m.branch !== branch || maDistrictKey(m.district) !== maDistrictKey(person.role)) {
    console.warn(`[malegislature] ${code} is ${m.branch} ${m.district}, not ${branch} ${person.role}; skipped`);
    return null;
  }
  return m;
}

// ---------------------------------------------------------------------------------------------
// Activity

const billUrl = (number: string) => `${SITE}/Bills/${GENERAL_COURT}/${number}`;
/** "S992" → "S.992"; docket numbers stay as they are. */
const billLabel = (number: string) => number.replace(/^([HS])(\d+)$/, "$1.$2");

interface HistoryAction {
  Date: string;
  Action: string;
  IsStricken: boolean;
}

/** The latest action on a bill, from its official history. */
async function latestAction(number: string): Promise<string | undefined> {
  const res = await fetch(`${API}/Documents/${number}/DocumentHistoryActions`, { next: { revalidate: DAY } });
  if (!res.ok) return undefined;
  const actions: HistoryAction[] = await res.json();
  const last = actions.filter((a) => !a.IsStricken).at(-1);
  return last ? last.Action.replace(/\s+/g, " ").trim() : undefined;
}

/**
 * Bills they filed (with each one's latest action) and bills they signed on to, newest first.
 * Dated by filing / signing, like Congress.gov's introduced date.
 */
export async function getMaActivity(m: MaMember, limit = 10): Promise<ActivityItem[]> {
  const sponsored = m.sponsored.slice(0, limit);
  const latest = await Promise.all(sponsored.map((b) => latestAction(b.number).catch(() => undefined)));
  return [
    ...sponsored.map((b, i): ActivityItem => ({
      kind: "bill",
      date: b.date,
      title: b.title,
      badge: billLabel(b.number),
      detail: latest[i] ? `Latest: ${latest[i]}` : undefined,
      url: billUrl(b.number),
    })),
    ...m.cosponsored.slice(0, limit).map((b): ActivityItem => ({
      kind: "cosponsor",
      date: b.date,
      title: b.title,
      badge: billLabel(b.number),
      url: billUrl(b.number),
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));
}

// ---------------------------------------------------------------------------------------------
// Card back

/**
 * The prose "Biography" on the member's profile page, verbatim (paragraphs kept). Pages that
 * only have the structured "Personal Information" fields give undefined.
 */
async function getBiography(code: string): Promise<string | undefined> {
  const html = await page(`/Legislators/Profile/${encodeURIComponent(code)}/Biography`);
  const panel = html.indexOf('id="Biography-tabpanel"');
  if (panel === -1) return undefined;
  const start = html.indexOf('<div class="col-xs-12">', panel);
  const sidebar = html.indexOf('<div class="col-xs-12 col-md-4"', panel);
  if (start === -1 || sidebar === -1) return undefined;
  let prose = html.slice(start, sidebar);
  // The structured fields (Personal Information, Education & Public Service) follow the prose.
  const structured = prose.search(/<h3[\s>]/);
  if (structured !== -1) prose = prose.slice(0, structured);
  const paragraphs = prose
    .split(/<\/p>|<br\s*\/?>|<\/li>|<\/h\d>/i)
    .map(textOf)
    .filter(Boolean);
  return paragraphs.length ? paragraphs.join("\n\n") : undefined;
}

interface CommitteeSeat {
  code: string;
  name: string;
  role?: string;
}

/** Committee names and roles ("Chairperson", "Vice Chair") from the member's Committees page. */
async function getCommitteePage(code: string): Promise<CommitteeSeat[]> {
  const html = await page(`/Legislators/Profile/${encodeURIComponent(code)}/Committees`);
  const list = html.slice(html.indexOf('class="membershipList"'), html.indexOf("</ul>", html.indexOf('class="membershipList"')));
  return [...list.matchAll(/<li>([\s\S]*?)<\/li>/g)].flatMap(([, li]) => {
    const link = /<a href="\/Committees\/Detail\/([^"]+)">([\s\S]*?)<\/a>/.exec(li);
    if (!link) return [];
    const role = /<span>([\s\S]*?)<\/span>/.exec(li);
    return [{
      code: link[1],
      name: textOf(link[2]),
      ...(role ? { role: textOf(role[1]).replace(/,$/, "") } : {}),
    }];
  });
}

// A committee record lists every bill before it (hundreds of KB), so cache only the name.
const committeeName = unstable_cache(
  async (code: string): Promise<string | undefined> => {
    const res = await fetch(`${API}/Committees/${encodeURIComponent(code)}`, { cache: "no-store" });
    if (!res.ok) return undefined;
    const c: { FullName?: string } = await res.json();
    return c.FullName || undefined;
  },
  ["malegislature-committee", String(GENERAL_COURT)],
  { revalidate: DAY },
);

/**
 * Committees from the API's member record, named (with roles) from the member's official
 * Committees page; any the page doesn't list are named from the API's committee record.
 */
async function getCommittees(m: MaMember): Promise<{ name: string; role?: string }[]> {
  const fromPage = await getCommitteePage(m.code).catch(() => [] as CommitteeSeat[]);
  const order = new Map(fromPage.map((s, i) => [s.code, i]));
  const codes = [...m.committeeCodes].sort(
    (a, b) => (order.get(a) ?? Infinity) - (order.get(b) ?? Infinity),
  );
  const seats = await Promise.all(
    codes.map(async (code) => {
      const seat = fromPage.find((s) => s.code === code);
      if (seat) return { name: seat.name, ...(seat.role ? { role: seat.role } : {}) };
      const name = await committeeName(code).catch(() => undefined);
      return name ? { name } : undefined;
    }),
  );
  // In the official page's order (roles first); any it doesn't list come last.
  return seats.filter((s) => s !== undefined);
}

/** The card back: official biography, leadership post, and committees. */
export async function getMaBio(m: MaMember): Promise<OfficialBio | undefined> {
  const [summary, committees] = await Promise.all([
    getBiography(m.code).catch(() => undefined),
    getCommittees(m).catch(() => []),
  ]);
  if (!summary && !committees.length && !m.leadership) return undefined;
  const profile = `${SITE}/Legislators/Profile/${encodeURIComponent(m.code)}`;
  return {
    ...(summary ? { summary } : {}),
    ...(m.leadership ? { leadership: m.leadership } : {}),
    education: [],
    career: [],
    military: [],
    ...(committees.length ? { committees } : {}),
    sources: [
      ...(summary ? [{ title: "MA Legislature: Biography", url: `${profile}/Biography` }] : []),
      ...(committees.length ? [{ title: "MA Legislature: Committees", url: `${profile}/Committees` }] : []),
      ...(m.leadership || committees.length
        ? [{ title: "MA Legislature API", url: `${API}/LegislativeMembers/${encodeURIComponent(m.code)}` }]
        : []),
    ],
  };
}

/**
 * Everything the profile uses for a Massachusetts legislator, or null when they can't be
 * matched to the official roster (the caller then falls back to Open States).
 */
export async function getMaLegislatorProfile(person: StatePerson) {
  const code = await findMemberCode(person).catch((e) => {
    console.warn(`[malegislature] roster unavailable: ${e}`);
    return undefined;
  });
  const member = code ? await getMaMember(code, person).catch(() => null) : null;
  if (!member) return null;
  const [activity, bio] = await Promise.all([
    getMaActivity(member).catch(() => [] as ActivityItem[]),
    getMaBio(member),
  ]);
  return { member, activity, bio };
}
