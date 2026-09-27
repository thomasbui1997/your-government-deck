// Builds src/data/executives.json: current statewide elected executives per state.
// Source: github.com/openstates/people (data/<state>/executive/*.yml), public domain.
// Run: node scripts/build-executives.mjs
import { writeFileSync } from "node:fs";
import { parse } from "yaml";

const REPO = "openstates/people";
const today = new Date().toISOString().slice(0, 10);

const TITLES = {
  governor: "Governor",
  lt_governor: "Lieutenant Governor",
  attorney_general: "Attorney General",
  secretary_of_state: "Secretary of State",
  chief_election_officer: "Secretary of State",
  treasurer: "Treasurer",
  auditor: "Auditor",
  comptroller: "Comptroller",
  controller: "Controller",
  superintendent_of_public_instruction: "Superintendent of Public Instruction",
  commissioner_of_insurance: "Insurance Commissioner",
  commissioner_of_agriculture: "Agriculture Commissioner",
  commissioner_of_labor: "Labor Commissioner",
  mayor: "Mayor",
};

const title = (rawType, state) => {
  // Role types appear both as "chief election officer" and "chief_election_officer".
  const type = rawType.toLowerCase().replace(/\s+/g, "_");
  if (state === "ma" && (type === "chief_election_officer" || type === "secretary_of_state")) {
    return "Secretary of the Commonwealth";
  }
  return TITLES[type] ?? type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
};

const tree = await (
  await fetch(`https://api.github.com/repos/${REPO}/git/trees/main?recursive=1`)
).json();
if (tree.truncated) throw new Error("GitHub tree listing was truncated");
const paths = tree.tree
  .map((t) => t.path)
  .filter((p) => /^data\/[a-z]{2}\/executive\/.+\.yml$/.test(p));

const people = await Promise.all(
  paths.map(async (path) => {
    const res = await fetch(`https://raw.githubusercontent.com/${REPO}/main/${path}`);
    if (!res.ok) throw new Error(`${res.status} for ${path}`);
    return { state: path.split("/")[1], doc: parse(await res.text()) };
  }),
);

/** @type {Record<string, any[]>} */
const byState = {};
for (const { state, doc } of people) {
  // Current = a statewide role that has started and hasn't ended.
  const role = (doc.roles ?? []).find(
    (r) =>
      r.jurisdiction?.endsWith(`state:${state}/government`) &&
      !r.district &&
      (!r.start_date || r.start_date <= today) &&
      (!r.end_date || r.end_date >= today),
  );
  if (!role || ["upper", "lower", "legislature"].includes(role.type)) continue;

  const office = doc.offices?.find((o) => o.voice) ?? doc.offices?.[0];
  (byState[state] ??= []).push({
    id: doc.id,
    name: doc.name,
    party: doc.party?.[doc.party.length - 1]?.name ?? "",
    title: title(role.type, state),
    image: doc.image,
    startDate: role.start_date,
    termEnd: role.end_date,
    phone: office?.voice,
    address: office?.address,
    website: doc.links?.[0]?.url,
    email: doc.email,
    socials: doc.ids ?? {},
  });
}

// Open States occasionally keeps a stale duplicate of an office holder; keep the latest start.
for (const [state, list] of Object.entries(byState)) {
  const byTitle = new Map();
  for (const p of list) {
    const prev = byTitle.get(p.title);
    if (!prev || (p.startDate ?? "") > (prev.startDate ?? "")) byTitle.set(p.title, p);
  }
  byState[state] = [...byTitle.values()];
}

writeFileSync(
  new URL("../src/data/executives.json", import.meta.url),
  JSON.stringify(byState, null, 1),
);
const count = Object.values(byState).reduce((n, l) => n + l.length, 0);
console.log(`${count} executives across ${Object.keys(byState).length} states (from ${paths.length} files)`);
