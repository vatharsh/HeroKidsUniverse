"use client";

import { useEffect, useState } from "react";

import BuyCreditsSection from "@/components/shared/BuyCreditsSection";
import { fetchActivePacks } from "@/lib/credits";

/**
 * Shown when the day's free preview stories (FREE_PREVIEW_DAILY_LIMIT) are all given out. The parent is
 * already on the waiting list; this offers a full story now, bought right here, so the story they just
 * set up starts straight after payment.
 */
export default function FreeQuotaCard({ onPurchased, onWait }: { onPurchased: () => void; onWait: () => void }) {
  const [price, setPrice] = useState<number | null>(null);
  const [buying, setBuying] = useState(false);

  useEffect(() => {
    fetchActivePacks()
      .then((packs) => {
        const storyPacks = packs.filter((p) => p.packType === "story_credits" && p.isActive && p.credits >= 1);
        const cheapest = storyPacks.sort((a, b) => a.effectivePrice - b.effectivePrice)[0];
        if (cheapest) setPrice(cheapest.effectivePrice);
      })
      .catch(() => {});
  }, []);

  const priceText = price != null ? `₹${Math.round(price)}` : "a small price";

  return (
    <div className="rounded-3xl border-2 border-gold/40 bg-gradient-to-b from-amber-50 to-white p-6 mb-5 text-center">
      <p className="text-4xl mb-2">🌙</p>
      <h3 className="font-[family-name:var(--font-display)] text-ink text-2xl mb-3">Today&apos;s free stories are all given out</h3>
      <p className="text-ink-mid text-sm leading-relaxed mb-3">
        We&apos;re a small, independent team, and every story is made by AI that costs us real money to run — so we can only give away a few free stories each day.
      </p>
      <p className="text-ink text-sm leading-relaxed mb-4">
        <strong>Your free story is saved.</strong>{" "}Come back tomorrow, and we&apos;ll email you the moment it&apos;s ready.
      </p>
      <p className="text-ink-mid text-sm leading-relaxed mb-5">
        <strong className="text-ink">Can&apos;t wait?</strong> Make a full story now for just <strong className="text-ink">{priceText}</strong> — and help us keep free stories coming for other families. 💛
      </p>

      {buying ? (
        <div className="text-left bg-white rounded-2xl border border-ink/10 p-4">
          <BuyCreditsSection source="quota_card" onPurchased={() => onPurchased()} />
          <button type="button" onClick={() => setBuying(false)} className="mt-3 w-full text-ink-muted text-xs hover:text-ink">
            ← Back
          </button>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button type="button" onClick={() => setBuying(true)}
            className="whitespace-nowrap bg-brand hover:bg-brand-dark text-white font-bold px-6 py-3.5 rounded-full shadow-brand transition hover:scale-[1.02]">
            Full story now · {priceText}
          </button>
          <button type="button" onClick={onWait}
            className="whitespace-nowrap bg-white border border-ink/15 text-ink-mid font-semibold px-6 py-3.5 rounded-full hover:border-brand hover:text-brand transition">
            I&apos;ll wait till tomorrow
          </button>
        </div>
      )}
    </div>
  );
}
