"use client";

import {
  BookOpen, ChevronRight, Clock, Globe, Loader2, Package, Plus, RefreshCw, ShoppingCart, Target,
  Trash2, Users, X, Zap, AlertCircle, Share2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import Footer from "@/components/layout/Footer";
import Navbar from "@/components/layout/Navbar";
import BuyCreditsSection from "@/components/shared/BuyCreditsSection";
import { useAuth } from "@/contexts/AuthContext";
import { getAccessToken } from "@/lib/api";
import { usePublicPlatformSettings } from "@/lib/platform-settings";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";
const TERMINAL = new Set(["completed", "failed"]);

// ── Types ─────────────────────────────────────────────────────────────────────

interface Story {
  id: string;
  title: string | null;
  theme: string | null;
  status: string;
  coverImageUrl: string | null;
  pdfUrl: string | null;
  cliffhanger?: string | null;
  createdAt: string;
  universeId: string | null;
  hero: { name: string } | null;
}

interface Universe {
  id: string;
  name: string;
  heroTitle: string | null;
  tagline: string | null;
  powers: { id: string; name: string; emoji: string | null }[];
  quests: { id: string; title: string; status: string }[];
}

interface GenerationJob {
  id: string;
  storyId: string;
  universeId: string | null;
  status: string;
  currentStep: string | null;
  progressPercentage: number;
  errorMessage: string | null;
  createdAt: string;
}

// ── Theme meta ────────────────────────────────────────────────────────────────

const THEME_META: Record<string, { emoji: string; label: string; gradient: string }> = {
  "space-adventure":      { emoji: "🚀", label: "Space Adventure",      gradient: "from-indigo-950 to-purple-900" },
  "superhero-mission":    { emoji: "⚡", label: "Superhero Mission",    gradient: "from-red-950 to-orange-900"   },
  "jungle-quest":         { emoji: "🌿", label: "Jungle Quest",         gradient: "from-green-950 to-emerald-800" },
  "underwater-adventure": { emoji: "🌊", label: "Underwater Adventure", gradient: "from-blue-950 to-cyan-900"   },
  "detective-mystery":    { emoji: "🔍", label: "Detective Mystery",    gradient: "from-gray-900 to-slate-800"   },
  "birthday-adventure":   { emoji: "🎂", label: "Birthday Adventure",   gradient: "from-pink-950 to-rose-900"   },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function EpisodeCard({ story, onDelete }: { story: Story; onDelete: (id: string) => void }) {
  const meta = (story.theme ? THEME_META[story.theme] : null) ?? { emoji: "✏️", label: "Freeform", gradient: "from-brand to-brand-dark" };
  const isReady = story.status === "completed";
  const [confirming, setConfirming] = useState(false);
  const [copied, setCopied] = useState(false);

  function handleShare(e: React.MouseEvent) {
    e.preventDefault();
    navigator.clipboard.writeText(`${window.location.origin}/stories/${story.id}/share`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="bg-white rounded-2xl shadow-card overflow-hidden flex flex-col group">
      <div className={`aspect-[4/3] bg-gradient-to-br ${meta.gradient} flex items-center justify-center relative overflow-hidden`}>
        {story.coverImageUrl ? (
          <img src={story.coverImageUrl} alt={story.title ?? "Episode"} className="w-full h-full object-cover" />
        ) : (
          <span className="text-6xl">{meta.emoji}</span>
        )}
        <div className="absolute top-3 right-3">
          {isReady
            ? <span className="bg-green-100 text-green-700 text-xs font-semibold px-2.5 py-0.5 rounded-full">✓ Ready</span>
            : story.status === "failed"
            ? <span className="bg-red-100 text-red-600 text-xs font-semibold px-2.5 py-0.5 rounded-full">✗ Failed</span>
            : <span className="bg-gold-light/50 text-gold-dark text-xs font-semibold px-2.5 py-0.5 rounded-full animate-pulse">⏳ Generating…</span>
          }
        </div>
        {isReady && (
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
            <a href={`/stories/${story.id}`} className="bg-white text-ink font-bold text-sm px-5 py-2 rounded-full hover:bg-gold hover:text-white transition">
              ▶ Read Episode
            </a>
          </div>
        )}
      </div>
      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-[family-name:var(--font-display)] text-ink text-base mb-1 line-clamp-1">
          {story.title ?? (isReady ? "Untitled Episode" : "Generating…")}
        </h3>
        <span className="bg-brand-50 text-brand text-xs font-semibold px-2 py-0.5 rounded-full w-fit mb-3">
          {meta.emoji} {meta.label}
        </span>
        {story.cliffhanger && (
          <p className="text-ink-muted text-xs italic line-clamp-2 mb-3 border-l-2 border-gold/40 pl-2">{story.cliffhanger}</p>
        )}
        <div className="mt-auto flex items-center gap-2 flex-wrap">
          {isReady && (
            <button type="button" onClick={handleShare}
              className="flex items-center gap-1 text-xs font-semibold bg-ink/5 hover:bg-brand hover:text-white text-ink-mid px-3 py-1.5 rounded-full transition-all">
              <Share2 className="w-3 h-3" />
              {copied ? "Copied!" : "Share"}
            </button>
          )}
          {story.status === "failed" && (
            <a href="/create" className="text-brand text-xs underline">Retry →</a>
          )}
          {!isReady && story.status !== "failed" && (
            <a href={`/stories/${story.id}`} className="text-brand text-xs underline">View progress →</a>
          )}
          <div className="ml-auto">
            {confirming ? (
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => onDelete(story.id)} className="text-xs text-red-600 font-semibold hover:underline">Confirm</button>
                <span className="text-ink-muted text-xs">/</span>
                <button type="button" onClick={() => setConfirming(false)} className="text-xs text-ink-muted hover:text-ink">Cancel</button>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirming(true)} className="text-ink-muted hover:text-red-500 transition p-1 rounded-lg hover:bg-red-50">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl shadow-card overflow-hidden animate-pulse">
      <div className="aspect-[4/3] bg-ink/10" />
      <div className="p-4 space-y-2">
        <div className="h-3 bg-ink/10 rounded w-3/4" />
        <div className="h-2 bg-ink/10 rounded w-1/3" />
      </div>
    </div>
  );
}

function InProgressSection({ jobs, stories }: { jobs: GenerationJob[]; stories: Story[] }) {
  const activeJobs = jobs.filter((j) => !TERMINAL.has(j.status));
  if (activeJobs.length === 0) return null;

  return (
    <div className="mb-10">
      <h2 className="font-[family-name:var(--font-display)] text-ink text-xl mb-4 flex items-center gap-2">
        <Loader2 className="w-5 h-5 text-brand animate-spin" /> In Progress
      </h2>
      <div className="flex flex-col gap-3">
        {activeJobs.map((job) => {
          const story = stories.find((s) => s.id === job.storyId);
          return (
            <div key={job.id} className="bg-white rounded-2xl shadow-card p-5 flex items-center gap-5">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-[family-name:var(--font-display)] text-ink text-base line-clamp-1">
                    {story?.title ?? "Generating your story…"}
                  </span>
                  {job.universeId === null && (
                    <span className="bg-ink/5 text-ink-muted text-xs px-2 py-0.5 rounded-full flex-shrink-0">Standalone</span>
                  )}
                </div>
                <p className="text-ink-muted text-sm mb-3">{job.currentStep ?? "Preparing…"}</p>
                <div className="w-full bg-ink/10 rounded-full h-2">
                  <div
                    className="bg-brand h-2 rounded-full transition-all duration-500"
                    style={{ width: `${job.progressPercentage}%` }}
                  />
                </div>
                <p className="text-ink-muted text-xs mt-1">{job.progressPercentage}% complete</p>
              </div>
              <a href={`/stories/${job.storyId}`}
                className="flex-shrink-0 text-brand text-sm font-semibold hover:underline flex items-center gap-1">
                View <ChevronRight className="w-4 h-4" />
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FailedJobsBanner({ jobs }: { jobs: GenerationJob[] }) {
  const [dismissed, setDismissed] = useState(false);
  const failedUnread = jobs.filter((j) => j.status === "failed");
  if (failedUnread.length === 0 || dismissed) return null;
  return (
    <div className="mb-6 bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
      <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-red-700 font-semibold text-sm">
          {failedUnread.length} story generation{failedUnread.length > 1 ? "s" : ""} failed
        </p>
        <p className="text-red-600 text-xs mt-0.5">Credits have been automatically refunded. <a href="/create" className="underline font-semibold">Try again →</a></p>
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="text-red-400 hover:text-red-600 transition flex-shrink-0 p-0.5"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// ── Wallet bar ────────────────────────────────────────────────────────────────

interface WalletUser {
  credits: number;
  characterSlotsTotal: number;
  characterSlotsUsed: number;
  avatarRefreshTokens: number;
}

function WalletBar({ user, onToggleTopUp }: { user: WalletUser; showTopUp?: boolean; onToggleTopUp: () => void }) {
  const slotsRemaining = user.characterSlotsTotal < 0 ? null : Math.max(0, user.characterSlotsTotal - user.characterSlotsUsed);
  const lowCredits = user.credits < 3;
  const noRefreshes = user.avatarRefreshTokens === 0;

  return (
    <div className={`rounded-2xl border px-5 py-4 flex flex-wrap items-center gap-4 mb-0 ${lowCredits ? "bg-amber-50 border-amber-200" : "bg-white border-ink/10 shadow-card"}`}>
      <div className="flex items-center gap-4 flex-wrap flex-1 min-w-0">
        {/* Story Credits */}
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${lowCredits ? "bg-amber-100" : "bg-brand/10"}`}>
            <Zap className={`w-4 h-4 ${lowCredits ? "text-amber-600" : "text-brand"}`} />
          </div>
          <div>
            <p className={`font-black text-lg leading-none ${lowCredits ? "text-amber-700" : "text-ink"}`}>{user.credits}</p>
            <p className={`text-xs ${lowCredits ? "text-amber-600" : "text-ink-muted"}`}>
              {lowCredits ? "Credits low!" : "Story Credits"}
            </p>
          </div>
        </div>

        <div className="w-px h-8 bg-ink/10" />

        {/* Character Slots */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-brand/10 flex items-center justify-center">
            <Users className="w-4 h-4 text-brand" />
          </div>
          <div>
            <p className="font-black text-lg leading-none text-ink">
              {slotsRemaining === null ? "∞" : slotsRemaining}
            </p>
            <p className="text-xs text-ink-muted">Cast Slots Left</p>
          </div>
        </div>

        <div className="w-px h-8 bg-ink/10" />

        {/* Avatar Refreshes */}
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${noRefreshes ? "bg-ink/5" : "bg-brand/10"}`}>
            <RefreshCw className={`w-4 h-4 ${noRefreshes ? "text-ink-muted" : "text-brand"}`} />
          </div>
          <div>
            <p className={`font-black text-lg leading-none ${noRefreshes ? "text-ink-muted" : "text-ink"}`}>{user.avatarRefreshTokens}</p>
            <p className="text-xs text-ink-muted">Avatar Refreshes</p>
          </div>
        </div>
      </div>

      <button
        onClick={onToggleTopUp}
        className="flex items-center gap-2 bg-brand hover:bg-brand-dark text-white text-sm font-bold px-4 py-2 rounded-full transition-all hover:scale-105 whitespace-nowrap"
      >
        <ShoppingCart className="w-4 h-4" />
        Top Up
      </button>
    </div>
  );
}

const PAGE_SIZE = 3;

function UniverseSection({
  universe,
  stories,
  onDelete,
}: {
  universe: Universe;
  stories: Story[];
  onDelete: (id: string) => void;
}) {
  const [page, setPage] = useState(0);
  const openQuests = (universe.quests ?? []).filter((q) => q.status === "open");
  const completedStories = stories.filter((s) => s.status === "completed");
  const visible = stories.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const totalPages = Math.ceil(stories.length / PAGE_SIZE);

  return (
    <div className="mb-12">
      {/* Universe header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 bg-brand/10 rounded-xl flex items-center justify-center">
              <Globe className="w-4 h-4 text-brand" />
            </div>
            <h2 className="font-[family-name:var(--font-display)] text-ink text-2xl">{universe.name}</h2>
          </div>
          <div className="flex items-center gap-3 ml-11 flex-wrap">
            <span className="text-ink-muted text-xs flex items-center gap-1">
              <BookOpen className="w-3 h-3" /> {completedStories.length} episode{completedStories.length !== 1 ? "s" : ""}
            </span>
            {universe.powers && universe.powers.length > 0 && (
              <span className="text-ink-muted text-xs flex items-center gap-1">
                <Zap className="w-3 h-3 text-gold" /> {universe.powers.length} power{universe.powers.length !== 1 ? "s" : ""}
              </span>
            )}
            {openQuests.length > 0 && (
              <span className="text-ink-muted text-xs flex items-center gap-1">
                <Target className="w-3 h-3 text-brand" /> {openQuests.length} open quest{openQuests.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
        <a href={`/create?universeId=${universe.id}`}
          className="flex items-center gap-1.5 bg-brand/10 hover:bg-brand hover:text-white text-brand text-sm font-semibold px-4 py-2 rounded-full transition-all">
          <Plus className="w-3.5 h-3.5" /> New Episode
        </a>
      </div>

      {/* Powers strip */}
      {universe.powers && universe.powers.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-4 ml-11">
          {universe.powers.slice(0, 6).map((p) => (
            <span key={p.id} className="bg-gold-light/30 border border-gold/20 text-ink-mid text-xs font-semibold px-3 py-1 rounded-full">
              {p.emoji ?? "✨"} {p.name}
            </span>
          ))}
          {universe.powers.length > 6 && (
            <span className="text-ink-muted text-xs self-center">+{universe.powers.length - 6} more</span>
          )}
        </div>
      )}

      {/* Episodes grid */}
      {stories.length === 0 ? (
        <div className="ml-11 bg-white/60 border-2 border-dashed border-ink/10 rounded-2xl py-10 text-center">
          <p className="text-4xl mb-3">📖</p>
          <p className="text-ink-muted text-sm mb-4">No episodes yet in this universe.</p>
          <a href={`/create?universeId=${universe.id}`}
            className="inline-flex items-center gap-1 bg-brand text-white text-sm font-bold px-5 py-2.5 rounded-full hover:bg-brand-dark transition">
            <Plus className="w-4 h-4" /> Create First Episode
          </a>
        </div>
      ) : (
        <>
          <div className="ml-11 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {visible.map((story) => (
              <EpisodeCard key={story.id} story={story} onDelete={onDelete} />
            ))}
          </div>
          {totalPages > 1 && (
            <div className="ml-11 flex items-center justify-between mt-4">
              <span className="text-ink-muted text-xs">
                {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, stories.length)} of {stories.length} episodes
              </span>
              <div className="flex gap-2">
                <button type="button" onClick={() => setPage(p => p - 1)} disabled={page === 0}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold border border-ink/15 disabled:opacity-30 hover:border-brand hover:text-brand transition">
                  ← Prev
                </button>
                <button type="button" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold border border-ink/15 disabled:opacity-30 hover:border-brand hover:text-brand transition">
                  Next →
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StandaloneSection({ stories, onDelete }: { stories: Story[]; onDelete: (id: string) => void }) {
  const [page, setPage] = useState(0);
  if (stories.length === 0) return null;
  const visible = stories.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const totalPages = Math.ceil(stories.length / PAGE_SIZE);
  return (
    <div className="mb-12">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-ink/5 rounded-xl flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-ink-muted" />
          </div>
          <h2 className="font-[family-name:var(--font-display)] text-ink text-2xl">Standalone Stories</h2>
        </div>
      </div>
      <div className="ml-11 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
        {visible.map((story) => (
          <EpisodeCard key={story.id} story={story} onDelete={onDelete} />
        ))}
      </div>
      {totalPages > 1 && (
        <div className="ml-11 flex items-center justify-between mt-4">
          <span className="text-ink-muted text-xs">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, stories.length)} of {stories.length} stories
          </span>
          <div className="flex gap-2">
            <button type="button" onClick={() => setPage(p => p - 1)} disabled={page === 0}
              className="px-3 py-1.5 rounded-full text-xs font-semibold border border-ink/15 disabled:opacity-30 hover:border-brand hover:text-brand transition">
              ← Prev
            </button>
            <button type="button" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1}
              className="px-3 py-1.5 rounded-full text-xs font-semibold border border-ink/15 disabled:opacity-30 hover:border-brand hover:text-brand transition">
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const { flags } = usePublicPlatformSettings();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [universes, setUniverses]       = useState<Universe[]>([]);
  const [universeStories, setUniverseStories] = useState<Record<string, Story[]>>({});
  const [standaloneStories, setStandaloneStories] = useState<Story[]>([]);
  const [jobs, setJobs]                 = useState<GenerationJob[]>([]);
  const [fetching, setFetching]         = useState(true);
  const [showTopUp, setShowTopUp]       = useState(() => searchParams.get("topup") === "1");
  const pollRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const allStories = [
    ...Object.values(universeStories).flat(),
    ...standaloneStories,
  ];

  const fetchAll = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    const h = { Authorization: `Bearer ${token}` };

    const [univRes, standaloneRes, jobsRes] = await Promise.all([
      fetch(`${BASE}/universes/mine`, { headers: h }).catch(() => null),
      fetch(`${BASE}/stories?standalone=true`, { headers: h }).catch(() => null),
      fetch(`${BASE}/generation-jobs`, { headers: h }).catch(() => null),
    ]);

    if (univRes?.status === 404) {
      router.push("/onboarding");
      return;
    }

    let fetchedUniverses: Universe[] = [];
    if (univRes?.ok) {
      const { data } = await univRes.json();
      fetchedUniverses = Array.isArray(data) ? data : [data];
      setUniverses(fetchedUniverses);
    }

    if (standaloneRes?.ok) {
      const { data } = await standaloneRes.json();
      setStandaloneStories(data as Story[]);
    }

    if (jobsRes?.ok) {
      const { data } = await jobsRes.json();
      setJobs(data as GenerationJob[]);
    }

    // Fetch stories per universe in parallel
    if (fetchedUniverses.length > 0) {
      const storyResults = await Promise.all(
        fetchedUniverses.map((u) =>
          fetch(`${BASE}/stories?universeId=${u.id}`, { headers: h })
            .then((r) => r.ok ? r.json() : { data: [] })
            .then(({ data }) => ({ universeId: u.id, stories: data as Story[] }))
            .catch(() => ({ universeId: u.id, stories: [] as Story[] })),
        ),
      );
      const map: Record<string, Story[]> = {};
      for (const r of storyResults) map[r.universeId] = r.stories;
      setUniverseStories(map);
    }

    setFetching(false);
  }, [router]);

  async function deleteStory(id: string) {
    const token = getAccessToken();
    if (!token) return;
    await fetch(`${BASE}/stories/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    setUniverseStories((prev) => {
      const next = { ...prev };
      for (const uid of Object.keys(next)) next[uid] = next[uid].filter((s) => s.id !== id);
      return next;
    });
    setStandaloneStories((prev) => prev.filter((s) => s.id !== id));
  }

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push("/login"); return; }
    void fetchAll();
    pollRef.current = setInterval(() => void fetchAll(), 6000);
    return () => clearInterval(pollRef.current);
  }, [user, authLoading, fetchAll]);

  // Stop polling once everything is terminal
  useEffect(() => {
    const activeJobs = jobs.filter((j) => !TERMINAL.has(j.status));
    const pendingStories = allStories.filter((s) => !TERMINAL.has(s.status));
    if (!fetching && activeJobs.length === 0 && pendingStories.length === 0) {
      clearInterval(pollRef.current);
    }
  }, [jobs, allStories, fetching]);

  const totalEpisodes = allStories.filter((s) => s.status === "completed").length;
  const totalPowers   = universes.reduce((acc, u) => acc + (u.powers?.length ?? 0), 0);
  const activeJobs    = jobs.filter((j) => !TERMINAL.has(j.status));

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      <Navbar />

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header className="bg-page-header pt-28 md:pt-32 pb-10 px-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-28 -left-10 w-[300px] h-[180px] bg-brand/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-64 h-64 bg-gold/5 rounded-full blur-2xl pointer-events-none" />
        <div className="relative max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h1 className="font-[family-name:var(--font-display)] text-white text-4xl md:text-5xl mb-1">
                Welcome back, {user?.name?.split(" ")[0] ?? "Hero"}
              </h1>
              <div className="flex items-center gap-3 mt-3 flex-wrap">
                <span className="text-white/50 text-sm">
                  {universes.length} universe{universes.length !== 1 ? "s" : ""} · {totalEpisodes} episode{totalEpisodes !== 1 ? "s" : ""}
                </span>
                {totalPowers > 0 && (
                  <span className="text-gold/80 text-sm flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5" /> {totalPowers} power{totalPowers !== 1 ? "s" : ""} earned
                  </span>
                )}
                {user && (
                  <button
                    onClick={() => document.getElementById("credits")?.scrollIntoView({ behavior: "smooth" })}
                    className={`text-sm flex items-center gap-1 transition ${user.credits < 3 ? "text-amber-400 font-semibold" : "text-white/40 hover:text-white/70"}`}
                  >
                    <Zap className="w-3.5 h-3.5" />
                    {user.credits} credit{user.credits !== 1 ? "s" : ""}
                    {user.credits < 3 && " · Buy More →"}
                  </button>
                )}
              </div>
            </div>
            <a href="/create"
              className="inline-flex items-center gap-2 bg-brand hover:bg-brand-dark text-white font-[family-name:var(--font-display)] text-lg px-7 py-3 rounded-full shadow-brand transition-all hover:scale-105 self-start md:self-auto">
              <Plus className="w-5 h-5" /> New Episode
            </a>
          </div>

          {/* Quick stats + quick links in one compact row */}
          <div className="flex gap-3 flex-wrap mt-8">
            <div className="flex flex-col items-center gap-1 bg-white/8 border border-white/10 rounded-2xl px-6 py-4 min-w-[90px]">
              <Globe className="w-4 h-4 text-brand" />
              <span className="font-[family-name:var(--font-display)] text-white text-2xl">{universes.length}</span>
              <span className="text-white/50 text-xs">Universes</span>
            </div>
            <div className="flex flex-col items-center gap-1 bg-white/8 border border-white/10 rounded-2xl px-6 py-4 min-w-[90px]">
              <BookOpen className="w-4 h-4 text-gold" />
              <span className="font-[family-name:var(--font-display)] text-white text-2xl">{totalEpisodes}</span>
              <span className="text-white/50 text-xs">Episodes</span>
            </div>
            <div className="flex flex-col items-center gap-1 bg-white/8 border border-white/10 rounded-2xl px-6 py-4 min-w-[90px]">
              <Zap className="w-4 h-4 text-gold" />
              <span className="font-[family-name:var(--font-display)] text-white text-2xl">{totalPowers || "—"}</span>
              <span className="text-white/50 text-xs">Powers</span>
            </div>
            <a href="/characters"
              className="flex flex-col items-center gap-1 bg-white/8 border border-white/10 rounded-2xl px-6 py-4 min-w-[90px] hover:bg-white/15 hover:border-white/20 transition-colors">
              <Users className="w-4 h-4 text-brand" />
              <span className="font-[family-name:var(--font-display)] text-white text-2xl">Cast</span>
              <span className="text-white/50 text-xs">Manage →</span>
            </a>
            {flags.ENABLE_MERCHANDISE !== false && (
              <>
                <a href="/dashboard/merchandise/create"
                  className="flex flex-col items-center gap-1 bg-white/8 border border-white/10 rounded-2xl px-4 py-4 min-w-[100px] hover:bg-white/15 hover:border-white/20 transition-colors">
                  <Package className="w-4 h-4 text-white" />
                  <span className="font-[family-name:var(--font-display)] text-white text-sm font-bold whitespace-nowrap">Merchandise</span>
                  <span className="text-white/50 text-xs whitespace-nowrap">Create →</span>
                </a>
                <a href="/dashboard/orders"
                  className="flex flex-col items-center gap-1 bg-white/8 border border-white/10 rounded-2xl px-4 py-4 min-w-[100px] hover:bg-white/15 hover:border-white/20 transition-colors">
                  <Clock className="w-4 h-4 text-white" />
                  <span className="font-[family-name:var(--font-display)] text-white text-sm font-bold whitespace-nowrap">Orders</span>
                  <span className="text-white/50 text-xs whitespace-nowrap">View →</span>
                </a>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-6 py-10 w-full">

        {fetching ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
          </div>
        ) : (
          <>
            {/* ── Failed jobs banner ──────────────────────────────────── */}
            <FailedJobsBanner jobs={jobs} />

            {/* ── Wallet bar ───────────────────────────────────────────── */}
            {user && (
              <div className="mb-8">
                <WalletBar user={user} onToggleTopUp={() => setShowTopUp(v => !v)} />
              </div>
            )}

            {/* ── Top Up modal ─────────────────────────────────────────── */}
            {showTopUp && (
              <div
                className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4"
                onClick={() => setShowTopUp(false)}
              >
                <div
                  className="bg-cream w-full max-w-2xl max-h-[85vh] rounded-3xl overflow-y-auto shadow-2xl"
                  onClick={e => e.stopPropagation()}
                >
                  <div className="sticky top-0 bg-cream/95 backdrop-blur-sm px-6 pt-6 pb-4 flex items-center justify-between border-b border-ink/10">
                    <h2 className="font-[family-name:var(--font-display)] text-ink text-2xl">Top Up Your Account</h2>
                    <button
                      onClick={() => setShowTopUp(false)}
                      className="w-8 h-8 rounded-full bg-ink/8 hover:bg-ink/15 flex items-center justify-center transition text-ink-muted hover:text-ink"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="px-6 pb-6">
                    <BuyCreditsSection onPurchased={(newBalance) => {
                      if (user) (user as unknown as Record<string, unknown>).credits = newBalance;
                      setShowTopUp(false);
                    }} />
                  </div>
                </div>
              </div>
            )}

            {/* ── In Progress ─────────────────────────────────────────── */}
            <InProgressSection jobs={jobs} stories={allStories} />

            {/* ── My Universes ─────────────────────────────────────────── */}
            {universes.length > 0 && (
              <div className="mb-6">
                <h2 className="font-[family-name:var(--font-display)] text-ink text-3xl mb-8 flex items-center gap-2">
                  <Globe className="w-6 h-6 text-brand" /> My Universes
                </h2>
                {universes.map((universe) => (
                  <UniverseSection
                    key={universe.id}
                    universe={universe}
                    stories={universeStories[universe.id] ?? []}
                    onDelete={deleteStory}
                  />
                ))}
              </div>
            )}

            {/* ── Standalone Stories ───────────────────────────────────── */}
            <StandaloneSection stories={standaloneStories} onDelete={deleteStory} />

            {/* ── Empty state ──────────────────────────────────────────── */}
            {universes.length === 0 && standaloneStories.length === 0 && activeJobs.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 text-center bg-white rounded-3xl shadow-card">
                <div className="text-7xl mb-5">🌌</div>
                <h3 className="font-[family-name:var(--font-display)] text-ink text-2xl mb-2">Your universe awaits</h3>
                <p className="text-ink-muted mb-8 max-w-xs text-sm">
                  Create the first episode and begin your child&apos;s adventure.
                </p>
                <a href="/create"
                  className="bg-brand text-white font-bold px-8 py-3.5 rounded-full shadow-brand hover:bg-brand-dark transition-all hover:scale-105">
                  Create First Episode →
                </a>
              </div>
            )}

          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
