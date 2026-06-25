"use client";

import { ArrowLeft, Check, Loader2, Plus, Save, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { getAccessToken } from "@/lib/api";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

interface Rule {
  id?: string;
  minSuccessfulOrders: number;
  commissionRate: number;
  isActive: boolean;
}

const DEFAULT_TIERS: { min: string; rate: string }[] = [
  { min: "0",   rate: "10" },
  { min: "100", rate: "12" },
  { min: "200", rate: "15" },
  { min: "500", rate: "20" },
];

export default function InfluencerSettingsPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [rows, setRows] = useState<{ min: string; rate: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  function load() {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    fetch(`${BASE}/admin/influencer-settings/commission-rules`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(j => {
        const data = (j.data ?? j) as Rule[];
        setRules(data);
        if (data.length > 0) {
          setRows(data.map(r => ({ min: String(r.minSuccessfulOrders), rate: String(r.commissionRate) })));
        } else {
          setRows(DEFAULT_TIERS);
        }
      })
      .catch(() => setRows(DEFAULT_TIERS))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function save() {
    const token = getAccessToken();
    if (!token) return;
    setSaving(true);
    setError("");
    try {
      const payload = rows
        .filter(r => r.min !== "" && r.rate !== "")
        .map(r => ({
          minSuccessfulOrders: Number(r.min),
          commissionRate: Number(r.rate),
        }));
      const res = await fetch(`${BASE}/admin/influencer-settings/commission-rules`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(j.message ?? "Failed to save");
      }
      setSaved(true);
      load();
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Link href="/admin/influencers" className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition">
          <ArrowLeft className="w-3.5 h-3.5" /> Influencers
        </Link>
        <span className="text-gray-300 text-xs">/</span>
        <span className="text-xs font-semibold text-gray-800">Commission Settings</span>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100">
          <h1 className="text-gray-900 font-bold text-lg">Global Commission Tiers</h1>
          <p className="text-xs text-gray-500 mt-1">
            These apply to all influencers unless they have custom rules configured on their profile.
            Each tier triggers when the influencer reaches that many successful coupon orders.
          </p>
        </div>

        <div className="px-6 py-5">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 text-violet-500 animate-spin" /></div>
          ) : (
            <>
              {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">{error}</p>}

              <div className="mb-4 rounded-lg border border-gray-100 bg-gray-50 p-3 text-xs text-gray-500">
                <strong className="text-gray-700">How it works:</strong> When an influencer reaches the minimum number of successful orders, they move to that tier. The system always picks the highest applicable tier.
              </div>

              <div className="space-y-3 mb-4">
                <div className="grid grid-cols-[1fr_1fr_auto] gap-2 text-xs font-bold uppercase tracking-wide text-gray-400 pb-1">
                  <span>Min Successful Orders</span>
                  <span>Commission Rate</span>
                  <span></span>
                </div>
                {rows.map((row, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={row.min}
                        onChange={e => setRows(rs => rs.map((r, j) => j === i ? { ...r, min: e.target.value } : r))}
                        placeholder="0"
                        min="0"
                        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-400"
                      />
                      <span className="text-gray-400 text-xs whitespace-nowrap">orders</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={row.rate}
                        onChange={e => setRows(rs => rs.map((r, j) => j === i ? { ...r, rate: e.target.value } : r))}
                        placeholder="10"
                        min="0"
                        max="100"
                        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-400"
                      />
                      <span className="text-gray-400 text-sm">%</span>
                    </div>
                    <button
                      onClick={() => setRows(rs => rs.filter((_, j) => j !== i))}
                      disabled={rows.length === 1}
                      className="text-gray-300 hover:text-red-500 transition disabled:opacity-20"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setRows(rs => [...rs, { min: "", rate: "" }])}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-violet-600 transition mb-6"
              >
                <Plus className="w-3.5 h-3.5" /> Add Tier
              </button>

              <div className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs text-amber-700 mb-6">
                <strong>Recommended max:</strong> 20% commission rate. Individual influencer rules override global rules entirely.
              </div>

              <div className="flex items-center justify-between">
                <button
                  onClick={() => setRows(DEFAULT_TIERS)}
                  className="text-xs text-gray-400 hover:text-gray-600 transition"
                >
                  Reset to defaults
                </button>
                <button
                  onClick={() => void save()}
                  disabled={saving}
                  className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                  {saved ? "Saved!" : "Save Rules"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Current rules preview */}
      {rules.length > 0 && (
        <div className="mt-6 rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
          <div className="px-6 py-3 border-b border-gray-100">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Current Saved Rules</p>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-50 bg-gray-50">
                <th className="text-left px-5 py-2.5 text-gray-400 font-semibold uppercase tracking-wide text-[10px]">Min Orders</th>
                <th className="text-left px-5 py-2.5 text-gray-400 font-semibold uppercase tracking-wide text-[10px]">Commission Rate</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r, i) => (
                <tr key={i} className="border-b border-gray-50 last:border-0">
                  <td className="px-5 py-2.5 text-gray-700 font-semibold">{r.minSuccessfulOrders}+ orders</td>
                  <td className="px-5 py-2.5 font-bold text-violet-700">{r.commissionRate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
