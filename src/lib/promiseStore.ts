import "server-only";
import published from "@/data/promises.json";
import { type PublishedPromises, summarize } from "./promises";
import type { Official } from "./types";

// Approved promises only; drafts live in data/promises/pending until reviewed.
const store = published as unknown as Record<string, PublishedPromises>;

export function getPublishedPromises(officialId: string): PublishedPromises | null {
  const entry = store[officialId];
  return entry?.promises.length ? entry : null;
}

/** Adds the "promises kept" meter to a card when the official has tracked promises. */
export function withPromises(card: Official): Official {
  const entry = getPublishedPromises(card.id);
  return entry ? { ...card, promises: summarize(entry.promises) } : card;
}
