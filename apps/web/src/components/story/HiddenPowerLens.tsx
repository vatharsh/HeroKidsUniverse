"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { specialPowersApi, type ClaimResult, type StoryPowerSpot } from "@/lib/special-powers";

/**
 * Today's hidden special power on the story reader. A 🔮 magic lens button toggles lens mode; dragging
 * the lens over the right page reveals a shimmer, and tapping it grabs the power. Sits as a layer inside
 * the page box (which must be position: relative). Renders nothing when no power is hiding today.
 */
export default function HiddenPowerLens({ storyId, page }: { storyId: string; page: number }) {
  const [spot, setSpot] = useState<StoryPowerSpot | null>(null);
  const [lens, setLens] = useState(false);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [result, setResult] = useState<ClaimResult | null>(null);
  const [error, setError] = useState("");
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    specialPowersApi.forStory(storyId).then(setSpot).catch(() => setSpot({ active: false }));
  }, [storyId]);

  if (!spot || !spot.active) return null;

  const onThisPage = page === spot.pageIndex;
  const dist = pointer ? Math.hypot(pointer.x - spot.x, pointer.y - spot.y) : 999;
  const revealed = lens && onThisPage && dist < 14;
  const warm = lens && onThisPage && dist < 32;

  function move(e: React.PointerEvent) {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    setPointer({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
  }

  async function grab() {
    if (!spot?.active || claiming) return;
    setClaiming(true); setError("");
    try {
      const r = await specialPowersApi.claim(storyId, spot.drop.id);
      setResult(r);
      setSpot({ ...spot, found: true, count: r.count, level: r.level, next: r.next, toNext: r.toNext });
      setLens(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The power slipped away — try again!");
    } finally {
      setClaiming(false);
    }
  }

  return (
    <>
      {/* Lens layer: only catches the pointer while the lens is on, so page taps work normally otherwise. */}
      {lens && !spot.found && (
        <div ref={box} onPointerMove={move} onPointerDown={move}
          className="absolute inset-0 z-30 cursor-none touch-none"
          onClick={() => { if (revealed) void grab(); }}>
          {onThisPage && (
            <span aria-hidden
              className="absolute -translate-x-1/2 -translate-y-1/2 transition-opacity duration-300 select-none"
              style={{ left: `${spot.x}%`, top: `${spot.y}%`, opacity: revealed ? 1 : warm ? 0.35 : 0.06, fontSize: revealed ? 56 : 34 }}>
              <span className={revealed ? "animate-bounce inline-block drop-shadow-[0_0_18px_rgba(251,191,36,0.95)]" : "animate-pulse inline-block"}>
                {revealed ? spot.drop.emoji : "✨"}
              </span>
            </span>
          )}
          {pointer && (
            <span aria-hidden className="absolute pointer-events-none -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-gold/90 shadow-[0_0_30px_rgba(251,191,36,0.6)] bg-white/10 backdrop-brightness-125"
              style={{ left: `${pointer.x}%`, top: `${pointer.y}%`, width: 110, height: 110 }} />
          )}
          <div className="absolute top-12 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur text-white text-xs font-semibold px-3 py-1.5 rounded-full pointer-events-none whitespace-nowrap">
            {revealed ? `Tap to grab the ${spot.drop.name}! ${spot.drop.emoji}` : warm ? "Ooh, it's very close… ✨" : onThisPage ? "Something sparkles on this page… move the lens around" : "Not on this page — try another one 🔮"}
          </div>
        </div>
      )}

      {/* Lens button */}
      {!spot.found ? (
        <button type="button" onClick={() => { setLens(!lens); setPointer(null); }}
          className={`absolute bottom-3 left-3 z-40 flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold shadow-lg transition ${lens ? "bg-gold text-space" : "bg-space/80 text-gold backdrop-blur hover:bg-space"}`}>
          <span className={lens ? "" : "animate-pulse"}>🔮</span>
          {lens ? "Put lens away" : "A special power is hiding! Use the magic lens"}
        </button>
      ) : (
        <div className="absolute bottom-3 left-3 z-40 rounded-full bg-space/80 backdrop-blur px-3 py-1.5 text-[11px] font-semibold text-gold">
          {spot.drop.emoji} {spot.drop.name} found{spot.level ? ` · ${spot.level.badge} ${spot.level.name}` : ""}
        </div>
      )}
      {error && <div className="absolute bottom-14 left-3 z-40 rounded-full bg-red-600 text-white text-xs px-3 py-1.5">{error}</div>}

      {result && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4" onClick={() => setResult(null)}>
          <div className="w-full max-w-sm rounded-3xl bg-gradient-to-b from-space to-brand text-white text-center p-7 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-6xl animate-bounce">{result.power.emoji}</p>
            <h3 className="font-[family-name:var(--font-display)] text-3xl mt-2">{result.heroName} found the {result.power.name}!</h3>
            <p className="text-white/80 text-sm mt-2">{result.power.description}</p>
            {result.addedToUniverse && <p className="text-gold text-xs mt-3 font-semibold">✨ It&apos;s now in {result.heroName}&apos;s universe — watch for it in the next episode!</p>}
            {result.newLevel && (
              <div className="mt-4 rounded-2xl bg-white/10 p-3">
                <p className="text-3xl">{result.newLevel.badge}</p>
                <p className="font-bold">{result.heroName} is now a {result.newLevel.name}!</p>
                {result.reward && <p className="text-gold text-xs mt-1">{result.reward}</p>}
              </div>
            )}
            <p className="text-white/70 text-xs mt-4">
              {result.count} special power{result.count === 1 ? "" : "s"} found
              {result.next ? ` · ${result.toNext} more for ${result.next.badge} ${result.next.name}` : " · top level reached!"}
            </p>
            <button type="button" onClick={() => setResult(null)} className="mt-5 bg-gold text-space font-bold px-6 py-2.5 rounded-full text-sm">Yay!</button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
