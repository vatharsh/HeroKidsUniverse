"use client";

import { Activity, Loader2, RefreshCw, TrendingUp } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";

import { getAccessToken } from "@/lib/api";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

interface RecentRun {
  id: string;
  storyId: string;
  storyTitle: string | null;
  userEmail: string | null;
  overallConfidence: number | null;
  overallStatus: string;
  avgIdentityScore: number | null;
  pagesRetried: number;
  createdAt: string;
}

interface FailureReason {
  reason: string;
  count: number;
}

interface ConfidenceTrendPoint {
  date: string;
  avgConfidence: number;
  count: number;
}

interface QaDashboard {
  totalRuns: number;
  avgOverallConfidence: number;
  avgIdentityScore: number;
  avgStoryScore: number;
  avgExpressionScore: number;
  avgDialogueScore: number;
  avgCompositionScore: number;
  avgNarrationScore: number;
  passRate: number;
  retryRate: number;
  storiesAcceptedFirstAttempt: number;
  storiesRequiringRetry: number;
  failedPages: number;
  recentRuns: RecentRun[];
  topFailureReasons: FailureReason[];
  confidenceTrend: ConfidenceTrendPoint[];
}

type Days = 7 | 30 | 90;

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-gray-500 text-xs font-black uppercase tracking-[0.2em] mb-3 mt-8">
      {children}
    </h2>
  );
}

function MetricCard({
  label,
  value,
  sub,
  accent = "violet",
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "violet" | "emerald" | "amber" | "sky" | "rose";
}) {
  const cls = {
    violet:  "from-violet-50 via-white to-violet-50 border-violet-100 text-violet-700",
    emerald: "from-emerald-50 via-white to-emerald-50 border-emerald-100 text-emerald-700",
    amber:   "from-amber-50 via-white to-amber-50 border-amber-100 text-amber-700",
    sky:     "from-sky-50 via-white to-sky-50 border-sky-100 text-sky-700",
    rose:    "from-rose-50 via-white to-rose-50 border-rose-100 text-rose-700",
  }[accent];

  return (
    <div className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br ${cls} shadow-[0_10px_30px_rgba(15,23,42,0.06)] px-4 py-4`}>
      <div className="absolute inset-x-0 top-0 h-1 bg-current opacity-10" />
      <p className="text-gray-500 text-[10px] uppercase tracking-[0.22em] font-black mb-2">{label}</p>
      <p className="text-gray-900 font-black text-xl leading-none">{value}</p>
      {sub && <p className="text-gray-400 text-[11px] font-semibold mt-2">{sub}</p>}
    </div>
  );
}

function ConfidenceBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-gray-300 text-xs">—</span>;
  const level =
    score >= 95 ? { label: "Excellent", cls: "bg-emerald-100 text-emerald-700" } :
    score >= 90 ? { label: "Very Good", cls: "bg-sky-100 text-sky-700" } :
    score >= 80 ? { label: "Good",      cls: "bg-violet-100 text-violet-700" } :
    score >= 70 ? { label: "Acceptable",cls: "bg-amber-100 text-amber-700" } :
                  { label: "Poor",      cls: "bg-rose-100 text-rose-700" };
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${level.cls}`}>
      {score.toFixed(0)}% · {level.label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    pass:               "bg-emerald-50 text-emerald-700",
    pass_with_warning:  "bg-amber-50 text-amber-700",
    fail:               "bg-rose-50 text-rose-700",
    pending:            "bg-gray-100 text-gray-500",
  };
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cls[status] ?? "bg-gray-100 text-gray-500"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

function ScoreBar({ score, label }: { score: number; label: string }) {
  const pct = Math.round(score * 10);
  const color =
    pct >= 85 ? "bg-emerald-500" :
    pct >= 70 ? "bg-violet-500" :
    pct >= 55 ? "bg-amber-400" :
                "bg-rose-400";

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-500 w-32 flex-shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-bold text-gray-800 w-8 text-right">{score.toFixed(1)}</span>
    </div>
  );
}

