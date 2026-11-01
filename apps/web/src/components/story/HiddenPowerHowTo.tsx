"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * "How do I find it?" — four short animated slides showing the magic lens exactly as the reader shows it:
 * open a story, tap 🔮, move the lens until it sparkles, tap to grab. Opened from the power-day pill.
 */
interface Props {
  open: boolean;
  onClose: () => void;
  power?: { name: string; emoji: string } | null;
  cta: { href: string; label: string };
}

const SLIDE_MS = 5200;

export default function HiddenPowerHowTo({ open, onClose, power, cta }: Props) {
  const [slide, setSlide] = useState(0);
  const [auto, setAuto] = useState(true);
  const emoji = power?.emoji ?? "✨";
  const name = power?.name ?? "special power";

  useEffect(() => {
    if (!open || !auto) return;
    const t = setTimeout(() => setSlide((s) => (s + 1) % 4), SLIDE_MS);
    return () => clearTimeout(t);
  }, [open, auto, slide]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const go = (i: number) => { setAuto(false); setSlide((i + 4) % 4); };
  const steps = [
    { title: "Open any story", text: "On power days, a special power hides on one page of every story. Open any of your hero's stories." },
    { title: "Tap the 🔮 magic lens", text: "It's at the bottom-left of the story page. Tap it to turn the lens on." },
    { title: "Move the lens around", text: "Drag your finger (or mouse) over the picture. When it's close, the lens tells you — and it starts to sparkle!" },
    { title: "Tap to grab it!", text: `The ${name} goes into your hero's Power Book. Finish a whole collection to level up your hero — and win free stories.` },
  ];

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="How to find the hidden power"
        className="relative w-full max-w-sm rounded-3xl bg-space border border-gold/40 shadow-[0_0_60px_rgba(245,158,11,0.25)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onClose} aria-label="Close" className="absolute top-3 right-3 z-50 w-8 h-8 rounded-full bg-black/40 text-white/80 hover:text-white flex items-center justify-center">
          <X className="w-4 h-4" />
        </button>

        {/* Animated scene — key restarts the animation each time the slide changes */}
        <div key={slide} className="relative aspect-square w-full overflow-hidden bg-[#120a2b]">
          {slide === 0 && <SlideOpen />}
          {slide === 1 && <SlideLensButton />}
          {slide === 2 && <SlideSearch emoji={emoji} />}
          {slide === 3 && <SlideGrab emoji={emoji} name={name} />}
        </div>

        <div className="px-5 pt-4 pb-5">
          <p className="text-gold text-[10px] font-black uppercase tracking-[0.2em]">Step {slide + 1} of 4</p>
          <h3 className="font-[family-name:var(--font-display)] text-white text-2xl leading-tight mt-1">{steps[slide].title}</h3>
          <p className="text-white/70 text-sm leading-snug mt-1.5 min-h-[3.75rem]">{steps[slide].text}</p>

          <div className="mt-4 flex items-center justify-between gap-3">
            <button type="button" onClick={() => go(slide - 1)} aria-label="Previous step" className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex gap-1.5">
              {steps.map((s, i) => (
                <button key={s.title} type="button" aria-label={`Step ${i + 1}`} onClick={() => go(i)}
                  className={`h-2 rounded-full transition-all ${i === slide ? "w-6 bg-gold" : "w-2 bg-white/30"}`} />
              ))}
            </div>
            {slide < 3 ? (
              <button type="button" onClick={() => go(slide + 1)} aria-label="Next step" className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center">
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <Link href={cta.href} onClick={onClose} className="shrink-0 bg-gold text-space font-bold text-xs px-4 py-2 rounded-full hover:brightness-110">
                {cta.label}
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Finger({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <span aria-hidden className={`absolute z-30 text-4xl ${className}`} style={style}>
      <span className="absolute left-1 top-0 h-8 w-8 rounded-full border-2 border-gold hp-anim animate-[hpRipple_1.4s_ease-out_infinite]" />
      <span className="relative inline-block hp-anim animate-[hpTap_1.4s_ease-in-out_infinite]">👆</span>
    </span>
  );
}

function SlideOpen() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6">
      <p className="text-white/50 text-[11px] font-bold uppercase tracking-widest">Your hero&apos;s stories</p>
      <div className="flex gap-3">
        {["page-1", "page-4"].map((p, i) => (
          <div key={p} className={`relative w-32 rounded-2xl overflow-hidden border bg-white/5 ${i === 0 ? "border-gold shadow-[0_0_24px_rgba(245,158,11,0.45)]" : "border-white/15 opacity-70"}`}>
            <div className="relative aspect-square">
              <Image src={`/story-demo/phoenix/${p}.webp`} alt="" fill sizes="128px" className="object-cover" />
              <span className="absolute top-1.5 right-1.5 text-lg hp-anim animate-pulse">✨</span>
            </div>
            <div className="px-2 py-1.5">
              <p className="text-white text-[11px] font-semibold truncate">{i === 0 ? "The Baby Phoenix" : "The Frost Tower"}</p>
              <p className="text-gold text-[10px] font-bold">Read ▶</p>
            </div>
          </div>
        ))}
      </div>
      <Finger style={{ left: "34%", top: "62%" }} />
    </div>
  );
}

function StoryPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-4 rounded-2xl overflow-hidden border border-white/15">
      <Image src="/story-demo/phoenix/page-3.webp" alt="" fill sizes="384px" className="object-cover" />
      {children}
    </div>
  );
}

