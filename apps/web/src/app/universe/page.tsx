"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Zap, Target, Clock, BookOpen, Trophy, Loader2, ChevronRight, Sword, Pencil, Check, X, Package } from "lucide-react";

import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { getAccessToken } from "@/lib/api";
import { usePublicPlatformSettings } from "@/lib/platform-settings";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Memory {
  id: string;
  type: string;
  title: string;
  detail: string | null;
  storyId: string | null;
  createdAt: string;
}

interface Quest {
  id: string;
  title: string;
  description: string | null;
  status: "open" | "in_progress" | "completed";
  createdAt: string;
}

interface Power {
  id: string;
  name: string;
  emoji: string | null;
  description: string | null;
  createdAt: string;
}

interface Arc {
  id: string;
  title: string;
  summary: string | null;
  status: "active" | "completed";
}

interface Episode {
  id: string;
  title: string | null;
  theme: string;
  status: string;
  coverImageUrl: string | null;
  createdAt: string;
}

interface Universe {
  id: string;
  name: string;
  heroTitle: string | null;
  tagline: string | null;
  memories: Memory[];
  quests: Quest[];
  powers: Power[];
  arcs: Arc[];
}

// ── Memory type display ───────────────────────────────────────────────────────

const MEMORY_META: Record<string, { emoji: string; color: string; label: string }> = {
  character_met:        { emoji: "🤝", color: "bg-blue-50 border-blue-200 text-blue-700",   label: "Character Met" },
  villain_defeated:     { emoji: "⚔️", color: "bg-red-50 border-red-200 text-red-700",       label: "Villain Defeated" },
  power_earned:         { emoji: "⚡", color: "bg-yellow-50 border-yellow-200 text-yellow-700", label: "Power Earned" },
  item_found:           { emoji: "💎", color: "bg-purple-50 border-purple-200 text-purple-700", label: "Item Found" },
  location_discovered:  { emoji: "🗺️", color: "bg-green-50 border-green-200 text-green-700",  label: "Location Discovered" },
  quest_opened:         { emoji: "📜", color: "bg-orange-50 border-orange-200 text-orange-700", label: "Quest Opened" },
  quest_completed:      { emoji: "✅", color: "bg-emerald-50 border-emerald-200 text-emerald-700", label: "Quest Completed" },
  achievement_unlocked: { emoji: "🏆", color: "bg-gold-light/30 border-gold/30 text-ink",    label: "Achievement" },
};

const EPISODES_PER_PAGE = 8;

// ── Page ──────────────────────────────────────────────────────────────────────