function Table({ heads, rows }: { heads: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-3xl border border-gray-200/80 shadow-[0_12px_36px_rgba(15,23,42,0.05)] bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gradient-to-r from-gray-50 via-white to-violet-50/40">
            {heads.map((h) => (
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
            <tr>
              <td colSpan={heads.length} className="px-4 py-10 text-center text-gray-400 text-xs">
                No QA data yet. QA runs automatically after each story generation when QA is enabled.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function QaDashboardPage() {
  const [data, setData] = useState<QaDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [days, setDays] = useState<Days>(30);

  function load(d: Days = days) {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    fetch(`${BASE}/admin/qa/dashboard?days=${d}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((j) => {
        const d = j.data ?? j;
        if (d && typeof d.totalRuns !== "undefined") setData(d as QaDashboard);
        else setError("Unexpected response — QA endpoint may not be deployed yet.");
      })
      .catch(() => setError("Network error loading QA dashboard."))
      .finally(() => setLoading(false));
  }

  function setFilter(d: Days) {
    setDays(d);
    load(d);
  }

  useEffect(() => { load(); }, []); // eslint-disable-line

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 text-violet-600 animate-spin" />
      </div>
    );

  if (error || !data)
    return (
      <div className="p-8 max-w-xl mx-auto">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <p className="text-amber-800 font-bold text-sm mb-1">QA Dashboard Not Available</p>
          <p className="text-amber-700 text-xs leading-relaxed">
            {error || "No data returned."}
          </p>
          <p className="text-amber-600 text-xs mt-3 leading-relaxed">
            Hand <strong>CODEX_MILESTONE3_AI_QA_ENGINE.md</strong> to Codex to implement the backend QA engine and admin endpoint.
          </p>
          <button
            onClick={() => load()}
            className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-violet-600 hover:text-violet-800 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
      </div>
    );

  const fmt1 = (n: number | null | undefined) =>
    n == null ? "—" : n.toFixed(1);

  return (
    <div className="p-6 max-w-7xl mx-auto relative">
      {/* Page header */}
      <div className="absolute inset-x-6 top-4 h-32 rounded-[2rem] bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.12),transparent_30%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.08),transparent_28%)] pointer-events-none" />

      <div className="relative mb-6 flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-600 via-fuchsia-600 to-emerald-500 shadow-[0_12px_30px_rgba(139,92,246,0.25)] flex items-center justify-center text-white">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-violet-700 mb-2">
              Self-improving quality engine
            </div>
            <h1 className="text-gray-900 text-3xl font-black leading-none">AI Quality Dashboard</h1>
            <p className="text-gray-500 text-sm mt-2 font-medium">
              Every story is automatically scored for identity, continuity, expressions, dialogue, and narration.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-full border border-gray-200 bg-white/80 p-1 text-xs shadow-sm">
            {([7, 30, 90] as Days[]).map((d) => (
              <button
                key={d}
                onClick={() => setFilter(d)}
                className={`px-3 py-1 rounded-full font-semibold transition ${days === d ? "bg-violet-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-800"}`}
              >
                {d}d
              </button>
            ))}
          </div>
          <button
            onClick={() => load()}
            className="p-2 rounded-full border border-gray-200 text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <a
            href="/admin/qa/settings"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-violet-200 text-violet-700 text-xs font-semibold hover:bg-violet-50 transition"
          >
            QA Settings
          </a>
        </div>
      </div>

      {/* Top KPI grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3 mb-6">
        <MetricCard label="Avg Confidence"        value={`${data.avgOverallConfidence.toFixed(1)}%`} accent="violet" />
        <MetricCard label="Avg Identity Score"    value={fmt1(data.avgIdentityScore) + "/10"}       accent="sky"    />
        <MetricCard label="Pass Rate"             value={`${data.passRate.toFixed(0)}%`}             accent="emerald"/>
        <MetricCard label="Retry Rate"            value={`${data.retryRate.toFixed(0)}%`}             accent="amber"  sub={`${data.storiesRequiringRetry} stories retried`} />
        <MetricCard label="Failed Pages"          value={String(data.failedPages)}                   accent="rose"   />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 mb-6">
        <MetricCard label="Total QA Runs"         value={data.totalRuns.toLocaleString()} accent="violet" />
        <MetricCard label="First Attempt Pass"    value={data.storiesAcceptedFirstAttempt.toLocaleString()} accent="emerald" sub="no retry needed" />
        <MetricCard label="Avg Story Score"       value={fmt1(data.avgStoryScore) + "/10"} accent="sky" />
        <MetricCard label="Avg Narration Score"   value={fmt1(data.avgNarrationScore) + "/10"} accent="violet" />
      </div>

      {/* Score bars */}
      <div className="bg-white rounded-3xl border border-gray-200 p-6 shadow-sm mb-6">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-500 mb-4">Average Scores by Dimension</p>
        <div className="space-y-3 max-w-lg">
          <ScoreBar label="Identity"          score={data.avgIdentityScore}    />
          <ScoreBar label="Story Continuity"  score={data.avgStoryScore}       />
          <ScoreBar label="Expressions"       score={data.avgExpressionScore}  />
          <ScoreBar label="Dialogue"          score={data.avgDialogueScore}    />
          <ScoreBar label="Composition"       score={data.avgCompositionScore} />
          <ScoreBar label="Narration"         score={data.avgNarrationScore}   />
        </div>
      </div>

      {/* Confidence trend */}
      {data.confidenceTrend.length > 0 && (
        <>
          <SectionTitle>
            <span className="flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5" /> Confidence Trend</span>
          </SectionTitle>
          <Table
            heads={["Date", "Avg Confidence", "Stories"]}
            rows={data.confidenceTrend.map((t) => [
              t.date,
              <ConfidenceBadge key="c" score={t.avgConfidence} />,
              t.count,
            ])}
          />
        </>
      )}

      {/* Top failure reasons */}
      {data.topFailureReasons.length > 0 && (
        <>
          <SectionTitle>Top Failure Reasons</SectionTitle>
          <Table
            heads={["Failure Reason", "Count"]}
            rows={data.topFailureReasons.map((f) => [
              f.reason,
              <span key="c" className="font-bold text-rose-600">{f.count}</span>,
            ])}
          />
        </>
      )}

      {/* Recent runs */}
      <SectionTitle>Recent QA Runs</SectionTitle>
      <Table
        heads={["Story", "User", "Confidence", "Status", "Identity", "Retried Pages", "Date"]}
        rows={data.recentRuns.map((r) => [
          <a key="s" href={`/admin/stories/${r.storyId}/debug`} className="text-violet-600 hover:underline font-medium">
            {r.storyTitle?.slice(0, 30) ?? r.storyId.slice(0, 8) + "…"}
          </a>,
          r.userEmail ?? "—",
          <ConfidenceBadge key="c" score={r.overallConfidence} />,
          <StatusBadge key="st" status={r.overallStatus} />,
          fmt1(r.avgIdentityScore) + "/10",
          r.pagesRetried > 0 ? <span key="rt" className="text-amber-600 font-bold">{r.pagesRetried}</span> : "0",
          new Date(r.createdAt).toLocaleDateString(),
        ])}
      />
    </div>
  );
}
