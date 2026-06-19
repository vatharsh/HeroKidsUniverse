import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

const packs = [
  {
    label: "1 Credit",
    price: "149",
    sublabel: "per story",
    features: [
      "1 personalized storybook",
      "Comic-style illustrations",
      "Audio narration included",
      "Print-ready PDF",
      "Download forever",
    ],
    cta: "Buy Single Story",
    popular: false,
  },
  {
    label: "5 Credits",
    price: "499",
    sublabel: "for 5 stories — ₹99 each",
    features: [
      "5 personalized storybooks",
      "All 6 adventure themes",
      "Comic-style illustrations",
      "Audio narration",
      "Print-ready PDFs",
      "Share with family",
      "Priority generation",
    ],
    cta: "Get Family Pack",
    popular: true,
  },
  {
    label: "10 Credits",
    price: "999",
    sublabel: "for 10 stories — ₹99 each",
    features: [
      "10 personalized storybooks",
      "All 6 adventure themes",
      "Comic-style illustrations",
      "Audio narration",
      "Print-ready PDFs",
      "Perfect as a birthday gift",
      "Priority generation",
      "Digital gift card included",
    ],
    cta: "Get Birthday Pack",
    popular: false,
  },
];

export default function PricingSection() {
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
            ✨ Try one sample page free — no account needed
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {packs.map((pack) => (
            <div
              key={pack.label}
              className={cn(
                "relative bg-white rounded-3xl p-8 shadow-card flex flex-col",
                pack.popular && "ring-2 ring-brand md:scale-105 md:z-10",
              )}
            >
              {pack.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-brand text-white text-xs font-bold px-4 py-1.5 rounded-full whitespace-nowrap">
                  ⭐ Most Popular
                </div>
              )}

              <p className="text-brand text-sm font-bold uppercase tracking-wider mb-2">
                {pack.label}
              </p>
              <div>
                <span className="text-3xl font-black text-ink">₹</span>
                <span className="font-[family-name:var(--font-display)] font-black text-ink text-5xl">
                  {pack.price}
                </span>
              </div>
              <p className="text-ink-muted text-sm mt-1 mb-6">{pack.sublabel}</p>
              <div className="border-t border-ink/10 mb-6" />

              <div className="flex flex-col gap-3 mb-8 flex-1">
                {pack.features.map((feature) => (
                  <div key={feature} className="flex items-start gap-3">
                    <Check className="w-4 h-4 text-brand flex-shrink-0 mt-0.5" />
                    <span className="text-ink-mid text-sm">{feature}</span>
                  </div>
                ))}
              </div>

              <a
                href="/create"
                className={cn(
                  "w-full py-3.5 rounded-full font-bold text-base transition-all text-center",
                  pack.popular
                    ? "bg-brand hover:bg-brand-dark text-white shadow-brand hover:scale-[1.02]"
                    : "bg-brand-50 hover:bg-brand text-brand hover:text-white border border-brand/20",
                )}
              >
                {pack.cta}
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
