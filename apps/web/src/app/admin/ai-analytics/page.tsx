"use client";

import {
  Activity, AlertTriangle, Archive, BarChart3, Bot, Check, CheckCircle2,
  ChevronLeft, ChevronRight, ChevronDown, Clock, Copy, Cpu, DollarSign, ExternalLink,
  Eye, FileCode, Filter, GitCompare, Globe, Layers, Loader2, Plus,
  RefreshCw, RotateCcw, Search, Settings, Shield, Sparkles, Tag,
  Trash2, TrendingUp, User, X, Zap,
} from "lucide-react";
import Link from "next/link";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";

import { getAccessToken } from "@/lib/api";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ByProvider { provider: string; requestCount: number; storiesGenerated: number; imagesGenerated: number; narrationSeconds: number; estimatedCostUsd: number; }
interface ByModel { provider: string; model: string; requestCount: number; totalInputTokens: number; totalOutputTokens: number; imagesGenerated: number; audioSeconds: number | string; estimatedCostUsd: number; }
interface ByOperation { operation: string; requestCount: number; avgCostUsd: number; totalCostUsd: number; }
interface TopStory { storyId: string; title: string; userEmail: string; storyCostUsd: number; imageCostUsd: number; audioCostUsd: number; videoCostUsd: number; totalCostUsd: number; }
interface TopUser { userId: string; name: string; email: string; storyCount: number; imagesGenerated: number; audioSeconds: number; totalAiCostUsd: number; }
interface UniverseAnalytic { universeId: string; universeName: string; storyCount: number; imagesGenerated: number; audioCount: number; totalAiCostUsd: number; }

interface AiAnalytics {
  aiCostToday: number; aiCostThisMonth: number;
  totalStoriesGenerated: number; totalImagesGenerated: number;
  totalNarrationSeconds: number; totalVideosGenerated: number;
  avgCostPerStory: number; avgCostPerImage: number; avgCostPerNarrationMinute: number;
  byProvider: ByProvider[]; byModel: ByModel[]; byOperation: ByOperation[];
  topExpensiveStories: TopStory[]; topExpensiveUsers: TopUser[]; universeAnalytics: UniverseAnalytic[];
  isSandbox: boolean | null;
  qaAvgConfidence: number | null; qaAvgIdentity: number | null; qaAvgStory: number | null;
  qaAvgRetries: number | null; qaPassRate: number | null; qaTotalRuns: number;
}

interface QaDashboard {
  avgOverallConfidence: number; avgIdentityScore: number; avgStoryScore: number;
  avgExpressionScore: number; avgDialogueScore: number;
  avgCompositionScore: number; avgNarrationScore: number;
  passRate: number; retryRate: number; totalRuns: number;
  storiesAcceptedFirstAttempt: number; storiesRequiringRetry: number; failedPages: number;
  recentRuns: Array<{ id: string; storyId: string; storyTitle?: string | null; userEmail?: string | null; overallConfidence: number | null; overallStatus: string; avgIdentityScore: number | null; pagesRetried: number; createdAt: string; }>;
  confidenceTrend: Array<{ date: string; avgConfidence: number; count: number; }>;
  topFailureReasons: Array<{ reason: string; count: number; }>;
}

interface RunItem {
  storyId: string; storyTitle?: string | null; status: string; createdAt: string;
  storyMode?: string | null; universeName?: string | null; userName?: string | null;
  userEmail?: string | null; overallConfidence?: number | null; qaStatus?: string | null;
  avgIdentityScore?: number | null; avgStoryScore?: number | null; pagesRetried: number;
  storyPromptVersion?: string | null; imagePromptVersion?: string | null;
  qaVersion?: string | null; totalCostUsd?: number | null; durationSeconds?: number | null;
}

interface LogItem {
  id: string; userId?: string | null; storyId?: string | null; provider: string; model: string;
  operation: string; inputTokens: number; outputTokens: number; imagesGenerated: number;
  audioSeconds: number; estimatedCostUsd: number; isSandbox: boolean;
  createdAt: string; userEmail?: string | null; storyTitle?: string | null;
}

interface PaginatedResult<T> { items: T[]; total: number; page: number; limit: number; totalPages: number; }

type SettingType = "string" | "number" | "boolean";
interface SettingDef { key: string; label: string; description: string; type: SettingType; }
interface SettingGroup { title: string; description: string; items: SettingDef[]; }

// ─── Shared helpers ────────────────────────────────────────────────────────────

function fmt$(n: number | null | undefined, digits = 3) {
  if (n == null) return "—";
  return `$${n.toFixed(digits)}`;
}

function fmtINR(usd: number | null | undefined) {
  if (usd == null) return "—";
  return `₹${Math.round(usd * 96).toLocaleString()}`;
}

function confColor(v: number | null | undefined) {
  if (v == null) return "text-gray-400";
  if (v >= 85) return "text-emerald-600";
  if (v >= 70) return "text-amber-600";
  return "text-rose-600";
}

function confBg(v: number | null | undefined) {
  if (v == null) return "bg-gray-100 text-gray-500";
  if (v >= 85) return "bg-emerald-50 text-emerald-700 border border-emerald-200";
  if (v >= 70) return "bg-amber-50 text-amber-700 border border-amber-200";
  return "bg-rose-50 text-rose-700 border border-rose-200";
}

function statusBadge(s: string) {
  const map: Record<string, string> = {
    passed:  "bg-emerald-50 text-emerald-700 border border-emerald-200",
    failed:  "bg-rose-50 text-rose-700 border border-rose-200",
    pending: "bg-gray-100 text-gray-600",
    completed:"bg-blue-50 text-blue-700 border border-blue-200",
    generating_images:"bg-violet-50 text-violet-700 border border-violet-200",
  };
  return map[s?.toLowerCase()] ?? "bg-gray-100 text-gray-600";
}

