import { format } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/en";
import { type Campaign, getCampaignDetail } from "@/lib/campaigns";
import { formatDate, formatElectionDate } from "@/lib/electionDates";
import type { Spender } from "@/lib/providers/fec";
import { hasResults } from "@/lib/providers/results";
import {
  FundingBar,
  fullMoney,
  Legend,
  money,
  MoneyTable,
  outcomeLabel,
  PAC_CLASS,
  PAC_KINDS,
  pacLabel,
  pacTag,
  percent,
  personName,
  seatLabel,
  segments,
  StackBar,
  StageResults,
  shares,
  summarySentence,
} from "./CampaignMoney";

type T = Dictionary;
const TOP_BACKERS = 8;

const fecRaceUrl = (c: Campaign) =>
  `https://www.fec.gov/data/candidate/${c.race.candidateId}/?cycle=${c.race.year}&election_full=true`;

/** The full card for one race: results, who funded it, outside money, and top backers. */
export async function ElectionCard({
  c,
  name,
  t,
  lang,
}: {
  c: Campaign;
  /** The official's display name, for "Spent to help …". */
  name: string;
  t: T;
  lang: string;
}) {
  const d = await getCampaignDetail(c);
  const segs = segments(c.race.contributions, d.sizes, t);
  const summary = summarySentence(c.race.contributions, d.sizes, t, lang);
  const outcome = outcomeLabel(c, t, lang);
  const upcoming = c.outcome === "upcoming";
  const rival = d.rival;
  const rivalName = rival ? personName(rival.name) : "";

  return (
    <article
      aria-labelledby={`race-${c.key}`}
      className={`overflow-hidden rounded-2xl border-4 bg-[#fffdf6] ${
        upcoming ? "border-gold shadow-[6px_6px_0_var(--color-gold)]" : "border-navy shadow-[6px_6px_0_var(--color-navy)]"
      }`}
    >
      <header className="flex flex-wrap items-start justify-between gap-3 bg-navy px-5 py-4 text-cream">
        <div>
          <h2 id={`race-${c.key}`} className="font-display text-3xl leading-none text-gold">
            {c.year}
          </h2>
          <p className="mt-1 text-xs tracking-wide text-cream/80 uppercase">{seatLabel(c, t)}</p>
        </div>
        {outcome && (
          <span
            className={`-rotate-3 rounded-lg border-[3px] px-2.5 py-1 font-display text-sm whitespace-nowrap ${
              c.outcome === "won"
                ? "border-emerald-300 text-emerald-300"
                : c.outcome === "upcoming"
                  ? "border-gold text-gold"
                  : "border-red-300 text-red-300"
            }`}
          >
            {outcome}
          </span>
        )}
      </header>

      <div className="grid gap-6 px-5 py-5">
        {summary && <p className="text-base font-medium text-navy">{summary}</p>}

        {/* Headline numbers */}
        <div className="flex flex-wrap gap-x-7 gap-y-3">
          <Stat
            value={money(c.race.raised, lang)}
            label={
              upcoming && c.race.coverageEnd
                ? format(t.money.raisedThrough, { date: formatElectionDate(c.race.coverageEnd, lang) })
                : t.money.raised
            }
          />
          <Stat value={money(c.race.spent, lang)} label={t.money.spent} />
          {upcoming && <Stat value={money(c.race.cashOnHand, lang)} label={t.money.cashOnHand} />}
          {rival && rival.raised > 0 && c.race.raised > 0 && (
            <Stat
              value={ratio(Math.max(rival.raised, c.race.raised) / Math.min(rival.raised, c.race.raised), lang)}
              label={format(rival.raised > c.race.raised ? t.money.outraisedBy : t.money.outraised, { name: rivalName })}
            />
          )}
        </div>

        {/* Results */}
        {c.stages.length > 0 ? (
          <div className="grid gap-2">
            {c.stages.map((s) => (
              <StageResults key={s.id} stage={s} t={t} lang={lang} />
            ))}
          </div>
        ) : (
          !upcoming && !hasResults(c.seat.state) && <p className="text-sm text-navy/60">{t.money.resultsNotLoaded}</p>
        )}

        {/* Who funded it */}
        {segs.length > 0 && (
          <section className="grid gap-2">
            <h3 className="text-xs font-bold tracking-widest text-navy/60 uppercase">{t.money.whoFunded}</h3>
            <FundingBar c={c.race.contributions} sizes={d.sizes} t={t} lang={lang} />
            <Legend segs={segs} lang={lang} />
            <p className="text-xs text-navy/60">
              {format(t.money.moneyNote, { total: fullMoney(shares(c.race.contributions, d.sizes).total, lang) })}
            </p>
            <MoneyTable segs={segs} t={t} lang={lang} />
          </section>
        )}

        {/* Head to head */}
        {rival?.contributions && (
          <section className="grid gap-3">
            <h3 className="text-xs font-bold tracking-widest text-navy/60 uppercase">{t.money.headToHead}</h3>
            {[
              { who: name, raised: c.race.raised, contrib: c.race.contributions, sizes: d.sizes },
              { who: rivalName, raised: rival.raised, contrib: rival.contributions, sizes: rival.sizes },
            ].map((row) => {
              const s = shares(row.contrib, row.sizes);
              return (
                <div key={row.who} className="grid gap-1 sm:grid-cols-[11rem_1fr] sm:items-center sm:gap-3">
                  <div className="text-sm">
                    <div className="font-semibold">{row.who}</div>
                    <div className="text-xs text-navy/60">
                      {money(row.raised, lang)} · {t.money.pacs} {percent(s.pacs, lang)}
                      {row.sizes && ` · ${t.money.sizeSmall} ${percent(s.grassroots, lang)}`}
                    </div>
                  </div>
                  <StackBar segs={segments(row.contrib, row.sizes, t)} lang={lang} size="md" />
                </div>
              );
            })}
          </section>
        )}

        {/* Outside money */}
        {d.outside && (
          <section className="grid gap-2">
            <h3 className="text-xs font-bold tracking-widest text-navy/60 uppercase">{t.money.outside}</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <SpenderBox tone="help" label={`▲ ${format(t.money.spentToHelp, { name })}`} list={d.outside.support} lang={lang} />
              <SpenderBox tone="hurt" label={`▼ ${format(t.money.spentToDefeat, { name })}`} list={d.outside.oppose} lang={lang} />
            </div>
            {rival?.helpedBy && rival.helpedBy.length > 0 && (
              <p className="text-sm text-navy/70">
                {format(t.money.alsoHelped, {
                  amount: money(rival.helpedBy.reduce((a, s) => a + s.amount, 0), lang),
                  name: rivalName,
                })}{" "}
                <span lang="en">{rival.helpedBy.map((s) => `${s.name} ${money(s.amount, lang)}`).join(" · ")}</span>
              </p>
            )}
            <p className="text-xs text-navy/60">{t.money.outsideNote}</p>
          </section>
        )}

        {/* PACs */}
        {d.pacs && (
          <section className="grid gap-2">
            <h3 className="text-xs font-bold tracking-widest text-navy/60 uppercase">{t.money.whichPacs}</h3>
            {d.pacs.givers.length === 0 ? (
              <p className="text-sm text-navy/60">{t.money.noPacs}</p>
            ) : (
              <>
                <p className="text-sm text-navy">
                  {format(t.money.pacCount, {
                    count: d.pacs.givers.length,
                    maxed: d.pacs.givers.filter((g) => g.maxed).length,
                  })}
                </p>
                {(() => {
                  const kindSegs = PAC_KINDS.map((k) => ({
                    key: k,
                    label: pacLabel(k, t),
                    amount: d.pacs!.byKind[k],
                    cls: PAC_CLASS[k],
                  })).filter((s) => s.amount > 0);
                  return (
                    <>
                      <StackBar segs={kindSegs} lang={lang} size="md" />
                      <Legend segs={kindSegs} lang={lang} />
                    </>
                  );
                })()}
                <h4 className="mt-2 text-xs font-bold tracking-widest text-navy/60 uppercase">{t.money.topBackers}</h4>
                <ul>
                  {d.pacs.givers.slice(0, TOP_BACKERS).map((g) => (
                    <li
                      key={g.committeeId}
                      className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-dashed border-navy/15 py-1.5 text-sm"
                    >
                      <span
                        className={`min-w-14 rounded px-1.5 py-0.5 text-center text-[10px] font-extrabold tracking-wider text-white uppercase ${PAC_CLASS[g.kind]}`}
                      >
                        {pacTag(g.kind, t)}
                      </span>
                      <a
                        lang="en"
                        href={`https://www.fec.gov/data/committee/${g.committeeId}/`}
                        target="_blank"
                        rel="noreferrer"
                        className="break-words hover:underline"
                      >
                        {g.name}
                      </a>
                      <span className="flex items-center gap-2 font-semibold tabular-nums">
                        {g.maxed && (
                          <span className="-rotate-3 rounded border-2 border-red-700 px-1 text-[9px] font-extrabold tracking-wider text-red-700 uppercase">
                            {t.money.maxed}
                          </span>
                        )}
                        {fullMoney(g.amount, lang)}
                      </span>
                    </li>
                  ))}
                </ul>
                {d.pacs.truncated && <p className="text-xs text-navy/60">{t.money.pacTruncated}</p>}
              </>
            )}
          </section>
        )}

        <p className="text-sm">
          <a href={fecRaceUrl(c)} target="_blank" rel="noreferrer" className="text-navy underline">
            {t.money.fecLink} ↗
          </a>
          {c.race.coverageEnd && (
            <span className="ms-2 text-xs text-navy/50">
              {format(t.money.asOf, { date: formatDate(c.race.coverageEnd, lang) })}
            </span>
          )}
        </p>
      </div>
    </article>
  );
}

