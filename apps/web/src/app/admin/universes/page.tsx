"use client";

import { Globe, Loader2, RefreshCw, Search } from "lucide-react";
import { useEffect, useState } from "react";

import { getAccessToken } from "@/lib/api";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

interface AdminUniverse {
  id: string;
  name: string;
  userId: string;
  userEmail?: string;
  heroTitle: string | null;
  createdAt: string;
  storyCount?: number;
  imageCount?: number;
  aiCostUsd?: number;
}

interface Paginated {
  items: AdminUniverse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function UniversesPage() {
  const [data, setData] = useState<Paginated | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  function fetchData(p = page, q = search) {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: "25" });
    if (q) params.set("search", q);
    fetch(`${BASE}/admin/universes?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(j => setData(j.data ?? j))
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchData(); }, []); // eslint-disable-line

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex items-center gap-3">
        <Globe className="w-5 h-5 text-violet-600" />
        <h1 className="text-gray-900 text-2xl font-black">Universes</h1>
        <button onClick={() => fetchData()} className="ml-auto text-gray-400 hover:text-gray-700 transition p-1.5 rounded-lg hover:bg-gray-100">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="flex gap-2 mb-4 items-center">
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
          <Search className="w-3.5 h-3.5 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { setPage(1); fetchData(1, search); } }}
            placeholder="Search universes…"
            className="bg-transparent outline-none text-sm text-gray-800 placeholder:text-gray-400 w-72 max-w-full"
          />
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              {["Universe", "Hero Title", "Owner", "Stories", "Images", "AI Cost", "Created"].map(h => (
                <th key={h} className="text-left px-4 py-3 text-gray-500 text-xs font-semibold uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center"><Loader2 className="w-5 h-5 text-violet-600 animate-spin mx-auto" /></td></tr>
            ) : data?.items.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400 text-xs">No universes found</td></tr>
            ) : (
              data?.items.map(u => (
                <tr key={u.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-900 text-xs font-black">{u.name}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs font-semibold">{u.heroTitle ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs font-semibold">{u.userEmail ?? u.userId.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-gray-800 text-xs font-bold">{u.storyCount ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-800 text-xs font-bold">{u.imageCount ?? "—"}</td>
                  <td className="px-4 py-3 text-rose-600 text-xs font-black">{u.aiCostUsd != null ? `$${Number(u.aiCostUsd).toFixed(4)}` : "—"}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs font-medium">{new Date(u.createdAt).toLocaleDateString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {data && data.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
          <span>{data.total} universes</span>
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
