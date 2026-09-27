"use client";

import { useActionState } from "react";
import { type AddressLookupState, lookupAddress } from "@/app/z/[zip]/actions";

export function AddressLookup({ zip }: { zip: string }) {
  const [state, formAction, pending] = useActionState<AddressLookupState, FormData>(
    lookupAddress,
    {},
  );

  return (
    <form action={formAction} className="mt-3">
      <input type="hidden" name="zip" value={zip} />
      <label htmlFor="address" className="block font-medium">
        Enter your street address to narrow it down:
      </label>
      <div className="mt-2 flex gap-2">
        <input
          id="address"
          name="address"
          autoComplete="street-address"
          placeholder="10 Pearl St"
          required
          className="min-w-0 flex-1 rounded-xl border-4 border-navy bg-white px-3 py-1.5 text-navy placeholder:text-navy/30 focus:border-gold focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl border-4 border-navy bg-navy px-4 font-display text-sm text-cream shadow-[3px_3px_0_var(--color-gold)] disabled:opacity-60"
        >
          {pending ? "Looking…" : "Find mine"}
        </button>
      </div>
      <p aria-live="polite" className="mt-2 min-h-5 text-party-r">
        {state.error}
      </p>
      <p className="text-xs text-navy/60">
        We send your address to the U.S. Census Geocoder to find your districts,
        and never store it.
      </p>
    </form>
  );
}
