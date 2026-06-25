"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ProductMockup from "@/components/shared/ProductMockup";

const DEMO_HERO = "Arjun";

const PRODUCTS = [
  {
    slug: "printed_storybook",
    name: "Printed Storybook",
    tagline: "A real book, their real story",
    price: "₹599",
    emoji: "📚",
    tag: "Most gifted",
    tagColor: "bg-brand text-white",
  },
  {
    slug: "hero_apparel",
    name: "Hero T-Shirt",
    tagline: "Wear your superpowers",
    price: "₹399",
    emoji: "👕",
    tag: "Kids love it",
    tagColor: "bg-gold text-black",
  },
  {
    slug: "sticker_sheet",
    name: "Sticker Sheet",
    tagline: "12 hero stickers per sheet",
    price: "₹149",
    emoji: "✨",
    tag: "Perfect party favor",
    tagColor: "bg-emerald-500 text-white",
  },
  {
    slug: "hero_poster",
    name: "Hero Poster",
    tagline: "A4 print-ready hero portrait",
    price: "₹249",
    emoji: "🖼️",
    tag: "Room-ready",
    tagColor: "bg-sky-500 text-white",
  },
  {
    slug: "hero_certificate_pdf",
    name: "Hero Certificate",
    tagline: "Official universe certificate",
    price: "₹99",
    emoji: "🏆",
    tag: "Instant PDF",
    tagColor: "bg-rose-500 text-white",
  },
];

export default function MerchandiseShowcase() {
  const scrollRef = useRef<HTMLDivElement>(null);

  function scroll(dir: "left" | "right") {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: dir === "left" ? -320 : 320, behavior: "smooth" });
  }

  return (
    <section className="py-24 bg-cream relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-brand/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-6">
        <div className="text-center mb-12">
          <p className="text-brand text-xs font-bold tracking-[0.2em] uppercase mb-3">BRING THE UNIVERSE TO LIFE</p>
          <h2 className="font-[family-name:var(--font-display)] text-ink text-4xl md:text-5xl mb-4">
            Print it. Wear it. Celebrate it.
          </h2>
          <p className="text-ink-mid text-lg max-w-xl mx-auto">
            Turn your child&apos;s universe into physical keepsakes — storybooks, t-shirts, stickers and more.
            Every product features their unique hero.
          </p>
        </div>

        {/* Scroll buttons */}
        <div className="relative">
          <button
            onClick={() => scroll("left")}
            aria-label="Scroll left"
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-20 w-10 h-10 rounded-full bg-white shadow-card border border-ink/10 flex items-center justify-center hover:bg-brand hover:text-white hover:border-brand transition-all"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => scroll("right")}
            aria-label="Scroll right"
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-20 w-10 h-10 rounded-full bg-white shadow-card border border-ink/10 flex items-center justify-center hover:bg-brand hover:text-white hover:border-brand transition-all"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          {/* Scrollable product strip */}
          <div
            ref={scrollRef}
            className="flex gap-5 overflow-x-auto pb-4 scroll-smooth snap-x snap-mandatory hide-scrollbar"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {PRODUCTS.map((p) => (
              <div
                key={p.slug}
                className="shrink-0 w-[280px] snap-start bg-white rounded-3xl shadow-card border border-ink/8 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
              >
                {/* Mockup preview */}
                <div className="aspect-[4/3] bg-ink/[0.02] relative overflow-hidden">
                  <ProductMockup
                    productSlug={p.slug}
                    heroName={DEMO_HERO}
                    storyTitle="Arjun and the Starlight Mission"
                    className="w-full h-full"
                  />

                  {/* Tag badge */}
                  <div className="absolute top-3 right-3">
                    <span className={`text-[10px] font-black px-2.5 py-1 rounded-full ${p.tagColor}`}>
                      {p.tag}
                    </span>
                  </div>
                </div>

                {/* Product info */}
                <div className="p-5">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-[family-name:var(--font-display)] text-ink text-lg">{p.emoji} {p.name}</h3>
                    <span className="font-bold text-brand text-lg">{p.price}</span>
                  </div>
                  <p className="text-ink-muted text-xs mb-4">{p.tagline}</p>
                  <a
                    href="/register"
                    className="block w-full text-center bg-brand/8 hover:bg-brand hover:text-white border border-brand/20 hover:border-brand text-brand text-sm font-semibold py-2.5 rounded-full transition-all"
                  >
                    Order for my hero →
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom note */}
        <p className="text-center text-ink-muted text-sm mt-8">
          Each product is personalized with your child&apos;s unique avatar and story details.
          Fulfilled and shipped within 5–7 working days.
        </p>
      </div>
    </section>
  );
}
