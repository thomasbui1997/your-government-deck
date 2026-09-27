// Promise pipeline: drafts campaign promises and their status for human review.
//
//   npm run promises -- draft <officialId>      extract new promises + assess them
//   npm run promises -- reassess <officialId>   re-check published promises' status
//
// Drafts land in data/promises/pending/<officialId>.json. Nothing is published until a
// reviewer approves it at /admin/review.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import {
  type DraftFile,
  type DraftPromise,
  EVIDENCE_KINDS,
  type PublishedPromises,
  promiseKey,
  STATUSES,
  TOPICS,
  type TrackedPromise,
} from "../../src/lib/promises";
import { type ArchivedPage, containsQuote, findCampaignPages, readArchivedPage } from "./archive";
import { costSoFar, MODEL, runToSubmit } from "./claude";

interface OfficialConfig {
  officialId: string;
  name: string;
  office: string;
  role: "executive" | "legislator";
  termStart: string;
  termEnd?: string;
  electionDate: string;
  campaignSites: { domain: string; include: string[] }[];
}

// Run from the project root (npm run promises).
const CONFIG = join(process.cwd(), "data/promises/officials.json");
const PUBLISHED = join(process.cwd(), "src/data/promises.json");
const pendingPath = (id: string) => join(process.cwd(), `data/promises/pending/${id}.json`);

const readJson = <T>(path: string, fallback: T): T =>
  existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as T) : fallback;
const today = () => new Date().toISOString().slice(0, 10);
const shortHash = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 8);

// ---- Step 1: extract promises from archived campaign pages -----------------------------

const Extracted = z.object({
  promises: z.array(
    z.object({
      text: z.string().min(10),
      topic: z.enum(TOPICS),
      quote: z.string().min(10),
      source_url: z.string(),
      kept_if: z.string(),
    }),
  ),
});

const extractedJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["promises"],
  properties: {
    promises: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["text", "topic", "quote", "source_url", "kept_if"],
        properties: {
          text: {
            type: "string",
            description: "Neutral plain-language summary starting with a verb, under 140 characters.",
          },
          topic: { type: "string", enum: [...TOPICS] },
          quote: {
            type: "string",
            description: "Words copied exactly from the page (one sentence or clause).",
          },
          source_url: { type: "string", description: "The URL of the page the quote is from, exactly as given." },
          kept_if: {
            type: "string",
            description: "What concrete outcome would count as keeping this promise.",
          },
        },
      },
    },
  },
};

const EXTRACT_SYSTEM = `You extract campaign promises for a nonpartisan government accountability website.

A promise is a specific, checkable commitment to take an action or reach an outcome: "will sign", "will invest $X in", "will create", "will expand", "will ban", "will reach 100% clean electricity by 2030". Skip values statements ("I believe in..."), criticism of opponents, biography, descriptions of past work, and aspirations too vague to check ("fight for working families").

Rules:
- Every promise needs a quote copied exactly, character for character, from the page text you are given. Copy one sentence or clause; do not stitch fragments together or fix typos.
- "text" is a neutral, plain-language summary starting with a verb, e.g. "Make community college free for residents over 25". No adjectives that praise or criticize.
- Merge duplicates that appear on several pages; keep the most specific wording and quote.
- Aim for the most significant, distinct promises: typically 15 to 35. Prefer concrete ones over broad ones.
- Skip anything listed under "Already tracked".`;

async function extract(official: OfficialConfig, pages: ArchivedPage[], known: Set<string>) {
  const pageBlocks = pages.map((p) => ({
    type: "text" as const,
    text: `<page url="${p.url}" title="${p.title}">\n${p.text}\n</page>`,
  }));
  const knownList = [...known].map((k) => `- ${k}`).join("\n") || "(none)";

  const { value } = await runToSubmit({
    label: "extract",
    system: EXTRACT_SYSTEM,
    prompt: [
      ...pageBlocks,
      {
        type: "text",
        text: `These are ${official.name}'s campaign pages for ${official.office}, archived just before the ${official.electionDate} election.\n\nAlready tracked:\n${knownList}\n\nExtract the promises and call submit_promises.`,
      },
    ],
    submitName: "submit_promises",
    submitDescription: "Submit the extracted campaign promises.",
    schema: Extracted,
    jsonSchema: extractedJsonSchema,
    web: false,
  });
  return value.promises;
}

// ---- Step 2: assess each promise's status with web research ----------------------------

const Assessed = z.object({
  assessments: z.array(
    z.object({
      promise_id: z.string(),
      status: z.enum(STATUSES),
      status_note: z.string(),
      confidence: z.enum(["low", "medium", "high"]),
      evidence: z.array(
        z.object({
          date: z.string(),
          summary: z.string(),
          url: z.string(),
          kind: z.enum(EVIDENCE_KINDS),
        }),
      ),
    }),
  ),
});

const assessedJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["assessments"],
  properties: {
    assessments: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["promise_id", "status", "status_note", "confidence", "evidence"],
        properties: {
          promise_id: { type: "string" },
          status: { type: "string", enum: [...STATUSES] },
          status_note: {
            type: "string",
            description: "One or two neutral, factual sentences explaining the status.",
          },
          confidence: { type: "string", enum: ["low", "medium", "high"] },
          evidence: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["date", "summary", "url", "kind"],
              properties: {
                date: { type: "string", description: "YYYY-MM-DD, or YYYY-MM if the day is unknown." },
                summary: { type: "string", description: "One factual sentence." },
                url: {
                  type: "string",
                  description: "A URL that appeared in your web search or web fetch results.",
                },
                kind: { type: "string", enum: [...EVIDENCE_KINDS] },
              },
            },
          },
        },
      },
    },
  },
};

function assessSystem(official: OfficialConfig) {
  const scoring =
    official.role === "executive"
      ? "Signed laws, budget line items, executive orders, and launched programs count as action. Statements, proposals, and press releases alone do not."
      : "A legislator is one vote among many: sponsoring or co-sponsoring a bill, voting for it, and moving it through committee count as action toward a promise, even if it has not passed.";
  return `You assess progress on campaign promises for a nonpartisan government accountability website. Today is ${today()}. ${official.name} has served as ${official.office} since ${official.termStart}${official.termEnd ? `; the term ends ${official.termEnd}` : ""}.

Statuses:
- kept: delivered as promised, or substantially so.
- compromise: partly delivered; a real result, but less than promised.
- in_progress: concrete action underway (bill filed or moving, money budgeted, program launching).
- stalled: action started but stopped moving or was blocked.
- not_started: no meaningful action found.
- broken: abandoned, reversed, or no longer achievable this term.

Rules:
- Research each promise with web search and web fetch. Prefer primary sources (official government sites, legislature and budget documents, official press releases), then established news outlets.
- ${scoring}
- Judge against the promise as originally worded, not a later, narrower version.
- Cite 1 to 4 pieces of evidence per promise. Every URL must be one that appeared in your search or fetch results; never construct, shorten, or guess a URL.
- Write evidence summaries and status notes as plain facts: no praise, criticism, or speculation about motives.
- If you cannot find enough to judge, use not_started with low confidence and say in the note that little evidence was found. Do not guess.`;
}

async function assess(
  official: OfficialConfig,
  items: { id: string; text: string; quote: string; keptIf?: string }[],
) {
  const { value, seenUrls } = await runToSubmit({
    label: `assess ${items.map((i) => i.id).join(",")}`,
    system: assessSystem(official),
    prompt: [
      {
        type: "text",
        text: `Assess these promises and call submit_assessments with one assessment per promise_id.\n\n${JSON.stringify(items, null, 2)}`,
      },
    ],
    submitName: "submit_assessments",
    submitDescription: "Submit one status assessment per promise.",
    schema: Assessed,
    jsonSchema: assessedJsonSchema,
    web: true,
  });
  return { assessments: value.assessments, seenUrls };
}

// ---- Commands -----------------------------------------------------------------------------

const BATCH = 4;

async function assessAll(
  official: OfficialConfig,
  items: { id: string; text: string; quote: string; keptIf?: string }[],
) {
  const results = new Map<string, z.infer<typeof Assessed>["assessments"][number] & { unseen: string[] }>();
  for (let i = 0; i < items.length; i += BATCH) {
    const batch = items.slice(i, i + BATCH);
    console.log(`  assessing ${i + 1}-${i + batch.length} of ${items.length}… ($${costSoFar().toFixed(2)} so far)`);
    const { assessments, seenUrls } = await assess(official, batch);
    for (const a of assessments) {
      results.set(a.promise_id, { ...a, unseen: a.evidence.map((e) => e.url).filter((u) => !seenUrls.has(u)) });
    }
  }
  return results;
}

function flagsFor(a: { status: string; confidence: string; evidence: unknown[]; unseen: string[] } | undefined) {
  if (!a) return ["not_assessed"];
  const flags: string[] = [];
  if (a.unseen.length) flags.push(`evidence_url_unverified:${a.unseen.join(" ")}`);
  if (!a.evidence.length && a.status !== "not_started") flags.push("no_evidence");
  if (a.confidence === "low") flags.push("low_confidence");
  return flags;
}

