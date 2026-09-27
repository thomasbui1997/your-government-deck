"use client";

import { createContext, type ReactNode, useContext } from "react";
import { type Locale, LOCALE_INFO, localePath } from "./config";
import type { ClientDictionary } from "./dictionaries/en";

const I18nContext = createContext<{ locale: Locale; t: ClientDictionary } | null>(null);

export function I18nProvider({
  locale,
  t,
  children,
}: {
  locale: Locale;
  t: ClientDictionary;
  children: ReactNode;
}) {
  return <I18nContext.Provider value={{ locale, t }}>{children}</I18nContext.Provider>;
}

/** Current locale, its strings, and a helper to build locale-prefixed links. */
export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return {
    ...ctx,
    htmlLang: LOCALE_INFO[ctx.locale].htmlLang,
    href: (path: string) => localePath(ctx.locale, path),
  };
}
