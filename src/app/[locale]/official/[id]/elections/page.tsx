import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import {
  money,
  OUTCOME_STYLE,
  outcomeLabel,
  percent,
  seatLabel,
  segments,
  StackBar,
} from "@/components/CampaignMoney";
import { ElectionCard } from "@/components/ElectionCard";
import { SiteHeader } from "@/components/SiteHeader";
import { format, LOCALE_INFO } from "@/i18n/config";
import { officeTitle } from "@/i18n/labels";
import { getDictionary, getLocale, href } from "@/i18n/server";
import { getCampaigns, pacShare } from "@/lib/campaigns";
import { getLegislatorIndex } from "@/lib/providers/legislators";
import { resultsSource } from "@/lib/providers/results";

const BIOGUIDE = /^[A-Z]\d{6}$/;

async function member(id: string) {
  if (!BIOGUIDE.test(id)) return undefined;
  return (await getLegislatorIndex()).get(id);
}

export async function generateMetadata(props: PageProps<"/[locale]/official/[id]/elections">): Promise<Metadata> {
  const { id } = await props.params;
  const [info, t] = await Promise.all([member(id), getDictionary()]);
  return info ? { title: format(t.money.pageTitle, { name: info.displayName }) } : {};
}

export default async function ElectionsPage(props: PageProps<"/[locale]/official/[id]/elections">) {
  const [{ id }, { race }] = await Promise.all([props.params, props.searchParams]);
  const info = await member(id);
  if (!info) notFound();
  const t = await getDictionary();
  const lang = LOCALE_INFO[await getLocale()].htmlLang;
  const list = await getCampaigns(id).catch(() => undefined);

  const office = officeTitle(info.chamber === "Senate" ? "U.S. Senator" : "U.S. Representative", t);
  const where = info.chamber === "Senate" ? info.state : info.district ? `${info.state}-${info.district}` : `${info.state} ${t.money.atLarge}`;
  const selected = list?.campaigns.find((c) => c.key === race) ?? list?.current;
  const base = await href(`/official/${id}/elections`);
  const chronological = [...(list?.campaigns ?? [])].reverse();
  const results = resultsSource(info.state);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 space-y-10 px-4 py-10">
        <div className="space-y-2">
          <Link href={await href(`/official/${id}`)} className="text-sm text-navy underline">
            <span className="inline-block rtl:-scale-x-100">◂</span> {t.money.backToProfile}
          </Link>
          <p className="font-display text-xs tracking-wide text-navy/60 uppercase">{t.money.panelTitle}</p>
          <h1 className="font-display text-3xl text-navy sm:text-4xl">{info.displayName}</h1>
          <p className="text-lg text-navy/80">
            {office} · {where}
          </p>
        </div>

        {list === undefined && <p className="text-navy/70">{t.money.unavailable}</p>}
        {list && !selected && <p className="text-navy/70">{t.money.noCampaigns}</p>}

        {list && selected && (
          <>
            {/* The chosen race in full; it streams in while the list below shows. */}
            <Suspense key={selected.key} fallback={<div className="h-[36rem] animate-pulse rounded-2xl border-4 border-navy/10" aria-busy />}>
              <ElectionCard c={selected} name={list.name} t={t} lang={lang} />
            </Suspense>

            <section aria-labelledby="every-race" className="space-y-3">
              <h2 id="every-race" className="font-display text-xl text-navy">
                {t.money.everyRace}
              </h2>
              <ul className="grid gap-2">
                {list.campaigns.map((c) => {
                  const current = c.key === selected.key;
                  const outcome = outcomeLabel(c, t, lang);
                  const segs = segments(c.race.contributions, undefined, t);
                  return (
                    <li key={c.key}>
                      <Link
                        href={`${base}?race=${c.key}`}
                        aria-current={current ? "true" : undefined}
                        className={`grid grid-cols-[3.5rem_1fr] items-center gap-x-4 gap-y-1.5 rounded-xl border-2 bg-white px-4 py-3 transition hover:border-navy sm:grid-cols-[3.5rem_minmax(0,1fr)_8rem_12rem] ${
                          current ? "border-navy shadow-[3px_3px_0_var(--color-navy)]" : "border-navy/20"
                        }`}
                      >
                        <span className="row-span-2 font-display text-xl text-navy sm:row-span-1">{c.year}</span>
                        <span className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="text-navy/80">{seatLabel(c, t)}</span>
                          {outcome && (
                            <span className={`rounded border-2 px-1.5 font-display text-[10px] uppercase ${OUTCOME_STYLE[c.outcome]}`}>
                              {outcome}
                            </span>
                          )}
                        </span>
                        <span className="text-sm font-semibold text-navy tabular-nums sm:text-end">
                          {money(c.race.raised, lang)}
                        </span>
                        <span className="col-start-2 sm:col-start-auto">
                          {segs.length > 0 && <StackBar segs={segs} lang={lang} size="sm" />}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>

            {chronological.length > 1 && (
              <section aria-labelledby="pac-trend" className="space-y-2">
                <h2 id="pac-trend" className="font-display text-xl text-navy">
                  {t.money.pacTrend}
                </h2>
                <p className="text-sm text-navy/70">{t.money.pacTrendNote}</p>
                <div className="rounded-2xl border-4 border-navy bg-white p-4">
                  <div
                    role="img"
                    aria-label={chronological.map((c) => `${c.year}: ${percent(pacShare(c.race), lang)}`).join(", ")}
                    className="flex h-44 items-end gap-1.5"
                  >
                    {chronological.map((c) => {
                      const share = pacShare(c.race);
                      const over = c.race.contributions.pacs > c.race.contributions.individuals;
                      return (
                        <div key={c.key} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
                          <span className="text-[10px] font-bold text-navy tabular-nums sm:text-xs">{percent(share, lang)}</span>
                          <span
                            className={`w-full rounded-t-md ${over ? "bg-money-4" : "bg-money-pac"}`}
                            style={{ height: `${share * 80}%` }}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-1 flex gap-1.5 border-t-2 border-navy pt-1" aria-hidden>
                    {chronological.map((c) => (
                      <span key={c.key} className="min-w-0 flex-1 text-center text-[10px] text-navy/60 tabular-nums sm:text-xs">
                        &apos;{String(c.year).slice(2)}
                      </span>
                    ))}
                  </div>
                </div>
              </section>
            )}
          </>
        )}

        <section className="text-sm text-navy/70">
          <h2 className="font-display text-xs tracking-wide text-navy/60 uppercase">{t.money.sources}</h2>
          <ul className="mt-1 list-disc space-y-0.5 ps-5">
            {info.fecIds.map((fecId) => (
              <li key={fecId}>
                <a href={`https://www.fec.gov/data/candidate/${fecId}/`} target="_blank" rel="noreferrer" className="underline">
                  {t.money.fecSource} · {fecId}
                </a>
              </li>
            ))}
            {results && (
              <li>
                <a href={results.url} target="_blank" rel="noreferrer" lang="en" className="underline">
                  {results.title}
                </a>
              </li>
            )}
            <li>
              <Link href={`${await href("/methodology")}#money`} className="underline">
                {t.money.howWeCount}
              </Link>
            </li>
          </ul>
        </section>
      </main>
    </>
  );
}
