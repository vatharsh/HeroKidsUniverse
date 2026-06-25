"use client";

import { Bot, Loader2, RefreshCw } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";

import { getAccessToken } from "@/lib/api";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

interface ByProvider {
  provider: string;
  requestCount: number;
  storiesGenerated: number;
  imagesGenerated: number;
  narrationSeconds: number;
  estimatedCostUsd: number;
}
interface ByModel {
  provider: string;
  model: string;
  requestCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  imagesGenerated: number;
  audioSeconds: number | string;
  estimatedCostUsd: number;
}
interface ByOperation {
  operation: string;
  requestCount: number;
  avgCostUsd: number;
  totalCostUsd: number;
}
interface TopStory {
  storyId: string;
  title: string;
  userEmail: string;
  storyCostUsd: number;
  imageCostUsd: number;
  audioCostUsd: number;
  videoCostUsd: number;
  totalCostUsd: number;
}
interface TopUser {
  userId: string;
  name: string;
  email: string;
  storyCount: number;
  imagesGenerated: number;
  audioSeconds: number;
  totalAiCostUsd: number;
}
interface UniverseAnalytic {
  universeId: string;
  universeName: string;
  storyCount: number;
  imagesGenerated: number;
  audioCount: number;
  totalAiCostUsd: number;
}
interface AiAnalyticsData {
  aiCostToday: number;
  aiCostThisMonth: number;
  totalStoriesGenerated: number;
  totalImagesGenerated: number;
  totalNarrationSeconds: number;
  totalVideosGenerated: number;
  avgCostPerStory: number;
  avgCostPerImage: number;
  avgCostPerNarrationMinute: number;
  byProvider: ByProvider[];
  byModel: ByModel[];
  byOperation: ByOperation[];
  topExpensiveStories: TopStory[];
  topExpensiveUsers: TopUser[];
  universeAnalytics: UniverseAnalytic[];
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-gray-500 text-xs font-black uppercase tracking-[0.2em] mb-3 mt-8">{children}</h2>;
}

