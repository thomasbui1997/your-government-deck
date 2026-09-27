import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { getDictionary } from "@/i18n/server";
import { STATUS_META, STATUSES } from "@/lib/promises";

const CORRECTIONS_URL = "https://github.com/thomasbui1997/your-government-deck/issues";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return { title: `${t.methodology.metaTitle} · ${t.meta.title}` };
}

function Section({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-10 scroll-mt-24">
      <h2 className="font-display text-xl text-navy">{title}</h2>
      <div className="mt-3 space-y-3 leading-relaxed text-navy/85">{children}</div>
    </section>
  );
}

export default async function MethodologyPage() {
  const t = await getDictionary();
  const m = t.methodology;
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
        <h1 className="font-display text-3xl text-navy sm:text-4xl">{m.title}</h1>
        <p className="mt-3 text-lg text-navy/75">{m.intro}</p>

        <Section title={m.whatTitle}>
          <p>{m.what1}</p>
          <p>
            {m.what2Before}
            <a href="https://web.archive.org" className="underline" target="_blank" rel="noreferrer">
              {m.what2Link}
            </a>
            {m.what2After}
          </p>
        </Section>

        <Section title={m.statusesTitle}>
          <ul className="space-y-2">
            {STATUSES.map((s) => (
              <li key={s} className="flex gap-3">
                <span className={`${STATUS_META[s].color} mt-1 h-3 w-3 shrink-0 rounded-full`} aria-hidden />
                <span>
                  <b>{t.promises.statuses[s].label}</b>: {t.promises.statuses[s].description}
                </span>
              </li>
            ))}
          </ul>
          <p>{m.statusesNote}</p>
        </Section>

        <Section title={m.rolesTitle}>
          <p>{m.roles}</p>
        </Section>

        <Section title={m.scoreTitle}>
          <p>{m.score}</p>
        </Section>

        <Section title={m.reviewTitle}>
          <p>{m.review1}</p>
          <p>{m.review2}</p>
        </Section>

        <Section title={m.limitsTitle}>
          <p>{m.limits}</p>
        </Section>

        <Section id="money" title={m.moneyTitle}>
          <p>{m.money1}</p>
          <p>{m.money2}</p>
          <p>{m.money3}</p>
          <p>{m.money4}</p>
          <p>{m.money5}</p>
        </Section>

        <Section title={m.correctionsTitle}>
          <p>
            {m.correctionsBefore}
            <a href={CORRECTIONS_URL} className="underline" target="_blank" rel="noreferrer">
              {m.correctionsLink}
            </a>
            {m.correctionsAfter}
          </p>
        </Section>
      </main>
    </>
  );
}
