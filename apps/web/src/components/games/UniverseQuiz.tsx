"use client";

import { useState } from "react";

export interface QuizQuestion { q: string; options: string[]; answer: string }

/** A short quiz about the child's own universe — their powers, villains, gear and friends. */
export default function UniverseQuiz({ questions }: { questions: QuizQuestion[] }) {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const finished = index >= questions.length;
  const current = questions[index];

  function choose(option: string) {
    if (picked) return;
    setPicked(option);
    if (option === current.answer) setScore((s) => s + 1);
    setTimeout(() => { setPicked(null); setIndex((i) => i + 1); }, 1200);
  }

  if (finished) {
    return (
      <div className="flex flex-col items-center gap-3 text-center py-6">
        <span className="text-5xl">{score === questions.length ? "🏆" : score >= questions.length / 2 ? "🌟" : "💪"}</span>
        <p className="font-[family-name:var(--font-display)] text-white text-2xl">{score} / {questions.length} correct!</p>
        <p className="text-white/60 text-sm">{score === questions.length ? "You know your universe perfectly!" : "Great try — your universe has so many secrets!"}</p>
        <button type="button" onClick={() => { setIndex(0); setScore(0); }} className="bg-brand hover:bg-brand-dark text-white text-sm font-bold px-4 py-2 rounded-full">Play again</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-white/50 text-xs text-center">Question {index + 1} of {questions.length} · Score {score}</p>
      <p className="font-[family-name:var(--font-display)] text-white text-xl text-center leading-snug min-h-[3.5rem]">{current.q}</p>
      <div className="flex flex-col gap-2">
        {current.options.map((o) => {
          const state = picked ? (o === current.answer ? "right" : o === picked ? "wrong" : "idle") : "idle";
          return (
            <button key={o} type="button" onClick={() => choose(o)}
              className={`rounded-2xl border px-4 py-3 text-sm font-semibold text-left transition ${
                state === "right" ? "bg-emerald-500/30 border-emerald-400 text-white"
                  : state === "wrong" ? "bg-red-500/30 border-red-400 text-white"
                  : "bg-white/8 border-white/15 text-white/85 hover:bg-white/15"}`}>
              {state === "right" ? "✅ " : state === "wrong" ? "❌ " : ""}{o}
            </button>
          );
        })}
      </div>
    </div>
  );
}