function ratio(r: number, lang: string) {
  const n = new Intl.NumberFormat(lang, { maximumFractionDigits: r >= 10 ? 0 : 1 }).format(r);
  // Isolated left-to-right so Arabic doesn't flip it into "1 : 1.4".
  return `\u2066${n} : 1\u2069`;
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="font-display text-2xl leading-tight text-navy tabular-nums">{value}</div>
      <div className="text-[11px] tracking-wide text-navy/60 uppercase">{label}</div>
    </div>
  );
}

function SpenderBox({ tone, label, list, lang }: { tone: "help" | "hurt"; label: string; list: Spender[]; lang: string }) {
  const total = list.reduce((a, s) => a + s.amount, 0);
  const color = tone === "help" ? "border-emerald-600 text-emerald-700" : "border-red-700 text-red-700";
  return (
    <div className={`rounded-xl border-2 bg-white px-3 py-2.5 ${color}`}>
      <div className="text-[11px] font-bold tracking-wide uppercase">{label}</div>
      <div className="font-display text-2xl leading-tight tabular-nums">{money(total, lang)}</div>
      {list.length > 0 && (
        <ul className="mt-1 space-y-0.5 text-sm text-ink">
          {list.slice(0, 5).map((s) => (
            <li key={s.committeeId} className="flex justify-between gap-2">
              <a lang="en" href={`https://www.fec.gov/data/committee/${s.committeeId}/`} target="_blank" rel="noreferrer" className="break-words hover:underline">
                {s.name}
              </a>
              <span className="tabular-nums">{money(s.amount, lang)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
