import "server-only";
import data from "@/data/bios/ma-executives.json";
import type { OfficialBio } from "../types";

// Hand-curated bios of Massachusetts statewide executives, quoted from their official pages
// (src/data/bios/ma-executives.json). Text stays as published (English).

interface Entry {
  summary: string;
  hometown?: string;
  born?: { place: string; date?: string };
  education: string[];
  career: string[];
  sources: { title: string; url: string }[];
}

const officials = data.officials as Record<string, Entry>;

/** By Open States person ID (`ocd-person/<uuid>`). */
export function getMaExecutiveBio(personId: string): OfficialBio | undefined {
  const e = officials[personId];
  if (!e) return undefined;
  return {
    summary: e.summary,
    ...(e.hometown ? { hometown: e.hometown } : {}),
    ...(e.born ? { born: e.born } : {}),
    education: e.education,
    career: e.career,
    military: [],
    sources: e.sources,
  };
}
