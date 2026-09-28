import "server-only";
import { electionDay } from "./electionDates";
import { findStatePerson, type StatePerson } from "./providers/openstates";
import {
  filerUrl,
  findFiler,
  foldName,
  getYearTotals,
  type OcpfFiler,
  orgReceipts,
  RECORD,
  sumReceipts,
  type YearTotals,
} from "./providers/ocpf";

// Massachusetts state campaign money, from OCPF. Federal money (FEC) lives in campaigns.ts;
// the two don't share definitions because the laws differ.

/** OCPF's name for each statewide office Open States lists. */
const STATEWIDE: Record<string, string> = {
  Governor: "Governor",
  "Lieutenant Governor": "Lieutenant Governor",
  "Attorney General": "Attorney General",
  "Secretary of the Commonwealth": "Secretary of State",
  Treasurer: "Treasurer of the Commonwealth",
  Auditor: "Auditor",
};

/**
 * Individual gift sizes, per contribution. $50 is where Massachusetts requires a donor's
 * name (M.G.L. c. 55 §§ 18, 19); $1,000 is the most one person may give a candidate in a
 * calendar year (§ 7A).
 */
export const SIZE_BANDS = [
  { key: "upTo50", min: 0.01, max: 50 },
  { key: "from51", min: 50.01, max: 199.99 },
  { key: "from200", min: 200, max: 499.99 },
  { key: "from500", min: 500, max: 999.99 },
  { key: "from1000", min: 1000 },
] as const;

export type SizeBand = (typeof SIZE_BANDS)[number]["key"];

export type BackerKind = "pac" | "union" | "committee";

export interface Backer {
  name: string;
  kind: BackerKind;
  amount: number;
  gifts: number;
  url?: string;
}

export interface StateContributions {
  /** Individuals' gifts by size; `upTo50` includes the unitemized total. */
  sizes: Record<SizeBand, number>;
  pacs: number;
  unions: number;
  /** Other political committees: parties, candidates' committees, and the like. */
  committees: number;
  /** Latest gift date in the period, ISO. */
  through?: string;
}

export interface StateMoney {
  filer: OcpfFiler & { url: string };
  cycle: { start: number; end: number; electionDate: string; statewide: boolean };
  years: YearTotals[];
  contributions: StateContributions;
  backers: Backer[];
  /** More organization gifts than we load; backers leave out the oldest. */
  truncated: boolean;
}

const SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv"]);

function lastName(fullName: string) {
  const words = fullName.replace(/,/g, " ").split(/\s+/).filter((w) => foldName(w) && !SUFFIXES.has(foldName(w)));
  return words[words.length - 1] ?? "";
}

/** The OCPF seat for an Open States person, or null outside Massachusetts. */
function ocpfSeat(p: StatePerson): { office: string; district: string } | null {
  if (p.state !== "MA") return null;
  if (p.kind === "executive") return STATEWIDE[p.role] ? { office: "Statewide", district: STATEWIDE[p.role] } : null;
  if (p.kind === "upper") return { office: "Senate", district: p.role };
  if (p.kind === "lower") return { office: "House", district: p.role };
  return null;
}

/**
 * The election cycle holding `year`: two years ending in the even-year state election for the
 * Legislature; four years ending in the governor's election (2026, 2030…) for statewide offices.
 */
export function cycleFor(year: number, statewide: boolean) {
  const end = statewide ? year + ((2 - (year % 4) + 4) % 4) : year + (year % 2);
  return { start: end - (statewide ? 3 : 1), end };
}

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

async function contributions(cpfId: number, from: string, to: string): Promise<StateContributions> {
  const span = { from, to };
  const [bands, unitemized, pacs, committees, unions] = await Promise.all([
    Promise.all(
      SIZE_BANDS.map((b) =>
        sumReceipts(cpfId, { ...span, recordTypeId: RECORD.individual, min: b.min, max: "max" in b ? b.max : undefined }),
      ),
    ),
    sumReceipts(cpfId, { ...span, recordTypeId: RECORD.unitemized }),
    sumReceipts(cpfId, { ...span, recordTypeId: RECORD.pac }),
    sumReceipts(cpfId, { ...span, recordTypeId: RECORD.committee }),
    sumReceipts(cpfId, { ...span, recordTypeId: RECORD.union }),
  ]);
  const sizes = Object.fromEntries(SIZE_BANDS.map((b, i) => [b.key, bands[i].total])) as Record<SizeBand, number>;
  sizes.upTo50 += unitemized.total;
  const dates = [...bands, unitemized, pacs, committees, unions]
    .map((r) => r.latest)
    .filter((d): d is string => !!d)
    .sort();
  return {
    sizes,
    through: dates.at(-1),
    pacs: pacs.total,
    unions: unions.total,
    // PACs are filed as committee gifts too; count them once.
    committees: Math.max(0, committees.total - pacs.total),
  };
}

