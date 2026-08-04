"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const ADV   = "https://api.dicebear.com/9.x/adventurer/svg";
const PIXEL = "https://api.dicebear.com/9.x/pixel-art/svg";

// DiceBear v9 requires array params as repeated hair[]=val pairs
const BOY_HAIR_PARAMS  = ["short01","short02","short03","short04","short05"].map(h=>`hair[]=${h}`).join("&");
const GIRL_HAIR_PARAMS = ["long01","long02","long03","long04","long05","long06"].map(h=>`hair[]=${h}`).join("&");

function a(seed: string, bg: string, base = ADV, extra = "") {
  return `${base}?seed=${encodeURIComponent(seed)}&backgroundColor=${bg}${extra ? `&${extra}` : ""}`;
}

const PRESETS = [
  {
    id: "boy", label: "Boy", emoji: "👦",
    items: [
      a("Arjun",  "b6e3f4", ADV, BOY_HAIR_PARAMS),
      a("Kai",    "c0aede", ADV, BOY_HAIR_PARAMS),
      a("Rohan",  "d1d4f9", ADV, BOY_HAIR_PARAMS),
      a("Dev",    "ffd5dc", ADV, BOY_HAIR_PARAMS),
    ],
  },
  {
    id: "girl", label: "Girl", emoji: "👧",
    items: [
      a("Priya",  "ffd5dc", ADV, GIRL_HAIR_PARAMS),
      a("Luna",   "c0aede", ADV, GIRL_HAIR_PARAMS),
      a("Mia",    "b6e3f4", ADV, GIRL_HAIR_PARAMS),
      a("Riya",   "d1ffd6", ADV, GIRL_HAIR_PARAMS),
    ],
  },
  {
    id: "man", label: "Man", emoji: "👨",
    items: [
      a("Papa",   "c0aede", ADV, BOY_HAIR_PARAMS),
      a("Raja",   "b6e3f4", ADV, BOY_HAIR_PARAMS),
      a("Victor", "d1d4f9", ADV, BOY_HAIR_PARAMS),
      a("Baba",   "ffd5dc", ADV, BOY_HAIR_PARAMS),
    ],
  },
  {
    id: "woman", label: "Woman", emoji: "👩",
    items: [
      a("Mama",   "ffd5dc", ADV, GIRL_HAIR_PARAMS),
      a("Auntie", "c0aede", ADV, GIRL_HAIR_PARAMS),
      a("Meera",  "d1ffd6", ADV, GIRL_HAIR_PARAMS),
      a("Sofia",  "b6e3f4", ADV, GIRL_HAIR_PARAMS),
    ],
  },
  {
    id: "grandpa", label: "Grandpa", emoji: "👴",
    items: [
      a("Dadu",   "d1d4f9", ADV, `${BOY_HAIR_PARAMS}&hairColor[]=b9b9b9&hairColor[]=cdcdcd`),
      a("Nana",   "b6e3f4", ADV, `${BOY_HAIR_PARAMS}&hairColor[]=b9b9b9&hairColor[]=cdcdcd`),
      a("Dada",   "c0aede", ADV, `${BOY_HAIR_PARAMS}&hairColor[]=b9b9b9&hairColor[]=cdcdcd`),
      a("Thatha", "ffd5dc", ADV, `${BOY_HAIR_PARAMS}&hairColor[]=b9b9b9&hairColor[]=cdcdcd`),
    ],
  },
  {
    id: "granny", label: "Granny", emoji: "👵",
    items: [
      a("Dadi",  "ffd5dc", ADV, `${GIRL_HAIR_PARAMS}&hairColor[]=b9b9b9&hairColor[]=cdcdcd`),
      a("Nani",  "c0aede", ADV, `${GIRL_HAIR_PARAMS}&hairColor[]=b9b9b9&hairColor[]=cdcdcd`),
      a("Paati", "d1ffd6", ADV, `${GIRL_HAIR_PARAMS}&hairColor[]=b9b9b9&hairColor[]=cdcdcd`),
      a("Nana2", "d1d4f9", ADV, `${GIRL_HAIR_PARAMS}&hairColor[]=b9b9b9&hairColor[]=cdcdcd`),
    ],
  },
  {
    id: "pet", label: "Pet", emoji: "🐾",
    items: [
      a("fluffy-dog",    "ffd5dc", PIXEL),
      a("playful-cat",   "b6e3f4", PIXEL),
      a("cute-bunny",    "d1ffd6", PIXEL),
      a("happy-parrot",  "c0aede", PIXEL),
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
