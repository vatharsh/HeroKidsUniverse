"use client";

import Image from "next/image";
import { Pause, Play } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "@/contexts/AuthContext";

/**
 * "Watch the universe grow" — Arjun's sample universe plays episode by episode while his universe
 * card fills up: companion, powers, gear, friends, worlds, quests ticked off, the villain escaping and
 * later defeated. Uses the existing sample illustrations in /public/story-panels — no AI cost.
 */

const STEP_MS = 3600;

interface Episode {
  image: string;
  title: string;
  moment: string;
  toast: string;
}

const EPISODES: Episode[] = [
  { image: "/story-panels/page_1.png", title: "The signal", moment: "A tiny robot taps on Arjun's window: “I need your help on a mission!”", toast: "🤖 Nova joins Arjun's universe" },
  { image: "/story-panels/page_2.png", title: "The Starlight Mission", moment: "The Galaxy's brightest star has lost its shine. Arjun takes the controls.", toast: "🚀 Star Cruiser added to Arjun's gear" },
  { image: "/story-panels/page_3.png", title: "Through the asteroid storm", moment: "Dodging asteroids at light-speed, Arjun discovers a new power.", toast: "⚡ New power: Zero-G Speed" },
  { image: "/story-panels/page_4.png", title: "The Glimma Meadows", moment: "The Glimmas have a warning: “The Shadow Swirl has taken our starlight!”", toast: "🌍 New world unlocked: Glimma Meadows" },
  { image: "/story-panels/page_5.png", title: "The Shadow Swirl", moment: "A storm with glowing eyes swallows the light — and slips away.", toast: "⚠️ The Shadow Swirl escaped — it may return!" },
  { image: "/story-panels/page_6.png", title: "Bring the shine back", moment: "Arjun finds the last spark of starlight and holds it high.", toast: "💎 Legendary item: Starlight Crystal" },
  { image: "/story-panels/page_7.png", title: "The Galaxy shines again", moment: "The star wakes up. The Glimmas cheer. Nova beeps a happy song.", toast: "✅ Quest complete: Restore the Galaxy's shine" },
  { image: "/story-panels/page_8.png", title: "…but the universe is big", moment: "Back home, the telescope picks up a strange crystal glow.", toast: "📜 New quest: The Crystal Realm awaits…" },
];

type Kind = "cast" | "power" | "gear" | "world" | "quest";

interface Item {
  ep: number; // 1-based episode it appears in
  kind: Kind;
  icon: string;
  label: string;
  doneAt?: number; // quests: episode it was completed in
}

const ITEMS: Item[] = [
  { ep: 1, kind: "cast", icon: "🤖", label: "Nova" },
  { ep: 1, kind: "quest", icon: "🌟", label: "Restore the Galaxy's shine", doneAt: 7 },
  { ep: 1, kind: "power", icon: "🔥", label: "Cosmic Flame" },
  { ep: 2, kind: "gear", icon: "🚀", label: "Star Cruiser" },
  { ep: 3, kind: "power", icon: "⚡", label: "Zero-G Speed" },
  { ep: 4, kind: "world", icon: "🌍", label: "Glimma Meadows" },
  { ep: 4, kind: "cast", icon: "🟢", label: "The Glimmas" },
  { ep: 6, kind: "gear", icon: "💎", label: "Starlight Crystal" },
  { ep: 6, kind: "power", icon: "🛡️", label: "Star Shield" },
  { ep: 8, kind: "quest", icon: "🔮", label: "Enter the Crystal Realm" },
];

const GROUPS: Array<{ kind: Kind; title: string }> = [
  { kind: "cast", title: "Companion & friends" },
  { kind: "power", title: "Powers" },
  { kind: "gear", title: "Gear" },
  { kind: "world", title: "Worlds" },
  { kind: "quest", title: "Quests" },
];

function villainState(ep: number): { label: string; className: string } | null {
  if (ep < 5) return null;
  if (ep < 7) return { label: "Escaped — may return!", className: "bg-red-500/90 text-white" };
  return { label: "Defeated", className: "bg-emerald-500/90 text-white" };
}

