"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { tierTitle } from "@/i18n/labels";
import type { Level, Tier } from "@/lib/types";
import { OfficialCard } from "./OfficialCard";

const levelColor: Record<Level, string> = {
  federal: "bg-tier-federal",
  state: "bg-tier-state",
  county: "bg-tier-county",
  town: "bg-tier-town",
  school: "bg-tier-school",
};

export function TierBand({ tier, index }: { tier: Tier; index: number }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(true);

  return (
    <section className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`${levelColor[tier.level]} mx-auto flex items-center gap-2 rounded-full px-4 py-1.5 font-display text-xs tracking-wide text-cream uppercase shadow`}
      >
        {tierTitle(tier.label, t)}
        {tier.sample && (
          <span className="rounded-full bg-cream/25 px-2 text-[10px]">{t.deck.sample}</span>
        )}
        <span className={`transition-transform ${open ? "" : "-rotate-90 rtl:rotate-90"}`}>
          ▾
        </span>
      </button>

      {open && (
        <div className="mt-4">
          {tier.comingSoon ? (
            <div className="mx-auto flex h-48 w-60 flex-col items-center justify-center rounded-2xl border-4 border-dashed border-navy/25 text-center text-sm text-navy/50">
              <span className="text-3xl">🎴</span>
              {t.deck.comingSoon}
            </div>
          ) : (
            // Scrolls sideways on narrow screens, centers when it fits.
            <div className="flex snap-x gap-5 overflow-x-auto px-4 pt-2 pb-6 sm:flex-wrap sm:justify-center sm:overflow-visible">
              {tier.officials.map((o, i) => (
                <motion.div
                  key={o.id}
                  className="flex snap-center"
                  initial={{ opacity: 0, y: -40, rotate: -8, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
                  transition={{
                    type: "spring",
                    stiffness: 260,
                    damping: 20,
                    delay: index * 0.15 + i * 0.08,
                  }}
                >
                  <OfficialCard official={o} />
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
