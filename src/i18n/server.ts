import { locale as localeParam } from "next/root-params";
import { notFound } from "next/navigation";
import { type Locale, isLocale, localePath } from "./config";
import { ar } from "./dictionaries/ar";
import { type Dictionary, en } from "./dictionaries/en";
import { es } from "./dictionaries/es";
import { ko } from "./dictionaries/ko";
import { tl } from "./dictionaries/tl";
import { vi } from "./dictionaries/vi";
import { zhHans } from "./dictionaries/zh-hans";
import { zhHant } from "./dictionaries/zh-hant";

const DICTIONARIES: Record<Locale, Dictionary> = {
  en,
  es,
  "zh-hans": zhHans,
  "zh-hant": zhHant,
  vi,
  tl,
  ko,
  ar,
};

/** The current request's locale, from the [locale] root segment. */
export async function getLocale(): Promise<Locale> {
  const value = await localeParam();
  if (!isLocale(value)) notFound();
  return value;
}

export async function getDictionary(): Promise<Dictionary> {
  return DICTIONARIES[await getLocale()];
}

export function dictionaryFor(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}

/** Prefixes a path with the current locale, for server components. */
export async function href(path: string) {
  return localePath(await getLocale(), path);
}
