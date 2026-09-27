import "server-only";

// Census Geocoder: free, no key. The ACS2025 vintage carries the 119th Congress and 2024
// state legislative lines, matching sitting officials and src/data/zips.json.
// When the 120th Congress is seated (Jan 3, 2027), switch to "Current_Current" and
// rebuild zips.json with the new relationship files.
const ENDPOINT = "https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress";
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

interface GeocodeResponse {
  result: {
    addressMatches: {
      addressComponents: { zip: string; state: string };
      geographies: Record<string, Geography[]>;
    }[];
  };
}

/** Layer names include the plan year ("119th ...", "2024 ..."), so match on the suffix. */
function layer(geos: Record<string, Geography[]>, suffix: RegExp) {
  const key = Object.keys(geos).find((k) => suffix.test(k));
  return key ? geos[key][0]?.GEOID : undefined;
}

export async function geocodeAddress(address: string): Promise<AddressDistricts | null> {
  const url = new URL(ENDPOINT);
  url.search = new URLSearchParams({
    address,
    benchmark: "Public_AR_Current",
    vintage: VINTAGE,
    format: "json",
  }).toString();

  // Addresses are personal data: never cache the request or its result.
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Census Geocoder ${res.status}`);
  const data: GeocodeResponse = await res.json();

  const match = data.result.addressMatches[0];
  if (!match) return null;
  const geos = match.geographies;

  const cdGeoid = layer(geos, /Congressional Districts$/);
  const cdNum = cdGeoid ? Number(cdGeoid.slice(2)) : undefined;
  return {
    zip: match.addressComponents.zip,
    state: match.addressComponents.state,
    // "98" = non-voting delegate (e.g. DC); treated like at-large.
    cd: cdNum === 98 ? 0 : cdNum,
    upper: layer(geos, /State Legislative Districts - Upper$/),
    lower: layer(geos, /State Legislative Districts - Lower$/),
  };
}
