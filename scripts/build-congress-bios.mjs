// Builds src/data/bios/congress.json: each member of Congress's official biography, keyed by
// bioguide ID. Source: the Congressional Directory (GPO, via the govinfo API), where members'
// entries read "NAME, Party, of Town, ST; born in …; education: …; professional history: …".
// Run: node --env-file=.env.local scripts/build-congress-bios.mjs [CDIR-YYYY-MM-DD]
import { mkdirSync, writeFileSync } from "node:fs";

const key = process.env.CONGRESS_API_KEY;
if (!key) throw new Error("CONGRESS_API_KEY (an api.data.gov key) must be set");
const API = "https://api.govinfo.gov";

async function latestEdition() {
  // Editions come out a few times per Congress; take the newest in the last three years.
  const since = new Date(Date.now() - 3 * 365 * 86400000).toISOString().slice(0, 10);
  const res = await fetch(`${API}/published/${since}?collection=CDIR&offsetMark=*&pageSize=100&api_key=${key}`);
  const { packages } = await res.json();
  if (!packages?.length) throw new Error("No Congressional Directory editions found");
  return packages.sort((a, b) => b.dateIssued.localeCompare(a.dateIssued))[0];
}

const packageId = process.argv[2] ?? (await latestEdition()).packageId;
const summary = await (await fetch(`${API}/packages/${packageId}/summary?api_key=${key}`)).json();
const text = await (await fetch(`${API}/packages/${packageId}/txt?api_key=${key}`)).text();

const legislators = await (
  await fetch("https://raw.githubusercontent.com/unitedstates/congress-legislators/gh-pages/legislators-current.json")
).json();

// Surname as the directory prints it; matches the "vice-president" card in src/lib/resolve.ts.
const VICE_PRESIDENT = "VANCE";

const ascii = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();

// Paragraphs; lines rejoined (a line ending in "-" continues a range like "1997-\n2001").
const paragraphs = text
  .replace(/\r/g, "")
  .split(/\n\s*\n/)
  .map((p) => p.split("\n").map((l) => l.trim()).reduce((acc, l) => (acc.endsWith("-") ? acc + l : acc ? `${acc} ${l}` : l), ""));

