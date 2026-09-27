"use client";

import { startTransition, useActionState, useEffect, useId, useRef, useState } from "react";
import { type AddressLookupState, lookupAddress } from "@/app/actions";
import { useI18n } from "@/i18n/client";

interface Suggestion {
  placeId: string;
  main: string;
  secondary: string;
}

/**
 * Address search. With Google Places enabled (`placesOn`), it suggests addresses, zips,
 * and towns as you type; without it, it takes a full street address or a zip.
 */
export function AddressInput({
  compact = false,
  placesOn = false,
}: {
  compact?: boolean;
  placesOn?: boolean;
}) {
  const { t, locale } = useI18n();
  const [state, formAction, pending] = useActionState<AddressLookupState, FormData>(
    lookupAddress,
    {},
  );
  // Controlled so a failed lookup doesn't wipe what they typed (form actions reset uncontrolled fields).
  const [address, setAddress] = useState("");
  // Tagged with the query they answer, so stale results never show for newer text.
  const [results, setResults] = useState<{ q: string; list: Suggestion[] }>({ q: "", list: [] });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  // Groups keystrokes and the final lookup into one billed Places session; renewed after each submit.
  const session = useRef("");
  const listId = useId();

  const query = address.trim();
  const wantsSuggestions = placesOn && query.length >= 3 && !/^\d{5}$/.test(query);
  const suggestions = wantsSuggestions && results.q === query ? results.list : [];

  useEffect(() => {
    // Closed after a pick or blur: filling in the picked text shouldn't fetch again.
    if (!open || !wantsSuggestions) return;
    const q = query;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      session.current ||= crypto.randomUUID();
      const params = new URLSearchParams({ q, s: session.current });
      try {
        const res = await fetch(`/api/places?${params}`, { signal: ctrl.signal });
        const data: { suggestions: Suggestion[] } = await res.json();
        setResults({ q, list: data.suggestions });
        setActive(-1);
      } catch {
        // Aborted by the next keystroke, or offline: submitting the text still works.
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [open, query, wantsSuggestions]);

  function submit(text: string, placeId = "") {
    const data = new FormData();
    data.set("address", text);
    data.set("placeId", placeId);
    data.set("session", session.current);
    data.set("locale", locale);
    session.current = "";
    setOpen(false);
    startTransition(() => formAction(data));
  }

  function pick(s: Suggestion) {
    const text = s.secondary ? `${s.main}, ${s.secondary}` : s.main;
    setAddress(text);
    submit(text, s.placeId);
  }

  const showList = open && suggestions.length > 0;
  const activeId = showList && active >= 0 ? `${listId}-${active}` : undefined;

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showList) {
      if (e.key === "ArrowDown" && suggestions.length) setOpen(true);
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      // Cycles through the options and back to the text box (-1).
      const n = suggestions.length + 1;
      setActive((i) => ((i + 1 + step + n) % n) - 1);
    } else if (e.key === "Enter" && active >= 0 && active < suggestions.length) {
      e.preventDefault();
      pick(suggestions[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const placeholder = placesOn
    ? compact
      ? t.address.placeholderAnyShort
      : t.address.placeholderAny
    : compact
      ? t.address.placeholderShort
      : t.address.placeholder;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit(address.trim());
      }}
      className={`relative text-start ${compact ? "" : "w-full max-w-lg"}`}
    >
      <div className="flex items-stretch gap-2">
        <input
          name="address"
          role={placesOn ? "combobox" : undefined}
          aria-expanded={placesOn ? showList : undefined}
          aria-controls={placesOn ? listId : undefined}
          aria-activedescendant={activeId}
          aria-autocomplete={placesOn ? "list" : undefined}
          autoComplete={placesOn ? "off" : "street-address"}
          placeholder={placeholder}
          aria-label={placesOn ? t.address.labelAny : t.address.label}
          required
          value={address}
          onChange={(e) => {
            setAddress(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
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

      {placesOn && (
        <ul
          id={listId}
          role="listbox"
          aria-label={t.address.suggestions}
          hidden={!showList}
          className={`absolute z-20 mt-2 overflow-hidden rounded-xl border-4 border-navy bg-white shadow-[4px_4px_0_var(--color-navy)] ${compact ? "end-0 w-80 max-w-[calc(100vw-2rem)]" : "inset-x-0"}`}
        >
          {suggestions.map((s, i) => (
            <li
              key={s.placeId}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              // mousedown, not click: fires before the input's blur closes the list.
              onMouseDown={(e) => {
                e.preventDefault();
                pick(s);
              }}
              onMouseEnter={() => setActive(i)}
              className={`cursor-pointer px-4 py-2 text-navy ${i === active ? "bg-gold/40" : ""} ${compact ? "text-sm" : ""}`}
            >
              <span className="font-medium">{s.main}</span>
              {s.secondary && <span className="ms-2 text-navy/50">{s.secondary}</span>}
            </li>
          ))}
          {/* Attribution Google requires when showing Places results. */}
          <li role="presentation" className="border-t border-navy/10 px-4 py-1 text-end text-[10px] text-navy/40">
            Google Maps
          </li>
        </ul>
      )}

      <p
        aria-live="polite"
        className={
          compact
            ? "absolute top-full end-0 mt-2 w-64 rounded-lg bg-cream px-2 py-1 text-end text-xs text-party-r shadow empty:hidden"
            : "mt-2 min-h-5 text-sm text-party-r"
        }
      >
        {!showList && state.error && t.address[state.error]}
      </p>
    </form>
  );
}
