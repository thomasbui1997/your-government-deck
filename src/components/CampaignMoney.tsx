// Pieces shared by the profile's money panel and the elections page. Server components:
// callers pass the dictionary and language so nothing here fetches on its own.
import { format } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/en";
import type { Campaign, StageResult } from "@/lib/campaigns";
import { formatElectionDate } from "@/lib/electionDates";
import type { Contributions, PacKind } from "@/lib/providers/fec";

type T = Dictionary;

// ---- Formatting ------------------------------------------------------------

export function money(n: number, lang: string) {
  return new Intl.NumberFormat(lang, {
    style: "currency",
    currency: "USD",
    notation: n >= 10000 ? "compact" : "standard",
    maximumFractionDigits: n >= 10000 ? 1 : 0,
  }).format(n);
}

export function fullMoney(n: number, lang: string) {
  return new Intl.NumberFormat(lang, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export function percent(share: number, lang: string) {
  if (share > 0 && share < 0.01) return `<${new Intl.NumberFormat(lang, { style: "percent" }).format(0.01)}`;
  return new Intl.NumberFormat(lang, { style: "percent", maximumFractionDigits: 0 }).format(share);
}

const HONORIFIC = /^(MR|MRS|MS|DR|SEN|REP|HON|JR|SR)\.?$/;

/** FEC "ROATH, PATRICK THOMAS" → "Patrick Thomas Roath". */
export function personName(fecName: string) {
  const [last, rest = ""] = fecName.split(",");
  const words = [...rest.trim().split(/\s+/), last.trim()].filter((w) => w && !HONORIFIC.test(w));
  return words
    .map((w) => w.toLowerCase().replace(/(^|[-'])(\p{L})/gu, (_, p: string, c: string) => p + c.toUpperCase()))
    .join(" ");
}

export function seatLabel(c: Campaign, t: T) {
  const { office, state, district } = c.seat;
  if (office === "senate") return format(t.money.seatSenate, { state });
  const seat = district ? `${state}-${district}` : `${state} ${t.money.atLarge}`;
  return format(t.money.seatHouse, { seat });
}

// ---- Money bar -------------------------------------------------------------

export interface Segment {
  key: string;
  label: string;
  amount: number;
  cls: string;
  /** Light fill: label in dark ink. */
  light?: boolean;
}

const SIZE_CLASSES = ["bg-money-0", "bg-money-1", "bg-money-2", "bg-money-3", "bg-money-4"];

/**
 * Dollar amounts behind the bar. The FEC's size buckets and its totals are computed
 * separately and can disagree: individual money is whichever is larger, and any part
 * the buckets don't cover shows as "size not reported".
 */
function parts(c: Contributions, sizes: number[] | undefined) {
  const sized = sizes?.reduce((a, b) => a + b, 0) ?? 0;
  const useSizes = !!sizes && sized > 0;
  const unknown = useSizes ? Math.max(0, c.individuals - sized) : 0;
  const individuals = useSizes ? sized + unknown : c.individuals;
  return { useSizes, unknown, total: individuals + c.pacs + c.party + c.self };
}

/** Contributions split from grassroots (small donors) to big money (PACs). */
export function segments(c: Contributions, sizes: number[] | undefined, t: T): Segment[] {
  const out: Segment[] = [];
  const { useSizes, unknown } = parts(c, sizes);
  if (useSizes) {
    const labels = [t.money.sizeSmall, t.money.size200, t.money.size500, t.money.size1000, t.money.size2000];
    sizes!.forEach((amount, i) =>
      out.push({ key: `size${i}`, label: labels[i], amount, cls: SIZE_CLASSES[i], light: i >= 1 && i <= 3 }),
    );
    out.push({ key: "unknown", label: t.money.sizeUnknown, amount: unknown, cls: "bg-money-unknown", light: true });
  } else {
    out.push({ key: "individuals", label: t.money.individuals, amount: c.individuals, cls: "bg-money-2", light: true });
  }
  out.push({ key: "pacs", label: t.money.pacs, amount: c.pacs, cls: "bg-money-pac" });
  out.push({ key: "party", label: t.money.party, amount: c.party, cls: "bg-money-party" });
  out.push({ key: "self", label: t.money.self, amount: c.self, cls: "bg-money-self" });
  return out.filter((s) => s.amount > 0);
}

export const segmentTotal = (segs: Segment[]) => segs.reduce((a, s) => a + s.amount, 0);

/** Grassroots = $200 or less. Big money = $2,000+ individuals plus PACs. Same total as the bar. */
export function shares(c: Contributions, sizes: number[] | undefined) {
  const { useSizes, total } = parts(c, sizes);
  if (total <= 0) return { total, grassroots: 0, big: 0, pacs: 0 };
  return {
    total,
    grassroots: useSizes ? sizes![0] / total : 0,
    big: useSizes ? (sizes![4] + c.pacs) / total : c.pacs / total,
    pacs: c.pacs / total,
  };
}

/** One plain-language sentence about where the money came from. */
export function summarySentence(c: Contributions, sizes: number[] | undefined, t: T, lang: string) {
  const s = shares(c, sizes);
  if (s.total <= 0) return null;
  if (s.pacs >= 0.5) return format(t.money.summaryPacs, { pct: percent(s.pacs, lang) });
  if (s.grassroots > 0 && s.big >= 0.5) return format(t.money.summaryBig, { pct: percent(s.big, lang) });
  if (s.grassroots > 0) return format(t.money.summaryGrassroots, { pct: percent(s.grassroots, lang) });
  return format(t.money.summarySplit, {
    individuals: percent((s.total - c.pacs - c.party - c.self) / s.total, lang),
    pacs: percent(s.pacs, lang),
  });
}

export function StackBar({
  segs,
  lang,
  size = "lg",
}: {
  segs: Segment[];
  lang: string;
  size?: "lg" | "md" | "sm";
}) {
  const total = segmentTotal(segs);
  const height = { lg: "h-9", md: "h-6", sm: "h-2.5" }[size];
  return (
    <div
      className={`flex ${height} overflow-hidden rounded-lg border-2 border-navy bg-white ${size === "sm" ? "rounded-full border" : ""}`}
      aria-hidden
    >
      {segs.map((s) => {
        const share = s.amount / total;
        return (
          <span
            key={s.key}
            title={`${s.label}: ${fullMoney(s.amount, lang)} (${percent(share, lang)})`}
            className={`relative block h-full min-w-0 border-e border-white/60 last:border-e-0 ${s.cls}`}
            style={{ width: `${share * 100}%` }}
          >
            {size === "lg" && share >= 0.07 && (
              <span
                className={`absolute inset-0 grid place-items-center overflow-hidden text-[11px] font-bold whitespace-nowrap ${
                  s.light ? "text-navy-deep" : "text-white"
                }`}
              >
                {percent(share, lang)}
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}

export function Legend({ segs, lang }: { segs: Segment[]; lang: string }) {
  const total = segmentTotal(segs);
  return (
    <ul className="grid grid-cols-1 gap-x-5 gap-y-1 text-sm sm:grid-cols-2">
      {segs.map((s) => (
        <li key={s.key} className="flex items-center gap-2">
          <span className={`h-3 w-3 shrink-0 rounded-sm ${s.cls}`} aria-hidden />
          <span className="flex-1">{s.label}</span>
          <span className="tabular-nums text-navy/60">
            <b className="font-semibold text-ink">{percent(s.amount / total, lang)}</b> {money(s.amount, lang)}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** The bar with its two ends labeled, for where grassroots vs. big money is the point. */
export function FundingBar({
  c,
  sizes,
  t,
  lang,
  size = "lg",
}: {
  c: Contributions;
  sizes: number[] | undefined;
  t: T;
  lang: string;
  size?: "lg" | "md";
}) {
  const segs = segments(c, sizes, t);
  if (!segs.length) return null;
  const s = shares(c, sizes);
  return (
    <div className="space-y-1.5">
      {s.grassroots > 0 && (
        <div className="flex justify-between font-display text-xs sm:text-sm">
          <span className="text-money-0">
            {t.money.grassroots} {percent(s.grassroots, lang)}
          </span>
          <span className="text-money-4">
            {t.money.bigMoney} {percent(s.big, lang)}
          </span>
        </div>
      )}
      <StackBar segs={segs} lang={lang} size={size} />
    </div>
  );
}

export function MoneyTable({ segs, t, lang }: { segs: Segment[]; t: T; lang: string }) {
  const total = segmentTotal(segs);
  return (
    <details className="text-sm">
      <summary className="cursor-pointer font-semibold text-navy">{t.money.showTable}</summary>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full border-collapse tabular-nums">
          <thead>
            <tr className="border-b border-navy/15 text-start">
              <th className="py-1 pe-2 text-start">{t.money.source}</th>
              <th className="py-1 px-2 text-end">{t.money.amount}</th>
              <th className="py-1 ps-2 text-end">{t.money.share}</th>
            </tr>
          </thead>
          <tbody>
            {segs.map((s) => (
              <tr key={s.key} className="border-b border-navy/10">
                <td className="py-1 pe-2">{s.label}</td>
                <td className="py-1 px-2 text-end">{fullMoney(s.amount, lang)}</td>
                <td className="py-1 ps-2 text-end">{percent(s.amount / total, lang)}</td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td className="py-1 pe-2">{t.money.totalContributions}</td>
              <td className="py-1 px-2 text-end">{fullMoney(total, lang)}</td>
              <td className="py-1 ps-2 text-end">{percent(1, lang)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </details>
  );
}

// ---- Outcomes and results ---------------------------------------------------

/** The candidate's vote share in the deciding stage, e.g. "Won 70.4%". */
export function outcomeLabel(c: Campaign, t: T, lang: string) {
  const deciding = [...c.stages].reverse().find((s) => (c.outcome === "lostPrimary" ? s.primary && !s.won : !s.primary));
  const mine = deciding?.candidates.find((x) => x.me);
  const pct = mine ? ` ${new Intl.NumberFormat(lang, { maximumFractionDigits: 1 }).format(mine.pct)}%` : "";
  switch (c.outcome) {
    case "won":
      return `${t.money.won}${pct}`;
    case "lost":
      return `${t.money.lost}${pct}`;
    case "lostPrimary":
      return `${t.money.lostPrimary}${pct}`;
    case "upcoming":
      return format(t.money.upcoming, { date: formatElectionDate(c.electionDate!, lang) });
    default:
      return null;
  }
}

export const OUTCOME_STYLE: Record<Campaign["outcome"], string> = {
  won: "border-emerald-600 text-emerald-700",
  lost: "border-red-700 text-red-700",
  lostPrimary: "border-red-700 text-red-700",
  upcoming: "border-gold bg-gold text-navy-deep",
  unknown: "",
};

export function StageResults({ stage, t, lang }: { stage: StageResult; t: T; lang: string }) {
  const num = new Intl.NumberFormat(lang, { maximumFractionDigits: 1 });
  return (
    <div className="rounded-xl border border-navy/15 bg-white px-3 py-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs font-bold tracking-wide text-navy uppercase">
        <span lang="en">
          {stage.year} · {stage.stage}
        </span>
        {stage.url && (
          <a href={stage.url} target="_blank" rel="noreferrer" className="font-medium normal-case underline">
            {t.money.officialResults} ↗
          </a>
        )}
      </div>
      <ul className="mt-1.5 space-y-1">
        {stage.candidates.map((c) => (
          <li key={c.name} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-2 text-sm">
            <span lang="en" className={`truncate ${c.me ? "font-bold" : ""}`}>
              {c.name}
              {c.party && <span className="font-normal text-navy/50"> ({c.party})</span>}
            </span>
            <span className="h-3 overflow-hidden rounded-full bg-navy/10" aria-hidden>
              <span
                className={`block h-full rounded-full ${c.me ? "bg-navy" : "bg-navy/35"}`}
                style={{ width: `${c.pct}%` }}
              />
            </span>
            <span className="min-w-14 text-end font-semibold tabular-nums">{num.format(c.pct)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---- PAC kinds --------------------------------------------------------------

export const PAC_KINDS: PacKind[] = ["labor", "corporate", "trade", "politician", "other"];

export const PAC_CLASS: Record<PacKind, string> = {
  labor: "bg-pac-labor",
  corporate: "bg-pac-corporate",
  trade: "bg-pac-trade",
  politician: "bg-pac-politician",
  other: "bg-pac-other",
};

export function pacLabel(kind: PacKind, t: T) {
  return {
    labor: t.money.pacLabor,
    corporate: t.money.pacCorporate,
    trade: t.money.pacTrade,
    politician: t.money.pacPolitician,
    other: t.money.pacOther,
  }[kind];
}

export function pacTag(kind: PacKind, t: T) {
  return {
    labor: t.money.tagLabor,
    corporate: t.money.tagCorporate,
    trade: t.money.tagTrade,
    politician: t.money.tagPolitician,
    other: t.money.tagOther,
  }[kind];
}
