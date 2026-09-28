import "server-only";

// api.ocpf.us: the public JSON API behind ocpf.us, the Massachusetts Office of Campaign and
// Political Finance. No key, no login. Everything is cached: the current year for 6 hours,
// finished years for a week. Only totals and organizations' gifts are read into the app;
// individual donors are only ever counted, never named.
const API = "https://api.ocpf.us";
const WEEK = 7 * 86400;
const SIX_HOURS = 6 * 3600;

const freshness = (year: number) => (year >= new Date().getFullYear() ? SIX_HOURS : WEEK);

async function ocpf<T>(path: string, params: Record<string, string | number>, revalidate: number): Promise<T> {
  const url = new URL(API + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const res = await fetch(url, { next: { revalidate } });
  if (!res.ok) throw new Error(`OCPF ${res.status} for ${path}`);
  return res.json() as Promise<T>;
}

/** "$1,234.56" → 1234.56 */
const dollars = (s: string | number | null | undefined) =>
  typeof s === "number" ? s : Number(String(s ?? "").replace(/[$,]/g, "")) || 0;

/** OCPF's "8/31/2026" → "2026-08-31". */
export function isoDate(mdy: string): string | undefined {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(mdy);
  return m ? `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}` : undefined;
}

// ---- Filers ------------------------------------------------------------------

export interface OcpfFiler {
  cpfId: number;
  name: string;
  committeeName: string;
  /** "House" | "Senate" | "Statewide" | …, from OCPF's "office held". */
  office: string;
  district: string;
}

interface RawListing {
  cpfId: number;
  filerName: string;
  lastName: string;
  committeeName: string;
  officeHeld: string;
  isCandidate: boolean;
}

/** Lowercase ASCII letters only: "Gómez" → "gomez", "Lipper-Garabedian" → "lippergarabedian". */
export const foldName = (s: string) =>
  s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");

const ORDINALS: Record<string, string> = {
  first: "1st", second: "2nd", third: "3rd", fourth: "4th", fifth: "5th", sixth: "6th",
  seventh: "7th", eighth: "8th", ninth: "9th", tenth: "10th", eleventh: "11th", twelfth: "12th",
  thirteenth: "13th", fourteenth: "14th", fifteenth: "15th", sixteenth: "16th",
  seventeenth: "17th", eighteenth: "18th", nineteenth: "19th",
};

/** Open States says "Second Plymouth and Norfolk", OCPF "2nd Plymouth & Norfolk". */
export function seatKey(district: string) {
  return district
    .toLowerCase()
    .replace(/&/g, " and ")
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !["and", "of", "the", "district"].includes(w))
    .map((w) => ORDINALS[w] ?? w)
    .join(" ");
}

/**
 * The candidate committee whose candidate holds this seat and has this last name. OCPF's
 * search doesn't fold accents, so the name is searched in plain ASCII. Returns null unless
 * exactly one filer matches.
 */
export async function findFiler(lastName: string, office: string, district: string): Promise<OcpfFiler | null> {
  const phrase = lastName.normalize("NFKD").replace(/[̀-ͯ]/g, "");
  const list = await ocpf<RawListing[]>("/filers/listings/A", { searchPhrase: phrase }, 86400);
  const want = seatKey(district);
  const matches = list.filter((f) => {
    const comma = f.officeHeld.indexOf(", ");
    const heldOffice = comma < 0 ? f.officeHeld : f.officeHeld.slice(0, comma);
    const heldDistrict = comma < 0 ? "" : f.officeHeld.slice(comma + 2);
    return (
      f.isCandidate &&
      foldName(f.lastName) === foldName(lastName) &&
      heldOffice === office &&
      seatKey(heldDistrict) === want
    );
  });
  if (matches.length !== 1) return null;
  const f = matches[0];
  return { cpfId: f.cpfId, name: f.filerName, committeeName: f.committeeName, office, district };
}

export const filerUrl = (cpfId: number) => `https://www.ocpf.us/Filers?q=${cpfId}`;

// ---- Year-to-date totals -------------------------------------------------------

export interface YearTotals {
  year: number;
  /** Deposits, after card processing fees: OCPF's "receipts". */
  raised: number;
  spent: number;
  /** At the end of the latest bank report that year. */
  cashOnHand: number;
  /** End date of that bank report, ISO. */
  through?: string;
}

interface RawYtd {
  cpfId: number;
  receiptsYtdNumeric: number;
  expendituresYtdNumeric: number;
  currentCashOnHandNumeric: number;
  bankReportEndDate: string;
}

