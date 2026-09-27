// Placeholder UI shown while a deck or profile loads: face-down cards that pulse.

export function CardBack({ size = "deck" }: { size?: "deck" | "hero" }) {
  return (
    <div
      className={`card-frame ${size === "hero" ? "w-80" : "w-60"} shrink-0 animate-pulse rounded-2xl p-1.5 shadow-lg`}
      aria-hidden
    >
      <div className="flex aspect-[5/7] items-center justify-center rounded-xl bg-navy font-display text-4xl text-gold/40">
        ★
      </div>
    </div>
  );
}

function Bar({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-full bg-navy/10 ${className}`} aria-hidden />;
}

export function DeckSkeleton() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-0 py-8 sm:px-4" aria-busy>
      <Bar className="mx-auto h-8 w-64" />
      <div className="mt-10 space-y-12">
        {[2, 3, 4].map((n, i) => (
          <section key={i}>
            <Bar className="mx-auto h-7 w-48" />
            <div className="mt-6 flex justify-center gap-5 overflow-hidden px-4">
              {Array.from({ length: n }, (_, j) => (
                <CardBack key={j} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}

export function ProfileSkeleton() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10" aria-busy>
      <div className="flex flex-col items-center gap-10 md:flex-row md:items-start">
        <CardBack size="hero" />
        <div className="w-full flex-1 space-y-4">
          <Bar className="h-4 w-40" />
          <Bar className="h-9 w-72" />
          <Bar className="h-5 w-96 max-w-full" />
          <div className="h-40 animate-pulse rounded-2xl border-4 border-navy/10" />
          <div className="h-72 animate-pulse rounded-2xl border-4 border-navy/10" />
        </div>
      </div>
    </main>
  );
}