const TOP_BACKERS = 8;

/** Organizations that gave the most in the period, merged by name. Individuals never appear. */
async function backers(cpfId: number, from: string, to: string) {
  const span = { from, to };
  const [committees, unions, pacs] = await Promise.all([
    orgReceipts(cpfId, { ...span, recordTypeId: RECORD.committee }),
    orgReceipts(cpfId, { ...span, recordTypeId: RECORD.union }),
    orgReceipts(cpfId, { ...span, recordTypeId: RECORD.pac }),
  ]);
  const pacIds = new Set(pacs.items.map((i) => i.id));
  const byName = new Map<string, Backer>();
  // Some filers enter refunds (a security deposit, say) as committee gifts. They aren't
  // contributions: leave them out of the backers and out of the bar.
  const refunds: Record<BackerKind, number> = { pac: 0, union: 0, committee: 0 };
  const add = (kind: BackerKind, i: (typeof committees.items)[number]) => {
    const key = foldName(i.name);
    if (!key) return;
    if (REFUND.test(i.name)) {
      refunds[kind] += i.amount;
      return;
    }
    const b = byName.get(key) ?? { name: i.name, kind, amount: 0, gifts: 0 };
    b.amount += i.amount;
    b.gifts += 1;
    if (kind === "pac") b.kind = "pac";
    if (i.contributorCpfId && !b.url) b.url = filerUrl(i.contributorCpfId);
    byName.set(key, b);
  };
  for (const i of committees.items) add(pacIds.has(i.id) ? "pac" : "committee", i);
  for (const i of unions.items) add("union", i);
  const list = [...byName.values()].filter((b) => b.amount > 0).sort((a, b) => b.amount - a.amount);
  return {
    top: list.slice(0, TOP_BACKERS),
    truncated: committees.truncated || unions.truncated,
    refunds,
  };
}

const REFUND = /\brefund/i;

/**
 * Campaign money for a Massachusetts state official. `null` when they aren't a Massachusetts
 * official or no single OCPF committee matches (logged, never guessed).
 */
export async function getStateMoney(officialId: string, now = new Date()): Promise<StateMoney | null> {
  const m = /^os-ma-([0-9a-f-]{36})$/.exec(officialId);
  if (!m) return null;
  const person = await findStatePerson("MA", `ocd-person/${m[1]}`);
  const seat = person && ocpfSeat(person);
  if (!person || !seat) return null;

  const filer = await findFiler(lastName(person.name), seat.office, seat.district);
  if (!filer) {
    console.warn(`[ocpf] no single committee for ${person.name} (${seat.office}, ${seat.district})`);
    return null;
  }

  const statewide = seat.office === "Statewide";
  let cycle = cycleFor(now.getFullYear(), statewide);
  const span = (c: typeof cycle) => ({ from: `${c.start}-01-01`, to: `${c.end}-12-31` });
  let money = await contributions(filer.cpfId, span(cycle).from, span(cycle).to);
  // Early in a new cycle there may be nothing yet: show the one just finished.
  if (totalOf(money) <= 0) {
    cycle = cycleFor(cycle.start - 1, statewide);
    money = await contributions(filer.cpfId, span(cycle).from, span(cycle).to);
  }
  const [years, top] = await Promise.all([
    getYearTotals(filer.cpfId, range(cycle.start, cycle.end)),
    backers(filer.cpfId, span(cycle).from, span(cycle).to),
  ]);
  return {
    filer: { ...filer, url: filerUrl(filer.cpfId) },
    cycle: { ...cycle, electionDate: electionDay(cycle.end), statewide },
    years,
    contributions: {
      ...money,
      pacs: Math.max(0, money.pacs - top.refunds.pac),
      unions: Math.max(0, money.unions - top.refunds.union),
      committees: Math.max(0, money.committees - top.refunds.committee),
    },
    backers: top.top,
    truncated: top.truncated,
  };
}

export function totalOf(c: StateContributions) {
  return Object.values(c.sizes).reduce((a, b) => a + b, 0) + c.pacs + c.unions + c.committees;
}

/** Grassroots: gifts of $50 or less. Big money: gifts of $500+ plus PACs and unions. */
export function stateShares(c: StateContributions) {
  const total = totalOf(c);
  if (total <= 0) return { total, grassroots: 0, big: 0 };
  return {
    total,
    grassroots: c.sizes.upTo50 / total,
    big: (c.sizes.from500 + c.sizes.from1000 + c.pacs + c.unions) / total,
  };
}
