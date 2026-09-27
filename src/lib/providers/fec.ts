import "server-only";

// api.open.fec.gov: campaign money for federal candidates. Takes any api.data.gov key, so the
// Congress.gov key works unless a separate FEC_API_KEY is set. 1,000 requests/hour per key,
// so everything here is cached: finished races for a week, the current cycle for 6 hours.
const BASE = "https://api.open.fec.gov/v1";
const WEEK = 7 * 86400;
const SIX_HOURS = 6 * 3600;

/** Cycles still collecting money get refreshed often; finished ones rarely change. */
const freshness = (year: number) => (year >= new Date().getFullYear() ? SIX_HOURS : WEEK);

async function fec<T>(path: string, params: Record<string, string | number | (string | number)[]>, revalidate: number): Promise<T> {
  const key = process.env.FEC_API_KEY ?? process.env.CONGRESS_API_KEY;
  if (!key) throw new Error("FEC_API_KEY or CONGRESS_API_KEY must be set in .env.local");
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) {
    for (const item of Array.isArray(v) ? v : [v]) url.searchParams.append(k, String(item));
  }
  url.searchParams.set("api_key", key);
  const res = await fetch(url, { next: { revalidate } });
  if (!res.ok) throw new Error(`FEC ${res.status} for ${path}`);
  return res.json() as Promise<T>;
}

type Page<T> = { results: T[]; pagination: { pages: number; last_indexes?: Record<string, string> | null } };

// ---- Candidates ------------------------------------------------------------

export interface FecCandidate {
  id: string;
  name: string;
  office: "H" | "S" | "P";
  state: string;
  district: number;
  electionYears: number[];
  activeThrough: number;
  inactive: boolean;
}

interface RawCandidate {
  candidate_id: string;
  name: string;
  office: "H" | "S" | "P";
  state: string;
  district: string;
  election_years: number[];
  active_through: number;
  candidate_inactive: boolean;
}

const toCandidate = (r: RawCandidate): FecCandidate => ({
  id: r.candidate_id,
  name: r.name,
  office: r.office,
  state: r.state,
  district: Number(r.district) || 0,
  electionYears: r.election_years ?? [],
  activeThrough: r.active_through,
  inactive: r.candidate_inactive,
});

/** Several candidates in one request. */
export async function getCandidates(ids: string[]): Promise<FecCandidate[]> {
  if (!ids.length) return [];
  const data = await fec<Page<RawCandidate>>("/candidates/", { candidate_id: ids, per_page: 100 }, 86400);
  return data.results.map(toCandidate);
}

// ---- Races (one per candidate per election) --------------------------------

export interface Contributions {
  /** From individuals, all sizes. */
  individuals: number;
  pacs: number;
  party: number;
  /** The candidate's own money (contributions, not loans). */
  self: number;
}

export interface FecRace {
  candidateId: string;
  /** The election year the FEC files this money under. */
  year: number;
  office: "H" | "S" | "P";
  state: string;
  /** District at the time of this race (lines move with redistricting). */
  district: number;
  raised: number;
  spent: number;
  cashOnHand: number;
  coverageStart?: string;
  coverageEnd?: string;
  contributions: Contributions;
}

interface RawTotals {
  candidate_election_year: number;
  receipts: number | null;
  disbursements: number | null;
  last_cash_on_hand_end_period: number | null;
  coverage_start_date: string | null;
  coverage_end_date: string | null;
  individual_itemized_contributions: number | null;
  individual_unitemized_contributions: number | null;
  other_political_committee_contributions: number | null;
  political_party_committee_contributions: number | null;
  candidate_contribution: number | null;
}

interface RawHistory {
  two_year_period: number;
  office: "H" | "S" | "P";
  state: string;
  district_number: number | null;
}

const n = (v: number | null | undefined) => v ?? 0;

