"use client";

import { useEffect, useMemo, useState } from "react";

import { getAccessToken } from "@/lib/api";
import MemoryMatch, { type MemoryFace } from "./MemoryMatch";
import PotionMixer from "./PotionMixer";
import TicTacToe from "./TicTacToe";
import { themePack } from "./theme-packs";
import UniverseQuiz, { type QuizQuestion } from "./UniverseQuiz";

/**
 * Mini-games for the child while a story is being made (all on the device — no ads, no links out,
 * nothing saved). Memory cards and quiz questions come from the child's own universe; one-off
 * stories and brand-new accounts get cards and a quiz matching the story's theme instead.
 */

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

interface UniverseData {
  id: string;
  villains?: Array<{ name: string; thumbnailUrl?: string | null }>;
  powers?: Array<{ name: string; kind?: string; emoji?: string | null; thumbnailUrl?: string | null }>;
  memories?: Array<{ type: string; title: string }>;
}
interface CastMember { name: string; avatarUrl?: string | null }

const DECOYS = {
  power: ["Ice Breath", "Invisible Shoes", "Thunder Clap", "Rubber Arms", "Laser Sneeze"],
  villain: ["Captain Grumble", "The Sock Thief", "Professor Fog", "Queen Sneeze"],
  gear: ["Golden Umbrella", "Talking Backpack", "Rocket Skates", "Jelly Shield"],
  friend: ["Bobo the Bear", "Zara the Zebra", "Mr. Pickles", "Tiny Tornado"],
  world: ["Candy Volcano", "Underwater Library", "Upside-Down Forest", "Cloud Castle"],
};

const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
const shuffle = <T,>(xs: T[]) => [...xs].sort(() => Math.random() - 0.5);

function question(q: string, answers: string[], decoys: string[]): QuizQuestion | null {
  if (!answers.length) return null;
  const answer = pick(answers);
  const wrong = shuffle(decoys.filter((d) => !answers.includes(d))).slice(0, 2);
  return { q, answer, options: shuffle([answer, ...wrong]) };
}

function buildQuiz(hero: string, u: UniverseData | null, cast: CastMember[]): QuizQuestion[] {
  const powers = (u?.powers ?? []).filter((p) => p.kind !== "artifact").map((p) => p.name);
  const gear = (u?.powers ?? []).filter((p) => p.kind === "artifact").map((p) => p.name);
  const villains = (u?.villains ?? []).map((v) => v.name);
  const worlds = (u?.memories ?? []).filter((m) => m.type === "location_discovered").map((m) => m.title);
  const friends = cast.map((c) => c.name).filter((n) => n && n !== hero);
  return [
    question(`Which of these is a power ${hero} has earned?`, powers, DECOYS.power),
    question(`Who has tried to stop ${hero}?`, villains, DECOYS.villain),
    question(`Which of these does ${hero} carry on adventures?`, gear, DECOYS.gear),
    question(`Who is on ${hero}'s team?`, friends, DECOYS.friend),
    question(`Which world has ${hero} discovered?`, worlds, DECOYS.world),
  ].filter((x): x is QuizQuestion => !!x);
}

