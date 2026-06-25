"use client";

import { Loader2, RefreshCw, Search, Trash2, Zap } from "lucide-react";
import { useEffect, useState } from "react";

import { getAccessToken } from "@/lib/api";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

const STATUS_OPTIONS = ["", "queued", "generating_story", "generating_cover", "generating_images", "generating_audio", "saving_memory", "completed", "failed"];

interface Job {
  id: string;
  userId: string;
  storyId: string;
  universeId: string | null;
  status: string;
  currentStep: string | null;
  progressPercentage: number;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  userEmail?: string;
  storyTitle?: string;
  universeName?: string;
}

interface Paginated {
  items: Job[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const STATUS_STYLE: Record<string, string> = {
  queued:            "bg-gray-100 text-gray-500",
  generating_story:  "bg-violet-100 text-violet-700",
  generating_cover:  "bg-purple-100 text-purple-700",
  generating_images: "bg-indigo-50 text-indigo-700",
  generating_audio:  "bg-cyan-50 text-cyan-700",
  saving_memory:     "bg-teal-50 text-teal-700",
  completed:         "bg-emerald-50 text-emerald-700",
  failed:            "bg-red-50 text-red-600",
};

function duration(job: Job) {
  const start = job.startedAt ? new Date(job.startedAt) : null;
  if (!start) return "—";
  const end = job.completedAt ? new Date(job.completedAt) : new Date();
  const secs = Math.floor((end.getTime() - start.getTime()) / 1000);
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

export default function GenerationJobsPage() {
  const [data, setData] = useState<Paginated | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  function fetchJobs(p = page, s = status, q = search) {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: "25" });
    if (s) params.set("status", s);
    if (q) params.set("search", q);
    fetch(`${BASE}/admin/generation-jobs?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(j => setData(j.data ?? j))
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchJobs(); }, []); // eslint-disable-line

  async function retryJob(id: string) {
    const token = getAccessToken();
    if (!token) return;
    setActionLoading(id);
    await fetch(`${BASE}/admin/generation-jobs/${id}/retry`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    setActionLoading(null);
    fetchJobs(page, status, search);
  }

  async function cancelJob(id: string) {
    if (!confirm("Cancel this job?")) return;
    const token = getAccessToken();
    if (!token) return;
    setActionLoading(id);
    await fetch(`${BASE}/admin/generation-jobs/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    setActionLoading(null);
    fetchJobs(page, status, search);
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex items-center gap-3">
        <Zap className="w-5 h-5 text-amber-600" />
        <h1 className="text-gray-900 text-2xl font-black">Generation Jobs</h1>
        <button onClick={() => fetchJobs()} className="ml-auto text-gray-400 hover:text-gray-700 transition p-1.5 rounded-lg hover:bg-gray-100">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="flex gap-2 mb-4 items-center">
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
          <Search className="w-3.5 h-3.5 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { setPage(1); fetchJobs(1, status, search); } }}
            placeholder="Search by job, story, user, or universe…"
            className="bg-transparent outline-none text-sm text-gray-800 placeholder:text-gray-400 w-80 max-w-full"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {STATUS_OPTIONS.map(s => (
          <button
            key={s || "all"}
            onClick={() => { setStatus(s); setPage(1); fetchJobs(1, s); }}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all border ${
              status === s
                ? "bg-violet-600 text-white border-violet-600"
                : "border-gray-200 text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            {s || "All"}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              {["Status", "User", "Story", "Universe", "Step", "Progress", "Duration", "Error", "Actions"].map(h => (
                <th key={h} className="text-left px-4 py-3 text-gray-500 text-xs font-semibold uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="px-4 py-10 text-center"><Loader2 className="w-5 h-5 text-violet-600 animate-spin mx-auto" /></td></tr>
            ) : data?.items.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400 text-xs">No jobs found</td></tr>
            ) : (
              data?.items.map(job => (
                <tr key={job.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[job.status] ?? "bg-gray-100 text-gray-500"}`}>
                      {job.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700 text-xs font-semibold">{job.userEmail ?? job.userId.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-gray-900 text-xs font-black max-w-[120px] truncate">{job.storyTitle ?? job.storyId.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs font-semibold">{job.universeName ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{job.currentStep ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-violet-500 rounded-full" style={{ width: `${job.progressPercentage}%` }} />
                      </div>
                      <span className="text-gray-700 text-xs font-black">{job.progressPercentage}%</span>
                  </div>
                </td>
                  <td className="px-4 py-3 text-gray-600 text-xs font-semibold">{duration(job)}</td>
                  <td className="px-4 py-3 text-rose-600 text-xs font-semibold max-w-[160px] truncate" title={job.errorMessage ?? ""}>{job.errorMessage ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {job.status === "failed" && (
                        <button
                          onClick={() => void retryJob(job.id)}
                          disabled={actionLoading === job.id}
                          className="text-violet-600 hover:text-violet-800 transition p-1 rounded hover:bg-violet-50"
                          title="Retry"
                        >
                          {actionLoading === job.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                        </button>
                      )}
                      <button
                        onClick={() => void cancelJob(job.id)}
                        disabled={actionLoading === job.id}
                        className="text-gray-400 hover:text-red-500 transition p-1 rounded hover:bg-red-50"
                        title="Cancel / Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
          <span>{data.total} jobs</span>
          <div className="flex gap-2">
            <button onClick={() => { setPage(p => p - 1); fetchJobs(page - 1); }} disabled={page === 1} className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-30 hover:border-gray-300 transition">Prev</button>
            <span className="px-3 py-1.5">{page} / {data.totalPages}</span>
            <button onClick={() => { setPage(p => p + 1); fetchJobs(page + 1); }} disabled={page === data.totalPages} className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-30 hover:border-gray-300 transition">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
