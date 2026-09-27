import "server-only";
import { getMockOfficial, getTierFor, sampleTiersFor } from "./mock";
import {
  type DelegationMember,
  getBills,
  getDelegation,
  getHouseVotes,
  getMember,
  partyFromName,
} from "./providers/congress";
import { getLegislatorIndex, type LegislatorInfo } from "./providers/legislators";
import {
  districtKey,
  findStatePerson,
  getExecutives,
  getLegislators,
  getStateBills,
  type StatePerson,
} from "./providers/openstates";
import { getSenateVotes } from "./providers/senate";
import { getPublishedPromises, withPromises } from "./promiseStore";
import { districtsForZip, type StateDistrict, stateDistrict } from "./providers/zip";
import type { ActivityItem, Deck, Official, OfficialProfile, SplitKind, Tier } from "./types";

const STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "District of Columbia",
  FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois",
  IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana",
  ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota",
  MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada",
  NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York",
  NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon",
  PA: "Pennsylvania", PR: "Puerto Rico", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

// Hand-maintained until there's a source worth wiring up for two people.
const FEDERAL_EXEC: Official[] = [
  {
    id: "president",
    name: "Donald Trump",
    office: "President",
    jurisdiction: "United States",
    party: "R",
    photoUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/1/16/Official_Presidential_Portrait_of_President_Donald_J._Trump_%282025%29.jpg/500px-Official_Presidential_Portrait_of_President_Donald_J._Trump_%282025%29.jpg",
    photoFallbackUrl:
      "https://upload.wikimedia.org/wikipedia/commons/5/56/Donald_Trump_official_portrait.jpg",
    termEnds: "2029",
    stats: [],
  },
  {
    id: "vice-president",
    name: "JD Vance",
    office: "Vice President",
    jurisdiction: "United States",
    party: "R",
    photoUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/March_2026_Official_Vice_Presidential_Portrait_of_JD_Vance_%283x4_cropped%29.jpg/500px-March_2026_Official_Vice_Presidential_Portrait_of_JD_Vance_%283x4_cropped%29.jpg",
    // Senate portrait, from his bioguide ID.
    photoFallbackUrl:
      "https://raw.githubusercontent.com/unitedstates/images/gh-pages/congress/450x550/V000137.jpg",
    termEnds: "2029",
    stats: [],
  },
];

const BIOGUIDE = /^[A-Z]\d{6}$/;
// Open States IDs are "ocd-person/<uuid>"; URLs use "os-<state>-<uuid>" so a profile
// knows which state's roster to load.
const OS_ID = /^os-([a-z]{2})-([0-9a-f-]{36})$/;
const toOsId = (p: StatePerson) =>
  `os-${p.state.toLowerCase()}-${p.id.replace("ocd-person/", "")}`;

// States whose single legislative chamber Census files list as the "upper" house.
const UNICAMERAL = new Set(["NE", "DC"]);

// Display order for statewide offices; anything unlisted sorts after these.
const EXEC_ORDER = [
  "Governor",
  "Lieutenant Governor",
  "Attorney General",
  "Secretary of State",
  "Secretary of the Commonwealth",
  "Treasurer",
  "Auditor",
  "Comptroller",
];

const ASSEMBLY_STATES = new Set(["CA", "NY", "NV", "WI"]);
const DELEGATE_STATES = new Set(["MD", "VA", "WV"]);

function stateOffice(p: StatePerson) {
  switch (p.kind) {
    case "executive":
      return p.role;
    case "upper":
      return "State Senator";
    case "legislature":
      return p.state === "DC" ? "Councilmember" : "State Senator";
    case "lower":
      if (ASSEMBLY_STATES.has(p.state)) return "Assemblymember";
      if (DELEGATE_STATES.has(p.state)) return "Delegate";
      return "State Representative";
  }
}

/** Numbered districts read better with a label: "12" → "District 12". */
const districtName = (d: string) => (/^\d+[A-Z]?$/i.test(d) ? `District ${d}` : d);

function stateCard(p: StatePerson): Official {
  return withPromises({
    id: toOsId(p),
    name: p.name,
    office: stateOffice(p),
    jurisdiction: p.kind === "executive" ? STATE_NAMES[p.state] ?? p.state : districtName(p.role),
    party: partyFromName(p.party),
    photoUrl: p.image,
    termEnds: p.termEnd?.slice(0, 4),
    stats: [],
  });
}

/** Legislators whose districts match the Census district names a zip overlaps. */
function matchDistricts(roster: StatePerson[], censusNames: string[]) {
  const byKey = new Map<string, StatePerson[]>();
  for (const p of roster) {
    const key = districtKey(p.role);
    byKey.set(key, [...(byKey.get(key) ?? []), p]);
  }
  return censusNames.flatMap((name) => {
    const found = byKey.get(districtKey(name));
    if (!found) console.warn(`[openstates] no legislator matched district "${name}"`);
    return found ?? [];
  });
}

