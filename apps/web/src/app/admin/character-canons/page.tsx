"use client";

import { RefreshCw, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { getAccessToken } from "@/lib/api";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

type CanonStatus = "pending" | "complete" | "failed" | "needs_review";
type CanonType = "hero" | "supporting_character" | "pet" | "companion";

interface CanonRow {
  id: string;
  canonType: CanonType;
  status: CanonStatus;
  qualityScore: number | null;
  approvedAvatarUrl: string | null;
  appearanceSummary: string | null;
  entityName: string;
  userId: string;
  generationVersion: number;
  createdAt: string;
  updatedAt: string;
}

const STATUS_COLORS: Record<CanonStatus, string> = {
  complete:     "bg-emerald-100 text-emerald-700 border-emerald-200",
  needs_review: "bg-amber-100 text-amber-700 border-amber-200",
  failed:       "bg-red-100 text-red-700 border-red-200",
  pending:      "bg-gray-100 text-gray-600 border-gray-200",
};

const STATUS_LABELS: Record<CanonStatus, string> = {
  complete:     "Complete",
  needs_review: "Needs Review",
  failed:       "Failed",
  pending:      "Pending",
};

const TYPE_LABELS: Record<CanonType, string> = {
  hero:                 "Hero",
  supporting_character: "Supporting",
  pet:                  "Pet",
  companion:            "Companion",
};

function QualityBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-gray-400">—</span>;
  const color = score >= 80 ? "text-emerald-600 font-bold" : score >= 60 ? "text-amber-600 font-bold" : "text-red-600 font-bold";
  return <span className={color}>{score}</span>;
}

