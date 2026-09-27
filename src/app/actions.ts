"use server";

import { redirect } from "next/navigation";
import { geocodeAddress } from "@/lib/providers/geocode";

export interface AddressLookupState {
  error?: string;
}

/**
 * Geocodes a one-line address and redirects to the deck for its districts.
 * Only district codes go in the URL; the address itself is never stored or logged.
 */
export async function lookupAddress(
  _prev: AddressLookupState,
  formData: FormData,
): Promise<AddressLookupState> {
  const address = String(formData.get("address") ?? "").trim();

  // A bare zip still works; the deck shows everyone who might represent it.
  if (/^\d{5}$/.test(address)) redirect(`/z/${address}`);

  if (address.length < 5) {
    return { error: "Enter your street address, like “10 Pearl St, Stoughton, MA”." };
  }
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
    return { error: "We couldn't find that address. Check the house number, street, and city." };
  }

  const params = new URLSearchParams();
  if (found.cd !== undefined) params.set("cd", String(found.cd));
  if (found.upper) params.set("u", found.upper);
  if (found.lower) params.set("l", found.lower);
  redirect(`/z/${found.zip}?${params}`);
}
