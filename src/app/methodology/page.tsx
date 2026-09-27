import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { STATUS_META, STATUSES } from "@/lib/promises";

export const metadata: Metadata = {
  title: "How we track promises · Your Government Deck",
  description: "How campaign promises are chosen, scored, and reviewed.",
};

const CORRECTIONS_URL = "https://github.com/thomasbui1997/your-government-deck/issues";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-xl text-navy">{title}</h2>
      <div className="mt-3 space-y-3 leading-relaxed text-navy/85">{children}</div>
    </section>
  );
}

export default function MethodologyPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
        <h1 className="font-display text-3xl text-navy sm:text-4xl">How we track promises</h1>
        <p className="mt-3 text-lg text-navy/75">
          The goal is simple: show what officials said they would do, and what actually happened,
          with the receipts attached.
        </p>

        <Section title="What counts as a promise">
          <p>
            We only track specific, checkable commitments: to pass a law, fund a program, reach a
            target, or take an action. Values statements (“I believe in…”), criticism of opponents,
            and goals too vague to check (“fight for working families”) aren&apos;t included.
          </p>
          <p>
            Promises come from the candidate&apos;s own campaign materials, archived by the{" "}
            <a href="https://web.archive.org" className="underline" target="_blank" rel="noreferrer">
              Internet Archive&apos;s Wayback Machine
            </a>{" "}
            as they appeared just before election day. Every promise links to that archived page and
            quotes it word for word, so you can check the exact wording yourself.
          </p>
        </Section>

        <Section title="Statuses">
          <ul className="space-y-2">
            {STATUSES.map((s) => (
              <li key={s} className="flex gap-3">
                <span
                  className={`${STATUS_META[s].color} mt-1 h-3 w-3 shrink-0 rounded-full`}
                  aria-hidden
                />
                <span>
                  <b>{STATUS_META[s].label}</b>: {STATUS_META[s].description}
                </span>
              </li>
            ))}
          </ul>
          <p>
            Promises are judged against their original wording, not a later, narrower version.
          </p>
        </Section>

        <Section title="Executives and legislators are scored differently">
          <p>
            A governor or mayor can sign laws, write budgets, and run agencies, so we score them on
            outcomes. A single legislator is one vote among many and can&apos;t pass a bill alone, so
            sponsoring a bill, voting for it, and moving it through committee all count as progress
            for them.
          </p>
        </Section>

        <Section title="The score">
          <p>
            The headline percentage counts each kept promise fully and each compromise as half, out
            of all tracked promises. “In progress” counts as zero until something is delivered.
          </p>
        </Section>

        <Section title="How statuses are researched and reviewed">
          <p>
            An AI model (Anthropic&apos;s Claude) drafts the list of promises from the archived
            pages, then searches the web for what happened, preferring primary sources such as
            government websites, legislative records, and budgets, then established news outlets.
          </p>
          <p>
            Nothing it drafts is published automatically. Automated checks flag any quote that
            doesn&apos;t appear word for word on the source page and any evidence link the model
            didn&apos;t actually find in its research. Then a person reviews every promise, edits or
            rejects it, and approves it before it appears here. Each promise shows when it was last
            reviewed.
          </p>
        </Section>

        <Section title="Limits">
          <p>
            Tracking is only as good as the public record. Some promises are hard to measure,
            evidence can lag behind events, and reasonable people can disagree about whether a
            compromise counts. We&apos;d rather say “not started, little evidence found” than guess.
          </p>
        </Section>

        <Section title="Corrections">
          <p>
            Spot a mistake or missing evidence?{" "}
            <a href={CORRECTIONS_URL} className="underline" target="_blank" rel="noreferrer">
              Open an issue on GitHub
            </a>{" "}
            with a link to your source, and we&apos;ll review it.
          </p>
        </Section>
      </main>
    </>
  );
}
