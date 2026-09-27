import "server-only";

// Google Places API (New). Needs GOOGLE_MAPS_API_KEY with "Places API (New)" enabled.
// The key stays on the server: the browser talks to /api/places, never to Google.
// Autocomplete calls that share a session token with the Place Details call that ends
// them are billed as one session, so pass the same token through.
const BASE = "https://places.googleapis.com/v1";

export function placesEnabled() {
  return Boolean(process.env.GOOGLE_MAPS_API_KEY);
}

export interface Suggestion {
  placeId: string;
  /** "20 Robichau Cir" */
  main: string;
  /** "Stoughton, MA, USA" */
  secondary: string;
  /** A whole state, county, or country: too big to stand for one person's districts. */
  broad: boolean;
}

export interface Place {
  lat: number;
  lng: number;
  /** "street_address", "postal_code", "locality", ... */
  types: string[];
  zip?: string;
  state?: string;
}

// Too big to stand for one person's districts.
const TOO_BROAD = new Set([
  "country",
  "administrative_area_level_1",
  "administrative_area_level_2",
]);

export const tooBroad = (types: string[] = []) => types.some((t) => TOO_BROAD.has(t));

async function google<T>(path: string, init: RequestInit, fieldMask?: string): Promise<T> {
  const res = await fetch(`${BASE}/${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": process.env.GOOGLE_MAPS_API_KEY!,
      ...(fieldMask && { "X-Goog-FieldMask": fieldMask }),
    },
    // What people type is personal data: never cache it.
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Google Places ${res.status}: ${await res.text()}`);
  return res.json();
}

interface AutocompleteResponse {
  suggestions?: {
    placePrediction?: {
      placeId: string;
      types?: string[];
      text: { text: string };
      structuredFormat?: { mainText: { text: string }; secondaryText?: { text: string } };
    };
  }[];
}

/** US places matching partial input, best first. Broad ones are flagged, not dropped. */
export async function autocomplete(input: string, sessionToken: string): Promise<Suggestion[]> {
  const data = await google<AutocompleteResponse>("places:autocomplete", {
    method: "POST",
    body: JSON.stringify({ input, sessionToken, includedRegionCodes: ["us"] }),
  });
  return (data.suggestions ?? []).flatMap(({ placePrediction: p }) =>
    p
      ? [
          {
            placeId: p.placeId,
            main: p.structuredFormat?.mainText.text ?? p.text.text,
            secondary: p.structuredFormat?.secondaryText?.text ?? "",
            broad: tooBroad(p.types),
          },
        ]
      : [],
  );
}

interface DetailsResponse {
  location: { latitude: number; longitude: number };
  types?: string[];
  addressComponents?: { shortText: string; types: string[] }[];
}

export async function placeDetails(placeId: string, sessionToken: string): Promise<Place> {
  const params = new URLSearchParams({ sessionToken });
  const data = await google<DetailsResponse>(
    `places/${encodeURIComponent(placeId)}?${params}`,
    { method: "GET" },
    "location,types,addressComponents",
  );
  const component = (type: string) =>
    data.addressComponents?.find((c) => c.types.includes(type))?.shortText;
  return {
    lat: data.location.latitude,
    lng: data.location.longitude,
    types: data.types ?? [],
    zip: component("postal_code"),
    state: component("administrative_area_level_1"),
  };
}