// Punctuation varies by entry ("of Silt, CO, born", "Republican of Austin", "of Brattleboro; VT;",
// "of Arizona;", no "of" at all), so the hometown runs up to "born" (or "raised", "education"). Names are capitalized but
// keep lowercase parts: "McCONNELL", "DeGETTE", "LaHOOD", "Jr.".
const ENTRY = /^([A-Z][A-Za-z0-9 .,'"()\-ÁÉÍÓÚÑÜáéíóúñü]+?),? (Democrat|Republican|Independent|Libertarian|[A-Z][a-z]+(?:[ -][A-Z][a-z]+)*),? (?:of )?(.+?)[;,]\s*((?:born|raised|education)\b.*)$/;
const STATE_NAMES = {
  Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR", California: "CA", Colorado: "CO",
  Connecticut: "CT", Delaware: "DE", "District of Columbia": "DC", Florida: "FL", Georgia: "GA",
  Guam: "GU", Hawaii: "HI", Idaho: "ID", Illinois: "IL", Indiana: "IN", Iowa: "IA", Kansas: "KS",
  Kentucky: "KY", Louisiana: "LA", Maine: "ME", Maryland: "MD", Massachusetts: "MA", Michigan: "MI",
  Minnesota: "MN", Mississippi: "MS", Missouri: "MO", Montana: "MT", Nebraska: "NE", Nevada: "NV",
  "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY",
  "North Carolina": "NC", "North Dakota": "ND", "Northern Mariana Islands": "MP", Ohio: "OH",
  Oklahoma: "OK", Oregon: "OR", Pennsylvania: "PA", "Puerto Rico": "PR", "Rhode Island": "RI",
  "South Carolina": "SC", "South Dakota": "SD", Tennessee: "TN", Texas: "TX", Utah: "UT",
  Vermont: "VT", Virginia: "VA", "Virgin Islands": "VI", "American Samoa": "AS", Washington: "WA",
  "West Virginia": "WV", Wisconsin: "WI", Wyoming: "WY",
};

/** "Silt, CO" / "Brattleboro; VT" / "Tumon, Guam" / "Arizona" → [hometown, state code]. */
function hometownState(raw) {
  // "Resident Commissioner of Puerto Rico" → "Puerto Rico".
  const town = raw.replace(/;\s*/g, ", ").replace(/^.* of /, "").trim();
  const last = town.split(/,\s*/).pop();
  const code = /^[A-Z]{2}$/.test(last) ? last : STATE_NAMES[last];
  return code ? [town, code] : null;
}

const SECTION = /^(education|professional history|military service|election history):\s*(.*)$/;
const BORN = /^born (?:in )?(.+?),? ((?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, \d{4})\.?$/;
const SECTION_KEYS = {
  education: "education",
  "professional history": "career",
  "military service": "military",
  "election history": "elected",
};

function parse(p) {
  const m = ENTRY.exec(p);
  if (!m) return null;
  const [, name, party, rawTown, rest] = m;
  const place = hometownState(rawTown);
  if (!place) return null;
  const [hometown, state] = place;
  const bio = { name, party, hometown, state, education: [], career: [], military: [], elected: [] };
  let section = null;
  for (const raw of rest.replace(/\.$/, "").split(/;\s*/)) {
    const token = raw.trim();
    if (!token) continue;
    const s = SECTION.exec(token);
    if (s) {
      section = SECTION_KEYS[s[1]];
      if (s[2]) bio[section].push(s[2]);
      continue;
    }
    if (!section) {
      const b = BORN.exec(token);
      if (b) {
        bio.born = { place: b[1], date: b[2] };
        continue;
      }
      if (token.startsWith("born in ")) {
        bio.born = { place: token.slice(8) };
        continue;
      }
    }
    if (section) bio[section].push(token);
  }
  return bio;
}

function match(bio) {
  const entry = ascii(bio.name)
    .replace(/"[^"]*"/g, " ")
    .replace(/,\s*(M\.?D|PH\.?D|D\.?D\.?S|JR|SR|II|III|IV)\.?/g, " ");
  const words = entry.split(/[\s.\-]+/).filter(Boolean);
  const candidates = legislators.filter((l) => {
    const term = l.terms[l.terms.length - 1];
    if (term.state !== bio.state) return false;
    const last = ascii(l.name.last).split(/[\s-]+/);
    return last.every((w) => words.includes(w.replace(/\./g, "")));
  });
  if (candidates.length <= 1) return candidates[0];
  const first = (l) =>
    [l.name.first, l.name.middle, l.name.nickname]
      .filter(Boolean)
      .flatMap((n) => ascii(n).replace(/[.()]/g, " ").split(/\s+/))
      .filter(Boolean);
  return candidates.find((l) => first(l).some((f) => words.includes(f)));
}

/** What the site shows. (The name, party, and election history are on the card already.) */
const record = (bio) => ({
  hometown: bio.hometown,
  ...(bio.born ? { born: bio.born } : {}),
  education: bio.education,
  career: bio.career,
  military: bio.military,
});

const members = {};
const unmatched = [];
for (const p of paragraphs) {
  const bio = parse(p);
  if (!bio) continue;
  // The Vice President presides over the Senate and has an entry; the site's ID is fixed.
  if (ascii(bio.name).includes(VICE_PRESIDENT)) {
    members["vice-president"] = record(bio);
    continue;
  }
  const l = match(bio);
  if (!l) {
    unmatched.push(`${bio.name} (${bio.state})`);
    continue;
  }
  members[l.id.bioguide] = record(bio);
}

const out = {
  source: {
    title: summary.title,
    url: `https://www.govinfo.gov/app/details/${packageId}`,
    issued: summary.dateIssued,
  },
  members,
};
mkdirSync("src/data/bios", { recursive: true });
writeFileSync("src/data/bios/congress.json", JSON.stringify(out, null, 1) + "\n");
console.log(`${packageId}: ${Object.keys(members).length} members written; ${unmatched.length} unmatched`);
if (unmatched.length) console.log("Unmatched:", unmatched.join(", "));
const missing = legislators.filter((l) => !members[l.id.bioguide]).map((l) => `${l.name.official_full ?? l.name.last} (${l.terms.at(-1).state})`);
console.log(`Current members without a directory entry (${missing.length}):`, missing.join(", "));