async function stateTiers(
  state: string,
  upper: StateDistrict[],
  lower: StateDistrict[],
): Promise<Tier[]> {
  const legislators = await getLegislators(state);
  const upperKind = UNICAMERAL.has(state) ? "legislature" : "upper";

  const rank = (o: Official) => {
    const i = EXEC_ORDER.indexOf(o.office);
    return i === -1 ? EXEC_ORDER.length : i;
  };
  const execCards = getExecutives(state).map(stateCard).sort((a, b) => rank(a) - rank(b));

  // Only the chamber that's actually split gets "maybe" badges.
  const inChamber = (kind: string) => legislators.filter((p) => p.kind === kind);
  const legCards = [
    ...matchDistricts(inChamber(upperKind), upper.map((d) => d.name)).map((p) => ({
      ...stateCard(p),
      maybe: upper.length > 1,
    })),
    ...matchDistricts(inChamber("lower"), lower.map((d) => d.name)).map((p) => ({
      ...stateCard(p),
      maybe: lower.length > 1,
    })),
  ];

  const stateName = STATE_NAMES[state] ?? state;
  const tiers: Tier[] = [];
  if (execCards.length) {
    tiers.push({
      id: "state-exec",
      level: "state",
      label: { key: "stateExec", state: stateName },
      officials: execCards,
    });
  }
  tiers.push({
    id: "state-leg",
    level: "state",
    label: state === "DC" ? { key: "dcCouncil" } : { key: "stateLeg", state: stateName },
    officials: legCards,
  });
  return tiers;
}

const photoFor = (bioguideId: string) =>
  `https://raw.githubusercontent.com/unitedstates/images/gh-pages/congress/450x550/${bioguideId}.jpg`;

function districtLabel(state: string, district: number) {
  return district === 0 ? `${state} At-Large` : `${state}-${district}`;
}

/** "Lynch, Stephen F." → "Stephen F. Lynch" (fallback when the roster lacks a display name). */
function directName(inverted: string) {
  const [last, first, ...rest] = inverted.split(", ");
  return [first, last].filter(Boolean).join(" ") + (rest.length ? `, ${rest.join(", ")}` : "");
}

function daysSince(isoDate: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(isoDate).getTime()) / 86400000));
}

async function toCard(
  m: DelegationMember,
  state: string,
  info: LegislatorInfo | undefined,
): Promise<Official> {
  // Enrichment is best-effort: a failed call degrades the card, not the deck.
  const [detail, latestBill] = await Promise.allSettled([
    getMember(m.bioguideId),
    getBills(m.bioguideId, "sponsored", 1),
  ]);
  const sponsored = detail.status === "fulfilled" ? detail.value.sponsoredLegislation?.count : undefined;
  const lastBill = latestBill.status === "fulfilled" ? latestBill.value[0]?.date : undefined;

  const isSenator = m.chamber === "Senate";
  return withPromises({
    id: m.bioguideId,
    name: info?.displayName ?? directName(m.invertedName),
    office: isSenator ? "U.S. Senator" : m.district === 0 && state === "DC" ? "Delegate" : "U.S. Representative",
    jurisdiction: isSenator ? STATE_NAMES[state] ?? state : districtLabel(state, m.district ?? 0),
    party: m.party,
    photoUrl: photoFor(m.bioguideId),
    photoFallbackUrl: m.imageUrl,
    termEnds: info?.termEnd.slice(0, 4),
    lastActiveDaysAgo: lastBill ? daysSince(lastBill) : undefined,
    stats: [
      ...(sponsored !== undefined
        ? [{ icon: "📜", key: "billsSponsored", value: sponsored.toLocaleString("en-US") }]
        : []),
      { icon: "🏛", key: "servingSince", value: String(m.firstYear) },
    ],
  });
}

/** District codes from a street-address lookup: congressional number, state GEOIDs. */
export interface DistrictPick {
  cd?: number;
  upper?: string;
  lower?: string;
}

export async function getDeck(zip: string, pick: DistrictPick = {}): Promise<Deck | null> {
  const found = districtsForZip(zip);
  if (!found) return null;
  const { state } = found;
  // An address pick beats the zip's options: it can land in a sliver the zip table
  // dropped. Unknown GEOIDs are ignored.
  const pickUpper = pick.upper ? stateDistrict("upper", pick.upper) : null;
  const pickLower = pick.lower ? stateDistrict("lower", pick.lower) : null;
  const districts = pick.cd !== undefined ? [pick.cd] : found.districts;
  const upper = pickUpper ? [pickUpper] : found.upper;
  const lower = pickLower ? [pickLower] : found.lower;
  const narrowed = pick.cd !== undefined || !!pickUpper || !!pickLower;

  const [delegation, index, stateLevel] = await Promise.all([
    getDelegation(state),
    getLegislatorIndex(),
    stateTiers(state, upper, lower),
  ]);

  const senators = delegation.filter((m) => m.chamber === "Senate");
  const reps = districts
    .map((d) => delegation.find((m) => m.chamber === "House" && m.district === d))
    .filter((m): m is DelegationMember => m !== undefined);

  const split = districts.length > 1;
  const congress = await Promise.all(
    [...senators, ...reps].map(async (m) => {
      const card = await toCard(m, state, index.get(m.bioguideId));
      return m.chamber === "House" && split ? { ...card, maybe: true } : card;
    }),
  );

  const federal: Tier[] = [
    {
      id: "federal-exec",
      level: "federal",
      label: { key: "federalExec" },
      officials: FEDERAL_EXEC.map(withPromises),
    },
    { id: "federal-leg", level: "federal", label: { key: "federalLeg" }, officials: congress },
  ];

  const upperKind: SplitKind = state === "DC" ? "council" : UNICAMERAL.has(state) ? "legislature" : "stateSenate";
  const splits = [
    split && { kind: "usHouse" as const, districts: districts.map((d) => districtLabel(state, d)) },
    upper.length > 1 && { kind: upperKind, districts: upper.map((d) => d.name) },
    lower.length > 1 && { kind: "stateHouse" as const, districts: lower.map((d) => d.name) },
  ].filter((s) => s !== false);

  return {
    zip,
    state,
    place: `${zip} · ${STATE_NAMES[state] ?? state}`,
    splits: splits.length ? splits : undefined,
    narrowed,
    tiers: [...federal, ...stateLevel, ...sampleTiersFor(zip)],
  };
}

