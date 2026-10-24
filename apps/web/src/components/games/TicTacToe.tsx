"use client";

import { useState } from "react";

import PreviewImg from "@/components/shared/PreviewImg";

type Cell = "hero" | "bot" | null;
const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

function winner(b: Cell[]): Cell | "draw" {
  for (const [a, c, d] of LINES) if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a];
  return b.every(Boolean) ? "draw" : null;
}

/** The companion plays fair but not perfectly, so children win often. */
function botMove(b: Cell[]): number {
  const free = b.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
  const tryFor = (who: Cell) => free.find((i) => { const t = [...b]; t[i] = who; return winner(t) === who; });
  if (Math.random() < 0.25) return free[Math.floor(Math.random() * free.length)];
  return tryFor("bot") ?? tryFor("hero") ?? (b[4] ? undefined : 4) ?? free[Math.floor(Math.random() * free.length)];
}

export default function TicTacToe({ heroName, heroAvatar, botName }: { heroName: string; heroAvatar: string | null; botName: string }) {
  const [board, setBoard] = useState<Cell[]>(Array(9).fill(null));
  const [score, setScore] = useState({ hero: 0, bot: 0 });
  const result = winner(board);

  function play(i: number) {
    if (board[i] || result) return;
    const next = [...board]; next[i] = "hero";
    let w = winner(next);
    if (!w) { next[botMove(next)] = "bot"; w = winner(next); }
    setBoard(next);
    if (w === "hero" || w === "bot") setScore((s) => ({ ...s, [w]: s[w] + 1 }));
  }

  const piece = (c: Cell) => c === "hero"
    ? (heroAvatar ? <PreviewImg src={heroAvatar} alt={heroName} className="w-full h-full object-cover rounded-xl" /> : <span>⭐</span>)
    : c === "bot" ? <span>🤖</span> : null;

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-white/70 text-sm text-center">
        <strong className="text-white">{heroName}</strong> vs <strong className="text-white">{botName}</strong> · {score.hero} – {score.bot}
      </p>
      <div className="grid grid-cols-3 grid-rows-3 gap-2 w-64 h-64">
        {board.map((c, i) => (
          <button key={i} type="button" onClick={() => play(i)} aria-label={`Square ${i + 1}`}
            className="min-h-0 min-w-0 rounded-2xl bg-white/10 border border-white/15 hover:bg-white/20 transition flex items-center justify-center text-4xl p-1.5 overflow-hidden">
            {piece(c)}
          </button>
        ))}
      </div>
      <div className="h-10 flex items-center">
        {result ? (
          <div className="flex items-center gap-3">
            <span className="text-gold font-bold">
              {result === "hero" ? `🎉 ${heroName} wins!` : result === "bot" ? `${botName} wins this time!` : "It's a draw!"}
            </span>
            <button type="button" onClick={() => setBoard(Array(9).fill(null))}
              className="bg-brand hover:bg-brand-dark text-white text-sm font-bold px-4 py-2 rounded-full">Play again</button>
          </div>
        ) : (
          <span className="text-white/50 text-xs">Tap a square — you go first!</span>
        )}
      </div>
    </div>
  );
}
