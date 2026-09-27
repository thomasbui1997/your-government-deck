"use client";

import Link from "next/link";
import { useState } from "react";
import {
  type PromiseStatus,
  type PublishedPromises,
  STATUS_META,
  STATUSES,
  score,
  type TrackedPromise,
  TOPICS,
} from "@/lib/promises";

const EVIDENCE_LABEL: Record<string, string> = {
  law: "Law",
  bill: "Bill",
  vote: "Vote",
  exec_action: "Executive action",
  budget: "Budget",
  official_statement: "Official statement",
  news: "News",
  report: "Report",
};

function formatDate(d: string) {
  // Evidence dates may be month-only ("2024-03").
  const [y, m, day] = d.split("-").map(Number);
  if (!m) return String(y);
  return new Date(y, m - 1, day || 1).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    ...(day ? { day: "numeric" } : {}),
  });
}

function StatusBadge({ status }: { status: PromiseStatus }) {
  const meta = STATUS_META[status];
  const dark = status !== "not_started" && status !== "in_progress";
  return (
    <span
      className={`${meta.color} ${dark ? "text-white" : "text-navy"} shrink-0 rounded-full px-2 py-0.5 text-xs font-bold whitespace-nowrap`}
    >
      {meta.label}
    </span>
  );
}

function StackedBar({ promises }: { promises: TrackedPromise[] }) {
  return (
    <div className="flex h-4 overflow-hidden rounded-full border-2 border-navy bg-white">
      {STATUSES.map((s) => {
        const n = promises.filter((p) => p.status === s).length;
        if (!n) return null;
        return (
          <div
            key={s}
            className={STATUS_META[s].color}
            style={{ width: `${(n / promises.length) * 100}%` }}
            title={`${STATUS_META[s].label}: ${n}`}
          />
        );
      })}
    </div>
  );
}

function PromiseRow({ promise }: { promise: TrackedPromise }) {
  const meta = STATUS_META[promise.status];
  return (
    <li className="border-b border-navy/10 py-3 last:border-0">
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium text-navy">{promise.text}</p>
        <StatusBadge status={promise.status} />
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-navy/10">
        <div
          className={`h-full rounded-full ${meta.color}`}
          style={{ width: `${Math.max(meta.progress, promise.status === "broken" ? 100 : 0)}%` }}
        />
      </div>
      <p className="mt-2 text-sm text-navy/75">{promise.statusNote}</p>

      <details className="group mt-2 text-sm">
        <summary className="cursor-pointer text-navy/60 select-none hover:text-navy">
          Sources & evidence ({promise.evidence.length})
        </summary>
        <div className="mt-2 space-y-3 rounded-xl bg-cream p-3">
          <blockquote className="border-s-4 border-gold ps-3 text-navy/80 italic">
            “{promise.quote}”
            <footer className="mt-1 text-xs text-navy/60 not-italic">
              Promised on{" "}
              <a href={promise.source.url} target="_blank" rel="noreferrer" className="underline">
                {promise.source.title}
              </a>
              {promise.source.date && ` (archived ${formatDate(promise.source.date)})`}
            </footer>
          </blockquote>
          {promise.evidence.length > 0 && (
            <ol className="space-y-2">
              {promise.evidence.map((e) => (
                <li key={e.url + e.date} className="flex gap-2">
                  <span className="w-20 shrink-0 text-xs text-navy/50">{formatDate(e.date)}</span>
                  <span>
                    <span className="me-1 rounded bg-navy/10 px-1 text-[11px] text-navy/70">
                      {EVIDENCE_LABEL[e.kind] ?? e.kind}
                    </span>
                    <a href={e.url} target="_blank" rel="noreferrer" className="text-navy hover:underline">
                      {e.summary}
                    </a>
                  </span>
                </li>
              ))}
            </ol>
          )}
          <p className="text-xs text-navy/50">Last reviewed {formatDate(promise.lastReviewed)}</p>
        </div>
      </details>
    </li>
  );
}

export function PromiseTracker({ data }: { data: PublishedPromises }) {
  const [filter, setFilter] = useState<PromiseStatus | null>(null);
  const { promises } = data;
  const shown = filter ? promises.filter((p) => p.status === filter) : promises;
  const kept = promises.filter((p) => p.status === "kept").length;

  const topics = TOPICS.map((topic) => ({
    topic,
    items: shown.filter((p) => p.topic === topic),
    all: promises.filter((p) => p.topic === topic),
  })).filter((t) => t.items.length);

  return (
    <div>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-2">
        <p className="text-navy">
          <span className="font-display text-4xl">{score(promises)}%</span>
          <span className="ms-2 text-sm text-navy/70">
            {kept} of {promises.length} promises kept
          </span>
        </p>
        <Link href="/methodology" className="text-xs text-navy/60 underline hover:text-navy">
          How we score
        </Link>
      </div>
      <div className="mt-2">
        <StackedBar promises={promises} />
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
        {STATUSES.map((s) => {
          const n = promises.filter((p) => p.status === s).length;
          if (!n) return null;
          const active = filter === s;
          return (
            <button
              key={s}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(active ? null : s)}
              className={`flex items-center gap-1.5 rounded-full border-2 px-2.5 py-0.5 text-xs transition ${active ? "border-navy bg-navy text-cream" : "border-navy/20 bg-white text-navy hover:border-navy"}`}
            >
              <span className={`h-2.5 w-2.5 rounded-full ${STATUS_META[s].color}`} />
              {STATUS_META[s].label} {n}
            </button>
          );
        })}
      </div>

      <div className="mt-4 space-y-2">
        {topics.map(({ topic, items, all }) => (
          <details key={topic} open className="rounded-xl border-2 border-navy/15 bg-white">
            <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-2.5 select-none">
              <span className="font-display text-sm text-navy">{topic}</span>
              <span className="text-xs text-navy/60">
                {all.filter((p) => p.status === "kept").length}/{all.length} kept
              </span>
            </summary>
            <ul className="px-4 pb-1">
              {items.map((p) => (
                <PromiseRow key={p.id} promise={p} />
              ))}
            </ul>
          </details>
        ))}
      </div>

      <p className="mt-3 text-xs text-navy/50">
        Updated {formatDate(data.updatedAt.slice(0, 10))}. Promises come from archived campaign
        materials; every status is reviewed by a person before it&apos;s published.
      </p>
    </div>
  );
}
