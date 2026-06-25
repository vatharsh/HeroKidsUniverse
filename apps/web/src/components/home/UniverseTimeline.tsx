"use client";

const MILESTONES = [
  {
    id: "story1",
    icon: "📖",
    phase: "Episode 1",
    title: "The First Adventure",
    description: "Arjun discovers a distress signal. The universe begins.",
    detail: "Unlocks: Cosmic Flame power",
    detailColor: "text-amber-400",
    bgFrom: "from-indigo-900",
    dotColor: "bg-indigo-500",
  },
  {
    id: "power",
    icon: "⚡",
    phase: "Episode 3",
    title: "New Power Earned",
    description: "By saving the Glimma creatures, Arjun earns Zero-G Speed.",
    detail: "Power added to hero profile forever",
    detailColor: "text-yellow-400",
    bgFrom: "from-purple-900",
    dotColor: "bg-purple-500",
  },
  {
    id: "companion",
    icon: "🤖",
    phase: "Episode 5",
    title: "Companion Joins",
    description: "Nova the Robotic Star Guardian bonds with Arjun permanently.",
    detail: "Appears in every future episode",
    detailColor: "text-cyan-400",
    bgFrom: "from-cyan-950",
    dotColor: "bg-cyan-500",
  },
  {
    id: "world",
    icon: "🌍",
    phase: "Episode 7",
    title: "New World Unlocked",
    description: "The Crystal Realm opens — a world no hero has ever reached.",
    detail: "Expands the universe permanently",
    detailColor: "text-emerald-400",
    bgFrom: "from-emerald-950",
    dotColor: "bg-emerald-500",
  },
  {
    id: "battle",
    icon: "⚔️",
    phase: "Episode 9",
    title: "The Final Battle… For Now",
    description: "Arjun defeats The Shadow Swirl — but a new threat stirs in the dark.",
    detail: "The universe never truly ends",
    detailColor: "text-red-400",
    bgFrom: "from-red-950",
    dotColor: "bg-red-500",
  },
];

export default function UniverseTimeline() {
  return (
    <section className="py-24 bg-space-gradient relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[300px] bg-brand/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <p className="text-gold text-xs font-bold tracking-[0.2em] uppercase mb-3">YOUR UNIVERSE GROWS FOREVER</p>
          <h2 className="font-[family-name:var(--font-display)] font-black text-white text-4xl md:text-5xl mb-4">
            Every episode builds on the last
          </h2>
          <p className="text-white/60 text-lg max-w-xl mx-auto">
            Powers earned. Companions found. Worlds unlocked. Your child&apos;s universe remembers every adventure — and the next one is always better.
          </p>
        </div>

        {/* Timeline — horizontal scroll on mobile, full grid on desktop */}
        <div className="relative">
          {/* Connector line (desktop only) */}
          <div className="hidden lg:block absolute top-[3.25rem] left-[calc(10%+1.5rem)] right-[calc(10%+1.5rem)] h-0.5 z-0">
            <div className="w-full h-full bg-gradient-to-r from-indigo-500/50 via-brand/50 to-red-500/50" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 lg:gap-6">
            {MILESTONES.map((m, i) => (
              <div
                key={m.id}
                className="relative flex flex-col items-center text-center"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                {/* Icon circle */}
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${m.bgFrom} to-black/50 border border-white/15 flex items-center justify-center text-3xl mb-4 z-10 shadow-xl relative`}>
                  {m.icon}
                  {/* Step number */}
                  <div className={`absolute -top-2 -right-2 w-5 h-5 rounded-full ${m.dotColor} text-white text-[9px] font-black flex items-center justify-center shadow`}>
                    {i + 1}
                  </div>
                </div>

                {/* Content */}
                <div className="max-w-[160px]">
                  <span className="text-white/35 text-[10px] font-bold tracking-widest uppercase block mb-1">{m.phase}</span>
                  <h3 className="font-[family-name:var(--font-display)] text-white text-base mb-1.5 leading-snug">{m.title}</h3>
                  <p className="text-white/50 text-xs leading-relaxed mb-2">{m.description}</p>
                  <span className={`text-[10px] font-semibold ${m.detailColor}`}>{m.detail}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Arjun's real story reference */}
        <div className="mt-16 bg-white/5 border border-white/10 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-center gap-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-900 to-purple-900 border border-white/15 flex items-center justify-center text-3xl shrink-0">
            🚀
          </div>
          <div className="flex-1 text-center md:text-left">
            <p className="text-gold text-xs font-bold tracking-widest uppercase mb-1">REAL EXAMPLE</p>
            <h3 className="font-[family-name:var(--font-display)] text-white text-xl mb-2">Arjun&apos;s Starfire Chronicles</h3>
            <p className="text-white/55 text-sm leading-relaxed">
              9 episodes deep. Powers unlocked: Cosmic Flame, Zero-G Speed, Star Shield. Companion: Nova the Robotic Star Guardian.
              Villain defeated: The Shadow Swirl. Next arc teased: The Crystal Realm awaits.
            </p>
          </div>
          <div className="flex flex-col items-center gap-1 shrink-0">
            <span className="text-4xl font-[family-name:var(--font-display)] text-gold font-black">9</span>
            <span className="text-white/40 text-xs">episodes</span>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mt-12">
          <p className="text-white/40 text-sm mb-4">How many episodes will your child&apos;s universe reach?</p>
          <a
            href="/register"
            className="inline-block bg-brand hover:bg-brand-dark text-white font-bold px-10 py-4 rounded-full shadow-brand transition-all hover:scale-105 text-lg"
          >
            Start Episode 1 →
          </a>
        </div>
      </div>
    </section>
  );
}
