import "server-only";
import data from "@/data/zips.json";

const table = data as unknown as {
  zips: Record<string, { c: string[]; u: string[]; l: string[] }>;
  upper: Record<string, string>;
  lower: Record<string, string>;
};

export interface ZipDistricts {
  state: string;
  /** Congressional district numbers, largest land share first. 0 = at-large or delegate. */
  districts: number[];
  /** Census names of the state senate / state house districts the zip overlaps. */
  upper: string[];
  lower: string[];
}

/** Built by scripts/build-zip-districts.mjs from Census ZCTA relationship files. */
export function districtsForZip(zip: string): ZipDistricts | null {
  const row = table.zips[zip];
  if (!row?.c.length) return null;
  const state = row.c[0].split("-")[0];
  // A zip can cross a state line; keep only districts in the zip's primary state.
  const districts = row.c
    .filter((cd) => cd.startsWith(`${state}-`))
    .map((cd) => Number(cd.split("-")[1]));
  // GEOIDs start with the state FIPS code; the largest-share district sets the state.
  const fips = (row.u[0] ?? row.l[0])?.slice(0, 2);
  const inState = (g: string) => g.startsWith(fips);
  return {
    state,
    districts,
    upper: row.u.filter(inState).map((g) => table.upper[g]),
    lower: row.l.filter(inState).map((g) => table.lower[g]),
  };
}
