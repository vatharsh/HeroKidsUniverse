"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* ── Speech bubble ────────────────────────────────────────────────── */
function Bubble({
  text,
  speaker,
  pos,
  tailSide = "bottom-left",
}: {
  text: string;
  speaker?: string;
  pos: string;
  tailSide?: "bottom-left" | "bottom-right" | "top-left";
}) {
  const tail: Record<string, string> = {
    "bottom-left":  "absolute bottom-[-7px] left-4 border-[7px] border-transparent border-t-white drop-shadow-sm",
    "bottom-right": "absolute bottom-[-7px] right-4 border-[7px] border-transparent border-t-white drop-shadow-sm",
    "top-left":     "absolute top-[-7px] left-4 border-[7px] border-transparent border-b-white drop-shadow-sm",
  };
  return (
    <div className={`absolute ${pos} z-10`} style={{ maxWidth: 130 }}>
      <div className="relative bg-white/95 backdrop-blur-sm rounded-xl shadow-md px-2.5 py-1.5 border border-black/5">
        {speaker && <p className="text-[8px] font-bold text-brand mb-0.5 uppercase tracking-wide">{speaker}</p>}
        <p className="text-[10px] text-ink font-medium leading-snug">{text}</p>
        <div className={tail[tailSide]} />
      </div>
    </div>
  );
}

/* ── Page scenes ──────────────────────────────────────────────────── */
function CoverScene() {
  return (
    <div className="relative w-full h-full flex items-center justify-center select-none overflow-hidden">
      {/* Star field */}
      {(["top-2 left-6","top-5 right-8","top-10 left-1/3","top-3 right-1/3","top-7 left-1/2","top-14 right-4","top-16 left-8"] as const).map(
        (pos, i) => <span key={i} className={`absolute ${pos} text-white/40 text-xs`}>✦</span>
      )}
      {/* Saturn planet */}
      <div className="absolute top-4 right-5 w-12 h-12 rounded-full bg-purple-400/35 border border-purple-300/25">
        <div className="absolute -inset-2.5 border border-purple-300/20 rounded-full" style={{ transform: "rotateX(68deg)" }} />
      </div>
      {/* Hero */}
      <span className="text-6xl z-10 drop-shadow-xl">🦸</span>
      {/* Rocket */}
      <span className="absolute right-8 bottom-5 text-4xl animate-float">🚀</span>
      {/* Moon */}
      <span className="absolute left-4 bottom-7 text-3xl opacity-55">🌙</span>
    </div>
  );
}

function Scene1() {
  return (
    <div className="relative w-full h-full select-none">
      {/* Ground */}
      <div className="absolute bottom-0 left-0 right-0 h-8 bg-emerald-900/40 rounded-b-lg" />
      {/* Night sky stars */}
      <span className="absolute top-2 left-6 text-xl opacity-50">⭐</span>
      <span className="absolute top-5 right-10 text-sm opacity-30">✦</span>
      {/* House */}
      <span className="absolute bottom-7 left-4 text-5xl">🏡</span>
      {/* Glowing rocket */}
      <span className="absolute bottom-7 right-5 text-5xl drop-shadow-[0_0_14px_rgba(139,92,246,0.9)] animate-float">🚀</span>
      {/* Arjun */}
      <span className="absolute bottom-8 left-[42%] text-3xl">🧒</span>
      {/* Bubbles */}
      <Bubble text="A rocket! Just my size!" speaker="Arjun" pos="top-3 left-3" tailSide="bottom-left" />
      <Bubble text="Mum! Come look!" speaker="Arjun" pos="top-3 right-2" tailSide="bottom-right" />
    </div>
  );
}

function Scene2() {
  return (
    <div className="relative w-full h-full select-none overflow-hidden">
      {/* Speed lines */}
      <svg className="absolute inset-0 w-full h-full opacity-15" viewBox="0 0 200 140" aria-hidden>
        {[[10,60,75,55],[15,80,80,76],[8,40,60,37],[12,100,70,97]].map(([x1,y1,x2,y2],i) => (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="white" strokeWidth="1.5" strokeDasharray="5 4"/>
        ))}
      </svg>
      {/* Star trails */}
      {(["20% 25%","45% 15%","65% 30%","80% 10%","10% 50%"] as const).map((s,i)=>(
        <span key={i} className="absolute text-white/35 text-[10px]" style={{left:s.split(" ")[0], top:s.split(" ")[1]}}>✦</span>
      ))}
      {/* Moon */}
      <span className="absolute top-3 left-5 text-4xl">🌙</span>
      {/* Earth below */}
      <span className="absolute bottom-3 left-5 text-3xl opacity-70">🌍</span>
      {/* Rocket with angle */}
      <span className="absolute top-8 left-1/2 -translate-x-1/2 text-5xl animate-float" style={{ transform: "rotate(-35deg)" }}>🚀</span>
      {/* Planet */}
      <span className="absolute bottom-4 right-4 text-4xl opacity-65">🪐</span>
      {/* Bubble */}
      <Bubble text="I can see our house from here!" speaker="Arjun" pos="bottom-14 left-2" tailSide="top-left" />
    </div>
  );
}

