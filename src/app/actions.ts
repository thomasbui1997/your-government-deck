"use server";

import { redirect } from "next/navigation";
import { DEFAULT_LOCALE, isLocale, type Locale, localePath } from "@/i18n/config";
import { districtsAtPoint, geocodeAddress } from "@/lib/providers/geocode";
import { autocomplete, placeDetails, placesEnabled, tooBroad } from "@/lib/providers/places";
import { districtsForZip } from "@/lib/providers/zip";

export type AddressError =
  | "errorTooShort"
  | "errorTooShortAny"
  | "errorNeedCity"
  | "errorService"
  | "errorNotFound"
  | "errorPlaceNotFound"
  | "errorTooBroad"
  | "errorNoData";

export interface AddressLookupState {
  /** Dictionary key under `address`; the form shows it in the visitor's language. */
  error?: AddressError;
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

function deckPath(zip: string, found: { cd?: number; upper?: string; lower?: string }) {
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
  // Server actions can't read the [locale] segment, so the form sends it.
  const rawLocale = String(formData.get("locale") ?? "");
  const locale: Locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;
  const places = placesEnabled();

  // A bare zip still works; the deck shows everyone who might represent it.
  if (/^\d{5}$/.test(address)) redirect(localePath(locale, `/z/${address}`));

  if (address.length < (places ? 3 : 5)) {
    return { error: places ? "errorTooShortAny" : "errorTooShort" };
  }

  const path = places ? await lookupPlace(address, placeId, session) : await lookupCensus(address);
  if (typeof path === "object") return path;
  redirect(localePath(locale, path));
}

/** Google finds the place (forgiving of typos and partial input); Census finds its districts. */
async function lookupPlace(
  address: string,
  placeId: string,
  session: string,
): Promise<string | AddressLookupState> {
  let place, point;
  try {
    // Typed and submitted without picking a suggestion: take Google's best match. If that's a
    // whole state or county, say so rather than jumping to the first smaller place.
    let id = placeId;
    if (!id) {
      const best = (await autocomplete(address, session))[0];
      if (!best) return { error: "errorPlaceNotFound" };
      if (best.broad) return { error: "errorTooBroad" };
      id = best.placeId;
    }
    place = await placeDetails(id, session);
    if (tooBroad(place.types)) return { error: "errorTooBroad" };
    if (place.types.includes("postal_code") && place.zip && districtsForZip(place.zip)) {
      return `/z/${place.zip}`;
    }
    point = await districtsAtPoint(place.lat, place.lng);
  } catch (err) {
    console.error("place lookup failed:", (err as Error).message);
    return { error: "errorService" };
  }

  // Google's USPS zip first; the Census zip area at the point covers towns and new zips.
  const zip = [place.zip, point.zcta].find((z) => z && districtsForZip(z));
  if (!zip) return { error: "errorNoData" };
  return place.types.some((t) => PRECISE.has(t)) ? deckPath(zip, point) : `/z/${zip}`;
}

/** Fallback without a Google key: the Census Geocoder needs a full street address. */
async function lookupCensus(address: string): Promise<string | AddressLookupState> {
  if (!/\b\d{5}\b/.test(address) && !address.includes(",")) return { error: "errorNeedCity" };

  let found;
  try {
    found = await geocodeAddress(address);
  } catch {
    return { error: "errorService" };
  }
  if (!found) return { error: "errorNotFound" };
  return deckPath(found.zip, found);
}
