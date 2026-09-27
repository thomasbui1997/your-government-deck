"use client";

import { useActionState, useState } from "react";
import { type AddressLookupState, lookupAddress } from "@/app/actions";
import { useI18n } from "@/i18n/client";

export function AddressInput({ compact = false }: { compact?: boolean }) {
  const { t, locale } = useI18n();
  const [state, formAction, pending] = useActionState<AddressLookupState, FormData>(
    lookupAddress,
    {},
  );
  // Controlled so a failed lookup doesn't wipe what they typed (form actions reset uncontrolled fields).
  const [address, setAddress] = useState("");

  return (
    <form action={formAction} className={compact ? "relative" : "w-full max-w-lg"}>
      <input type="hidden" name="locale" value={locale} />
      <div className="flex items-stretch gap-2">
        <input
          name="address"
          autoComplete="street-address"
          placeholder={compact ? t.address.placeholderShort : t.address.placeholder}
          aria-label={t.address.label}
          required
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className={`min-w-0 flex-1 rounded-xl border-4 border-navy bg-white px-4 text-navy placeholder:text-navy/30 focus:border-gold focus:outline-none ${compact ? "w-44 py-1.5 text-sm sm:w-64" : "py-3 text-lg"}`}
        />
        <button
          type="submit"
          disabled={pending}
          className={`rounded-xl border-4 border-navy bg-gold font-display text-navy shadow-[4px_4px_0_var(--color-navy)] transition active:translate-x-1 active:translate-y-1 active:shadow-none disabled:opacity-50 ${compact ? "px-3 text-sm" : "px-5 text-lg"}`}
        >
          {pending ? (
            "…"
          ) : (
            <>
              {!compact && `${t.address.submit} `}
              {/* Points the reading direction: flips for right-to-left languages. */}
              <span className="inline-block rtl:-scale-x-100">▸</span>
            </>
          )}
        </button>
      </div>
      <p
        aria-live="polite"
        className={
          compact
            ? "absolute top-full end-0 mt-2 w-64 rounded-lg bg-cream text-end text-xs text-party-r empty:hidden px-2 py-1 shadow"
            : "mt-2 min-h-5 text-sm text-party-r"
        }
      >
        {state.error && t.address[state.error]}
      </p>
    </form>
  );
}
