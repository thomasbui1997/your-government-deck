"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/i18n/client";
import { LOCALE_INFO, LOCALES, type Locale } from "@/i18n/config";

/** Swaps the locale segment of the current URL, keeping the rest (and any query). */
export function LanguagePicker() {
  const { locale, t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams().toString();

  function change(next: Locale) {
    const rest = pathname.split("/").slice(2).join("/");
    router.push(`/${next}${rest ? `/${rest}` : ""}${search ? `?${search}` : ""}`);
  }

  return (
    <label className="relative flex items-center">
      <span className="sr-only">{t.header.language}</span>
      <span aria-hidden className="pointer-events-none absolute start-2 text-sm">
        🌐
      </span>
      <select
        value={locale}
        onChange={(e) => change(e.target.value as Locale)}
        className="appearance-none rounded-xl border-4 border-navy bg-white py-1 ps-7 pe-2 text-sm text-navy focus:border-gold focus:outline-none"
      >
        {LOCALES.map((l) => (
          <option key={l} value={l} lang={LOCALE_INFO[l].htmlLang}>
            {LOCALE_INFO[l].name}
          </option>
        ))}
      </select>
    </label>
  );
}
