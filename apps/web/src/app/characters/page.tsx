"use client";

import { Loader2, Package, Pencil, Plus, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import Footer from "@/components/layout/Footer";
import Navbar from "@/components/layout/Navbar";
import AvatarGenerateModal from "@/components/shared/AvatarGenerateModal";
import Breadcrumb from "@/components/shared/Breadcrumb";
import AvatarPicker from "@/components/shared/AvatarPicker";
import { getAccessToken } from "@/lib/api";
import { usePublicPlatformSettings } from "@/lib/platform-settings";
import { cn } from "@/lib/utils";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

type CharRole = "friend" | "sibling" | "pet" | "villain" | "other";

const ROLES: { value: CharRole; label: string; emoji: string }[] = [
  { value: "friend",  label: "Friend",  emoji: "🤝" },
  { value: "sibling", label: "Sibling", emoji: "👫" },
  { value: "pet",     label: "Pet",     emoji: "🐾" },
  { value: "villain", label: "Villain", emoji: "😈" },
  { value: "other",   label: "Other",   emoji: "⭐" },
];

interface Hero {
  id: string;
  name: string | null;
  dob: string | null;
  gender: string | null;
  avatarUrl: string | null;
}

interface Character {
  id: string;
  name: string | null;
  role: CharRole | null;
  dob: string | null;
  avatarUrl: string | null;
  photoUrl: string | null;
}

interface AvatarStats {
  customAvatars: string[];
  heroGenerationsUsed: number;
  heroGenerationsMax: number;
  characterGenerationsUsed: number;
  characterGenerationsMax: number;
  avatarRefreshTokens: number;
}

const DEFAULT_STATS: AvatarStats = {
  customAvatars: [],
  heroGenerationsUsed: 0,
  heroGenerationsMax: 2,
  characterGenerationsUsed: 0,
  characterGenerationsMax: 3,
  avatarRefreshTokens: 0,
};

interface CharacterEconomy {
  characterSlotsTotal: number;
  characterSlotsUsed: number;
  characterSlotsRemaining: number | null;
  unlimitedCharacters: boolean;
  avatarRefreshTokens: number;
}

const DEFAULT_ECONOMY: CharacterEconomy = {
  characterSlotsTotal: 3,
  characterSlotsUsed: 0,
  characterSlotsRemaining: 3,
  unlimitedCharacters: false,
  avatarRefreshTokens: 0,
};

// ── Character Form Modal ──────────────────────────────────────────────────────

interface FormModalProps {
  existing: Character | null;
  avatarStats: AvatarStats;
  customAvatars: string[];
  onSave: (data: { name: string; role: CharRole; dob: string; avatarUrl: string | null }) => Promise<void>;
  onClose: () => void;
  onAvatarGenerated: (url: string) => void;
}

function CharacterFormModal({
  existing, avatarStats, customAvatars, onSave, onClose, onAvatarGenerated,
}: FormModalProps) {
  const [name, setName]           = useState(existing?.name ?? "");
  const [role, setRole]           = useState<CharRole>(existing?.role ?? "friend");
  const [dob, setDob]             = useState(existing?.dob?.split("T")[0] ?? "");
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(!existing);
  const [saving, setSaving]       = useState(false);

  const [generateTarget, setGenerateTarget] = useState<{ file: File; preview: string } | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  const hasChange      = !!selectedAvatar;
  const displayedAvatar = selectedAvatar ?? existing?.avatarUrl ?? null;

  function clearChange() {
    setSelectedAvatar(null);
    if (existing) setShowPicker(false);
  }

  function handlePhotoSelected(file: File) {
    const preview = URL.createObjectURL(file);
    setGenerateTarget({ file, preview });
    if (photoRef.current) photoRef.current.value = "";
  }

  function handleGenerateSuccess(avatarUrl: string) {
    setSelectedAvatar(avatarUrl);
    setGenerateTarget(null);
    onAvatarGenerated(avatarUrl);
    setShowPicker(false);
  }

  async function handleSubmit() {
    if (!name.trim()) return;
    setSaving(true);
    await onSave({ name: name.trim(), role, dob, avatarUrl: selectedAvatar });
    setSaving(false);
  }

  const canSave = name.trim() && !saving;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 relative max-h-[92vh] overflow-y-auto">
          <button type="button" onClick={onClose}
            className="absolute top-5 right-5 text-ink-muted hover:text-ink transition">
            <X className="w-5 h-5" />
          </button>

          <h3 className="font-[family-name:var(--font-display)] text-ink text-2xl mb-6">
            {existing ? "Edit character" : "Add a character"}
          </h3>

          {/* Avatar preview */}
          <div className="flex flex-col items-center mb-5">
            <div className="relative">
              <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-brand/20 shadow-md bg-brand/10 flex items-center justify-center">
                {displayedAvatar
                  ? <img src={displayedAvatar} alt="avatar" className="w-full h-full object-cover" />
                  : <span className="text-3xl">👤</span>}
              </div>
              {hasChange && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-brand rounded-full flex items-center justify-center text-white text-[10px] font-bold">✓</span>
              )}
            </div>
            {existing && (
              <p className="text-ink-muted text-xs mt-2">
                {hasChange ? "New avatar selected" : existing.avatarUrl ? "Current avatar" : "No avatar yet"}
              </p>
            )}
            {hasChange && existing && (
              <button type="button" onClick={clearChange}
                className="text-ink-muted hover:text-red-500 text-xs mt-1 transition">
                ✕ Keep current instead
              </button>
            )}
          </div>

          {/* Avatar picker — always open for new, toggled for edit */}
          {existing && !showPicker && !hasChange ? (
            <button type="button" onClick={() => setShowPicker(true)}
              className="w-full text-center border border-ink/15 hover:border-brand rounded-xl py-2.5 text-ink-mid hover:text-brand text-sm font-medium transition mb-5">
              {existing.avatarUrl ? "Change avatar →" : "Choose an avatar →"}
            </button>
          ) : (
            <div className="mb-4">
              <p className="text-ink-mid text-xs font-semibold uppercase tracking-wide mb-2">
                {existing?.avatarUrl ? "Change avatar" : "Choose an avatar"}
              </p>
              <AvatarPicker
                value={selectedAvatar}
                onChange={(url) => { setSelectedAvatar(url); }}
                customAvatars={customAvatars}
              />

              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-ink/10" />
                <span className="text-ink-muted text-xs font-medium">or generate from photo</span>
                <div className="flex-1 h-px bg-ink/10" />
              </div>

              {/* Photo upload area — makes privacy intent crystal-clear */}
              <input type="file" accept="image/*" ref={photoRef} className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoSelected(f); }} />

              <button type="button" onClick={() => photoRef.current?.click()}
                className="w-full flex flex-col items-center gap-2 border-2 border-dashed border-ink/20 hover:border-brand rounded-xl py-4 px-4 text-sm transition group">
                <span className="text-2xl">📸</span>
                <span className="font-semibold text-ink-mid group-hover:text-brand transition">
                  Upload a photo · get a cartoon avatar
                </span>
                <span className="text-[11px] text-ink-muted leading-relaxed text-center max-w-xs">
                  🔒 Photo is <strong>never saved</strong> — only the illustrated avatar is kept
                </span>
                {avatarStats.avatarRefreshTokens > 0 ? (
                  <span className="text-[11px] text-brand font-medium">
                    {avatarStats.avatarRefreshTokens} Avatar Refresh{avatarStats.avatarRefreshTokens !== 1 ? "es" : ""} remaining · uses 1
                  </span>
                ) : (
                  <span className="text-[11px] text-amber-600 font-semibold">
                    No Avatar Refreshes left · buy from Dashboard
                  </span>
                )}
              </button>

            </div>
          )}

          <div className="flex flex-col gap-4">
            <div>
              <label className="text-ink-mid text-sm font-medium block mb-1.5">
                Name <span className="text-brand">*</span>
              </label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Character's name"
                className="w-full px-4 py-3 rounded-xl border border-ink/15 bg-cream text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition" />
            </div>

            <div>
              <label className="text-ink-mid text-sm font-medium block mb-2">Role</label>
              <div className="flex flex-wrap gap-2">
                {ROLES.map((r) => (
                  <button key={r.value} type="button" onClick={() => setRole(r.value)}
                    className={cn(
                      "flex items-center gap-1.5 px-3.5 py-2 rounded-full border text-sm font-semibold transition",
                      role === r.value
                        ? "border-brand bg-brand text-white"
                        : "border-ink/15 bg-cream text-ink-mid hover:border-brand/40",
                    )}>
                    {r.emoji} {r.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-ink-mid text-sm font-medium block mb-1.5">
                Date of Birth <span className="text-ink-muted font-normal text-xs">— optional</span>
              </label>
              <input type="date" value={dob} onChange={(e) => setDob(e.target.value)}
                max={new Date().toISOString().split("T")[0]}
                className="w-full px-4 py-3 rounded-xl border border-ink/15 bg-cream text-ink focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition" />
            </div>

            <button type="button" disabled={!canSave} onClick={handleSubmit}
              className="w-full bg-brand disabled:bg-ink/20 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-full transition-all enabled:hover:scale-[1.02] shadow-brand flex items-center justify-center gap-2">
              {saving
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                : existing ? "Save changes" : "Add to cast"}
            </button>
          </div>
        </div>
      </div>

      {generateTarget && (
        <AvatarGenerateModal
          photoFile={generateTarget.file}
          photoPreview={generateTarget.preview}
          generateType="character"
          generationsUsed={avatarStats.characterGenerationsUsed}
          maxGenerations={avatarStats.characterGenerationsMax}
          onSuccess={handleGenerateSuccess}
          onCancel={() => setGenerateTarget(null)}
        />
      )}
    </>
  );
}

// ── Hero Edit Modal ───────────────────────────────────────────────────────────

type HeroGender = "boy" | "girl" | "non-binary" | "";

interface HeroEditModalProps {
  hero: Hero;
  avatarStats: AvatarStats;
  customAvatars: string[];
  onSave: (data: { name: string; dob: string; gender: HeroGender; avatarUrl: string | null }) => Promise<void>;
  onClose: () => void;
  onAvatarGenerated: (url: string) => void;
}

function HeroEditModal({
  hero, avatarStats, customAvatars, onSave, onClose, onAvatarGenerated,
}: HeroEditModalProps) {
  const [name, setName]             = useState(hero.name ?? "");
  const [dob, setDob]               = useState(hero.dob?.split("T")[0] ?? "");
  const [gender, setGender]         = useState<HeroGender>((hero.gender as HeroGender) ?? "");
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving]         = useState(false);

  const [generateTarget, setGenerateTarget] = useState<{ file: File; preview: string } | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  const displayedAvatar = selectedAvatar ?? hero.avatarUrl;
  const hasChange       = !!selectedAvatar;

  function clearAvatarChange() {
    setSelectedAvatar(null);
    setShowPicker(false);
  }

  function handlePhotoSelected(file: File) {
    const preview = URL.createObjectURL(file);
    setGenerateTarget({ file, preview });
    if (photoRef.current) photoRef.current.value = "";
  }

  function handleGenerateSuccess(avatarUrl: string) {
    setSelectedAvatar(avatarUrl);
    setGenerateTarget(null);
    onAvatarGenerated(avatarUrl);
    setShowPicker(false);
  }

  async function handleSubmit() {
    if (!name.trim()) return;
    setSaving(true);
    await onSave({ name: name.trim(), dob, gender, avatarUrl: selectedAvatar });
    setSaving(false);
  }

  const canSave = name.trim() && !saving;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 relative max-h-[92vh] overflow-y-auto">
          <button type="button" onClick={onClose}
            className="absolute top-5 right-5 text-ink-muted hover:text-ink transition">
            <X className="w-5 h-5" />
          </button>

          <h3 className="font-[family-name:var(--font-display)] text-ink text-2xl mb-6">Edit hero</h3>

          {/* Current / pending avatar */}
          <div className="flex flex-col items-center mb-5">
            <div className="relative">
              <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-brand/20 shadow-md bg-brand/10 flex items-center justify-center">
                {displayedAvatar
                  ? <img src={displayedAvatar} alt="avatar" className="w-full h-full object-cover" />
                  : <span className="text-3xl">🦸</span>}
              </div>
              {hasChange && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-brand rounded-full flex items-center justify-center text-white text-[10px] font-bold">✓</span>
              )}
            </div>
            <p className="text-ink-muted text-xs mt-2">
              {hasChange ? "New avatar selected" : hero.avatarUrl ? "Current avatar" : "No avatar yet"}
            </p>
            {hasChange && (
              <button type="button" onClick={clearAvatarChange}
                className="text-ink-muted hover:text-red-500 text-xs mt-1 transition">
                ✕ Keep current instead
              </button>
            )}
          </div>

          {/* Change avatar section */}
          {!showPicker && !hasChange ? (
            <button type="button" onClick={() => setShowPicker(true)}
              className="w-full text-center border border-ink/15 hover:border-brand rounded-xl py-2.5 text-ink-mid hover:text-brand text-sm font-medium transition mb-5">
              {hero.avatarUrl ? "Change avatar →" : "Choose an avatar →"}
            </button>
          ) : (showPicker || hasChange) && (
            <div className="mb-4">
              <p className="text-ink-mid text-xs font-semibold uppercase tracking-wide mb-2">
                {hero.avatarUrl ? "Change avatar" : "Choose an avatar"}
              </p>
              <AvatarPicker
                value={selectedAvatar}
                onChange={setSelectedAvatar}
                customAvatars={customAvatars}
              />

              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-ink/10" />
                <span className="text-ink-muted text-xs font-medium">or generate from photo</span>
                <div className="flex-1 h-px bg-ink/10" />
              </div>

              <input type="file" accept="image/*" ref={photoRef} className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoSelected(f); }} />

              <button type="button" onClick={() => photoRef.current?.click()}
                className="w-full flex flex-col items-center gap-2 border-2 border-dashed border-ink/20 hover:border-brand rounded-xl py-4 px-4 text-sm transition group">
                <span className="text-2xl">📸</span>
                <span className="font-semibold text-ink-mid group-hover:text-brand transition">
                  Upload a photo · get a cartoon avatar
                </span>
                <span className="text-[11px] text-ink-muted leading-relaxed text-center max-w-xs">
                  🔒 Photo is <strong>never saved</strong> — only the illustrated avatar is kept
                </span>
                {avatarStats.heroGenerationsUsed >= avatarStats.heroGenerationsMax ? (
                  <span className="text-[11px] text-amber-600 font-semibold">
                    ({avatarStats.heroGenerationsMax} hero generation limit reached · choose a preset above)
                  </span>
                ) : (
                  <span className="text-[11px] text-brand font-medium">
                    {avatarStats.heroGenerationsMax - avatarStats.heroGenerationsUsed} of {avatarStats.heroGenerationsMax} hero avatar generations remaining
                  </span>
                )}
              </button>
            </div>
          )}

          <div className="flex flex-col gap-4">
            <div>
              <label className="text-ink-mid text-sm font-medium block mb-1.5">Hero Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Your child's name"
                className="w-full px-4 py-3 rounded-xl border border-ink/15 bg-cream text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition" />
            </div>

            <div>
              <label className="text-ink-mid text-sm font-medium block mb-1.5">
                Date of Birth <span className="text-brand text-xs">*</span>
              </label>
              <input type="date" value={dob} onChange={(e) => setDob(e.target.value)}
                max={new Date().toISOString().split("T")[0]}
                className="w-full px-4 py-3 rounded-xl border border-ink/15 bg-cream text-ink focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition" />
            </div>

            <div>
              <p className="text-ink-mid text-sm font-medium mb-1.5">They are a…</p>
              <div className="flex gap-3">
                {(["Boy", "Girl", "Non-binary"] as const).map((label) => {
                  const v = (label === "Non-binary" ? "non-binary" : label.toLowerCase()) as HeroGender;
                  return (
                    <button key={label} type="button" onClick={() => setGender(v)}
                      className={cn("flex-1 py-2.5 rounded-xl border text-sm font-semibold transition",
                        gender === v
                          ? "border-brand bg-brand text-white"
                          : "border-ink/15 bg-cream text-ink-mid hover:border-brand/40")}>
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <button type="button" disabled={!canSave} onClick={handleSubmit}
              className="w-full bg-brand disabled:bg-ink/20 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-full transition-all enabled:hover:scale-[1.02] shadow-brand flex items-center justify-center gap-2">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : "Save hero"}
            </button>
          </div>
        </div>
      </div>

      {generateTarget && (
        <AvatarGenerateModal
          photoFile={generateTarget.file}
          photoPreview={generateTarget.preview}
          generateType="hero"
          generationsUsed={avatarStats.heroGenerationsUsed}
          maxGenerations={avatarStats.heroGenerationsMax}
          onSuccess={handleGenerateSuccess}
          onCancel={() => setGenerateTarget(null)}
        />
      )}
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CharactersPage() {
  const { flags } = usePublicPlatformSettings();
  const [hero, setHero]                 = useState<Hero | null>(null);
  const [showHeroEdit, setShowHeroEdit] = useState(false);
  const [characters, setCharacters]     = useState<Character[]>([]);
  const [avatarStats, setAvatarStats]   = useState<AvatarStats>(DEFAULT_STATS);
  const [economy, setEconomy]           = useState<CharacterEconomy>(DEFAULT_ECONOMY);
  const [loading, setLoading]           = useState(true);
  const [showForm, setShowForm]         = useState(false);
  const [editing, setEditing]           = useState<Character | null>(null);
  const [deleting, setDeleting]         = useState<string | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) { setLoading(false); return; }
    const h = { Authorization: `Bearer ${token}` };

    Promise.all([
      fetch(`${BASE}/heroes`,     { headers: h }).then(r => r.json()).catch(() => ({ data: [] })),
      fetch(`${BASE}/characters`, { headers: h }).then(r => r.json()).catch(() => ({ data: [] })),
      fetch(`${BASE}/avatars`,    { headers: h }).then(r => r.json()).catch(() => ({ data: null })),
      fetch(`${BASE}/characters/me/economy`, { headers: h }).then(r => r.json()).catch(() => ({ data: null })),
    ]).then(([heroRes, charRes, avatarRes, economyRes]) => {
      if (Array.isArray(heroRes.data) && heroRes.data.length > 0) setHero(heroRes.data[0] as Hero);
      if (Array.isArray(charRes.data)) setCharacters(charRes.data as Character[]);
      if (economyRes.data) setEconomy(economyRes.data as CharacterEconomy);
      if (avatarRes.data) {
        const avatarRefreshTokens = avatarRes.data.avatarRefreshTokens ?? economyRes.data?.avatarRefreshTokens ?? 0;
        setAvatarStats({
          customAvatars:            avatarRes.data.customAvatars            ?? [],
          heroGenerationsUsed:      avatarRes.data.heroGenerationsUsed      ?? 0,
          heroGenerationsMax:       avatarRes.data.heroGenerationsMax       ?? 2,
          characterGenerationsUsed: 0,
          characterGenerationsMax:  avatarRefreshTokens,
          avatarRefreshTokens,
        });
      }
    }).finally(() => setLoading(false));
  }, []);

  function handleAvatarGenerated(url: string) {
    setAvatarStats(prev => ({
      ...prev,
      customAvatars: prev.customAvatars.includes(url)
        ? prev.customAvatars
        : [url, ...prev.customAvatars],
    }));
  }

  async function handleSave(formData: {
    name: string; role: CharRole; dob: string; avatarUrl: string | null;
  }) {
    const token = getAccessToken();
    if (!token) return;

    const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    const body = JSON.stringify({
      name: formData.name,
      role: formData.role,
      ...(formData.dob && { dob: formData.dob }),
      ...(formData.avatarUrl && { avatarUrl: formData.avatarUrl }),
    });

    if (editing) {
      const res = await fetch(`${BASE}/characters/${editing.id}`, {
        method: "PATCH", headers, body,
      });
      if (res.ok) {
        const { data } = await res.json();
        setCharacters(prev => prev.map(c => c.id === editing.id ? data : c));
      }
    } else {
      const res = await fetch(`${BASE}/characters`, {
        method: "POST", headers, body,
      });
      if (res.ok) {
        const { data } = await res.json();
        setCharacters(prev => [...prev, data]);
        setEconomy(prev => ({
          ...prev,
          characterSlotsUsed: prev.characterSlotsUsed + 1,
          characterSlotsRemaining: prev.characterSlotsRemaining === null
            ? null
            : Math.max(0, prev.characterSlotsRemaining - 1),
        }));
      }
    }

    setEditing(null);
    setShowForm(false);
  }

  async function handleDelete(id: string) {
    const token = getAccessToken();
    if (!token) return;
    setDeleting(id);
    await fetch(`${BASE}/characters/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    setCharacters(prev => prev.filter(c => c.id !== id));
    setDeleting(null);
  }

  function openEdit(char: Character) {
    setEditing(char);
    setShowForm(true);
  }

  function closeForm() {
    setEditing(null);
    setShowForm(false);
  }

  async function handleHeroSave(formData: {
    name: string; dob: string; gender: HeroGender; avatarUrl: string | null;
  }) {
    const token = getAccessToken();
    if (!token || !hero) return;

    const res = await fetch(`${BASE}/heroes/${hero.id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: formData.name,
        ...(formData.dob && { dob: formData.dob }),
        ...(formData.gender && { gender: formData.gender }),
        ...(formData.avatarUrl && { avatarUrl: formData.avatarUrl }),
      }),
    });
    if (res.ok) {
      const { data } = await res.json();
      setHero(data as Hero);
    }
    setShowHeroEdit(false);
  }

  const roleEmoji = (role: CharRole | null) => ROLES.find(r => r.value === role)?.emoji ?? "⭐";
  const roleLabel = (role: CharRole | null) => ROLES.find(r => r.value === role)?.label ?? "Other";
  const heroName  = hero?.name?.trim() || "Hero";
  const heroGender = hero?.gender ?? "child";
  // Use characters.length as the source of truth for used slots (economy counter can be stale)
  const usedSlots = characters.length;
  const canAddCharacter = economy.unlimitedCharacters || usedSlots < economy.characterSlotsTotal;

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      <Navbar />

      <header className="bg-space-gradient pt-28 md:pt-32 pb-10 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <Breadcrumb crumbs={[{ label: "Cast & Characters" }]} variant="dark" className="justify-center mb-4" />
          <h1 className="font-[family-name:var(--font-display)] text-white text-4xl md:text-5xl mb-3">
            Cast & Characters
          </h1>
          <p className="text-white/60 text-lg">
            Build the people, pets, and allies that appear in your child&apos;s universe.
          </p>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto px-6 py-12 w-full">

        {/* Hero card */}
        {hero && (
          <div className="mb-10">
            <p className="text-ink-mid text-xs font-bold uppercase tracking-widest mb-3">Main Hero · always in every story</p>
            <div className="bg-white rounded-2xl shadow-card p-5 flex items-center gap-4 border-2 border-brand/15">
              <div className="w-14 h-14 rounded-full overflow-hidden bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center text-2xl flex-shrink-0">
                {hero.avatarUrl
                  ? <img src={hero.avatarUrl} alt={heroName} className="w-full h-full object-cover" />
                  : "🦸"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-[family-name:var(--font-display)] text-ink text-lg">{heroName}</p>
                <p className="text-ink-muted text-sm capitalize">
                  {heroGender}
                  {hero.dob && ` · Born ${new Date(hero.dob).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`}
                </p>
              </div>
              <button type="button" onClick={() => setShowHeroEdit(true)}
                className="flex items-center gap-1.5 text-brand text-sm font-semibold hover:underline flex-shrink-0">
                <Pencil className="w-3.5 h-3.5" /> Edit
              </button>
              {flags.ENABLE_MERCHANDISE !== false && (
                <a href={`/dashboard/merchandise/create?source=hero&heroId=${hero.id}`}
                  className="flex items-center gap-1.5 text-xs font-semibold bg-brand/10 hover:bg-brand hover:text-white text-brand px-3 py-2 rounded-full transition-all">
                  <Package className="w-3.5 h-3.5" />
                  Merchandise
                </a>
              )}
            </div>
          </div>
        )}

        {/* Supporting cast header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <p className="text-ink-mid text-xs font-bold uppercase tracking-widest mb-1">Supporting Cast</p>
            <h2 className="font-[family-name:var(--font-display)] text-ink text-2xl">
              {characters.length > 0
                ? `${characters.length} character${characters.length === 1 ? "" : "s"} in your universe`
                : "No characters yet"}
            </h2>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-white border border-ink/10 px-3 py-1 text-ink-mid font-semibold">
                Characters Used: {usedSlots} / {economy.unlimitedCharacters ? "Unlimited" : economy.characterSlotsTotal}
              </span>
              <span className="rounded-full bg-white border border-ink/10 px-3 py-1 text-ink-mid font-semibold">
                {economy.avatarRefreshTokens} Avatar Refresh{economy.avatarRefreshTokens !== 1 ? "es" : ""} remaining
              </span>
            </div>
          </div>
          <button type="button" disabled={!canAddCharacter} onClick={() => { setEditing(null); setShowForm(true); }}
            className="flex items-center gap-2 bg-brand hover:bg-brand-dark disabled:bg-ink/20 disabled:cursor-not-allowed text-white font-bold px-5 py-2.5 rounded-full text-sm transition-all enabled:hover:scale-105 shadow-brand">
            <Plus className="w-4 h-4" /> Add Character
          </button>
        </div>

        {!canAddCharacter && (
          <div className="mb-6 rounded-2xl border border-gold/30 bg-gold/10 px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1">
              <p className="font-bold text-ink">Need another family member?</p>
              <p className="text-ink-muted text-sm">Buy Character Slots to add more heroes, friends, pets, or relatives.</p>
            </div>
            <a href="/dashboard#credits" className="bg-brand hover:bg-brand-dark text-white font-bold px-5 py-2.5 rounded-full text-sm text-center transition">
              Buy Character Slots
            </a>
          </div>
        )}

        {economy.avatarRefreshTokens < 1 && characters.length > 0 && (
          <div className="mb-6 rounded-2xl border border-brand/20 bg-brand/5 px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1">
              <p className="font-bold text-ink">Want a fresh look?</p>
              <p className="text-ink-muted text-sm">Buy an Avatar Refresh Pack to try new illustrated looks.</p>
            </div>
            <a href="/dashboard#credits" className="border border-brand text-brand hover:bg-brand hover:text-white font-bold px-5 py-2.5 rounded-full text-sm text-center transition">
              Buy Avatar Refresh Pack
            </a>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 text-brand animate-spin" />
          </div>
        ) : characters.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">👥</div>
            <p className="font-[family-name:var(--font-display)] text-ink text-2xl mb-2">Your cast is empty</p>
            <p className="text-ink-muted text-base mb-8 max-w-sm mx-auto">
              Add friends, siblings, pets, or any character that might join your child&apos;s adventures.
            </p>
            <button type="button" disabled={!canAddCharacter} onClick={() => { setEditing(null); setShowForm(true); }}
              className="bg-brand hover:bg-brand-dark disabled:bg-ink/20 disabled:cursor-not-allowed text-white font-bold px-8 py-3 rounded-full text-base shadow-brand transition-all enabled:hover:scale-105">
              Add First Character
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {characters.map((char) => (
              <div key={char.id} className="bg-white rounded-2xl shadow-card p-5 flex flex-col items-center text-center relative group">
                <div className="w-16 h-16 rounded-full overflow-hidden bg-brand-50 flex items-center justify-center mb-3 flex-shrink-0">
                  {char.avatarUrl
                    ? <img src={char.avatarUrl} alt={char.name?.trim() || "Character"} className="w-full h-full object-cover" />
                    : <span className="text-3xl">{roleEmoji(char.role)}</span>}
                </div>

                <p className="font-[family-name:var(--font-display)] text-ink text-sm leading-tight mb-0.5">
                  {char.name?.trim() || "Character"}
                </p>
                <p className="text-ink-muted text-xs">{roleEmoji(char.role)} {roleLabel(char.role)}</p>
                {char.dob && (
                  <p className="text-ink-muted text-[10px] mt-1">
                    🎂 {new Date(char.dob).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </p>
                )}

                <div className="flex gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button type="button" onClick={() => openEdit(char)}
                    className="p-1.5 rounded-full bg-brand/10 hover:bg-brand hover:text-white text-brand transition-all">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" onClick={() => handleDelete(char.id)}
                    disabled={deleting === char.id}
                    className="p-1.5 rounded-full bg-red-50 hover:bg-red-500 hover:text-white text-red-400 transition-all disabled:opacity-50">
                    {deleting === char.id
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            ))}

            <button type="button" disabled={!canAddCharacter} onClick={() => { setEditing(null); setShowForm(true); }}
              className="bg-white border-2 border-dashed border-ink/15 hover:border-brand disabled:opacity-50 disabled:cursor-not-allowed rounded-2xl p-5 flex flex-col items-center text-center gap-3 transition-all group hover:shadow-card">
              <div className="w-16 h-16 rounded-full bg-ink/5 group-hover:bg-brand-50 flex items-center justify-center transition-colors">
                <Plus className="w-7 h-7 text-ink/30 group-hover:text-brand transition-colors" />
              </div>
              <p className="text-ink-mid text-sm font-semibold group-hover:text-brand transition-colors">Add character</p>
            </button>
          </div>
        )}

        {characters.length > 0 && (
          <div className="mt-12 text-center">
            <a href="/create"
              className="inline-block bg-brand hover:bg-brand-dark text-white font-bold px-10 py-3.5 rounded-full shadow-brand transition-all hover:scale-105 text-base">
              Create a New Episode →
            </a>
            <p className="text-ink-muted text-xs mt-3">Pick which characters join in the episode creation flow</p>
          </div>
        )}
      </main>

      <Footer />

      {showForm && (
        <CharacterFormModal
          existing={editing}
          avatarStats={avatarStats}
          customAvatars={avatarStats.customAvatars}
          onSave={handleSave}
          onClose={closeForm}
          onAvatarGenerated={(url) => {
            handleAvatarGenerated(url);
            setAvatarStats(prev => ({
              ...prev,
              characterGenerationsUsed: prev.characterGenerationsUsed + 1,
              avatarRefreshTokens: Math.max(0, prev.avatarRefreshTokens - 1),
            }));
            setEconomy(prev => ({
              ...prev,
              avatarRefreshTokens: Math.max(0, prev.avatarRefreshTokens - 1),
            }));
          }}
        />
      )}

      {showHeroEdit && hero && (
        <HeroEditModal
          hero={hero}
          avatarStats={avatarStats}
          customAvatars={avatarStats.customAvatars}
          onSave={handleHeroSave}
          onClose={() => setShowHeroEdit(false)}
          onAvatarGenerated={(url) => {
            handleAvatarGenerated(url);
            setAvatarStats(prev => ({
              ...prev,
              heroGenerationsUsed: prev.heroGenerationsUsed + 1,
            }));
          }}
        />
      )}
    </div>
  );
}
