import "server-only";

// Census Geocoder: free, no key. The ACS2025 vintage carries the 119th Congress and 2024
// state legislative lines, matching sitting officials and src/data/zips.json.
// When the 120th Congress is seated (Jan 3, 2027), switch to "Current_Current" and
// rebuild zips.json with the new relationship files.
const BASE = "https://geocoding.geo.census.gov/geocoder/geographies";
const VINTAGE = "ACS2025_Current";

export interface AddressDistricts {
  zip: string;
  state: string;
  /** Congressional district number; 0 = at-large or delegate. */
  cd?: number;
  /** Census GEOIDs of the state legislative districts, e.g. "25D33" and "25101". */
  upper?: string;
  lower?: string;
}

interface Geography {
  GEOID: string;
}

type Geographies = Record<string, Geography[]>;

interface AddressResponse {
  result: {
    addressMatches: {
      addressComponents: { zip: string; state: string };
      geographies: Geographies;
    }[];
  };
}

interface PointResponse {
  result: { geographies: Geographies };
}

/** Layer names include the plan year ("119th ...", "2024 ..."), so match on the suffix. */
function layer(geos: Geographies, suffix: RegExp) {
  const key = Object.keys(geos).find((k) => suffix.test(k));
  return key ? geos[key][0]?.GEOID : undefined;
}

function districts(geos: Geographies) {
  const cdGeoid = layer(geos, /Congressional Districts$/);
  const cdNum = cdGeoid ? Number(cdGeoid.slice(2)) : undefined;
  return {
    // "98" = non-voting delegate (e.g. DC); treated like at-large.
    cd: cdNum === 98 ? 0 : cdNum,
    upper: layer(geos, /State Legislative Districts - Upper$/),
    lower: layer(geos, /State Legislative Districts - Lower$/),
  };
}

async function census<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE}/${path}`);
  url.search = new URLSearchParams({
    ...params,
    benchmark: "Public_AR_Current",
    vintage: VINTAGE,
    format: "json",
  }).toString();

  // Addresses are personal data: never cache the request or its result.
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Census Geocoder ${res.status}`);
  return res.json();
}

export async function geocodeAddress(address: string): Promise<AddressDistricts | null> {
  const data = await census<AddressResponse>("onelineaddress", { address });
  const match = data.result.addressMatches[0];
  if (!match) return null;
  return {
    zip: match.addressComponents.zip,
    state: match.addressComponents.state,
    ...districts(match.geographies),
  };
}

export interface PointDistricts extends Omit<AddressDistricts, "zip" | "state"> {
  /** ZIP Code Tabulation Area containing the point; usually the USPS zip. */
  zcta?: string;
}

/** Districts containing a lat/lng, e.g. from a Google Places result. */
export async function districtsAtPoint(lat: number, lng: number): Promise<PointDistricts> {
  const data = await census<PointResponse>("coordinates", {
    x: String(lng),
    y: String(lat),
    layers: "all",
  });
  const geos = data.result.geographies;
  return { zcta: layer(geos, /ZIP Code Tabulation Areas$/), ...districts(geos) };
}
