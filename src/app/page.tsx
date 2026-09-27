import type { ReactNode } from "react";
import { ZipInput } from "@/components/ZipInput";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-16 text-center">
      <div className="flex -space-x-10" aria-hidden>
        {HERO_CARDS.map((card) => (
          <div
            key={card.name}
            className={`card-frame h-36 w-26 rounded-xl p-1 shadow-lg ${card.tilt}`}
          >
            <div className="relative flex h-full items-center justify-center rounded-lg bg-navy text-gold">
              <CardIndex index={card.index} />
              <svg viewBox="0 0 48 48" className="h-14 w-14" fill="currentColor">
                {card.emblem}
              </svg>
              <CardIndex index={card.index} flipped />
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

type CardIndexValue = { rank: string; suit?: string };

// Corner pip like a real playing card; suitless ranks (the Joker) stack vertically.
function CardIndex({
  index,
  flipped = false,
}: {
  index: CardIndexValue;
  flipped?: boolean;
}) {
  return (
    <div
      className={`absolute flex flex-col items-center font-display leading-none ${
        flipped ? "right-1.5 bottom-1.5 rotate-180" : "top-1.5 left-1.5"
      } ${index.suit ? "text-base" : "text-[9px]"}`}
    >
      {index.suit ? (
        <>
          <span>{index.rank}</span>
          <span className="text-xs">{index.suit}</span>
        </>
      ) : (
        [...index.rank].map((ch, i) => <span key={i}>{ch}</span>)
      )}
    </div>
  );
}

const HERO_CARDS: {
  name: string;
  tilt: string;
  index: CardIndexValue;
  emblem: ReactNode;
}[] = [
  {
    name: "king",
    tilt: "-rotate-12",
    index: { rank: "K", suit: "♠" },
    emblem: (
      <>
        <path d="M6 34 10 13l8 10 6-15 6 15 8-10 4 21Z" />
        <rect x="6" y="36" width="36" height="5" rx="1" />
        <circle cx="10" cy="12" r="2.5" />
        <circle cx="24" cy="7" r="2.5" />
        <circle cx="38" cy="12" r="2.5" />
      </>
    ),
  },
  {
    name: "queen",
    tilt: "rotate-0 -translate-y-3",
    index: { rank: "Q", suit: "♥" },
    emblem: (
      <>
        <path d="M8 34q1-12 6-17l4 9 6-13 6 13 4-9q5 5 6 17Z" />
        <rect x="8" y="36" width="32" height="5" rx="2.5" />
        <circle cx="14" cy="14" r="2" />
        <circle cx="24" cy="10" r="2" />
        <circle cx="34" cy="14" r="2" />
        <path
          d="M24 33c-4-3-5-4.5-5-6.5a2.5 2.5 0 0 1 5-1 2.5 2.5 0 0 1 5 1c0 2-1 3.5-5 6.5Z"
          className="fill-navy"
        />
      </>
    ),
  },
  {
    name: "joker",
    tilt: "rotate-12",
    index: { rank: "JOKER" },
    emblem: (
      <>
        <path d="M11 35c0-11-3-17-8-13 5-10 15-6 19 11Z" />
        <path d="M37 35c0-11 3-17 8-13-5-10-15-6-19 11Z" />
        <path d="M18 34c0-14 4-24 14-28-4 8-2 18-2 28Z" className="opacity-80" />
        <rect x="8" y="35" width="32" height="6" rx="1" />
        <circle cx="3" cy="23" r="3" />
        <circle cx="45" cy="23" r="3" />
        <circle cx="33" cy="6" r="3" />
      </>
    ),
  },
];
