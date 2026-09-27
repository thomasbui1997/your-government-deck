<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Your Government Deck

Enter an address or zip → every elected official who represents you, President down to
school committee, as trading cards; profiles show votes, bills, meetings, posts, a
campaign-promise tracker, and (for Congress) every election they've run and who paid for it.
Next.js 16 (App Router) + TypeScript + Tailwind v4. Live at
github.com/thomasbui1997/your-government-deck.

## Commands

- `npm run dev -- -p 3417` / `npm run build` / `npm run lint`
- `node scripts/build-zip-districts.mjs` → `src/data/zips.json` (zip → congressional + state
  legislative districts, from Census ZCTA relationship files)
- `node scripts/build-executives.mjs` → `src/data/executives.json` (statewide officials,
  from the openstates/people repo)
- `node scripts/build-ma-results.mjs` → `src/data/results/ma.json` (official vote counts for
  every MA U.S. House/Senate primary, general, and special since 2000, from electionstats)
- `npm run promises -- draft|reassess <officialId>` → drafts in `data/promises/pending/`;
  needs `ANTHROPIC_API_KEY` and costs real money. Has never been run.

Keys live in `.env.local` (git-ignored): `CONGRESS_API_KEY` (an api.data.gov key; the FEC API
uses it too unless `FEC_API_KEY` is set), `OPENSTATES_API_KEY`,
`GOOGLE_MAPS_API_KEY` (optional: address autocomplete; without it the box takes a
street address or zip via the free Census Geocoder).

## Where things live

- `src/app/[locale]/…`: every page is under a locale segment. `src/proxy.ts` redirects
  unprefixed URLs (cookie, then Accept-Language) and must keep skipping `api/`.
- `src/lib/resolve.ts`: builds decks (`getDeck`) and profiles (`getProfile`) from providers.
- `src/lib/providers/`: one file per source (congress, senate XML votes, legislators,
  openstates, zip, geocode, places, local, agendaCenter, bluesky).
- `src/data/local/<place>.json`: hand-curated local officials. Only Stoughton, MA (02072).
- `src/i18n/`: config, dictionaries (en is the type source), server/client helpers.
- Campaign money: `src/lib/providers/fec.ts` (FEC API), `src/lib/providers/results.ts`
  (official results files), `src/lib/campaigns.ts` (races, outcomes, deck ballot badges).
  UI: `MoneyPanel` on profiles, `/[locale]/official/[id]/elections?race=<fecId>-<year>`
  (`ElectionCard`, shared bars in `CampaignMoney.tsx`), methodology `#money`.
- Promise tracker: `src/lib/promises.ts` (model), `src/data/promises.json` (published, empty),
  `/[locale]/admin/review` (local-only review UI; 404 in production), `/methodology`.

## Data sources (what each is for)

- Congress.gov API: who holds each seat, bills, House roll calls. senate.gov XML: Senate votes.
- unitedstates/congress-legislators (raw GitHub): term ends, nicknames, LIS IDs, social handles.
  `theunitedstates.io` is down; use the raw.githubusercontent.com mirror for photos.
- Open States: legislators via bulk CSV (`data.openstates.org/people/current/<st>.csv`, no
  rate limit); the API (10 req/min) only for profile bills. MA has no roll-call votes there.
- Census Geocoder (`ACS2025_Current` vintage = 119th Congress + 2024 state lines).
- Stoughton Agenda Center (CivicPlus) for Select Board / School Committee meetings.
- FEC API (api.open.fec.gov, 1,000 req/hour/key): campaign totals per election
  (`election_full=true`), donor-size buckets, independent expenditures, PAC gifts. Members'
  FEC candidate IDs come from congress-legislators (`id.fec`).
- Massachusetts PD43+ (electionstats.state.ma.us): official vote counts. Other states show
  money without results until someone adds a `build-<state>-results` script.
- Bluesky public API: posts only from handles equal to the official's website domain
  (domain-verified). X and Meta APIs are paid/gated, so those are link-outs only.

## Conventions

- **Accuracy over coverage.** Real people's names, terms, and statuses must come from an
  official source recorded alongside the data. Leave a field blank rather than guess, and
  mark anything uncertain. Never publish invented promise statuses, stats, or photos.
- **i18n:** no hard-coded UI text. Add a key to `en.ts` and all 7 other dictionaries
  (es, zh-hans, zh-hant, vi, tl, ko, ar). The data layer returns keys/English titles;
  components translate (`officeTitle`, `tierTitle`). Official records (bill titles, votes,
  promise text, posts) stay English and get `lang="en"`. Server actions can't read the
  locale segment, so they return unprefixed paths and the client adds it with `href()`.
- **RTL:** Arabic is `dir="rtl"`. Use logical classes (`ms-/me-/ps-/pe-/start-/end-/text-start`),
  never `left-/right-/ml-/mr-`. Directional glyphs get `rtl:-scale-x-100`.
- **Privacy:** addresses never go in URLs (only district codes: `?cd=&u=&l=`), are never
  cached (`cache: "no-store"`) or logged. The last deck path is kept in a `deck` cookie (so
  `/<locale>` redirects there in `proxy.ts`; `?new` skips it) and the typed address only in
  the browser's localStorage (`src/lib/savedDeck.ts`), for the header to show.
- Promise drafts are AI-generated and must be approved by a person before publishing.

## Gotchas we hit

- Next 16: `params`/`searchParams` are Promises; `middleware` is `proxy.ts`; `error.tsx`
  gets `retry`; `next/font` loaders must each be a module-level `const`.
- Pages that stream (they have `loading.tsx`) return 200 + `noindex` from `notFound()`, not 404.
- The Census/Open States district names differ; `districtKey()` normalizes them.
- In zsh, don't name a variable `path` (it clobbers `$PATH`).
- Many Stoughton PDFs are scans: `brew install poppler`, then read pages as images.
- FEC traps: PAC gifts must be filtered to Form 3 line `F3-11C` (plain `is_individual=false`
  returns floods of ActBlue conduit memos). A candidate's `/history` stops at the current
  cycle, so a Senate race years out reuses the latest seat. One committee can span a
  member's House and Senate careers; Senate PAC totals start at the race's coverage date.
  Presidential totals (Trump's show $3.9M for 2024) miss the general-election committees,
  so presidential money isn't shown.
- Results say "Stephen F. Lynch", the FEC says "LYNCH, STEPHEN F": `sameCandidate()` matches
  last name + first initial.

## Dates when data goes stale

- **After Nov 3, 2026:** update `src/data/local/stoughton-ma.json` (DA, Commissioner Collins,
  County Treasurer, Register of Probate, Governor's Councillor were on the ballot), rerun
  `build-executives.mjs`, and rerun `build-ma-results.mjs` once MA certifies the general.
- **Jan 3, 2027 (120th Congress):** switch the geocoder vintage to `Current_Current` and
  rebuild `zips.json` with the new CD/SLD relationship files.

## Open work

- Promise tracker has no published data yet.
- Campaign money is federal only (House, Senate); state/local finance (MA OCPF) and
  presidential money are next. Ballot badges only on members of Congress.
- Not yet checked in a real browser: mobile layout, the autocomplete dropdown.
- Translations are machine-quality; get native-speaker review.
- Local officials exist only for Stoughton; other places show "coming soon".
- Other agents work in `.claude/worktrees/` (ignored by git and lint); merge their branches
  onto the `[locale]` layout and translated components.
