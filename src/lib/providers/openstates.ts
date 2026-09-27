import "server-only";
import Papa from "papaparse";
import executives from "@/data/executives.json";
import { type SocialLink, socialLinks } from "@/lib/socials";
import type { ActivityItem } from "@/lib/types";

// Rosters come from Open States' bulk files (no key, no rate limit). Only bills use the
// API, which the free tier limits to 10 requests/minute.
const BULK = "https://data.openstates.org/people/current";
const API = "https://v3.openstates.org";
const DAY = 86400;
const HOUR = 3600;

export interface StatePerson {
  id: string; // "ocd-person/<uuid>"
  state: string; // "MA"
  name: string;
  party: string;
  kind: "executive" | "upper" | "lower" | "legislature";
  /** Executive title, or legislative district name. */
  role: string;
  image?: string;
  termEnd?: string;
  phone?: string;
  address?: string;
  website?: string;
  email?: string;
  socials: SocialLink[];
}

interface CsvRow {
  id: string;
  name: string;
  current_party: string;
  current_district: string;
  current_chamber: "upper" | "lower" | "legislature";
  image: string;
  email: string;
  links: string; // ";"-separated
  capitol_voice: string;
  capitol_address: string;
  district_voice: string;
  district_address: string;
  twitter: string;
  youtube: string;
  instagram: string;
  facebook: string;
}

export async function getLegislators(state: string): Promise<StatePerson[]> {
  const res = await fetch(`${BULK}/${state.toLowerCase()}.csv`, { next: { revalidate: DAY } });
  if (!res.ok) throw new Error(`Open States bulk ${res.status} for ${state}`);
  const { data } = Papa.parse<CsvRow>(await res.text(), { header: true, skipEmptyLines: true });
  return data.map((r) => ({
    id: r.id,
    state,
    name: r.name,
    party: r.current_party,
    kind: r.current_chamber,
    role: r.current_district,
    image: r.image || undefined,
    phone: r.capitol_voice || r.district_voice || undefined,
    address: r.capitol_address || r.district_address || undefined,
    website: r.links.split(";")[0] || undefined,
    email: r.email || undefined,
    socials: socialLinks(r),
  }));
}

interface ExecutiveRow {
  id: string;
  name: string;
  party: string;
  title: string;
  image?: string;
  termEnd?: string;
  phone?: string;
  address?: string;
  website?: string;
  email?: string;
  socials?: Record<string, string>;
}

const execTable = executives as unknown as Record<string, ExecutiveRow[]>;

/** Built by scripts/build-executives.mjs from the openstates/people repo. */
export function getExecutives(state: string): StatePerson[] {
  return (execTable[state.toLowerCase()] ?? []).map((e) => ({
    id: e.id,
    state,
    name: e.name,
    party: e.party,
    kind: "executive",
    role: e.title,
    image: e.image,
    termEnd: e.termEnd,
    phone: e.phone,
    address: e.address,
    website: e.website,
    email: e.email,
    socials: socialLinks(e.socials ?? {}),
  }));
}

export async function findStatePerson(state: string, id: string): Promise<StatePerson | null> {
  const exec = getExecutives(state).find((p) => p.id === id);
  if (exec) return exec;
  return (await getLegislators(state)).find((p) => p.id === id) ?? null;
}

interface OsBill {
  identifier: string;
  title: string;
  latest_action_date?: string;
  latest_action_description?: string;
  openstates_url: string;
}

/** Bills the legislator filed as primary sponsor, most recently active first. */
export async function getStateBills(
  state: string,
  personId: string,
  limit: number,
): Promise<ActivityItem[]> {
  const key = process.env.OPENSTATES_API_KEY;
  if (!key) throw new Error("OPENSTATES_API_KEY is not set in .env.local");
  const url = new URL(`${API}/bills`);
  url.search = new URLSearchParams({
    jurisdiction: state.toLowerCase(),
    sponsor: personId,
    sponsor_classification: "primary",
    sort: "latest_action_desc",
    per_page: String(limit),
    apikey: key,
  }).toString();

  // One retry after the rate-limit window; beyond that, show the profile without bills.
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { next: { revalidate: HOUR } });
    if (res.status === 429 && attempt === 0) {
      await new Promise((r) => setTimeout(r, 6000));
      continue;
    }
    if (!res.ok) throw new Error(`Open States ${res.status} for bills`);
    const data: { results: OsBill[] } = await res.json();
    return data.results
      .filter((b) => b.latest_action_date)
      .map((b) => ({
        kind: "bill",
        date: b.latest_action_date!.slice(0, 10),
        title: b.title,
        badge: b.identifier,
        detail: b.latest_action_description ? `Latest: ${b.latest_action_description}` : undefined,
        url: b.openstates_url,
      }));
  }
}

/**
 * Loose key for matching Census district names to Open States ones:
 * "Norfolk-Plymouth-Bristol District" and "Norfolk, Plymouth and Bristol" → "norfolkplymouthbristol";
 * "State House District 010A" and "10A" → "10a"; "South East" and "Southeast" match.
 */
export function districtKey(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((w) => w && !STOP_WORDS.has(w))
    .map((w) => w.replace(/^0+(?=\d)/, ""))
    .join("");
}

const STOP_WORDS = new Set([
  "state", "house", "senate", "assembly", "legislative", "district", "senatorial",
  "representative", "delegate", "delegates", "and", "of",
]);
