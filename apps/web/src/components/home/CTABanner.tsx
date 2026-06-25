"use client";

import { useAuth } from "@/contexts/AuthContext";

export default function CTABanner() {
  const { user } = useAuth();

  return (
    <section className="relative overflow-hidden bg-brand-gradient py-28">
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-white/5 rounded-full blur-3xl pointer-events-none z-0" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-black/10 rounded-full blur-3xl pointer-events-none z-0" />
      {["✨","⭐","🌟","💫","✨","⭐"].map((s, i) => (
        <span key={i} className="absolute text-2xl opacity-20 animate-float pointer-events-none"
          style={{ left: `${8 + i * 16}%`, top: `${10 + (i % 2) * 60}%`, animationDelay: `${i * 0.5}s`, animationDuration: `${3 + i * 0.4}s` }}>
          {s}
        </span>
      ))}

      <div className="relative z-10 max-w-3xl mx-auto px-6 text-center">
        <p className="text-gold text-xs font-bold tracking-widest uppercase mb-4">
          {user ? "YOUR UNIVERSE AWAITS" : "START FOR FREE"}
        </p>
        <h2 className="font-[family-name:var(--font-display)] text-white text-4xl md:text-6xl mb-4">
          {user
            ? <>Your universe is<br />waiting for the next episode</>
            : <>Your child deserves<br />their own universe</>
          }
        </h2>
        <p className="text-white/70 text-lg mb-2 max-w-lg mx-auto">
          {user
            ? "Every episode adds powers, opens quests, and builds a world that grows with your child."
            : "A living world of adventures — not just a story. Powers earned. Quests carried forward. A universe that never forgets."
          }
        </p>
        {!user && (
          <p className="text-gold/80 text-sm mb-10">3 free story credits when you sign up — no credit card needed.</p>
        )}

        <div className={`flex flex-col sm:flex-row gap-4 justify-center items-center ${user ? "mt-10" : ""}`}>
          <a href={user ? "/create" : "/register"}
            className="bg-white text-brand hover:bg-gold hover:text-white font-[family-name:var(--font-display)] text-xl px-10 py-4 rounded-full transition-all hover:scale-105 shadow-lg inline-block">
            {user ? "Create New Episode →" : "Start Your Universe →"}
          </a>
          {!user && (
            <a href="#how-it-works"
              className="text-white/70 hover:text-white text-sm underline underline-offset-4 transition">
              See how it works
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
