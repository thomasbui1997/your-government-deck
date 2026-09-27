import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ActivityTimeline } from "@/components/ActivityTimeline";
import { MoneyPanel, MoneyPanelSkeleton } from "@/components/MoneyPanel";
import { OfficialCard } from "@/components/OfficialCard";
import { PromiseTracker } from "@/components/PromiseTracker";
import { SiteHeader } from "@/components/SiteHeader";
import { format, LOCALE_INFO } from "@/i18n/config";
import { officeTitle, tierTitle } from "@/i18n/labels";
import { getDictionary, getLocale, href } from "@/i18n/server";
import { SOCIAL_LABELS } from "@/lib/socials";
import { getProfile } from "@/lib/resolve";

const panel =
  "rounded-2xl border-4 border-navy bg-white p-5 text-start shadow-[6px_6px_0_var(--color-navy)]";

export default async function OfficialPage(props: PageProps<"/[locale]/official/[id]">) {
  const { id } = await props.params;
  const profile = await getProfile(id);
  if (!profile) notFound();
  const { official, contact, activity } = profile;
  const t = await getDictionary();
  const locale = await getLocale();

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
        <div className="flex flex-col items-center gap-10 md:flex-row md:items-start">
          <div className="md:sticky md:top-24">
            <OfficialCard official={official} size="hero" />
          </div>

          <div className="w-full flex-1 space-y-6 text-center md:text-start">
            <div className="space-y-2">
              <p className="font-display text-xs tracking-wide text-navy/60 uppercase">
                {tierTitle(profile.tierLabel, t)}
              </p>
              <h1 className="font-display text-3xl text-navy sm:text-4xl">
                {official.name}
              </h1>
              <p className="text-lg text-navy/80">
                {officeTitle(official.office, t)}
                {official.role && ` (${t.card[official.role]})`} · {official.jurisdiction}
                {official.termEnds && ` · ${format(t.profile.termEnds, { year: official.termEnds })}`}
              </p>
            </div>

            {(contact.website || contact.phone || contact.email) && (
              <div className="flex flex-wrap justify-center gap-2 md:justify-start">
                {contact.website && (
                  <a
                    href={contact.website}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl border-4 border-navy bg-gold px-4 py-1.5 font-display text-sm text-navy shadow-[3px_3px_0_var(--color-navy)]"
                  >
                    🌐 {t.profile.website}
                  </a>
                )}
                {contact.phone && (
                  <a
                    // "781-341-1300 x9211" dials the extension after a pause.
                    href={`tel:${contact.phone.replace(/\s*x\s*/i, ",").replace(/[^\d+,]/g, "")}`}
                    className="rounded-xl border-4 border-navy bg-white px-4 py-1.5 font-display text-sm text-navy shadow-[3px_3px_0_var(--color-navy)]"
                  >
                    📞 {contact.phone}
                  </a>
                )}
                {contact.email && (
                  <a
                    href={`mailto:${contact.email}`}
                    className="rounded-xl border-4 border-navy bg-white px-4 py-1.5 font-display text-sm text-navy shadow-[3px_3px_0_var(--color-navy)]"
                  >
                    ✉️ {t.profile.email}
                  </a>
                )}
              </div>
            )}
            {contact.socials && contact.socials.length > 0 && (
              <nav
                aria-label={t.profile.social}
                className="flex flex-wrap justify-center gap-1.5 md:justify-start"
              >
                {contact.socials.map((s) => (
                  <a
                    key={s.url}
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border-2 border-navy/30 bg-white px-3 py-0.5 text-sm text-navy hover:border-navy"
                  >
                    {SOCIAL_LABELS[s.platform]}
                  </a>
                ))}
              </nav>
            )}
            {contact.office && (
              <p className="text-sm text-navy/60">
                📍{" "}
                <span lang="en" dir="ltr">
                  {contact.office}
                </span>
              </p>
            )}

            {/^[A-Z]\d{6}$/.test(official.id) && (
              // Streams in after the rest of the profile: FEC calls can be slow.
              <Suspense fallback={<MoneyPanelSkeleton />}>
                <MoneyPanel bioguideId={official.id} />
              </Suspense>
            )}

            <section className={panel}>
              <h2 className="font-display text-navy">{t.profile.promiseTracker}</h2>
              {profile.promises ? (
                <PromiseTracker data={profile.promises} />
              ) : (
                <p className="mt-1 text-sm text-navy/60">
                  {format(t.profile.notTrackedYet, { name: official.name })}{" "}
                  <Link href={await href("/methodology")} className="underline">
                    {t.profile.howTrackingWorks}
                  </Link>
                </p>
              )}
            </section>

            <section className={panel}>
              <h2 className="font-display text-navy">{t.profile.latestActivity}</h2>
              {profile.activityNote ? (
                <p className="mt-1 text-sm text-navy/60">
                  {t.profile[profile.activityNote]}
                </p>
              ) : (
                <>
                  {locale !== "en" && activity.length > 0 && (
                    <p className="mt-1 text-xs text-navy/60">{t.profile.englishRecords}</p>
                  )}
                  <ActivityTimeline items={activity} />
                </>
              )}
            </section>

            {profile.sources && profile.sources.length > 0 && (
              <section className="text-start text-sm text-navy/70">
                <h2 className="font-display text-xs tracking-wide text-navy/60 uppercase">
                  {t.profile.sources}
                </h2>
                <ul className="mt-1 list-disc space-y-0.5 ps-5">
                  {profile.sources.map((s) => (
                    <li key={s.url}>
                      <a href={s.url} target="_blank" rel="noreferrer" lang="en" className="underline">
                        {s.title}
                      </a>
                    </li>
                  ))}
                </ul>
                {profile.checked && (
                  <p className="mt-1 text-xs text-navy/50">
                    {format(t.profile.checked, {
                      date: new Date(`${profile.checked}T12:00:00`).toLocaleDateString(
                        LOCALE_INFO[locale].htmlLang,
                        { year: "numeric", month: "short", day: "numeric" },
                      ),
                    })}
                  </p>
                )}
              </section>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
