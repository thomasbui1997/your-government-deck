import Link from "next/link";
import { format, LOCALE_INFO } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/en";
import { getDictionary, getLocale, href } from "@/i18n/server";
import { formatDate, isAhead } from "@/lib/electionDates";
import {
  type BackerKind,
  getStateMoney,
  SIZE_BANDS,
  type StateContributions,
  stateShares,
} from "@/lib/stateMoney";
import { fullMoney, Legend, money, percent, type Segment, StackBar } from "./CampaignMoney";

// Massachusetts state campaign money (OCPF). Reuses the federal panel's bar and legend, with
// Massachusetts definitions: see stateMoney.ts and the methodology page (#state-money).

type T = Dictionary;

const panel =
  "rounded-2xl border-4 border-navy bg-white p-5 text-start shadow-[6px_6px_0_var(--color-navy)]";

const SIZE_CLASSES = ["bg-money-0", "bg-money-1", "bg-money-2", "bg-money-3", "bg-money-4"];

const KIND_CLASS: Record<BackerKind, string> = {
  pac: "bg-money-pac",
  union: "bg-pac-labor",
  committee: "bg-money-party",
};

function segments(c: StateContributions, t: T): Segment[] {
  const s = t.stateMoney;
  const sizeLabels = [s.upTo50, s.from51, s.from200, s.from500, s.from1000];
  return [
    ...SIZE_BANDS.map((b, i) => ({
      key: b.key,
      label: sizeLabels[i],
      amount: c.sizes[b.key],
      cls: SIZE_CLASSES[i],
      light: i >= 1 && i <= 3,
    })),
    { key: "pacs", label: s.pacs, amount: c.pacs, cls: KIND_CLASS.pac },
    { key: "unions", label: s.unions, amount: c.unions, cls: KIND_CLASS.union },
    { key: "committees", label: s.committees, amount: c.committees, cls: KIND_CLASS.committee },
  ].filter((x) => x.amount > 0);
}

function summary(c: StateContributions, t: T, lang: string) {
  const s = stateShares(c);
  if (s.total <= 0) return null;
  if (s.big >= 0.5) return format(t.stateMoney.summaryBig, { pct: percent(s.big, lang) });
  return format(t.stateMoney.summaryGrassroots, { pct: percent(s.grassroots, lang) });
}

const kindTag = (k: BackerKind, t: T) =>
  ({ pac: t.stateMoney.tagPac, union: t.stateMoney.tagUnion, committee: t.stateMoney.tagCommittee })[k];

