"use client";

/**
 * The hero's costume (hero.costumeDescription). In universe episodes it overrides the AI's own choice,
 * which keeps the hero recognisable from episode to episode; one-off stories ignore it.
 */
const IDEAS: Array<{ label: string; text: string }> = [
  { label: "🚀 Space explorer", text: "A white-and-blue space explorer suit with a glowing star badge on the chest" },
  { label: "🦸 Cape & star", text: "A purple superhero suit with a flowing cape and a golden star emblem" },
  { label: "🥷 Ninja", text: "A dark blue ninja outfit with a red sash and a cloth mask" },
  { label: "🧙 Wizard", text: "A starry midnight-blue wizard robe with a pointed hat and a small wand" },
  { label: "🦁 Jungle explorer", text: "A khaki jungle explorer outfit with a safari hat and a map bag" },
  { label: "⚡ Lightning hero", text: "A red-and-gold hero suit with a lightning bolt on the chest and a short cape" },
];

export default function CostumeField({ value, onChange, rows = 2 }: { value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <div>
      <label className="text-ink-mid text-sm font-medium block mb-1">
        Superhero costume <span className="text-ink-muted font-normal text-xs">— optional</span>
      </label>
      <p className="text-ink-muted text-xs mb-2 leading-relaxed">
        Your hero wears this in every universe episode. Leave it empty and we&apos;ll design one in the first episode.
      </p>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {IDEAS.map((idea) => {
          const picked = value.trim() === idea.text;
          return (
            <button
              key={idea.label}
              type="button"
              onClick={() => onChange(picked ? "" : idea.text)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition ${
                picked ? "bg-brand text-white border-brand" : "bg-white text-ink-mid border-ink/15 hover:border-brand/50 hover:text-brand"
              }`}
            >
              {idea.label}
            </button>
          );
        })}
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        maxLength={200}
        placeholder="Or describe your own — e.g. red cape, blue mask and a golden shield, or their favourite t-shirt"
        className="w-full px-4 py-3 rounded-xl border border-ink/15 bg-cream text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition resize-none text-sm"
      />
    </div>
  );
}
