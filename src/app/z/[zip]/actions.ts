"use server";

import { redirect } from "next/navigation";
import { geocodeAddress } from "@/lib/providers/geocode";

export interface AddressLookupState {
  error?: string;
}

/**
 * Geocodes a street address and redirects to the deck narrowed to its districts.
 * Only district codes go in the URL; the address itself is never stored or logged.
 */
export async function lookupAddress(
  _prev: AddressLookupState,
  formData: FormData,
): Promise<AddressLookupState> {
  const zip = String(formData.get("zip") ?? "");
  const street = String(formData.get("address") ?? "").trim();
  if (street.length < 5) return { error: "Enter your street address, like “10 Pearl St”." };
  if (!/^\d{5}$/.test(zip)) return { error: "Something went wrong. Try reloading the page." };

  // People usually type just the street; the zip we already have completes it.
  const address = /\b\d{5}\b/.test(street) ? street : `${street}, ${zip}`;

  let found;
  try {
    found = await geocodeAddress(address);
  } catch {
    return { error: "The Census address service didn't answer. Try again in a moment." };
  }
  if (!found) {
    return { error: "We couldn't find that address. Check the house number and street name." };
  }

  const params = new URLSearchParams();
  if (found.cd !== undefined) params.set("cd", String(found.cd));
  if (found.upper) params.set("u", found.upper);
  if (found.lower) params.set("l", found.lower);
  redirect(`/z/${found.zip}?${params}`);
}
