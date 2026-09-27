"use client";

import { useEffect } from "react";
import { useI18n } from "@/i18n/client";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const { t } = useI18n();
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <p className="text-5xl">🃏</p>
      <h1 className="font-display text-2xl text-navy">{t.error.title}</h1>
      <p className="max-w-sm text-navy/70">{t.error.body}</p>
      <button
        type="button"
        onClick={retry}
        className="rounded-xl border-4 border-navy bg-gold px-5 py-2 font-display text-navy shadow-[4px_4px_0_var(--color-navy)]"
      >
        {t.error.retry}
      </button>
    </main>
  );
}