function scoreBar(score: number | null | undefined, max = 10) {
  const pct = score != null ? Math.round((score / max) * 100) : 0;
  const col = score == null ? "bg-gray-200" : score / max >= 0.8 ? "bg-emerald-500" : score / max >= 0.6 ? "bg-amber-500" : "bg-rose-500";
  return (
    <div className="flex items-center gap-2">
      <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${col} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-gray-600">{score != null ? score.toFixed(1) : "—"}</span>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub, color = "violet" }: { icon: React.ElementType; label: string; value: string; sub?: string; color?: string; }) {
  const colors: Record<string, string> = {
    violet: "from-violet-600 to-purple-600", blue: "from-blue-500 to-cyan-500",
    emerald: "from-emerald-500 to-teal-500", amber: "from-amber-500 to-orange-500",
    rose: "from-rose-500 to-red-500",
  };
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex items-start gap-3">
      <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${colors[color] ?? colors.violet} flex items-center justify-center text-white flex-shrink-0 shadow-sm`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">{label}</p>
        <p className="text-xl font-extrabold text-gray-900 leading-tight">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">{children}</h3>;
}

function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between pt-3 border-t border-gray-100">
      <span className="text-xs text-gray-400">Page {page} of {totalPages}</span>
      <div className="flex gap-1">
        <button onClick={() => onChange(Math.max(1, page - 1))} disabled={page === 1} className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30">
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => onChange(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30">
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

async function apiFetch(path: string) {
  const token = getAccessToken();
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`${res.status}`);
  const j = await res.json();
  return j.data ?? j;
}

// ─── TAB: Overview ─────────────────────────────────────────────────────────────

function OverviewTab({ analytics, loading }: { analytics: AiAnalytics | null; loading: boolean }) {
  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-violet-500 animate-spin" /></div>;
  if (!analytics) return <p className="text-rose-500 text-sm py-8 text-center">Failed to load analytics.</p>;

  const healthScore = (() => {
    let score = 0;
    if ((analytics.qaPassRate ?? 0) >= 85) score += 25;
    else if ((analytics.qaPassRate ?? 0) >= 70) score += 15;
    if ((analytics.qaAvgConfidence ?? 0) >= 80) score += 25;
    else if ((analytics.qaAvgConfidence ?? 0) >= 65) score += 15;
    if (analytics.aiCostToday < 5) score += 25;
    else if (analytics.aiCostToday < 15) score += 15;
    if (analytics.totalStoriesGenerated > 0) score += 25;
    return score;
  })();
  const healthLabel = healthScore >= 80 ? "Excellent" : healthScore >= 60 ? "Good" : healthScore >= 40 ? "Fair" : "Needs Attention";
  const healthCol = healthScore >= 80 ? "text-emerald-600" : healthScore >= 60 ? "text-blue-600" : healthScore >= 40 ? "text-amber-600" : "text-rose-600";
  const healthRingCol = healthScore >= 80 ? "#10b981" : healthScore >= 60 ? "#3b82f6" : healthScore >= 40 ? "#f59e0b" : "#f43f5e";

  return (
    <div className="space-y-6">
      {/* Health Score + Key KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {/* Health Score */}
        <div className="md:col-span-1 bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex flex-col items-center justify-center gap-2">
          <svg viewBox="0 0 64 64" className="w-24 h-24 -rotate-90">
            <circle cx="32" cy="32" r="26" fill="none" stroke="#f3f4f6" strokeWidth="6" />
            <circle cx="32" cy="32" r="26" fill="none" stroke={healthRingCol} strokeWidth="6"
              strokeDasharray={`${2 * Math.PI * 26 * healthScore / 100} ${2 * Math.PI * 26 * (1 - healthScore / 100)}`}
              strokeLinecap="round" style={{ transition: "stroke-dasharray 0.5s" }} />
          </svg>
          <div className="text-center -mt-16">
            <p className={`text-2xl font-black ${healthCol}`}>{healthScore}</p>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider">{healthLabel}</p>
          </div>
          <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mt-4">AI Health Score</p>
        </div>

        {/* KPIs */}
        <div className="md:col-span-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Kpi icon={DollarSign} label="Cost Today" value={fmtINR(analytics.aiCostToday)} sub={fmt$(analytics.aiCostToday)} color="amber" />
          <Kpi icon={TrendingUp} label="Cost This Month" value={fmtINR(analytics.aiCostThisMonth)} sub={fmt$(analytics.aiCostThisMonth)} color="rose" />
          <Kpi icon={Sparkles} label="Stories Generated" value={analytics.totalStoriesGenerated.toLocaleString()} color="violet" />
          <Kpi icon={Layers} label="Images Generated" value={analytics.totalImagesGenerated.toLocaleString()} color="blue" />
        </div>
      </div>

      {/* QA Summary */}
      {analytics.qaTotalRuns > 0 && (
        <div>
          <SectionTitle>QA Summary (Last 30 Days)</SectionTitle>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <Kpi icon={Shield} label="Avg Confidence" value={analytics.qaAvgConfidence != null ? `${analytics.qaAvgConfidence.toFixed(1)}%` : "—"} color="emerald" />
            <Kpi icon={CheckCircle2} label="QA Pass Rate" value={analytics.qaPassRate != null ? `${analytics.qaPassRate.toFixed(1)}%` : "—"} color="emerald" />
            <Kpi icon={Activity} label="Avg Identity" value={analytics.qaAvgIdentity != null ? analytics.qaAvgIdentity.toFixed(1) : "—"} sub="out of 10" color="violet" />
            <Kpi icon={BarChart3} label="Avg Story Score" value={analytics.qaAvgStory != null ? analytics.qaAvgStory.toFixed(1) : "—"} sub="out of 10" color="blue" />
            <Kpi icon={RefreshCw} label="Avg Retries" value={analytics.qaAvgRetries != null ? analytics.qaAvgRetries.toFixed(2) : "—"} sub="per story" color="amber" />
            <Kpi icon={Zap} label="Total QA Runs" value={analytics.qaTotalRuns.toLocaleString()} color="violet" />
          </div>
        </div>
      )}

      {/* Avg costs */}
      <div>
        <SectionTitle>Average Costs</SectionTitle>
        <div className="grid grid-cols-3 gap-3">
          <Kpi icon={Cpu} label="Per Story" value={fmtINR(analytics.avgCostPerStory)} sub={fmt$(analytics.avgCostPerStory)} color="violet" />
          <Kpi icon={Layers} label="Per Image" value={fmtINR(analytics.avgCostPerImage)} sub={fmt$(analytics.avgCostPerImage)} color="blue" />
          <Kpi icon={Activity} label="Per Narration Min" value={fmtINR(analytics.avgCostPerNarrationMinute)} sub={fmt$(analytics.avgCostPerNarrationMinute)} color="amber" />
        </div>
      </div>

      {/* Quick links */}
      <div>
        <SectionTitle>Quick Access</SectionTitle>
        <div className="flex flex-wrap gap-2">
          {[
            { href: "/admin/qa", label: "Full QA Dashboard", icon: Activity },
            { href: "/admin/qa/settings", label: "QA Settings", icon: Settings },
            { href: "/admin/generation-jobs", label: "Generation Jobs", icon: Zap },
            { href: "/admin/character-canons", label: "Character Canons", icon: Shield },
            { href: "/admin/stories", label: "Stories", icon: Sparkles },
          ].map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 text-xs font-medium hover:bg-violet-50 hover:text-violet-700 hover:border-violet-200 transition-all">
              <Icon className="w-3.5 h-3.5" /> {label} <ExternalLink className="w-3 h-3 ml-0.5 opacity-50" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── TAB: Generation Runs ──────────────────────────────────────────────────────

function RunsTab() {
  const [data, setData] = useState<PaginatedResult<RunItem> | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [days, setDays] = useState(30);
  const [statusFilter, setStatusFilter] = useState("");
  const mounted = useRef(false);

  const load = useCallback(async (p: number, d: number, s: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: "25", days: String(d) });
      if (s) params.set("status", s);
      const res = await apiFetch(`/admin/ai-analytics/generation-runs?${params}`);
      setData(res);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!mounted.current) { mounted.current = true; void load(1, days, statusFilter); }
  }, []); // eslint-disable-line

  function applyFilters() { setPage(1); void load(1, days, statusFilter); }
  function onPage(p: number) { setPage(p); void load(p, days, statusFilter); }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 bg-white rounded-xl border border-gray-200 px-4 py-3 shadow-sm">
        <Filter className="w-3.5 h-3.5 text-gray-400" />
        <select value={days} onChange={e => setDays(Number(e.target.value))} className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500">
          {[7, 14, 30, 60, 90].map(d => <option key={d} value={d}>Last {d} days</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500">
          <option value="">All statuses</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="generating_images">Generating Images</option>
        </select>
        <button onClick={applyFilters} className="px-3 py-1.5 bg-violet-600 text-white text-xs font-semibold rounded-lg hover:bg-violet-700 transition-colors">Apply</button>
        {loading && <Loader2 className="w-3.5 h-3.5 text-violet-500 animate-spin ml-auto" />}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Story</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">User</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">QA</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Identity</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Retries</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Cost</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Duration</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Versions</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {!data ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400 text-sm">No data yet</td></tr>
              ) : data.items.map((r) => (
                <tr key={r.storyId} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-gray-900 font-medium text-xs truncate max-w-[160px]">{r.storyTitle ?? "Untitled"}</p>
                      <p className="text-gray-400 text-[10px]">{r.universeName ?? "—"}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-gray-600 text-xs truncate max-w-[120px]">{r.userEmail ?? "—"}</p>
                  </td>
                  <td className="px-4 py-3">
                    {r.overallConfidence != null ? (
                      <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${confBg(r.overallConfidence)}`}>
                        {r.overallConfidence.toFixed(0)}%
                      </span>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {scoreBar(r.avgIdentityScore)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold ${r.pagesRetried > 0 ? "text-amber-600" : "text-gray-400"}`}>{r.pagesRetried}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600 tabular-nums">
                    {r.totalCostUsd != null ? fmt$(r.totalCostUsd, 4) : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 tabular-nums">
                    {r.durationSeconds != null ? `${Math.round(r.durationSeconds)}s` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-[10px] text-gray-400 space-y-0.5">
                      {r.storyPromptVersion && <p>S:{r.storyPromptVersion}</p>}
                      {r.imagePromptVersion && <p>I:{r.imagePromptVersion}</p>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400 tabular-nums whitespace-nowrap">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data && (
          <div className="px-4 pb-4 pt-2">
            <Pagination page={page} totalPages={data.totalPages} onChange={onPage} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── TAB: Quality ──────────────────────────────────────────────────────────────

function QualityTab() {
  const [qa, setQa] = useState<QaDashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [days, setDays] = useState(30);
  const loaded = useRef(false);

  const load = useCallback(async (d: number) => {
    setLoading(true);
    try {
      const res = await apiFetch(`/admin/qa/dashboard?days=${d}`);
      setQa(res);
    } catch {
      setQa(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!loaded.current) { loaded.current = true; void load(days); }
  }, []); // eslint-disable-line

  if (loading && !qa) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-violet-500 animate-spin" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {[7, 30, 90].map(d => (
            <button key={d} onClick={() => { setDays(d); void load(d); }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${days === d ? "bg-violet-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
              {d}d
            </button>
          ))}
          {loading && <Loader2 className="w-3.5 h-3.5 text-violet-500 animate-spin self-center ml-1" />}
        </div>
        <Link href="/admin/qa" className="text-xs text-violet-600 hover:underline flex items-center gap-1">
          Full QA Dashboard <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      {!qa ? (
        <p className="text-sm text-gray-400 py-6 text-center">No QA data available. Run some stories first.</p>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Kpi icon={Shield} label="Avg Confidence" value={`${qa.avgOverallConfidence.toFixed(1)}%`} color={qa.avgOverallConfidence >= 80 ? "emerald" : "amber"} />
            <Kpi icon={CheckCircle2} label="Pass Rate" value={`${qa.passRate.toFixed(1)}%`} color="emerald" />
            <Kpi icon={RefreshCw} label="Retry Rate" value={`${qa.retryRate.toFixed(1)}%`} color="amber" />
            <Kpi icon={AlertTriangle} label="Failed Pages" value={qa.failedPages.toLocaleString()} color="rose" />
          </div>

          {/* Score breakdown */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <SectionTitle>Dimension Scores (avg)</SectionTitle>
            <div className="space-y-3">
              {[
                { label: "Identity", val: qa.avgIdentityScore },
                { label: "Story", val: qa.avgStoryScore },
                { label: "Expression", val: qa.avgExpressionScore },
                { label: "Dialogue", val: qa.avgDialogueScore },
                { label: "Composition", val: qa.avgCompositionScore },
                { label: "Narration", val: qa.avgNarrationScore },
              ].map(({ label, val }) => (
                <div key={label} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-24 shrink-0">{label}</span>
                  {scoreBar(val)}
                </div>
              ))}
            </div>
          </div>

          {/* Top failure reasons */}
          {qa.topFailureReasons.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Top Failure Reasons</p>
              </div>
              <div className="divide-y divide-gray-50">
                {qa.topFailureReasons.slice(0, 8).map(({ reason, count }) => (
                  <div key={reason} className="px-5 py-2.5 flex items-center justify-between">
                    <span className="text-sm text-gray-700">{reason}</span>
                    <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">{count}×</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent runs */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Recent QA Runs</p>
              <Link href="/admin/qa" className="text-[10px] text-violet-600 hover:underline">See all →</Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400">Story</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400">Confidence</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400">Status</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400">Retries</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {qa.recentRuns.slice(0, 10).map((r) => (
                    <tr key={r.storyId} className="hover:bg-gray-50/50">
                      <td className="px-4 py-2.5">
                        <p className="text-xs font-medium text-gray-800 truncate max-w-[200px]">{r.storyTitle ?? "Untitled"}</p>
                        <p className="text-[10px] text-gray-400">{r.userEmail ?? "—"}</p>
                      </td>
                      <td className="px-4 py-2.5">
                        {r.overallConfidence != null ? (
                          <span className={`text-xs font-bold ${confColor(r.overallConfidence)}`}>{r.overallConfidence.toFixed(0)}%</span>
                        ) : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusBadge(r.overallStatus)}`}>{r.overallStatus}</span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-500">{r.pagesRetried}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-400">{new Date(r.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── TAB: Costs ────────────────────────────────────────────────────────────────

function CostsTab({ analytics, loading }: { analytics: AiAnalytics | null; loading: boolean }) {
  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-violet-500 animate-spin" /></div>;
  if (!analytics) return <p className="text-rose-500 text-sm py-8 text-center">Failed to load analytics.</p>;

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Kpi icon={DollarSign} label="Today" value={fmtINR(analytics.aiCostToday)} sub={fmt$(analytics.aiCostToday)} color="amber" />
        <Kpi icon={TrendingUp} label="This Month" value={fmtINR(analytics.aiCostThisMonth)} sub={fmt$(analytics.aiCostThisMonth)} color="rose" />
        <Kpi icon={Cpu} label="Avg / Story" value={fmtINR(analytics.avgCostPerStory)} sub={fmt$(analytics.avgCostPerStory)} color="violet" />
      </div>

      {/* By provider */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">By Provider</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {["Provider", "Requests", "Stories", "Images", "Narration", "Cost (USD)"].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {analytics.byProvider.map(r => (
                <tr key={r.provider} className="hover:bg-gray-50/50">
                  <td className="px-4 py-2.5 font-semibold text-gray-800 capitalize">{r.provider}</td>
                  <td className="px-4 py-2.5 tabular-nums text-gray-600">{Number(r.requestCount).toLocaleString()}</td>
                  <td className="px-4 py-2.5 tabular-nums text-gray-600">{Number(r.storiesGenerated).toLocaleString()}</td>
                  <td className="px-4 py-2.5 tabular-nums text-gray-600">{Number(r.imagesGenerated).toLocaleString()}</td>
                  <td className="px-4 py-2.5 tabular-nums text-gray-600">{Math.round(Number(r.narrationSeconds) / 60)}m</td>
                  <td className="px-4 py-2.5 tabular-nums font-medium text-gray-900">{fmt$(Number(r.estimatedCostUsd))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* By operation */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">By Operation</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {["Operation", "Requests", "Avg Cost (USD)", "Total Cost (USD)"].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {analytics.byOperation.map(r => (
                <tr key={r.operation} className="hover:bg-gray-50/50">
                  <td className="px-4 py-2.5 font-medium text-gray-800">{r.operation.replace(/_/g, " ")}</td>
                  <td className="px-4 py-2.5 tabular-nums text-gray-600">{Number(r.requestCount).toLocaleString()}</td>
                  <td className="px-4 py-2.5 tabular-nums text-gray-600">{fmt$(Number(r.avgCostUsd), 4)}</td>
                  <td className="px-4 py-2.5 tabular-nums font-medium text-gray-900">{fmt$(Number(r.totalCostUsd))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top expensive stories */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Top 10 Most Expensive Stories</p>
        </div>
        <div className="divide-y divide-gray-50">
          {analytics.topExpensiveStories.map((s, i) => (
            <div key={s.storyId} className="px-5 py-3 flex items-center gap-3">
              <span className="text-xs font-bold text-gray-300 w-5">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-800 truncate">{s.title ?? "Untitled"}</p>
                <p className="text-[10px] text-gray-400">{s.userEmail}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-gray-900">{fmt$(Number(s.totalCostUsd))}</p>
                <p className="text-[10px] text-gray-400">
                  S:{fmt$(Number(s.storyCostUsd), 4)} I:{fmt$(Number(s.imageCostUsd), 4)} A:{fmt$(Number(s.audioCostUsd), 4)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top expensive users */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Top 10 Most Active Users (by AI Cost)</p>
        </div>
        <div className="divide-y divide-gray-50">
          {analytics.topExpensiveUsers.map((u, i) => (
            <div key={u.userId} className="px-5 py-3 flex items-center gap-3">
              <span className="text-xs font-bold text-gray-300 w-5">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-800">{u.name}</p>
                <p className="text-[10px] text-gray-400">{u.email}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-gray-900">{fmt$(Number(u.totalAiCostUsd))}</p>
                <p className="text-[10px] text-gray-400">{u.storyCount} stories · {u.imagesGenerated} imgs</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── TAB: Prompt Registry ──────────────────────────────────────────────────────

interface PromptTemplate {
  id: string; promptKey: string; name: string; description: string | null;
  promptType: string; provider: string | null; defaultModel: string | null;
  isActive: boolean; isSystemPrompt: boolean;
  currentVersion: string | null; currentVersionId: string | null; currentVersionStatus: string | null;
  totalVersions: number; createdAt: string; updatedAt: string;
}
interface PromptVersion {
  id: string; promptTemplateId: string; version: string; title: string | null;
  promptText: string; systemInstructions: string | null; variablesJson: object | null;
  changeNotes: string | null; status: string; isCurrent: boolean;
  activatedAt: string | null; createdByUserId: string | null; createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  active:   "bg-emerald-100 text-emerald-700 border-emerald-200",
  draft:    "bg-amber-100 text-amber-700 border-amber-200",
  inactive: "bg-gray-100 text-gray-600 border-gray-200",
  archived: "bg-slate-100 text-slate-500 border-slate-200",
};
const TYPE_COLOR = "bg-violet-50 text-violet-700 border-violet-200";

function StatusBadge({ status }: { status: string }) {
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_COLORS[status] ?? STATUS_COLORS.inactive}`}>{status}</span>;
}

async function apiCall(path: string, method = "GET", body?: object) {
  const token = getAccessToken();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token ?? ""}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j?.message ?? `HTTP ${res.status}`);
  return j?.data ?? j;
}

function PromptsTab() {
  const [templates, setTemplates]       = useState<PromptTemplate[]>([]);
  const [loading, setLoading]           = useState(false);
  const [backendReady, setBackendReady] = useState<boolean | null>(null);
  const [search, setSearch]             = useState("");
  const [filterType, setFilterType]     = useState("");

  // selected template → version list
  const [selectedTpl, setSelectedTpl]     = useState<PromptTemplate | null>(null);
  const [versions, setVersions]           = useState<PromptVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);

  // version detail drawer
  const [viewingVersion, setViewingVersion] = useState<PromptVersion | null>(null);

  // compare
  const [compareLeft, setCompareLeft]   = useState<PromptVersion | null>(null);
  const [compareRight, setCompareRight] = useState<PromptVersion | null>(null);
  const [showCompare, setShowCompare]   = useState(false);

  // create template modal
  const [showNewTpl, setShowNewTpl]     = useState(false);
  const [newTplForm, setNewTplForm]     = useState({ promptKey: "", name: "", description: "", promptType: "story_generation", provider: "gemini", defaultModel: "" });
  const [newTplSaving, setNewTplSaving] = useState(false);
  const [newTplError, setNewTplError]   = useState("");

  // create version modal
  const [showNewVer, setShowNewVer]     = useState(false);
  const [newVerForm, setNewVerForm]     = useState({ version: "1.0.0", title: "", promptText: "", changeNotes: "", systemInstructions: "", variablesJson: "" });
  const [newVerSaving, setNewVerSaving] = useState(false);
  const [newVerError, setNewVerError]   = useState("");

  // confirm action (activate / archive / duplicate / rollback / delete)
  const [confirm, setConfirm]           = useState<{ label: string; description: string; action: () => Promise<void> } | null>(null);
  const [confirmBusy, setConfirmBusy]   = useState(false);

  const [reseeding, setReseeding] = useState(false);
  const loaded = useRef(false);

  // ── reseed defaults ─────────────────────────────────────────────────────────
  async function reseedDefaults() {
    setReseeding(true);
    try {
      await apiCall("/admin/ai/prompts/reseed", "POST");
      await loadTemplates();
    } catch (e) {
      alert(`Reseed failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally { setReseeding(false); }
  }

  // ── load templates ──────────────────────────────────────────────────────────
  async function loadTemplates() {
    setLoading(true);
    try {
      const res = await apiCall("/admin/ai/prompts/templates?limit=100");
      setTemplates(Array.isArray(res) ? res : (res?.items ?? []));
      setBackendReady(true);
    } catch {
      setBackendReady(false);
    } finally { setLoading(false); }
  }

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    void loadTemplates();
  }, []); // eslint-disable-line

  // ── load versions for a template ───────────────────────────────────────────
  async function selectTemplate(tpl: PromptTemplate) {
    if (selectedTpl?.id === tpl.id) { setSelectedTpl(null); setVersions([]); return; }
    setSelectedTpl(tpl);
    setVersionsLoading(true);
    try {
      const res = await apiCall(`/admin/ai/prompts/templates/${tpl.id}/versions?limit=50`);
      setVersions(Array.isArray(res) ? res : (res?.items ?? []));
    } catch { setVersions([]); }
    finally { setVersionsLoading(false); }
  }

  // ── create template ─────────────────────────────────────────────────────────
  async function createTemplate() {
    setNewTplError(""); setNewTplSaving(true);
    try {
      await apiCall("/admin/ai/prompts/templates", "POST", newTplForm);
      setShowNewTpl(false);
      setNewTplForm({ promptKey: "", name: "", description: "", promptType: "story_generation", provider: "gemini", defaultModel: "" });
      void loadTemplates();
    } catch (e) { setNewTplError(e instanceof Error ? e.message : "Error"); }
    finally { setNewTplSaving(false); }
  }

  // ── create version ──────────────────────────────────────────────────────────
  async function createVersion() {
    if (!selectedTpl) return;
    setNewVerError(""); setNewVerSaving(true);
    try {
      let variablesJson: object | undefined;
      if (newVerForm.variablesJson.trim()) {
        try { variablesJson = JSON.parse(newVerForm.variablesJson); }
        catch { setNewVerError("Variables JSON is not valid JSON."); setNewVerSaving(false); return; }
      }
      await apiCall(`/admin/ai/prompts/templates/${selectedTpl.id}/versions`, "POST", {
        version: newVerForm.version, title: newVerForm.title || undefined,
        promptText: newVerForm.promptText, changeNotes: newVerForm.changeNotes || undefined,
        systemInstructions: newVerForm.systemInstructions || undefined,
        variablesJson,
      });
      setShowNewVer(false);
      setNewVerForm({ version: "1.0.0", title: "", promptText: "", changeNotes: "", systemInstructions: "", variablesJson: "" });
      // refresh versions
      const res = await apiCall(`/admin/ai/prompts/templates/${selectedTpl.id}/versions?limit=50`);
      setVersions(Array.isArray(res) ? res : (res?.items ?? []));
      void loadTemplates();
    } catch (e) { setNewVerError(e instanceof Error ? e.message : "Error"); }
    finally { setNewVerSaving(false); }
  }

  // ── activate version ────────────────────────────────────────────────────────
  function confirmActivate(v: PromptVersion) {
    setConfirm({
      label: `Activate v${v.version}`,
      description: `This will deactivate the current version and make v${v.version} the active version. All future generations will use this prompt.`,
      action: async () => {
        await apiCall(`/admin/ai/prompts/versions/${v.id}/activate`, "POST");
        if (selectedTpl) {
          const res = await apiCall(`/admin/ai/prompts/templates/${selectedTpl.id}/versions?limit=50`);
          setVersions(Array.isArray(res) ? res : (res?.items ?? []));
        }
        void loadTemplates();
      },
    });
  }

  // ── archive version ─────────────────────────────────────────────────────────
  function confirmArchive(v: PromptVersion) {
    setConfirm({
      label: `Archive v${v.version}`,
      description: v.isCurrent ? "This version is currently active. Deactivate it before archiving." : `Archive v${v.version}? Archived versions are read-only.`,
      action: v.isCurrent ? async () => { throw new Error("Cannot archive the active version."); } : async () => {
        await apiCall(`/admin/ai/prompts/versions/${v.id}/archive`, "POST");
        if (selectedTpl) {
          const res = await apiCall(`/admin/ai/prompts/templates/${selectedTpl.id}/versions?limit=50`);
          setVersions(Array.isArray(res) ? res : (res?.items ?? []));
        }
      },
    });
  }

  // ── duplicate version ───────────────────────────────────────────────────────
  async function duplicateVersion(v: PromptVersion) {
    try {
      await apiCall(`/admin/ai/prompts/versions/${v.id}/duplicate`, "POST");
      if (selectedTpl) {
        const res = await apiCall(`/admin/ai/prompts/templates/${selectedTpl.id}/versions?limit=50`);
        setVersions(Array.isArray(res) ? res : (res?.items ?? []));
      }
    } catch (e) { alert(e instanceof Error ? e.message : "Error"); }
  }

  // ── rollback ────────────────────────────────────────────────────────────────
  function confirmRollback(v: PromptVersion) {
    setConfirm({
      label: `Rollback to v${v.version}`,
      description: `This will deactivate the current version and reactivate v${v.version}. Future generations will use this older prompt.`,
      action: async () => {
        await apiCall(`/admin/ai/prompts/versions/${v.id}/rollback`, "POST");
        if (selectedTpl) {
          const res = await apiCall(`/admin/ai/prompts/templates/${selectedTpl.id}/versions?limit=50`);
          setVersions(Array.isArray(res) ? res : (res?.items ?? []));
        }
        void loadTemplates();
      },
    });
  }

  // ── run confirmation ────────────────────────────────────────────────────────
  async function runConfirm() {
    if (!confirm) return;
    setConfirmBusy(true);
    try { await confirm.action(); setConfirm(null); }
    catch (e) { alert(e instanceof Error ? e.message : "Action failed."); }
    finally { setConfirmBusy(false); }
  }

  // ── filter ──────────────────────────────────────────────────────────────────
  const displayed = templates
    .filter((t, i, arr) => arr.findIndex(x => x.id === t.id) === i) // deduplicate by id
    .filter(t => {
      if (filterType && t.promptType !== filterType) return false;
      if (search && !t.name.toLowerCase().includes(search.toLowerCase()) && !t.promptKey.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });

  const PROMPT_TYPES_LIST = [
    "avatar_generation","avatar_regeneration","character_vision","character_canon",
    "story_generation","scene_generation","image_generation","narration","speech_bubble",
    "identity_qa","story_qa","expression_qa","dialogue_qa","composition_qa",
    "confidence_engine","merchandise_preview","companion_generation",
  ];

  // ── backend not deployed yet ────────────────────────────────────────────────
  if (backendReady === false) {
    return (
      <div className="space-y-4 max-w-3xl">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
          <p className="text-sm font-bold text-amber-800 mb-1">Prompt Registry — Backend Not Yet Deployed</p>
          <p className="text-xs text-amber-700">The Prompt Registry API is not available yet. Hand <code className="font-mono bg-amber-100 px-1 rounded">CODEX_PROMPT_REGISTRY.md</code> to Codex to implement the backend, then reload this tab.</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 space-y-3">
          <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">Legacy Version Tags</p>
          <p className="text-xs text-gray-500">These simple version fields continue to work until the full registry is live.</p>
          {["QA_STORY_PROMPT_VERSION","QA_IMAGE_PROMPT_VERSION","QA_VERSION"].map(key => (
            <div key={key} className="flex items-center gap-3">
              <span className="text-xs font-mono text-gray-600 flex-1">{key}</span>
              <span className="text-xs text-gray-400">tracked on every QA run</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* Compare modal */}
      {showCompare && compareLeft && compareRight && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
              <p className="text-sm font-bold text-gray-900">Compare Versions</p>
              <button onClick={() => setShowCompare(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-auto p-5">
              <div className="grid grid-cols-2 gap-4">
                {[compareLeft, compareRight].map((v, i) => (
                  <div key={v.id} className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className={`px-4 py-2 flex items-center gap-2 ${i === 0 ? "bg-blue-50" : "bg-violet-50"}`}>
                      <Tag className="w-3.5 h-3.5 text-gray-400" />
                      <span className="text-xs font-bold text-gray-800">v{v.version}</span>
                      <StatusBadge status={v.status} />
                      {v.title && <span className="text-xs text-gray-500">— {v.title}</span>}
                    </div>
                    {v.changeNotes && <p className="px-4 py-2 text-xs text-gray-500 border-b border-gray-100 italic">{v.changeNotes}</p>}
                    <pre className="p-4 text-[11px] text-gray-700 leading-relaxed overflow-auto max-h-96 font-mono whitespace-pre-wrap">{v.promptText}</pre>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Version detail modal */}
      {viewingVersion && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-violet-500" />
                <p className="text-sm font-bold text-gray-900">v{viewingVersion.version}</p>
                <StatusBadge status={viewingVersion.status} />
                {viewingVersion.title && <span className="text-xs text-gray-500">{viewingVersion.title}</span>}
              </div>
              <button onClick={() => setViewingVersion(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-auto p-5 space-y-3">
              {viewingVersion.changeNotes && (
                <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-2">
                  <p className="text-xs font-semibold text-amber-700">Change Notes</p>
                  <p className="text-xs text-amber-600 mt-0.5">{viewingVersion.changeNotes}</p>
                </div>
              )}
              {viewingVersion.systemInstructions && (
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">System Instructions</p>
                  <pre className="bg-gray-50 rounded-xl p-3 text-[11px] font-mono text-gray-700 whitespace-pre-wrap overflow-auto max-h-32">{viewingVersion.systemInstructions}</pre>
                </div>
              )}
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Prompt Text</p>
                <pre className="bg-gray-50 rounded-xl p-4 text-[11px] font-mono text-gray-700 whitespace-pre-wrap overflow-auto max-h-96 leading-relaxed">{viewingVersion.promptText}</pre>
              </div>
              {viewingVersion.variablesJson && (
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Variables</p>
                  <pre className="bg-gray-50 rounded-xl p-3 text-[11px] font-mono text-gray-700">{JSON.stringify(viewingVersion.variablesJson, null, 2)}</pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirm modal */}
      {confirm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <p className="text-sm font-bold text-gray-900">{confirm.label}</p>
            <p className="text-xs text-gray-600">{confirm.description}</p>
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setConfirm(null)} disabled={confirmBusy} className="px-4 py-2 text-xs font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">Cancel</button>
              <button onClick={runConfirm} disabled={confirmBusy} className="px-4 py-2 bg-violet-600 text-white text-xs font-bold rounded-xl hover:bg-violet-700 disabled:opacity-50 flex items-center gap-2">
                {confirmBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Template modal */}
      {showNewTpl && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-gray-900">New Prompt Template</p>
              <button onClick={() => setShowNewTpl(false)}><X className="w-4 h-4 text-gray-400 hover:text-gray-600" /></button>
            </div>
            {newTplError && <p className="text-xs text-rose-600 bg-rose-50 rounded-lg px-3 py-2">{newTplError}</p>}
            <div className="space-y-3">
              {([
                ["promptKey", "Prompt Key (unique slug, e.g. story_generation)", "text"],
                ["name", "Display Name", "text"],
                ["description", "Description (optional)", "text"],
                ["provider", "Provider (gemini / openai)", "text"],
                ["defaultModel", "Default Model (optional)", "text"],
              ] as [string, string, string][]).map(([field, label]) => (
                <div key={field}>
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">{label}</label>
                  <input value={(newTplForm as Record<string,string>)[field]} onChange={e => setNewTplForm(p => ({ ...p, [field]: e.target.value }))}
                    className="mt-1 w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
              ))}
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Prompt Type</label>
                <select value={newTplForm.promptType} onChange={e => setNewTplForm(p => ({ ...p, promptType: e.target.value }))}
                  className="mt-1 w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white">
                  {PROMPT_TYPES_LIST.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowNewTpl(false)} className="px-4 py-2 text-xs font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">Cancel</button>
              <button onClick={createTemplate} disabled={newTplSaving || !newTplForm.promptKey || !newTplForm.name}
                className="px-4 py-2 bg-violet-600 text-white text-xs font-bold rounded-xl hover:bg-violet-700 disabled:opacity-40 flex items-center gap-2">
                {newTplSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Create Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Version modal */}
      {showNewVer && selectedTpl && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
              <div>
                <p className="text-sm font-bold text-gray-900">New Version — {selectedTpl.name}</p>
                <p className="text-xs text-gray-400 mt-0.5 font-mono">{selectedTpl.promptKey}</p>
              </div>
              <button onClick={() => setShowNewVer(false)}><X className="w-4 h-4 text-gray-400 hover:text-gray-600" /></button>
            </div>
            <div className="overflow-auto flex-1 p-6 space-y-4">
              {newVerError && <p className="text-xs text-rose-600 bg-rose-50 rounded-lg px-3 py-2">{newVerError}</p>}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Version *</label>
                  <input value={newVerForm.version} onChange={e => setNewVerForm(p => ({ ...p, version: e.target.value }))} placeholder="e.g. 1.0.0"
                    className="mt-1 w-full text-sm font-mono border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Title</label>
                  <input value={newVerForm.title} onChange={e => setNewVerForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Added universe memory"
                    className="mt-1 w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Change Notes</label>
                <input value={newVerForm.changeNotes} onChange={e => setNewVerForm(p => ({ ...p, changeNotes: e.target.value }))}
                  placeholder="What changed and why?"
                  className="mt-1 w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Prompt Text *</label>
                <textarea value={newVerForm.promptText} onChange={e => setNewVerForm(p => ({ ...p, promptText: e.target.value }))} rows={10}
                  className="mt-1 w-full text-xs font-mono border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">System Instructions (optional)</label>
                <textarea value={newVerForm.systemInstructions} onChange={e => setNewVerForm(p => ({ ...p, systemInstructions: e.target.value }))} rows={3}
                  className="mt-1 w-full text-xs font-mono border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Variables JSON (optional)</label>
                <textarea value={newVerForm.variablesJson} onChange={e => setNewVerForm(p => ({ ...p, variablesJson: e.target.value }))} rows={3}
                  placeholder={'{"required":["heroName"],"optional":["universeMemory"]}'}
                  className="mt-1 w-full text-xs font-mono border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none" />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setShowNewVer(false)} className="px-4 py-2 text-xs font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">Cancel</button>
              <button onClick={createVersion} disabled={newVerSaving || !newVerForm.version || !newVerForm.promptText}
                className="px-4 py-2 bg-violet-600 text-white text-xs font-bold rounded-xl hover:bg-violet-700 disabled:opacity-40 flex items-center gap-2">
                {newVerSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Create Draft Version
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500">
            {templates.length} prompt template{templates.length !== 1 ? "s" : ""} ·{" "}
            {templates.filter(t => t.currentVersionStatus === "active").length} active ·{" "}
            {templates.filter(t => !t.currentVersionId).length} without active version
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={reseedDefaults} disabled={reseeding}
            title="Reseed all 17 default prompt templates with production content"
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-600 text-xs font-semibold rounded-xl hover:bg-gray-50 disabled:opacity-50 transition-colors">
            {reseeding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
            Reseed Defaults
          </button>
          <button onClick={() => setShowNewTpl(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 text-white text-xs font-bold rounded-xl hover:bg-violet-700 transition-colors">
            <Plus className="w-3.5 h-3.5" /> New Template
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search prompts…"
            className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500" />
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="text-xs border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white">
          <option value="">All Types</option>
          {PROMPT_TYPES_LIST.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <button onClick={loadTemplates} className="p-2 border border-gray-200 rounded-xl hover:bg-gray-50">
          <RefreshCw className="w-3.5 h-3.5 text-gray-400" />
        </button>
      </div>

      {/* Templates table */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-violet-500 animate-spin" /></div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {["Name / Key","Type","Provider / Model","Current Version","Actions"].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {displayed.length === 0 && (
                <tr><td colSpan={5} className="text-center py-10 text-xs text-gray-400">No prompt templates found.</td></tr>
              )}
              {displayed.map(tpl => (
                <Fragment key={tpl.id}>
                  <tr className={`hover:bg-gray-50/50 cursor-pointer transition-colors ${selectedTpl?.id === tpl.id ? "bg-violet-50/40" : ""}`}>
                    <td className="px-4 py-3">
                      <p className="text-xs font-semibold text-gray-900">{tpl.name}</p>
                      <p className="text-[10px] font-mono text-gray-400 mt-0.5">{tpl.promptKey}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${TYPE_COLOR}`}>{tpl.promptType}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs text-gray-700">{tpl.provider ?? "—"}</p>
                      <p className="text-[10px] text-gray-400 font-mono mt-0.5">{tpl.defaultModel ?? "—"}</p>
                    </td>
                    <td className="px-4 py-3">
                      {tpl.currentVersion
                        ? <div className="flex items-center gap-1.5"><Tag className="w-3 h-3 text-gray-400" /><span className="text-xs font-mono text-gray-700">{tpl.currentVersion}</span><StatusBadge status={tpl.currentVersionStatus ?? "inactive"} /></div>
                        : <span className="text-[10px] text-gray-400">No active version</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => selectTemplate(tpl)} title="View Versions"
                          className={`flex items-center gap-1 px-2 py-1 text-[10px] font-semibold rounded-lg border transition-colors ${selectedTpl?.id === tpl.id ? "bg-violet-100 border-violet-200 text-violet-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                          <ChevronDown className={`w-3 h-3 transition-transform ${selectedTpl?.id === tpl.id ? "rotate-180" : ""}`} /> {tpl.totalVersions} ver{tpl.totalVersions !== 1 ? "s" : ""}
                        </button>
                        <button onClick={() => { setSelectedTpl(tpl); setShowNewVer(true); void selectTemplate(tpl); }} title="New Version"
                          className="p-1.5 border border-gray-200 rounded-lg text-gray-500 hover:bg-violet-50 hover:border-violet-200 hover:text-violet-600 transition-colors">
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {/* Versions panel — inline accordion */}
                  {selectedTpl?.id === tpl.id && (
                    <tr>
                      <td colSpan={5} className="px-4 py-0 bg-violet-50/20">
                        {versionsLoading ? (
                          <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 text-violet-400 animate-spin" /></div>
                        ) : versions.length === 0 ? (
                          <div className="py-4 text-center">
                            <p className="text-xs text-gray-400 mb-2">No versions yet.</p>
                            <button onClick={() => setShowNewVer(true)} className="text-xs text-violet-600 font-semibold hover:underline flex items-center gap-1 mx-auto">
                              <Plus className="w-3 h-3" /> Create first version
                            </button>
                          </div>
                        ) : (
                          <div className="py-2">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-violet-100">
                                  {["Version","Title","Status","Activated","Change Notes","Actions"].map(h => (
                                    <th key={h} className="text-left px-3 py-1.5 text-[10px] font-semibold text-gray-400">{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-violet-50">
                                {versions.map(v => (
                                  <tr key={v.id} className="hover:bg-white/60">
                                    <td className="px-3 py-2">
                                      <span className="font-mono font-semibold text-gray-800">{v.version}</span>
                                      {v.isCurrent && <span className="ml-1.5 text-[9px] font-black text-emerald-600 bg-emerald-50 border border-emerald-200 px-1 rounded">CURRENT</span>}
                                    </td>
                                    <td className="px-3 py-2 text-gray-600 max-w-32 truncate">{v.title ?? "—"}</td>
                                    <td className="px-3 py-2"><StatusBadge status={v.status} /></td>
                                    <td className="px-3 py-2 text-gray-400 whitespace-nowrap">{v.activatedAt ? new Date(v.activatedAt).toLocaleDateString() : "—"}</td>
                                    <td className="px-3 py-2 text-gray-500 max-w-48 truncate italic">{v.changeNotes ?? "—"}</td>
                                    <td className="px-3 py-2">
                                      <div className="flex items-center gap-1">
                                        <button onClick={() => setViewingVersion(v)} title="View prompt text" className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"><Eye className="w-3.5 h-3.5" /></button>
                                        {v.status === "draft" && !v.isCurrent && (
                                          <button onClick={() => confirmActivate(v)} title="Activate" className="p-1 rounded hover:bg-emerald-50 text-gray-400 hover:text-emerald-600"><Check className="w-3.5 h-3.5" /></button>
                                        )}
                                        {v.status === "inactive" && !v.isCurrent && (
                                          <button onClick={() => confirmRollback(v)} title="Rollback to this version" className="p-1 rounded hover:bg-amber-50 text-gray-400 hover:text-amber-600"><RotateCcw className="w-3.5 h-3.5" /></button>
                                        )}
                                        <button onClick={() => duplicateVersion(v)} title="Duplicate as draft" className="p-1 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-600"><Copy className="w-3.5 h-3.5" /></button>
                                        {!v.isCurrent && v.status !== "archived" && (
                                          <button onClick={() => confirmArchive(v)} title="Archive" className="p-1 rounded hover:bg-slate-50 text-gray-400 hover:text-slate-600"><Archive className="w-3.5 h-3.5" /></button>
                                        )}
                                        {compareLeft?.id !== v.id && compareRight?.id !== v.id && (
                                          <button onClick={() => { if (!compareLeft) setCompareLeft(v); else { setCompareRight(v); setShowCompare(true); } }} title={compareLeft ? "Compare with selected" : "Select for compare"} className="p-1 rounded hover:bg-violet-50 text-gray-400 hover:text-violet-600">
                                            <GitCompare className="w-3.5 h-3.5" />
                                          </button>
                                        )}
                                        {(compareLeft?.id === v.id || compareRight?.id === v.id) && (
                                          <button onClick={() => { setCompareLeft(null); setCompareRight(null); }} title="Deselect" className="p-1 rounded bg-violet-100 text-violet-600"><GitCompare className="w-3.5 h-3.5" /></button>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            <div className="flex items-center gap-2 px-3 py-2 border-t border-violet-100">
                              <button onClick={() => setShowNewVer(true)} className="flex items-center gap-1 text-xs text-violet-600 font-semibold hover:underline">
                                <Plus className="w-3 h-3" /> New Version
                              </button>
                              {compareLeft && !compareRight && (
                                <span className="text-[10px] text-violet-600 font-semibold ml-auto flex items-center gap-1">
                                  <GitCompare className="w-3 h-3" /> {compareLeft.version} selected — click another version&apos;s compare icon
                                </span>
                              )}
                              {compareLeft && compareRight && (
                                <button onClick={() => setShowCompare(true)} className="ml-auto flex items-center gap-1 text-xs text-violet-600 font-semibold hover:underline">
                                  <GitCompare className="w-3 h-3" /> Compare v{compareLeft.version} ↔ v{compareRight.version}
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── TAB: Models ───────────────────────────────────────────────────────────────

function ModelsTab({ analytics, loading }: { analytics: AiAnalytics | null; loading: boolean }) {
  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-violet-500 animate-spin" /></div>;
  if (!analytics) return <p className="text-rose-500 text-sm py-8 text-center">Failed to load analytics.</p>;

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Models (All Time)</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {["Provider", "Model", "Requests", "Input Tokens", "Output Tokens", "Images", "Audio", "Cost (USD)"].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {analytics.byModel.map((r, i) => (
                <tr key={`${r.provider}-${r.model}-${i}`} className="hover:bg-gray-50/50">
                  <td className="px-4 py-2.5 text-xs text-gray-500 capitalize">{r.provider}</td>
                  <td className="px-4 py-2.5 font-mono text-xs font-medium text-gray-800">{r.model}</td>
                  <td className="px-4 py-2.5 tabular-nums text-xs text-gray-600">{Number(r.requestCount).toLocaleString()}</td>
                  <td className="px-4 py-2.5 tabular-nums text-xs text-gray-600">{Number(r.totalInputTokens).toLocaleString()}</td>
                  <td className="px-4 py-2.5 tabular-nums text-xs text-gray-600">{Number(r.totalOutputTokens).toLocaleString()}</td>
                  <td className="px-4 py-2.5 tabular-nums text-xs text-gray-600">{Number(r.imagesGenerated).toLocaleString()}</td>
                  <td className="px-4 py-2.5 tabular-nums text-xs text-gray-600">{Math.round(Number(r.audioSeconds))}s</td>
                  <td className="px-4 py-2.5 tabular-nums text-xs font-semibold text-gray-900">{fmt$(Number(r.estimatedCostUsd))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── TAB: Characters ───────────────────────────────────────────────────────────

function CharactersTab() {
  type CanonRow = { id: string; heroName: string; universeName?: string; userName?: string; lastUsedAt?: string; identityStability?: number; characterConfidence?: number; };
  const [data, setData] = useState<CanonRow[]>([]);
  const [loading, setLoading] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    setLoading(true);
    apiFetch("/admin/character-canons?limit=50").then((res: { items: CanonRow[] } | CanonRow[]) => {
      setData(Array.isArray(res) ? res : res.items ?? []);
    }).catch(() => null).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-violet-500 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Link href="/admin/character-canons" className="text-xs text-violet-600 hover:underline flex items-center gap-1">
          Manage Character Canons <ExternalLink className="w-3 h-3" />
        </Link>
      </div>
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Character Canons — Identity & Confidence</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {["Hero", "Universe", "User", "Identity Stability", "Confidence", "Last Used"].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">No character canons yet.</td></tr>
              ) : data.map(r => (
                <tr key={r.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-2.5 font-medium text-gray-800 text-xs">{r.heroName}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{r.universeName ?? "—"}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-400">{r.userName ?? "—"}</td>
                  <td className="px-4 py-2.5">{scoreBar(r.identityStability != null ? r.identityStability * 10 : null)}</td>
                  <td className="px-4 py-2.5">
                    {r.characterConfidence != null ? (
                      <span className={`text-xs font-bold ${confColor(r.characterConfidence * 10)}`}>{(r.characterConfidence * 10).toFixed(1)}</span>
                    ) : <span className="text-gray-300 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-400">{r.lastUsedAt ? new Date(r.lastUsedAt).toLocaleDateString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── TAB: Universes ────────────────────────────────────────────────────────────

function UniversesTab({ analytics, loading }: { analytics: AiAnalytics | null; loading: boolean }) {
  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-violet-500 animate-spin" /></div>;
  if (!analytics) return <p className="text-rose-500 text-sm py-8 text-center">Failed to load analytics.</p>;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Top Universes by AI Usage</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {["Universe", "Stories", "Images", "Audio", "Total AI Cost"].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {analytics.universeAnalytics.map((u, i) => (
                <tr key={`${u.universeId ?? i}`} className="hover:bg-gray-50/50">
                  <td className="px-4 py-2.5">
                    <span className="text-xs font-semibold text-gray-800">{u.universeName ?? "—"}</span>
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-xs text-gray-600">{Number(u.storyCount).toLocaleString()}</td>
                  <td className="px-4 py-2.5 tabular-nums text-xs text-gray-600">{Number(u.imagesGenerated).toLocaleString()}</td>
                  <td className="px-4 py-2.5 tabular-nums text-xs text-gray-600">{u.audioCount}</td>
                  <td className="px-4 py-2.5 tabular-nums text-xs font-semibold text-gray-900">{fmt$(Number(u.totalAiCostUsd))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── TAB: Settings ─────────────────────────────────────────────────────────────

type PresetKey = "development" | "balanced" | "strict" | "cost_optimized" | "custom";

interface PresetValues { [key: string]: string; }

const PRESETS: Record<Exclude<PresetKey, "custom">, PresetValues> = {
  development: {
    QA_ENABLED: "true", QA_ENABLE_AUTO_REGENERATION: "true",
    QA_ENABLE_IDENTITY_QA: "true", QA_ENABLE_STORY_QA: "true",
    QA_ENABLE_EXPRESSION_QA: "true", QA_ENABLE_DIALOGUE_QA: "true",
    QA_ENABLE_COMPOSITION_QA: "true", QA_ENABLE_NARRATION_QA: "true",
    QA_MIN_IDENTITY_SCORE: "8.0", QA_MIN_STORY_SCORE: "8.0",
    QA_MIN_EXPRESSION_SCORE: "7.5", QA_MIN_OVERALL_CONFIDENCE: "80",
    QA_MAX_RETRIES: "2",
    QA_WEIGHT_IDENTITY: "40", QA_WEIGHT_STORY: "20", QA_WEIGHT_EXPRESSION: "10",
    QA_WEIGHT_DIALOGUE: "10", QA_WEIGHT_COMPOSITION: "10",
    QA_WEIGHT_NARRATION: "5", QA_WEIGHT_STATE_CONSISTENCY: "5",
    QA_RETRY_STRATEGY: "page_only", QA_MODE: "debug",
  },
  balanced: {
    QA_ENABLED: "true", QA_ENABLE_AUTO_REGENERATION: "true",
    QA_ENABLE_IDENTITY_QA: "true", QA_ENABLE_STORY_QA: "true",
    QA_ENABLE_EXPRESSION_QA: "true", QA_ENABLE_DIALOGUE_QA: "true",
    QA_ENABLE_COMPOSITION_QA: "false", QA_ENABLE_NARRATION_QA: "true",
    QA_MIN_IDENTITY_SCORE: "8.5", QA_MIN_STORY_SCORE: "9.0",
    QA_MIN_EXPRESSION_SCORE: "8.0", QA_MIN_OVERALL_CONFIDENCE: "88",
    QA_MAX_RETRIES: "1",
    QA_WEIGHT_IDENTITY: "40", QA_WEIGHT_STORY: "20", QA_WEIGHT_EXPRESSION: "10",
    QA_WEIGHT_DIALOGUE: "10", QA_WEIGHT_COMPOSITION: "10",
    QA_WEIGHT_NARRATION: "5", QA_WEIGHT_STATE_CONSISTENCY: "5",
    QA_RETRY_STRATEGY: "page_only", QA_MODE: "balanced",
  },
  strict: {
    QA_ENABLED: "true", QA_ENABLE_AUTO_REGENERATION: "true",
    QA_ENABLE_IDENTITY_QA: "true", QA_ENABLE_STORY_QA: "true",
    QA_ENABLE_EXPRESSION_QA: "true", QA_ENABLE_DIALOGUE_QA: "true",
    QA_ENABLE_COMPOSITION_QA: "true", QA_ENABLE_NARRATION_QA: "true",
    QA_MIN_IDENTITY_SCORE: "9.0", QA_MIN_STORY_SCORE: "9.5",
    QA_MIN_EXPRESSION_SCORE: "9.0", QA_MIN_OVERALL_CONFIDENCE: "95",
    QA_MAX_RETRIES: "2",
    QA_WEIGHT_IDENTITY: "40", QA_WEIGHT_STORY: "20", QA_WEIGHT_EXPRESSION: "10",
    QA_WEIGHT_DIALOGUE: "10", QA_WEIGHT_COMPOSITION: "10",
    QA_WEIGHT_NARRATION: "5", QA_WEIGHT_STATE_CONSISTENCY: "5",
    QA_RETRY_STRATEGY: "scene", QA_MODE: "strict",
  },
  cost_optimized: {
    QA_ENABLED: "true", QA_ENABLE_AUTO_REGENERATION: "false",
    QA_ENABLE_IDENTITY_QA: "true", QA_ENABLE_STORY_QA: "true",
    QA_ENABLE_EXPRESSION_QA: "false", QA_ENABLE_DIALOGUE_QA: "false",
    QA_ENABLE_COMPOSITION_QA: "false", QA_ENABLE_NARRATION_QA: "true",
    QA_MIN_IDENTITY_SCORE: "8.0", QA_MIN_STORY_SCORE: "8.5",
    QA_MIN_EXPRESSION_SCORE: "7.0", QA_MIN_OVERALL_CONFIDENCE: "80",
    QA_MAX_RETRIES: "0",
    QA_WEIGHT_IDENTITY: "40", QA_WEIGHT_STORY: "20", QA_WEIGHT_EXPRESSION: "10",
    QA_WEIGHT_DIALOGUE: "10", QA_WEIGHT_COMPOSITION: "10",
    QA_WEIGHT_NARRATION: "5", QA_WEIGHT_STATE_CONSISTENCY: "5",
    QA_RETRY_STRATEGY: "never", QA_MODE: "fast",
  },
};

const PRESET_META: Record<PresetKey, { label: string; for: string; quality: number; cost: number; speed: number; color: string; badge?: string; }> = {
  development:   { label: "Development",          for: "Development & Testing",  quality: 4, cost: 4, speed: 4, color: "text-blue-600 bg-blue-50 border-blue-200" },
  balanced:      { label: "Balanced",             for: "Production",             quality: 5, cost: 3, speed: 4, color: "text-violet-600 bg-violet-50 border-violet-200", badge: "Recommended" },
  strict:        { label: "Strict Quality",        for: "Internal QA / Releases", quality: 5, cost: 1, speed: 2, color: "text-rose-600 bg-rose-50 border-rose-200" },
  cost_optimized:{ label: "Cost Optimized",        for: "Free Tier / Low Cost",   quality: 3, cost: 5, speed: 5, color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  custom:        { label: "Custom",               for: "Manual configuration",   quality: 0, cost: 0, speed: 0, color: "text-gray-600 bg-gray-50 border-gray-200" },
};

function Stars({ n, max = 5, col }: { n: number; max?: number; col?: string }) {
  return (
    <span className={`text-sm tracking-tight ${col ?? "text-amber-400"}`}>
      {"★".repeat(n)}{"☆".repeat(max - n)}
    </span>
  );
}

const PRESET_KEYS = Object.keys(PRESETS.balanced);

const QA_GROUPS: SettingGroup[] = [
  {
    title: "Master Toggle",
    description: "Enable or disable the QA Engine. When disabled, all stories pass automatically.",
    items: [
      { key: "QA_ENABLED", label: "QA Engine Enabled", description: "Master toggle.", type: "boolean" },
      { key: "QA_ENABLE_AUTO_REGENERATION", label: "Auto-Regeneration", description: "Regenerate pages that fail identity QA.", type: "boolean" },
    ],
  },
  {
    title: "QA Dimensions",
    description: "Enable/disable individual QA checks.",
    items: [
      { key: "QA_ENABLE_IDENTITY_QA",   label: "Identity QA",   description: "Face resemblance check vs approved avatar.", type: "boolean" },
      { key: "QA_ENABLE_STORY_QA",      label: "Story QA",      description: "Costume/companion continuity.", type: "boolean" },
      { key: "QA_ENABLE_EXPRESSION_QA", label: "Expression QA", description: "Expression-emotion matching.", type: "boolean" },
      { key: "QA_ENABLE_DIALOGUE_QA",   label: "Dialogue QA",   description: "Speaker validity and deduplication.", type: "boolean" },
      { key: "QA_ENABLE_COMPOSITION_QA",label: "Composition QA",description: "Vision composition check (expensive, off in Balanced).", type: "boolean" },
      { key: "QA_ENABLE_NARRATION_QA",  label: "Narration QA",  description: "Audio presence + text length.", type: "boolean" },
    ],
  },
  {
    title: "Thresholds",
    description: "Minimum scores for pages to pass QA.",
    items: [
      { key: "QA_MIN_IDENTITY_SCORE",    label: "Min Identity Score (0–10)",      description: "Pages below this will be retried.", type: "number" },
      { key: "QA_MIN_STORY_SCORE",       label: "Min Story Score (0–10)",         description: "Pages below this are flagged.", type: "number" },
      { key: "QA_MIN_EXPRESSION_SCORE",  label: "Min Expression Score (0–10)",    description: "Pages below this are flagged.", type: "number" },
      { key: "QA_MIN_OVERALL_CONFIDENCE",label: "Min Overall Confidence (0–100)", description: "Story confidence below this triggers page retries.", type: "number" },
      { key: "QA_MAX_RETRIES",           label: "Max Retries per Page",           description: "Cap on retry attempts. Set 0 to disable retries.", type: "number" },
    ],
  },
  {
    title: "Confidence Weights",
    description: "Percentage contribution of each dimension to the overall confidence score.",
    items: [
      { key: "QA_WEIGHT_IDENTITY",          label: "Identity (%)",           description: "Default 40 — highest because visual identity is the core promise.", type: "number" },
      { key: "QA_WEIGHT_STORY",             label: "Story Continuity (%)",   description: "Default 20.", type: "number" },
      { key: "QA_WEIGHT_EXPRESSION",        label: "Expression (%)",         description: "Default 10.", type: "number" },
      { key: "QA_WEIGHT_DIALOGUE",          label: "Dialogue (%)",           description: "Default 10.", type: "number" },
      { key: "QA_WEIGHT_COMPOSITION",       label: "Composition (%)",        description: "Default 10.", type: "number" },
      { key: "QA_WEIGHT_NARRATION",         label: "Narration (%)",          description: "Default 5.", type: "number" },
      { key: "QA_WEIGHT_STATE_CONSISTENCY", label: "State Consistency (%)",  description: "Default 5.", type: "number" },
    ],
  },
];

const BUDGET_GROUP: SettingGroup = {
  title: "Budget Protection",
  description: "Automatically cap AI spend per story and alert when daily/monthly limits are approached.",
  items: [
    { key: "QA_MAX_COST_PER_STORY",    label: "Max Cost Per Story (USD)",  description: "Hard cap on AI cost per story. Default $0.35.", type: "number" },
    { key: "QA_MAX_COST_PER_AVATAR",   label: "Max Cost Per Avatar (USD)", description: "Hard cap on AI cost per avatar generation. Default $0.10.", type: "number" },
    { key: "QA_MAX_COST_PER_PAGE",     label: "Max Cost Per Page (USD)",   description: "Hard cap on AI cost per story page. Default $0.05.", type: "number" },
    { key: "QA_STOP_REGEN_ON_BUDGET",  label: "Stop Regen on Budget Exceeded", description: "If a story exceeds the per-story cap, stop auto-regeneration immediately.", type: "boolean" },
    { key: "QA_NOTIFY_ADMIN_ON_BUDGET",label: "Notify Admin on Budget Alert",   description: "Send a platform alert when daily budget threshold is reached.", type: "boolean" },
    { key: "QA_DAILY_BUDGET_ALERT",    label: "Daily Budget Alert (USD)",       description: "AI spend threshold that triggers a daily alert. Default $50.", type: "number" },
    { key: "QA_MONTHLY_BUDGET_ALERT",  label: "Monthly Budget Alert (USD)",     description: "AI spend threshold that triggers a monthly alert. Default $1000.", type: "number" },
  ],
};

const ADVANCED_GROUP: SettingGroup = {
  title: "Advanced / Developer",
  description: "Developer-only options. These can break production behaviour — use with caution.",
  items: [
    { key: "QA_FORCE_REGENERATION",          label: "Force Regeneration",           description: "Regenerate every page regardless of QA score.", type: "boolean" },
    { key: "QA_DISABLE_CHARACTER_CANON",     label: "Disable Character Canon",      description: "Skip character canon lookup during generation.", type: "boolean" },
    { key: "QA_DISABLE_STORY_STATE",         label: "Disable Story State Tracker",  description: "Skip per-page state pre-computation.", type: "boolean" },
    { key: "QA_DISABLE_SPEECH_BUBBLES",      label: "Disable Speech Bubble Engine", description: "Skip speech bubble placement pass.", type: "boolean" },
    { key: "QA_DISABLE_CONFIDENCE_ENGINE",   label: "Disable Confidence Engine",    description: "Skip confidence scoring entirely.", type: "boolean" },
    { key: "QA_DISABLE_QA_LOGGING",          label: "Disable QA Logging",           description: "Do not write to story_qa_runs / story_qa_pages.", type: "boolean" },
    { key: "QA_PROMPT_VERSION_OVERRIDE",     label: "Prompt Version Override",      description: "Force a specific prompt version tag for A/B testing. Leave empty to use current.", type: "string" },
    { key: "QA_MODEL_OVERRIDE",              label: "Model Override",               description: "Override the AI model used for generation. Leave empty to use defaults.", type: "string" },
  ],
};

const ALL_SETTINGS_KEYS = [
  ...QA_GROUPS.flatMap(g => g.items.map(i => i.key)),
  ...BUDGET_GROUP.items.map(i => i.key),
  ...ADVANCED_GROUP.items.map(i => i.key),
  "QA_PRESET", "QA_RETRY_STRATEGY", "QA_MODE",
];

function SettingsTab() {
  const [saved, setSaved] = useState<Record<string, string>>({});  // last-saved values
  const [draft, setDraft] = useState<Record<string, string>>({});  // live edits
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [pendingPreset, setPendingPreset] = useState<PresetKey | null>(null);
  const loaded = useRef(false);

  // Derive active preset from saved state (what's in DB).
  const activePreset = (saved["QA_PRESET"] || "balanced") as PresetKey;

  // Base: if an active named preset is loaded from DB, show the preset's canonical
  // values so the fields always reflect what the preset means — not the raw seeded defaults.
  // Custom preset shows raw DB values.
  const activePresetValues: Record<string, string> =
    activePreset !== "custom" && PRESETS[activePreset as Exclude<PresetKey, "custom">]
      ? PRESETS[activePreset as Exclude<PresetKey, "custom">]
      : {};

  // When a different preset is being previewed (pendingPreset), overlay its values.
  const settings: Record<string, string> = pendingPreset && pendingPreset !== "custom"
    ? { ...saved, ...PRESETS[pendingPreset], QA_PRESET: pendingPreset }
    : { ...saved, ...activePresetValues, ...draft };

  const dirtyKeys = Object.keys(draft).filter(k => draft[k] !== (saved[k] ?? activePresetValues[k]));
  const hasDirty = dirtyKeys.length > 0;

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    setLoading(true);
    apiFetch("/admin/platform-settings").then((arr: Array<{ key: string; value: string }>) => {
      const m: Record<string, string> = {};
      arr.forEach(({ key, value }) => { if (ALL_SETTINGS_KEYS.includes(key)) m[key] = value; });
      setSaved(m);
      setDraft({});
    }).catch(() => null).finally(() => setLoading(false));
  }, []); // eslint-disable-line

  function change(key: string, value: string) {
    // Always mark preset as custom in draft when a preset-controlled key is edited
    const markCustom = PRESET_KEYS.includes(key) && activePreset !== "custom";
    setDraft(p => ({ ...p, [key]: value, ...(markCustom ? { QA_PRESET: "custom" } : {}) }));
  }

  async function commitMany(pairs: Record<string, string>) {
    const token = getAccessToken();
    if (!token) return;
    setSaving(true);
    try {
      await Promise.all(
        Object.entries(pairs).map(([key, value]) =>
          fetch(`${BASE}/admin/settings/${key}`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ value }),
          })
        )
      );
      setSaved(p => ({ ...p, ...pairs }));
      setDraft(p => {
        const next = { ...p };
        Object.keys(pairs).forEach(k => delete next[k]);
        return next;
      });
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2500);
    } finally { setSaving(false); }
  }

  async function saveAll() {
    if (dirtyKeys.length === 0) return;
    const toSave: Record<string, string> = {};
    // Materialize the active preset first so the DB has the correct base values.
    // Without this, switching to "custom" leaves raw seeded defaults in the DB
    // and all non-edited fields would revert to wrong values.
    if (activePreset !== "custom" && PRESETS[activePreset as Exclude<PresetKey, "custom">]) {
      Object.assign(toSave, PRESETS[activePreset as Exclude<PresetKey, "custom">]);
    }
    // Draft overrides the preset base (includes QA_PRESET: "custom" if a preset key was edited)
    dirtyKeys.forEach(k => { toSave[k] = draft[k]; });
    await commitMany(toSave);
  }

  async function applyPreset(key: PresetKey) {
    if (key === "custom") return;
    await commitMany({ ...PRESETS[key], QA_PRESET: key });
    setDraft({});
    setPendingPreset(null);
  }

  async function restoreBalanced() { await applyPreset("balanced"); }

  async function resetAll() {
    const allDefaults: Record<string, string> = {
      ...PRESETS.balanced,
      QA_PRESET: "balanced", QA_RETRY_STRATEGY: "page_only", QA_MODE: "balanced",
      QA_MAX_COST_PER_STORY: "0.35", QA_MAX_COST_PER_AVATAR: "0.10", QA_MAX_COST_PER_PAGE: "0.05",
      QA_STOP_REGEN_ON_BUDGET: "true", QA_NOTIFY_ADMIN_ON_BUDGET: "true",
      QA_DAILY_BUDGET_ALERT: "50", QA_MONTHLY_BUDGET_ALERT: "1000",
      QA_FORCE_REGENERATION: "false", QA_DISABLE_CHARACTER_CANON: "false",
      QA_DISABLE_STORY_STATE: "false", QA_DISABLE_SPEECH_BUBBLES: "false",
      QA_DISABLE_CONFIDENCE_ENGINE: "false", QA_DISABLE_QA_LOGGING: "false",
      QA_PROMPT_VERSION_OVERRIDE: "", QA_MODEL_OVERRIDE: "",
    };
    await commitMany(allDefaults);
    setDraft({});
    setShowResetConfirm(false);
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-violet-500 animate-spin" /></div>;

  // displayPreset reflects draft edits (shows "custom" as soon as a preset key is edited)
  const displayPreset = (settings["QA_PRESET"] || "balanced") as PresetKey;
  const meta = PRESET_META[displayPreset] ?? PRESET_META.balanced;
  const previewPreset = pendingPreset ?? (displayPreset !== "custom" ? displayPreset : null);
  const previewMeta = previewPreset ? PRESET_META[previewPreset] : null;

  function SettingRow({ item }: { item: SettingDef }) {
    const val = settings[item.key] ?? "";
    const isDirty = draft[item.key] !== undefined && draft[item.key] !== saved[item.key];
    return (
      <div className={`px-5 py-3 flex items-center gap-4 transition-colors ${isDirty ? "bg-amber-50/60" : ""}`}>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-gray-800 flex items-center gap-1.5">
            {item.label}
            {isDirty && <span className="text-[9px] font-bold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full">unsaved</span>}
          </p>
          <p className="text-[10px] text-gray-400 mt-0.5">{item.description}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {item.type === "boolean" ? (
            <button type="button"
              onClick={() => { const nv = val === "true" ? "false" : "true"; change(item.key, nv); }}
              disabled={saving}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${val === "true" ? "bg-violet-600" : "bg-gray-200"}`}>
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${val === "true" ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
          ) : item.type === "number" ? (
            <input type="number" value={val}
              onChange={e => change(item.key, e.target.value)}
              className={`w-20 text-right font-mono text-xs rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-violet-500 border ${isDirty ? "border-amber-300 bg-amber-50" : "border-gray-200"}`} />
          ) : (
            <input type="text" value={val}
              onChange={e => change(item.key, e.target.value)}
              className={`w-32 text-right font-mono text-xs rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-violet-500 border ${isDirty ? "border-amber-300 bg-amber-50" : "border-gray-200"}`} />
          )}
        </div>
      </div>
    );
  }

  function SettingGroupCard({ group }: { group: SettingGroup }) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
          <p className="text-xs font-bold text-gray-900">{group.title}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">{group.description}</p>
        </div>
        <div className="divide-y divide-gray-50">
          {group.items.map(item => <SettingRow key={item.key} item={item} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-3xl">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">All changes require clicking <strong>Save Changes</strong>. Editing any value switches the preset to Custom.</p>
        <Link href="/admin/settings" className="text-xs text-violet-600 hover:underline flex items-center gap-1">
          All Platform Settings <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      {/* ── Sticky Save Bar ── */}
      {(hasDirty || justSaved) && (
        <div className={`sticky top-0 z-10 rounded-2xl border shadow-lg px-5 py-3 flex items-center justify-between gap-4 transition-all ${
          justSaved ? "bg-emerald-50 border-emerald-200" : "bg-white border-amber-300"
        }`}>
          {justSaved ? (
            <span className="text-sm font-semibold text-emerald-700 flex items-center gap-2">
              <Check className="w-4 h-4" /> All changes saved successfully
            </span>
          ) : (
            <span className="text-sm font-semibold text-amber-700">
              {dirtyKeys.length} unsaved change{dirtyKeys.length !== 1 ? "s" : ""}
            </span>
          )}
          {!justSaved && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setDraft({}); }}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Discard
              </button>
              <button
                onClick={saveAll}
                disabled={saving}
                className="px-4 py-2 bg-violet-600 text-white text-sm font-bold rounded-xl hover:bg-violet-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Save Changes
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Preset Selector ── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gradient-to-r from-violet-50 to-fuchsia-50/40">
          <p className="text-xs font-bold text-gray-900">QA Configuration Preset</p>
          <p className="text-[10px] text-gray-400 mt-0.5">Apply a complete configuration in one click. Manual edits switch to Custom.</p>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div className="flex items-center gap-3">
            <select
              value={pendingPreset ?? displayPreset}
              onChange={e => {
                const k = e.target.value as PresetKey;
                if (k === "custom") { change("QA_PRESET", "custom"); return; }
                setPendingPreset(k);
              }}
              className="flex-1 text-sm font-semibold border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
            >
              {(Object.keys(PRESET_META) as PresetKey[]).map(k => (
                <option key={k} value={k}>{PRESET_META[k].label}{k === "balanced" ? " (Recommended)" : ""}</option>
              ))}
            </select>
            {pendingPreset && (
              <button onClick={() => applyPreset(pendingPreset)} disabled={saving}
                className="px-4 py-2 bg-violet-600 text-white text-xs font-bold rounded-xl hover:bg-violet-700 transition-colors disabled:opacity-50 flex items-center gap-1.5">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                Apply {PRESET_META[pendingPreset].label}
              </button>
            )}
            {pendingPreset && (
              <button onClick={() => setPendingPreset(null)} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">Cancel</button>
            )}
          </div>
          {!pendingPreset && (
            <div className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border ${meta.color}`}>
              {meta.label}
              {meta.badge && <span className="text-[9px] font-black uppercase tracking-wider">{meta.badge}</span>}
              {displayPreset === "custom" && <span className="text-gray-400 font-normal ml-0.5">— manual configuration</span>}
            </div>
          )}
        </div>
        {previewMeta && previewPreset !== "custom" && (
          <div className="px-5 pb-4 border-t border-gray-100">
            <div className="mt-3 grid grid-cols-4 gap-3">
              {[
                { label: "Quality",          n: previewMeta.quality, col: "text-violet-500" },
                { label: "AI Cost Efficiency", n: previewMeta.cost,   col: previewMeta.cost >= 4 ? "text-emerald-500" : previewMeta.cost <= 2 ? "text-rose-400" : "text-amber-400", sub: previewMeta.cost >= 4 ? "Low cost" : previewMeta.cost <= 2 ? "High cost" : "Medium" },
                { label: "Speed",            n: previewMeta.speed,   col: "text-blue-400" },
              ].map(({ label, n, col, sub }) => (
                <div key={label} className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-1">{label}</p>
                  <Stars n={n} col={col} />
                  {sub && <p className="text-[9px] text-gray-400 mt-0.5">{sub}</p>}
                </div>
              ))}
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-1">Best For</p>
                <p className="text-[10px] font-semibold text-gray-700 leading-tight">{previewMeta.for}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Generation Behaviour ── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
          <p className="text-xs font-bold text-gray-900">Generation Behaviour</p>
          <p className="text-[10px] text-gray-400 mt-0.5">Controls retry scope and which QA checks run.</p>
        </div>
        <div className="divide-y divide-gray-50">
          <div className="px-5 py-3 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-800">Retry Strategy</p>
              <p className="text-[10px] text-gray-400 mt-0.5"><strong>Never</strong> disables all auto-regeneration. <strong>Page Only</strong> (default) retries each failed page independently. Scene/Story scope coming soon.</p>
            </div>
            <select value={settings["QA_RETRY_STRATEGY"] ?? "page_only"}
              onChange={e => change("QA_RETRY_STRATEGY", e.target.value)}
              className={`text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white border ${draft["QA_RETRY_STRATEGY"] !== undefined && draft["QA_RETRY_STRATEGY"] !== saved["QA_RETRY_STRATEGY"] ? "border-amber-300" : "border-gray-200"}`}>
              <option value="never">Never Retry</option>
              <option value="page_only">Retry Failed Page Only (Default)</option>
              <option value="scene">Retry Entire Scene (same as Page Only for now)</option>
              <option value="story">Retry Entire Story (same as Page Only for now)</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Core QA groups ── */}
      {QA_GROUPS.map(group => <SettingGroupCard key={group.title} group={group} />)}

      {/* ── Budget Protection ── */}
      <SettingGroupCard group={BUDGET_GROUP} />

      {/* ── Advanced (collapsible) ── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <button onClick={() => setShowAdvanced(v => !v)}
          className="w-full px-5 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors">
          <div className="text-left">
            <p className="text-xs font-bold text-gray-900">Advanced / Developer Options</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Developer-only flags — can break production behaviour.</p>
          </div>
          <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${showAdvanced ? "rotate-90" : ""}`} />
        </button>
        {showAdvanced && (
          <div className="divide-y divide-gray-50 border-t border-gray-100">
            {ADVANCED_GROUP.items.map(item => <SettingRow key={item.key} item={item} />)}
          </div>
        )}
      </div>

      {/* ── Primary Save Button ── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-800">
              {hasDirty ? `${dirtyKeys.length} unsaved change${dirtyKeys.length !== 1 ? "s" : ""}` : "All settings saved"}
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5">Changes take effect on the next story generation.</p>
          </div>
          <div className="flex items-center gap-3">
            {hasDirty && (
              <button onClick={() => setDraft({})} className="px-3 py-1.5 text-xs font-medium text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                Discard
              </button>
            )}
            <button onClick={saveAll} disabled={saving || !hasDirty}
              className="px-5 py-2.5 bg-violet-600 text-white text-sm font-bold rounded-xl hover:bg-violet-700 transition-colors disabled:opacity-40 flex items-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Save Changes
            </button>
            {justSaved && !hasDirty && (
              <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Saved
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Restore / Reset ── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-800">Restore Defaults</p>
          <p className="text-[10px] text-gray-400 mt-0.5">Applies the Balanced (Recommended) preset to all settings.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={restoreBalanced} disabled={saving}
            className="px-4 py-2 border border-violet-200 text-violet-700 text-xs font-bold rounded-xl hover:bg-violet-50 transition-colors disabled:opacity-50">
            Restore Recommended Defaults
          </button>
          {!showResetConfirm ? (
            <button onClick={() => setShowResetConfirm(true)} className="px-4 py-2 border border-rose-200 text-rose-600 text-xs font-bold rounded-xl hover:bg-rose-50 transition-colors">
              Reset All Settings
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-rose-600 font-semibold">Reset everything?</span>
              <button onClick={resetAll} disabled={saving} className="px-3 py-1.5 bg-rose-600 text-white text-xs font-bold rounded-lg hover:bg-rose-700 transition-colors">
                Confirm Reset
              </button>
              <button onClick={() => setShowResetConfirm(false)} className="px-3 py-1.5 border border-gray-200 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-50 transition-colors">
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

// ─── TAB: Logs ─────────────────────────────────────────────────────────────────

const AI_OPERATIONS = [
  "story_generation","image_generation","narration","avatar_generation",
  "character_sheet_generation","cover_generation","story_page_generation",
  "video_generation","merchandise_generation","story_continuation",
];

function LogsTab() {
  const [data, setData] = useState<PaginatedResult<LogItem> | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [operation, setOperation] = useState("");
  const [provider, setProvider] = useState("");
  const loaded = useRef(false);

  const load = useCallback(async (p: number, s: string, op: string, prov: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: "50" });
      if (s.trim()) params.set("search", s.trim());
      if (op) params.set("operation", op);
      if (prov) params.set("provider", prov);
      const res = await apiFetch(`/admin/ai-analytics/logs?${params}`);
      setData(res);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!loaded.current) { loaded.current = true; void load(1, "", "", ""); }
  }, []); // eslint-disable-line

  function applyFilters() { setPage(1); void load(1, search, operation, provider); }
  function onPage(p: number) { setPage(p); void load(p, search, operation, provider); }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 bg-white rounded-xl border border-gray-200 px-4 py-3 shadow-sm">
        <Search className="w-3.5 h-3.5 text-gray-400" />
        <input
          type="text" placeholder="Search model, email, story…" value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === "Enter" && applyFilters()}
          className="flex-1 min-w-[180px] text-sm border-0 outline-none bg-transparent placeholder-gray-300"
        />
        <select value={operation} onChange={e => setOperation(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500">
          <option value="">All operations</option>
          {AI_OPERATIONS.map(op => <option key={op} value={op}>{op.replace(/_/g, " ")}</option>)}
        </select>
        <select value={provider} onChange={e => setProvider(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500">
          <option value="">All providers</option>
          {["openai", "gemini", "anthropic"].map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <button onClick={applyFilters} className="px-3 py-1.5 bg-violet-600 text-white text-xs font-semibold rounded-lg hover:bg-violet-700 transition-colors">Search</button>
        {loading && <Loader2 className="w-3.5 h-3.5 text-violet-500 animate-spin" />}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {["Provider", "Model", "Operation", "User", "Story", "Tokens In", "Tokens Out", "Images", "Audio", "Cost", "Sandbox", "Time"].map(h => (
                  <th key={h} className="text-left px-3 py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {!data || data.items.length === 0 ? (
                <tr><td colSpan={12} className="px-4 py-8 text-center text-gray-400 text-sm">No logs found.</td></tr>
              ) : data.items.map(r => (
                <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-3 py-2 text-[10px] font-semibold text-gray-600 capitalize">{r.provider}</td>
                  <td className="px-3 py-2 font-mono text-[10px] text-gray-700">{r.model}</td>
                  <td className="px-3 py-2 text-[10px] text-gray-500">{r.operation.replace(/_/g, " ")}</td>
                  <td className="px-3 py-2 text-[10px] text-gray-500 truncate max-w-[100px]">{r.userEmail ?? "—"}</td>
                  <td className="px-3 py-2 text-[10px] text-gray-500 truncate max-w-[100px]">{r.storyTitle ?? "—"}</td>
                  <td className="px-3 py-2 tabular-nums text-[10px] text-gray-500">{r.inputTokens.toLocaleString()}</td>
                  <td className="px-3 py-2 tabular-nums text-[10px] text-gray-500">{r.outputTokens.toLocaleString()}</td>
                  <td className="px-3 py-2 tabular-nums text-[10px] text-gray-500">{r.imagesGenerated || "—"}</td>
                  <td className="px-3 py-2 tabular-nums text-[10px] text-gray-500">{r.audioSeconds ? `${r.audioSeconds.toFixed(0)}s` : "—"}</td>
                  <td className="px-3 py-2 tabular-nums text-[10px] font-medium text-gray-800">{fmt$(r.estimatedCostUsd, 5)}</td>
                  <td className="px-3 py-2">
                    {r.isSandbox && <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">SB</span>}
                  </td>
                  <td className="px-3 py-2 text-[10px] text-gray-400 whitespace-nowrap">{new Date(r.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data && (
          <div className="px-4 pb-4 pt-2">
            <Pagination page={page} totalPages={data.totalPages} onChange={onPage} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

const TABS = [
  { id: "overview",   label: "Overview",     icon: BarChart3   },
  { id: "runs",       label: "Gen Runs",     icon: Zap         },
  { id: "quality",    label: "Quality",      icon: Shield      },
  { id: "costs",      label: "Costs",        icon: DollarSign  },
  { id: "prompts",    label: "Prompts",      icon: Layers      },
  { id: "models",     label: "Models",       icon: Cpu         },
  { id: "characters", label: "Characters",   icon: User        },
  { id: "universes",  label: "Universes",    icon: Globe       },
  { id: "settings",   label: "Settings",     icon: Settings    },
  { id: "logs",       label: "Logs",         icon: Activity    },
] as const;

type TabId = typeof TABS[number]["id"];

export default function AiControlCenter() {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [analytics, setAnalytics] = useState<AiAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const data = await apiFetch("/admin/ai-analytics");
      setAnalytics(data as AiAnalytics);
    } catch {
      setAnalytics(null);
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  useEffect(() => { void loadAnalytics(); }, [loadAnalytics, refreshKey]); // eslint-disable-line

  const CONTENT: Record<TabId, React.ReactNode> = {
    overview:   <OverviewTab   analytics={analytics} loading={analyticsLoading} />,
    runs:       <RunsTab />,
    quality:    <QualityTab />,
    costs:      <CostsTab     analytics={analytics} loading={analyticsLoading} />,
    prompts:    <PromptsTab />,
    models:     <ModelsTab    analytics={analytics} loading={analyticsLoading} />,
    characters: <CharactersTab />,
    universes:  <UniversesTab analytics={analytics} loading={analyticsLoading} />,
    settings:   <SettingsTab />,
    logs:       <LogsTab />,
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center text-white shadow-sm">
            <Bot className="w-4.5 h-4.5" />
          </div>
          <div>
            <h1 className="text-gray-900 text-2xl font-extrabold leading-tight">AI Control Center</h1>
            <p className="text-gray-400 text-xs mt-0.5">HeroKids Universe · Generation · Quality · Costs · Logs</p>
          </div>
        </div>
        <button onClick={() => setRefreshKey(k => k + 1)} className="p-2 rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Sandbox warning */}
      {analytics?.isSandbox && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-amber-800 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span><strong>Sandbox mode active.</strong> Data shown is from test runs only.</span>
        </div>
      )}

      {/* Tab nav */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex overflow-x-auto border-b border-gray-100 scrollbar-hide">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-xs font-semibold whitespace-nowrap border-b-2 transition-all ${
                activeTab === id
                  ? "border-violet-600 text-violet-700 bg-violet-50/50"
                  : "border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="p-5">
          {CONTENT[activeTab]}
        </div>
      </div>
    </div>
  );
}
