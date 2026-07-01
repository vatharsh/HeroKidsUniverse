"use client";

import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

import cover from "../../../../../Arjun_Story_9_Images_No_Border/cover.png";
import p1 from "../../../../../Arjun_Story_9_Images_No_Border/page_1.png";
import p2 from "../../../../../Arjun_Story_9_Images_No_Border/page_2.png";
import p3 from "../../../../../Arjun_Story_9_Images_No_Border/page_3.png";
import p4 from "../../../../../Arjun_Story_9_Images_No_Border/page_4.png";
import p5 from "../../../../../Arjun_Story_9_Images_No_Border/page_5.png";
import p6 from "../../../../../Arjun_Story_9_Images_No_Border/page_6.png";
import p7 from "../../../../../Arjun_Story_9_Images_No_Border/page_7.png";
import p8 from "../../../../../Arjun_Story_9_Images_No_Border/page_8.png";

const PANELS = [
  { src: cover, alt: "Cover — Arjun and the Starlight Mission" },
  { src: p1, alt: "Arjun loved looking at the stars from his room. One night, something magical happened." },
  { src: p2, alt: "A star from the Starlight Cluster has lost its shine. Without it, the Galaxy will be sad and dark." },
  { src: p3, alt: "They zoomed past sparkling asteroids and twinkling planets. It was an exciting journey!" },
  { src: p4, alt: "They landed on Glimmeria, a colorful planet. The cute Glimmas were worried." },
  { src: p5, alt: "Arjun and Nova followed the trail and found the Shadow Swirl — a cloud that loved darkness." },
  { src: p6, alt: "Arjun didn't give up. Even darkness is beautiful, but light brings hope." },
  { src: p7, alt: "The star sparkled again! Glimmeria shined bright. Arjun and Nova returned home." },
  { src: p8, alt: "Arjun looked at the stars and smiled. He knew many more adventures were waiting. ★ THE END ★" },
];

