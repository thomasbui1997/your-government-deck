// Builds src/data/results/ma.json: official vote counts for every U.S. House and U.S. Senate
// election in Massachusetts since 2000, primaries and specials included.
// Source: Massachusetts Secretary of the Commonwealth, PD43+ (electionstats.state.ma.us).
// Run: node scripts/build-ma-results.mjs
import { mkdirSync, writeFileSync } from "node:fs";

const SITE = "https://electionstats.state.ma.us";
const OFFICES = { 5: "house", 6: "senate" };
const FIRST_YEAR = 2000;
const today = new Date().toISOString().slice(0, 10);
const lastYear = Number(today.slice(0, 4));

const decode = (s) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/&[a-z]+;/g, " ");

/** HTML → cells: tags become separators, empty cells dropped. */
const cells = (html) =>
  decode(html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, "|"))
    .split("|")
    .map((c) => c.replace(/\s+/g, " ").trim())
    .filter(Boolean);

const NUM = /^[\d,]+$/;
const PCT = /^[\d.]+%$/;

/** One results row: header cells, then name [party] votes pct … until "All Others"/"Blanks". */
function parseRow(c, id) {
  // Header: year, office, district, stage.
  let h = -1;
  for (let i = c.length - 4; i >= 0; i--) {
    if (/^(19|20)\d\d$/.test(c[i]) && /^U\.S\. (House|Senate)$/.test(c[i + 1])) {
      h = i;
      break;
    }
  }
  if (h === -1) return null;
  const [year, office, district, stage] = c.slice(h, h + 4);
  const start = c.indexOf("%", h);
  if (start === -1) return null;

  const candidates = [];
  let i = start + 1;
  while (i < c.length && !/^(All Others|Blanks|Total Votes Cast)$/.test(c[i])) {
    // name, optional party, votes, pct
    const name = c[i];
    let j = i + 1;
    let party;
    if (!NUM.test(c[j])) party = c[j++];
    if (!NUM.test(c[j]) || !PCT.test(c[j + 1])) break;
    candidates.push({
      name,
      ...(party ? { party } : {}),
      votes: Number(c[j].replace(/,/g, "")),
      pct: Number(c[j + 1].slice(0, -1)),
    });
    i = j + 2;
  }
  if (!candidates.length) return null;
  const total = c.indexOf("Total Votes Cast", i);
  const m = /^(\d+)(st|nd|rd|th) Congressional$/.exec(district);
  return {
    id: Number(id),
    year: Number(year),
    office: office === "U.S. House" ? "house" : "senate",
    ...(m ? { district: Number(m[1]) } : {}),
    stage,
    candidates,
    ...(total !== -1 && NUM.test(c[total + 1]) ? { totalVotes: Number(c[total + 1].replace(/,/g, "")) } : {}),
  };
}

const races = new Map();
for (const [officeId, office] of Object.entries(OFFICES)) {
  for (let year = FIRST_YEAR; year <= lastYear; year++) {
    const url = `${SITE}/elections/search/year_from:${year}/year_to:${year}/office_id:${officeId}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: ${res.status}`);
    const html = await res.text();
    // Each row sits between two "See Details" links to /elections/view/<id>.
    const parts = html.split(/\/elections\/view\/(\d+)/);
    for (let k = 1; k < parts.length; k += 2) {
      const id = parts[k];
      if (races.has(Number(id))) continue;
      const row = parseRow(cells(parts[k - 1]), id);
      if (row && row.year === year && row.office === office) races.set(row.id, row);
    }
    process.stdout.write(`${office} ${year}: ${[...races.values()].filter((r) => r.year === year && r.office === office).length}\n`);
  }
}

const out = {
  source: "Massachusetts Secretary of the Commonwealth, PD43+ election statistics",
  sourceUrl: SITE,
  fetched: today,
  races: [...races.values()].sort((a, b) => b.year - a.year || a.office.localeCompare(b.office) || (a.district ?? 0) - (b.district ?? 0) || a.id - b.id),
};
mkdirSync("src/data/results", { recursive: true });
writeFileSync("src/data/results/ma.json", JSON.stringify(out, null, 1) + "\n");
console.log(`Wrote ${out.races.length} races to src/data/results/ma.json`);
