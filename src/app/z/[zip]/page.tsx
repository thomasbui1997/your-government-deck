import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { TierBand } from "@/components/TierBand";
import { getDeck } from "@/lib/resolve";

export default async function DeckPage(props: PageProps<"/z/[zip]">) {
  const { zip } = await props.params;
  if (!/^\d{5}$/.test(zip)) notFound();

  const deck = await getDeck(zip);
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
            <p className="mt-2 text-navy/70">Street-address lookup is coming soon.</p>
          </div>
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
