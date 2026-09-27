// Promise tracker model, shared by the site, the review UI, and scripts/promises.
import type { PromiseSummary } from "./types";

export const STATUSES = [
  "kept",
  "compromise",
  "in_progress",
  "stalled",
  "not_started",
  "broken",
] as const;
export type PromiseStatus = (typeof STATUSES)[number];

export const STATUS_META: Record<
  PromiseStatus,
  { label: string; progress: number; color: string; description: string }
> = {
  kept: {
    label: "Kept",
    progress: 100,
    color: "bg-emerald-600",
    description: "Delivered as promised, or substantially so.",
  },
  compromise: {
    label: "Compromise",
    progress: 75,
    color: "bg-teal-500",
    description: "Partly delivered: a real result, but less than what was promised.",
  },
  in_progress: {
    label: "In progress",
    progress: 50,
    color: "bg-gold",
    description: "Concrete action is underway (a bill filed, a budget line, a program launched).",
  },
  stalled: {
    label: "Stalled",
    progress: 25,
    color: "bg-orange-500",
    description: "Action started but has stopped moving, or was blocked.",
  },
  not_started: {
    label: "Not started",
    progress: 0,
    color: "bg-navy/30",
    description: "No meaningful action found yet.",
  },
  broken: {
    label: "Broken",
    progress: 0,
    color: "bg-party-r",
    description: "Abandoned, reversed, or no longer achievable this term.",
  },
};

export const TOPICS = [
  "Economy & Jobs",
  "Housing",
  "Health Care",
  "Education",
  "Climate & Environment",
  "Transportation",
  "Public Safety & Justice",
  "Civil Rights",
  "Immigration",
  "Government & Democracy",
  "Taxes & Budget",
  "Other",
] as const;
export type PromiseTopic = (typeof TOPICS)[number];

export const EVIDENCE_KINDS = [
  "law",
  "bill",
  "vote",
  "exec_action",
  "budget",
  "official_statement",
  "news",
  "report",
] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

export interface Evidence {
  date: string; // YYYY-MM-DD, or YYYY-MM when only the month is known
  summary: string;
  url: string;
  kind: EvidenceKind;
}

export interface PromiseSource {
  /** Archived (Wayback Machine) copy of the page the promise was made on. */
  url: string;
  title: string;
  date: string;
}

export interface TrackedPromise {
  id: string;
  text: string;
  topic: PromiseTopic;
  /** Verbatim words from the source. */
  quote: string;
  source: PromiseSource;
  status: PromiseStatus;
  /** One or two neutral sentences explaining the status. */
  statusNote: string;
  evidence: Evidence[];
  lastReviewed: string; // YYYY-MM-DD
}

export interface PublishedPromises {
  officialId: string;
  name: string;
  updatedAt: string;
  promises: TrackedPromise[];
  /** Normalized texts of drafts the reviewer rejected, so re-runs don't re-propose them. */
  rejected: string[];
}

/** A pipeline draft awaiting review. */
export interface DraftPromise extends Omit<TrackedPromise, "id" | "lastReviewed"> {
  draftId: string;
  /** Set when this draft re-assesses an already-published promise. */
  updatesId?: string;
  confidence: "low" | "medium" | "high";
  /** Problems found by automated checks, e.g. a quote not found on the source page. */
  flags: string[];
}

export interface DraftFile {
  officialId: string;
  name: string;
  generatedAt: string;
  model: string;
  drafts: DraftPromise[];
}

export function summarize(promises: TrackedPromise[]): PromiseSummary {
  return { kept: promises.filter((p) => p.status === "kept").length, total: promises.length };
}

/** Headline score: kept counts fully, compromise counts half. */
export function score(promises: TrackedPromise[]) {
  if (!promises.length) return 0;
  const points = promises.reduce(
    (n, p) => n + (p.status === "kept" ? 1 : p.status === "compromise" ? 0.5 : 0),
    0,
  );
  return Math.round((points / promises.length) * 100);
}

/** Loose comparison key so re-runs can recognize a promise they've already seen. */
export function promiseKey(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
