// Locale settings shared by the proxy, server components, and client components.

export const LOCALES = ["en", "es", "zh-hans", "zh-hant", "vi", "tl", "ko", "ar"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "NEXT_LOCALE";

export const LOCALE_INFO: Record<Locale, { name: string; htmlLang: string; dir: "ltr" | "rtl" }> = {
  en: { name: "English", htmlLang: "en", dir: "ltr" },
  es: { name: "Español", htmlLang: "es", dir: "ltr" },
  "zh-hans": { name: "简体中文", htmlLang: "zh-Hans", dir: "ltr" },
  "zh-hant": { name: "繁體中文", htmlLang: "zh-Hant", dir: "ltr" },
  vi: { name: "Tiếng Việt", htmlLang: "vi", dir: "ltr" },
  tl: { name: "Tagalog", htmlLang: "tl", dir: "ltr" },
  ko: { name: "한국어", htmlLang: "ko", dir: "ltr" },
  ar: { name: "العربية", htmlLang: "ar", dir: "rtl" },
};

export function isLocale(value: string | undefined): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}

/** Prefixes an app path with the locale: ("es", "/z/02072") → "/es/z/02072". */
export function localePath(locale: Locale, path: string) {
  return path === "/" ? `/${locale}` : `/${locale}${path}`;
}

/** Maps one BCP 47 tag from Accept-Language to a supported locale, if any. */
function matchTag(tag: string): Locale | undefined {
  const t = tag.toLowerCase();
  if (t.startsWith("zh")) {
    // Traditional script: explicit Hant, or regions that use it.
    return /hant|-tw|-hk|-mo/.test(t) ? "zh-hant" : "zh-hans";
  }
  const base = t.split("-")[0];
  if (base === "fil") return "tl";
  return isLocale(base) ? base : undefined;
}

/** Picks the best supported locale from an Accept-Language header. */
export function negotiateLocale(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;
  const ranked = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.find((p) => p.trim().startsWith("q="));
      return { tag, q: q ? Number(q.trim().slice(2)) : 1 };
    })
    .filter((x) => x.tag && x.q > 0)
    .sort((a, b) => b.q - a.q);
  for (const { tag } of ranked) {
    const match = matchTag(tag);
    if (match) return match;
  }
  return DEFAULT_LOCALE;
}

/** Fills {placeholders}: format("Hi {name}", { name: "Ana" }) → "Hi Ana". */
export function format(template: string, vars: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (m, key) => (key in vars ? String(vars[key]) : m));
}