function PageView({ idx, priority = false }: { idx: number; priority?: boolean }) {
  const panel = PANELS[idx];
  return (
    <div className="relative w-full h-full rounded-[1.15rem] bg-[#080414] shadow-[0_18px_50px_rgba(0,0,0,0.42)]">
      <div className="absolute inset-[6px] overflow-hidden rounded-[0.9rem] bg-black">
        {/* Blurred fill keeps mixed panel ratios feeling intentional without cropping the artwork. */}
        <div
          className="absolute inset-0 scale-110"
          style={{
            backgroundImage: `url(${panel.src.src})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "blur(14px) brightness(0.4)",
          }}
        />
        {/* Actual image — always fully visible, no cropping */}
        <Image
          src={panel.src}
          alt={panel.alt}
          fill
          sizes="(max-width: 640px) 82vw, 420px"
          priority={priority}
          className="object-contain z-10"
        />
        <div className="absolute inset-0 z-20 pointer-events-none storybook-page-shine" />
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
  const autoTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  pageRef.current = page;

  const doFlip = useCallback((next: number, dir: "fwd" | "back") => {
    if (flipLock.current || next === pageRef.current) return;
    flipLock.current = true;
    setExitIdx(pageRef.current);
    setAnimDir(dir);
    setPage(next);
    setTimeout(() => {
      setExitIdx(null);
      setAnimDir(null);
      flipLock.current = false;
    }, 400);
  }, []);

  const flipNext = useCallback(() => {
    doFlip((pageRef.current + 1) % PANELS.length, "fwd");
  }, [doFlip]);

  const flipPrev = useCallback(() => {
    doFlip((pageRef.current - 1 + PANELS.length) % PANELS.length, "back");
  }, [doFlip]);

  const resetAuto = useCallback(() => {
    clearInterval(autoTimer.current);
    autoTimer.current = setInterval(flipNext, 3800);
  }, [flipNext]);

  useEffect(() => {
    autoTimer.current = setInterval(flipNext, 3800);
    return () => clearInterval(autoTimer.current);
  }, [flipNext]);

  return (
    <div className="relative w-full max-w-[430px] select-none storybook-stage">
      <div className="relative rounded-[1.75rem] border border-white/15 bg-white/[0.07] p-3.5 shadow-[0_28px_80px_rgba(0,0,0,0.45)] backdrop-blur-md">
        <div className="relative rounded-[1.35rem] border border-gold/25 bg-[linear-gradient(145deg,rgba(253,230,138,0.16),rgba(124,58,237,0.18)_42%,rgba(11,5,32,0.94))] p-3 overflow-hidden">
          <div className="absolute left-0 top-5 bottom-5 w-3 rounded-r-full bg-gradient-to-b from-gold/70 via-white/20 to-brand-light/40 shadow-[0_0_24px_rgba(245,158,11,0.32)]" />
          <div className="absolute -right-10 top-12 h-px w-40 rotate-[-18deg] bg-gradient-to-r from-transparent via-gold/30 to-transparent pointer-events-none" />
          <div className="absolute -left-8 bottom-28 h-px w-36 rotate-[22deg] bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />

          <div className="relative z-10 flex items-center justify-between gap-3 pb-3 pl-3">
            <div className="min-w-0">
              <div className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-gold/35 bg-gold/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-gold-light shadow-[0_0_22px_rgba(245,158,11,0.14)]">
                <Sparkles className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">Real Story</span>
              </div>
              <p className="mt-2 truncate font-[family-name:var(--font-display)] text-xl leading-none text-white sm:text-2xl">
                Arjun's Universe
              </p>
            </div>
            <div className="hidden rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-right sm:block">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Episode</p>
              <p className="font-[family-name:var(--font-display)] text-2xl leading-none text-gold">{page + 1}</p>
            </div>
          </div>

          <div className="relative z-10">
            <div className="relative mx-auto aspect-[3/4] w-full overflow-hidden rounded-[1.2rem] border border-white/10 bg-space shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
              {exitIdx !== null && (
                <div
                  className={`absolute inset-0 z-10 ${animDir === "fwd" ? "book-exit-fwd" : "book-exit-back"}`}
                >
                  <PageView idx={exitIdx} />
                </div>
              )}

              <div
                className={`w-full h-full ${animDir ? (animDir === "fwd" ? "book-enter-fwd" : "book-enter-back") : ""}`}
              >
                <PageView idx={page} priority={page === 0} />
              </div>
            </div>

            <button
              type="button"
              aria-label="Previous panel"
              onClick={() => { resetAuto(); flipPrev(); }}
              className="absolute left-2 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/35 text-white/70 shadow-lg backdrop-blur-md transition hover:bg-white/15 hover:text-white sm:-left-5"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            <button
              type="button"
              aria-label="Next panel"
              onClick={() => { resetAuto(); flipNext(); }}
              className="absolute right-2 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/35 text-white/70 shadow-lg backdrop-blur-md transition hover:bg-white/15 hover:text-white sm:-right-5"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          <div className="relative z-10 mt-4 flex flex-col gap-3 px-1 pb-1">
            <div className="flex justify-center gap-1.5">
              {PANELS.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Go to panel ${i + 1}`}
                  onClick={() => {
                    resetAuto();
                    doFlip(i, i > pageRef.current ? "fwd" : "back");
                  }}
                  className={`h-2 rounded-full transition-all duration-200 ${
                    i === page
                      ? "w-7 bg-gold shadow-[0_0_14px_rgba(245,158,11,0.55)]"
                      : "w-2 bg-white/30 hover:bg-white/60"
                  }`}
                />
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/35">9 Episodes</p>
                <p className="truncate text-xs font-semibold text-white/70">and counting</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/35">Powers</p>
                <p className="truncate text-xs font-semibold text-gold-light">Cosmic Flame</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
