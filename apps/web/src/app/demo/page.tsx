"use client";

import Image from "next/image";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { useAuth } from "@/contexts/AuthContext";

const POWERS = [
  {
    icon: "🔥",
    name: "Cosmic Flame",
    description: "Arjun can summon star-fire from his palms — hot enough to melt asteroid rock. Earned in Episode 1.",
    color: "from-orange-900/60 to-red-950/60",
    border: "border-orange-700/40",
    badge: "Ep. 1",
    badgeColor: "bg-orange-600/80",
  },
  {
    icon: "⚡",
    name: "Zero-G Speed",
    description: "By saving the Glimma creatures, Arjun can move at light-speed in zero gravity. Earned in Episode 3.",
    color: "from-yellow-900/60 to-amber-950/60",
    border: "border-yellow-600/40",
    badge: "Ep. 3",
    badgeColor: "bg-yellow-600/80",
  },
  {
    icon: "🛡️",
    name: "Star Shield",
    description: "A force field woven from compressed starlight. Blocks any energy weapon. Earned in Episode 6.",
    color: "from-blue-900/60 to-indigo-950/60",
    border: "border-blue-600/40",
    badge: "Ep. 6",
    badgeColor: "bg-blue-600/80",
  },
];

const MEMORIES = [
  {
    type: "villain_defeated",
    icon: "⚔️",
    color: "border-red-700/40 bg-red-950/30",
    labelColor: "text-red-400",
    label: "Villain Defeated",
    episode: "Episode 9",
    title: "The Shadow Swirl vanishes into the void",
    description: "After a 3-episode chase across The Nebula Corridors, Arjun used Cosmic Flame and Star Shield together to destroy The Shadow Swirl — but its final words hinted at a master plan.",
  },
  {
    type: "character_met",
    icon: "🤝",
    color: "border-blue-700/40 bg-blue-950/30",
    labelColor: "text-blue-400",
    label: "Character Met",
    episode: "Episode 5",
    title: "Nova the Robotic Star Guardian bonds with Arjun",
    description: "A crashed star-ship revealed Nova — a robot built to protect the galaxy's youngest heroes. Nova now appears in every future episode and remembers everything Arjun has ever done.",
  },
  {
    type: "location_discovered",
    icon: "🗺️",
    color: "border-emerald-700/40 bg-emerald-950/30",
    labelColor: "text-emerald-400",
    label: "Location Discovered",
    episode: "Episode 7",
    title: "The Crystal Realm unlocked",
    description: "Beyond the Nebula Corridors lies a world made entirely of resonant crystal. No hero has ever entered it. The door opened at the end of Episode 7 — and it's waiting.",
  },
  {
    type: "power_earned",
    icon: "⚡",
    color: "border-yellow-700/40 bg-yellow-950/30",
    labelColor: "text-yellow-400",
    label: "Power Earned",
    episode: "Episode 1",
    title: "Cosmic Flame awakens",
    description: "The very first distress signal Arjun responded to ended with him touching a dying star-core. The flame bonded to him permanently — and the universe began.",
  },
];

const STORY_PANELS = [
  "/story-panels/cover.png",
  "/story-panels/page_1.png",
  "/story-panels/page_2.png",
  "/story-panels/page_3.png",
  "/story-panels/page_4.png",
  "/story-panels/page_5.png",
  "/story-panels/page_6.png",
  "/story-panels/page_7.png",
  "/story-panels/page_8.png",
];

