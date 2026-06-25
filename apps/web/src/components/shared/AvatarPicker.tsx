"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const ADV  = "https://api.dicebear.com/9.x/adventurer/svg";
const BOT  = "https://api.dicebear.com/9.x/bottts/svg";

function a(seed: string, bg: string, base = ADV) {
  return `${base}?seed=${encodeURIComponent(seed)}&backgroundColor=${bg}`;
}

const PRESETS = [
  {
    id: "boy", label: "Boy", emoji: "👦",
    items: [
      a("Arjun",  "b6e3f4"),
      a("Kai",    "c0aede"),
      a("Rohan",  "d1d4f9"),
      a("Oliver", "ffd5dc"),
    ],
  },
  {
    id: "girl", label: "Girl", emoji: "👧",
    items: [
      a("Priya",  "ffd5dc"),
      a("Luna",   "c0aede"),
      a("Mia",    "b6e3f4"),
      a("Riya",   "d1ffd6"),
    ],
  },
  {
    id: "man", label: "Man", emoji: "👨",
    items: [
      a("Papa",   "c0aede"),
      a("Raja",   "b6e3f4"),
      a("Victor", "d1d4f9"),
      a("Baba",   "ffd5dc"),
    ],
  },
  {
    id: "woman", label: "Woman", emoji: "👩",
    items: [
      a("Mama",   "ffd5dc"),
      a("Auntie", "c0aede"),
      a("Meera",  "d1ffd6"),
      a("Sofia",  "b6e3f4"),
    ],
  },
  {
    id: "grandpa", label: "Grandpa", emoji: "👴",
    items: [
      a("Grandpa", "d1d4f9"),
      a("Dadu",    "b6e3f4"),
      a("Nana",    "c0aede"),
      a("Dada",    "ffd5dc"),
    ],
  },
  {
    id: "granny", label: "Granny", emoji: "👵",
    items: [
      a("Granny", "ffd5dc"),
      a("Nani",   "c0aede"),
      a("Dadi",   "d1ffd6"),
      a("Paati",  "d1d4f9"),
    ],
  },
  {
    id: "pet", label: "Pet", emoji: "🐾",
    items: [
      a("Dog",    "ffd5dc", BOT),
      a("Cat",    "b6e3f4", BOT),
      a("Bunny",  "d1ffd6", BOT),
      a("Parrot", "c0aede", BOT),
    ],
  },
];

interface AvatarPickerProps {
  value: string | null;
  onChange: (url: string | null) => void;
  compact?: boolean;
  customAvatars?: string[];
}

export default function AvatarPicker({
  value,
  onChange,
  compact = false,
  customAvatars = [],
}: AvatarPickerProps) {
  const hasCustom  = customAvatars.length > 0;
  const defaultTab = hasCustom ? "mine" : PRESETS[0].id;

  const [activeCat, setActiveCat] = useState<string>(defaultTab);

  const allCategories = [
    ...(hasCustom ? [{ id: "mine", label: "Mine", emoji: "✨", items: customAvatars }] : []),
    ...PRESETS,
  ];

  const current = allCategories.find(p => p.id === activeCat) ?? allCategories[0];

  return (
    <div>
      {/* Category tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-hide">
        {allCategories.map((p) => (
          <button key={p.id} type="button"
            onClick={() => setActiveCat(p.id)}
            className={cn(
              "flex-shrink-0 flex items-center gap-1 rounded-full border font-semibold transition whitespace-nowrap",
              compact ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs",
              activeCat === p.id
                ? "border-brand bg-brand text-white"
                : p.id === "mine"
                  ? "border-gold/40 bg-gold/10 text-gold-dark hover:border-gold/60"
                  : "border-ink/15 bg-cream text-ink-mid hover:border-brand/40",
            )}>
            {p.emoji} {p.label}
          </button>
        ))}
      </div>

      {/* Avatar options */}
      <div className={cn("flex gap-3 flex-wrap mt-3", compact && "gap-2")}>
        {current.items.map((url, i) => {
          const selected = value === url;
          return (
            <button key={i} type="button"
              onClick={() => onChange(selected ? null : url)}
              title={`${current.label} avatar ${i + 1}`}
              className={cn(
                "rounded-full overflow-hidden border-[3px] transition-all flex-shrink-0 bg-white",
                compact ? "w-12 h-12" : "w-16 h-16",
                selected
                  ? "border-brand scale-110 shadow-lg shadow-brand/25"
                  : "border-transparent hover:border-brand/40 hover:scale-105",
              )}>
              <img
                src={url}
                alt={`${current.label} ${i + 1}`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </button>
          );
        })}
      </div>

      {current.id === "mine" && (
        <p className="text-ink-muted text-[10px] mt-2">
          ✨ All your generated avatars are saved here — reusable across any character, even if you closed the window mid-generation.
        </p>
      )}
    </div>
  );
}
