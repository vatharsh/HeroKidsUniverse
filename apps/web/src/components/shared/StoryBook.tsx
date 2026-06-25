"use client";

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
    <div className="relative w-full h-full rounded-lg shadow-[2px_4px_24px_rgba(0,0,0,0.5)]">
      <div className="absolute inset-[5px] overflow-hidden rounded-md bg-black">
        {/* Blurred fill — covers any letterbox gaps for panels with different aspect ratios */}
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
          sizes="370px"
          priority={priority}
          className="object-contain z-10"
        />
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
    <div className="relative select-none" style={{ width: 370, height: 492 }}>
      {/* Panel viewport — overflow-hidden clips the 3D flip so panels never bleed into each other */}
      <div className="absolute inset-0 overflow-hidden rounded-lg">
        {/* Exiting page — absolute overlay animating out */}
        {exitIdx !== null && (
          <div
            className={`absolute inset-0 z-10 ${animDir === "fwd" ? "book-exit-fwd" : "book-exit-back"}`}
          >
            <PageView idx={exitIdx} />
          </div>
        )}

        {/* Entering / current page */}
        <div
          className={`w-full h-full ${animDir ? (animDir === "fwd" ? "book-enter-fwd" : "book-enter-back") : ""}`}
        >
          <PageView idx={page} priority={page === 0} />
        </div>
      </div>

      {/* Prev arrow — outside the clip container so it's always visible */}
      <button
        type="button"
        aria-label="Previous panel"
        onClick={() => { resetAuto(); flipPrev(); }}
        className="absolute -left-11 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center text-white/50 hover:text-white text-4xl leading-none transition"
      >
        ‹
      </button>

      {/* Next arrow */}
      <button
        type="button"
        aria-label="Next panel"
        onClick={() => { resetAuto(); flipNext(); }}
        className="absolute -right-11 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center text-white/50 hover:text-white text-4xl leading-none transition"
      >
        ›
      </button>

      {/* Page indicator dots */}
      <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 flex gap-1.5 items-center">
        {PANELS.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Go to panel ${i + 1}`}
            onClick={() => {
              resetAuto();
              doFlip(i, i > pageRef.current ? "fwd" : "back");
            }}
            className={`rounded-full transition-all duration-200 ${
              i === page
                ? "w-4 h-2 bg-gold"
                : "w-2 h-2 bg-white/30 hover:bg-white/60"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
