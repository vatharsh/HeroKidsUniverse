"use client";

import { Check, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import { fetchActivePacks, type CreditPack } from "@/lib/credits";

/* Static fallback shown before API loads or if API is unavailable */
const FALLBACK_PACKS = [
  {
    id: "starter",
    name: "Starter",
    slug: "starter",
    description: "Try it out",
    basePrice: 149,
    salePrice: null,
    currency: "INR",
    credits: 1,
    bonusCredits: 0,
    totalCredits: 1,
    promotionName: null,
    promotionType: null,
    promotionValue: null,
    promotionStart: null,
    promotionEnd: null,
    badge: null,
    isFeatured: false,
    isMostPopular: false,
    isBestValue: false,
    sortOrder: 1,
    isActive: true,
    effectivePrice: 149,
    isOnSale: false,
    savingsAmount: 0,
    savingsPct: 0,
    features: [
      "1 personalized storybook",
      "Comic-style illustrations",
      "Audio narration included",
      "Print-ready PDF",
      "Download forever",
    ],
    cta: "Buy Single Story",
  },
  {
    id: "family-pack",
    name: "Family Pack",
    slug: "family-pack",
    description: "5 stories for the whole family",
    basePrice: 699,
    salePrice: 499,
    currency: "INR",
    credits: 5,
    bonusCredits: 1,
    totalCredits: 6,
    promotionName: "Launch Offer",
    promotionType: "flat_amount" as const,
    promotionValue: 200,
    promotionStart: null,
    promotionEnd: null,
    badge: "⭐ Most Popular",
    isFeatured: true,
    isMostPopular: true,
    isBestValue: false,
    sortOrder: 2,
    isActive: true,
    effectivePrice: 499,
    isOnSale: true,
    savingsAmount: 200,
    savingsPct: 29,
    features: [
      "5 personalized storybooks",
      "All 6 adventure themes",
      "Comic-style illustrations",
      "Audio narration",
      "Print-ready PDFs",
      "+1 bonus credit free",
    ],
    cta: "Get Family Pack",
  },
  {
    id: "birthday-pack",
    name: "Birthday Pack",
    slug: "birthday-pack",
    description: "The ultimate gift for young heroes",
    basePrice: 1499,
    salePrice: 999,
    currency: "INR",
    credits: 10,
    bonusCredits: 3,
    totalCredits: 13,
    promotionName: "Best Value",
    promotionType: "flat_amount" as const,
    promotionValue: 500,
    promotionStart: null,
    promotionEnd: null,
    badge: "💎 Best Value",
    isFeatured: false,
    isMostPopular: false,
    isBestValue: true,
    sortOrder: 3,
    isActive: true,
    effectivePrice: 999,
    isOnSale: true,
    savingsAmount: 500,
    savingsPct: 33,
    features: [
      "10 personalized storybooks",
      "All 6 adventure themes",
      "+3 bonus credits free",
      "Perfect birthday gift",
      "Print-ready PDFs",
      "Priority generation",
    ],
    cta: "Get Birthday Pack",
  },
];

type DisplayPack = CreditPack & { features?: string[]; cta?: string };

export default function PricingSection() {
  const [packs, setPacks] = useState<DisplayPack[]>(FALLBACK_PACKS as DisplayPack[]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActivePacks()
      .then(data => {
        if (data.length > 0) setPacks(data as DisplayPack[]);
      })
      .catch(() => {/* keep fallback */})
      .finally(() => setLoading(false));
  }, []);

  return (
    <section id="pricing" className="py-24 bg-cream">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="font-[family-name:var(--font-display)] font-black text-ink text-4xl md:text-5xl mb-4">
            Simple, Honest Pricing
          </h2>
          <p className="text-ink-mid text-lg mb-6">
            Start free. Pay only for the stories you love.
          </p>
          <div className="inline-flex items-center gap-2 bg-brand-50 text-brand border border-brand/20 text-sm font-medium px-4 py-2 rounded-full">
            ✨ Try 3 free stories on signup — no credit card required
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 text-brand animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {packs.map((pack) => {
              const isOnSale = pack.isOnSale && pack.salePrice != null;
              const effectivePrice = pack.effectivePrice ?? pack.basePrice;
              const resource = getPackResource(pack);

              return (
                <div
                  key={pack.id}
                  className={cn(
                    "relative bg-white rounded-3xl p-8 shadow-card flex flex-col",
                    pack.isMostPopular && "ring-2 ring-brand md:scale-105 md:z-10",
                  )}
                >
                  {pack.badge && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-brand text-white text-xs font-bold px-4 py-1.5 rounded-full whitespace-nowrap">
                      {pack.badge}
                    </div>
                  )}

                  <p className="text-brand text-sm font-bold uppercase tracking-wider mb-2">
                    {resource.label}
                    {(pack.packType ?? "story_credits") === "story_credits" && pack.bonusCredits > 0 && (
                      <span className="ml-1 text-brand/60 font-semibold text-xs">+{pack.bonusCredits} free</span>
                    )}
                  </p>

                  <div>
                    {isOnSale && (
                      <p className="text-ink-muted text-sm line-through">₹{Number(pack.basePrice).toLocaleString()}</p>
                    )}
                    <span className="text-3xl font-black text-ink">₹</span>
                    <span className="font-[family-name:var(--font-display)] font-black text-ink text-5xl">
                      {Number(effectivePrice).toLocaleString()}
                    </span>
                  </div>

                  {isOnSale && pack.savingsAmount > 0 ? (
                    <p className="text-emerald-600 text-sm font-bold mt-1 mb-1">
                      Save ₹{pack.savingsAmount.toLocaleString()} ({pack.savingsPct}% off)
                    </p>
                  ) : (
                    <p className="text-ink-muted text-sm mt-1 mb-1">per credit</p>
                  )}

                  {pack.promotionName && (
                    <p className="text-amber-600 text-xs font-bold mb-4">🔥 {pack.promotionName}</p>
                  )}

                  <p className="text-ink-muted text-sm mb-6 leading-snug">{pack.description}</p>

                  <div className="border-t border-ink/10 mb-6" />

                  {pack.features && pack.features.length > 0 && (
                    <div className="flex flex-col gap-3 mb-8 flex-1">
                      {pack.features.map((feature) => (
                        <div key={feature} className="flex items-start gap-3">
                          <Check className="w-4 h-4 text-brand flex-shrink-0 mt-0.5" />
                          <span className="text-ink-mid text-sm">{feature}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <a
                    href="/create"
                    className={cn(
                      "w-full py-3.5 rounded-full font-bold text-base transition-all text-center mt-auto",
                      pack.isMostPopular
                        ? "bg-brand hover:bg-brand-dark text-white shadow-brand hover:scale-[1.02]"
                        : "bg-brand-50 hover:bg-brand text-brand hover:text-white border border-brand/20",
                    )}
                  >
                    {pack.cta ?? `Get ${pack.name}`}
                  </a>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function getPackResource(pack: DisplayPack) {
  const packType = pack.packType ?? "story_credits";
  if (packType === "character_slots") {
    const amount = pack.characterSlots ?? 0;
    return { label: `${amount} Character Slot${amount !== 1 ? "s" : ""}` };
  }
  if (packType === "avatar_refreshes") {
    const amount = pack.avatarRefreshTokens ?? 0;
    return { label: `${amount} Avatar Refresh${amount !== 1 ? "es" : ""}` };
  }
  const amount = pack.credits + pack.bonusCredits;
  return { label: `${amount} Credit${amount !== 1 ? "s" : ""}` };
}