/** Profile panel for a Massachusetts state official: cycle totals, who gave, top organizations. */
export async function StateMoneyPanel({ officialId }: { officialId: string }) {
  const t = await getDictionary();
  const s = t.stateMoney;
  const lang = LOCALE_INFO[await getLocale()].htmlLang;

  const data = await getStateMoney(officialId).catch((e) => {
    console.warn(`[ocpf] ${officialId}: ${e}`);
    return undefined;
  });
  if (data === undefined) {
    return (
      <section className={panel}>
        <h2 className="font-display text-navy">{s.panelTitle}</h2>
        <p className="mt-1 text-sm text-navy/60">{s.unavailable}</p>
      </section>
    );
  }
  if (!data) return null;

  const { cycle, years, contributions: c } = data;
  const raised = years.reduce((a, y) => a + y.raised, 0);
  const spent = years.reduce((a, y) => a + y.spent, 0);
  const latest = years.at(-1);
  const segs = segments(c, t);
  const shares = stateShares(c);
  const sentence = summary(c, t, lang);
  const methodology = await href("/methodology#state-money");

  return (
    <section className={`${panel} space-y-4`}>
      <h2 className="font-display text-navy">{s.panelTitle}</h2>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="font-display text-2xl leading-none text-navy tabular-nums" dir="ltr">
          {cycle.start}–{cycle.end}
        </span>
        <span className="text-sm text-navy/70">{s.cycle}</span>
        {isAhead(cycle.electionDate) && (
          <span className="rounded-lg border-2 border-gold bg-gold px-2 py-0.5 font-display text-xs text-navy-deep uppercase">
            {format(s.electionDay, { date: formatDate(cycle.electionDate, lang) })}
          </span>
        )}
      </div>
      <p className="text-xs text-navy/60">
        {s.committee}:{" "}
        <a href={data.filer.url} target="_blank" rel="noreferrer" lang="en" className="underline">
          {data.filer.committeeName || data.filer.name}
        </a>
      </p>

      {years.length > 0 && (
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <Stat value={money(raised, lang)} label={s.raised} />
          <Stat value={money(spent, lang)} label={s.spent} />
          {latest && <Stat value={money(latest.cashOnHand, lang)} label={s.cashOnHand} />}
        </div>
      )}
      {latest?.through && (
        <p className="-mt-2 text-xs text-navy/50">{format(s.bankThrough, { date: formatDate(latest.through, lang) })}</p>
      )}

      {segs.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-xs font-bold tracking-widest text-navy/60 uppercase">{s.whoGave}</h3>
          <div className="space-y-1.5">
            <div className="flex justify-between font-display text-xs sm:text-sm">
              <span className="text-money-0">
                {s.grassroots} {percent(shares.grassroots, lang)}
              </span>
              <span className="text-money-4">
                {s.bigMoney} {percent(shares.big, lang)}
              </span>
            </div>
            <StackBar segs={segs} lang={lang} size="lg" />
          </div>
          {sentence && <p className="text-sm font-semibold text-navy">{sentence}</p>}
          <Legend segs={segs} lang={lang} />
          <p className="text-xs text-navy/60">
            {format(s.note, {
              total: fullMoney(shares.total, lang),
              from: String(cycle.start),
              date: c.through ? formatDate(c.through, lang) : String(cycle.end),
            })}
          </p>
        </div>
      ) : (
        <p className="text-sm text-navy/60">{s.noContributions}</p>
      )}

      {years.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer font-semibold text-navy">{s.byYear}</summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full border-collapse tabular-nums">
              <thead>
                <tr className="border-b border-navy/15">
                  <th className="py-1 pe-2 text-start">{s.year}</th>
                  <th className="px-2 py-1 text-end">{s.raised}</th>
                  <th className="px-2 py-1 text-end">{s.spent}</th>
                  <th className="py-1 ps-2 text-end">{s.cashOnHand}</th>
                </tr>
              </thead>
              <tbody>
                {years.map((y) => (
                  <tr key={y.year} className="border-b border-navy/10">
                    <td className="py-1 pe-2">{y.year}</td>
                    <td className="px-2 py-1 text-end">{fullMoney(y.raised, lang)}</td>
                    <td className="px-2 py-1 text-end">{fullMoney(y.spent, lang)}</td>
                    <td className="py-1 ps-2 text-end">{fullMoney(y.cashOnHand, lang)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      <div className="space-y-1">
        <h3 className="text-xs font-bold tracking-widest text-navy/60 uppercase">{s.topBackers}</h3>
        {data.backers.length === 0 ? (
          <p className="text-sm text-navy/60">{s.noOrgs}</p>
        ) : (
          <ul>
            {data.backers.map((b) => (
              <li
                key={b.name}
                className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-dashed border-navy/15 py-1.5 text-sm"
              >
                <span
                  className={`min-w-14 rounded px-1.5 py-0.5 text-center text-[10px] font-extrabold tracking-wider text-white uppercase ${KIND_CLASS[b.kind]}`}
                >
                  {kindTag(b.kind, t)}
                </span>
                {b.url ? (
                  <a lang="en" href={b.url} target="_blank" rel="noreferrer" className="break-words hover:underline">
                    {b.name}
                  </a>
                ) : (
                  <span lang="en" className="break-words">
                    {b.name}
                  </span>
                )}
                <span className="font-semibold tabular-nums">{fullMoney(b.amount, lang)}</span>
              </li>
            ))}
          </ul>
        )}
        {data.truncated && <p className="text-xs text-navy/60">{s.truncated}</p>}
      </div>

      <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <a href={data.filer.url} target="_blank" rel="noreferrer" className="text-navy underline">
          {s.ocpfLink} ↗
        </a>
        <Link href={methodology} className="text-navy underline">
          {s.howWeCount}
        </Link>
      </p>
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
