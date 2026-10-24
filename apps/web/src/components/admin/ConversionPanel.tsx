"use client";

import { useEffect, useState } from "react";

import { getAccessToken } from "@/lib/api";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

interface Funnel {
  signups: number; verified: number; previewed: number; paid: number; repeat: number; orders: number; revenue: number;
  verifiedPct: number; previewedPct: number; paidPct: number; repeatPct: number; revenuePerSignup: number;
}
interface ConversionData {
  last7: Funnel; last30: Funnel; allTime: Funnel;
  influencers: Array<{ name: string; orders: number; buyers: number; revenue: number }>;
  previewQuota: { previewsToday: number; waiting: number; turnedAwayToday: number; dailyLimit: number };
}

const WINDOWS = [
  { id: "last7", label: "Last 7 days" },
  { id: "last30", label: "Last 30 days" },
  { id: "allTime", label: "All time" },
] as const;

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

/**
 * Sign-up → paid funnel — the number that decides whether free previews pay for themselves
 * (healthy is about 8%+ of sign-ups paying; under ~4% the free previews cost more than they earn).
 */
export default function ConversionPanel({ filter }: { filter: "sandbox" | "live" | "all" }) {
  const [data, setData] = useState<ConversionData | null>(null);
  const [win, setWin] = useState<(typeof WINDOWS)[number]["id"]>("last30");

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;
    const qs = filter === "all" ? "" : `?sandbox=${filter === "sandbox"}`;
    fetch(`${BASE}/admin/conversion${qs}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((j) => setData(j.data ?? j))
      .catch(() => setData(null));
  }, [filter]);

  if (!data) return null;
  const f = data[win];
  const health = f.signups < 30 ? "neutral" : f.paidPct >= 8 ? "good" : f.paidPct >= 4 ? "ok" : "bad";
  const healthText = {
    neutral: "Too few sign-ups yet to judge",
    good: "Healthy — free previews are paying for themselves",
    ok: "OK — free previews roughly break even",
    bad: "Low — free previews cost more than they earn",
  }[health];
  const healthColour = { neutral: "bg-gray-100 text-gray-600", good: "bg-emerald-100 text-emerald-700", ok: "bg-amber-100 text-amber-700", bad: "bg-red-100 text-red-700" }[health];
  const q = data.previewQuota;

  const steps = [
    { label: "Signed up", value: f.signups, pct: 100 },
    { label: "Verified email", value: f.verified, pct: f.verifiedPct },
    { label: "Made free story", value: f.previewed, pct: f.previewedPct },
    { label: "Paid", value: f.paid, pct: f.paidPct },
    { label: "Paid again", value: f.repeat, pct: f.repeatPct },
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-base font-bold text-gray-900">Conversion · sign-up → paid</h2>
          <p className="text-xs text-gray-400">Parents who signed up in the period, and what they did since.</p>
        </div>
        <div className="flex gap-1">
          {WINDOWS.map((w) => (
            <button key={w.id} type="button" onClick={() => setWin(w.id)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full ${win === w.id ? "bg-violet-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {w.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
        {steps.map((s, i) => (
          <div key={s.label} className={`rounded-xl border p-3 ${i === 3 ? "border-violet-300 bg-violet-50" : "border-gray-100 bg-gray-50"}`}>
            <p className="text-[11px] text-gray-500 font-semibold">{s.label}</p>
            <p className="text-2xl font-extrabold text-gray-900">{s.value.toLocaleString("en-IN")}</p>
            <p className="text-xs text-gray-400">{i === 0 ? " " : `${s.pct}% of sign-ups`}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-5 text-xs">
        <span className={`font-bold px-3 py-1 rounded-full ${healthColour}`}>{f.signups ? `${f.paidPct}% paid` : "No sign-ups"} · {healthText}</span>
        <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-600">Sales {inr(f.revenue)} · {f.orders} orders</span>
        <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-600">{inr(f.revenuePerSignup)} per sign-up</span>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-gray-100 p-4">
          <p className="text-sm font-bold text-gray-800 mb-2">Free previews today</p>
          <p className="text-2xl font-extrabold text-gray-900">
            {q.previewsToday}<span className="text-base text-gray-400 font-semibold"> / {q.dailyLimit > 0 ? q.dailyLimit : "no limit"}</span>
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Turned away today: <strong>{q.turnedAwayToday}</strong> · On the waiting list: <strong>{q.waiting}</strong>
          </p>
          <p className="text-[11px] text-gray-400 mt-1">Set the daily limit in Settings → Free Previews per Day.</p>
        </div>
        <div className="rounded-xl border border-gray-100 p-4">
          <p className="text-sm font-bold text-gray-800 mb-2">Influencer sales · last 30 days</p>
          {data.influencers.length === 0 ? (
            <p className="text-xs text-gray-400">No coupon sales yet.</p>
          ) : (
            <table className="w-full text-xs">
              <thead><tr className="text-gray-400 text-left"><th className="font-semibold pb-1">Influencer</th><th className="font-semibold pb-1">Buyers</th><th className="font-semibold pb-1">Orders</th><th className="font-semibold pb-1 text-right">Sales</th></tr></thead>
              <tbody>
                {data.influencers.map((r) => (
                  <tr key={r.name} className="border-t border-gray-50">
                    <td className="py-1 text-gray-800 font-medium">{r.name}</td><td>{r.buyers}</td><td>{r.orders}</td><td className="text-right">{inr(r.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