function Scene3() {
  return (
    <div className="relative w-full h-full select-none">
      {/* Alien ground */}
      <div className="absolute bottom-0 left-0 right-0 h-10 bg-emerald-700/50 rounded-b-lg" />
      {/* Plants */}
      <span className="absolute bottom-9 left-1 text-3xl">🌿</span>
      <span className="absolute bottom-9 right-1 text-3xl">🌿</span>
      {/* Arjun lands center */}
      <span className="absolute bottom-9 left-[42%] text-4xl">🦸</span>
      {/* Alien left */}
      <span className="absolute bottom-9 left-3 text-4xl">👽</span>
      {/* Alien right */}
      <span className="absolute bottom-9 right-3 text-4xl">👽</span>
      {/* Celebration */}
      <span className="absolute top-4 left-1/2 -translate-x-1/2 text-2xl animate-float">🎉</span>
      {/* Bubbles */}
      <Bubble text="You actually came!" speaker="Alien" pos="top-3 left-1" tailSide="bottom-left" />
      <Bubble text="Don't worry — I'll help!" speaker="Arjun" pos="top-3 right-1" tailSide="bottom-right" />
    </div>
  );
}

function Scene4() {
  return (
    <div className="relative w-full h-full flex items-center justify-center select-none">
      {/* Glow */}
      <div className="absolute inset-0 bg-amber-400/10 rounded-lg" />
      {(["top-2 left-4","top-5 right-6","top-2 left-1/2","top-7 left-1/4","top-4 right-1/3"] as const).map((pos,i)=>(
        <span key={i} className={`absolute ${pos} text-yellow-300 text-lg`}>★</span>
      ))}
      {/* Trophy */}
      <span className="text-6xl z-10">🏆</span>
      {/* Hero */}
      <span className="absolute bottom-5 left-6 text-3xl">🦸</span>
      {/* Earth */}
      <span className="absolute bottom-5 right-6 text-4xl">🌍</span>
      {/* Bubble */}
      <Bubble text="Best Tuesday EVER!" speaker="Arjun" pos="top-4 left-1/2 -translate-x-1/2" tailSide="bottom-left" />
    </div>
  );
}

/* ── Page data ────────────────────────────────────────────────────── */
interface Page {
  id: number;
  isCover?: boolean;
  isEnd?: boolean;
  bg: string;
  scene: React.ReactNode;
  title?: string;
  subtitle?: string;
  caption?: string;
}

const PAGES: Page[] = [
  {
    id: 0,
    isCover: true,
    bg: "from-indigo-950 via-purple-900 to-violet-950",
    scene: <CoverScene />,
    title: "Arjun's Space Adventure",
    subtitle: "The Hero of the Galaxy",
  },
  {
    id: 1,
    bg: "from-blue-950 to-slate-900",
    scene: <Scene1 />,
    caption: "One ordinary Tuesday, Arjun found a glowing rocket in his garden — just his size.",
  },
  {
    id: 2,
    bg: "from-slate-950 via-indigo-950 to-purple-950",
    scene: <Scene2 />,
    caption: "He zoomed past the moon, through clouds of stardust, toward the great unknown.",
  },
  {
    id: 3,
    bg: "from-teal-950 to-emerald-900",
    scene: <Scene3 />,
    caption: "On Planet Zephyr, the Zephyrians had been waiting for their hero!",
  },
  {
    id: 4,
    isEnd: true,
    bg: "from-amber-950 to-yellow-900",
    scene: <Scene4 />,
    caption: "Arjun saved Planet Zephyr — and made it home just in time for dinner.",
  },
];

/* ── StoryBook component ──────────────────────────────────────────── */
type FlipDir = "fwd" | "back";
type FlipState = "idle" | "out" | "in";

