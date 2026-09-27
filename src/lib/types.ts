import type { PublishedPromises } from "./promises";

export type Party = "D" | "R" | "I" | "NP";

export type TierId =
  | "federal-exec"
  | "federal-leg"
  | "state-exec"
  | "state-leg"
  | "county"
  | "town"
  | "school";

export type Level = "federal" | "state" | "county" | "town" | "school";

export interface CardStat {
  icon: string;
  /** Dictionary key under `stats`, e.g. "billsSponsored". */
  key: string;
  value: string;
}

/** How to title a tier; rendered in the visitor's language. */
export type TierLabel =
  | { key: "federalExec" | "federalLeg" | "dcCouncil" }
  | { key: "stateExec" | "stateLeg"; state: string }
  /** A proper noun such as "Town of Stoughton", shown as is. */
  | { text: string };

export type SplitKind = "usHouse" | "stateSenate" | "stateHouse" | "council" | "legislature";

export interface PromiseSummary {
  kept: number;
  total: number;
}

export interface Official {
  id: string;
  name: string;
  office: string;
  jurisdiction: string;
  party: Party;
  photoUrl?: string;
  photoFallbackUrl?: string;
  /** Shown when a zip spans several districts and this rep may not be yours. */
  maybe?: boolean;
  termEnds?: string;
  lastActiveDaysAgo?: number;
  stats: CardStat[];
  promises?: PromiseSummary;
  appointed?: boolean;
}

export interface Tier {
  id: TierId;
  level: Level;
  label: TierLabel;
  officials: Official[];
  comingSoon?: boolean;
  /** Placeholder data, not yet backed by a real source. */
  sample?: boolean;
}

export interface Deck {
  zip: string;
  place: string;
  state: string;
  /** One entry per kind of district the zip splits, e.g. U.S. House: NY-12, NY-13. */
  splits?: { kind: SplitKind; districts: string[] }[];
  /** True when the deck was narrowed to the districts of a street address. */
  narrowed?: boolean;
  tiers: Tier[];
}

export type ActivityKind = "vote" | "bill" | "cosponsor" | "meeting" | "post";

export interface ActivityItem {
  kind: ActivityKind;
  date: string; // ISO date
  title: string;
  detail?: string;
  /** Short badge, e.g. the vote cast ("Yea") or the bill number. */
  badge?: string;
  url?: string;
}

export interface OfficialProfile {
  /** Approved campaign promises, when this official is tracked. */
  promises?: PublishedPromises | null;
  official: Official;
  tierLabel: TierLabel;
  contact: {
    website?: string;
    phone?: string;
    email?: string;
    office?: string;
  };
  activity: ActivityItem[];
  /** Dictionary key (under `profile`) explaining an empty timeline. */
  activityNote?: "noteFederalExec" | "noteStateExec";
  sample?: boolean;
}
