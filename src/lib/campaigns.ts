import "server-only";
import {
  type FecCandidate,
  type FecRace,
  getCandidates,
  getDonationSizes,
  getOutsideMoney,
  getPacMoney,
  getRaceField,
  getRaces,
  type PacMoney,
  type RaceCandidate,
  type Spender,
} from "./providers/fec";
import { getLegislatorIndex, type LegislatorInfo } from "./providers/legislators";
import { findResults, type OfficialResult, resultLink, sameCandidate } from "./providers/results";
import { daysUntil, electionDay, isAhead } from "./electionDates";
import type { ElectionBadge } from "./types";

// ---- Campaigns -------------------------------------------------------------

export type Outcome = "won" | "lost" | "lostPrimary" | "upcoming" | "unknown";

export interface StageResult {
  id: number;
  url?: string;
  year: number;
  /** The state's label, an official record kept in English. */
  stage: string;
  primary: boolean;
  special: boolean;
  candidates: { name: string; party?: string; votes: number; pct: number; me: boolean }[];
  won: boolean;
}

export interface Campaign {
  key: string;
  race: FecRace;
  /** The year votes were cast; differs from the FEC year for odd-year specials. */
  year: number;
  seat: { office: "house" | "senate"; state: string; district?: number };
  stages: StageResult[];
  outcome: Outcome;
  /** Election Day, when the general is still ahead. */
  electionDate?: string;
}

export interface CampaignList {
  bioguideId: string;
  name: string;
  campaigns: Campaign[];
  /** The race to feature: the upcoming one, else the latest. */
  current?: Campaign;
}

function toStage(r: OfficialResult, state: string, fecName: string): StageResult {
  const top = Math.max(...r.candidates.map((c) => c.votes));
  const candidates = r.candidates.map((c) => ({ ...c, me: sameCandidate(fecName, c.name) }));
  return {
    id: r.id,
    url: resultLink(state, r.id),
    year: r.year,
    stage: r.stage,
    primary: /primary/i.test(r.stage),
    special: /special/i.test(r.stage),
    candidates,
    won: candidates.some((c) => c.me && c.votes === top),
  };
}

function outcomeOf(stages: StageResult[], race: FecRace, now: Date): Pick<Campaign, "outcome" | "electionDate"> {
  const generals = stages.filter((s) => !s.primary);
  if (generals.length) return { outcome: generals[generals.length - 1].won ? "won" : "lost" };
  if (stages.some((s) => s.primary && !s.won)) return { outcome: "lostPrimary" };
  const date = electionDay(race.year);
  if (race.office !== "P" && isAhead(date, now)) return { outcome: "upcoming", electionDate: date };
  return { outcome: "unknown" };
}

function buildCampaign(race: FecRace, fecName: string, now: Date): Campaign | null {
  if (race.office === "P") return null; // Presidential money runs through other committees; not shown yet.
  const office = race.office === "H" ? "house" : "senate";
  const from = office === "house"
    ? race.year - 1
    : race.coverageStart ? Math.min(Number(race.coverageStart.slice(0, 4)), race.year - 1) : race.year - 5;
  const stages = findResults(race.state, office, race.district, from, race.year)
    .map((r) => toStage(r, race.state, fecName))
    .filter((s) => s.candidates.some((c) => c.me));
  const c = race.contributions;
  if (!stages.length && c.individuals + c.pacs + c.party + c.self <= 0) return null;
  return {
    key: `${race.candidateId}-${race.year}`,
    race,
    year: stages.length ? Math.max(...stages.map((s) => s.year)) : race.year,
    seat: { office, state: race.state, ...(office === "house" ? { district: race.district } : {}) },
    stages,
    ...outcomeOf(stages, race, now),
  };
}

/** Every federal race a member of Congress has run, newest first. */
export async function getCampaigns(bioguideId: string, now = new Date()): Promise<CampaignList | null> {
  const info = (await getLegislatorIndex()).get(bioguideId);
  if (!info?.fecIds.length) return null;
  const [candidates, ...raceLists] = await Promise.all([
    getCandidates(info.fecIds),
    ...info.fecIds.map((id) => getRaces(id).catch(() => [] as FecRace[])),
  ]);
  const names = new Map(candidates.map((c) => [c.id, c.name]));
  const campaigns = raceLists
    .flat()
    .map((race) => buildCampaign(race, names.get(race.candidateId) ?? "", now))
    .filter((c): c is Campaign => c !== null)
    .sort((a, b) => b.race.year - a.race.year || b.year - a.year);
  return {
    bioguideId,
    name: info.displayName,
    campaigns,
    current: campaigns.find((c) => c.outcome === "upcoming") ?? campaigns[0],
  };
}

// ---- Detail for one race ----------------------------------------------------

