"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* ── Story pages data ─────────────────────────────────────────────── */
interface Page {
  id: number;
  bg: string;
  scene: React.ReactNode;
  isCover?: boolean;
  title?: string;
  subtitle?: string;
  caption?: string;
  isEnd?: boolean;
}

const PAGES: Page[] = [
  {
    id: 0,
    bg: "from-indigo-950 via-purple-900 to-violet-950",
    isCover: true,
    title: "Arjun's Space Adventure",
    subtitle: "The Hero of the Galaxy",
    scene: (
      <div className="relative w-full h-full flex items-center justify-center select-none">
        {/* Stars bg */}
        {["top-2 left-6","top-4 right-10","top-8 left-1/3","top-1 right-1/3","top-6 left-1/2"].map((pos, i) => (
          <span key={i} className={`absolute ${pos} text-white/50 text-sm`}>✦</span>
        ))}
        {/* Planet */}
        <div className="absolute top-5 right-6 w-14 h-14 rounded-full bg-purple-400/40 border-2 border-purple-300/30">
          <div className="absolute -inset-3 border-2 border-purple-300/20 rounded-full" style={{ transform: "rotateX(70deg)" }} />
        </div>
        {/* Hero */}
        <span className="text-7xl z-10">🦸</span>
        {/* Rocket */}
        <span className="absolute right-8 bottom-6 text-4xl animate-float">🚀</span>
        {/* Moon */}
        <span className="absolute left-4 bottom-8 text-3xl opacity-60">🌙</span>
      </div>
    ),
  },
  {
    id: 1,
    bg: "from-blue-950 to-slate-900",
    caption: "One ordinary Tuesday, Arjun found a glowing rocket waiting in his garden — just his size.",
    scene: (
      <div className="relative w-full h-full select-none">
        {/* Ground */}
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-green-900/50 rounded-b-lg" />
        {/* House */}
        <span className="absolute bottom-7 left-4 text-5xl">🏡</span>
        {/* Rocket with glow */}
        <span className="absolute bottom-7 right-6 text-5xl animate-float drop-shadow-[0_0_12px_rgba(139,92,246,0.8)]">🚀</span>
        {/* Stars */}
        <span className="absolute top-3 left-8 text-2xl opacity-60">⭐</span>
        <span className="absolute top-6 right-12 text-xl opacity-40">✦</span>
        <span className="absolute top-2 left-1/2 text-xl opacity-50">✨</span>
      </div>
    ),
  },
  {
    id: 2,
    bg: "from-slate-950 via-indigo-950 to-purple-950",
    caption: "He zoomed past the moon, through clouds of stardust, towards the great unknown...",
    scene: (
      <div className="relative w-full h-full select-none overflow-hidden">
        {/* Star trail */}
        {[["20%","30%"],["40%","20%"],["60%","35%"],["80%","15%"],["15%","55%"]].map(([l,t], i) => (
          <span key={i} className="absolute text-white/40 text-xs" style={{ left: l, top: t }}>✦</span>
        ))}
        {/* Moon */}
        <span className="absolute top-3 left-6 text-4xl">🌙</span>
        {/* Rocket angled */}
        <span className="absolute top-8 left-1/2 text-5xl -translate-x-1/2 animate-float" style={{ transform: "rotate(-35deg)" }}>🚀</span>
        {/* Planet */}
        <span className="absolute bottom-4 right-4 text-4xl opacity-70">🪐</span>
        {/* Speed lines */}
        <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 200 140">
          <line x1="20" y1="70" x2="80" y2="60" stroke="white" strokeWidth="1.5" strokeDasharray="4 3" />
          <line x1="30" y1="85" x2="90" y2="78" stroke="white" strokeWidth="1" strokeDasharray="4 3" />
          <line x1="15" y1="55" x2="65" y2="48" stroke="white" strokeWidth="1" strokeDasharray="4 3" />
        </svg>
      </div>
    ),
  },
  {
    id: 3,
    bg: "from-teal-950 to-emerald-900",
    caption: "On Planet Zephyr, friendly aliens cheered — their greatest hero had finally arrived!",
    scene: (
      <div className="relative w-full h-full select-none">
        {/* Alien ground */}
        <div className="absolute bottom-0 left-0 right-0 h-10 bg-emerald-800/60 rounded-b-lg" />
        {/* Plants */}
        <span className="absolute bottom-8 left-2 text-3xl">🌿</span>
        <span className="absolute bottom-8 right-2 text-3xl">🌿</span>
        {/* Hero lands */}
        <span className="absolute bottom-9 left-1/2 -translate-x-1/2 text-5xl">🦸</span>
        {/* Aliens cheering */}
        <span className="absolute bottom-9 left-6 text-3xl">👽</span>
        <span className="absolute bottom-9 right-6 text-3xl">👽</span>
        {/* Celebration */}
        <span className="absolute top-4 left-1/2 -translate-x-1/2 text-2xl animate-float">🎉</span>
        <span className="absolute top-3 left-8 text-xl opacity-60">⭐</span>
        <span className="absolute top-3 right-8 text-xl opacity-60">⭐</span>
      </div>
    ),
  },
  {
    id: 4,
    bg: "from-amber-900 to-yellow-800",
    isEnd: true,
    caption: "Arjun saved Planet Zephyr and flew home — the greatest hero in all the galaxy.",
    scene: (
      <div className="relative w-full h-full flex items-center justify-center select-none">
        {/* Glow */}
        <div className="absolute inset-0 bg-yellow-400/10 rounded-lg" />
        {/* Stars */}
        {["top-2 left-4","top-4 right-6","top-2 left-1/2","top-6 left-1/4","top-4 right-1/3"].map((pos, i) => (
          <span key={i} className={`absolute ${pos} text-yellow-300 text-lg`}>★</span>
        ))}
        {/* Trophy */}
        <span className="text-7xl z-10">🏆</span>
        {/* Hero */}
        <span className="absolute bottom-6 left-6 text-4xl">🦸</span>
        {/* Earth */}
        <span className="absolute bottom-6 right-6 text-4xl">🌍</span>
      </div>
    ),
  },
];