export default function CharacterCanonsPage() {
  const [rows, setRows]             = useState<CanonRow[]>([]);
  const [total, setTotal]           = useState(0);
  const [page, setPage]             = useState(1);
  const [statusFilter, setStatus]   = useState("");
  const [typeFilter, setType]       = useState("");
  const [loading, setLoading]       = useState(true);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillMsg, setBackfillMsg] = useState("");
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const LIMIT = 20;

  async function load(p = page, st = statusFilter, ty = typeFilter) {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: String(LIMIT) });
    if (st) params.set("status", st);
    if (ty) params.set("canonType", ty);
    try {
      const res = await fetch(`${BASE}/admin/character-canons?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const { data } = await res.json();
      setRows(data.data ?? []);
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleBackfill() {
    const token = getAccessToken();
    if (!token) return;
    setBackfilling(true);
    setBackfillMsg("");
    try {
      const res = await fetch(`${BASE}/admin/character-canons/backfill`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const { data } = await res.json();
      setBackfillMsg(data?.message ?? "Backfill started");
      setTimeout(() => {
        setBackfilling(false);
        void load();
      }, 3000);
    } catch {
      setBackfillMsg("Failed to start backfill");
      setBackfilling(false);
    }
  }

  async function handleRegenerate(id: string) {
    const token = getAccessToken();
    if (!token) return;
    setRegenerating(id);
    try {
      const res = await fetch(`${BASE}/admin/character-canons/${id}/regenerate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const { data } = await res.json();
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...data } : r)));
    } finally {
      setRegenerating(null);
    }
  }

  function changePage(newPage: number) {
    setPage(newPage);
    void load(newPage, statusFilter, typeFilter);
  }

  function changeFilter(st: string, ty: string) {
    setStatus(st);
    setType(ty);
    setPage(1);
    void load(1, st, ty);
  }

  // Derive stats from current full dataset total counts
  const complete     = rows.filter((r) => r.status === "complete").length;
  const needsReview  = rows.filter((r) => r.status === "needs_review").length;
  const failed       = rows.filter((r) => r.status === "failed").length;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <ShieldCheck className="w-5 h-5 text-violet-600" />
            <h1 className="text-2xl font-extrabold text-gray-900">Character Canons</h1>
          </div>
          <p className="text-gray-500 text-sm">Permanent identity profiles used to keep characters consistent across every story illustration.</p>
        </div>
        <div className="flex items-center gap-3">
          {backfillMsg && (
            <span className="text-emerald-600 text-sm font-medium">{backfillMsg}</span>
          )}
          <button
            type="button"
            onClick={() => void handleBackfill()}
            disabled={backfilling}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white font-semibold text-sm px-4 py-2.5 rounded-lg transition"
          >
            {backfilling ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            {backfilling ? "Running…" : "Run Backfill"}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Canons", value: total, color: "text-gray-900" },
          { label: "Complete",     value: complete,    color: "text-emerald-600" },
          { label: "Needs Review", value: needsReview, color: "text-amber-600" },
          { label: "Failed",       value: failed,      color: "text-red-600" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">{label}</p>
            <p className={`text-2xl font-black ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <select
          value={statusFilter}
          onChange={(e) => changeFilter(e.target.value, typeFilter)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          <option value="">All Statuses</option>
          <option value="complete">Complete</option>
          <option value="needs_review">Needs Review</option>
          <option value="failed">Failed</option>
          <option value="pending">Pending</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => changeFilter(statusFilter, e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          <option value="">All Types</option>
          <option value="hero">Hero</option>
          <option value="supporting_character">Supporting Character</option>
          <option value="companion">Companion</option>
          <option value="pet">Pet</option>
        </select>
        <span className="text-sm text-gray-400 ml-auto">{total} total</span>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left text-xs text-gray-500 font-semibold uppercase tracking-wide px-4 py-3">Avatar</th>
              <th className="text-left text-xs text-gray-500 font-semibold uppercase tracking-wide px-4 py-3">Name</th>
              <th className="text-left text-xs text-gray-500 font-semibold uppercase tracking-wide px-4 py-3">Type</th>
              <th className="text-left text-xs text-gray-500 font-semibold uppercase tracking-wide px-4 py-3">Status</th>
              <th className="text-left text-xs text-gray-500 font-semibold uppercase tracking-wide px-4 py-3">Quality</th>
              <th className="text-left text-xs text-gray-500 font-semibold uppercase tracking-wide px-4 py-3">Ver</th>
              <th className="text-left text-xs text-gray-500 font-semibold uppercase tracking-wide px-4 py-3">Generated</th>
              <th className="text-left text-xs text-gray-500 font-semibold uppercase tracking-wide px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr>
                <td colSpan={8} className="text-center py-12 text-gray-400">Loading…</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-12 text-gray-400">
                  No character canons yet. Run Backfill to generate them for all existing heroes and characters.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                  {/* Avatar */}
                  <td className="px-4 py-3">
                    {row.approvedAvatarUrl ? (
                      <img
                        src={row.approvedAvatarUrl}
                        alt={row.entityName}
                        className="w-8 h-8 rounded-full object-cover border border-gray-200"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 text-xs font-bold">
                        {row.entityName?.[0]?.toUpperCase() ?? "?"}
                      </div>
                    )}
                  </td>

                  {/* Name */}
                  <td className="px-4 py-3">
                    <p className="font-semibold text-gray-900">{row.entityName}</p>
                    {row.appearanceSummary && (
                      <p className="text-gray-400 text-xs mt-0.5 line-clamp-1 max-w-[200px]">{row.appearanceSummary}</p>
                    )}
                  </td>

                  {/* Type */}
                  <td className="px-4 py-3 text-gray-600">{TYPE_LABELS[row.canonType] ?? row.canonType}</td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${STATUS_COLORS[row.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {STATUS_LABELS[row.status] ?? row.status}
                    </span>
                  </td>

                  {/* Quality */}
                  <td className="px-4 py-3 text-center"><QualityBadge score={row.qualityScore} /></td>

                  {/* Version */}
                  <td className="px-4 py-3 text-gray-500 text-xs">v{row.generationVersion}</td>

                  {/* Generated */}
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {new Date(row.updatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => void handleRegenerate(row.id)}
                      disabled={regenerating === row.id}
                      className="flex items-center gap-1.5 text-xs font-semibold text-violet-600 hover:text-violet-800 disabled:opacity-50 px-2.5 py-1.5 rounded-lg hover:bg-violet-50 transition"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${regenerating === row.id ? "animate-spin" : ""}`} />
                      {regenerating === row.id ? "…" : "Regenerate"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {total > LIMIT && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
            <span className="text-xs text-gray-500">
              Showing {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of {total}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => changePage(page - 1)}
                disabled={page === 1}
                className="px-3 py-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-100 transition"
              >
                ← Prev
              </button>
              <button
                type="button"
                onClick={() => changePage(page + 1)}
                disabled={page * LIMIT >= total}
                className="px-3 py-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-100 transition"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
