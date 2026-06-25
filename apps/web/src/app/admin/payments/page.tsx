"use client";

import { BarChart3, Loader2, RefreshCw, Search } from "lucide-react";
import { useEffect, useState } from "react";

import { getAccessToken } from "@/lib/api";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

interface Payment {
  id: string;
  userId: string;
  userEmail?: string;
  razorpayOrderId: string;
  razorpayPaymentId: string | null;
  amountInr: number;
  status: string;
  method: string | null;
  createdAt: string;
}

interface Paginated {
  items: Payment[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const STATUS_STYLE: Record<string, string> = {
  created:  "bg-amber-50 text-amber-700",
  captured: "bg-emerald-50 text-emerald-700",
  failed:   "bg-red-50 text-red-600",
  refunded: "bg-gray-100 text-gray-500",
};

export default function PaymentsPage() {
  const [data, setData] = useState<Paginated | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");

  function fetchData(p = page, s = statusFilter, q = search) {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: "25" });
    if (s) params.set("status", s);
    if (q) params.set("search", q);
    fetch(`${BASE}/admin/payments?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(j => setData(j.data ?? j))
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchData(); }, []); // eslint-disable-line

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex items-center gap-3">
        <BarChart3 className="w-5 h-5 text-emerald-600" />
        <h1 className="text-gray-900 text-2xl font-black">Payments</h1>
        <button onClick={() => fetchData()} className="ml-auto text-gray-400 hover:text-gray-700 transition p-1.5 rounded-lg hover:bg-gray-100">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
          <Search className="w-3.5 h-3.5 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { setPage(1); fetchData(1, statusFilter, search); } }}
            placeholder="Search order, payment, or user…"
            className="bg-transparent outline-none text-sm text-gray-800 placeholder:text-gray-400 w-72 max-w-full"
          />
        </div>
        <button
          onClick={() => { setPage(1); fetchData(1, statusFilter, search); }}
          className="bg-emerald-100 hover:bg-emerald-200 text-emerald-700 text-xs font-bold px-3 py-2 rounded-xl transition"
        >
          Search
        </button>
      </div>

      <div className="flex gap-2 mb-4">
        {["", "created", "captured", "failed", "refunded"].map(s => (
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
              {["Razorpay Order", "Payment ID", "User", "Amount", "Status", "Method", "Date"].map(h => (
                <th key={h} className="text-left px-4 py-3 text-gray-500 text-xs font-semibold uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center"><Loader2 className="w-5 h-5 text-violet-600 animate-spin mx-auto" /></td></tr>
            ) : data?.items.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400 text-xs">No payments found</td></tr>
            ) : (
              data?.items.map(p => (
                <tr key={p.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600 text-xs font-mono font-semibold">{p.razorpayOrderId.slice(0, 16)}…</td>
                  <td className="px-4 py-3 text-gray-500 text-xs font-mono">{p.razorpayPaymentId?.slice(0, 16) ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-700 text-xs font-semibold">{p.userEmail ?? p.userId.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-emerald-600 text-xs font-black">₹{Number(p.amountInr).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[p.status] ?? "bg-gray-100 text-gray-500"}`}>{p.status}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{p.method ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{new Date(p.createdAt).toLocaleDateString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {data && data.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
          <span>{data.total} payments</span>
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
