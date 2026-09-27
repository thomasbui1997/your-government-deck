import { ZipInput } from "@/components/ZipInput";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-16 text-center">
      <div className="flex -space-x-10" aria-hidden>
        {["-rotate-12", "rotate-0 -translate-y-3", "rotate-12"].map((r, i) => (
          <div
            key={i}
            className={`card-frame h-36 w-26 rounded-xl p-1 shadow-lg ${r}`}
          >
            <div className="flex h-full items-center justify-center rounded-lg bg-navy font-display text-3xl text-gold">
              ★
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <h1 className="font-display text-4xl leading-tight text-navy sm:text-6xl">
          Your Government Deck
        </h1>
        <p className="mx-auto max-w-md text-lg text-navy/75">
          Every official who represents you, from the President to your school
          committee, and whether they&apos;re keeping their promises.
        </p>
      </div>

      <ZipInput />
      <p className="text-sm text-navy/50">Try 02072 (Stoughton, MA)</p>
    </main>
  );
}
