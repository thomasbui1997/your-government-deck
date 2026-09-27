import Link from "next/link";
import { getDictionary, href } from "@/i18n/server";

export default async function NotFound() {
  const t = await getDictionary();
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <p className="text-5xl" aria-hidden>
        🂠
      </p>
      <h1 className="font-display text-2xl text-navy">{t.notFound.title}</h1>
      <p className="max-w-sm text-navy/70">{t.notFound.body}</p>
      <Link
        href={await href("/")}
        className="rounded-xl border-4 border-navy bg-gold px-5 py-2 font-display text-navy shadow-[4px_4px_0_var(--color-navy)]"
      >
        {t.notFound.home}
      </Link>
    </main>
  );
}