const TABS = [
  { id: "ttt", label: "⭕ X-O" },
  { id: "memory", label: "🧠 Memory" },
  { id: "potion", label: "🧪 Potion" },
  { id: "quiz", label: "❓ Quiz" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export default function WaitingGames({ heroName, heroAvatar, universeId, theme, onPlay }: {
  heroName: string; heroAvatar: string | null; universeId: string | null; theme?: string | null; onPlay?: () => void;
}) {
  const [tab, setTab] = useState<TabId>("ttt");
  const [universe, setUniverse] = useState<UniverseData | null>(null);
  const [cast, setCast] = useState<CastMember[]>([]);
  const [loaded, setLoaded] = useState(!universeId); // one-off stories use the sample universe straight away

  useEffect(() => {
    if (!universeId) return;
    const token = getAccessToken();
    if (!token) { void Promise.resolve().then(() => setLoaded(true)); return; }
    const h = { Authorization: `Bearer ${token}` };
    Promise.all([
      fetch(`${BASE}/universes/mine`, { headers: h }).then((r) => (r.ok ? r.json() : null)),
      fetch(`${BASE}/characters`, { headers: h }).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([u, c]) => {
        const list = (u?.data ?? []) as UniverseData[];
        setUniverse(list.find((x) => x.id === universeId) ?? null);
        setCast(((c?.data ?? []) as CastMember[]).filter((x) => x?.name));
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [universeId]);

  // Memory faces: hero, cast, villains, powers & gear (pictures we already have), topped up with emoji.
  const personal: MemoryFace[] = [];
  const seen = new Set<string>();
  const add = (key: string, label: string, image?: string | null) => {
    if (!image || seen.has(image) || personal.length >= 6) return;
    seen.add(image); personal.push({ key, label, image });
  };
  add("hero", heroName, heroAvatar);
  cast.forEach((c, i) => add(`cast-${i}`, c.name, c.avatarUrl));
  universe?.villains?.forEach((v, i) => add(`villain-${i}`, v.name, v.thumbnailUrl));
  universe?.powers?.forEach((p, i) => add(`power-${i}`, p.name, p.thumbnailUrl));
  // Not enough of their own pictures yet (first story, one-off): themed cards for this story, plus the hero.
  const pack = themePack(theme);
  const themeFaces: MemoryFace[] = pack.emojis.map((e) => ({ key: `theme-${e}`, label: e, emoji: e }));
  const usePersonal = personal.length >= 3;
  const faces = usePersonal ? [...personal, ...themeFaces].slice(0, 6) : [...personal.slice(0, 1), ...themeFaces].slice(0, 6);

  // 5 questions for everyone: up to 3 about their own universe (whatever exists so far) and the rest
  // about this story's theme. Built once per data change, so answers don't reshuffle mid-question.
  const quiz = useMemo(() => {
    const personal = shuffle(buildQuiz(heroName, universe, cast)).slice(0, 3);
    const generic = shuffle(themePack(theme).quiz).slice(0, 5 - personal.length)
      .map((x) => ({ ...x, options: shuffle(x.options) }));
    const mixed: QuizQuestion[] = [];
    while (generic.length || personal.length) {
      if (generic.length) mixed.push(generic.shift()!);
      if (personal.length) mixed.push(personal.shift()!);
    }
    return mixed;
  }, [heroName, universe, cast, theme]);
  const companion = "Nova";

  return (
    <div className="w-full rounded-3xl border border-white/15 bg-white/5 p-4 sm:p-5" onPointerDown={onPlay}>
      <p className="text-center text-white font-[family-name:var(--font-display)] text-xl mb-1">🎮 Play while you wait</p>
      <p className="text-center text-white/45 text-xs mb-4">Just for fun — nothing is saved.</p>
      <div className="grid grid-cols-4 gap-1.5 mb-5">
        {TABS.map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)}
            className={`text-[11px] sm:text-xs font-bold rounded-full px-2 py-2 transition ${tab === t.id ? "bg-gold text-black" : "bg-white/10 text-white/75 hover:bg-white/20"}`}>
            {t.label}
          </button>
        ))}
      </div>
      {!loaded && (tab === "memory" || tab === "quiz") ? (
        <p className="text-center text-white/50 text-sm py-10">Loading your universe…</p>
      ) : tab === "ttt" ? (
        <TicTacToe heroName={heroName} heroAvatar={heroAvatar} botName={companion} />
      ) : tab === "memory" ? (
        <MemoryMatch key={faces.map((f) => f.key).join()} faces={faces} title={usePersonal ? "Find the pairs from your universe" : "Find the matching pairs"} />
      ) : tab === "potion" ? (
        <PotionMixer />
      ) : (
        <UniverseQuiz key={quiz.map((q) => q.q).join()} questions={quiz} />
      )}
    </div>
  );
}
