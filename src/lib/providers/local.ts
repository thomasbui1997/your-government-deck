import "server-only";
import stoughton from "@/data/local/stoughton-ma.json";
import type { Level, Official, OfficialBio, Party, Tier, TierId } from "@/lib/types";

// Hand-curated local officials, one JSON file per place in src/data/local/. Every entry
// names its sources; `checked` is when the whole file was last verified.

interface LocalOfficial {
  slug: string;
  name: string;
  office: string;
  role?: "chair" | "viceChair";
  jurisdiction: string;
  party: Party;
  termEnds?: string;
  email?: string;
  phone?: string;
  /** The official's or office's page on an official site. */
  website?: string;
  /** Office address. (`office` is the title.) */
  address?: string;
  /** Headshot from an official site, hot-linked; `source` is a key into `sources`. */
  photo?: { url: string; source: string };
  /**
   * Biography from one official page (`source` is a key into `sources`). `summary` is quoted
   * verbatim, whole sentences only; the lists hold only what that same page states outright.
   */
  bio?: {
    source: string;
    summary?: string;
    hometown?: string;
    education?: string[];
    career?: string[];
    military?: string[];
  };
  appointed?: boolean;
  /** Agenda Center category whose meetings this official takes part in. */
  meetings?: number;
  sources: string[];
}

interface LocalPlace {
  id: string;
  place: string;
  state: string;
  zips: string[];
  checked: string;
  agendaCenter?: string;
  sources: Record<string, { title: string; url: string }>;
  stateOfficials: LocalOfficial[];
  tiers: { id: TierId; level: Level; title: string; officials: LocalOfficial[] }[];
}

const PLACES = [stoughton] as unknown as LocalPlace[];

const LOCAL_PREFIX = "local-";
const localId = (place: LocalPlace, slug: string) => `${LOCAL_PREFIX}${place.id}--${slug}`;

function toOfficial(place: LocalPlace, o: LocalOfficial): Official {
  return {
    id: localId(place, o.slug),
    name: o.name,
    office: o.office,
    jurisdiction: o.jurisdiction,
    party: o.party,
    photoUrl: o.photo?.url,
    role: o.role,
    termEnds: o.termEnds,
    appointed: o.appointed,
    stats: [],
  };
}

function toBio(place: LocalPlace, o: LocalOfficial): OfficialBio | undefined {
  const source = o.bio && place.sources[o.bio.source];
  if (!o.bio || !source) return undefined;
  return {
    summary: o.bio.summary,
    hometown: o.bio.hometown,
    education: o.bio.education ?? [],
    career: o.bio.career ?? [],
    military: o.bio.military ?? [],
    sources: [source],
  };
}

export function placeForZip(zip: string): LocalPlace | null {
  return PLACES.find((p) => p.zips.includes(zip)) ?? null;
}

/** County, town, and school tiers for a zip in a curated place. */
export function localTiers(zip: string): Tier[] | null {
  const place = placeForZip(zip);
  if (!place) return null;
  return place.tiers.map((t) => ({
    id: t.id,
    level: t.level,
    label: { text: t.title },
    officials: t.officials.map((o) => toOfficial(place, o)),
  }));
}

/** State offices our other sources don't cover, e.g. the MA Governor's Council. */
export function localStateOfficials(zip: string): Official[] {
  const place = placeForZip(zip);
  return place ? place.stateOfficials.map((o) => toOfficial(place, o)) : [];
}

export function isLocalId(id: string) {
  return id.startsWith(LOCAL_PREFIX);
}

export function findLocalOfficial(id: string) {
  for (const place of PLACES) {
    const all = [
      ...place.stateOfficials.map((o) => ({ o, tier: null as string | null })),
      ...place.tiers.flatMap((t) => t.officials.map((o) => ({ o, tier: t.title as string | null }))),
    ];
    const hit = all.find(({ o }) => localId(place, o.slug) === id);
    if (hit) {
      return {
        place,
        official: toOfficial(place, hit.o),
        tierTitle: hit.tier,
        contact: {
          website: hit.o.website,
          phone: hit.o.phone,
          email: hit.o.email,
          office: hit.o.address,
        },
        meetings: hit.o.meetings,
        bio: toBio(place, hit.o),
        sources: [
          ...new Set([
            ...hit.o.sources,
            ...(hit.o.photo ? [hit.o.photo.source] : []),
            ...(hit.o.bio ? [hit.o.bio.source] : []),
          ]),
        ]
          .map((key) => place.sources[key])
          .filter(Boolean),
      };
    }
  }
  return null;
}