function MetricCard({
  label,
  value,
  accent = "violet",
  sub,
}: {
  label: string;
  value: string;
  accent?: "violet" | "amber" | "emerald" | "sky" | "rose";
  sub?: string;
}) {
  const accents = {
    violet: "from-violet-50 via-white to-violet-50 border-violet-100 text-violet-700",
    amber: "from-amber-50 via-white to-amber-50 border-amber-100 text-amber-700",
    emerald: "from-emerald-50 via-white to-emerald-50 border-emerald-100 text-emerald-700",
    sky: "from-sky-50 via-white to-sky-50 border-sky-100 text-sky-700",
    rose: "from-rose-50 via-white to-rose-50 border-rose-100 text-rose-700",
  }[accent];

  return (
    <div className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br ${accents} shadow-[0_10px_30px_rgba(15,23,42,0.06)] px-4 py-4`}>
      <div className="absolute inset-x-0 top-0 h-1 bg-current opacity-10" />
      <p className="text-gray-500 text-[10px] uppercase tracking-[0.22em] font-black mb-2">{label}</p>
      <p className="text-gray-900 font-black text-xl leading-none">{value}</p>
      {sub && <p className="text-gray-400 text-[11px] font-semibold mt-2">{sub}</p>}
    </div>
  );
}

function Table({ heads, rows }: { heads: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-3xl border border-gray-200/80 shadow-[0_12px_36px_rgba(15,23,42,0.05)] bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gradient-to-r from-gray-50 via-white to-violet-50/40">
            {heads.map(h => (
              <th key={h} className="text-left px-4 py-3 text-gray-500 text-[10px] font-black uppercase tracking-[0.18em] whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-gray-100 last:border-0 hover:bg-violet-50/40 transition-colors">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">{cell}</td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={heads.length} className="px-4 py-6 text-center text-gray-400 text-xs">No data yet</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function AiAnalyticsPage() {
  const [data, setData] = useState<AiAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [backfilling, setBackfilling] = useState(false);
  const [backfillResult, setBackfillResult] = useState<{ updatedLogs: number; updatedStories: number } | null>(null);

  function loadData() {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    fetch(`${BASE}/admin/ai-analytics`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(j => setData(j.data ?? j))
      .catch(() => setError("Failed to load AI analytics"))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadData(); }, []);

  async function runBackfill() {
    const token = getAccessToken();
    if (!token) return;
    setBackfilling(true);
    setBackfillResult(null);
    try {
      const res = await fetch(`${BASE}/admin/backfill-ai-costs`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await res.json();
      const result = j.data ?? j;
      setBackfillResult(result as { updatedLogs: number; updatedStories: number });
      loadData();
    } catch {
      setError("Backfill failed");
    } finally {
      setBackfilling(false);
    }
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-6 h-6 text-violet-600 animate-spin" /></div>;
  if (error || !data) return <div className="flex items-center justify-center min-h-screen"><p className="text-red-500 text-sm">{error || "No data"}</p></div>;

  const fmt = (n: number) => `$${Number(n).toFixed(4)}`;

  return (
    <div className="p-6 max-w-7xl mx-auto relative">
      <div className="absolute inset-x-6 top-4 h-32 rounded-[2rem] bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.12),transparent_30%),radial-gradient(circle_at_top_right,rgba(251,191,36,0.10),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.9),rgba(255,255,255,0))] pointer-events-none" />
      <div className="relative mb-6 flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-600 via-fuchsia-600 to-amber-500 shadow-[0_12px_30px_rgba(139,92,246,0.25)] flex items-center justify-center text-white">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-violet-700 mb-2">
              Live spend monitor
            </div>
            <h1 className="text-gray-900 text-3xl font-black leading-none">AI Analytics</h1>
            <p className="text-gray-500 text-sm mt-2 font-medium">Provider spend, model usage, and story cost breakdowns.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {backfillResult && (
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-full shadow-sm">
              Recalculated {backfillResult.updatedLogs} log entries across {backfillResult.updatedStories} stories
            </span>
          )}
          <button
            type="button"
            onClick={runBackfill}
            disabled={backfilling}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white text-sm font-semibold shadow-[0_12px_30px_rgba(139,92,246,0.25)] disabled:opacity-60 hover:brightness-105 transition"
          >
            {backfilling ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Recalculate Historical Costs
          </button>
        </div>
      </div>

      {/* Top cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 mb-3">
        {[
          { label: "AI Cost Today",      value: `$${Number(data.aiCostToday).toFixed(4)}`,         accent: "rose" },
          { label: "AI Cost This Month", value: `$${Number(data.aiCostThisMonth).toFixed(2)}`,     accent: "rose" },
          { label: "Stories Generated",  value: data.totalStoriesGenerated.toLocaleString(),        accent: "violet" },
          { label: "Images Generated",   value: data.totalImagesGenerated.toLocaleString(),         accent: "sky" },
          { label: "Videos Generated",   value: data.totalVideosGenerated.toLocaleString(),         accent: "amber" },
          { label: "Narration (min)",     value: (data.totalNarrationSeconds / 60).toFixed(1),      accent: "emerald" },
          { label: "Avg Cost / Story",   value: fmt(data.avgCostPerStory),                          accent: "violet" },
          { label: "Avg Cost / Image",   value: fmt(data.avgCostPerImage),                          accent: "sky" },
          { label: "Avg Cost / Min Narr",value: fmt(data.avgCostPerNarrationMinute),                accent: "emerald" },
        ].map(({ label, value, accent }) => (
          <MetricCard
            key={label}
            label={label}
            value={value}
            accent={accent as any}
            sub="updated live from the platform logs"
          />
        ))}
      </div>

      <div className="mb-2 grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="rounded-3xl border border-violet-100 bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 p-5 shadow-[0_12px_36px_rgba(139,92,246,0.08)]">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-600 mb-2">Spend focus</p>
          <p className="text-gray-900 font-black text-lg">OpenAI image generation is the main cost driver right now.</p>
          <p className="text-gray-500 text-sm mt-2 leading-6">Use this panel to compare which provider or model is responsible for the most spend over time.</p>
        </div>
        <div className="rounded-3xl border border-amber-100 bg-gradient-to-br from-amber-50 via-white to-white p-5 shadow-[0_12px_36px_rgba(245,158,11,0.08)]">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-600 mb-2">Operational note</p>
          <p className="text-gray-900 font-black text-lg">Historical cost backfill keeps the numbers honest.</p>
          <p className="text-gray-500 text-sm mt-2 leading-6">If logging rules change, rerun the recalculation to restore story and user totals.</p>
        </div>
        <div className="rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-white p-5 shadow-[0_12px_36px_rgba(16,185,129,0.08)]">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 mb-2">Reading the page</p>
          <p className="text-gray-900 font-black text-lg">Bold rows are your highest-cost story or user entries.</p>
          <p className="text-gray-500 text-sm mt-2 leading-6">The subtle color blocks are there to help eyes move quickly without the page getting noisy.</p>
        </div>
      </div>

      <SectionTitle>By Provider</SectionTitle>
      <Table
        heads={["Provider", "Requests", "Stories", "Images", "Narration (min)", "Est. Cost (USD)"]}
        rows={data.byProvider.map(p => [
          p.provider,
          p.requestCount.toLocaleString(),
          p.storiesGenerated.toLocaleString(),
          p.imagesGenerated.toLocaleString(),
          (p.narrationSeconds / 60).toFixed(1),
          `$${Number(p.estimatedCostUsd).toFixed(4)}`,
        ])}
      />

      <SectionTitle>By Model</SectionTitle>
      <Table
        heads={["Provider", "Model", "Requests", "Input Tokens", "Output Tokens", "Images", "Audio (sec)", "Est. Cost"]}
        rows={data.byModel.map(m => [
          m.provider,
          m.model,
          m.requestCount.toLocaleString(),
          m.totalInputTokens.toLocaleString(),
          m.totalOutputTokens.toLocaleString(),
          m.imagesGenerated.toLocaleString(),
          Number(m.audioSeconds).toFixed(0),
          `$${Number(m.estimatedCostUsd).toFixed(4)}`,
        ])}
      />

      <SectionTitle>By Feature / Operation</SectionTitle>
      <Table
        heads={["Operation", "Requests", "Avg Cost", "Total Cost"]}
        rows={data.byOperation.map(op => [
          op.operation.replace(/_/g, " "),
          op.requestCount.toLocaleString(),
          fmt(op.avgCostUsd),
          fmt(op.totalCostUsd),
        ])}
      />

      <SectionTitle>Top 10 Expensive Stories</SectionTitle>
      <Table
        heads={["Title", "User", "Story", "Images", "Audio", "Video", "Total"]}
        rows={data.topExpensiveStories.map(s => [
          s.title || s.storyId.slice(0, 8),
          s.userEmail,
          fmt(s.storyCostUsd),
          fmt(s.imageCostUsd),
          fmt(s.audioCostUsd),
          fmt(s.videoCostUsd),
          <strong key="t" className="text-red-600">{fmt(s.totalCostUsd)}</strong>,
        ])}
      />

      <SectionTitle>Top 10 Expensive Users</SectionTitle>
      <Table
        heads={["User", "Email", "Stories", "Images", "Audio (min)", "Total AI Cost"]}
        rows={data.topExpensiveUsers.map(u => [
          u.name,
          u.email,
          u.storyCount,
          u.imagesGenerated,
          (u.audioSeconds / 60).toFixed(1),
          <strong key="c" className="text-red-600">{`$${Number(u.totalAiCostUsd).toFixed(4)}`}</strong>,
        ])}
      />

      <SectionTitle>Universe Analytics (Top 20 by Cost)</SectionTitle>
      <Table
        heads={["Universe", "Stories", "Images", "Audio Files", "AI Cost"]}
        rows={data.universeAnalytics.map(u => [
          u.universeName,
          u.storyCount,
          u.imagesGenerated,
          u.audioCount,
          `$${Number(u.totalAiCostUsd).toFixed(4)}`,
        ])}
      />
    </div>
  );
}
