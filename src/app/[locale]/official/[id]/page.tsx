import Link from "next/link";
import { notFound } from "next/navigation";
import { ActivityTimeline } from "@/components/ActivityTimeline";
import { OfficialCard } from "@/components/OfficialCard";
import { PromiseTracker } from "@/components/PromiseTracker";
import { SiteHeader } from "@/components/SiteHeader";
import { format } from "@/i18n/config";
import { officeTitle, tierTitle } from "@/i18n/labels";
import { getDictionary, getLocale, href } from "@/i18n/server";
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
                {profile.sample && ` · ${t.profile.sampleData}`}
              </p>
              <h1 className="font-display text-3xl text-navy sm:text-4xl">
                {official.name}
              </h1>
              <p className="text-lg text-navy/80">
                {officeTitle(official.office, t)} · {official.jurisdiction}
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
                    href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`}
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
            {contact.office && (
              <p className="text-sm text-navy/60">📍 {contact.office}</p>
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
              {profile.sample || profile.activityNote ? (
                <p className="mt-1 text-sm text-navy/60">
                  {profile.activityNote ? t.profile[profile.activityNote] : t.profile.activityLater}
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
          </div>
        </div>
      </main>
    </>
  );
}