/** Every election a candidate ID raised money for, newest first. */
export async function getRaces(candidateId: string): Promise<FecRace[]> {
  const [totals, history] = await Promise.all([
    fec<Page<RawTotals>>(
      `/candidate/${candidateId}/totals/`,
      { election_full: "true", per_page: 100, sort: "-cycle" },
      SIX_HOURS,
    ),
    fec<Page<RawHistory>>(`/candidate/${candidateId}/history/`, { per_page: 100 }, WEEK),
  ]);
  const byPeriod = new Map(history.results.map((h) => [h.two_year_period, h]));
  const latest = [...history.results].sort((a, b) => b.two_year_period - a.two_year_period)[0];
  return totals.results
    .map((t): FecRace => {
      // History stops at the current cycle; a Senate race years out keeps the latest seat.
      const h = byPeriod.get(t.candidate_election_year) ?? (t.candidate_election_year > (latest?.two_year_period ?? 0) ? latest : undefined);
      return {
        candidateId,
        year: t.candidate_election_year,
        office: h?.office ?? (candidateId[0] as "H" | "S" | "P"),
        state: h?.state ?? "",
        district: h?.district_number ?? 0,
        raised: n(t.receipts),
        spent: n(t.disbursements),
        cashOnHand: n(t.last_cash_on_hand_end_period),
        coverageStart: t.coverage_start_date?.slice(0, 10),
        coverageEnd: t.coverage_end_date?.slice(0, 10),
        contributions: {
          individuals: n(t.individual_itemized_contributions) + n(t.individual_unitemized_contributions),
          pacs: n(t.other_political_committee_contributions),
          party: n(t.political_party_committee_contributions),
          self: n(t.candidate_contribution),
        },
      };
    })
    .sort((a, b) => b.year - a.year);
}

// ---- Donation sizes --------------------------------------------------------

/** Individual money by donor size: ≤$200, $200–499, $500–999, $1,000–1,999, $2,000+. */
export async function getDonationSizes(candidateId: string, year: number): Promise<number[]> {
  const data = await fec<{ results: { size: number; total: number }[] }>(
    "/schedules/schedule_a/by_size/by_candidate/",
    { candidate_id: candidateId, cycle: year, election_full: "true", per_page: 20 },
    freshness(year),
  );
  const buckets = [0, 200, 500, 1000, 2000];
  return buckets.map((b) => data.results.filter((r) => r.size === b).reduce((s, r) => s + r.total, 0));
}

// ---- Outside money ---------------------------------------------------------

export interface Spender {
  name: string;
  committeeId: string;
  amount: number;
}

/** Independent expenditures for and against a candidate, as processed by the FEC. */
export async function getOutsideMoney(
  candidateId: string,
  year: number,
): Promise<{ support: Spender[]; oppose: Spender[] }> {
  const data = await fec<Page<{ committee_id: string; committee_name: string; support_oppose_indicator: "S" | "O"; total: number }>>(
    "/schedules/schedule_e/by_candidate/",
    { candidate_id: candidateId, cycle: year, election_full: "true", per_page: 100 },
    freshness(year),
  );
  const sum = (kind: "S" | "O") => {
    const by = new Map<string, Spender>();
    for (const r of data.results) {
      if (r.support_oppose_indicator !== kind || r.total <= 0) continue;
      const s = by.get(r.committee_id) ?? { name: r.committee_name, committeeId: r.committee_id, amount: 0 };
      s.amount += r.total;
      by.set(r.committee_id, s);
    }
    return [...by.values()].sort((a, b) => b.amount - a.amount);
  };
  return { support: sum("S"), oppose: sum("O") };
}

// ---- Opponents -------------------------------------------------------------

export interface RaceCandidate {
  candidateId: string;
  name: string;
  party?: string;
  raised: number;
}

/** Everyone who filed for the same seat in the same election, biggest fundraisers first. */
export async function getRaceField(race: FecRace): Promise<RaceCandidate[]> {
  // Without a state the FEC would return every race in the country.
  if (race.office !== "P" && !race.state) return [];
  const office = { H: "house", S: "senate", P: "president" }[race.office];
  const params: Record<string, string | number> = {
    office,
    cycle: race.year,
    election_full: "true",
    per_page: 30,
    sort: "-total_receipts",
  };
  if (race.office !== "P") params.state = race.state;
  if (race.office === "H") params.district = String(race.district).padStart(2, "0");
  const data = await fec<Page<{ candidate_id: string; candidate_name: string; party_full: string | null; total_receipts: number | null }>>(
    "/elections/",
    params,
    freshness(race.year),
  );
  return data.results.map((r) => ({
    candidateId: r.candidate_id,
    name: r.candidate_name,
    party: r.party_full ?? undefined,
    raised: n(r.total_receipts),
  }));
}

// ---- PAC money -------------------------------------------------------------

export type PacKind = "labor" | "corporate" | "trade" | "politician" | "other";

export interface PacGiver {
  committeeId: string;
  name: string;
  kind: PacKind;
  amount: number;
  /** Gave the $5,000 per-election limit for at least one election. */
  maxed: boolean;
}