function SlideLensButton() {
  return (
    <StoryPage>
      <span className="absolute bottom-14 left-3 z-20 flex items-center gap-1.5 rounded-full bg-space/85 px-3 py-2 text-[11px] font-bold text-gold shadow-lg ring-2 ring-gold/60">
        <span className="hp-anim animate-pulse">🔮</span> A special power is hiding! Use the magic lens
      </span>
      <Finger style={{ left: "9%", bottom: "4px" }} />
    </StoryPage>
  );
}

function SlideSearch({ emoji }: { emoji: string }) {
  return (
    <StoryPage>
      <span aria-hidden className="absolute z-10 text-3xl hp-anim animate-[hpSparkle_4.2s_ease-in-out_both]" style={{ left: "68%", top: "58%" }}>
        {emoji}
      </span>
      <span aria-hidden
        className="absolute z-20 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full border-4 border-gold/90 bg-white/10 backdrop-brightness-125 shadow-[0_0_30px_rgba(251,191,36,0.6)] hp-anim animate-[hpLensPath_4.2s_ease-in-out_both]" />
      <div className="absolute bottom-11 left-1/2 -translate-x-1/2 z-30 w-[88%] text-center">
        <span className="absolute inset-x-0 rounded-full bg-black/65 px-3 py-1.5 text-[11px] font-semibold text-white hp-anim animate-[hpHintFar_4.2s_linear_both]">Something sparkles on this page… move the lens</span>
        <span className="absolute inset-x-0 rounded-full bg-black/65 px-3 py-1.5 text-[11px] font-semibold text-gold-light opacity-0 hp-anim animate-[hpHintNear_4.2s_linear_both]">Ooh, it&apos;s very close… ✨</span>
      </div>
    </StoryPage>
  );
}

function SlideGrab({ emoji, name }: { emoji: string; name: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 bg-[radial-gradient(circle_at_50%_35%,rgba(245,158,11,0.35),transparent_60%)]">
      <span className="text-7xl drop-shadow-[0_0_24px_rgba(251,191,36,0.9)] hp-anim animate-[hpFlyIn_0.8s_ease-out_both]">{emoji}</span>
      <div className="w-full max-w-[260px] rounded-2xl border border-gold/40 bg-white/10 px-4 py-3 text-center hp-anim animate-[hpFlyIn_0.8s_ease-out_0.5s_both]">
        <p className="text-white text-sm font-bold">You found the {name}!</p>
        <p className="text-white/60 text-[11px] mt-0.5">Added to your hero&apos;s 📖 Power Book</p>
        <div className="mt-2.5 h-2 rounded-full bg-white/15 overflow-hidden">
          <div className="h-full rounded-full bg-gold hp-anim animate-[hpBar_1s_ease-out_1.2s_both]" style={{ width: "37.5%" }} />
        </div>
        <p className="text-gold-light text-[10px] font-bold mt-1">Collection 3 / 8 — find all 8 for a Bronze hero 🥉</p>
      </div>
    </div>
  );
}
