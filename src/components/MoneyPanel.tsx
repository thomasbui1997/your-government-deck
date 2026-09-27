import Link from "next/link";
import { format, LOCALE_INFO } from "@/i18n/config";
import { getDictionary, getLocale, href } from "@/i18n/server";
import { getCampaignMoney, getCampaigns } from "@/lib/campaigns";
import { daysUntil, formatElectionDate } from "@/lib/electionDates";
import { FundingBar, money, OUTCOME_STYLE, outcomeLabel, seatLabel } from "./CampaignMoney";

const panel =
  "rounded-2xl border-4 border-navy bg-white p-5 text-start shadow-[6px_6px_0_var(--color-navy)]";

/** Profile summary: the featured race, its money bar, and a link to every race. */
export async function MoneyPanel({ bioguideId }: { bioguideId: string }) {
  const t = await getDictionary();
  const lang = LOCALE_INFO[await getLocale()].htmlLang;

  const list = await getCampaigns(bioguideId).catch(() => undefined);
  if (list === undefined) {
    return (
      <section className={panel}>
        <h2 className="font-display text-navy">{t.money.panelTitle}</h2>
        <p className="mt-1 text-sm text-navy/60">{t.money.unavailable}</p>
      </section>
    );
  }
  const c = list?.current;
  if (!c) return null;

  const { sizes, outside } = await getCampaignMoney(c);
  const outcome = outcomeLabel(c, t, lang);
  const days = c.electionDate ? daysUntil(c.electionDate) : undefined;
  const helped = outside?.support.reduce((a, s) => a + s.amount, 0) ?? 0;
  const hurt = outside?.oppose.reduce((a, s) => a + s.amount, 0) ?? 0;
  const num = new Intl.NumberFormat(lang, { maximumFractionDigits: 1 });
  const elections = await href(`/official/${bioguideId}/elections`);

  return (
    <section className={`${panel} space-y-4`}>
      <h2 className="font-display text-navy">{t.money.panelTitle}</h2>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="font-display text-3xl leading-none text-navy">{c.year}</span>
        <span className="text-sm text-navy/70">{seatLabel(c, t)}</span>
        {outcome && (
          <span className={`rounded-lg border-2 px-2 py-0.5 font-display text-xs uppercase ${OUTCOME_STYLE[c.outcome]}`}>
            {outcome}
            {days !== undefined && ` · ${format(days === 1 ? t.card.dayLeft : t.card.daysLeft, { days })}`}
          </span>
        )}
      </div>

      {c.stages.length > 0 && (
        <ul className="space-y-0.5 text-sm text-navy/80">
          {c.stages.map((s) => {
            const me = s.candidates.find((x) => x.me)!;
            return (
              <li key={s.id}>
                <span lang="en">{s.stage}</span>: {s.won ? t.money.won : t.money.lost}{" "}
                <span className="font-semibold tabular-nums">{num.format(me.pct)}%</span>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <Stat
          value={money(c.race.raised, lang)}
          label={
            c.outcome === "upcoming" && c.race.coverageEnd
              ? format(t.money.raisedThrough, { date: formatElectionDate(c.race.coverageEnd, lang) })
              : t.money.raised
          }
        />
        {c.outcome === "upcoming" && <Stat value={money(c.race.cashOnHand, lang)} label={t.money.cashOnHand} />}
      </div>

      <FundingBar c={c.race.contributions} sizes={sizes} t={t} lang={lang} size="md" />

      {(helped > 0 || hurt > 0) && (
        <p className="flex flex-wrap gap-x-4 text-sm font-semibold">
          {helped > 0 && (
            <span className="text-emerald-700">
              ▲ {format(t.money.spentToHelp, { name: list!.name })}: {money(helped, lang)}
            </span>
          )}
          {hurt > 0 && (
            <span className="text-red-700">
              ▼ {format(t.money.spentToDefeat, { name: list!.name })}: {money(hurt, lang)}
            </span>
          )}
        </p>
      )}

      <Link href={elections} className="inline-block font-display text-sm text-navy underline">
        {list!.campaigns.length > 1 ? format(t.money.seeAll, { count: list!.campaigns.length }) : t.money.seeRace}{" "}
        <span className="inline-block rtl:-scale-x-100">▸</span>
      </Link>
    </section>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="font-display text-xl leading-tight text-navy tabular-nums">{value}</div>
      <div className="text-[11px] tracking-wide text-navy/60 uppercase">{label}</div>
    </div>
  );
}

export function MoneyPanelSkeleton() {
  return <div className="h-56 animate-pulse rounded-2xl border-4 border-navy/10" aria-hidden />;
}
