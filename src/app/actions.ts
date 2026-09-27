"use server";

import { redirect } from "next/navigation";
import { districtsAtPoint, geocodeAddress } from "@/lib/providers/geocode";
import {
  autocomplete,
  placeDetails,
  placesEnabled,
  tooBroad,
} from "@/lib/providers/places";
import { districtsForZip } from "@/lib/providers/zip";

export interface AddressLookupState {
  error?: string;
}

// Place types that sit inside one set of districts. A town or street can span several,
// so those get the zip deck, which lists everyone who might represent it.
const PRECISE = new Set([
  "street_address",
  "premise",
  "subpremise",
  "establishment",
  "point_of_interest",
]);

function deckUrl(zip: string, found: { cd?: number; upper?: string; lower?: string }) {
  const params = new URLSearchParams();
  if (found.cd !== undefined) params.set("cd", String(found.cd));
  if (found.upper) params.set("u", found.upper);
  if (found.lower) params.set("l", found.lower);
  return params.size ? `/z/${zip}?${params}` : `/z/${zip}`;
}

/**
 * Resolves a street address, zip, or town to the deck for its districts.
 * Only district codes go in the URL; the address itself is never stored or logged.
 */
export async function lookupAddress(
  _prev: AddressLookupState,
  formData: FormData,
): Promise<AddressLookupState> {
  const address = String(formData.get("address") ?? "").trim();
  const placeId = String(formData.get("placeId") ?? "");
  const token = String(formData.get("session") ?? "");
  const session = /^[\w-]{8,64}$/.test(token) ? token : crypto.randomUUID();

  // A bare zip still works; the deck shows everyone who might represent it.
  if (/^\d{5}$/.test(address)) redirect(`/z/${address}`);

  if (address.length < 3) {
    return { error: "Enter your address, zip, or town, like “Stoughton, MA”." };
  }

  const url = placesEnabled()
    ? await lookupPlace(address, placeId, session)
    : await lookupCensus(address);
  if (typeof url === "object") return url;
  redirect(url);
}

/** Google finds the place (forgiving of typos and partial input); Census finds its districts. */
async function lookupPlace(
  address: string,
  placeId: string,
  session: string,
): Promise<string | AddressLookupState> {
  let place, point;
  try {
    // Typed and submitted without picking a suggestion: take Google's best match.
    const id = placeId || (await autocomplete(address, session))[0]?.placeId;
    if (!id) {
      return { error: "We couldn't find that place. Try a street address, zip, or town." };
    }
    place = await placeDetails(id, session);
    if (tooBroad(place.types)) {
      return { error: "That's a whole state or county. Narrow it to a town, zip, or street address." };
    }
    if (place.types.includes("postal_code") && place.zip && districtsForZip(place.zip)) {
      return `/z/${place.zip}`;
    }
    point = await districtsAtPoint(place.lat, place.lng);
  } catch (err) {
    console.error("place lookup failed:", (err as Error).message);
    return { error: "The address service didn't answer. Try again in a moment." };
  }

  // Google's USPS zip first; the Census zip area at the point covers towns and new zips.
  const zip = [place.zip, point.zcta].find((z) => z && districtsForZip(z));
  if (!zip) {
    return { error: "We don't have district data for that area yet. Try a nearby zip." };
  }
  return place.types.some((t) => PRECISE.has(t)) ? deckUrl(zip, point) : `/z/${zip}`;
}

/** Fallback without a Google key: the Census Geocoder needs a full street address. */
async function lookupCensus(address: string): Promise<string | AddressLookupState> {
  if (!/\b\d{5}\b/.test(address) && !address.includes(",")) {
    return { error: "Add your city and state (or zip) after the street." };
  }

  let found;
  try {
    found = await geocodeAddress(address);
  } catch {
    return { error: "The Census address service didn't answer. Try again in a moment." };
  }
  if (!found) {
    return {
      error: "We couldn't find that address. Check the house number and street, or enter your zip.",
    };
  }
  return deckUrl(found.zip, found);
}