export interface Rival {
  candidateId: string;
  name: string;
  raised: number;
  /** Outside groups' spending to help them. */
  helpedBy?: Spender[];
  contributions?: FecRace["contributions"];
  sizes?: number[];
}

export interface CampaignDetail {
  sizes?: number[];
  outside?: { support: Spender[]; oppose: Spender[] };
  field?: RaceCandidate[];
  rival?: Rival;
  pacs?: PacMoney;
}

const settled = <T,>(r: PromiseSettledResult<T>) => (r.status === "fulfilled" ? r.value : undefined);

/** The money bar alone, for the profile summary. */
export async function getCampaignMoney(c: Campaign): Promise<Pick<CampaignDetail, "sizes" | "outside">> {
  const [sizes, outside] = await Promise.allSettled([
    getDonationSizes(c.race.candidateId, c.race.year),
    getOutsideMoney(c.race.candidateId, c.race.year),
  ]);
  return { sizes: settled(sizes), outside: settled(outside) };
}

/** Everything for a full election card. Each part fails on its own. */
export async function getCampaignDetail(c: Campaign): Promise<CampaignDetail> {
  const [money, field, pacs] = await Promise.all([
    getCampaignMoney(c),
    getRaceField(c.race).catch(() => undefined),
    getPacMoney(c.race).catch(() => undefined),
  ]);
  // $5,000 is where someone becomes a candidate who must file with the FEC.
  const others = field?.filter((f) => f.candidateId !== c.race.candidateId && f.raised >= 5000) ?? [];
  let rival: Rival | undefined;
  if (others[0]) {
    const top = others[0];
    const [races, sizes, outside] = await Promise.allSettled([
      getRaces(top.candidateId),
      getDonationSizes(top.candidateId, c.race.year),
      getOutsideMoney(top.candidateId, c.race.year),
    ]);
    rival = {
      candidateId: top.candidateId,
      name: top.name,
      raised: top.raised,
      helpedBy: settled(outside)?.support,
      contributions: settled(races)?.find((r) => r.year === c.race.year)?.contributions,
      sizes: settled(sizes),
    };
  }
  return { ...money, field, rival, pacs };
}

// ---- Deck badges ------------------------------------------------------------

/** Next general election a seat is on the ballot: the fall before the term ends. */
const nextElectionYear = (termEnd: string) => Number(termEnd.slice(0, 4)) - 1;

function seatCandidacy(info: LegislatorInfo, candidates: FecCandidate[]) {
  const office = info.chamber === "Senate" ? "S" : "H";
  return candidates.filter(
    (c) =>
      info.fecIds.includes(c.id) &&
      c.office === office &&
      c.state === info.state &&
      (office === "S" || c.district === (info.district ?? 0)),
  );
}

/** `candidates` is null when the FEC couldn't be reached: then no running status is claimed. */
export function electionBadge(
  info: LegislatorInfo,
  candidates: FecCandidate[] | null,
  now = new Date(),
): ElectionBadge {
  const year = nextElectionYear(info.termEnd);
  const date = electionDay(year);
  if (!isAhead(date, now)) return {};
  // Only the next federal general election gets the ballot badge.
  let upcoming = now.getFullYear() + (now.getFullYear() % 2);
  if (!isAhead(electionDay(upcoming), now)) upcoming += 2;
  if (year !== upcoming) return { nextYear: year };

  const mine = candidates ? seatCandidacy(info, candidates) : [];
  // No FEC record for this seat (or no answer): say only that the seat is up.
  const days = daysUntil(date, now);
  if (!mine.length) return { seatUp: { date, days } };
  const running = mine.some((c) => c.electionYears.includes(year) && !c.inactive);
  if (!running) return { seatUp: { date, days, status: "notRunning" } };
  const fecName = mine[0].name;
  const primaries = findResults(
    info.state,
    info.chamber === "Senate" ? "senate" : "house",
    info.district,
    year,
    year,
  ).filter((r) => /primary/i.test(r.stage));
  for (const p of primaries) {
    const stage = toStage(p, info.state, fecName);
    if (stage.candidates.some((c) => c.me)) {
      return { seatUp: { date, days, status: stage.won ? "wonPrimary" : "lostPrimary" } };
    }
  }
  return { seatUp: { date, days, status: "running" } };
}

/** Badges for many members at once: one FEC request for all of them. */
export async function electionBadges(infos: LegislatorInfo[], now = new Date()) {
  const ids = [...new Set(infos.flatMap((i) => i.fecIds))];
  const candidates = await getCandidates(ids).catch(() => null);
  return infos.map((info) => electionBadge(info, candidates, now));
}

/** Share of a race's contributions that came from PACs. */
export function pacShare(race: FecRace) {
  const c = race.contributions;
  const total = c.individuals + c.pacs + c.party + c.self;
  return total > 0 ? c.pacs / total : 0;
}
