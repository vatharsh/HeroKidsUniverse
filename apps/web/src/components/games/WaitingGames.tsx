"use client";

import { useEffect, useState } from "react";

import { getAccessToken } from "@/lib/api";
import MemoryMatch, { type MemoryFace } from "./MemoryMatch";
import PotionMixer from "./PotionMixer";
import TicTacToe from "./TicTacToe";
import UniverseQuiz, { type QuizQuestion } from "./UniverseQuiz";

/**
 * Mini-games for the child while a story is being made (all on the device — no ads, no links out,
 * nothing saved). Memory cards and quiz questions come from the child's own universe; one-off
 * stories and brand-new accounts use Arjun's sample universe instead.
 */

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

interface UniverseData {
  id: string;
  villains?: Array<{ name: string; thumbnailUrl?: string | null }>;
  powers?: Array<{ name: string; kind?: string; emoji?: string | null; thumbnailUrl?: string | null }>;
  memories?: Array<{ type: string; title: string }>;
}
interface CastMember { name: string; avatarUrl?: string | null }

const SAMPLE_FACES: MemoryFace[] = [1, 2, 3, 4, 5, 7].map((n) => ({ key: `arjun-${n}`, label: "Arjun's adventure", image: `/story-panels/page_${n}.png` }));
const EMOJI_FACES: MemoryFace[] = ["⚡", "🛡️", "🐉", "🚀", "🔮", "🌟"].map((e) => ({ key: `emoji-${e}`, label: e, emoji: e }));

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

const SAMPLE_QUIZ: QuizQuestion[] = [
  { q: "In the sample universe, which power did Arjun earn?", answer: "Zero-G Speed", options: ["Ice Breath", "Zero-G Speed", "Rubber Arms"] },
  { q: "Who stole the Galaxy's starlight?", answer: "The Shadow Swirl", options: ["Captain Grumble", "Professor Fog", "The Shadow Swirl"] },
  { q: "What is the name of Arjun's robot friend?", answer: "Nova", options: ["Nova", "Bobo", "Zippy"] },
  { q: "Which world did Arjun discover?", answer: "Glimma Meadows", options: ["Candy Volcano", "Glimma Meadows", "Cloud Castle"] },
  { q: "Which legendary item did Arjun find?", answer: "Starlight Crystal", options: ["Starlight Crystal", "Golden Umbrella", "Rocket Skates"] },
];

const TABS = [
  { id: "ttt", label: "⭕ X-O" },
  { id: "memory", label: "🧠 Memory" },
  { id: "potion", label: "🧪 Potion" },
  { id: "quiz", label: "❓ Quiz" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export default function WaitingGames({ heroName, heroAvatar, universeId, onPlay }: {
  heroName: string; heroAvatar: string | null; universeId: string | null; onPlay?: () => void;
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
  const faces = personal.length >= 3 ? [...personal, ...EMOJI_FACES].slice(0, 6) : SAMPLE_FACES;

  const personalQuiz = buildQuiz(heroName, universe, cast);
  const quiz = personalQuiz.length >= 3 ? personalQuiz : SAMPLE_QUIZ;
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
        <MemoryMatch key={faces.map((f) => f.key).join()} faces={faces} />
      ) : tab === "potion" ? (
        <PotionMixer />
      ) : (
        <UniverseQuiz key={quiz.map((q) => q.q).join()} questions={quiz} />
      )}
    </div>
  );
}
