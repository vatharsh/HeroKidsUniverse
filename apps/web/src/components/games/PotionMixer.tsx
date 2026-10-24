"use client";

import { useState } from "react";

const INGREDIENTS = [
  { emoji: "🐉", name: "Dragon scale" }, { emoji: "✨", name: "Star dust" }, { emoji: "🍯", name: "Rainbow honey" },
  { emoji: "🍄", name: "Giggle mushroom" }, { emoji: "🌙", name: "Moon drop" }, { emoji: "🪶", name: "Phoenix feather" },
  { emoji: "🧊", name: "Frost crystal" }, { emoji: "🌶️", name: "Fire pepper" }, { emoji: "🌸", name: "Whisper petal" },
];

const POTIONS = [
  { name: "Giggle Potion", effect: "Everyone who smells it laughs for one whole minute!", color: "from-pink-400 to-yellow-300" },
  { name: "Bounce Potion", effect: "Your shoes turn into springs — boing, boing!", color: "from-lime-400 to-emerald-500" },
  { name: "Whisper-to-Animals Potion", effect: "Cats, dogs and parrots can understand you for a day.", color: "from-teal-400 to-cyan-500" },
  { name: "Tiny Potion", effect: "You shrink to the size of an ant and ride a ladybird.", color: "from-red-400 to-orange-400" },
  { name: "Glow Potion", effect: "You glow like a night light — great for midnight adventures.", color: "from-yellow-300 to-amber-500" },
  { name: "Cloud-Walk Potion", effect: "You can walk on clouds until bedtime.", color: "from-sky-300 to-indigo-400" },
  { name: "Brave Heart Potion", effect: "You feel brave enough to face any villain!", color: "from-rose-500 to-purple-600" },
  { name: "Bubble Potion", effect: "Every word you say comes out as a soap bubble.", color: "from-blue-300 to-fuchsia-400" },
  { name: "Rainbow Hair Potion", effect: "Your hair changes colour every time you sneeze.", color: "from-fuchsia-400 to-amber-300" },
  { name: "Super-Snack Potion", effect: "Your lunchbox fills itself with your favourite food.", color: "from-orange-300 to-rose-400" },
  { name: "Echo Potion", effect: "Everything you say is repeated by a friendly echo… echo… echo.", color: "from-violet-400 to-slate-400" },
  { name: "Dragon-Friend Potion", effect: "A baby dragon follows you around like a puppy.", color: "from-emerald-500 to-red-400" },
];

/** Pick three magic ingredients and see what potion bubbles up. */
export default function PotionMixer() {
  const [picked, setPicked] = useState<number[]>([]);
  const [brewing, setBrewing] = useState(false);
  const [result, setResult] = useState<(typeof POTIONS)[number] | null>(null);

  function toggle(i: number) {
    if (brewing || result) return;
    setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : p.length < 3 ? [...p, i] : p));
  }

  function brew() {
    setBrewing(true);
    const seed = [...picked].sort().reduce((acc, i) => acc * 31 + i + 7, 17);
    setTimeout(() => { setResult(POTIONS[seed % POTIONS.length]); setBrewing(false); }, 1400);
  }

  function reset() { setPicked([]); setResult(null); }

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-white/70 text-sm">Pick 3 magic ingredients for your cauldron</p>
      <div className="grid grid-cols-3 gap-2 w-full max-w-xs">
        {INGREDIENTS.map((ing, i) => {
          const on = picked.includes(i);
          return (
            <button key={ing.name} type="button" onClick={() => toggle(i)}
              className={`rounded-xl border px-2 py-2.5 flex flex-col items-center gap-1 transition ${on ? "bg-gold/25 border-gold text-white scale-105" : "bg-white/8 border-white/15 text-white/80 hover:bg-white/15"}`}>
              <span className="text-2xl">{ing.emoji}</span>
              <span className="text-[10px] font-semibold leading-tight text-center">{ing.name}</span>
            </button>
          );
        })}
      </div>
      <div className={`w-28 h-28 rounded-b-[3rem] rounded-t-xl border-4 border-white/30 flex items-center justify-center text-4xl relative overflow-hidden transition-all ${
        result ? `bg-gradient-to-b ${result.color}` : "bg-slate-800"} ${brewing ? "animate-pulse" : ""}`}>
        {brewing ? "🫧" : result ? "🧪" : picked.map((i) => INGREDIENTS[i].emoji).join("") || "🫕"}
      </div>
      {result ? (
        <div className="text-center animate-[fadeInUp_0.5s_ease-out_both]">
          <p className="font-[family-name:var(--font-display)] text-gold text-xl">{result.name}!</p>
          <p className="text-white/80 text-sm mt-1 max-w-xs">{result.effect}</p>
          <button type="button" onClick={reset} className="mt-3 bg-brand hover:bg-brand-dark text-white text-sm font-bold px-4 py-2 rounded-full">Brew another</button>
        </div>
      ) : (
        <button type="button" onClick={brew} disabled={picked.length < 3 || brewing}
          className="bg-brand hover:bg-brand-dark disabled:opacity-40 text-white text-sm font-bold px-6 py-2.5 rounded-full transition">
          {brewing ? "Bubbling…" : picked.length < 3 ? `Pick ${3 - picked.length} more` : "Mix the potion! 🪄"}
        </button>
      )}
    </div>
  );
}