export default function UniverseTimeline() {
  const { user } = useAuth();
  const [step, setStep] = useState(0); // 0-based index into EPISODES
  const [playing, setPlaying] = useState(true);
  const [inView, setInView] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Only play while the section is on screen; respect "reduce motion" (then show the finished universe).
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const applyMotion = () => {
      setReduceMotion(media.matches);
      if (media.matches) { setPlaying(false); setStep(EPISODES.length - 1); }
    };
    applyMotion();
    media.addEventListener("change", applyMotion);
    const el = sectionRef.current;
    const observer = el ? new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.35 }) : null;
    if (el && observer) observer.observe(el);
    return () => { media.removeEventListener("change", applyMotion); observer?.disconnect(); };
  }, []);

  useEffect(() => {
    if (!playing || !inView) return;
    const timer = setTimeout(
      () => setStep((s) => (s + 1) % EPISODES.length),
      step === EPISODES.length - 1 ? STEP_MS * 1.6 : STEP_MS, // linger on the cliffhanger before looping
    );
    return () => clearTimeout(timer);
  }, [playing, inView, step]);

  useEffect(() => () => clearTimeout(resumeTimer.current), []);

  const jumpTo = useCallback((i: number) => {
    setStep(i);
    setPlaying(false);
    clearTimeout(resumeTimer.current);
    if (!reduceMotion) resumeTimer.current = setTimeout(() => setPlaying(true), 9000);
  }, [reduceMotion]);

  const ep = step + 1;
  const episode = EPISODES[step];
  const villain = villainState(ep);
  const animate = !reduceMotion;

  return (
    <section ref={sectionRef} className="py-24 bg-space-gradient relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[400px] bg-brand/15 rounded-full blur-[110px] pointer-events-none" />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <p className="text-gold text-xs font-bold tracking-[0.2em] uppercase mb-3">WATCH A UNIVERSE GROW</p>
          <h2 className="font-[family-name:var(--font-display)] font-black text-white text-4xl md:text-5xl mb-4">
            Every episode builds on the last
          </h2>
          <p className="text-white/60 text-lg max-w-xl mx-auto">
            Powers earned. Gear collected. Villains who come back. Your child&apos;s universe remembers every adventure.
          </p>
        </div>

        <div className="grid lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] gap-6 lg:gap-10 items-start">
          {/* ── Episode player ─────────────────────────────────────────── */}
          <div>
            <div className="relative aspect-[376/499] w-full max-w-[420px] mx-auto rounded-3xl overflow-hidden border border-white/15 shadow-2xl bg-space">
              {EPISODES.map((e, i) => (
                <div key={e.image} className={`absolute inset-0 transition-opacity duration-700 ${i === step ? "opacity-100 z-10" : "opacity-0 z-0"}`} aria-hidden={i !== step}>
                  <Image
                    src={e.image}
                    alt={i === step ? `Episode ${i + 1}: ${e.title}` : ""}
                    fill
                    sizes="(min-width: 1024px) 420px, 90vw"
                    className={`object-cover ${i === step && animate ? "ug-anim animate-[ugKenBurns_4s_ease-out_both]" : ""}`}
                    priority={i === 0}
                    loading={i === 0 ? undefined : "eager"} // all 8 ready before they're shown, so fades never show a blank
                  />
                </div>
              ))}
            </div>

            {/* Caption sits under the picture: the pages already have speech bubbles drawn on them */}
            <div className="max-w-[420px] mx-auto mt-4 flex items-start gap-3">
              <div key={step} className={`flex-1 min-w-0 ${animate ? "ug-anim animate-[fadeInUp_0.5s_ease-out_both]" : ""}`}>
                <span className="inline-block bg-gold text-black text-[10px] font-black px-2 py-0.5 rounded-full mb-1.5">EPISODE {ep}</span>
                <h3 className="font-[family-name:var(--font-display)] text-white text-2xl leading-tight mb-1">{episode.title}</h3>
                <p className="text-white/70 text-sm leading-relaxed min-h-[2.5rem]">{episode.moment}</p>
              </div>
              <button
                type="button"
                onClick={() => { clearTimeout(resumeTimer.current); setPlaying((p) => !p); }}
                className="shrink-0 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-white flex items-center justify-center transition"
                aria-label={playing ? "Pause" : "Play"}
              >
                {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>
            </div>

            {/* Progress: one segment per episode, tap to jump */}
            <div className="flex gap-1.5 max-w-[420px] mx-auto mt-4" role="tablist" aria-label="Episodes">
              {EPISODES.map((e, i) => (
                <button
                  key={e.image}
                  type="button"
                  role="tab"
                  aria-selected={i === step}
                  aria-label={`Episode ${i + 1}: ${e.title}`}
                  onClick={() => jumpTo(i)}
                  className="group flex-1 h-6 flex items-center"
                >
                  <span className="relative block w-full h-1.5 rounded-full bg-white/15 overflow-hidden group-hover:bg-white/30 transition">
                    {i < step && <span className="absolute inset-0 bg-gold" />}
                    {i === step && (
                      <span
                        key={`${step}-${playing && inView}`}
                        className={`absolute inset-0 bg-gold origin-left ${playing && inView && animate ? "ug-anim" : ""}`}
                        style={playing && inView && animate ? { animation: `ugFill ${step === EPISODES.length - 1 ? STEP_MS * 1.6 : STEP_MS}ms linear both` } : undefined}
                      />
                    )}
                  </span>
                </button>
              ))}
            </div>

            {/* What just happened */}
            <div className="h-10 mt-3 flex justify-center">
              <span key={step} className={`inline-flex items-center bg-white/10 border border-white/15 text-white text-sm font-semibold px-4 py-2 rounded-full ${animate ? "ug-anim animate-[ugToast_3.4s_ease-out_both]" : ""}`}>
                {episode.toast}
              </span>
            </div>
          </div>

          {/* ── Arjun's universe card ──────────────────────────────────── */}
          <div className="bg-white/[0.06] border border-white/15 rounded-3xl p-5 sm:p-6 backdrop-blur-sm">
            <div className="flex items-center gap-4 mb-5">
              <div className="relative w-16 h-16 rounded-2xl overflow-hidden border border-white/20 shrink-0">
                <Image src="/story-panels/cover.png" alt="Arjun" fill sizes="64px" className="object-cover object-top" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-gold text-[10px] font-bold tracking-widest uppercase">SAMPLE UNIVERSE</p>
                <h3 className="font-[family-name:var(--font-display)] text-white text-xl sm:text-2xl leading-tight">Arjun&apos;s Starfire Chronicles</h3>
              </div>
              <div className="text-center shrink-0">
                <span key={ep} className={`block text-4xl font-[family-name:var(--font-display)] text-gold font-black leading-none ${animate ? "ug-anim animate-[ugPopIn_0.5s_ease-out_both]" : ""}`}>{ep}</span>
                <span className="text-white/45 text-[11px]">{ep === 1 ? "episode" : "episodes"}</span>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4">
              {GROUPS.map((group) => {
                const items = ITEMS.filter((it) => it.kind === group.kind && it.ep <= ep);
                return (
                  <div key={group.kind} className={group.kind === "quest" ? "sm:col-span-2" : ""}>
                    <p className="text-white/40 text-[10px] font-bold tracking-widest uppercase mb-2">{group.title}</p>
                    <div className="flex flex-wrap gap-2 min-h-[34px]">
                      {items.length === 0 && <span className="text-white/25 text-xs italic self-center">Not yet…</span>}
                      {items.map((it) => {
                        const isNew = it.ep === ep;
                        const done = it.doneAt !== undefined && it.doneAt <= ep;
                        const justDone = it.doneAt === ep;
                        return (
                          <span
                            key={it.label}
                            className={`inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                              done ? "bg-emerald-500/15 border-emerald-400/40 text-emerald-200"
                                : isNew ? "bg-gold/20 border-gold/60 text-gold-light"
                                : "bg-white/10 border-white/15 text-white/85"
                            } ${(isNew || justDone) && animate ? "ug-anim animate-[ugPopIn_0.55s_ease-out_both,ugGlow_1.2s_ease-out_0.3s]" : ""}`}
                          >
                            <span>{done ? "✅" : it.icon}</span>
                            <span className={done ? "line-through decoration-emerald-300/60" : ""}>{it.label}</span>
                            {isNew && !done && <span className="text-[9px] font-black bg-gold text-black px-1.5 py-0.5 rounded-full">NEW</span>}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Villain */}
              <div className="sm:col-span-2">
                <p className="text-white/40 text-[10px] font-bold tracking-widest uppercase mb-2">Villain</p>
                {villain ? (
                  <div className={`relative flex items-center gap-3 rounded-2xl border border-red-400/30 bg-red-950/40 px-4 py-3 ${ep === 5 && animate ? "ug-anim animate-[ugPopIn_0.55s_ease-out_both]" : ""}`}>
                    <span className="text-2xl">🌪️</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-sm">The Shadow Swirl</p>
                      <p className="text-white/50 text-xs">Stole the Galaxy&apos;s starlight</p>
                    </div>
                    <span key={villain.label} className={`shrink-0 text-[11px] font-black uppercase tracking-wide px-2.5 py-1 rounded-md shadow ${villain.className} ${animate && (ep === 5 || ep === 7) ? "ug-anim animate-[ugStamp_0.6s_ease-out_both]" : "-rotate-[8deg]"}`}>
                      {villain.label}
                    </span>
                  </div>
                ) : (
                  <span className="text-white/25 text-xs italic">Something is watching from the dark…</span>
                )}
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
              <p className="text-white/45 text-xs">Every item stays — Arjun can use them in all future episodes.</p>
              <a href="/demo" className="bg-brand/20 hover:bg-brand/40 border border-brand/40 text-brand-light hover:text-white text-xs font-bold px-4 py-2 rounded-full transition-all whitespace-nowrap">
                See the full universe →
              </a>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mt-14">
          <p className="text-white/40 text-sm mb-4">How many episodes will your child&apos;s universe reach?</p>
          <a
            href={user ? "/create" : "/register"}
            className="inline-block bg-brand hover:bg-brand-dark text-white font-bold px-10 py-4 rounded-full shadow-brand transition-all hover:scale-105 text-lg"
          >
            Start Episode 1 →
          </a>
        </div>
      </div>
    </section>
  );
}
