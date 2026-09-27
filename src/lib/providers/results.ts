import "server-only";
import ma from "@/data/results/ma.json";

// Official vote counts, one file per state, built by scripts/build-<state>-results.mjs.
// Only Massachusetts so far; elsewhere races show money without results.

export interface ResultCandidate {
  name: string;
  party?: string;
  votes: number;
  pct: number;
}

export interface OfficialResult {
  /** The state's own ID for this election, for linking to its results page. */
  id: number;
  year: number;
  office: "house" | "senate";
  district?: number;
  /** As the state labels it, e.g. "Democratic Primary", "Special General Election". */
  stage: string;
  candidates: ResultCandidate[];
  totalVotes?: number;
}

interface ResultsFile {
  source: string;
  sourceUrl: string;
  fetched: string;
  races: OfficialResult[];
}

const STATES: Record<string, ResultsFile & { link: (id: number) => string }> = {
  MA: {
    ...(ma as ResultsFile),
    link: (id) => `https://electionstats.state.ma.us/elections/view/${id}/`,
  },
};

export function resultsSource(state: string) {
  const file = STATES[state];
  return file ? { title: file.source, url: file.sourceUrl, fetched: file.fetched } : undefined;
}

export function resultLink(state: string, id: number) {
  return STATES[state]?.link(id);
}

const SUFFIX = /,?\s+(jr|sr|ii|iii|iv)\.?$/i;
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[^a-z\s-]/g, "").trim();

/** FEC names are "LAST, FIRST MIDDLE"; state results are "First M. Last". */
export function sameCandidate(fecName: string, resultName: string) {
  const [fecLast, fecRest = ""] = fecName.replace(SUFFIX, "").split(",");
  const words = norm(resultName.replace(SUFFIX, "")).split(/\s+/);
  const last = norm(fecLast);
  const first = norm(fecRest).split(/\s+/).find((w) => !/^(mr|mrs|ms|dr|sen|rep|hon)$/.test(w));
  if (!first || !words.length) return false;
  return words[words.length - 1] === last.split(/\s+/).pop() && words[0][0] === first[0];
}

/** Results in a state for one seat within a span of years, oldest stage first. */
export function findResults(
  state: string,
  office: "house" | "senate",
  district: number | undefined,
  fromYear: number,
  toYear: number,
): OfficialResult[] {
  const file = STATES[state];
  if (!file) return [];
  return file.races
    .filter(
      (r) =>
        r.office === office &&
        r.year >= fromYear &&
        r.year <= toYear &&
        (office === "senate" || r.district === district),
    )
    .sort((a, b) => a.year - b.year || stageOrder(a.stage) - stageOrder(b.stage) || a.id - b.id);
}

const stageOrder = (stage: string) => (/primary/i.test(stage) ? 0 : 1);

export const hasResults = (state: string) => state in STATES;
