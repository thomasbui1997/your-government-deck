"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/client";
import type { ActivityItem, ActivityKind } from "@/lib/types";

const kinds: { kind: ActivityKind; icon: string }[] = [
  { kind: "vote", icon: "🗳" },
  { kind: "bill", icon: "📜" },
  { kind: "cosponsor", icon: "🤝" },
  { kind: "meeting", icon: "📅" },
  { kind: "post", icon: "💬" },
];

const iconFor = Object.fromEntries(kinds.map((k) => [k.kind, k.icon]));

const voteBadge: Record<string, string> = {
  Yea: "bg-emerald-600 text-white",
  Aye: "bg-emerald-600 text-white",
  Nay: "bg-party-r text-white",
  No: "bg-party-r text-white",
};

function formatDate(iso: string, lang: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(lang, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ActivityTimeline({ items }: { items: ActivityItem[] }) {
  const { t, htmlLang } = useI18n();
  const present = kinds.filter((k) => items.some((i) => i.kind === k.kind));
  const [filter, setFilter] = useState<ActivityKind | "all">("all");
  const shown = filter === "all" ? items : items.filter((i) => i.kind === filter);

  if (!items.length) {
    return <p className="mt-2 text-sm text-navy/60">{t.activity.none}</p>;
  }

  const chip = (active: boolean) =>
    `rounded-full border-2 border-navy px-3 py-0.5 text-sm transition ${active ? "bg-navy text-cream" : "bg-white text-navy hover:bg-gold/30"}`;

  return (
    <div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={chip(filter === "all")} onClick={() => setFilter("all")}>
          {t.activity.all}
        </button>
        {present.map((k) => (
          <button
            key={k.kind}
            type="button"
            className={chip(filter === k.kind)}
            onClick={() => setFilter(k.kind)}
          >
            {k.icon} {t.activity[k.kind]}
          </button>
        ))}
      </div>

      <ol className="mt-4 space-y-3">
        {shown.map((item, i) => (
          <li key={`${item.kind}-${item.date}-${i}`} className="flex gap-3">
            <span className="mt-0.5 text-xl" aria-hidden>
              {iconFor[item.kind]}
            </span>
            <div className="min-w-0 flex-1 border-b border-navy/10 pb-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-navy/60">
                <time dateTime={item.date}>{formatDate(item.date, htmlLang)}</time>
                {item.badge && (
                  <span
                    className={`rounded px-1.5 py-0.5 font-bold ${voteBadge[item.badge] ?? "bg-navy/10 text-navy"}`}
                  >
                    {/* Vote casts are translated; bill numbers stay as they are. */}
                    {t.activity.casts[item.badge] ?? t.activity.docs[item.badge] ?? item.badge}
                  </span>
                )}
              </div>
              {item.url ? (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  lang="en"
                  className="mt-0.5 line-clamp-2 font-medium text-navy hover:underline"
                >
                  {item.title}
                </a>
              ) : (
                <p lang="en" className="mt-0.5 line-clamp-2 font-medium text-navy">
                  {item.title}
                </p>
              )}
              {item.detail && (
                <p lang="en" className="mt-0.5 line-clamp-1 text-sm text-navy/60">
                  {item.detail}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
