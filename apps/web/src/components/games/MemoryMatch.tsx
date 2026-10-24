"use client";

import { useState } from "react";

import PreviewImg from "@/components/shared/PreviewImg";

export interface MemoryFace { key: string; label: string; image?: string | null; emoji?: string }

interface Card { id: number; face: MemoryFace }

function deal(faces: MemoryFace[]): Card[] {
  const cards = faces.flatMap((f, i) => [{ id: i * 2, face: f }, { id: i * 2 + 1, face: f }]);
  for (let i = cards.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [cards[i], cards[j]] = [cards[j], cards[i]]; }
  return cards;
}

/** Flip two cards, find the pairs — faces are the child's own villains, powers, gear and cast. */
export default function MemoryMatch({ faces, title = "Find the matching pairs" }: { faces: MemoryFace[]; title?: string }) {
  const [cards, setCards] = useState<Card[]>(() => deal(faces));
  const [open, setOpen] = useState<number[]>([]);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [moves, setMoves] = useState(0);
  const done = matched.size === faces.length;

  function flip(card: Card) {
    if (open.length === 2 || open.includes(card.id) || matched.has(card.face.key)) return;
    const next = [...open, card.id];
    setOpen(next);
    if (next.length === 2) {
      setMoves((m) => m + 1);
      const [a, b] = next.map((id) => cards.find((c) => c.id === id)!);
      if (a.face.key === b.face.key) {
        setMatched((m) => new Set(m).add(a.face.key));
        setOpen([]);
      } else {
        setTimeout(() => setOpen([]), 900);
      }
    }
  }

  function restart() { setCards(deal(faces)); setOpen([]); setMatched(new Set()); setMoves(0); }

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-white/70 text-sm">{title} · {moves} moves</p>
      <div className="grid grid-cols-4 gap-2 w-full max-w-xs">
        {cards.map((card) => {
          const shown = open.includes(card.id) || matched.has(card.face.key);
          return (
            <button key={card.id} type="button" onClick={() => flip(card)} aria-label={shown ? card.face.label : "Hidden card"}
              className={`aspect-square rounded-xl border transition-all duration-300 overflow-hidden flex items-center justify-center ${
                shown ? "bg-white border-gold/60" : "bg-gradient-to-br from-brand to-brand-dark border-white/20 hover:scale-105"
              } ${matched.has(card.face.key) ? "ring-2 ring-emerald-400" : ""}`}>
              {shown
                ? card.face.image
                  ? <PreviewImg src={card.face.image} alt={card.face.label} className="w-full h-full object-cover" />
                  : <span className="text-3xl">{card.face.emoji ?? "⭐"}</span>
                : <span className="text-white/70 text-xl">✦</span>}
            </button>
          );
        })}
      </div>
      <div className="h-10 flex items-center">
        {done ? (
          <div className="flex items-center gap-3">
            <span className="text-gold font-bold">🎉 All pairs found in {moves} moves!</span>
            <button type="button" onClick={restart} className="bg-brand hover:bg-brand-dark text-white text-sm font-bold px-4 py-2 rounded-full">Play again</button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
