"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useI18n } from "@/i18n/client";
import { format } from "@/i18n/config";
import { officeTitle } from "@/i18n/labels";
import { formatElectionDate } from "@/lib/electionDates";
import type { Official, Party } from "@/lib/types";

const partyStrip: Record<Party, string> = {
  D: "bg-party-d",
  R: "bg-party-r",
  I: "bg-party-i",
  NP: "bg-party-np",
};

const partyLabel: Record<Party, string> = {
  D: "D",
  R: "R",
  I: "I",
  NP: "NP",
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

type SeatUp = NonNullable<NonNullable<Official["election"]>["seatUp"]>;

/** Strip across the bottom of the portrait when their seat is on the next ballot. */
function BallotBanner({ seatUp, lang }: { seatUp: SeatUp; lang: string }) {
  const { t } = useI18n();
  const date = formatElectionDate(seatUp.date, lang);
  const out = seatUp.status === "notRunning" || seatUp.status === "lostPrimary";
  const headline = out
    ? t.card[seatUp.status as "notRunning" | "lostPrimary"]
    : seatUp.status
      ? format(t.card.onBallot, { date })
      : format(t.card.seatUp, { date });
  const sub = out
    ? format(t.card.seatUp, { date })
    : seatUp.days === 0
      ? t.card.electionToday
      : format(seatUp.days === 1 ? t.card.dayLeft : t.card.daysLeft, { days: seatUp.days });
  return (
    <div
      className={`absolute inset-x-0 bottom-0 flex items-baseline justify-between gap-2 px-2 py-1 ${
        out ? "bg-stone-200 text-stone-700" : "bg-gold text-navy-deep"
      }`}
    >
      <span className="truncate font-display text-[11px] uppercase">🗳 {headline}</span>
      <span className="shrink-0 text-[10px] font-bold tabular-nums">{sub}</span>
    </div>
  );
}

export function OfficialCard({
  official,
  size = "deck",
}: {
  official: Official;
  size?: "deck" | "hero";
}) {
  const { t, href, htmlLang } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  // 0 = primary photo, 1 = fallback photo, 2 = initials.
  const [photoStep, setPhotoStep] = useState(0);

  // Tilt + sheen follow the pointer. Writes CSS vars directly to avoid re-renders.
  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.setProperty("--mx", `${x * 100}%`);
    el.style.setProperty("--my", `${y * 100}%`);
    el.style.setProperty("--ry", `${(x - 0.5) * 14}deg`);
    el.style.setProperty("--rx", `${(0.5 - y) * 14}deg`);
  }

  function onLeave() {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  }

  const width = size === "hero" ? "w-80" : "w-60";
  const days = official.lastActiveDaysAgo;
  const active =
    days === undefined ? null : days === 0 ? t.card.activeToday : format(t.card.activeDaysAgo, { days });
  const office = officeTitle(official.office, t);
  const photos = [official.photoUrl, official.photoFallbackUrl];
  const photo = photoStep < 2 ? photos[photoStep] : undefined;
  const nextPhoto = () =>
    setPhotoStep((step) => (step === 0 && official.photoFallbackUrl ? 1 : 2));
  const pct = official.promises
    ? Math.round((official.promises.kept / official.promises.total) * 100)
    : null;

  const card = (
    <div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className={`card-frame relative flex ${width} shrink-0 rounded-2xl p-1.5 shadow-lg`}
    >
      <div className="relative flex flex-1 flex-col overflow-hidden rounded-xl bg-navy text-cream">
        {/* Office strip in party color */}
        <div
          className={`${partyStrip[official.party]} flex items-center justify-between gap-2 px-3 py-1.5`}
        >
          <span className="truncate font-display text-xs tracking-wide uppercase">
            {office}
          </span>
          <span className="rounded bg-black/25 px-1.5 text-xs font-bold">
            {partyLabel[official.party]}
          </span>
        </div>

        {/* Portrait */}
        <div className="relative mx-2.5 mt-2.5 aspect-[9/11] overflow-hidden rounded-md border-2 border-gold/70 bg-gradient-to-br from-navy-deep to-[#2b3f6b]">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={photo}
              src={photo}
              alt={official.name}
              onError={nextPhoto}
              // The image can fail before hydration attaches onError; catch that on mount.
              ref={(img) => {
                if (img?.complete && img.naturalWidth === 0) nextPhoto();
              }}
              className="h-full w-full object-cover object-top"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center font-display text-5xl text-gold/80">
              {initials(official.name)}
            </div>
          )}
          {official.maybe && (
            <span className="absolute end-1.5 top-1.5 rounded bg-gold px-1.5 text-[10px] font-bold text-navy uppercase">
              {t.card.maybe}
            </span>
          )}
          {official.election?.seatUp && (
            <BallotBanner seatUp={official.election.seatUp} lang={htmlLang} />
          )}
          {official.appointed && (
            <span className="absolute start-1.5 top-1.5 rounded bg-cream/90 px-1.5 text-[9px] font-bold text-navy uppercase">
              {t.card.appointed}
            </span>
          )}
        </div>

        {/* Name + jurisdiction */}
        <div className="px-3 pt-2">
          <p className="truncate font-display text-base leading-tight">
            {official.name}
          </p>
          <p className="truncate text-xs text-cream/70">
            {official.role && `${t.card[official.role]} · `}
            {official.jurisdiction}
          </p>
        </div>

        {/* Stats */}
        <div className="mx-3 mt-1.5 space-y-0.5 border-t border-gold/40 pt-1.5 text-xs">
          {official.stats.map((s) => (
            <div key={s.key} className="flex justify-between">
              <span>
                {s.icon} {t.stats[s.key] ?? s.key}
              </span>
              <span className="font-bold tabular-nums">{s.value}</span>
            </div>
          ))}
          {official.termEnds && (
            <div className="flex justify-between">
              <span>📅 {t.card.term}</span>
              <span className="font-bold tabular-nums">→ {official.termEnds}</span>
            </div>
          )}
          {official.election?.nextYear && (
            <div className="flex justify-between">
              <span>🗳 {t.card.nextElection}</span>
              <span className="font-bold tabular-nums">{official.election.nextYear}</span>
            </div>
          )}
          {official.election?.termLimited && (
            <div className="flex justify-between">
              <span>🗳 {t.card.nextElection}</span>
              <span className="font-bold">{t.card.termLimited}</span>
            </div>
          )}
        </div>

        {/* Promise meter */}
        <div className="mx-3 mt-auto pt-2 pb-3">
          {pct !== null ? (
            <>
              <div className="flex justify-between text-[11px] text-cream/80">
                <span>{t.card.promisesKept}</span>
                <span className="tabular-nums">
                  {official.promises!.kept}/{official.promises!.total}
                </span>
              </div>
              <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-cream/15">
                <div
                  className="h-full rounded-full bg-gold"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </>
          ) : (
            <p className="text-[11px] text-cream/50">{t.card.notTracked}</p>
          )}
          {active && (
            <p className="mt-1 flex items-center gap-1 text-[11px] text-cream/70">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              {active}
            </p>
          )}
        </div>

        <div className="card-sheen pointer-events-none absolute inset-0" />
      </div>
    </div>
  );

  if (size === "hero") return card;
  return (
    <Link
      href={href(`/official/${official.id}`)}
      className="flex rounded-2xl focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-gold"
      aria-label={`${official.name}, ${office}`}
    >
      {card}
    </Link>
  );
}