export default function UniversePage() {
  const { user, loading: authLoading } = useAuth();
  const { flags } = usePublicPlatformSettings();
  const router = useRouter();

  const [universes, setUniverses]     = useState<Universe[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [episodes, setEpisodes]       = useState<Episode[]>([]);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const [loading, setLoading]         = useState(true);
  const [episodePage, setEpisodePage] = useState(0);
  const [activeTab, setActiveTab]     = useState<"episodes" | "timeline" | "quests" | "powers" | "arcs" | "villains">("episodes");
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft]   = useState("");
  const [savingTitle, setSavingTitle] = useState(false);
  const titleInputRef                 = useRef<HTMLInputElement>(null);

  const universe = universes[selectedIdx] ?? null;

  // Fetch episodes whenever the selected universe changes
  useEffect(() => {
    if (!universe) return;
    const token = getAccessToken();
    if (!token) return;
    setEpisodesLoading(true);
    setEpisodePage(0);
    fetch(`${BASE}/stories?universeId=${universe.id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        if (res.ok) {
          const { data } = await res.json();
          setEpisodes((data as Episode[]).filter(e => e.status === "completed"));
        }
      })
      .catch(() => {})
      .finally(() => setEpisodesLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [universe?.id]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push("/login"); return; }

    const token = getAccessToken();
    if (!token) return;

    const h = { Authorization: `Bearer ${token}` };
    fetch(`${BASE}/universes/mine`, { headers: h })
      .then(async (uRes) => {
        if (uRes.status === 404) { router.push("/onboarding"); return; }
        if (!uRes.ok) return;
        const { data } = await uRes.json();
        const list = (Array.isArray(data) ? data : [data]) as Universe[];
        if (list.length === 0) { router.push("/onboarding"); return; }
        setUniverses(list);
        setSelectedIdx(0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user, authLoading, router]);

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-space-gradient flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    );
  }

  if (!universe) return null;

  const pagedEpisodes = episodes.slice(episodePage * EPISODES_PER_PAGE, (episodePage + 1) * EPISODES_PER_PAGE);
  const totalEpisodePages = Math.ceil(episodes.length / EPISODES_PER_PAGE);

  async function saveHeroTitle() {
    if (!universe || !titleDraft.trim()) return;
    setSavingTitle(true);
    const token = getAccessToken();
    try {
      const res = await fetch(`${BASE}/universes/${universe.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ heroTitle: titleDraft.trim() }),
      });
      if (res.ok) {
        setUniverses((prev) => prev.map((u, i) => i === selectedIdx ? { ...u, heroTitle: titleDraft.trim() } : u));
        setEditingTitle(false);
      }
    } finally {
      setSavingTitle(false);
    }
  }

  const quests   = universe.quests   ?? [];
  const memories = universe.memories ?? [];
  const powers   = universe.powers   ?? [];
  const arcs     = universe.arcs     ?? [];

  const openQuests      = quests.filter((q) => q.status !== "completed");
  const completedQuests = quests.filter((q) => q.status === "completed");
  const heroName = universe.heroTitle ?? universe.name.replace(" Universe", "").replace(" Chronicles", "").trim();

  const villains = memories.filter((m) => m.type === "villain_defeated");
  // Map storyId → episode title for villain/timeline cross-referencing
  const storyTitleMap = Object.fromEntries(episodes.map((e) => [e.id, e.title ?? "Untitled Episode"]));

  const tabs = [
    { id: "episodes" as const, label: "Episodes",  icon: <BookOpen className="w-4 h-4" />, count: episodes.length },
    { id: "timeline" as const, label: "Timeline",  icon: <Clock className="w-4 h-4" />,    count: memories.length },
    { id: "quests"   as const, label: "Quests",    icon: <Target className="w-4 h-4" />,   count: openQuests.length },
    { id: "powers"   as const, label: "Powers",    icon: <Zap className="w-4 h-4" />,      count: powers.length },
    { id: "villains" as const, label: "Villains",  icon: <Sword className="w-4 h-4" />,    count: villains.length },
    { id: "arcs"     as const, label: "Story Arcs",icon: <Trophy className="w-4 h-4" />,   count: arcs.length },
  ];

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      <Navbar />

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="bg-page-header pt-28 md:pt-32 pb-10 px-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-gold/5 rounded-full blur-2xl pointer-events-none" />

        <div className="relative max-w-5xl mx-auto">
          <p className="text-gold text-xs font-bold tracking-widest uppercase mb-3">LIVING UNIVERSE</p>

          {/* Universe switcher — only when there are multiple */}
          {universes.length > 1 && (
            <div className="flex gap-2 flex-wrap mb-4">
              {universes.map((u, i) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => { setSelectedIdx(i); setActiveTab("episodes"); }}
                  className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all border ${
                    i === selectedIdx
                      ? "bg-gold text-ink border-gold"
                      : "bg-white/10 text-white/70 border-white/20 hover:bg-white/20 hover:text-white"
                  }`}
                >
                  {u.name}
                </button>
              ))}
            </div>
          )}

          <h1 className="font-[family-name:var(--font-display)] text-white text-4xl md:text-5xl mb-2">
            {universe.name}
          </h1>
          {universe.tagline && (
            <p className="text-white/50 text-base italic mb-2">{universe.tagline}</p>
          )}

          {/* Hero title — inline editable */}
          <div className="flex items-center gap-2 mb-4">
            {editingTitle ? (
              <>
                <input
                  ref={titleInputRef}
                  type="text"
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void saveHeroTitle(); if (e.key === "Escape") setEditingTitle(false); }}
                  className="bg-white/10 border border-white/30 text-white rounded-lg px-3 py-1 text-sm font-semibold focus:outline-none focus:border-gold"
                  placeholder="Hero title (e.g. Captain Siddhant)"
                  autoFocus
                />
                <button type="button" onClick={() => void saveHeroTitle()} disabled={savingTitle}
                  className="text-gold hover:text-white transition p-1">
                  {savingTitle ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                </button>
                <button type="button" onClick={() => setEditingTitle(false)} className="text-white/40 hover:text-white transition p-1">
                  <X className="w-4 h-4" />
                </button>
              </>
            ) : (
              <button type="button"
                onClick={() => { setTitleDraft(universe.heroTitle ?? ""); setEditingTitle(true); }}
                className="flex items-center gap-2 text-white/60 hover:text-gold transition group">
                <span className="text-sm font-semibold">
                  {universe.heroTitle ? `🦸 ${universe.heroTitle}` : "＋ Add hero title (e.g. Captain Siddhant)"}
                </span>
                <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-100 transition" />
              </button>
            )}
          </div>

          {/* Quick stats */}
          <div className="flex flex-wrap gap-4 mt-6">
            {[
              { icon: "⚡", value: powers.length,   label: "Powers" },
              { icon: "📜", value: openQuests.length,        label: "Open Quests" },
              { icon: "🌟", value: memories.length, label: "Memories" },
              { icon: "⚔️", value: memories.filter(m => m.type === "villain_defeated").length, label: "Villains Defeated" },
            ].map((s) => (
              <div key={s.label} className="bg-white/8 border border-white/10 rounded-2xl px-5 py-3 text-center min-w-[80px]">
                <p className="text-lg">{s.icon}</p>
                <p className="font-[family-name:var(--font-display)] text-white text-xl">{s.value}</p>
                <p className="text-white/40 text-xs">{s.label}</p>
              </div>
            ))}
            <a href="/characters"
              className="bg-white/8 border border-white/10 hover:bg-white/15 hover:border-white/20 rounded-2xl px-5 py-3 text-center min-w-[80px] transition-colors">
              <p className="text-lg">👥</p>
              <p className="font-[family-name:var(--font-display)] text-white text-xl">Cast</p>
              <p className="text-white/40 text-xs">Manage →</p>
            </a>
            {flags.ENABLE_MERCHANDISE !== false && (
              <a href={`/dashboard/merchandise/create?source=universe&universeId=${universe.id}`}
                className="bg-white/8 border border-white/10 hover:bg-white/15 hover:border-white/20 rounded-2xl px-5 py-3 text-center min-w-[80px] transition-colors">
                <div className="text-lg flex justify-center">
                  <Package className="w-5 h-5 text-white" />
                </div>
                <p className="font-[family-name:var(--font-display)] text-white text-xl">Merch</p>
                <p className="text-white/40 text-xs">Create →</p>
              </a>
            )}
          </div>
        </div>
      </header>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-cream border-b border-ink/10 shadow-sm">
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex gap-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {tabs.map((tab) => (
              <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-4 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? "border-brand text-brand"
                    : "border-transparent text-ink-muted hover:text-ink"
                }`}>
                {tab.icon} {tab.label}
                {tab.count > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    activeTab === tab.id ? "bg-brand text-white" : "bg-ink/10 text-ink-muted"
                  }`}>{tab.count}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-5xl mx-auto px-6 py-10 w-full">

        {/* ── Episodes ──────────────────────────────────────────────────── */}
        {activeTab === "episodes" && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-[family-name:var(--font-display)] text-ink text-2xl">Episodes</h2>
              <a href={`/create?universeId=${universe.id}`}
                className="bg-brand text-white text-sm font-bold px-5 py-2.5 rounded-full hover:bg-brand-dark transition-all hover:scale-105">
                + Create Episode
              </a>
            </div>
            {episodesLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-7 h-7 text-brand animate-spin" />
              </div>
            ) : episodes.length === 0 ? (
              <EmptyState icon="📖" title="No episodes yet"
                body="Your first episode will appear here once it's generated. Hit 'Create Episode' to begin the adventure!"
                universeId={universe.id} />
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {pagedEpisodes.map((ep) => (
                    <a key={ep.id} href={`/stories/${ep.id}`}
                      className="group bg-white rounded-2xl shadow-card overflow-hidden hover:shadow-lg transition-all hover:-translate-y-0.5">
                      {ep.coverImageUrl ? (
                        <img src={ep.coverImageUrl} alt={ep.title ?? "Episode cover"}
                          className="w-full h-40 object-cover group-hover:scale-[1.02] transition-transform duration-300" />
                      ) : (
                        <div className="w-full h-40 bg-gradient-to-br from-space via-brand/40 to-space flex items-center justify-center">
                          <span className="text-5xl opacity-60">🌌</span>
                        </div>
                      )}
                      <div className="p-5">
                        <p className="font-[family-name:var(--font-display)] text-ink text-lg leading-snug line-clamp-2">
                          {ep.title ?? "Untitled Episode"}
                        </p>
                        <div className="flex items-center justify-between mt-3">
                          <span className="text-xs text-ink-muted capitalize">{(ep.theme ?? "freeform").replace(/-/g, " ")}</span>
                          <span className="text-brand text-xs font-semibold group-hover:underline">Read →</span>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>

                {/* Pagination */}
                {totalEpisodePages > 1 && (
                  <div className="flex items-center justify-between mt-8 pt-6 border-t border-ink/10">
                    <button
                      type="button"
                      disabled={episodePage === 0}
                      onClick={() => setEpisodePage((p) => p - 1)}
                      className="px-4 py-2 rounded-full text-sm font-semibold border border-ink/15 text-ink-muted hover:text-ink hover:border-ink/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      ← Previous
                    </button>
                    <p className="text-sm text-ink-muted">
                      Page {episodePage + 1} of {totalEpisodePages} &middot; {episodes.length} episodes
                    </p>
                    <button
                      type="button"
                      disabled={episodePage >= totalEpisodePages - 1}
                      onClick={() => setEpisodePage((p) => p + 1)}
                      className="px-4 py-2 rounded-full text-sm font-semibold border border-ink/15 text-ink-muted hover:text-ink hover:border-ink/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      Next →
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Timeline ──────────────────────────────────────────────────── */}
        {activeTab === "timeline" && (
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-ink text-2xl mb-6">
              {heroName}&apos;s Journey
            </h2>
            {memories.length === 0 ? (
              <EmptyState icon="🌌" title="The adventure hasn't started yet"
                body="Generate your first episode and the timeline will fill with memories, discoveries, and victories."
                universeId={universe.id} />
            ) : (
              <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-ink/10" />
                <div className="flex flex-col gap-4">
                  {memories.map((memory, i) => {
                    const meta = MEMORY_META[memory.type] ?? { emoji: "✨", color: "bg-brand-50 border-brand/20 text-brand", label: memory.type };
                    return (
                      <div key={memory.id} className="flex gap-5 items-start">
                        {/* Node */}
                        <div className="w-10 h-10 rounded-full bg-white border-2 border-ink/15 flex items-center justify-center flex-shrink-0 z-10 text-lg shadow-sm">
                          {meta.emoji}
                        </div>
                        {/* Card */}
                        <div className={`flex-1 border rounded-2xl px-5 py-4 ${meta.color}`}>
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-semibold text-sm leading-snug">{memory.title}</p>
                            <span className="text-xs opacity-60 whitespace-nowrap mt-0.5">
                              {new Date(memory.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                            </span>
                          </div>
                          {memory.detail && (
                            <p className="text-xs mt-1 opacity-70 leading-relaxed">{memory.detail}</p>
                          )}
                          <div className="flex items-center gap-3 mt-2 flex-wrap">
                            <span className="text-xs font-semibold opacity-60 uppercase tracking-wide">{meta.label}</span>
                            {memory.storyId && storyTitleMap[memory.storyId] && (
                              <a href={`/stories/${memory.storyId}`}
                                className="text-xs opacity-70 hover:opacity-100 underline underline-offset-2 transition-opacity line-clamp-1">
                                📖 {storyTitleMap[memory.storyId]}
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Quests ────────────────────────────────────────────────────── */}
        {activeTab === "quests" && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-[family-name:var(--font-display)] text-ink text-2xl">Open Quests</h2>
              <a href={`/create?universeId=${universe.id}`}
                className="text-brand text-sm font-semibold hover:underline">
                Continue a quest →
              </a>
            </div>
            {openQuests.length === 0 ? (
              <EmptyState icon="🗺️" title="No open quests yet"
                body="Quests are created when stories leave things unresolved. Generate an episode and see what your hero must do next."
                universeId={universe.id} />
            ) : (
              <div className="grid gap-4">
                {openQuests.map((quest) => (
                  <div key={quest.id} className="bg-white rounded-2xl shadow-card p-6 flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0 text-xl">
                      📜
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-[family-name:var(--font-display)] text-ink text-lg">{quest.title}</p>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          quest.status === "open" ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"
                        }`}>
                          {quest.status === "open" ? "Open" : "In Progress"}
                        </span>
                      </div>
                      {quest.description && (
                        <p className="text-ink-muted text-sm mt-1">{quest.description}</p>
                      )}
                      <a href={`/create?universeId=${universe.id}`}
                        className="inline-flex items-center gap-1 text-brand text-xs font-semibold mt-3 hover:underline">
                        Create episode to continue <ChevronRight className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {completedQuests.length > 0 && (
              <div className="mt-10">
                <h3 className="font-[family-name:var(--font-display)] text-ink-mid text-lg mb-4 flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-gold" /> Completed Quests
                </h3>
                <div className="grid gap-3">
                  {completedQuests.map((quest) => (
                    <div key={quest.id} className="bg-white rounded-2xl p-5 flex items-center gap-4 opacity-70">
                      <span className="text-xl">✅</span>
                      <p className="text-ink-mid text-sm line-through">{quest.title}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Powers ────────────────────────────────────────────────────── */}
        {activeTab === "powers" && (
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-ink text-2xl mb-2">Powers & Items</h2>
            <p className="text-ink-muted text-sm mb-8">Earned through adventures. Available in every future episode.</p>
            {powers.length === 0 ? (
              <EmptyState icon="⚡" title="No powers earned yet"
                body="Powers and magical items are earned through adventures. Generate episodes and watch your hero grow stronger."
                universeId={universe.id} />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {powers.map((power) => (
                  <div key={power.id} className="bg-white rounded-2xl shadow-card p-6 flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gold-light/30 border border-gold/20 flex items-center justify-center text-2xl flex-shrink-0">
                      {power.emoji ?? "✨"}
                    </div>
                    <div>
                      <p className="font-[family-name:var(--font-display)] text-ink text-lg">{power.name}</p>
                      {power.description && (
                        <p className="text-ink-muted text-sm mt-1">{power.description}</p>
                      )}
                      <p className="text-ink-muted text-xs mt-2">
                        Earned {new Date(power.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Villains ──────────────────────────────────────────────────── */}
        {activeTab === "villains" && (
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-ink text-2xl mb-2">Villains Defeated</h2>
            <p className="text-ink-muted text-sm mb-8">Every villain {heroName} has outsmarted, calmed, or overcome.</p>
            {villains.length === 0 ? (
              <EmptyState icon="⚔️" title="No villains yet"
                body="Villains appear when your hero faces challenges. Generate an episode and see who dares to stand in the way!"
                universeId={universe.id} />
            ) : (
              <div className="grid gap-5">
                {villains.map((v) => {
                  const storyTitle = v.storyId ? storyTitleMap[v.storyId] : null;
                  return (
                    <div key={v.id} className="bg-white rounded-2xl shadow-card overflow-hidden flex">
                      {/* Red accent bar */}
                      <div className="w-1.5 bg-gradient-to-b from-red-400 to-red-700 flex-shrink-0" />
                      <div className="p-6 flex-1">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center text-2xl flex-shrink-0">
                              ⚔️
                            </div>
                            <div>
                              <p className="font-[family-name:var(--font-display)] text-ink text-lg leading-tight">{v.title}</p>
                              <span className="inline-block bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full mt-1">
                                ✓ Defeated
                              </span>
                            </div>
                          </div>
                          <span className="text-xs text-ink-muted whitespace-nowrap flex-shrink-0">
                            {new Date(v.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                          </span>
                        </div>
                        {v.detail && (
                          <p className="text-ink-muted text-sm mt-4 leading-relaxed italic border-l-2 border-red-200 pl-3">
                            &ldquo;{v.detail}&rdquo;
                          </p>
                        )}
                        {storyTitle && v.storyId && (
                          <a href={`/stories/${v.storyId}`}
                            className="inline-flex items-center gap-1.5 mt-4 bg-ink/5 hover:bg-brand/10 text-ink-mid hover:text-brand text-xs font-semibold px-3 py-1.5 rounded-full transition-all">
                            <BookOpen className="w-3 h-3" />
                            From: {storyTitle}
                            <ChevronRight className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Story Arcs ────────────────────────────────────────────────── */}
        {activeTab === "arcs" && (
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-ink text-2xl mb-2">Story Arcs</h2>
            <p className="text-ink-muted text-sm mb-8">Multi-episode adventures with a shared mission.</p>
            {arcs.length === 0 ? (
              <EmptyState icon="📖" title="No story arcs yet"
                body='Choose "New Story Arc" when creating an episode to start a multi-part adventure.'
                universeId={universe.id} />
            ) : (
              <div className="grid gap-4">
                {arcs.map((arc) => (
                  <div key={arc.id} className="bg-white rounded-2xl shadow-card p-6">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl">{arc.status === "active" ? "🔥" : "✅"}</span>
                      <div>
                        <p className="font-[family-name:var(--font-display)] text-ink text-lg">{arc.title}</p>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          arc.status === "active" ? "bg-orange-100 text-orange-700" : "bg-green-100 text-green-700"
                        }`}>
                          {arc.status === "active" ? "Active" : "Completed"}
                        </span>
                      </div>
                    </div>
                    {arc.summary && <p className="text-ink-muted text-sm mt-2">{arc.summary}</p>}
                    {arc.status === "active" && (
                      <a href={`/create?universeId=${universe.id}`}
                        className="inline-flex items-center gap-1 text-brand text-xs font-semibold mt-4 hover:underline">
                        Continue this arc <ChevronRight className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

function EmptyState({ icon, title, body, universeId }: { icon: string; title: string; body: string; universeId?: string }) {
  return (
    <div className="flex flex-col items-center text-center py-16 bg-white rounded-3xl shadow-card">
      <p className="text-6xl mb-4">{icon}</p>
      <h3 className="font-[family-name:var(--font-display)] text-ink text-xl mb-2">{title}</h3>
      <p className="text-ink-muted text-sm max-w-xs">{body}</p>
      <a href={universeId ? `/create?universeId=${universeId}` : "/create"}
        className="mt-6 bg-brand text-white font-bold px-6 py-3 rounded-full hover:bg-brand-dark transition-all hover:scale-105 text-sm">
        Create Episode →
      </a>
    </div>
  );
}
