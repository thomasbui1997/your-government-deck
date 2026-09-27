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
  label: string;
  value: string;
}

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
  title: string;
  officials: Official[];
  comingSoon?: boolean;
  /** Placeholder data, not yet backed by a real source. */
  sample?: boolean;
}

export interface Deck {
  zip: string;
  place: string;
  state: string;
  /** One line per kind of district the zip splits, e.g. "U.S. House: NY-12, NY-13". */
  splits?: string[];
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
  official: Official;
  tierTitle: string;
  contact: {
    website?: string;
    phone?: string;
    email?: string;
    office?: string;
  };
  activity: ActivityItem[];
  /** Explains an empty timeline, e.g. offices whose activity isn't tracked yet. */
  activityNote?: string;
  sample?: boolean;
}