async function draft(official: OfficialConfig) {
  const published = readJson<Record<string, PublishedPromises>>(PUBLISHED, {})[official.officialId];
  const known = new Set([
    ...(published?.promises.map((p) => p.text) ?? []),
    ...(published?.rejected ?? []),
  ]);

  console.log(`Finding archived campaign pages for ${official.name}…`);
  const pages: ArchivedPage[] = [];
  for (const site of official.campaignSites) {
    for (const { url, timestamp } of await findCampaignPages(site.domain, official.electionDate, site.include)) {
      pages.push(await readArchivedPage(url, timestamp));
    }
  }
  if (!pages.length) throw new Error("No archived campaign pages found; check campaignSites in officials.json");
  console.log(`  ${pages.length} pages, ${pages.reduce((n, p) => n + p.text.length, 0).toLocaleString()} characters`);

  console.log("Extracting promises…");
  const knownKeys = new Set([...known].map(promiseKey));
  const extracted = (await extract(official, pages, known)).filter((p) => !knownKeys.has(promiseKey(p.text)));
  console.log(`  ${extracted.length} new promises`);

  const items = extracted.map((p, i) => ({ id: `p${i + 1}`, text: p.text, quote: p.quote, keptIf: p.kept_if }));
  console.log("Assessing status with web research…");
  const assessed = await assessAll(official, items);

  const drafts: DraftPromise[] = extracted.map((p, i) => {
    const page = pages.find((pg) => pg.url === p.source_url);
    const a = assessed.get(`p${i + 1}`);
    const flags = flagsFor(a);
    if (!page) flags.push("unknown_source_page");
    else if (!containsQuote(page.text, p.quote)) flags.push("quote_not_found_on_page");
    return {
      draftId: `d-${shortHash(p.text)}`,
      text: p.text,
      topic: p.topic,
      quote: p.quote,
      source: {
        url: page?.archiveUrl ?? p.source_url,
        title: page?.title ?? p.source_url,
        date: page ? `${page.timestamp.slice(0, 4)}-${page.timestamp.slice(4, 6)}-${page.timestamp.slice(6, 8)}` : "",
      },
      status: a?.status ?? "not_started",
      statusNote: a?.status_note ?? "",
      evidence: a?.evidence ?? [],
      confidence: a?.confidence ?? "low",
      flags,
    };
  });
  return drafts;
}

async function reassess(official: OfficialConfig) {
  const published = readJson<Record<string, PublishedPromises>>(PUBLISHED, {})[official.officialId];
  if (!published?.promises.length) throw new Error("Nothing published yet for this official");
  const byId = new Map<string, TrackedPromise>(published.promises.map((p) => [p.id, p]));

  console.log(`Re-assessing ${byId.size} published promises…`);
  const assessed = await assessAll(
    official,
    published.promises.map((p) => ({ id: p.id, text: p.text, quote: p.quote })),
  );

  // Only surface promises whose status actually changed; the rest need no review.
  return [...byId.values()].flatMap((p): DraftPromise[] => {
    const a = assessed.get(p.id);
    if (!a || a.status === p.status) return [];
    return [
      {
        draftId: `d-${shortHash(`${p.id}:${a.status}:${today()}`)}`,
        updatesId: p.id,
        text: p.text,
        topic: p.topic,
        quote: p.quote,
        source: p.source,
        status: a.status,
        statusNote: a.status_note,
        evidence: a.evidence,
        confidence: a.confidence,
        flags: flagsFor(a),
      },
    ];
  });
}

async function main() {
  const [command, officialId] = process.argv.slice(2);
  const officials = readJson<OfficialConfig[]>(CONFIG, []);
  const official = officials.find((o) => o.officialId === officialId);
  if (!["draft", "reassess"].includes(command) || !official) {
    console.error("Usage: npm run promises -- <draft|reassess> <officialId>\n\nConfigured officials:");
    for (const o of officials) console.error(`  ${o.officialId}  ${o.name}`);
    process.exit(1);
  }

  const pending = pendingPath(official.officialId);
  const existing = readJson<DraftFile | null>(pending, null);
  if (existing?.drafts.length && !process.argv.includes("--force")) {
    console.error(`${existing.drafts.length} drafts are still awaiting review in ${pending}. Review them first, or pass --force to replace them.`);
    process.exit(1);
  }

  const drafts = command === "draft" ? await draft(official) : await reassess(official);
  const file: DraftFile = {
    officialId: official.officialId,
    name: official.name,
    generatedAt: new Date().toISOString(),
    model: MODEL,
    drafts,
  };
  writeFileSync(pending, `${JSON.stringify(file, null, 2)}\n`);

  const flagged = drafts.filter((d) => d.flags.length).length;
  console.log(`\nWrote ${drafts.length} drafts (${flagged} flagged) to ${pending}`);
  console.log(`Estimated API cost: $${costSoFar().toFixed(2)}`);
  console.log("Review them at http://localhost:3417/admin/review");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