// OCPF publishes one year-to-date list per kind of office; a filer appears under the office
// they were seeking that year (a legislator running for district attorney moves to "county").
const YTD_LISTS = [
  "/reports/legislative/depository/ytd",
  "/reports/statewide/ytd",
  "/reports/county/ytd",
];

async function ytdList(path: string, year: number): Promise<RawYtd[]> {
  const data = await ocpf<{ reports: RawYtd[] } | RawYtd[]>(
    `${path}/${year}`,
    { onBallot: "false", PageSize: 1000 },
    freshness(year),
  );
  return Array.isArray(data) ? data : data.reports ?? [];
}

/** Money in and out for each year, from OCPF's year-to-date bank totals. */
export async function getYearTotals(cpfId: number, years: number[]): Promise<YearTotals[]> {
  const out: YearTotals[] = [];
  for (const year of years) {
    const lists = await Promise.all(YTD_LISTS.map((p) => ytdList(p, year).catch(() => [] as RawYtd[])));
    const row = lists.flat().find((r) => r.cpfId === cpfId);
    if (!row) continue;
    out.push({
      year,
      raised: row.receiptsYtdNumeric ?? 0,
      spent: row.expendituresYtdNumeric ?? 0,
      cashOnHand: row.currentCashOnHandNumeric ?? 0,
      through: isoDate(row.bankReportEndDate),
    });
  }
  return out;
}

// ---- Contributions ---------------------------------------------------------------

/** OCPF record types for money coming in. */
export const RECORD = {
  individual: 201,
  committee: 202,
  union: 203,
  unitemized: 220,
  /** Committees registered as PACs (or people's committees); a subset of `committee`. */
  pac: 299,
} as const;

interface RawItem {
  id: number;
  recordTypeId: number;
  fullNameReverse: string;
  contributorCpfId: number;
  date: string;
  amount: string;
}

interface RawSearch {
  summary: { count: number; total: number };
  items: RawItem[];
}

interface Search {
  recordTypeId: number;
  /** ISO dates, inclusive. */
  from: string;
  to: string;
  min?: number;
  max?: number;
}

const mdy = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${Number(m)}/${Number(d)}/${y}`;
};

function searchParams(cpfId: number, s: Search, pagesize: number, startIndex: number) {
  return {
    searchTypeCategory: "A",
    cpfId,
    recordTypeId: s.recordTypeId,
    startDate: mdy(s.from),
    endDate: mdy(s.to),
    minAmount: s.min ?? "",
    maxAmount: s.max ?? "",
    pagesize,
    startIndex,
    sortField: "",
    sortDirection: "DESC",
    name: "",
    cityCode: "-1",
    state: "",
    zipCode: "",
    occupation: "",
    employer: "",
    description: "",
    withSummary: "true",
  };
}

/**
 * Count and dollar total of matching receipts, plus the newest one's date (results come newest
 * first). Nothing else about the receipt is kept.
 */
export async function sumReceipts(
  cpfId: number,
  s: Search,
): Promise<{ count: number; total: number; latest?: string }> {
  const data = await ocpf<RawSearch>(
    "/search/items",
    searchParams(cpfId, s, 1, 1),
    freshness(Number(s.to.slice(0, 4))),
  );
  const first = data.items?.[0]?.date;
  return { count: data.summary?.count ?? 0, total: data.summary?.total ?? 0, latest: first ? isoDate(first) : undefined };
}

export interface OrgReceipt {
  id: number;
  name: string;
  contributorCpfId?: number;
  amount: number;
  date?: string;
}

const PAGE = 500;
const MAX_PAGES = 4;

/**
 * Receipts of one type in full. Only for organization record types (committees, unions):
 * never call this for individuals.
 */
export async function orgReceipts(
  cpfId: number,
  s: Search & { recordTypeId: typeof RECORD.committee | typeof RECORD.union | typeof RECORD.pac },
): Promise<{ items: OrgReceipt[]; truncated: boolean }> {
  const items: OrgReceipt[] = [];
  let count = 0;
  for (let page = 0; page < MAX_PAGES; page++) {
    const data = await ocpf<RawSearch>(
      "/search/items",
      searchParams(cpfId, s, PAGE, page * PAGE + 1),
      freshness(Number(s.to.slice(0, 4))),
    );
    count = data.summary?.count ?? 0;
    for (const r of data.items ?? []) {
      items.push({
        id: r.id,
        name: r.fullNameReverse.trim(),
        contributorCpfId: r.contributorCpfId > 0 ? r.contributorCpfId : undefined,
        amount: dollars(r.amount),
        date: isoDate(r.date),
      });
    }
    if (items.length >= count || !data.items?.length) break;
  }
  return { items, truncated: items.length < count };
}
