import StarField from "@/components/shared/StarField";

export default function HeroSection() {
  return (
    <section className="relative min-h-screen bg-space-gradient flex items-center overflow-hidden">
      <StarField />

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-32 w-full flex flex-col lg:flex-row items-center gap-16">
        <div className="flex-1 flex flex-col gap-7">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur border border-gold/30 text-gold text-sm font-semibold px-4 py-1.5 rounded-full w-fit animate-fade-in-up">
            ✨ Magical AI Storybooks · Ages 4–12
          </div>

          <h1 className="font-[family-name:var(--font-display)] font-black text-5xl md:text-6xl lg:text-7xl text-white leading-[1.1]">
            Your Child,
            <br />
            <span className="text-gradient-magic">The Hero</span>
            <br />
            of Their Own Story
          </h1>

          <p className="text-white/70 text-lg md:text-xl leading-relaxed max-w-lg">
            Upload a photo, pick an adventure, and watch as AI creates a personalized illustrated
            storybook — with narration and a print-ready PDF — in minutes.
          </p>

          <div className="flex flex-wrap gap-4 items-center">
            <a
              href="/create"
              className="bg-brand hover:bg-brand-dark text-white font-bold px-8 py-4 rounded-full shadow-brand text-lg transition-all hover:scale-105"
            >
              Create Free Story →
            </a>
            <a
              href="#how-it-works"
              className="text-white/70 hover:text-gold font-medium text-lg underline underline-offset-4 transition"
            >
              See How It Works
            </a>
          </div>

          <div className="flex flex-wrap gap-3">
            <span className="bg-white/5 border border-white/10 text-white/60 text-sm px-4 py-1.5 rounded-full">
              ✓ Free demo — no card needed
            </span>
            <span className="bg-white/5 border border-white/10 text-white/60 text-sm px-4 py-1.5 rounded-full">
              ✓ Ready in under 5 minutes
            </span>
            <span className="bg-white/5 border border-white/10 text-white/60 text-sm px-4 py-1.5 rounded-full">
              ✓ Printable PDF included
            </span>
          </div>
        </div>

        <div className="lg:w-[420px] flex items-center justify-center relative">
          <div className="relative bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-4 shadow-2xl w-72 animate-float">
            <div className="bg-gradient-to-br from-brand to-brand-dark rounded-2xl aspect-[3/4] w-full flex flex-col items-center justify-center gap-3">
              <span className="text-6xl">📖</span>
              <span className="text-white font-[family-name:var(--font-display)] font-bold text-sm text-center">
                Your Child&apos;s Story
              </span>
            </div>

            <div className="mt-3 flex items-center justify-center gap-2">
              <span className="w-8 h-8 rounded-full bg-white/20" />
              <span className="w-8 h-8 rounded-full bg-white/20" />
              <span className="w-8 h-8 rounded-full bg-white/20" />
            </div>
            <p className="text-white/50 text-xs mt-1 text-center">8 illustrated pages</p>
          </div>

          <span className="absolute top-0 right-8 text-gold text-3xl animate-float opacity-70 pointer-events-none">
            ✦
          </span>
          <span className="absolute bottom-16 right-0 text-gold-light text-2xl animate-float-slow opacity-50 pointer-events-none">
            ✦
          </span>
          <span className="absolute top-1/2 -left-4 text-gold text-xl animate-float opacity-60 pointer-events-none">
            ✦
          </span>
        </div>
      </div>
    </section>
  );
}
