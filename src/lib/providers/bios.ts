import "server-only";
import congress from "@/data/bios/congress.json";

// Official biographies, built by scripts/build-congress-bios.mjs from the Congressional
// Directory. Text stays as published (English).

export interface DirectoryBio {
  hometown?: string;
  born?: { place: string; date?: string };
  education: string[];
  career: string[];
  military: string[];
}

const members = congress.members as Record<string, DirectoryBio>;

/** By bioguide ID, or "vice-president". */
export function getDirectoryBio(id: string): DirectoryBio | undefined {
  return members[id];
}

export const directorySource = { title: congress.source.title, url: congress.source.url, issued: congress.source.issued };