export default function StoryBook() {
  const [page, setPage]             = useState(0);
  const [exitPage, setExitPage]     = useState<number | null>(null);
  const [flipDir, setFlipDir]       = useState<FlipDir>("fwd");
  const [flipState, setFlipState]   = useState<FlipState>("idle");
  const flipLock                    = useRef(false);

  const goTo = useCallback((next: number, dir: FlipDir) => {
    if (flipLock.current) return;
    flipLock.current = true;

    setFlipDir(dir);
    setExitPage(page);       // capture current page for exit animation
    setFlipState("out");

    setTimeout(() => {
      setPage(next);         // swap content under exit overlay
      setExitPage(null);     // remove exit overlay
      setFlipState("in");    // new content animates in

      setTimeout(() => {
        setFlipState("idle");
        flipLock.current = false;
      }, 380);
    }, 340);
  }, [page]);

  /* Auto-advance every 4 s */
  useEffect(() => {
    if (flipState !== "idle") return;
    const t = setTimeout(() => goTo((page + 1) % PAGES.length, "fwd"), 4000);
    return () => clearTimeout(t);
  }, [page, flipState, goTo]);

  const enterClass =
    flipState === "in"
      ? flipDir === "fwd"
        ? "book-enter-fwd"
        : "book-enter-back"
      : "";

  const exitClass =
    exitPage !== null
      ? flipDir === "fwd"
        ? "book-exit-fwd"
        : "book-exit-back"
      : "";

  function renderPage(p: Page) {
    return (
      <>
        {/* Illustration */}
        <div className={`relative h-44 bg-gradient-to-br ${p.bg} overflow-hidden`}>
          {p.scene}

          {/* Cover title overlay */}
          {p.isCover && (
            <div className="absolute inset-0 flex flex-col items-center justify-end pb-3 px-3 bg-gradient-to-t from-black/65 to-transparent pointer-events-none">
              <p className="font-[family-name:var(--font-display)] font-black text-white text-center text-sm leading-tight">
                {p.title}
              </p>
              <p className="text-white/55 text-[11px] mt-0.5">{p.subtitle}</p>
            </div>
          )}

          {/* Page badge */}
          {!p.isCover && (
            <div className="absolute top-2 right-2.5 bg-black/30 backdrop-blur-sm text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
              {p.id} / {PAGES.length - 1}
            </div>
          )}
        </div>

        {/* Caption */}
        <div className="bg-white px-4 py-3 min-h-[60px] flex items-center">
          {p.isCover ? (
            <p className="text-ink-muted text-[11px] text-center w-full italic">✦ Tap to begin the adventure ✦</p>
          ) : (
            <p className="text-ink text-[11px] leading-relaxed">
              {p.isEnd && <span className="font-bold text-gold mr-1">THE END.</span>}
              {p.caption}
            </p>
          )}
        </div>
      </>
    );
  }

  return (
    <div className="relative w-72 group cursor-pointer select-none" onClick={() => goTo((page + 1) % PAGES.length, "fwd")}>
      {/* Book shadow */}
      <div className="absolute -bottom-3 left-4 right-4 h-6 bg-black/30 blur-md rounded-full pointer-events-none" />

      {/* Book frame */}
      <div className="relative bg-white rounded-2xl overflow-hidden shadow-2xl border-[3px] border-white">
        {/* Book spine accent on the left */}
        <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-gradient-to-b from-brand/40 via-brand/20 to-brand/40 z-20 pointer-events-none rounded-l-2xl" />

        {/* Page container — fixed height prevents layout shift during swap */}
        <div className="relative" style={{ minHeight: 228 }}>
          {/* Exit overlay — absolute, animates out */}
          {exitPage !== null && (
            <div key={`exit-${exitPage}`} className={`absolute inset-0 z-10 bg-white ${exitClass}`}>
              {renderPage(PAGES[exitPage])}
            </div>
          )}

          {/* Entering page — normal flow, animates in */}
          <div key={`enter-${page}`} className={enterClass}>
            {renderPage(PAGES[page])}
          </div>
        </div>

        {/* Progress dots */}
        <div className="bg-white pb-3 flex items-center justify-center gap-1.5">
          {PAGES.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (i !== page) goTo(i, i > page ? "fwd" : "back");
              }}
              className={`rounded-full transition-all duration-300 ${
                i === page ? "w-4 h-2 bg-brand" : "w-2 h-2 bg-ink/20 hover:bg-brand/40"
              }`}
              aria-label={`Go to page ${i}`}
            />
          ))}
        </div>
      </div>

      {/* Nav arrows */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); goTo((page - 1 + PAGES.length) % PAGES.length, "back"); }}
        className="absolute -left-10 top-[90px] text-white/40 hover:text-white/80 transition text-xl"
        aria-label="Previous page"
      >‹</button>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); goTo((page + 1) % PAGES.length, "fwd"); }}
        className="absolute -right-10 top-[90px] text-white/40 hover:text-white/80 transition text-xl"
        aria-label="Next page"
      >›</button>

      <p className="text-center text-white/35 text-xs mt-3 group-hover:text-white/55 transition">
        Click or wait to turn page →
      </p>
    </div>
  );
}
