"use client";

import { useAuth } from "@/contexts/AuthContext";
import StarField from "@/components/shared/StarField";
import StoryBook from "@/components/shared/StoryBook";

export default function HeroSection() {
  const { user } = useAuth();

  return (
    <section className="relative min-h-screen bg-space-gradient flex items-center overflow-hidden">
      <StarField />

      {/* Ambient glow orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-gold/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto px-6 pt-44 pb-24 w-full flex flex-col lg:flex-row items-center gap-16">
        {/* Left — text */}
        <div className="flex-1 flex flex-col gap-7">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur border border-gold/30 text-gold text-sm font-semibold px-4 py-1.5 rounded-full w-fit">
            ✨ A Living Universe That Grows With Your Child · Ages 4–12
          </div>

          <h1 className="font-[family-name:var(--font-display)] font-black text-5xl md:text-6xl lg:text-7xl text-white leading-[1.05]">
            Every Child
            <br />
            <span className="text-gradient-magic">Deserves Their</span>
            <br />
            Own Universe
          </h1>

          <p className="text-white/70 text-lg md:text-xl leading-relaxed max-w-lg">
            Not a story generator — a <strong className="text-white">living world</strong> built around your child.
            Heroes earn powers, meet companions, unlock new worlds, and their universe
            grows <strong className="text-gold">forever</strong>.
          </p>

          <div className="flex flex-wrap gap-4 items-center">
            <a
              href={user ? "/create" : "/register"}
              className="bg-brand hover:bg-brand-dark text-white font-bold px-8 py-4 rounded-full shadow-brand text-lg transition-all hover:scale-105 active:scale-95"
            >
              {user ? "Continue My Universe →" : "Create My Hero →"}
            </a>
            <a
              href="#sample-universes"
              className="bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold px-8 py-4 rounded-full text-lg transition-all hover:scale-105 backdrop-blur-sm"
            >
              Explore Sample Universes
            </a>
          </div>

          {/* Social proof pills */}
          <div className="flex flex-wrap gap-3 mt-1">
            {[
              "✓ Powers earned across episodes",
              "✓ Universe memory — never forgets",
              "✓ Photo deleted instantly after avatar",
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
        <div className="lg:w-[470px] flex items-center justify-center relative py-12">
          {/* Floating stars */}
          {[
            { top: "-2px", right: "32px", size: "text-2xl", delay: "0s", dur: "3s" },
            { bottom: "32px", right: "-8px", size: "text-xl", delay: "1.2s", dur: "4s" },
            { top: "33%", left: "-32px", size: "text-lg", delay: "0.6s", dur: "3.5s" },
            { top: "10%", left: "5%", size: "text-sm", delay: "1.8s", dur: "5s" },
          ].map((s, i) => (
            <span
              key={i}
              className="absolute text-gold opacity-50 pointer-events-none select-none animate-float"
              style={{ top: s.top, right: s.right, bottom: s.bottom, left: s.left, fontSize: undefined, animationDelay: s.delay, animationDuration: s.dur }}
            >
              ✦
            </span>
          ))}

          {/* Label above */}
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-center z-20">
            <span className="bg-gold/20 border border-gold/40 text-gold text-xs font-bold tracking-wider px-3 py-1 rounded-full backdrop-blur">
              REAL STORY · ARJUN'S UNIVERSE
            </span>
          </div>

          <StoryBook />

          {/* Label below */}
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-center z-20">
            <span className="text-white/40 text-xs">
              9 episodes and counting · Powers: Cosmic Flame, Star Shield
            </span>
          </div>
        </div>
      </div>

      {/* Scroll cue */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-bounce opacity-40">
        <span className="text-white/60 text-xs tracking-widest uppercase">Scroll</span>
        <div className="w-0.5 h-8 bg-gradient-to-b from-white/60 to-transparent" />
      </div>
    </section>
  );
}
