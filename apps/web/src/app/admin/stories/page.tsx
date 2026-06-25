"use client";

import { BookOpen, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import { getAccessToken } from "@/lib/api";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

interface AdminStory {
  id: string;
  title: string | null;
  theme: string | null;
  status: string;
  storyMode: string;
  createdAt: string;
  userEmail?: string;
  heroName?: string;
  universeName?: string;
  totalCostUsd?: number;
}

interface Paginated {
  items: AdminStory[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const STATUS_STYLE: Record<string, string> = {
  completed:          "bg-emerald-50 text-emerald-700",
  failed:             "bg-red-50 text-red-600",
  "generating-story": "bg-violet-100 text-violet-700",
  pending:            "bg-gray-100 text-gray-500",
};

export default function StoriesPage() {
  const [data, setData] = useState<Paginated | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");

  function fetchData(p = page, s = statusFilter) {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: "25" });
    if (s) params.set("status", s);
    fetch(`${BASE}/admin/stories?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(j => setData(j.data ?? j))
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchData(); }, []); // eslint-disable-line

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex items-center gap-3">
        <BookOpen className="w-5 h-5 text-violet-600" />
        <h1 className="text-gray-900 text-2xl font-extrabold">Stories</h1>
        <button onClick={() => fetchData()} className="ml-auto text-gray-400 hover:text-gray-700 transition p-1.5 rounded-lg hover:bg-gray-100">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {["", "completed", "failed", "pending"].map(s => (
          <button
            key={s || "all"}
            onClick={() => { setStatusFilter(s); setPage(1); fetchData(1, s); }}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all border ${
              statusFilter === s ? "bg-violet-600 text-white border-violet-600" : "border-gray-200 text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            {s || "All"}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              {["Title", "User", "Hero", "Universe", "Mode", "Status", "AI Cost", "Created"].map(h => (
                <th key={h} className="text-left px-4 py-3 text-gray-500 text-xs font-semibold uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-10 text-center"><Loader2 className="w-5 h-5 text-violet-600 animate-spin mx-auto" /></td></tr>
            ) : data?.items.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400 text-xs">No stories found</td></tr>
            ) : (
              data?.items.map(s => (
                <tr key={s.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-900 text-xs font-bold max-w-[160px] truncate">{s.title ?? "Untitled"}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs font-medium">{s.userEmail ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-700 text-xs font-semibold">{s.heroName ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs font-medium">{s.universeName ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{s.storyMode.replace(/_/g, " ")}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_STYLE[s.status] ?? "bg-gray-100 text-gray-500"}`}>{s.status}</span>
                  </td>
                  <td className="px-4 py-3 text-red-500 text-xs font-bold">{s.totalCostUsd != null ? `$${Number(s.totalCostUsd).toFixed(4)}` : "—"}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs font-medium">{new Date(s.createdAt).toLocaleDateString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {data && data.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
          <span>{data.total} stories</span>
          <div className="flex gap-2">
            <button onClick={() => { setPage(p => p - 1); fetchData(page - 1); }} disabled={page === 1} className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-30 hover:border-gray-300 transition">Prev</button>
            <span className="px-3 py-1.5">{page} / {data.totalPages}</span>
            <button onClick={() => { setPage(p => p + 1); fetchData(page + 1); }} disabled={page === data.totalPages} className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-30 hover:border-gray-300 transition">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
