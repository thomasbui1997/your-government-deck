// Placeholder local tiers until the Stoughton data lands in step 7. Stats are made up.
import type { Official, Tier } from "./types";

const tiers: Tier[] = [
  {
    id: "county",
    level: "county",
    title: "Norfolk County",
    officials: [
      {
        id: "norfolk-sheriff",
        name: "Sample Sheriff",
        office: "Sheriff",
        jurisdiction: "Norfolk County",
        party: "D",
        termEnds: "2029",
        stats: [],
      },
      {
        id: "norfolk-da",
        name: "Sample DA",
        office: "District Attorney",
        jurisdiction: "Norfolk County",
        party: "D",
        termEnds: "2027",
        stats: [],
      },
    ],
  },
  {
    id: "town",
    level: "town",
    title: "Town of Stoughton",
    officials: [
      {
        id: "stoughton-select-1",
        name: "Select Board Chair",
        office: "Select Board",
        jurisdiction: "Stoughton",
        party: "NP",
        termEnds: "2027",
        lastActiveDaysAgo: 7,
        stats: [{ icon: "📅", label: "Meetings", value: "18" }],
      },
      {
        id: "stoughton-select-2",
        name: "Select Board Member",
        office: "Select Board",
        jurisdiction: "Stoughton",
        party: "NP",
        termEnds: "2028",
        lastActiveDaysAgo: 7,
        stats: [{ icon: "📅", label: "Meetings", value: "17" }],
      },
      {
        id: "stoughton-town-manager",
        name: "Town Manager",
        office: "Town Manager",
        jurisdiction: "Stoughton",
        party: "NP",
        appointed: true,
        stats: [],
      },
    ],
  },
  {
    id: "school",
    level: "school",
    title: "School Committee",
    officials: [
      {
        id: "stoughton-school-1",
        name: "Committee Member",
        office: "School Committee",
        jurisdiction: "Stoughton Public Schools",
        party: "NP",
        termEnds: "2027",
        stats: [{ icon: "📅", label: "Meetings", value: "11" }],
      },
    ],
  },
];

/** Sample local tiers for Stoughton; "coming soon" placeholders everywhere else. */
export function sampleTiersFor(zip: string): Tier[] {
  return tiers.map((t) =>
    zip === "02072" ? { ...t, sample: true } : { ...t, officials: [], comingSoon: true },
  );
}

export function getMockOfficial(id: string): Official | undefined {
  for (const tier of tiers) {
    const found = tier.officials.find((o) => o.id === id);
    if (found) return found;
  }
  return undefined;
}

export function getTierFor(id: string): Tier | undefined {
  return tiers.find((t) => t.officials.some((o) => o.id === id));
}
