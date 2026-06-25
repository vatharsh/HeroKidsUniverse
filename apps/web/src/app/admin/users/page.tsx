"use client";

import { Loader2, RefreshCw, Search, Save, Users, X } from "lucide-react";
import { useEffect, useState } from "react";

import { getAccessToken } from "@/lib/api";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  plan: string;
  credits: number;
  isPremium: boolean;
  createdAt: string;
  storyCount?: number;
  universeCount?: number;
  totalAiCostUsd?: number;
}

interface Paginated {
  items: AdminUser[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

function EditDrawer({ user, onClose, onSaved }: { user: AdminUser; onClose: () => void; onSaved: () => void }) {
  const [role, setRole] = useState(user.role);
  const [plan, setPlan] = useState(user.plan);
  const [credits, setCredits] = useState(String(user.credits));
  const [isPremium, setIsPremium] = useState(user.isPremium);
  const [saving, setSaving] = useState(false);

  async function save() {
    const token = getAccessToken();
    if (!token) return;
    setSaving(true);
    await fetch(`${BASE}/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ role, plan, credits: Number(credits), isPremium }),
    });
    setSaving(false);
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="w-88 h-full bg-white border-l border-gray-200 p-6 overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-gray-900 font-bold">Edit User</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
        </div>

        <div className="mb-4">
          <p className="text-gray-800 font-medium text-sm">{user.name}</p>
          <p className="text-gray-400 text-xs">{user.email}</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-gray-500 text-xs block mb-1.5">Role</label>
            <select value={role} onChange={e => setRole(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-800 text-sm focus:outline-none focus:border-violet-400">
              <option value="parent">parent</option>
              <option value="admin">admin</option>
            </select>
          </div>
          <div>
            <label className="text-gray-500 text-xs block mb-1.5">Plan</label>
            <select value={plan} onChange={e => setPlan(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-800 text-sm focus:outline-none focus:border-violet-400">
              <option value="basic">basic</option>
              <option value="standard">standard</option>
              <option value="premium">premium</option>
            </select>
          </div>
          <div>
            <label className="text-gray-500 text-xs block mb-1.5">Credits</label>
            <input type="number" value={credits} onChange={e => setCredits(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-800 text-sm focus:outline-none focus:border-violet-400" />
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" id="premium" checked={isPremium} onChange={e => setIsPremium(e.target.checked)} className="w-4 h-4 accent-violet-600" />
            <label htmlFor="premium" className="text-gray-600 text-sm">Premium</label>
          </div>
        </div>

        <button
          onClick={() => void save()}
          disabled={saving}
          className="mt-6 w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold py-2.5 rounded-lg transition disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Changes
        </button>
      </div>
    </div>
  );
}

export default function UsersPage() {
  const [data, setData] = useState<Paginated | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<AdminUser | null>(null);

  function fetchUsers(p = page, q = search) {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: "20" });
    if (q) params.set("search", q);
    fetch(`${BASE}/admin/users?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(j => setData(j.data ?? j))
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchUsers(); }, []); // eslint-disable-line

  const PLAN_STYLE: Record<string, string> = {
    basic:    "bg-gray-100 text-gray-500",
    standard: "bg-violet-100 text-violet-700",
    premium:  "bg-amber-100 text-amber-700",
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {editing && <EditDrawer user={editing} onClose={() => setEditing(null)} onSaved={() => fetchUsers()} />}

      <div className="mb-6 flex items-center gap-3">
        <Users className="w-5 h-5 text-violet-600" />
        <h1 className="text-gray-900 text-2xl font-black">Users</h1>
        <button onClick={() => fetchUsers()} className="ml-auto text-gray-400 hover:text-gray-700 transition p-1.5 rounded-lg hover:bg-gray-100">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
          <Search className="w-3.5 h-3.5 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { setPage(1); fetchUsers(1, search); } }}
            placeholder="Search by name or email…"
            className="bg-transparent outline-none text-sm text-gray-800 placeholder:text-gray-400 w-72 max-w-full"
          />
        </div>
        <button
          onClick={() => { setPage(1); fetchUsers(1, search); }}
          className="bg-violet-100 hover:bg-violet-200 text-violet-700 text-xs font-bold px-3 py-2 rounded-xl transition"
        >
          Search
        </button>
      </div>

      <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              {["Name", "Email", "Role", "Plan", "Credits", "Stories", "Universes", "AI Cost", "Joined", ""].map(h => (
                <th key={h} className="text-left px-4 py-3 text-gray-500 text-xs font-semibold uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} className="px-4 py-10 text-center"><Loader2 className="w-5 h-5 text-violet-600 animate-spin mx-auto" /></td></tr>
            ) : data?.items.length === 0 ? (
              <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-400 text-xs">No users found</td></tr>
            ) : (
              data?.items.map(u => (
                <tr key={u.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 text-[10px] font-bold flex-shrink-0">
                        {u.name?.[0]?.toUpperCase() ?? "?"}
                      </div>
                      <span className="text-gray-900 text-xs font-bold">{u.name}</span>
                      {u.isPremium && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-black">PRO</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs font-semibold">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${u.role === "admin" ? "bg-violet-100 text-violet-700" : "bg-gray-100 text-gray-500"}`}>{u.role}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${PLAN_STYLE[u.plan] ?? "bg-gray-100 text-gray-500"}`}>{u.plan}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-900 text-xs font-bold">{u.credits}</td>
                  <td className="px-4 py-3 text-gray-700 text-xs font-semibold">{u.storyCount ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-700 text-xs font-semibold">{u.universeCount ?? "—"}</td>
                  <td className="px-4 py-3 text-rose-600 text-xs font-black">{u.totalAiCostUsd != null ? `$${Number(u.totalAiCostUsd).toFixed(4)}` : "—"}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs font-medium">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => setEditing(u)} className="text-violet-600 text-xs hover:text-violet-800 transition font-medium">Edit</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {data && data.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
          <span>{data.total} users</span>
          <div className="flex gap-2">
            <button onClick={() => { setPage(p => p - 1); fetchUsers(page - 1); }} disabled={page === 1} className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-30 hover:border-gray-300 transition">Prev</button>
            <span className="px-3 py-1.5">{page} / {data.totalPages}</span>
            <button onClick={() => { setPage(p => p + 1); fetchUsers(page + 1); }} disabled={page === data.totalPages} className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-30 hover:border-gray-300 transition">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
