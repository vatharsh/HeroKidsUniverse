"use client";

import { ChevronLeft, ChevronRight, Lock, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "@/contexts/AuthContext";

/**
 * Home-page sample: Episode 1 of Siddhant's Universe, made with our own story engine (invented heroes,
 * no real child's photo). Bubbles use the engine's own positions; the last card teases a locked Episode 2.
 */
interface Bubble { speaker: string; text: string; x: number; y: number; w: number; tail: "left" | "right" }
interface Panel { src: string; alt: string; caption?: string; bubbles?: Bubble[] }

const TITLE = "The Baby Phoenix of Star Castle";
const PANELS: Panel[] = [
  { src: "/story-demo/phoenix/cover.webp", alt: `Cover — ${TITLE}, starring Siddhant and Kayra` },
  {
    src: "/story-demo/phoenix/page-1.webp",
    alt: "Siddhant and Kayra in the grand hall of the Academy of Stars, finding a golden feather",
    caption: "First night at the Academy of Stars! Staircases drifted like kites, books flew past candles… and a golden feather sparkled on the steps.",
    bubbles: [{ speaker: "Siddhant", text: "Arre look, Kayra! A magic feather!", x: 59.6, y: 53.7, w: 36.7, tail: "left" }],
  },
  {
    src: "/story-demo/phoenix/page-2.webp",
    alt: "Siddhant and Kayra kneel beside Agni, a grey, shivering baby phoenix",
    caption: "The feathers led to Agni, the baby phoenix — shivering, grey, his warm flame gone out.",
    bubbles: [
      { speaker: "Kayra", text: "Bhaiya, Agni has lost all his fire!", x: 47.4, y: 13.8, w: 50.3, tail: "right" },
      { speaker: "Siddhant", text: "Don't be scared, little Agni. We will help!", x: 30.7, y: 60.9, w: 41.7, tail: "left" },
    ],
  },
  {
    src: "/story-demo/phoenix/page-3.webp",
    alt: "Siddhant casts a spell while Kuhu the frost-goblin sneezes frost",
    caption: "Kuhu the Frost-Goblin had chilled the tower to save his mango kulfi! Every warming spell fizzled out.",
    bubbles: [{ speaker: "Siddhant", text: "None of our school spells are working!", x: 15.1, y: 23.5, w: 52.5, tail: "left" }],
  },
  {
    src: "/story-demo/phoenix/page-4.webp",
    alt: "Kayra reads a carved rhyme on a brass plate",
    caption: "A carved rhyme held the secret: no wand can wake this spark — only bravery that guards a friend.",
    bubbles: [
      { speaker: "Siddhant", text: "Kayra, what can wake Agni's fire?", x: 16.6, y: 21.3, w: 53.3, tail: "left" },
      { speaker: "Kayra", text: "Bhaiya! It needs courage and kindness, not magic!", x: 38, y: 66.3, w: 44, tail: "left" },
    ],
  },
  {
    src: "/story-demo/phoenix/page-5.webp",
    alt: "Siddhant holds Agni while Kayra wraps them in her cloak as golden light begins to glow",
    caption: "Siddhant held Agni close. Kayra wrapped them in her cloak. Courage and kindness filled their hearts…",
    bubbles: [{ speaker: "Kayra", text: "Arre wah! Look at the golden light!", x: 58.3, y: 63.8, w: 37.3, tail: "left" }],
  },
  {
    src: "/story-demo/phoenix/page-6.webp",
    alt: "Agni bursts into golden fire while a glowing feather shows a map to a second phoenix egg",
    caption: "WHOOSH! Agni blazed back in golden fire — and a reborn feather unfolded into a map to a second phoenix egg…",
    bubbles: [
      { speaker: "Siddhant", text: "The feather is showing a mountain path!", x: 4, y: 5, w: 40, tail: "right" },
      { speaker: "Kayra", text: "Chalo, Bhaiya! There is another egg to find!", x: 56, y: 5, w: 40, tail: "left" },
    ],
  },
];
/** Panels plus the locked "Episode 2" card at the end. */
const TOTAL = PANELS.length + 1;
const LOCKED = PANELS.length;
const STORY_PAGES = PANELS.length - 1;

function SpeechBubble({ b }: { b: Bubble }) {
  // A little wider than the engine's box so the bigger text still fits on 2–3 lines.
  const width = Math.min(b.w + 8, 100 - b.x - 2);
  return (
    <div className="absolute z-20" style={{ left: `${Math.max(1.5, b.x - 2)}%`, top: `${b.y}%`, width: `${width}%` }}>
      <div className="relative rounded-xl border-[2.5px] border-black bg-white px-2 py-1.5 shadow-[3px_3px_0_rgba(0,0,0,0.85)]">
        <p className="font-[family-name:var(--font-comic)] text-[10px] sm:text-[11px] leading-none text-brand mb-1 uppercase tracking-wide">{b.speaker}</p>
        <p className="font-[family-name:var(--font-comic)] text-[12.5px] sm:text-[14px] leading-[1.15] text-black">{b.text}</p>
        <span aria-hidden className="absolute -bottom-[11px] h-0 w-0 border-x-[7px] border-x-transparent border-t-[11px] border-t-black" style={b.tail === "left" ? { left: 12 } : { right: 12 }} />
        <span aria-hidden className="absolute -bottom-[6px] h-0 w-0 border-x-[5px] border-x-transparent border-t-[7px] border-t-white" style={b.tail === "left" ? { left: 14 } : { right: 14 }} />
      </div>
    </div>
  );
}

function PageView({ idx, priority = false }: { idx: number; priority?: boolean }) {
  const { user } = useAuth();
  if (idx === LOCKED) return <LockedEpisode signedIn={!!user} />;
  const panel = PANELS[idx];
  const isCover = idx === 0;
  return (
    <div className="relative w-full h-full rounded-[1.15rem] bg-[#080414] shadow-[0_18px_50px_rgba(0,0,0,0.42)]">
      <div className="absolute inset-[6px] overflow-hidden rounded-[0.9rem] bg-[#120a2b] flex flex-col">
        {isCover ? (
          <>
            <Image src={panel.src} alt={panel.alt} fill sizes="(max-width: 640px) 82vw, 420px" priority={priority} className="object-cover" />
            <div className="absolute inset-x-0 top-0 z-10 h-2/5 bg-gradient-to-b from-[#1a0b3d]/85 via-[#1a0b3d]/40 to-transparent" />
            <div className="absolute inset-x-0 top-0 z-20 px-4 pt-4 text-center">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-gold-light">Episode 1</p>
              <p className="mt-1 font-[family-name:var(--font-display)] text-[1.6rem] leading-[1.05] text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">{TITLE}</p>
              <p className="mt-1.5 text-[11px] font-semibold text-white/85">Starring Siddhant &amp; Kayra</p>
            </div>
            <div className="absolute bottom-3 right-3 z-20 rounded-full bg-white/90 p-1 shadow-lg">
              <Image src="/logo.png" alt="HeroKids Universe" width={44} height={44} className="h-11 w-11 rounded-full" />
            </div>
          </>
        ) : (
          <>
            {/* Square artwork on top, the story text below — like a page of the real book. */}
            <div className="relative w-full aspect-square shrink-0">
              <Image src={panel.src} alt={panel.alt} fill sizes="(max-width: 640px) 82vw, 420px" priority={priority} className="object-cover" />
              {panel.bubbles?.map((b) => <SpeechBubble key={b.speaker + b.text} b={b} />)}
            </div>
            <div className="flex flex-1 items-center px-3.5 py-2 bg-[linear-gradient(180deg,#fdf6e3,#f5e9c8)]">
              <p className="text-[11.5px] sm:text-[12.5px] leading-snug text-[#3b2a12]">{panel.caption}</p>
            </div>
          </>
        )}
        <div className="absolute inset-0 z-30 pointer-events-none storybook-page-shine" />
      </div>
    </div>
  );
}

function LockedEpisode({ signedIn }: { signedIn: boolean }) {
  return (
    <div className="relative w-full h-full rounded-[1.15rem] bg-[#080414] shadow-[0_18px_50px_rgba(0,0,0,0.42)]">
      <div className="absolute inset-[6px] overflow-hidden rounded-[0.9rem] bg-black">
        <div className="absolute inset-0 scale-110" style={{ backgroundImage: "url(/story-demo/phoenix/page-6.webp)", backgroundSize: "cover", backgroundPosition: "center", filter: "blur(10px) brightness(0.35)" }} />
        <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-gold/50 bg-gold/15 shadow-[0_0_30px_rgba(245,158,11,0.35)]">
            <Lock className="h-6 w-6 text-gold-light" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-gold-light">Episode 2</p>
          <p className="mt-1 font-[family-name:var(--font-display)] text-2xl leading-tight text-white">The Second Phoenix Egg</p>
          <p className="mt-3 text-sm text-white/75 leading-snug">Siddhant &amp; Kayra&apos;s adventure continues next week… the map, the mountains, and a new friend waiting to hatch.</p>
          <Link
            href={signedIn ? "/create" : "/register"}
            className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-space shadow-[0_0_24px_rgba(245,158,11,0.4)] hover:brightness-110"
          >
            <Sparkles className="h-4 w-4" /> {signedIn ? "Continue your hero's story" : "Start your hero's story"}
          </Link>
          <p className="mt-3 text-[11px] text-white/45">Every child gets their own universe — new episodes, same hero.</p>
        </div>
      </div>
    </div>
  );
}

export default function StoryBook() {
  const [page, setPage] = useState(0);
  const [exitIdx, setExitIdx] = useState<number | null>(null);
  const [animDir, setAnimDir] = useState<"fwd" | "back" | null>(null);

  const flipLock = useRef(false);
  const pageRef = useRef(0);
  const autoTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const doFlip = useCallback((next: number, dir: "fwd" | "back") => {
    if (flipLock.current || next === pageRef.current) return;
    flipLock.current = true;
    setExitIdx(pageRef.current);
    setAnimDir(dir);
    pageRef.current = next;
    setPage(next);
    setTimeout(() => {
      setExitIdx(null);
      setAnimDir(null);
      flipLock.current = false;
    }, 400);
  }, []);

  const flipNext = useCallback(() => doFlip((pageRef.current + 1) % TOTAL, "fwd"), [doFlip]);
  const flipPrev = useCallback(() => doFlip((pageRef.current - 1 + TOTAL) % TOTAL, "back"), [doFlip]);

  // Pages with text get time to be read; the locked Episode 2 card lingers longest.
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const ms = page === LOCKED ? 9000 : page === 0 ? 4000 : 6000;
    autoTimer.current = setTimeout(flipNext, ms);
    return () => clearTimeout(autoTimer.current);
  }, [page, paused, flipNext]);

  const pageLabel = page === 0 ? "Cover" : page === LOCKED ? "Next" : `${page}/${STORY_PAGES}`;

  return (
    <div
      className="relative w-full max-w-[430px] select-none storybook-stage"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="relative rounded-[1.75rem] border border-white/15 bg-white/[0.07] p-3.5 shadow-[0_28px_80px_rgba(0,0,0,0.45)] backdrop-blur-md">
        <div className="relative rounded-[1.35rem] border border-gold/25 bg-[linear-gradient(145deg,rgba(253,230,138,0.16),rgba(124,58,237,0.18)_42%,rgba(11,5,32,0.94))] p-3 overflow-hidden">
          <div className="absolute left-0 top-5 bottom-5 w-3 rounded-r-full bg-gradient-to-b from-gold/70 via-white/20 to-brand-light/40 shadow-[0_0_24px_rgba(245,158,11,0.32)]" />
          <div className="absolute -right-10 top-12 h-px w-40 rotate-[-18deg] bg-gradient-to-r from-transparent via-gold/30 to-transparent pointer-events-none" />
          <div className="absolute -left-8 bottom-28 h-px w-36 rotate-[22deg] bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />

          <div className="relative z-10 flex items-center justify-between gap-3 pb-3 pl-3">
            <div className="min-w-0">
              <div className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-gold/35 bg-gold/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-gold-light shadow-[0_0_22px_rgba(245,158,11,0.14)]">
                <Sparkles className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">Sample Story</span>
              </div>
              <p className="mt-2 truncate font-[family-name:var(--font-display)] text-xl leading-none text-white sm:text-2xl">
                Siddhant&apos;s Universe
              </p>
              <p className="mt-1 truncate text-[11px] text-white/55">Episode 1 · {TITLE}</p>
            </div>
            <div className="hidden rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-right sm:block">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Page</p>
              <p className="font-[family-name:var(--font-display)] text-2xl leading-none text-gold">{pageLabel}</p>
            </div>
          </div>

          <div className="relative z-10">
            <div className="relative mx-auto aspect-[3/4] w-full overflow-hidden rounded-[1.2rem] border border-white/10 bg-space shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
              {exitIdx !== null && (
                <div className={`absolute inset-0 z-10 ${animDir === "fwd" ? "book-exit-fwd" : "book-exit-back"}`}>
                  <PageView idx={exitIdx} />
                </div>
              )}
              <div className={`w-full h-full ${animDir ? (animDir === "fwd" ? "book-enter-fwd" : "book-enter-back") : ""}`}>
                <PageView idx={page} priority={page === 0} />
              </div>
            </div>

            <button
              type="button"
              aria-label="Previous page"
              onClick={flipPrev}
              className="absolute left-2 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/35 text-white/70 shadow-lg backdrop-blur-md transition hover:bg-white/15 hover:text-white sm:-left-5"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="Next page"
              onClick={flipNext}
              className="absolute right-2 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/35 text-white/70 shadow-lg backdrop-blur-md transition hover:bg-white/15 hover:text-white sm:-right-5"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          <div className="relative z-10 mt-4 flex flex-col gap-3 px-1 pb-1">
            <div className="flex items-center justify-center gap-1.5">
              {Array.from({ length: TOTAL }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={i === 0 ? "Cover" : i === LOCKED ? "Episode 2 (locked)" : `Page ${i}`}
                  onClick={() => doFlip(i, i > pageRef.current ? "fwd" : "back")}
                  className={`rounded-full transition-all duration-200 ${
                    i === LOCKED
                      ? `flex h-4 w-4 items-center justify-center ${i === page ? "bg-gold text-space" : "bg-white/20 text-white/70 hover:bg-white/40"}`
                      : `h-2 ${i === page ? "w-7 bg-gold shadow-[0_0_14px_rgba(245,158,11,0.55)]" : "w-2 bg-white/30 hover:bg-white/60"}`
                  }`}
                >
                  {i === LOCKED && <Lock className="h-2.5 w-2.5" />}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/35">Next episode</p>
                <p className="truncate text-xs font-semibold text-white/70">🔒 The Second Egg</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/35">New friend</p>
                <p className="truncate text-xs font-semibold text-gold-light">🔥 Agni</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
