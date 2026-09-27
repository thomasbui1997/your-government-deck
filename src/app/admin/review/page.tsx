import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { type DraftPromise, STATUS_META, STATUSES, TOPICS } from "@/lib/promises";
import { approveDraft, rejectDraft } from "./actions";
import { listDraftFiles, readPublished, reviewEnabled } from "./store";

export const metadata: Metadata = { title: "Review promises", robots: { index: false } };

// Reads the draft files on every request.
export const dynamic = "force-dynamic";

const FLAG_TEXT: Record<string, string> = {
  quote_not_found_on_page: "The quote wasn't found word-for-word on the archived page. Check the source.",
  unknown_source_page: "The source page isn't one of the archived campaign pages.",
  no_evidence: "A status other than “not started” with no evidence.",
  low_confidence: "The model had low confidence in this status.",
  not_assessed: "This promise wasn't assessed.",
};

function flagText(flag: string) {
  if (flag.startsWith("evidence_url_unverified:")) {
    return "Some evidence links never appeared in the model's search results and may be invented. They start unchecked.";
  }
  return FLAG_TEXT[flag] ?? flag;
}

const input =
  "w-full rounded-lg border-2 border-navy/30 bg-white px-2.5 py-1.5 text-sm text-navy focus:border-gold focus:outline-none";

function DraftCard({
  officialId,
  draft,
  currentStatus,
}: {
  officialId: string;
  draft: DraftPromise;
  currentStatus?: string;
}) {
  const unverified = new Set(
    draft.flags
      .find((f) => f.startsWith("evidence_url_unverified:"))
      ?.slice("evidence_url_unverified:".length)
      .split(" ") ?? [],
  );

  return (
    <form className="rounded-2xl border-4 border-navy bg-white p-5 shadow-[6px_6px_0_var(--color-navy)]">
      <input type="hidden" name="officialId" value={officialId} />
      <input type="hidden" name="draftId" value={draft.draftId} />

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-navy px-2 py-0.5 font-bold text-cream">
          {draft.updatesId ? "Status update" : "New promise"}
        </span>
        <span className="text-navy/60">confidence: {draft.confidence}</span>
        {draft.updatesId && currentStatus && (
          <span className="text-navy/80">
            {STATUS_META[currentStatus as keyof typeof STATUS_META]?.label ?? currentStatus} →{" "}
            <b>{STATUS_META[draft.status].label}</b>
          </span>
        )}
      </div>

      {draft.flags.length > 0 && (
        <ul className="mt-3 space-y-1 rounded-lg bg-gold/30 p-3 text-sm text-navy">
          {draft.flags.map((f) => (
            <li key={f}>⚠️ {flagText(f)}</li>
          ))}
        </ul>
      )}

      <label className="mt-4 block text-xs font-bold text-navy/70">
        Promise
        <input name="text" defaultValue={draft.text} className={`${input} mt-1`} />
      </label>

      <blockquote className="mt-3 border-s-4 border-gold ps-3 text-sm text-navy/80 italic">
        “{draft.quote}”{" "}
        <a href={draft.source.url} target="_blank" rel="noreferrer" className="text-xs not-italic underline">
          {draft.source.title}
        </a>
      </blockquote>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-bold text-navy/70">
          Topic
          <select name="topic" defaultValue={draft.topic} className={`${input} mt-1`}>
            {TOPICS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-bold text-navy/70">
          Status
          <select name="status" defaultValue={draft.status} className={`${input} mt-1`}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_META[s].label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="mt-3 block text-xs font-bold text-navy/70">
        Status note
        <textarea name="statusNote" defaultValue={draft.statusNote} rows={2} className={`${input} mt-1`} />
      </label>

      <fieldset className="mt-3">
        <legend className="text-xs font-bold text-navy/70">Evidence (checked items are published)</legend>
        {draft.evidence.length === 0 && <p className="text-sm text-navy/50">None found.</p>}
        <ul className="mt-1 space-y-2">
          {draft.evidence.map((e, i) => {
            const suspect = unverified.has(e.url);
            return (
              <li key={i} className="flex gap-2 text-sm">
                <input type="checkbox" name="evidence" value={i} defaultChecked={!suspect} className="mt-1" />
                <span>
                  <span className="text-xs text-navy/50">
                    {e.date} · {e.kind}
                  </span>{" "}
                  {e.summary}{" "}
                  <a
                    href={e.url}
                    target="_blank"
                    rel="noreferrer"
                    className={`text-xs break-all underline ${suspect ? "text-party-r" : "text-navy/70"}`}
                  >
                    {suspect ? "⚠️ unverified link" : new URL(e.url).hostname}
                  </a>
                </span>
              </li>
            );
          })}
        </ul>
      </fieldset>

      <div className="mt-5 flex gap-2">
        <button
          formAction={approveDraft}
          className="rounded-xl border-4 border-navy bg-emerald-600 px-4 py-1.5 font-display text-sm text-white shadow-[3px_3px_0_var(--color-navy)]"
        >
          Approve & publish
        </button>
        <button
          formAction={rejectDraft}
          className="rounded-xl border-4 border-navy bg-white px-4 py-1.5 font-display text-sm text-navy shadow-[3px_3px_0_var(--color-navy)]"
        >
          Reject
        </button>
      </div>
    </form>
  );
}

export default function ReviewPage() {
  if (!reviewEnabled) notFound();
  const files = listDraftFiles();
  const published = readPublished();

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
        <h1 className="font-display text-3xl text-navy">Review promises</h1>
        <p className="mt-2 text-navy/70">
          Drafts from <code>npm run promises</code>. Approving writes to{" "}
          <code>src/data/promises.json</code>; commit that file to publish.
        </p>

        {files.length === 0 && (
          <p className="mt-8 rounded-2xl border-4 border-dashed border-navy/25 p-8 text-center text-navy/60">
            Nothing to review. 🎉
          </p>
        )}

        {files.map((file) => {
          const current = new Map(
            published[file.officialId]?.promises.map((p) => [p.id, p.status]) ?? [],
          );
          return (
            <section key={file.officialId} className="mt-10">
              <h2 className="font-display text-xl text-navy">
                {file.name} · {file.drafts.length} to review
              </h2>
              <p className="text-xs text-navy/50">
                Generated {new Date(file.generatedAt).toLocaleString("en-US")} by {file.model}
              </p>
              <div className="mt-4 space-y-6">
                {file.drafts.map((d) => (
                  <DraftCard
                    key={d.draftId}
                    officialId={file.officialId}
                    draft={d}
                    currentStatus={d.updatesId ? current.get(d.updatesId) : undefined}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </main>
    </>
  );
}