const merge = (...lists: ActivityItem[][]) =>
  lists.flat().sort((a, b) => b.date.localeCompare(a.date));

export async function getProfile(id: string): Promise<OfficialProfile | null> {
  const profile = await loadProfile(id);
  if (!profile) return null;
  return {
    ...profile,
    official: withPromises(profile.official),
    promises: getPublishedPromises(profile.official.id),
  };
}

async function loadProfile(id: string): Promise<OfficialProfile | null> {
  const exec = FEDERAL_EXEC.find((o) => o.id === id);
  if (exec) {
    return {
      official: exec,
      tierLabel: { key: "federalExec" },
      contact: { website: "https://www.whitehouse.gov" },
      activity: [],
      activityNote: "noteFederalExec",
    };
  }

  if (BIOGUIDE.test(id)) {
    const [member, index] = await Promise.all([getMember(id).catch(() => null), getLegislatorIndex()]);
    if (!member) return null;
    const info = index.get(id);
    const term = member.terms[member.terms.length - 1];
    const isSenator = term.chamber === "Senate";
    const state = term.stateCode;

    const votes = isSenator
      ? info?.lisId
        ? getSenateVotes(info.lisId, 12)
        : Promise.resolve([])
      : getHouseVotes(id, 12);

    const [sponsored, cosponsored, voteItems] = await Promise.all([
      getBills(id, "sponsored", 10),
      getBills(id, "cosponsored", 10),
      votes.catch(() => [] as ActivityItem[]),
    ]);

    const official: Official = {
      id,
      name: info?.displayName ?? member.directOrderName,
      office: isSenator ? "U.S. Senator" : "U.S. Representative",
      jurisdiction: isSenator ? STATE_NAMES[state] ?? state : districtLabel(state, term.district ?? 0),
      party: partyFromName(member.partyHistory[member.partyHistory.length - 1]?.partyName ?? ""),
      photoUrl: photoFor(id),
      photoFallbackUrl: member.depiction?.imageUrl,
      termEnds: info?.termEnd.slice(0, 4),
      lastActiveDaysAgo: sponsored[0] ? daysSince(sponsored[0].date) : undefined,
      stats: [
        ...(member.sponsoredLegislation
          ? [{ icon: "📜", key: "billsSponsored", value: member.sponsoredLegislation.count.toLocaleString("en-US") }]
          : []),
        { icon: "🏛", key: "servingSince", value: String(Math.min(...member.terms.map((t) => t.startYear))) },
      ],
    };

    return {
      official,
      tierLabel: { key: "federalLeg" },
      contact: {
        website: info?.website ?? member.officialWebsiteUrl,
        phone: info?.phone ?? member.addressInformation?.phoneNumber,
        office: info?.office ?? member.addressInformation?.officeAddress,
      },
      activity: merge(voteItems, sponsored, cosponsored),
    };
  }

  const osMatch = OS_ID.exec(id);
  if (osMatch) {
    const state = osMatch[1].toUpperCase();
    const person = await findStatePerson(state, `ocd-person/${osMatch[2]}`);
    if (!person) return null;
    const isExec = person.kind === "executive";
    const activity = isExec
      ? []
      : await getStateBills(state, person.id, 15).catch(() => [] as ActivityItem[]);
    const stateName = STATE_NAMES[state] ?? state;
    return {
      official: {
        ...stateCard(person),
        lastActiveDaysAgo: activity[0] ? daysSince(activity[0].date) : undefined,
      },
      tierLabel: isExec
        ? { key: "stateExec", state: stateName }
        : state === "DC"
          ? { key: "dcCouncil" }
          : { key: "stateLeg", state: stateName },
      contact: {
        website: person.website,
        phone: person.phone,
        email: person.email,
        office: person.address,
      },
      activity,
      activityNote: isExec ? "noteStateExec" : undefined,
    };
  }

  const sample = getMockOfficial(id);
  if (!sample) return null;
  return {
    official: sample,
    tierLabel: getTierFor(id)?.label ?? { text: "" },
    contact: {},
    activity: [],
    sample: true,
  };
}
