import type { PublishedPromises } from "./promises";
import type { SocialLink } from "./socials";

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
  | { key: "federalExec" | "federalLeg" | "dcCouncil" | "county" | "town" | "school" }
  | { key: "stateExec" | "stateLeg"; state: string }
  /** A proper noun such as "Town of Stoughton", shown as is. */
  | { text: string };

export type SplitKind = "usHouse" | "stateSenate" | "stateHouse" | "council" | "legislature";

export interface PromiseSummary {
  kept: number;
  total: number;
}

/** Where an official stands with the next election. */
export interface ElectionBadge {
  /** Their seat is on the next federal general-election ballot. */
  seatUp?: {
    /** Election Day, ISO date. */
    date: string;
    /** Days to go when the page was built (0 on Election Day). */
    days: number;
    /** From FEC filings and official primary results; absent when unknown. */
    status?: "running" | "wonPrimary" | "lostPrimary" | "notRunning";
  };
  /** Year of their next election, when it isn't the upcoming one. */
  nextYear?: number;
  /** Can't run again for this office. */
  termLimited?: boolean;
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
  /** Leadership role on a board. */
  role?: "chair" | "viceChair";
  termEnds?: string;
  lastActiveDaysAgo?: number;
  stats: CardStat[];
  promises?: PromiseSummary;
  appointed?: boolean;
  election?: ElectionBadge;
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

export type ActivityKind = "vote" | "bill" | "cosponsor" | "meeting" | "post" | "executive";

export interface ActivityItem {
  kind: ActivityKind;
  date: string; // ISO date
  title: string;
  detail?: string;
  /** Short badge, e.g. the vote cast ("Yea") or the bill number. */
  badge?: string;
  /** A number shown after the translated badge, e.g. the executive order number. */
  badgeNumber?: string;
  /** What `date` is, when it's worth saying (a signing date vs. a publication date). */
  dateKind?: "signed" | "published";
  url?: string;
}

/** The back of an official's card: who they are, from official sources. */
export interface OfficialBio {
  /** An official biography published as prose (e.g. a legislature profile), shown verbatim. */
  summary?: string;
  hometown?: string;
  born?: { place: string; date?: string };
  education: string[];
  career: string[];
  military: string[];
  /** Most common topics of the bills they sponsor, from Congress.gov's policy areas. */
  issues?: { name: string; bills: number }[];
  committees?: { name: string; role?: string; parent?: string }[];
  sources: { title: string; url: string }[];
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
    socials?: SocialLink[];
  };
  activity: ActivityItem[];
  bio?: OfficialBio;
  /** Dictionary key (under `profile`) explaining an empty timeline. */
  activityNote?: "noteFederalExec" | "noteStateExec" | "noteLocal";
  /** Where hand-curated data came from, and when it was last checked. */
  sources?: { title: string; url: string }[];
  checked?: string;
}
