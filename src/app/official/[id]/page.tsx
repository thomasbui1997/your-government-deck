import Link from "next/link";
import { notFound } from "next/navigation";
import { ActivityTimeline } from "@/components/ActivityTimeline";
import { OfficialCard } from "@/components/OfficialCard";
import { PromiseTracker } from "@/components/PromiseTracker";
import { SiteHeader } from "@/components/SiteHeader";
import { getProfile } from "@/lib/resolve";

const panel =
  "rounded-2xl border-4 border-navy bg-white p-5 text-start shadow-[6px_6px_0_var(--color-navy)]";

export default async function OfficialPage(props: PageProps<"/official/[id]">) {
  const { id } = await props.params;
  const profile = await getProfile(id);
  if (!profile) notFound();
  const { official, contact, activity } = profile;

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
                {profile.tierTitle}
                {profile.sample && " · sample data"}
              </p>
              <h1 className="font-display text-3xl text-navy sm:text-4xl">
                {official.name}
              </h1>
              <p className="text-lg text-navy/80">
                {official.office} · {official.jurisdiction}
                {official.termEnds && ` · term ends ${official.termEnds}`}
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
                    🌐 Website
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
                    ✉️ Email
                  </a>
                )}
              </div>
            )}
            {contact.office && (
              <p className="text-sm text-navy/60">📍 {contact.office}</p>
            )}

            <section className={panel}>
              <h2 className="font-display text-navy">Promise tracker</h2>
              {profile.promises ? (
                <PromiseTracker data={profile.promises} />
              ) : (
                <p className="mt-1 text-sm text-navy/60">
                  We haven&apos;t tracked {official.name}&apos;s campaign promises yet.{" "}
                  <Link href="/methodology" className="underline">
                    How promise tracking works
                  </Link>
                </p>
              )}
            </section>

            <section className={panel}>
              <h2 className="font-display text-navy">Latest activity</h2>
              {profile.sample || profile.activityNote ? (
                <p className="mt-1 text-sm text-navy/60">
                  {profile.activityNote ??
                    "Real activity for this office arrives in a later build step."}
                </p>
              ) : (
                <ActivityTimeline items={activity} />
              )}
            </section>
          </div>
        </div>
      </main>
    </>
  );
}
