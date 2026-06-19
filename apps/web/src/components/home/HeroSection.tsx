import StarField from "@/components/shared/StarField";
import StoryBook from "@/components/shared/StoryBook";

export default function HeroSection() {
  return (
    <section className="relative min-h-screen bg-space-gradient flex items-center overflow-hidden">
      <StarField />

      <div className="relative z-10 max-w-7xl mx-auto px-6 pt-52 pb-24 w-full flex flex-col lg:flex-row items-center gap-16">
        {/* Left — text */}
        <div className="flex-1 flex flex-col gap-7">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur border border-gold/30 text-gold text-sm font-semibold px-4 py-1.5 rounded-full w-fit animate-fade-in-up">
            ✨ Magical AI Storybooks · Ages 4–12
          </div>

          {/* Headline */}
          <h1 className="font-[family-name:var(--font-display)] font-black text-5xl md:text-6xl lg:text-7xl text-white leading-[1.08]">
            Your Child,
            <br />
            <span className="text-gradient-magic">The Hero</span>
            <br />
            of Their Own Story
          </h1>

          {/* Sub */}
          <p className="text-white/70 text-lg md:text-xl leading-relaxed max-w-lg">
            Upload a photo, pick an adventure, and watch as AI creates a personalized
            illustrated storybook — with narration and a print-ready PDF — in minutes.
          </p>

          {/* CTAs */}
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

          {/* Trust pills */}
          <div className="flex flex-wrap gap-3">
            {[
              "✓ Free demo — no card needed",
              "✓ Ready in under 5 minutes",
              "✓ Printable PDF included",
            ].map((pill) => (
              <span
                key={pill}
                className="bg-white/5 border border-white/10 text-white/60 text-sm px-4 py-1.5 rounded-full"
              >
                {pill}
              </span>
            ))}
          </div>
        </div>

        {/* Right — comic book preview */}
        <div className="lg:w-[420px] flex items-center justify-center relative py-12">
          {/* Decorative sparkle accents */}
          <span className="absolute -top-2 right-8 text-gold text-2xl animate-float opacity-60 pointer-events-none select-none">✦</span>
          <span className="absolute bottom-8 -right-2 text-gold-light text-xl animate-float-slow opacity-45 pointer-events-none select-none">✦</span>
          <span className="absolute top-1/3 -left-8 text-gold text-lg animate-float opacity-50 pointer-events-none select-none">✦</span>

          <StoryBook />
        </div>
      </div>
    </section>
  );
}
