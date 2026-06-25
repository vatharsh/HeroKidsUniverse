"use client";

import Image from "next/image";
import arjunImg from "../../../../../Arjun_Transparent.png";

const TRANSFORMATIONS = [
  {
    id: "child-hero",
    beforeLabel: "Child's photo",
    beforeIcon: (
      <svg viewBox="0 0 80 80" className="w-full h-full" aria-hidden>
        {/* Camera frame */}
        <rect x="8" y="18" width="64" height="50" rx="8" fill="#E8E4F0" />
        <circle cx="40" cy="43" r="18" fill="#D1C9E8" />
        <circle cx="40" cy="43" r="12" fill="#B8AED8" />
        {/* Person silhouette inside lens */}
        <circle cx="40" cy="38" r="5" fill="#7C3AED" opacity="0.5" />
        <path d="M30 56 Q40 50 50 56" fill="#7C3AED" opacity="0.4" />
        {/* Flash */}
        <rect x="52" y="10" width="14" height="10" rx="3" fill="#F59E0B" opacity="0.7" />
      </svg>
    ),
    afterLabel: "Storybook Hero",
    afterContent: (
      <div className="w-full h-full relative flex items-center justify-center">
        <Image
          src={arjunImg}
          alt="Arjun — storybook hero"
          fill
          className="object-contain drop-shadow-xl"
          sizes="120px"
        />
      </div>
    ),
    afterBg: "bg-gradient-to-br from-indigo-950 to-purple-900",
    headline: "Child → Storybook Hero",
    description: "Upload one photo. Our AI creates a unique illustrated avatar that looks like your child — used across every adventure in their universe.",
    tag: "Identity preserved",
    tagColor: "bg-brand/15 text-brand border-brand/20",
    accentColor: "#A78BFA",
  },
  {
    id: "family",
    beforeLabel: "Family names",
    beforeIcon: (
      <svg viewBox="0 0 80 80" className="w-full h-full" aria-hidden>
        {/* Three person silhouettes */}
        <circle cx="25" cy="30" r="8" fill="#D1C9E8" />
        <path d="M14 52 Q25 44 36 52" fill="#D1C9E8" />
        <circle cx="40" cy="26" r="10" fill="#B8AED8" />
        <path d="M26 50 Q40 42 54 50" fill="#B8AED8" />
        <circle cx="55" cy="30" r="8" fill="#D1C9E8" />
        <path d="M44 52 Q55 44 66 52" fill="#D1C9E8" />
        {/* Heart */}
        <text x="33" y="70" fontSize="14" fill="#EC4899" opacity="0.7">♥</text>
      </svg>
    ),
    afterLabel: "Story Characters",
    afterContent: (
      <div className="w-full h-full flex items-center justify-center p-2">
        <div className="w-full h-full relative">
          {/* Three character avatar circles */}
          <div className="absolute left-2 top-4 w-14 h-14 rounded-full overflow-hidden bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center border-2 border-white/30 shadow-lg">
            <span className="text-2xl">👨</span>
          </div>
          <div className="absolute left-1/2 -translate-x-1/2 top-0 w-16 h-16 rounded-full overflow-hidden bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center border-2 border-gold/40 shadow-lg ring-2 ring-gold/30">
            <span className="text-2xl">⭐</span>
          </div>
          <div className="absolute right-2 top-4 w-14 h-14 rounded-full overflow-hidden bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center border-2 border-white/30 shadow-lg">
            <span className="text-2xl">👩</span>
          </div>
          {/* Connecting line */}
          <div className="absolute bottom-3 left-0 right-0 flex justify-center">
            <span className="text-white/60 text-[10px] font-semibold tracking-wide">The Guardian Family</span>
          </div>
        </div>
      </div>
    ),
    afterBg: "bg-gradient-to-br from-purple-900 to-indigo-900",
    headline: "Family → Story Characters",
    description: "Add dad, mum, siblings, grandparents — they all become characters with their own roles. Dad becomes the Guardian, grandma becomes the wise Elder.",
    tag: "Whole family included",
    tagColor: "bg-emerald-500/15 text-emerald-400 border-emerald-400/20",
    accentColor: "#6EE7B7",
  },
  {
    id: "pet",
    beforeLabel: "Your pet",
    beforeIcon: (
      <svg viewBox="0 0 80 80" className="w-full h-full" aria-hidden>
        {/* Simple dog/cat silhouette */}
        <ellipse cx="40" cy="48" rx="22" ry="16" fill="#D1C9E8" />
        <circle cx="40" cy="30" r="12" fill="#B8AED8" />
        {/* Ears */}
        <ellipse cx="30" cy="22" rx="6" ry="8" fill="#D1C9E8" transform="rotate(-15,30,22)" />
        <ellipse cx="50" cy="22" rx="6" ry="8" fill="#D1C9E8" transform="rotate(15,50,22)" />
        {/* Eyes */}
        <circle cx="36" cy="29" r="2.5" fill="#7C3AED" opacity="0.6" />
        <circle cx="44" cy="29" r="2.5" fill="#7C3AED" opacity="0.6" />
        {/* Tail */}
        <path d="M62 48 Q75 40 72 55 Q68 65 60 58" fill="#D1C9E8" />
      </svg>
    ),
    afterLabel: "Magical Companion",
    afterContent: (
      <div className="w-full h-full flex items-center justify-center">
        <div className="relative">
          {/* Glowing magical companion */}
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-xl shadow-amber-500/40">
            <span className="text-4xl">🐉</span>
          </div>
          {/* Sparkles */}
          <div className="absolute -top-1 -right-1 text-gold text-lg animate-pulse">✦</div>
          <div className="absolute -bottom-1 -left-2 text-gold text-sm animate-pulse" style={{ animationDelay: "0.5s" }}>✦</div>
          {/* Name badge */}
          <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap bg-black/50 backdrop-blur text-white text-[10px] font-bold px-2 py-0.5 rounded-full border border-gold/30">
            Blaze the Dragon
          </div>
        </div>
      </div>
    ),
    afterBg: "bg-gradient-to-br from-amber-900 to-orange-900",
    headline: "Pet → Magical Companion",
    description: "If your child has a pet, we transform them into a magical lifelong companion who travels every adventure. No pet? Choose from Dragons, Phoenix, Spirit Wolf and more.",
    tag: "Companion evolves across stories",
    tagColor: "bg-gold/15 text-gold border-gold/20",
    accentColor: "#F59E0B",
  },
];

