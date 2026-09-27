"use server";

import { redirect } from "next/navigation";
import { DEFAULT_LOCALE, isLocale, localePath } from "@/i18n/config";
import { geocodeAddress } from "@/lib/providers/geocode";

export type AddressError = "errorTooShort" | "errorNeedCity" | "errorService" | "errorNotFound";

export interface AddressLookupState {
  /** Dictionary key under `address`; the form shows it in the visitor's language. */
  error?: AddressError;
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
  // Server actions can't read the [locale] segment, so the form sends it.
  const rawLocale = String(formData.get("locale") ?? "");
  const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;

  // A bare zip still works; the deck shows everyone who might represent it.
  if (/^\d{5}$/.test(address)) redirect(localePath(locale, `/z/${address}`));

  if (address.length < 5) return { error: "errorTooShort" };
  if (!/\b\d{5}\b/.test(address) && !address.includes(",")) return { error: "errorNeedCity" };

  let found;
  try {
    found = await geocodeAddress(address);
  } catch {
    return { error: "errorService" };
  }
  if (!found) return { error: "errorNotFound" };

  const params = new URLSearchParams();
  if (found.cd !== undefined) params.set("cd", String(found.cd));
  if (found.upper) params.set("u", found.upper);
  if (found.lower) params.set("l", found.lower);
  redirect(localePath(locale, `/z/${found.zip}?${params}`));
}