export default function DemoUniversePage() {
  const { user } = useAuth();
  return (
    <div className="min-h-screen bg-cream flex flex-col">
      <Navbar />

      {/* ── Hero Header ─────────────────────────────────────────────────── */}
      <header className="bg-page-header pt-28 md:pt-32 pb-12 px-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-brand/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-gold/5 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -top-10 left-0 w-72 h-72 bg-indigo-900/30 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-5xl mx-auto">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-gold text-xs font-bold tracking-widest uppercase">REAL EXAMPLE · DEMO UNIVERSE</span>
            <span className="bg-brand/20 text-brand text-[10px] font-black px-2 py-0.5 rounded-full border border-brand/30 uppercase tracking-wide">Live Preview</span>
          </div>

          <h1 className="font-[family-name:var(--font-display)] text-white text-4xl md:text-5xl lg:text-6xl mb-2">
            Arjun&apos;s Starfire Chronicles
          </h1>
          <p className="text-white/55 text-base italic mb-6">
            &ldquo;One hero. One universe. Nine adventures — and it never truly ends.&rdquo;
          </p>

          <div className="flex items-center gap-2 mb-8">
            <span className="text-2xl">🚀</span>
            <span className="text-white/70 text-sm font-semibold">Commander Arjun</span>
            <span className="text-white/25 mx-1">·</span>
            <span className="text-white/50 text-sm">Age 8 · Started June 2025</span>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap gap-3">
            {[
              { icon: "📖", value: "9", label: "Episodes" },
              { icon: "⚡", value: "3", label: "Powers" },
              { icon: "🤖", value: "1", label: "Companion" },
              { icon: "⚔️", value: "1", label: "Villain Defeated" },
              { icon: "🌍", value: "1", label: "World Unlocked" },
              { icon: "📜", value: "2", label: "Open Quests" },
            ].map((s) => (
              <div key={s.label} className="bg-white/8 border border-white/10 rounded-2xl px-5 py-3 text-center min-w-[80px]">
                <p className="text-xl">{s.icon}</p>
                <p className="font-[family-name:var(--font-display)] text-white text-xl">{s.value}</p>
                <p className="text-white/40 text-xs">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto px-6 py-12 w-full space-y-16">

        {/* ── Story Panels ────────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-1 h-7 bg-brand rounded-full" />
            <h2 className="font-[family-name:var(--font-display)] text-ink text-2xl">Episode 1 — The First Adventure</h2>
          </div>
          <p className="text-ink-muted text-sm mb-6 max-w-2xl">
            Arjun intercepts a distress signal from deep space. What he finds changes everything — and the Starfire Chronicles universe is born.
          </p>

          {/* Cover large */}
          <div className="mb-4 rounded-2xl overflow-hidden shadow-2xl border border-ink/10">
            <Image
              src="/story-panels/cover.png"
              alt="Episode 1 cover — Arjun's Starfire Chronicles"
              width={900}
              height={500}
              className="w-full object-cover"
              priority
            />
          </div>

          {/* Panel grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {STORY_PANELS.slice(1).map((src, i) => (
              <div key={src} className="rounded-xl overflow-hidden shadow-card border border-ink/8 hover:shadow-lg transition-shadow">
                <Image
                  src={src}
                  alt={`Story panel ${i + 1}`}
                  width={300}
                  height={400}
                  className="w-full object-cover aspect-[3/4]"
                />
              </div>
            ))}
          </div>
        </section>

        {/* ── Powers ──────────────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-1 h-7 bg-gold rounded-full" />
            <h2 className="font-[family-name:var(--font-display)] text-ink text-2xl">Powers Earned Forever</h2>
          </div>
          <p className="text-ink-muted text-sm mb-6 max-w-2xl">
            Every power Arjun earns is remembered across all future episodes. The universe keeps building.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {POWERS.map((p) => (
              <div
                key={p.name}
                className={`bg-gradient-to-br ${p.color} border ${p.border} rounded-2xl p-5 flex flex-col gap-3`}
              >
                <div className="flex items-start justify-between">
                  <span className="text-4xl">{p.icon}</span>
                  <span className={`${p.badgeColor} text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wide`}>
                    {p.badge}
                  </span>
                </div>
                <div>
                  <h3 className="font-[family-name:var(--font-display)] text-white text-lg mb-1">{p.name}</h3>
                  <p className="text-white/55 text-xs leading-relaxed">{p.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Companion ───────────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-1 h-7 bg-cyan-500 rounded-full" />
            <h2 className="font-[family-name:var(--font-display)] text-ink text-2xl">Companion</h2>
          </div>
          <div className="bg-gradient-to-br from-cyan-950/60 to-slate-950/60 border border-cyan-700/30 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row gap-6 items-start">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-900 to-blue-950 border border-cyan-700/30 flex items-center justify-center text-4xl shrink-0 shadow-xl">
              🤖
            </div>
            <div>
              <p className="text-cyan-400 text-xs font-bold tracking-widest uppercase mb-1">PERMANENT COMPANION · SINCE EPISODE 5</p>
              <h3 className="font-[family-name:var(--font-display)] text-white text-2xl mb-2">Nova the Robotic Star Guardian</h3>
              <p className="text-white/60 text-sm leading-relaxed max-w-2xl">
                Nova was discovered in a crashed star-ship during Episode 5. Built by an ancient civilization to protect the galaxy&apos;s youngest heroes, Nova bonded with Arjun permanently.
                She appears in every future episode, remembers every adventure, and her memory banks grow with the universe — including the secrets she&apos;s keeping about The Crystal Realm.
              </p>
              <div className="flex flex-wrap gap-2 mt-4">
                {["Appears in every episode", "Has a long-term memory", "Knows the Crystal Realm secret"].map((t) => (
                  <span key={t} className="bg-cyan-900/40 border border-cyan-700/30 text-cyan-300 text-xs px-3 py-1 rounded-full">{t}</span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Universe Timeline / Memories ────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-1 h-7 bg-purple-500 rounded-full" />
            <h2 className="font-[family-name:var(--font-display)] text-ink text-2xl">Universe Timeline</h2>
          </div>
          <p className="text-ink-muted text-sm mb-6 max-w-2xl">
            Key moments that permanently shaped Arjun&apos;s universe. Every entry is remembered in every future story.
          </p>
          <div className="space-y-4">
            {MEMORIES.map((m, i) => (
              <div key={i} className={`flex gap-5 border ${m.color} rounded-2xl p-5`}>
                <div className="shrink-0 w-11 h-11 rounded-xl bg-black/30 flex items-center justify-center text-2xl">
                  {m.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`text-xs font-bold uppercase tracking-wider ${m.labelColor}`}>{m.label}</span>
                    <span className="text-white/25 text-xs">·</span>
                    <span className="text-white/40 text-xs">{m.episode}</span>
                  </div>
                  <h4 className="font-[family-name:var(--font-display)] text-white text-base mb-1 leading-snug">{m.title}</h4>
                  <p className="text-white/50 text-xs leading-relaxed">{m.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── What's Coming Next ──────────────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-1 h-7 bg-emerald-500 rounded-full" />
            <h2 className="font-[family-name:var(--font-display)] text-ink text-2xl">What&apos;s Coming Next</h2>
          </div>
          <div className="bg-gradient-to-br from-emerald-950/60 to-slate-950/60 border border-emerald-700/30 rounded-2xl p-6 md:p-8">
            <div className="flex flex-col md:flex-row gap-6 items-start">
              <div className="shrink-0 w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-900 to-green-950 border border-emerald-700/30 flex items-center justify-center text-3xl shadow-xl">
                🌍
              </div>
              <div>
                <p className="text-emerald-400 text-xs font-bold tracking-widest uppercase mb-1">NEXT ARC TEASED · EPISODE 10</p>
                <h3 className="font-[family-name:var(--font-display)] text-white text-2xl mb-2">The Crystal Realm Awaits</h3>
                <p className="text-white/60 text-sm leading-relaxed max-w-2xl">
                  The door to the Crystal Realm cracked open at the end of Episode 7. A world made entirely of resonant crystal — no hero has ever entered it.
                  Nova holds the coordinates. The Shadow Swirl&apos;s last words mentioned it. And now, in Episode 10, Arjun must decide: step through the door, or let the universe forget.
                </p>
              </div>
            </div>
            <div className="mt-6 border-t border-emerald-700/20 pt-5">
              <p className="text-white/35 text-xs font-bold uppercase tracking-widest mb-3">Loose threads the next episode will pick up</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  "The Shadow Swirl's last words: 'The Crystal holds the key'",
                  "Nova's hidden memory bank — partially unlocked in Ep. 8",
                  "The Glimma creatures sent a second distress signal",
                  "The Nebula Corridors are shifting — a new path opened",
                ].map((t) => (
                  <div key={t} className="flex items-start gap-2 text-white/50 text-xs">
                    <span className="text-emerald-500 mt-0.5 shrink-0">→</span>
                    <span>{t}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Open Quests ─────────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-1 h-7 bg-orange-500 rounded-full" />
            <h2 className="font-[family-name:var(--font-display)] text-ink text-2xl">Open Quests</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              {
                icon: "📜",
                title: "Find the Lost Star Map",
                description: "Nova mentioned a star map that shows every world Arjun has never visited. It was last seen near the wreckage of the Shadow Swirl's ship.",
                badge: "Active",
                color: "border-orange-700/40 bg-orange-950/20",
                badgeColor: "bg-orange-600/80",
              },
              {
                icon: "🔍",
                title: "Decode the Crystal Frequency",
                description: "The Crystal Realm emits a frequency that Nova can almost decode. Three episodes pass between the frequency's pulses. The next one is soon.",
                badge: "Active",
                color: "border-amber-700/40 bg-amber-950/20",
                badgeColor: "bg-amber-600/80",
              },
            ].map((q) => (
              <div key={q.title} className={`border ${q.color} rounded-2xl p-5 flex gap-4`}>
                <div className="shrink-0 w-11 h-11 rounded-xl bg-black/30 flex items-center justify-center text-2xl">
                  {q.icon}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-[family-name:var(--font-display)] text-white text-base leading-snug">{q.title}</h4>
                    <span className={`${q.badgeColor} text-white text-[9px] font-black px-2 py-0.5 rounded-full shrink-0`}>{q.badge}</span>
                  </div>
                  <p className="text-white/50 text-xs leading-relaxed">{q.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA ─────────────────────────────────────────────────────────── */}
        <section className="bg-space-gradient rounded-3xl p-8 md:p-12 text-center relative overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[200px] bg-brand/15 rounded-full blur-[80px] pointer-events-none" />
          <div className="relative">
            <p className="text-gold text-xs font-bold tracking-widest uppercase mb-3">YOUR CHILD COULD HAVE THIS</p>
            <h2 className="font-[family-name:var(--font-display)] text-white text-3xl md:text-4xl mb-4">
              Every universe is unique.<br />Every hero is real.
            </h2>
            <p className="text-white/55 text-base max-w-xl mx-auto mb-8">
              Arjun&apos;s universe took 9 episodes to build. Yours starts with one. Create your child&apos;s personalised hero universe — it grows with them forever.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href={user ? "/create" : "/register"}
                className="inline-block bg-brand hover:bg-brand-dark text-white font-bold px-10 py-4 rounded-full shadow-brand transition-all hover:scale-105 text-lg"
              >
                Start Episode 1 →
              </Link>
              <Link
                href="/"
                className="inline-block bg-white/10 hover:bg-white/20 border border-white/15 text-white font-semibold px-8 py-4 rounded-full transition-all text-base"
              >
                Learn More
              </Link>
            </div>
            <p className="text-white/30 text-xs mt-6">No credit card needed to get started · First story free</p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
