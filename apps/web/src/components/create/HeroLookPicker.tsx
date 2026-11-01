"use client";

import { cn } from "@/lib/utils";

/**
 * "Hero's look" on the story-details step: keep the usual outfit, keep this universe's look, or give the
 * hero a new look for this story. Inside a universe a new look carries on to the next episodes.
 */
export type LookChoice = "usual" | "universe" | "new";

const NEW_LOOKS: Array<{ label: string; text: string }> = [
  { label: "🏜️ Desert adventurer", text: "Desert adventurer clothes: cream kurta-style shirt, embroidered green waistcoat, sand-coloured trousers, red sash, small wrapped turban, sandals" },
  { label: "🚀 Astronaut", text: "A white-and-blue astronaut suit with a round glass helmet and a star patch" },
  { label: "🏴‍☠️ Pirate", text: "A friendly pirate outfit: striped shirt, red bandana, blue coat with gold buttons, boots" },
  { label: "🧙 Wizard", text: "A starry midnight-blue wizard robe with a pointed hat and a small wand" },
  { label: "🦁 Jungle explorer", text: "A khaki jungle explorer outfit with a safari hat and a map bag" },
  { label: "🤿 Deep-sea diver", text: "A yellow-and-teal diving suit with flippers and a bubble helmet" },
  { label: "🕵️ Detective", text: "A brown detective coat, checked cap and a magnifying glass" },
  { label: "👑 Royal", text: "Royal festival clothes: a rich silk sherwani or lehenga in gold and maroon, with a small crown" },
];

interface Props {
  heroName: string;
  usualLook: string | null;
  universeLook: string | null;
  inUniverse: boolean;
  choice: LookChoice;
  onChoice: (c: LookChoice) => void;
  newLook: string;
  onNewLook: (v: string) => void;
}

export default function HeroLookPicker({ heroName, usualLook, universeLook, inUniverse, choice, onChoice, newLook, onNewLook }: Props) {
  const options: Array<{ key: LookChoice; title: string; text: string }> = [
    ...(universeLook ? [{ key: "universe" as const, title: "This universe's look", text: universeLook }] : []),
    { key: "usual", title: "Usual look", text: usualLook || "We'll design an outfit in this story" },
    { key: "new", title: "✨ New look for this story", text: inUniverse ? "Great for a new world — next episodes in this universe keep it" : "Just for this story" },
  ];

  return (
    <div className="mb-6 rounded-2xl border border-ink/10 bg-white p-4">
      <p className="text-ink font-semibold text-sm">👕 {heroName}&apos;s look</p>
      <p className="text-ink-muted text-xs mb-3">Off to the desert, space or the sea? Dress your hero for the adventure.</p>

      <div className={cn("grid gap-2", options.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={() => onChoice(o.key)}
            aria-pressed={choice === o.key}
            className={cn(
              "text-left rounded-xl border px-3 py-2.5 transition",
              choice === o.key ? "border-brand bg-brand/5 ring-2 ring-brand/30" : "border-ink/12 hover:border-brand/50",
            )}
          >
            <p className={cn("text-xs font-bold", choice === o.key ? "text-brand" : "text-ink")}>{o.title}</p>
            <p className="text-ink-muted text-[11px] leading-snug mt-0.5 line-clamp-3">{o.text}</p>
          </button>
        ))}
      </div>

      {choice === "new" && (
        <div className="mt-3">
          <div className="flex flex-wrap gap-1.5 mb-2">
            {NEW_LOOKS.map((l) => {
              const picked = newLook.trim() === l.text;
              return (
                <button
                  key={l.label}
                  type="button"
                  onClick={() => onNewLook(picked ? "" : l.text)}
                  className={cn(
                    "text-xs font-semibold px-3 py-1.5 rounded-full border transition",
                    picked ? "bg-brand text-white border-brand" : "bg-white text-ink-mid border-ink/15 hover:border-brand/50 hover:text-brand",
                  )}
                >
                  {l.label}
                </button>
              );
            })}
          </div>
          <textarea
            value={newLook}
            onChange={(e) => onNewLook(e.target.value)}
            rows={3}
            maxLength={200}
            placeholder={`Describe what ${heroName} wears, e.g. a green explorer jacket and a red scarf`}
            className="w-full px-3 py-2.5 rounded-xl border border-ink/15 bg-white text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition resize-none text-sm"
          />
          <p className="text-ink-muted text-[11px] mt-1">
            Clothes only — {heroName}&apos;s face and hair stay the same.{" "}
            {usualLook ? "The usual look stays saved for other stories." : ""}
          </p>
        </div>
      )}
    </div>
  );
}
