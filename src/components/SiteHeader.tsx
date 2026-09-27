import Link from "next/link";
import { Suspense } from "react";
import { getDictionary, href } from "@/i18n/server";
import { placesEnabled } from "@/lib/providers/places";
import { AddressInput } from "./AddressInput";
import { LanguagePicker } from "./LanguagePicker";

export async function SiteHeader() {
  const t = await getDictionary();
  return (
    <header className="sticky top-0 z-20 border-b-4 border-navy bg-cream/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-2.5">
        <Link href={await href("/")} className="font-display text-sm text-navy sm:text-base">
          {t.header.brand}
        </Link>
        <div className="flex items-center gap-2">
          <AddressInput compact placesOn={placesEnabled()} />
          {/* useSearchParams needs a Suspense boundary during prerendering. */}
          <Suspense>
            <LanguagePicker />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
