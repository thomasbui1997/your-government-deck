"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ZipInput({
  initial = "",
  compact = false,
}: {
  initial?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [zip, setZip] = useState(initial);
  const valid = /^\d{5}$/.test(zip);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) router.push(`/z/${zip}`);
      }}
      className={`flex items-stretch gap-2 ${compact ? "" : "w-full max-w-sm"}`}
    >
      <input
        inputMode="numeric"
        autoComplete="postal-code"
        maxLength={5}
        placeholder="Zip code"
        aria-label="Zip code"
        value={zip}
        onChange={(e) => setZip(e.target.value.replace(/\D/g, ""))}
        className={`min-w-0 flex-1 rounded-xl border-4 border-navy bg-white px-4 font-display tracking-widest text-navy placeholder:text-navy/30 focus:border-gold focus:outline-none ${compact ? "w-28 py-1.5 text-base" : "py-3 text-2xl"}`}
      />
      <button
        type="submit"
        disabled={!valid}
        className={`rounded-xl border-4 border-navy bg-gold font-display text-navy shadow-[4px_4px_0_var(--color-navy)] transition active:translate-x-1 active:translate-y-1 active:shadow-none disabled:opacity-50 ${compact ? "px-3 text-sm" : "px-5 text-lg"}`}
      >
        {compact ? "▸" : "Deal me in ▸"}
      </button>
    </form>
  );
}