export interface PacMoney {
  byKind: Record<PacKind, number>;
  givers: PacGiver[];
  /** Stopped paging early; totals cover only the largest part of the list. */
  truncated: boolean;
}

// FEC organization types of a PAC's sponsor (connected organization).
const ORG_KIND: Record<string, PacKind> = {
  L: "labor",
  C: "corporate",
  W: "corporate", // corporation without capital stock
  V: "corporate", // cooperative
  T: "trade",
  M: "trade", // membership organization
};

const MAX_PER_ELECTION = 5000;
const MAX_PAGES = 10;

interface RawReceipt {
  contributor_id: string | null;
  contributor_name: string;
  contribution_receipt_amount: number;
  memo_code: string | null;
  election_type: string | null;
  contributor: {
    committee_type: string | null;
    organization_type: string | null;
    designation: string | null;
    name: string | null;
  } | null;
}

/** Campaign committees a candidate raised money through. */
async function principalCommittees(candidateId: string) {
  const data = await fec<Page<{ committee_id: string; cycles: number[] }>>(
    `/candidate/${candidateId}/committees/`,
    { designation: ["P", "A"], per_page: 20 },
    WEEK,
  );
  return data.results;
}

/**
 * Contributions from PACs to a race's campaign committees, grouped by who sponsors each PAC.
 * Conduits like ActBlue pass along individuals' money; they file on another line and are left out.
 */
export async function getPacMoney(race: FecRace): Promise<PacMoney> {
  // House races are one two-year period; Senate and presidential ones span several. Start at
  // the race's own coverage, so a House member's old House money isn't counted for a Senate run.
  const firstYear = race.coverageStart ? Number(race.coverageStart.slice(0, 4)) : race.year - 1;
  const periods: number[] = [];
  for (let p = race.year; p > firstYear - 1 && p > race.year - 6; p -= 2) periods.push(p);
  if (race.office === "H") periods.splice(1);

  const committees = (await principalCommittees(race.candidateId)).filter((c) =>
    periods.some((p) => c.cycles.includes(p)),
  );

  const rows: RawReceipt[] = [];
  let truncated = false;
  for (const committee of committees) {
    for (const period of periods) {
      if (!committee.cycles.includes(period)) continue;
      let last: Record<string, string> | null | undefined;
      for (let page = 0; ; page++) {
        if (page === MAX_PAGES) {
          truncated = true;
          break;
        }
        const data = await fec<Page<RawReceipt>>(
          "/schedules/schedule_a/",
          {
            committee_id: committee.committee_id,
            two_year_transaction_period: period,
            // Form 3 line 11(c): contributions from PACs. Leaves out conduit memos like ActBlue's.
            line_number: "F3-11C",
            per_page: 100,
            sort: "-contribution_receipt_date",
            ...(last ?? {}),
          },
          freshness(period),
        );
        rows.push(...data.results);
        last = data.pagination.last_indexes;
        if (!last || data.results.length < 100) break;
      }
    }
  }

  const byGiver = new Map<string, PacGiver & { perElection: Map<string, number> }>();
  for (const r of rows) {
    const c = r.contributor;
    if (r.memo_code === "X") continue;
    const id = r.contributor_id ?? r.contributor_name;
    const kind: PacKind = c?.designation === "D" ? "politician" : ORG_KIND[c?.organization_type ?? ""] ?? "other";
    const g = byGiver.get(id) ?? {
      committeeId: id,
      name: c?.name ?? r.contributor_name,
      kind,
      amount: 0,
      maxed: false,
      perElection: new Map<string, number>(),
    };
    g.amount += r.contribution_receipt_amount;
    const election = r.election_type ?? "?";
    g.perElection.set(election, (g.perElection.get(election) ?? 0) + r.contribution_receipt_amount);
    byGiver.set(id, g);
  }

  const byKind: Record<PacKind, number> = { labor: 0, corporate: 0, trade: 0, politician: 0, other: 0 };
  const givers: PacGiver[] = [];
  for (const { perElection, ...g } of byGiver.values()) {
    if (g.amount <= 0) continue; // fully refunded
    g.maxed = [...perElection.values()].some((v) => v >= MAX_PER_ELECTION);
    byKind[g.kind] += g.amount;
    givers.push(g);
  }
  givers.sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));
  return { byKind, givers, truncated };
}
