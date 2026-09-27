import Link from "next/link";
import { notFound } from "next/navigation";
import { AddressLookup } from "@/components/AddressLookup";
import { SiteHeader } from "@/components/SiteHeader";
import { TierBand } from "@/components/TierBand";
import { type DistrictPick, getDeck } from "@/lib/resolve";

const GEOID = /^\d{2}[0-9A-Z]{3}$/;

/** District codes from an address lookup, e.g. ?cd=8&u=25D33&l=25101. Bad values are dropped. */
function parsePick(params: Record<string, string | string[] | undefined>): DistrictPick {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const cd = one(params.cd);
  const u = one(params.u);
  const l = one(params.l);
  return {
    cd: cd && /^\d{1,2}$/.test(cd) ? Number(cd) : undefined,
    upper: u && GEOID.test(u) ? u : undefined,
    lower: l && GEOID.test(l) ? l : undefined,
  };
}

export default async function DeckPage(props: PageProps<"/z/[zip]">) {
  const { zip } = await props.params;
  if (!/^\d{5}$/.test(zip)) notFound();

  const deck = await getDeck(zip, parsePick(await props.searchParams));
  if (!deck) notFound();

  return (
    <>
      <SiteHeader zip={zip} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-0 py-8 sm:px-4">
        <h1 className="px-4 text-center font-display text-2xl text-navy sm:text-3xl">
          {deck.place}
        </h1>

        {deck.splits && (
          <div className="mx-4 mt-4 rounded-2xl border-4 border-navy bg-gold/40 p-4 text-center text-sm text-navy sm:mx-auto sm:max-w-xl">
            <p className="font-display">🃏 Your zip splits districts</p>
            <p className="mt-1">
              Parts of {zip} fall in different districts, so we&apos;re showing
              everyone who might represent you:
            </p>
            <ul className="mt-2 space-y-0.5 font-medium">
              {deck.splits.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
            <AddressLookup zip={zip} />
          </div>
        )}

        {deck.narrowed && !deck.splits && (
          <p className="mx-4 mt-4 rounded-full bg-emerald-100 px-4 py-1.5 text-center text-sm text-navy sm:mx-auto sm:w-fit">
            📍 Showing the officials for your street address ·{" "}
            <Link href={`/z/${zip}`} className="font-medium underline">
              use a different address
            </Link>
          </p>
        )}

        <div className="mt-8 space-y-4">
          {deck.tiers.map((tier, i) => (
            <div key={tier.id}>
              {i > 0 && (
                <div
                  className="mx-auto mb-4 h-8 w-1 rounded-full bg-navy/20"
                  aria-hidden
                />
              )}
              <TierBand tier={tier} index={i} />
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
