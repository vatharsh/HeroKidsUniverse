"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useAuth } from "@/contexts/AuthContext";
import { getAccessToken } from "@/lib/api";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

const UNIVERSE_EXAMPLES = [
  "Arjun Universe",
  "Captain Maya Universe",
  "The Riya Chronicles",
  "Superhero Sam Universe",
  "Zara's Magical World",
];

const TITLE_EXAMPLES = [
  "Captain",
  "Super",
  "Princess",
  "Commander",
  "Doctor",
  "Agent",
];

export default function OnboardingPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [step, setStep]               = useState<0 | 1 | 2>(0);
  const [heroName, setHeroName]       = useState(user?.name?.split(" ")[0] ?? "");
  const [heroTitle, setHeroTitle]     = useState("");
  const [universeName, setUniverseName] = useState("");
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState("");

  // Auto-suggest universe name when hero info is filled
  function suggestName() {
    if (!heroName.trim()) return;
    const title = heroTitle.trim() ? `${heroTitle} ` : "";
    setUniverseName(`${title}${heroName} Universe`);
  }

  async function handleCreate() {
    if (!universeName.trim() || !heroName.trim()) return;
    setSaving(true);
    setError("");

    try {
      const token = getAccessToken();
      if (!token) { router.push("/login"); return; }
      const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

      // 1. Create universe
      const uRes = await fetch(`${BASE}/universes`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: universeName.trim(),
          heroTitle: heroTitle.trim() || undefined,
        }),
      });
      if (!uRes.ok) {
        const { message } = await uRes.json();
        // If universe already exists (conflict), just go to create
        if (uRes.status === 409) { router.push("/create"); return; }
        throw new Error(message ?? "Failed to create universe");
      }

      // 2. Create hero if name provided
      const heroRes = await fetch(`${BASE}/heroes`, {
        method: "POST",
        headers,
        body: JSON.stringify({ name: heroName.trim(), age: 7, gender: "boy" }),
      });
      // Hero creation failure is non-fatal — user can set details in create flow

      router.push("/create");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-space-gradient flex flex-col items-center justify-center px-6 py-12 relative overflow-hidden">
      {/* Ambient */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-brand/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-gold/5 rounded-full blur-2xl pointer-events-none" />

      <div className="relative w-full max-w-md">
        {/* Logo area */}
        <div className="text-center mb-10">
          <div className="text-6xl mb-4">🌌</div>
          <p className="text-gold text-xs font-bold tracking-widest uppercase mb-2">Welcome to HeroKids Universe</p>
          <h1 className="font-[family-name:var(--font-display)] text-white text-3xl md:text-4xl">
            {step === 0 && "Name your hero"}
            {step === 1 && "Name your universe"}
            {step === 2 && "Your universe is ready!"}
          </h1>
          <p className="text-white/50 text-sm mt-2">
            {step === 0 && "Every universe starts with a hero."}
            {step === 1 && "This is your child's living world — name it something epic."}
            {step === 2 && "Let's create the first episode."}
          </p>
        </div>

        <div className="bg-white/5 border border-white/10 backdrop-blur rounded-3xl p-8">

          {/* Step 0 — Hero name + title */}
          {step === 0 && (
            <div className="flex flex-col gap-5">
              <div>
                <label className="text-white/70 text-sm font-medium block mb-2">Child&apos;s name</label>
                <input
                  type="text"
                  value={heroName}
                  onChange={(e) => setHeroName(e.target.value)}
                  placeholder="e.g. Arjun, Maya, Riya"
                  className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold/40 transition"
                />
              </div>

              <div>
                <label className="text-white/70 text-sm font-medium block mb-2">
                  Hero title <span className="text-white/30 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={heroTitle}
                  onChange={(e) => setHeroTitle(e.target.value)}
                  placeholder="e.g. Captain, Super, Princess"
                  className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold/40 transition"
                />
                <div className="flex flex-wrap gap-2 mt-2">
                  {TITLE_EXAMPLES.map((t) => (
                    <button key={t} type="button" onClick={() => setHeroTitle(t)}
                      className="text-xs text-white/40 hover:text-gold border border-white/10 hover:border-gold/40 px-3 py-1 rounded-full transition">
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {heroName.trim() && (
                <div className="bg-white/8 border border-white/10 rounded-2xl p-4 text-center">
                  <p className="text-white/40 text-xs mb-1">Your hero will be known as</p>
                  <p className="font-[family-name:var(--font-display)] text-white text-2xl">
                    {heroTitle.trim() ? `${heroTitle} ` : ""}{heroName}
                  </p>
                </div>
              )}

              <button
                type="button"
                disabled={!heroName.trim()}
                onClick={() => { suggestName(); setStep(1); }}
                className="w-full bg-brand disabled:bg-white/10 disabled:text-white/30 disabled:cursor-not-allowed text-white font-bold py-4 rounded-full transition-all enabled:hover:scale-[1.02] shadow-brand">
                Continue →
              </button>
            </div>
          )}

          {/* Step 1 — Universe name */}
          {step === 1 && (
            <div className="flex flex-col gap-5">
              <div>
                <label className="text-white/70 text-sm font-medium block mb-2">Universe name</label>
                <input
                  type="text"
                  value={universeName}
                  onChange={(e) => setUniverseName(e.target.value)}
                  placeholder="e.g. Arjun Universe"
                  className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold/40 transition text-lg"
                />
                <div className="flex flex-col gap-1.5 mt-3">
                  {UNIVERSE_EXAMPLES.slice(0, 3).map((ex) => (
                    <button key={ex} type="button" onClick={() => setUniverseName(ex.replace("Arjun", heroName || "Arjun"))}
                      className="text-left text-xs text-white/40 hover:text-gold transition px-1">
                      ✦ {ex.replace("Arjun", heroName || "Arjun")}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-white/8 border border-gold/20 rounded-2xl p-5">
                <p className="text-gold text-xs font-bold uppercase tracking-wide mb-3">Inside your universe</p>
                <ul className="space-y-2 text-white/60 text-sm">
                  {[
                    "Heroes, family, friends & pets",
                    "Powers & magical items earned in stories",
                    "Open quests carried across episodes",
                    "A growing timeline of adventures",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2">
                      <span className="text-gold text-xs">✓</span> {item}
                    </li>
                  ))}
                </ul>
              </div>

              {error && (
                <p className="text-red-400 text-sm text-center">{error}</p>
              )}

              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(0)}
                  className="px-5 py-3 rounded-full text-white/50 hover:text-white text-sm transition">
                  ← Back
                </button>
                <button
                  type="button"
                  disabled={!universeName.trim() || saving}
                  onClick={handleCreate}
                  className="flex-1 bg-brand disabled:bg-white/10 disabled:text-white/30 disabled:cursor-not-allowed text-white font-bold py-4 rounded-full transition-all enabled:hover:scale-[1.02] shadow-brand flex items-center justify-center gap-2">
                  {saving
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</>
                    : <><Sparkles className="w-4 h-4" /> Create My Universe</>
                  }
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="text-white/20 text-xs text-center mt-6">
          Already have a universe? <a href="/dashboard" className="underline hover:text-white/40">Go to dashboard</a>
        </p>
      </div>
    </div>
  );
}
