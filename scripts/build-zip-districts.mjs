// Builds src/data/zips.json: zip → congressional + state legislative districts.
// Sources: Census Bureau ZCTA5 relationship files (CD119, and 2024 state legislative plans).
// Run: node scripts/build-zip-districts.mjs
//
// Output shape:
//   { zips: { "02072": { c: ["MA-8"], u: ["25D33"], l: ["25101", "25103"] } },
//     upper: { "25D33": "Norfolk-Plymouth-Bristol District", ... },
//     lower: { "25101": "6th Norfolk District", ... } }
// Upper and lower GEOIDs can collide (e.g. NY "36001"), hence separate name tables.
// c = congressional districts, u = state senate (upper), l = state house (lower).
import { writeFileSync } from "node:fs";

const REL = "https://www2.census.gov/geo/docs/maps-data/data/rel2020/cd-sld";

// Districts covering less than this share of a zip's land are boundary slivers, not real splits.
const MIN_SHARE = 0.02;

const FIPS = {
  "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO", "09": "CT",
  "10": "DE", "11": "DC", "12": "FL", "13": "GA", "15": "HI", "16": "ID", "17": "IL",
  "18": "IN", "19": "IA", "20": "KS", "21": "KY", "22": "LA", "23": "ME", "24": "MD",
  "25": "MA", "26": "MI", "27": "MN", "28": "MS", "29": "MO", "30": "MT", "31": "NE",
  "32": "NV", "33": "NH", "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND",
  "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC", "46": "SD",
  "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA", "54": "WV",
  "55": "WI", "56": "WY", "72": "PR",
};

/**
 * Reads a relationship file and returns zip → district GEOIDs (largest share first),
 * plus GEOID → district name.
 */
async function load(file, geoCol, nameCol) {
  const text = await (await fetch(`${REL}/${file}`)).text();
  const lines = text.replace(/^﻿/, "").trim().split("\n");
  const header = lines[0].split("|");
  const col = (name) => header.indexOf(name);
  const [iGeo, iName, iZip, iZipLand, iPartLand] = [
    col(geoCol), col(nameCol), col("GEOID_ZCTA5_20"), col("AREALAND_ZCTA5_20"), col("AREALAND_PART"),
  ];

  const parts = {};
  const names = {};
  for (const line of lines.slice(1)) {
    const f = line.split("|");
    const zip = f[iZip];
    const geoid = f[iGeo];
    // "ZZZ"-style codes are water or areas with no district.
    if (!zip || !geoid || /Z{3}$/.test(geoid) || !FIPS[geoid.slice(0, 2)]) continue;
    const zipLand = Number(f[iZipLand]);
    const share = zipLand > 0 ? Number(f[iPartLand]) / zipLand : 1;
    (parts[zip] ??= []).push({ geoid, share });
    names[geoid] = f[iName];
  }

  const byZip = {};
  for (const [zip, list] of Object.entries(parts)) {
    list.sort((a, b) => b.share - a.share);
    const kept = list.filter((p) => p.share >= MIN_SHARE);
    byZip[zip] = (kept.length ? kept : list.slice(0, 1)).map((p) => p.geoid);
  }
  return { byZip, names };
}

const [cd, upper, lower] = await Promise.all([
  load("tab20_cd11920_zcta520_natl.txt", "GEOID_CD119_20", "NAMELSAD_CD119_20"),
  load("tab20_sldu202420_zcta520_natl.txt", "GEOID_SLDU2024_20", "NAMELSAD_SLDU2024_20"),
  load("tab20_sldl202420_zcta520_natl.txt", "GEOID_SLDL2024_20", "NAMELSAD_SLDL2024_20"),
]);

// "2508" → "MA-8". "00" = at-large and "98" = non-voting delegate; both become district 0.
const cdLabel = (geoid) => {
  const num = Number(geoid.slice(2));
  return `${FIPS[geoid.slice(0, 2)]}-${num === 98 ? 0 : num}`;
};

const zips = {};
let split = 0;
for (const [zip, cds] of Object.entries(cd.byZip)) {
  const u = upper.byZip[zip] ?? [];
  const l = lower.byZip[zip] ?? [];
  zips[zip] = { c: cds.map(cdLabel), u, l };
  if (cds.length > 1 || u.length > 1 || l.length > 1) split++;
}

writeFileSync(
  new URL("../src/data/zips.json", import.meta.url),
  JSON.stringify({ zips, upper: upper.names, lower: lower.names }),
);
console.log(`${Object.keys(zips).length} zips, ${split} split across at least one kind of district`);