/* ── Component ────────────────────────────────────────────────────── */
export default function StoryBook() {
  const [current, setCurrent] = useState(0);
  const [animClass, setAnimClass] = useState("animate-page-flip");
  const [key, setKey] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const advance = useCallback((dir: "forward" | "back" = "forward") => {
    setAnimClass(dir === "forward" ? "animate-page-flip" : "animate-page-flip-back");
    setKey((k) => k + 1);
    setCurrent((c) => dir === "forward"
      ? (c + 1) % PAGES.length
      : (c - 1 + PAGES.length) % PAGES.length
    );
  }, []);

  /* Auto-advance every 3 s */
  useEffect(() => {
    timerRef.current = setTimeout(() => advance("forward"), 3000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [current, advance]);

  const page = PAGES[current];

  return (
    <div className="relative w-72 cursor-pointer group" onClick={() => advance("forward")} title="Click to turn page">
      {/* Book shadow */}
      <div className="absolute -bottom-3 left-4 right-4 h-6 bg-black/30 blur-md rounded-full" />

      {/* Book outer frame — white border like a printed page */}
      <div className="relative bg-white rounded-2xl overflow-hidden shadow-2xl border-4 border-white">
        {/* Page contents — key forces animation restart */}
        <div key={key} className={animClass}>

          {/* ── Illustration panel ─────────────────────── */}
          <div className={`relative h-44 bg-gradient-to-br ${page.bg} overflow-hidden`}>
            {page.scene}

            {/* Cover overlay */}
            {page.isCover && (
              <div className="absolute inset-0 flex flex-col items-center justify-end pb-4 px-4 bg-gradient-to-t from-black/60 to-transparent">
                <p className="font-[family-name:var(--font-display)] font-black text-white text-center text-base leading-tight">
                  {page.title}
                </p>
                <p className="text-white/60 text-xs mt-1">{page.subtitle}</p>
              </div>
            )}

            {/* Page number badge */}
            {!page.isCover && (
              <div className="absolute top-2 right-3 bg-black/30 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                {page.id} / {PAGES.length - 1}
              </div>
            )}
          </div>

          {/* ── Caption panel ──────────────────────────── */}
          <div className="bg-white px-4 py-3 min-h-[64px] flex items-center">
            {page.isCover ? (
              <p className="text-ink-muted text-xs text-center w-full italic">
                ✦ Tap to begin the adventure ✦
              </p>
            ) : (
              <p className="text-ink text-xs leading-relaxed">
                {page.isEnd && <span className="font-bold text-gold mr-1">THE END.</span>}
                {page.caption}
              </p>
            )}
          </div>

        </div>{/* end animated div */}

        {/* ── Progress dots ──────────────────────────── */}
        <div className="bg-white pb-3 flex items-center justify-center gap-1.5">
          {PAGES.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={(e) => { e.stopPropagation(); const dir = i > current ? "forward" : "back"; setAnimClass(dir === "forward" ? "animate-page-flip" : "animate-page-flip-back"); setKey(k => k+1); setCurrent(i); }}
              className={`rounded-full transition-all duration-300 ${
                i === current ? "w-4 h-2 bg-brand" : "w-2 h-2 bg-ink/20 hover:bg-brand/40"
              }`}
              aria-label={`Go to page ${i}`}
            />
          ))}
        </div>
      </div>

      {/* Hover hint */}
      <p className="text-center text-white/40 text-xs mt-3 group-hover:text-white/60 transition">
        Click to turn page →
      </p>
    </div>
  );
}
