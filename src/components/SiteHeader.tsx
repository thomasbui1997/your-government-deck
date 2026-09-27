import Link from "next/link";
import { AddressInput } from "./AddressInput";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b-4 border-navy bg-cream/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5">
        <Link href="/" className="font-display text-sm text-navy sm:text-base">
          ★ Your Government Deck ★
        </Link>
        <AddressInput compact />
      </div>
    </header>
  );
}
