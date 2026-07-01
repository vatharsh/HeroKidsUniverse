"use client";

import {
  AlertTriangle, BarChart3, BookOpen, Bot, Clock, Globe,
  Loader2, Package, ShoppingCart, TrendingUp, Users, Zap,
} from "lucide-react";
import { useEffect, useState } from "react";

import { getAccessToken } from "@/lib/api";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

interface DashboardData {
  totalUsers: number;
  totalUniverses: number;
  totalStories: number;
  storiesToday: number;
  activeGenerations: number;
  pendingMerchandiseOrders: number;
  ordersShippedToday: number;
  totalRevenueInr: number;
  revenueToday: number;
  revenueThisMonth: number;
  totalAiCostUsd: number;
  aiCostToday: number;
  aiCostThisMonth: number;
  estimatedGrossProfitInr: number;
  profitMarginPct: number;
  mostPopularTheme: string;
  mostPopularProduct: string;
  aiCostWarning: boolean;
  usdToInr: number;
  displayCurrency?: string;
  aiCostCritical?: boolean;
  sandboxMode?: boolean;
  revenueView?: "sandbox" | "live" | "all";
}

const ACCENT = {
  brand: { icon: "text-violet-600 bg-violet-100/70", value: "text-gray-900" },
  gold:  { icon: "text-amber-600 bg-amber-100/70",   value: "text-gray-900" },
  green: { icon: "text-emerald-600 bg-emerald-100/70", value: "text-emerald-700" },
  red:   { icon: "text-rose-500 bg-rose-100/70",     value: "text-rose-600" },
} as const;

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent = "brand",
  badge,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  accent?: keyof typeof ACCENT;
  badge?: string;
}) {
  const { icon: iconCls, value: valueCls } = ACCENT[accent];
  return (
    <div className="bg-white/90 backdrop-blur border border-gray-200/80 rounded-2xl p-4 flex items-start gap-3 shadow-[0_10px_28px_rgba(15,23,42,0.05)] hover:shadow-[0_14px_40px_rgba(15,23,42,0.07)] transition-shadow">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${iconCls}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 mb-1.5">
          <p className="text-gray-500 text-xs font-semibold">{label}</p>
          {badge && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 uppercase tracking-wide">{badge}</span>}
        </div>
        <p className={`text-xl font-black leading-none tracking-tight ${valueCls}`}>{value}</p>
        {sub && <p className="text-gray-400 text-[11px] mt-1 font-medium">{sub}</p>}
      </div>
    </div>
  );
}

function MiniBarChart({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle: string;
  items: Array<{ label: string; value: number; color: string; helper?: string }>;
}) {
  const max = Math.max(...items.map((item) => item.value), 1);
  return (
    <div className="rounded-3xl border border-gray-200/80 bg-white/90 backdrop-blur p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
      <div className="mb-4">
        <p className="text-[10px] uppercase tracking-[0.22em] font-black text-gray-400">{title}</p>
        <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
      </div>
      <div className="space-y-4">
        {items.map((item) => (
          <div key={item.label} className="grid grid-cols-[92px_1fr_64px] gap-3 items-center">
            <div>
              <p className="text-xs font-bold text-gray-800">{item.label}</p>
              {item.helper && <p className="text-[10px] text-gray-400 mt-0.5">{item.helper}</p>}
            </div>
            <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
              <div
                className={`h-full rounded-full ${item.color}`}
                style={{ width: `${Math.max(6, (item.value / max) * 100)}%` }}
              />
            </div>
            <p className="text-right text-xs font-black text-gray-700">{item.value.toLocaleString()}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProfitWidget({ data }: { data: DashboardData }) {
  const profitable = data.profitMarginPct > 0;
  const aiTodayInr = data.aiCostToday * data.usdToInr;
  const aiMonthInr = data.aiCostThisMonth * data.usdToInr;
  const costShare = data.revenueThisMonth > 0 ? Math.min(100, (aiMonthInr / data.revenueThisMonth) * 100) : 0;
  return (
    <div className={`relative overflow-hidden rounded-[2rem] border-2 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)] ${profitable ? "bg-[linear-gradient(135deg,rgba(236,253,245,0.96),rgba(255,255,255,0.98),rgba(232,253,247,0.95))] border-emerald-200/90" : "bg-[linear-gradient(135deg,rgba(255,241,242,0.97),rgba(255,255,255,0.99),rgba(255,247,248,0.95))] border-rose-200/90"}`}>
      <div className={`absolute inset-x-0 top-0 h-1.5 ${profitable ? "bg-gradient-to-r from-emerald-400 via-lime-400 to-emerald-500" : "bg-gradient-to-r from-rose-400 via-orange-300 to-rose-500"}`} />
      <div className="flex items-center gap-2 mb-4">
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${profitable ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-500"}`}>
          <TrendingUp className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-gray-900 font-black text-sm">Platform Health</h2>
          <p className="text-gray-500 text-[11px] mt-0.5">How the platform is breathing today</p>
        </div>
        <span className={`ml-auto text-xs font-black px-2.5 py-1 rounded-full ${profitable ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-600"}`}>
          {profitable ? "PROFITABLE" : "UNPROFITABLE"}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className={`rounded-2xl border px-4 py-3 shadow-sm ${profitable ? "bg-white/90 border-emerald-100" : "bg-white/90 border-rose-100"}`}>
          <p className="text-[10px] uppercase tracking-[0.18em] font-black text-gray-400 mb-1">Revenue vs Cost</p>
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-gray-500 text-[10px] font-semibold">Revenue this month</p>
              <p className="text-emerald-700 text-xl font-black">₹{data.revenueThisMonth.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-gray-500 text-[10px] font-semibold">AI cost this month</p>
              <p className="text-rose-600 text-xl font-black">₹{aiMonthInr.toLocaleString()}</p>
            </div>
          </div>
          <div className="mt-3 h-2.5 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-lime-400 to-amber-400" style={{ width: `${Math.max(4, Math.min(100, 100 - costShare))}%` }} />
          </div>
          <p className="text-[11px] text-gray-400 mt-2">Higher fill means healthier margin.</p>
        </div>

        <div className="rounded-2xl bg-white/90 border border-violet-100 px-4 py-3 shadow-sm">
          <p className="text-[10px] uppercase tracking-[0.18em] font-black text-gray-400 mb-1">Today</p>
          <p className="text-emerald-700 text-xl font-black">₹{data.revenueToday.toLocaleString()}</p>
          <p className="text-gray-500 text-xs mt-1">Revenue</p>
          <p className="text-rose-600 text-lg font-black mt-3">₹{aiTodayInr.toLocaleString()}</p>
          <p className="text-gray-500 text-xs mt-1">AI spend</p>
        </div>

        <div className={`rounded-2xl border px-4 py-3 shadow-sm ${profitable ? "bg-white/90 border-emerald-100" : "bg-white/90 border-rose-100"}`}>
          <p className="text-[10px] uppercase tracking-[0.18em] font-black text-gray-400 mb-1">Margin</p>
          <p className={`text-2xl font-black ${profitable ? "text-emerald-700" : "text-rose-600"}`}>{data.profitMarginPct.toFixed(1)}%</p>
          <p className="text-gray-500 text-xs mt-1">Estimated gross profit</p>
          <p className={`text-lg font-black mt-3 ${profitable ? "text-emerald-700" : "text-rose-600"}`}>₹{data.estimatedGrossProfitInr.toLocaleString()}</p>
        </div>
      </div>

      <p className="text-xs text-gray-400 font-medium mt-4">
        Profit = Revenue − AI Cost × ₹{data.usdToInr}/USD &nbsp;·&nbsp; currency configured in Settings
      </p>
    </div>
  );
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sandboxFilter, setSandboxFilter] = useState<"sandbox" | "live" | "all">("sandbox");

  function fetchDashboard(filter: "sandbox" | "live" | "all") {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    const qs = filter === "all" ? "" : `?sandbox=${filter === "sandbox"}`;
    fetch(`${BASE}/admin/dashboard${qs}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(j => setData(j.data ?? j))
      .catch(() => setError("Failed to load dashboard"))
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchDashboard("sandbox"); }, []);

  function setFilter(f: "sandbox" | "live" | "all") {
    setSandboxFilter(f);
    fetchDashboard(f);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <Loader2 className="w-6 h-6 text-violet-600 animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <div className="text-center">
          <p className="text-red-500 text-sm font-semibold">{error || "No data"}</p>
          <p className="text-gray-400 text-xs mt-1">Make sure the backend admin routes are deployed</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 lg:p-10 max-w-[1440px] mx-auto relative">
      {/* Header */}
      <div className="absolute inset-x-6 top-4 h-32 rounded-[2rem] bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.10),transparent_30%),radial-gradient(circle_at_top_right,rgba(251,191,36,0.08),transparent_28%)] pointer-events-none" />
      <div className="relative mb-6 flex items-start justify-between gap-4 md:pl-2 lg:pl-4">
        <div className="pl-2 md:pl-3 lg:pl-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white/85 backdrop-blur px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-violet-700 mb-3 shadow-sm">
            Executive overview
          </div>
          <h1 className="text-gray-900 text-3xl font-black">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1 font-medium">
            {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        {data.aiCostWarning && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-black px-3 py-2 rounded-full shadow-sm">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            AI cost threshold exceeded
          </div>
        )}
      </div>

      {/* Sandbox / Live toggle */}
      <div className="mb-4 flex items-center gap-3 flex-wrap">
        {data.sandboxMode && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 border border-amber-300 text-amber-700 text-[11px] font-black px-3 py-1 uppercase tracking-wide">
            ⚠ Sandbox mode ON — new orders are test orders
          </span>
        )}
        <div className="flex items-center gap-1 rounded-full border border-gray-200 bg-white/80 p-1 text-xs shadow-sm ml-auto">
          {(["all", "sandbox", "live"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full font-semibold capitalize transition ${sandboxFilter === f ? "bg-violet-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-800"}`}
            >
              {f === "all" ? "All Orders" : f === "sandbox" ? "Sandbox" : "Live"}
            </button>
          ))}
        </div>
      </div>

      {/* Profitability widget */}
      <div className="mb-4">
        <ProfitWidget data={data} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-4 mb-6">
        <MiniBarChart
          title="OPERATING MIX"
          subtitle="The rhythm of the platform today, in plain numbers."
          items={[
            { label: "Stories", value: data.totalStories, color: "bg-violet-500", helper: "content generated" },
            { label: "Universes", value: data.totalUniverses, color: "bg-sky-500", helper: "active worlds" },
            { label: "Users", value: data.totalUsers, color: "bg-emerald-500", helper: "customer base" },
            { label: "Jobs", value: data.activeGenerations, color: "bg-amber-500", helper: "currently running" },
            { label: "Orders", value: data.pendingMerchandiseOrders + data.ordersShippedToday, color: "bg-rose-500", helper: "pending + shipped today" },
          ]}
        />

        <MiniBarChart
          title="REVENUE SIGNAL"
          subtitle="A softer visual read of the money side."
          items={[
            { label: "Revenue Today", value: data.revenueToday, color: "bg-emerald-500", helper: "INR" },
            { label: "Revenue Month", value: data.revenueThisMonth, color: "bg-teal-500", helper: "INR" },
            { label: "AI Cost Today", value: Math.round(data.aiCostToday * data.usdToInr), color: "bg-rose-500", helper: "INR" },
            { label: "AI Cost Month", value: Math.round(data.aiCostThisMonth * data.usdToInr), color: "bg-amber-500", helper: "INR" },
          ]}
        />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard icon={Users}        label="Total Users"        value={data.totalUsers.toLocaleString()}                           accent="brand" />
        <StatCard icon={Globe}        label="Total Universes"    value={data.totalUniverses.toLocaleString()}                       accent="brand" />
        <StatCard icon={BookOpen}     label="Total Stories"      value={data.totalStories.toLocaleString()}                         accent="brand" />
        <StatCard icon={Clock}        label="Stories Today"      value={data.storiesToday.toLocaleString()}                         accent="gold" badge="today" />
        <StatCard icon={Zap}          label="Active Generations" value={data.activeGenerations}                                     accent={data.activeGenerations > 0 ? "gold" : "brand"} />
        <StatCard icon={ShoppingCart} label="Pending Orders"     value={data.pendingMerchandiseOrders}                              accent={data.pendingMerchandiseOrders > 0 ? "red" : "green"} />
        <StatCard icon={Package}      label="Shipped Today"      value={data.ordersShippedToday}                                    accent="green" badge="today" />
        <StatCard icon={BarChart3}    label="Total Revenue"      value={`₹${data.totalRevenueInr.toLocaleString()}`}                accent="green" />
        <StatCard icon={Bot}          label="Total AI Cost"      value={`₹${(data.totalAiCostUsd * data.usdToInr).toLocaleString()}`} accent="red" />
        <StatCard icon={TrendingUp}   label="Est. Profit"        value={`₹${data.estimatedGrossProfitInr.toLocaleString()}`}        accent={data.estimatedGrossProfitInr > 0 ? "green" : "red"} />
        <StatCard icon={BookOpen}     label="Popular Theme"      value={data.mostPopularTheme || "—"}                               sub="most generated" />
        <StatCard icon={Package}      label="Popular Product"    value={data.mostPopularProduct || "—"}                             sub="best selling" />
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          { href: "/admin/generation-jobs?status=failed", label: "Failed Jobs",    icon: Zap,          color: "border-rose-200 bg-rose-50 text-rose-600"           },
          { href: "/admin/orders?status=pending",         label: "Pending Orders", icon: ShoppingCart, color: "border-amber-200 bg-amber-50 text-amber-700"   },
          { href: "/admin/ai-analytics",                  label: "AI Analytics",   icon: Bot,          color: "border-violet-200 bg-violet-50 text-violet-700" },
        ].map(({ href, label, icon: Icon, color }) => (
          <a
            key={href}
            href={href}
            className={`group flex items-center gap-3 px-4 py-4 rounded-2xl border transition-all shadow-[0_10px_26px_rgba(15,23,42,0.04)] hover:shadow-[0_16px_34px_rgba(15,23,42,0.08)] ${color}`}
          >
            <div className="w-10 h-10 rounded-xl bg-white/80 flex items-center justify-center shadow-sm">
              <Icon className="w-4 h-4" />
            </div>
            <div>
              <span className="text-sm font-black block">{label}</span>
              <span className="text-[11px] text-gray-500 block mt-0.5">Open detailed queue</span>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
