"use client";

import { Check, CreditCard, Loader2, Plus, Sparkles, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";

import Navbar from "@/components/layout/Navbar";
import AvatarPicker from "@/components/shared/AvatarPicker";
import { useAuth } from "@/contexts/AuthContext";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

// ── Constants ─────────────────────────────────────────────────────────────────

type HeroGender = "boy" | "girl" | "non-binary" | "";
type CharRole   = "friend" | "sibling" | "pet" | "villain" | "other";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

const STORY_MODES = [
  {
    value: "new_adventure",
    emoji: "🌟",
    label: "New Adventure",
    description: "A brand-new story in your universe.",
  },
  {
    value: "continue_arc",
    emoji: "⚔️",
    label: "Continue Adventure",
    description: "Pick up from where the last episode ended.",
  },
  {
    value: "new_arc",
    emoji: "🗺️",
    label: "New Story Arc",
    description: "Start a new chapter with fresh stakes.",
  },
  {
    value: "standalone",
    emoji: "📖",
    label: "Standalone Story",
    description: "A one-off tale saved independently — not added to any universe.",
  },
  {
    value: "freeform",
    emoji: "✏️",
    label: "Write My Own",
    description: "Describe exactly what you want. Saved independently, not tied to any universe.",
  },
];

const THEMES = [
  { value: "space-adventure",      emoji: "🚀", name: "Space Adventure",      gradient: "from-indigo-950 to-purple-900" },
  { value: "superhero-mission",    emoji: "⚡", name: "Superhero Mission",    gradient: "from-red-950 to-orange-900" },
  { value: "jungle-quest",         emoji: "🌿", name: "Jungle Quest",         gradient: "from-green-950 to-emerald-800" },
  { value: "underwater-adventure", emoji: "🌊", name: "Underwater Adventure", gradient: "from-blue-950 to-cyan-900" },
  { value: "detective-mystery",    emoji: "🔍", name: "Detective Mystery",    gradient: "from-gray-900 to-slate-800" },
  { value: "birthday-adventure",   emoji: "🎂", name: "Birthday Adventure",   gradient: "from-pink-950 to-rose-900" },
];

const CONTEXT_PROMPTS = [
  "Arjun uses Magic Stardust to rescue his father from Prison Planet.",
  "A mysterious letter arrives from the future.",
  "The hero must find the lost Crystal Key before sunset.",
  "Nova the Robot needs help and sends an emergency signal.",
];

const CHAR_ROLES: { value: CharRole; label: string }[] = [
  { value: "friend",   label: "Friend" },
  { value: "sibling",  label: "Sibling" },
  { value: "pet",      label: "Pet" },
  { value: "villain",  label: "Villain" },
  { value: "other",    label: "Other" },
];

type StepType = "hero" | "mode" | "theme" | "characters" | "companion" | "context" | "generate";

const STEP_LABELS: Record<StepType, string> = {
  hero:       "Your Hero",
  mode:       "Story Mode",
  theme:      "Adventure",
  characters: "Cast",
  companion:  "Companion",
  context:    "Story Hint",
  generate:   "Generate",
};

const HEADER_TITLES: Record<StepType, string> = {
  hero:       "Who is the hero?",
  mode:       "Choose story mode",
  theme:      "Choose the adventure",
  characters: "Who joins this episode?",
  companion:  "Does your hero have a companion?",
  context:    "Add a story hint",
  generate:   "Ready to create?",
};

const COMPANION_TYPES = [
  { type: "Dragon",      emoji: "🐉", label: "Dragon",       description: "Brave and powerful" },
  { type: "Phoenix",     emoji: "🦅", label: "Phoenix",      description: "Rises from the flames" },
  { type: "Robot",       emoji: "🤖", label: "Robot",        description: "Clever and loyal" },
  { type: "MagicalFox",  emoji: "🦊", label: "Magical Fox",  description: "Swift and wise" },
  { type: "SpiritWolf",  emoji: "🐺", label: "Spirit Wolf",  description: "Guardian of shadows" },
  { type: "Unicorn",     emoji: "🦄", label: "Unicorn",      description: "Pure magic" },
];

// ── Interfaces ────────────────────────────────────────────────────────────────

interface ExistingHero {
  id: string;
  name: string;
  age: number;
  dob: string | null;
  gender: HeroGender;
  avatarUrl: string | null;
}

interface Character {
  id: string;
  name: string;
  role: CharRole;
  dob: string | null;
  avatarUrl: string | null;
}

interface LastStory {
  id: string;
  title: string | null;
  cliffhanger: string | null;
  theme: string | null;
  createdAt: string;
}

function CreatePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedUniverseId = searchParams.get("universeId");
  const { user } = useAuth();

  // Hero state
  const [hero, setHero]               = useState<ExistingHero | null>(null);
  const [heroLoading, setHeroLoading] = useState(true);
  const [heroName, setHeroName]       = useState("");
  const [heroDob, setHeroDob]         = useState("");
  const [heroGender, setHeroGender]   = useState<HeroGender>("");
  const [photoFile, setPhotoFile]     = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [consented, setConsented]     = useState(false);

  // Characters state
  const [characters, setCharacters]           = useState<Character[]>([]);
  const [selectedCharIds, setSelectedCharIds] = useState<string[]>([]);
  const [showCharForm, setShowCharForm]       = useState(false);
  const [charName, setCharName]               = useState("");
  const [charRole, setCharRole]               = useState<CharRole>("friend");
  const [charDob, setCharDob]                 = useState("");
  const [charPhotoFile, setCharPhotoFile]     = useState<File | null>(null);
  const [charPhotoPreview, setCharPhotoPreview] = useState<string | null>(null);
  const [charPresetAvatar, setCharPresetAvatar] = useState<string | null>(null);
  const [charSaving, setCharSaving]           = useState(false);
  const charPhotoRef = useRef<HTMLInputElement>(null);

  // Story state
  const [step, setStep]                 = useState(0);
  const [storyMode, setStoryMode]       = useState("new_adventure");
  const [selectedTheme, setSelectedTheme] = useState("");
  const [storyContext, setStoryContext] = useState("");

  // Companion state
  const [companionType, setCompanionType]   = useState<string | null>(null);
  const [companionName, setCompanionName]   = useState("");
  const [companionPetId, setCompanionPetId] = useState<string | null>(null);

  // Last story for "Continue Adventure" context
  const [lastStory, setLastStory]             = useState<LastStory | null>(null);
  const [lastStoryLoading, setLastStoryLoading] = useState(false);

  // UI state
  const [generating, setGenerating] = useState(false);
  const [error, setError]           = useState("");

  // Load existing hero + characters on mount
  useEffect(() => {
    const token = localStorage.getItem("hvu_access");
    if (!token) { setHeroLoading(false); return; }
    const h = { Authorization: `Bearer ${token}` };

    Promise.all([
      fetch(`${BASE}/heroes`,     { headers: h }).then(r => r.json()).catch(() => ({ data: [] })),
      fetch(`${BASE}/characters`, { headers: h }).then(r => r.json()).catch(() => ({ data: [] })),
    ]).then(([heroRes, charRes]) => {
      if (Array.isArray(heroRes.data) && heroRes.data.length > 0) {
        setHero(heroRes.data[0] as ExistingHero);
      }
      if (Array.isArray(charRes.data)) {
        setCharacters(charRes.data as Character[]);
      }
    }).finally(() => setHeroLoading(false));
  }, []);

  const hasHero = !!hero;

  // Dynamic step sequence based on mode + hero existence
  const stepSequence = useMemo<StepType[]>(() => {
    const arr: StepType[] = [];
    if (!hasHero) arr.push("hero");
    arr.push("mode");
    if (storyMode !== "freeform") arr.push("theme");
    arr.push("characters");
    arr.push("companion");
    arr.push("context");
    arr.push("generate");
    return arr;
  }, [hasHero, storyMode]);

  const stepType = stepSequence[step] ?? "generate";
  const stepLabels = stepSequence.map(s => STEP_LABELS[s]);
  const selectedThemeData = THEMES.find(t => t.value === selectedTheme);

  // Reset theme when switching to freeform; fetch last story for continue_arc
  function handleModeSelect(mode: string) {
    setStoryMode(mode);
    if (mode === "freeform") setSelectedTheme("");
    if (mode === "continue_arc" && !lastStory && !lastStoryLoading) {
      setLastStoryLoading(true);
      const token = localStorage.getItem("hvu_access");
      fetch(`${BASE}/stories`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(({ data }) => {
          const stories: LastStory[] = Array.isArray(data) ? data : [];
          const completed = stories.find((s: any) => s.status === "completed");
          setLastStory(completed ?? null);
        })
        .catch(() => {})
        .finally(() => setLastStoryLoading(false));
    }
  }

  // When freeform is selected and theme step disappears, keep step index valid
  useEffect(() => {
    if (step >= stepSequence.length) setStep(stepSequence.length - 1);
  }, [stepSequence, step]);

  function handlePhoto(file: File) {
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setConsented(false);
  }

  function handleCharPhoto(file: File) {
    setCharPhotoFile(file);
    setCharPhotoPreview(URL.createObjectURL(file));
  }

  function toggleCharacter(id: string) {
    setSelectedCharIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  function resetCharForm() {
    setCharName("");
    setCharRole("friend");
    setCharDob("");
    setCharPhotoFile(null);
    setCharPhotoPreview(null);
    setCharPresetAvatar(null);
    setShowCharForm(false);
  }

  async function saveCharacter() {
    if (!charName.trim()) return;
    setCharSaving(true);
    try {
      const token = localStorage.getItem("hvu_access") ?? "";
      const form = new FormData();
      form.append("name", charName.trim());
      form.append("role", charRole);
      if (charDob) form.append("dob", charDob);
      if (charPhotoFile) form.append("photo", charPhotoFile);
      else if (charPresetAvatar) form.append("avatarUrl", charPresetAvatar);

      const res = await fetch(`${BASE}/characters`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const { data } = await res.json();
      if (data?.id) {
        const newChar: Character = {
          id: data.id,
          name: data.name,
          role: data.role,
          dob: data.dob ?? null,
          avatarUrl: data.avatarUrl ?? null,
        };
        setCharacters(prev => [...prev, newChar]);
        setSelectedCharIds(prev => [...prev, newChar.id]);
      }
      resetCharForm();
    } catch {
      // silently fail — character can be added in /characters page
    } finally {
      setCharSaving(false);
    }
  }

  function canAdvance(): boolean {
    switch (stepType) {
      case "hero":       return !!heroName.trim() && !!heroDob && !!heroGender && (!photoFile || consented);
      case "mode":       return !!storyMode;
      case "theme":      return true;
      case "characters": return true;
      case "companion":  return true;
      case "context":    return true;
      case "generate":   return true;
    }
  }

  async function handleGenerate() {
    if (!user) { router.push("/login"); return; }
    setGenerating(true);
    setError("");

    try {
      const token = localStorage.getItem("hvu_access") ?? "";
      const headers = { Authorization: `Bearer ${token}` };

      let heroId: string;

      if (hero) {
        heroId = hero.id;
      } else {
        let avatarUrl: string | undefined;
        if (photoFile) {
          const form = new FormData();
          form.append("photo", photoFile);
          const upRes = await fetch(`${BASE}/upload/avatar`, { method: "POST", headers, body: form });
          if (!upRes.ok) throw new ApiError(upRes.status, await upRes.json());
          const { data } = await upRes.json();
          avatarUrl = data.avatarUrl;
        }

        const heroRes = await fetch(`${BASE}/heroes`, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ name: heroName, dob: heroDob, gender: heroGender }),
        });
        if (!heroRes.ok) throw new ApiError(heroRes.status, await heroRes.json());
        const { data: newHero } = await heroRes.json();
        heroId = newHero.id;

        if (avatarUrl) {
          await fetch(`${BASE}/heroes/${heroId}`, {
            method: "PATCH",
            headers: { ...headers, "Content-Type": "application/json" },
            body: JSON.stringify({ avatarUrl }),
          });
        }
      }

      const isFreeform = storyMode === "freeform";
      // Standalone and freeform stories are always independent — never attached to a universe
      const isIndependent = storyMode === "standalone" || isFreeform;
      const storyRes = await fetch(`${BASE}/stories`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          heroId,
          theme: isFreeform ? undefined : (selectedTheme || undefined),
          storyMode: isFreeform ? "standalone" : storyMode,
          storyContext: storyContext.trim() || undefined,
          characterIds: selectedCharIds.length > 0 ? selectedCharIds : undefined,
          ...(!isIndependent && preselectedUniverseId ? { universeId: preselectedUniverseId } : {}),
          ...(companionType ? { companionType, companionName: companionName.trim() || undefined, companionPetId: companionPetId ?? undefined } : {}),
        }),
      });
      if (!storyRes.ok) throw new ApiError(storyRes.status, await storyRes.json());
      const { data: story } = await storyRes.json();

      router.push(`/stories/${story.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
      setGenerating(false);
    }
  }

  function advance() {
    if (stepType === "generate") return;
    setStep(s => s + 1);
  }

  if (heroLoading) {
    return (
      <div className="min-h-screen bg-space-gradient flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      <Navbar />

      {/* Dark header */}
      <header className="bg-page-header pt-28 md:pt-32 pb-8 px-6">
        <div className="max-w-lg mx-auto text-center mb-5">
          <p className="text-gold text-xs font-bold tracking-widest uppercase mb-2">CREATE EPISODE</p>
          <h1 className="font-[family-name:var(--font-display)] text-white text-3xl md:text-4xl">
            {HEADER_TITLES[stepType]}
          </h1>
          {hero && stepType === "mode" && (
            <p className="text-white/50 text-sm mt-2">
              Hero: <strong className="text-gold">{hero.name}</strong> ·{" "}
              <a href="/characters" className="text-white/40 hover:text-white underline text-xs">Edit cast</a>
            </p>
          )}
          {stepType === "characters" && (
            <p className="text-white/50 text-sm mt-2">
              These characters will appear alongside {hero?.name ?? heroName} in this episode.
            </p>
          )}
        </div>

        {/* Step indicator */}
        <div className="flex items-start justify-center gap-0 max-w-sm mx-auto">
          {stepLabels.map((label, index) => (
            <div key={label} className="flex items-start">
              <div className="flex flex-col items-center">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                  index < step   && "bg-brand text-white",
                  index === step && "bg-gold text-space ring-4 ring-gold/30",
                  index > step   && "bg-white/10 text-white/40",
                )}>
                  {index < step ? <Check className="w-3.5 h-3.5" /> : index + 1}
                </div>
                <span className={cn(
                  "text-[10px] mt-1 hidden sm:block whitespace-nowrap",
                  index === step ? "text-gold font-semibold" : "text-white/30",
                )}>{label}</span>
              </div>
              {index < stepLabels.length - 1 && (
                <div className={cn(
                  "flex-1 h-0.5 mx-1 mt-4",
                  stepLabels.length <= 4 ? "w-14 max-w-[56px]" : "w-10 max-w-[40px]",
                  index < step ? "bg-brand" : "bg-white/15",
                )} />
              )}
            </div>
          ))}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-lg mx-auto w-full px-6 py-10">

        {/* ── Hero Setup (new users only) ─────────────────────────────────── */}
        {stepType === "hero" && (
          <section>
            <p className="text-ink-muted mb-6 text-sm">Tell us about your child — they become the star of every episode.</p>

            <div className="bg-brand-50 border border-brand/20 rounded-2xl p-4 mb-6 text-sm">
              <p className="font-semibold text-ink mb-1">🎨 How we use photos</p>
              <ul className="text-ink-mid space-y-1 text-xs leading-relaxed">
                <li>✦ We create a unique illustrated <strong>avatar</strong> — the original is never stored</li>
                <li>✦ The avatar appears only in <strong>your</strong> child&apos;s stories</li>
              </ul>
            </div>

            <div className="mb-6">
              <input type="file" accept="image/*" id="photo-upload" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhoto(f); }} />
              {photoPreview ? (
                <div className="relative w-full rounded-2xl overflow-hidden bg-ink/5 border border-ink/10">
                  <img src={photoPreview} alt="Hero" className="w-full max-h-64 object-contain" />
                  <label htmlFor="photo-upload"
                    className="absolute bottom-3 right-3 bg-white/90 backdrop-blur text-ink text-xs font-semibold px-3 py-1.5 rounded-full cursor-pointer hover:bg-white border border-ink/10 shadow-sm transition">
                    Replace photo
                  </label>
                </div>
              ) : (
                <label htmlFor="photo-upload"
                  className="flex flex-col items-center justify-center w-full h-40 rounded-2xl border-2 border-dashed border-brand/40 hover:border-brand bg-brand-50 transition cursor-pointer">
                  <span className="text-4xl mb-2">📸</span>
                  <span className="text-brand text-sm font-semibold">Upload Child&apos;s Photo</span>
                  <span className="text-ink-muted text-xs mt-1">Optional · JPG, PNG, HEIC</span>
                </label>
              )}
            </div>

            {photoFile && (
              <label className="flex items-start gap-3 mb-5 cursor-pointer bg-brand-50 rounded-xl p-3">
                <input type="checkbox" checked={consented} onChange={(e) => setConsented(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded accent-brand flex-shrink-0" />
                <span className="text-ink-mid text-xs leading-relaxed">
                  I consent to this photo being temporarily processed to create an illustrated avatar.
                  I confirm I am the parent or guardian of the child in this photo.
                </span>
              </label>
            )}

            <div className="flex flex-col gap-4">
              <div>
                <label className="text-ink-mid text-sm font-medium block mb-1.5">Hero Name</label>
                <input type="text" value={heroName} onChange={(e) => setHeroName(e.target.value)}
                  placeholder="What's your child's name?"
                  className="w-full px-4 py-3 rounded-xl border border-ink/15 bg-cream text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition" />
              </div>
              <div>
                <label className="text-ink-mid text-sm font-medium block mb-1.5">
                  Date of Birth <span className="text-brand">*</span>
                  <span className="text-ink-muted text-xs font-normal ml-1">— used for birthday rewards</span>
                </label>
                <input type="date" value={heroDob} onChange={(e) => setHeroDob(e.target.value)}
                  max={new Date().toISOString().split("T")[0]}
                  className="w-full px-4 py-3 rounded-xl border border-ink/15 bg-cream text-ink focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition" />
              </div>
              <div>
                <p className="text-ink-mid text-sm font-medium mb-1.5">They are a...</p>
                <div className="flex gap-3">
                  {(["Boy","Girl","Non-binary"] as const).map((label) => {
                    const v = (label === "Non-binary" ? "non-binary" : label.toLowerCase()) as HeroGender;
                    return (
                      <button key={label} type="button"
                        onClick={() => setHeroGender(v)}
                        className={cn("flex-1 py-2.5 rounded-xl border text-sm font-semibold transition",
                          heroGender === v ? "border-brand bg-brand text-white" : "border-ink/15 bg-cream text-ink-mid hover:border-brand/40")}>
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── Story Mode ──────────────────────────────────────────────────── */}
        {stepType === "mode" && (
          <section>
            {preselectedUniverseId && (storyMode === "standalone" || storyMode === "freeform") && (
              <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
                <span className="text-amber-600 text-sm">📖</span>
                <span className="text-amber-700 text-xs font-semibold">This story will be saved independently — not added to any universe</span>
              </div>
            )}
            {preselectedUniverseId && storyMode !== "standalone" && storyMode !== "freeform" && (
              <div className="mb-4 bg-brand/8 border border-brand/20 rounded-xl px-4 py-2.5 flex items-center gap-2">
                <span className="text-brand text-sm">🌌</span>
                <span className="text-ink-mid text-xs font-semibold">Episode will be added to the selected universe</span>
              </div>
            )}
            <p className="text-ink-muted text-sm mb-6">
              How should this episode connect to your universe?
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {STORY_MODES.map((mode) => (
                <button key={mode.value} type="button"
                  onClick={() => handleModeSelect(mode.value)}
                  className={cn(
                    "text-left p-5 rounded-2xl border-2 transition-all",
                    storyMode === mode.value
                      ? "border-brand bg-brand/5 shadow-brand/20 shadow-md"
                      : "border-ink/10 bg-white hover:border-brand/30",
                    mode.value === "freeform" && "sm:col-span-2",
                  )}>
                  <span className="text-3xl block mb-3">{mode.emoji}</span>
                  <p className={cn("font-[family-name:var(--font-display)] text-base mb-1",
                    storyMode === mode.value ? "text-brand" : "text-ink")}>
                    {mode.label}
                  </p>
                  <p className="text-ink-muted text-xs leading-relaxed">{mode.description}</p>

                  {/* Show last story context when Continue Adventure is selected */}
                  {mode.value === "continue_arc" && storyMode === "continue_arc" && (
                    <div className="mt-3 bg-brand/8 border border-brand/20 rounded-xl p-3">
                      {lastStoryLoading ? (
                        <p className="text-ink-muted text-xs italic">Finding your last story…</p>
                      ) : lastStory ? (
                        <>
                          <p className="text-ink-mid text-xs font-semibold mb-1">Continuing from:</p>
                          <p className="text-ink text-xs font-bold mb-1 line-clamp-1">
                            📖 {lastStory.title ?? "Untitled Story"}
                          </p>
                          {lastStory.cliffhanger && (
                            <p className="text-ink-muted text-xs italic leading-relaxed line-clamp-3">
                              &ldquo;{lastStory.cliffhanger}&rdquo;
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-ink-muted text-xs italic">No previous completed story found — AI will start fresh.</p>
                      )}
                    </div>
                  )}

                  {storyMode === mode.value && (
                    <div className="mt-3 flex items-center gap-1 text-brand text-xs font-bold">
                      <Check className="w-3 h-3" /> Selected
                    </div>
                  )}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ── Theme ───────────────────────────────────────────────────────── */}
        {stepType === "theme" && (
          <section>
            <p className="text-ink-muted text-sm mb-6">
              What world will your hero explore?{" "}
              <span className="text-ink-muted/60 text-xs">Optional — skip if you have your own story in mind.</span>
            </p>
            <div className="grid grid-cols-2 gap-4">
              {THEMES.map((theme) => (
                <button key={theme.value} type="button"
                  onClick={() => setSelectedTheme(theme.value)}
                  className={cn(
                    "group relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:scale-105 text-left",
                    selectedTheme === theme.value
                      ? "outline outline-[3px] outline-brand scale-105"
                      : "hover:outline hover:outline-2 hover:outline-gold/50",
                  )}>
                  <div className={`aspect-square flex flex-col justify-between p-6 bg-gradient-to-br ${theme.gradient}`}>
                    <span className="text-5xl leading-none">{theme.emoji}</span>
                    <div>
                      <h3 className="text-white font-[family-name:var(--font-display)] text-xl">{theme.name}</h3>
                      <p className="text-white/0 group-hover:text-gold/80 transition-all text-sm">Explore →</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ── Characters ──────────────────────────────────────────────────── */}
        {stepType === "characters" && (
          <section>
            {/* Hero chip — always in */}
            <div className="mb-5">
              <p className="text-ink-muted text-xs font-semibold uppercase tracking-wide mb-2">Hero · Always in the story</p>
              <div className="flex items-center gap-3 bg-brand/5 border border-brand/20 rounded-2xl p-4">
                <div className="w-12 h-12 rounded-full bg-brand/10 flex items-center justify-center text-xl flex-shrink-0 overflow-hidden">
                  {hero?.avatarUrl
                    ? <img src={hero.avatarUrl} alt={hero.name} className="w-full h-full object-cover" />
                    : "🦸"}
                </div>
                <div>
                  <p className="font-[family-name:var(--font-display)] text-ink text-base">{hero?.name ?? heroName}</p>
                  <p className="text-ink-muted text-xs">Main hero · always included</p>
                </div>
                <Check className="ml-auto w-4 h-4 text-brand" />
              </div>
            </div>

            {/* Existing characters */}
            {characters.length > 0 && (
              <div className="mb-5">
                <p className="text-ink-muted text-xs font-semibold uppercase tracking-wide mb-2">Your cast · tap to add to this episode</p>
                <div className="flex flex-col gap-2">
                  {characters.map((char) => {
                    const selected = selectedCharIds.includes(char.id);
                    return (
                      <button key={char.id} type="button"
                        onClick={() => toggleCharacter(char.id)}
                        className={cn(
                          "flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all text-left",
                          selected
                            ? "border-brand bg-brand/5"
                            : "border-ink/10 bg-white hover:border-brand/20",
                        )}>
                        <div className="w-10 h-10 rounded-full flex-shrink-0 overflow-hidden bg-ink/5 flex items-center justify-center">
                          {char.avatarUrl
                            ? <img src={char.avatarUrl} alt={char.name} className="w-full h-full object-cover" />
                            : <span className="text-lg font-bold text-ink/30">{char.name[0]}</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-ink text-sm font-semibold">{char.name}</p>
                          <p className="text-ink-muted text-xs capitalize">{char.role}</p>
                        </div>
                        <div className={cn(
                          "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all",
                          selected ? "border-brand bg-brand" : "border-ink/20",
                        )}>
                          {selected && <Check className="w-3 h-3 text-white" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Add character form */}
            {showCharForm ? (
              <div className="bg-white border border-ink/10 rounded-2xl p-5 mb-4">
                <div className="flex items-center justify-between mb-4">
                  <p className="font-[family-name:var(--font-display)] text-ink text-base">New character</p>
                  <button type="button" onClick={resetCharForm} className="text-ink-muted hover:text-ink">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Avatar — preset picker + optional photo upload */}
                {(charPresetAvatar || charPhotoPreview) && (
                  <div className="flex justify-center mb-3">
                    <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-brand/30">
                      <img src={charPresetAvatar ?? charPhotoPreview!} alt="avatar" className="w-full h-full object-cover" />
                    </div>
                  </div>
                )}

                <div className="mb-4">
                  <p className="text-ink-mid text-[11px] font-semibold uppercase tracking-wide mb-2">Pick an avatar</p>
                  <AvatarPicker
                    compact
                    value={charPresetAvatar}
                    onChange={(url) => {
                      setCharPresetAvatar(url);
                      if (url) { setCharPhotoFile(null); setCharPhotoPreview(null); }
                    }}
                  />
                </div>

                <input type="file" accept="image/*" ref={charPhotoRef} className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) { handleCharPhoto(f); setCharPresetAvatar(null); } }} />
                <button type="button" onClick={() => charPhotoRef.current?.click()}
                  className="w-full text-center text-ink-muted hover:text-brand text-[11px] font-medium transition mb-4">
                  {charPhotoPreview ? "📸 Change photo" : "📸 Upload real photo for custom avatar →"}
                </button>

                {/* Name */}
                <div className="mb-3">
                  <label className="text-ink-mid text-xs font-medium block mb-1">Name <span className="text-brand">*</span></label>
                  <input type="text" value={charName} onChange={(e) => setCharName(e.target.value)}
                    placeholder="Character's name"
                    className="w-full px-3 py-2.5 rounded-xl border border-ink/15 bg-cream text-ink text-sm placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition" />
                </div>

                {/* Role */}
                <div className="mb-3">
                  <label className="text-ink-mid text-xs font-medium block mb-1.5">Role</label>
                  <div className="flex flex-wrap gap-2">
                    {CHAR_ROLES.map(r => (
                      <button key={r.value} type="button"
                        onClick={() => setCharRole(r.value)}
                        className={cn(
                          "px-3 py-1.5 rounded-full border text-xs font-semibold transition",
                          charRole === r.value ? "border-brand bg-brand text-white" : "border-ink/15 bg-cream text-ink-mid hover:border-brand/40",
                        )}>
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* DOB */}
                <div className="mb-4">
                  <label className="text-ink-mid text-xs font-medium block mb-1">
                    Date of Birth <span className="text-ink-muted font-normal">— optional</span>
                  </label>
                  <input type="date" value={charDob} onChange={(e) => setCharDob(e.target.value)}
                    max={new Date().toISOString().split("T")[0]}
                    className="w-full px-3 py-2.5 rounded-xl border border-ink/15 bg-cream text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition" />
                </div>

                <button type="button" onClick={saveCharacter} disabled={!charName.trim() || charSaving}
                  className="w-full bg-brand disabled:opacity-50 text-white font-bold py-2.5 rounded-full text-sm transition hover:bg-brand-dark flex items-center justify-center gap-2">
                  {charSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {charSaving ? "Saving…" : "Add to Cast"}
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => setShowCharForm(true)}
                className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-ink/15 hover:border-brand bg-white rounded-2xl p-4 text-ink-mid hover:text-brand text-sm font-semibold transition-all">
                <Plus className="w-4 h-4" />
                Add a character to this episode
              </button>
            )}

            <p className="text-ink-muted text-xs text-center mt-4">
              Characters are saved to your universe. Manage them anytime in{" "}
              <a href="/characters" className="text-brand underline">Cast & Characters</a>.
            </p>
          </section>
        )}

        {/* ── Companion Picker ─────────────────────────────────────────────── */}
        {stepType === "companion" && (() => {
          const petChars = characters.filter(c => c.role === "pet");
          return (
            <section>
              <p className="text-ink-muted text-sm mb-6">
                A companion travels with your hero across every adventure in this universe — earning their own story too.
                <span className="block mt-1 text-xs italic">Optional — you can skip this step.</span>
              </p>

              {/* Transform a pet */}
              {petChars.length > 0 && (
                <div className="mb-6">
                  <p className="text-xs font-bold uppercase tracking-widest text-ink-muted mb-3">Transform your pet</p>
                  <div className="flex flex-col gap-2">
                    {petChars.map(pet => (
                      <button
                        key={pet.id}
                        type="button"
                        onClick={() => {
                          setCompanionPetId(pet.id);
                          setCompanionType("TransformedPet");
                          setCompanionName(pet.name);
                        }}
                        className={cn(
                          "flex items-center gap-3 p-4 rounded-2xl border-2 text-left transition-all",
                          companionPetId === pet.id
                            ? "border-gold bg-gold/8 shadow-gold/20 shadow-md"
                            : "border-ink/10 bg-white hover:border-gold/40",
                        )}
                      >
                        <div className="w-10 h-10 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0 overflow-hidden">
                          {pet.avatarUrl
                            ? <img src={pet.avatarUrl} alt={pet.name} className="w-full h-full object-cover" />
                            : <span className="text-xl">🐾</span>}
                        </div>
                        <div>
                          <p className="font-semibold text-ink text-sm">{pet.name}</p>
                          <p className="text-xs text-ink-muted">Transform into a magical companion</p>
                        </div>
                        {companionPetId === pet.id && <span className="ml-auto text-gold text-lg">✓</span>}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 my-5">
                    <div className="h-px flex-1 bg-ink/10" />
                    <span className="text-ink-muted text-xs font-semibold">or choose a companion type</span>
                    <div className="h-px flex-1 bg-ink/10" />
                  </div>
                </div>
              )}

              {/* Companion type grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                {COMPANION_TYPES.map(c => (
                  <button
                    key={c.type}
                    type="button"
                    onClick={() => {
                      setCompanionType(c.type);
                      setCompanionPetId(null);
                      if (!companionName || COMPANION_TYPES.some(ct => ct.label === companionName)) {
                        setCompanionName(c.label);
                      }
                    }}
                    className={cn(
                      "flex flex-col items-center gap-1.5 p-4 rounded-2xl border-2 transition-all",
                      companionType === c.type && companionPetId === null
                        ? "border-brand bg-brand/5 shadow-brand/20 shadow-md"
                        : "border-ink/10 bg-white hover:border-brand/30",
                    )}
                  >
                    <span className="text-3xl">{c.emoji}</span>
                    <p className={cn("font-semibold text-sm", companionType === c.type && !companionPetId ? "text-brand" : "text-ink")}>{c.label}</p>
                    <p className="text-ink-muted text-[10px]">{c.description}</p>
                  </button>
                ))}
              </div>

              {/* Companion name input (shown when something is selected) */}
              {companionType && (
                <div className="mb-4">
                  <label className="text-ink-mid text-sm font-medium block mb-1.5">
                    Companion name <span className="text-ink-muted font-normal text-xs">(optional — AI will name them if blank)</span>
                  </label>
                  <input
                    type="text"
                    value={companionName}
                    onChange={e => setCompanionName(e.target.value)}
                    placeholder={`e.g. Blaze, Nova, Shadow…`}
                    className="w-full px-4 py-3 rounded-xl border border-ink/15 bg-cream text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition"
                  />
                </div>
              )}

              {/* Skip */}
              <button
                type="button"
                onClick={() => { setCompanionType(null); setCompanionPetId(null); setCompanionName(""); advance(); }}
                className="w-full text-center text-ink-muted hover:text-ink text-sm py-3 border border-ink/10 rounded-full transition hover:border-ink/25"
              >
                Skip — no companion for this universe
              </button>
            </section>
          );
        })()}

        {/* ── Story Context ────────────────────────────────────────────────── */}
        {stepType === "context" && (
          <section>
            <p className="text-ink-muted text-sm mb-2">
              {storyMode === "freeform"
                ? "Describe what happens in this story. Be as specific or as vague as you like — the AI will build around it."
                : "Give the AI a hint about what should happen in this episode. The AI will weave it into the story while respecting your universe's history."}
            </p>
            <p className="text-ink-muted text-xs mb-6 italic">This step is optional — skip it to let the AI surprise you.</p>

            <textarea
              value={storyContext}
              onChange={(e) => setStoryContext(e.target.value)}
              rows={4}
              maxLength={500}
              placeholder={
                storyMode === "freeform"
                  ? "e.g. Riya discovers a magical door in her bedroom that leads to a cloud kingdom..."
                  : "e.g. Arjun uses Magic Stardust to rescue his father from Prison Planet."
              }
              className="w-full px-4 py-3 rounded-2xl border border-ink/15 bg-white text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition resize-none text-sm mb-2"
            />
            <p className="text-ink-muted text-xs text-right mb-6">{storyContext.length}/500</p>

            <div className="mb-2">
              <p className="text-ink-mid text-xs font-semibold mb-3 uppercase tracking-wide">Quick ideas</p>
              <div className="flex flex-col gap-2">
                {CONTEXT_PROMPTS.map((prompt) => (
                  <button key={prompt} type="button"
                    onClick={() => setStoryContext(prompt)}
                    className="text-left text-xs text-ink-mid bg-white border border-ink/10 hover:border-brand hover:text-brand px-4 py-2.5 rounded-xl transition line-clamp-1">
                    ✦ {prompt}
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── Review & Generate ────────────────────────────────────────────── */}
        {stepType === "generate" && (
          <section>
            <div className="bg-white border border-ink/10 rounded-2xl p-6 mb-6">
              {/* Hero */}
              <div className="flex items-center gap-4 pb-5 border-b border-ink/8 mb-5">
                <div className="w-14 h-14 rounded-full overflow-hidden bg-brand/10 flex items-center justify-center flex-shrink-0">
                  {(hero?.avatarUrl || photoPreview) ? (
                    <img src={hero?.avatarUrl ?? photoPreview!} alt="Hero" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl">🦸</span>
                  )}
                </div>
                <div>
                  <p className="font-[family-name:var(--font-display)] text-ink text-lg">{hero?.name ?? heroName}</p>
                  <p className="text-ink-muted text-xs">{hero?.gender ?? heroGender}</p>
                </div>
              </div>

              {/* Summary rows */}
              <div className="flex flex-col gap-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">Story Mode</span>
                  <span className="font-semibold text-ink">
                    {STORY_MODES.find(m => m.value === storyMode)?.emoji}{" "}
                    {STORY_MODES.find(m => m.value === storyMode)?.label}
                  </span>
                </div>
                {selectedTheme && (
                  <div className="flex items-center justify-between">
                    <span className="text-ink-muted">Adventure</span>
                    <span className="font-semibold text-ink">
                      {selectedThemeData?.emoji} {selectedThemeData?.name}
                    </span>
                  </div>
                )}
                {selectedCharIds.length > 0 && (
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-ink-muted flex-shrink-0">Cast</span>
                    <span className="font-semibold text-ink text-right text-xs leading-relaxed">
                      {characters
                        .filter(c => selectedCharIds.includes(c.id))
                        .map(c => c.name)
                        .join(", ")}
                    </span>
                  </div>
                )}
                {storyContext && (
                  <div className="pt-3 border-t border-ink/8">
                    <p className="text-ink-muted text-xs mb-1">Story Hint</p>
                    <p className="text-ink-mid text-xs italic leading-relaxed">&ldquo;{storyContext}&rdquo;</p>
                  </div>
                )}
                <div className="flex items-center gap-2 pt-3 border-t border-ink/8 text-ink-muted">
                  <CreditCard className="w-4 h-4" />
                  <span className="text-xs">1 story credit will be used</span>
                  {user && <span className="ml-auto text-xs">{user.credits} credits remaining</span>}
                </div>
                {/* Plan & page count info */}
                {(() => {
                  const plan = (user as any)?.plan ?? "basic";
                  const pages = plan === "premium" ? 10 : plan === "standard" ? 8 : 6;
                  const planLabel = plan === "premium" ? "Premium" : plan === "standard" ? "Standard" : "Basic";
                  return (
                    <div className="flex items-center justify-between pt-3 border-t border-ink/8">
                      <span className="text-ink-muted text-xs">Your plan</span>
                      <span className="text-xs font-semibold text-ink">{planLabel} · {pages} pages (1 cover + {pages - 1} story pages)</span>
                    </div>
                  );
                })()}
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-5">
                {error}
              </div>
            )}

            <button type="button" onClick={handleGenerate} disabled={generating}
              className="w-full bg-brand hover:bg-brand-dark disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-4 rounded-full text-lg shadow-brand transition-all hover:scale-[1.02] flex items-center justify-center gap-2">
              {generating
                ? <><Loader2 className="w-5 h-5 animate-spin" /> Creating your episode…</>
                : <><Sparkles className="w-5 h-5" /> Generate Episode</>
              }
            </button>
            <p className="text-ink-muted text-xs text-center mt-3">Generation runs in the background — you can close this tab and come back.</p>
          </section>
        )}

        {/* ── Navigation ──────────────────────────────────────────────────── */}
        <div className={cn("flex gap-4 mt-8", stepType === "generate" ? "justify-center" : "")}>
          {step > 0 && stepType !== "generate" && (
            <button type="button" onClick={() => setStep(s => s - 1)}
              className="text-ink-muted hover:text-ink px-6 py-3 rounded-full text-sm transition">
              ← Back
            </button>
          )}
          {stepType === "generate" && (
            <button type="button" onClick={() => setStep(s => s - 1)}
              className="text-ink-muted text-sm hover:text-ink mx-auto mt-2 block transition">
              ← Go Back
            </button>
          )}
          {stepType !== "generate" && (
            <button type="button"
              disabled={!canAdvance()}
              onClick={advance}
              className={cn(
                "flex-1 bg-brand disabled:bg-ink/20 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-full transition-all shadow-brand",
                canAdvance() && "hover:scale-[1.02]",
              )}>
              {stepType === "theme"
                ? selectedTheme ? "Continue →" : "Skip — use my story context →"
                : stepType === "context"
                  ? storyContext.trim() ? "Use this hint →" : "Skip →"
                  : stepType === "characters"
                    ? selectedCharIds.length > 0
                      ? `Continue with ${selectedCharIds.length + 1} characters →`
                      : "Continue solo →"
                    : "Continue →"}
            </button>
          )}
        </div>
      </main>
    </div>
  );
}

export default function CreatePage() {
  return (
    <Suspense fallback={null}>
      <CreatePageInner />
    </Suspense>
  );
}
