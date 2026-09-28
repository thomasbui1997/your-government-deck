"use client";

import { useId, useState } from "react";
import { useI18n } from "@/i18n/client";
import { format } from "@/i18n/config";
import { formatDate } from "@/lib/electionDates";
import type { ClientDictionary } from "@/i18n/dictionaries/en";
import type { Official, OfficialBio } from "@/lib/types";
import { OfficialCard } from "./OfficialCard";

type T = ClientDictionary;

const partyStrip: Record<Official["party"], string> = {
  D: "bg-party-d",
  R: "bg-party-r",
  I: "bg-party-i",
  NP: "bg-party-np",
};

/** "March 31, 1955" → the reader's format; anything unparseable stays as written. */
function bornDate(date: string, lang: string) {
  const d = new Date(`${date} 12:00 UTC`);
  return Number.isNaN(d.getTime()) ? date : formatDate(d.toISOString().slice(0, 10), lang);
}

/**
 * The profile's hero card. Clicking it (or the button under it) turns it over to show who
 * they are: hometown, schooling, career before office, and what their bills are about.
 */
export function FlipCard({ official, bio }: { official: Official; bio?: OfficialBio }) {
  const { t, htmlLang } = useI18n();
  const [flipped, setFlipped] = useState(false);
  const backId = useId();

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="cursor-pointer [perspective:1400px]"
        onClick={(e) => {
          // Links on the back (sources) open normally without turning the card.
          if ((e.target as HTMLElement).closest("a")) return;
          setFlipped((f) => !f);
        }}
      >
        <div
          className={`relative transition-transform duration-700 ease-out [transform-style:preserve-3d] motion-reduce:transition-none ${
            flipped ? "[transform:rotateY(180deg)]" : ""
          }`}
        >
          <div className="[backface-visibility:hidden]" aria-hidden={flipped} inert={flipped}>
            <OfficialCard official={official} size="hero" />
          </div>
          <div
            id={backId}
            className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]"
            aria-hidden={!flipped}
            inert={!flipped}
          >
            <CardBack official={official} bio={bio} lang={htmlLang} t={t} />
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        aria-controls={backId}
        aria-pressed={flipped}
        className="rounded-full border-2 border-navy bg-white px-4 py-1 font-display text-xs text-navy shadow-[2px_2px_0_var(--color-navy)] transition active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
      >
        <span aria-hidden className="inline-block rtl:-scale-x-100">
          ↻
        </span>{" "}
        {flipped ? t.bio.flipFront : t.bio.flipBack}
      </button>
    </div>
  );

}

function CardBack({ official, bio, lang, t }: { official: Official; bio?: OfficialBio; lang: string; t: T }) {
  return (
    <div className="card-frame flex h-full w-80 rounded-2xl p-1.5 shadow-lg">
      <div className="flex flex-1 flex-col overflow-hidden rounded-xl bg-navy text-cream">
        <div className={`${partyStrip[official.party]} px-3 py-1.5`}>
          <p className="truncate font-display text-xs tracking-wide uppercase">{official.name}</p>
        </div>

        {bio ? (
          <div className="flex-1 space-y-3 overflow-y-auto px-3.5 py-3 text-[13px] leading-snug">
            {bio.summary && (
              <p lang="en" className="whitespace-pre-line">
                {bio.summary}
              </p>
            )}

            {bio.leadership && (
              <section>
                <h3 className="font-display text-[11px] tracking-wide text-gold uppercase">
                  {t.maLegislature.leadership}
                </h3>
                <p lang="en">{bio.leadership}</p>
              </section>
            )}

            {(bio.hometown || bio.born) && (
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                {bio.hometown && (
                  <>
                    <dt className="text-gold">{t.bio.hometown}</dt>
                    <dd lang="en">{bio.hometown}</dd>
                  </>
                )}
                {bio.born && (
                  <>
                    <dt className="text-gold">{t.bio.born}</dt>
                    <dd>
                      <span lang="en">{bio.born.place}</span>
                      {bio.born.date && ` · ${bornDate(bio.born.date, lang)}`}
                    </dd>
                  </>
                )}
              </dl>
            )}

            <Section title={t.bio.education} items={bio.education} />
            <Section title={t.bio.career} items={bio.career} />
            <Section title={t.bio.military} items={bio.military} />

            {bio.issues && bio.issues.length > 0 && (
              <section>
                <h3 className="font-display text-[11px] tracking-wide text-gold uppercase">{t.bio.champions}</h3>
                <p className="text-[11px] text-cream/60">{t.bio.championsNote}</p>
                <ul className="mt-1 flex flex-wrap gap-1.5">
                  {bio.issues.map((i) => (
                    <li key={i.name} className="rounded-full bg-gold/15 px-2 py-0.5 text-xs ring-1 ring-gold/40">
                      <span lang="en">{i.name}</span>{" "}
                      <span className="text-cream/60 tabular-nums">{format(t.bio.bills, { count: i.bills })}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {bio.committees && bio.committees.length > 0 && (
              <section>
                <h3 className="font-display text-[11px] tracking-wide text-gold uppercase">{t.bio.committees}</h3>
                <ul className="mt-1 space-y-1">
                  {bio.committees.map((c) => (
                    <li key={`${c.parent ?? ""}${c.name}`} lang="en">
                      {c.role && <b className="font-semibold text-gold-light">{c.role}, </b>}
                      {c.parent ? `${c.name} (${c.parent})` : c.name}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <p className="border-t border-gold/30 pt-2 text-[10px] text-cream/50">
              {t.bio.source}:{" "}
              {bio.sources.map((s, i) => (
                <span key={s.url}>
                  {i > 0 && " · "}
                  <a href={s.url} target="_blank" rel="noreferrer" lang="en" className="underline">
                    {s.title}
                  </a>
                </span>
              ))}
            </p>
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
            <span className="font-display text-4xl text-gold/50" aria-hidden>
              ★
            </span>
            <p className="text-sm text-cream/70">{t.bio.none}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <section>
      <h3 className="font-display text-[11px] tracking-wide text-gold uppercase">{title}</h3>
      <ul lang="en" className="mt-0.5 list-disc space-y-0.5 ps-4 marker:text-gold/60">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