export default function MeetTheHeroes() {
  return (
    <section className="py-24 bg-cream relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-brand/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-72 h-72 bg-gold/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <p className="text-brand text-xs font-bold tracking-[0.2em] uppercase mb-3">THE TRANSFORMATION</p>
          <h2 className="font-[family-name:var(--font-display)] text-ink text-4xl md:text-5xl mb-4">
            Real people, magical characters
          </h2>
          <p className="text-ink-mid text-lg max-w-xl mx-auto">
            Everyone your child loves becomes part of the story — parents, siblings, grandparents, even pets.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {TRANSFORMATIONS.map((t) => (
            <div
              key={t.id}
              className="bg-white rounded-3xl shadow-card overflow-hidden border border-ink/8 hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
            >
              {/* Before / After visual */}
              <div className="flex items-stretch h-40 relative">
                {/* Before */}
                <div className="flex-1 bg-ink/[0.03] border-r border-ink/8 flex flex-col items-center justify-center p-4 gap-2">
                  <div className="w-16 h-16 opacity-50">
                    {t.beforeIcon}
                  </div>
                  <span className="text-ink-muted text-[10px] font-semibold uppercase tracking-wider">{t.beforeLabel}</span>
                </div>

                {/* Arrow */}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-brand flex items-center justify-center shadow-brand shrink-0">
                  <span className="text-white text-base font-bold">→</span>
                </div>

                {/* After */}
                <div className={`flex-1 ${t.afterBg} flex flex-col items-center justify-center p-4 gap-2 relative overflow-hidden`}>
                  <div className="w-full h-20 relative">
                    {t.afterContent}
                  </div>
                  <span className="text-white/70 text-[10px] font-semibold uppercase tracking-wider">{t.afterLabel}</span>
                </div>
              </div>

              {/* Text body */}
              <div className="p-6">
                <div className={`inline-block text-[10px] font-bold uppercase tracking-wider border px-2.5 py-1 rounded-full mb-3 ${t.tagColor}`}>
                  {t.tag}
                </div>
                <h3 className="font-[family-name:var(--font-display)] text-ink text-xl mb-2">{t.headline}</h3>
                <p className="text-ink-mid text-sm leading-relaxed">{t.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
