"use client";

import {
  BarChart3, Bot, Briefcase, ChevronLeft, ChevronRight, CreditCard,
  Download, FileSpreadsheet, Globe, RefreshCw, Search, ShoppingBag,
  ShoppingCart, TrendingUp, Users, Zap, X, BookOpen,
} from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import { getAccessToken } from "@/lib/api";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ColumnDef {
  key: string;
  label: string;
  format?: "currency" | "date" | "bool" | "badge" | "number" | "pct";
  badgeColors?: Record<string, string>;
}
interface FilterDef {
  key: string;
  label: string;
  type: "text" | "select";
  options?: { label: string; value: string }[];
}
interface ReportDef {
  id: string;
  label: string;
  shortLabel: string;
  icon: React.ElementType;
  columns: ColumnDef[];
  filters: FilterDef[];
}
interface ReportData {
  items: Record<string, unknown>[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  summary: Record<string, number | string>;
}

// ─── Config ──────────────────────────────────────────────────────────────────

const S: Record<string, string> = {
  completed: "bg-emerald-100 text-emerald-700",
  pending: "bg-amber-100 text-amber-700",
  failed: "bg-red-100 text-red-700",
  shipped: "bg-blue-100 text-blue-700",
  delivered: "bg-teal-100 text-teal-700",
  cancelled: "bg-gray-100 text-gray-500",
  paid: "bg-emerald-100 text-emerald-700",
  active: "bg-emerald-100 text-emerald-700",
  inactive: "bg-gray-100 text-gray-500",
  blocked: "bg-red-100 text-red-700",
  refunded: "bg-rose-100 text-rose-600",
  queued: "bg-amber-100 text-amber-700",
  generating_story: "bg-violet-100 text-violet-700",
  generating_images: "bg-blue-100 text-blue-700",
  generating_audio: "bg-teal-100 text-teal-700",
};

const ORDER_STATUSES = [
  { label: "Pending Payment", value: "pending_payment" }, { label: "Paid", value: "paid" },
  { label: "Processing", value: "processing" }, { label: "Shipped", value: "shipped" },
  { label: "Delivered", value: "delivered" }, { label: "Cancelled", value: "cancelled" },
  { label: "Failed", value: "failed" }, { label: "Refunded", value: "refunded" },
];
const STORY_STATUSES = [
  { label: "Pending", value: "pending" }, { label: "Completed", value: "completed" },
  { label: "Failed", value: "failed" }, { label: "Generating Story", value: "generating-story" },
];
const JOB_STATUSES = [
  { label: "Queued", value: "queued" }, { label: "Generating Story", value: "generating_story" },
  { label: "Generating Cover", value: "generating_cover" }, { label: "Generating Images", value: "generating_images" },
  { label: "Completed", value: "completed" }, { label: "Failed", value: "failed" },
];
const AI_OPERATIONS = [
  { label: "Story Generation", value: "story_generation" }, { label: "Image Generation", value: "image_generation" },
  { label: "Narration", value: "narration" }, { label: "Avatar Generation", value: "avatar_generation" },
  { label: "Cover Generation", value: "cover_generation" },
];

const REPORTS: ReportDef[] = [
  {
    id: "sales-revenue", label: "Sales & Revenue", shortLabel: "Sales", icon: TrendingUp,
    filters: [
      { key: "search", label: "Order / customer…", type: "text" },
      { key: "status", label: "Order Status", type: "select", options: ORDER_STATUSES },
      { key: "paymentMethod", label: "Payment Method", type: "select", options: [
        { label: "Razorpay", value: "razorpay" }, { label: "COD", value: "cod" },
      ]},
    ],
    columns: [
      { key: "orderNumber", label: "Order #" }, { key: "userName", label: "Customer" },
      { key: "createdAt", label: "Date", format: "date" },
      { key: "status", label: "Status", format: "badge", badgeColors: S },
      { key: "paymentStatus", label: "Payment", format: "badge", badgeColors: S },
      { key: "subtotal", label: "Subtotal", format: "currency" }, { key: "discount", label: "Discount", format: "currency" },
      { key: "shipping", label: "Shipping", format: "currency" }, { key: "total", label: "Total", format: "currency" },
      { key: "paymentMethod", label: "Method" }, { key: "couponCode", label: "Coupon" },
      { key: "influencerName", label: "Influencer" },
    ],
  },
  {
    id: "orders", label: "Orders", shortLabel: "Orders", icon: ShoppingCart,
    filters: [
      { key: "search", label: "Order / customer…", type: "text" },
      { key: "status", label: "Status", type: "select", options: ORDER_STATUSES },
    ],
    columns: [
      { key: "orderNumber", label: "Order #" }, { key: "customerName", label: "Customer" },
      { key: "customerEmail", label: "Email" },
      { key: "status", label: "Status", format: "badge", badgeColors: S },
      { key: "paymentStatus", label: "Payment", format: "badge", badgeColors: S },
      { key: "total", label: "Total", format: "currency" },
      { key: "shippingCity", label: "City" }, { key: "shippingState", label: "State" },
      { key: "trackingNumber", label: "Tracking" }, { key: "createdAt", label: "Created", format: "date" },
    ],
  },
  {
    id: "merchandise", label: "Merchandise", shortLabel: "Products", icon: ShoppingBag,
    filters: [{ key: "search", label: "Product name…", type: "text" }],
    columns: [
      { key: "productName", label: "Product" }, { key: "category", label: "Category" },
      { key: "productType", label: "Type" }, { key: "quantitySold", label: "Qty Sold", format: "number" },
      { key: "grossRevenue", label: "Revenue", format: "currency" },
      { key: "ordersCount", label: "Orders", format: "number" }, { key: "isActive", label: "Active", format: "bool" },
    ],
  },
  {
    id: "ai-usage", label: "AI Usage & Cost", shortLabel: "AI Cost", icon: Bot,
    filters: [
      { key: "search", label: "Provider / user…", type: "text" },
      { key: "status", label: "Operation", type: "select", options: AI_OPERATIONS },
    ],
    columns: [
      { key: "createdAt", label: "Date", format: "date" }, { key: "provider", label: "Provider" },
      { key: "model", label: "Model" }, { key: "operation", label: "Operation", format: "badge", badgeColors: {} },
      { key: "userName", label: "User" }, { key: "inputTokens", label: "In Tokens", format: "number" },
      { key: "outputTokens", label: "Out Tokens", format: "number" }, { key: "imagesGenerated", label: "Images", format: "number" },
      { key: "audioSeconds", label: "Audio s", format: "number" }, { key: "estimatedCostUsd", label: "Cost USD" },
      { key: "estimatedCostInr", label: "Cost INR", format: "currency" },
    ],
  },
  {
    id: "stories", label: "Stories", shortLabel: "Stories", icon: BookOpen,
    filters: [
      { key: "search", label: "Title / user…", type: "text" },
      { key: "status", label: "Status", type: "select", options: STORY_STATUSES },
    ],
    columns: [
      { key: "title", label: "Title" }, { key: "userName", label: "User" }, { key: "universeName", label: "Universe" },
      { key: "storyMode", label: "Mode" }, { key: "theme", label: "Theme" },
      { key: "pageCount", label: "Pages", format: "number" },
      { key: "status", label: "Status", format: "badge", badgeColors: S },
      { key: "generationCostUsd", label: "Cost USD" }, { key: "createdAt", label: "Created", format: "date" },
    ],
  },
  {
    id: "universes", label: "Universes", shortLabel: "Universes", icon: Globe,
    filters: [{ key: "search", label: "Universe / user…", type: "text" }],
    columns: [
      { key: "universeName", label: "Universe" }, { key: "userName", label: "User" },
      { key: "heroesCount", label: "Heroes", format: "number" }, { key: "storiesCount", label: "Stories", format: "number" },
      { key: "powersCount", label: "Powers", format: "number" }, { key: "questsCount", label: "Quests", format: "number" },
      { key: "lastStoryDate", label: "Last Story", format: "date" }, { key: "createdAt", label: "Created", format: "date" },
    ],
  },
  {
    id: "users", label: "Users", shortLabel: "Users", icon: Users,
    filters: [{ key: "search", label: "Name / email…", type: "text" }],
    columns: [
      { key: "name", label: "Name" }, { key: "email", label: "Email" },
      { key: "createdAt", label: "Signup", format: "date" }, { key: "creditsRemaining", label: "Credits", format: "number" },
      { key: "plan", label: "Plan" }, { key: "storiesCount", label: "Stories", format: "number" },
      { key: "universesCount", label: "Universes", format: "number" }, { key: "ordersCount", label: "Orders", format: "number" },
      { key: "totalSpent", label: "Total Spent", format: "currency" },
    ],
  },
  {
    id: "influencers", label: "Influencers", shortLabel: "Influencers", icon: Briefcase,
    filters: [
      { key: "search", label: "Name / code…", type: "text" },
      { key: "status", label: "Status", type: "select", options: [
        { label: "Active", value: "active" }, { label: "Inactive", value: "inactive" }, { label: "Blocked", value: "blocked" },
      ]},
    ],
    columns: [
      { key: "influencerName", label: "Name" }, { key: "couponCode", label: "Coupon" },
      { key: "status", label: "Status", format: "badge", badgeColors: S },
      { key: "successfulOrders", label: "Orders", format: "number" },
      { key: "revenueGenerated", label: "Revenue", format: "currency" },
      { key: "discountGiven", label: "Discount", format: "currency" },
      { key: "commissionRate", label: "Rate %" }, { key: "commissionEarned", label: "Earned", format: "currency" },
      { key: "commissionPaid", label: "Paid", format: "currency" }, { key: "unpaidBalance", label: "Unpaid", format: "currency" },
    ],
  },
  {
    id: "payments-refunds", label: "Payments & Refunds", shortLabel: "Payments", icon: CreditCard,
    filters: [
      { key: "search", label: "Order / txn…", type: "text" },
      { key: "status", label: "Type", type: "select", options: [
        { label: "Payment", value: "payment" }, { label: "Refund", value: "refund" },
        { label: "Partial Refund", value: "partial_refund" },
      ]},
    ],
    columns: [
      { key: "orderNumber", label: "Order #" }, { key: "userName", label: "Customer" },
      { key: "transactionType", label: "Type", format: "badge", badgeColors: S },
      { key: "paymentProvider", label: "Provider" }, { key: "paymentMethod", label: "Method" },
      { key: "amount", label: "Amount", format: "currency" },
      { key: "status", label: "Status", format: "badge", badgeColors: S },
      { key: "transactionId", label: "Txn ID" }, { key: "createdAt", label: "Date", format: "date" },
    ],
  },
  {
    id: "generation-jobs", label: "Generation Jobs", shortLabel: "Gen Jobs", icon: Zap,
    filters: [
      { key: "search", label: "User / story…", type: "text" },
      { key: "status", label: "Status", type: "select", options: JOB_STATUSES },
    ],
    columns: [
      { key: "userName", label: "User" }, { key: "storyTitle", label: "Story" },
      { key: "status", label: "Status", format: "badge", badgeColors: S },
      { key: "currentStep", label: "Step" }, { key: "progressPct", label: "Progress %", format: "number" },
      { key: "startedAt", label: "Started", format: "date" }, { key: "completedAt", label: "Completed", format: "date" },
      { key: "durationSeconds", label: "Duration s", format: "number" }, { key: "errorMessage", label: "Error" },
    ],
  },
  {
    id: "profitability", label: "Profitability", shortLabel: "P&L", icon: BarChart3,
    filters: [],
    columns: [
      { key: "date", label: "Date" }, { key: "revenue", label: "Revenue", format: "currency" },
      { key: "aiCostInr", label: "AI Cost", format: "currency" },
      { key: "influencerCommission", label: "Commission", format: "currency" },
      { key: "refunds", label: "Refunds", format: "currency" },
      { key: "estimatedGrossProfit", label: "Gross Profit", format: "currency" },
      { key: "estimatedMarginPct", label: "Margin %", format: "pct" },
    ],
  },
];

// ─── Cell formatter ───────────────────────────────────────────────────────────

function fmt(value: unknown, col: ColumnDef): ReactNode {
  if (value === null || value === undefined || value === "") return <span className="text-gray-300">—</span>;
  switch (col.format) {
    case "currency": {
      const n = Number(value);
      return <span className="font-semibold tabular-nums">₹{isFinite(n) ? n.toLocaleString("en-IN", { maximumFractionDigits: 2 }) : "—"}</span>;
    }
    case "date": {
      try {
        return <span className="text-gray-400 text-[11px] whitespace-nowrap">{new Date(String(value)).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>;
      } catch { return <span>{String(value)}</span>; }
    }
    case "bool":
      return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${value ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-400"}`}>{value ? "Yes" : "No"}</span>;
    case "number":
      return <span className="tabular-nums">{Number(value).toLocaleString()}</span>;
    case "pct":
      return <span className="tabular-nums font-semibold">{Number(value)}%</span>;
    case "badge": {
      const key = String(value).toLowerCase().replace(/-/g, "_");
      const cls = col.badgeColors?.[key] ?? "bg-gray-100 text-gray-600";
      return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${cls}`}>{String(value).replace(/_/g, " ")}</span>;
    }
    default:
      return <span className="text-gray-700 truncate">{String(value)}</span>;
  }
}

// ─── Summary helpers ──────────────────────────────────────────────────────────

function fmtSummaryKey(k: string) {
  return k.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase()).replace(/Usd$/, "(USD)").replace(/Inr$/, "(INR)").replace(/Pct$/, "(%)").trim();
}
function fmtSummaryVal(k: string, v: number | string) {
  if (typeof v === "string") return v;
  const lk = k.toLowerCase();
  if (["revenue","cost","profit","spent","refund","commission","paid","collected","discount","shipping"].some(w => lk.includes(w))) {
    return `₹${Number(v).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
  }
  if (lk.includes("pct") || lk.includes("rate") || lk.includes("margin")) return `${v}%`;
  return Number(v).toLocaleString();
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [activeId, setActiveId] = useState(REPORTS[0].id);
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [sandbox, setSandbox] = useState<"sandbox" | "live" | "all">("sandbox");

  const ninetyDaysAgo = () => {
    const d = new Date();
    d.setDate(d.getDate() - 90);
    return d.toISOString().split("T")[0];
  };

  const [dateFrom, setDateFrom] = useState(ninetyDaysAgo);
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split("T")[0]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  const report = REPORTS.find(r => r.id === activeId)!;

  const buildParams = useCallback((p: number, all = false) => {
    const q = new URLSearchParams();
    if (dateFrom) q.set("dateFrom", dateFrom);
    if (dateTo) q.set("dateTo", dateTo);
    if (search) q.set("search", search);
    if (status) q.set("status", status);
    if (paymentMethod) q.set("paymentMethod", paymentMethod);
    if (sandbox !== "all") q.set("sandbox", sandbox === "sandbox" ? "true" : "false");
    if (!all) { q.set("page", String(p)); q.set("limit", String(limit)); }
    return q.toString();
  }, [dateFrom, dateTo, search, status, paymentMethod, sandbox, limit]);

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const token = getAccessToken();
      const res = await fetch(`${BASE}/admin/reports/${activeId}?${buildParams(p)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json() as { data?: ReportData } & ReportData;
      const payload = (json.data ?? json) as ReportData;
      if (!payload || !Array.isArray(payload.items)) {
        setData(null);
      } else {
        setData(payload);
        setPage(p);
      }
    } catch { setData(null); }
    finally { setLoading(false); }
  }, [activeId, buildParams]);

  useEffect(() => { void load(1); }, [activeId, sandbox, limit]); // eslint-disable-line react-hooks/exhaustive-deps

  function switchReport(id: string) {
    setActiveId(id);
    setSearch(""); setStatus(""); setPaymentMethod(""); setPage(1); setData(null);
  }

  async function dlExcel() {
    const token = getAccessToken();
    const res = await fetch(`${BASE}/admin/reports/${activeId}/export/excel?${buildParams(1, true)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `herokids_${activeId}_${Date.now()}.xlsx`;
    a.click();
  }

  async function dlPdf() {
    const token = getAccessToken();
    const res = await fetch(`${BASE}/admin/reports/${activeId}/export/pdf?${buildParams(1, true)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `herokids_${activeId}_${Date.now()}.pdf`;
    a.click();
  }

  const summaryEntries = data?.summary ? Object.entries(data.summary) : [];

  return (
    <div className="flex flex-col h-full" style={{ minHeight: 0 }}>

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 bg-white border-b border-gray-100 px-6 py-3 flex items-center gap-3 flex-wrap print:hidden">
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-black text-gray-900 leading-tight">{report.label}</h1>
        </div>
        {/* Sandbox toggle */}
        <div className="flex items-center bg-gray-100 rounded-lg p-0.5 gap-0.5">
          {(["sandbox", "live", "all"] as const).map(m => (
            <button key={m} onClick={() => setSandbox(m)}
              className={`px-3 py-1.5 rounded-md text-xs font-bold capitalize transition-all ${
                sandbox === m
                  ? m === "sandbox" ? "bg-amber-500 text-white"
                    : m === "live" ? "bg-emerald-500 text-white"
                    : "bg-gray-700 text-white"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >{m}</button>
          ))}
        </div>
        {/* Exports */}
        <button onClick={() => void dlExcel()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-all">
          <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
        </button>
        <button onClick={() => void dlPdf()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500 text-white text-xs font-bold hover:bg-rose-600 transition-all">
          <Download className="w-3.5 h-3.5" /> PDF
        </button>
      </div>

      {/* ── Horizontal tab strip ─────────────────────────────────────────── */}
      <div className="flex-shrink-0 bg-white border-b border-gray-100 overflow-x-auto print:hidden">
        <div className="flex px-4 gap-0.5 min-w-max">
          {REPORTS.map(r => {
            const Icon = r.icon;
            const active = r.id === activeId;
            return (
              <button key={r.id} onClick={() => switchReport(r.id)}
                className={`flex items-center gap-1.5 px-3 py-3 text-xs font-semibold whitespace-nowrap border-b-2 transition-all ${
                  active
                    ? "border-violet-600 text-violet-700"
                    : "border-transparent text-gray-400 hover:text-gray-700 hover:border-gray-200"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${active ? "text-violet-600" : ""}`} />
                {r.shortLabel}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Filter bar ───────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 bg-gray-50 border-b border-gray-100 px-4 py-2.5 flex flex-wrap items-center gap-2 print:hidden">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">From</span>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-violet-400" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">To</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-violet-400" />
        </div>

        {report.filters.map(f => {
          if (f.type === "select" && f.options) {
            const val = f.key === "status" ? status : paymentMethod;
            const set = f.key === "status" ? setStatus : setPaymentMethod;
            return (
              <select key={f.key} value={val} onChange={e => set(e.target.value)}
                className="text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-violet-400">
                <option value="">{f.label}</option>
                {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            );
          }
          if (f.type === "text") {
            return (
              <div key={f.key} className="relative">
                <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input type="text" placeholder={f.label} value={search}
                  onChange={e => setSearch(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && void load(1)}
                  className="text-xs pl-7 pr-3 py-1.5 border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-violet-400 w-44" />
              </div>
            );
          }
          return null;
        })}

        <select value={limit} onChange={e => setLimit(Number(e.target.value))}
          className="text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-violet-400">
          <option value={25}>25 rows</option>
          <option value={50}>50 rows</option>
          <option value={100}>100 rows</option>
        </select>

        <button onClick={() => void load(1)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 transition-all">
          <RefreshCw className="w-3 h-3" /> Apply
        </button>
        <button onClick={() => { setSearch(""); setStatus(""); setPaymentMethod(""); setDateFrom(ninetyDaysAgo()); setDateTo(new Date().toISOString().split("T")[0]); }}
          className="flex items-center gap-1 px-3 py-1.5 rounded-md border border-gray-200 text-gray-500 text-xs font-medium hover:bg-gray-100 transition-all">
          <X className="w-3 h-3" /> Reset
        </button>
      </div>

      {/* ── Scrollable content area ───────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto min-h-0">

        {/* Summary cards */}
        {summaryEntries.length > 0 && (
          <div className="px-5 pt-4 pb-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2.5 print:grid-cols-3">
            {summaryEntries.map(([k, v]) => (
              <div key={k} className="bg-white rounded-xl border border-gray-100 shadow-sm px-3.5 py-3">
                <p className="text-[9px] text-gray-400 uppercase tracking-widest font-bold mb-1 leading-none">{fmtSummaryKey(k)}</p>
                <p className="text-lg font-black text-gray-900 leading-tight tabular-nums">{fmtSummaryVal(k, v)}</p>
              </div>
            ))}
          </div>
        )}

        {/* Table */}
        <div className="px-5 pb-5">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">

            {loading && (
              <div className="flex items-center justify-center py-16 gap-3">
                <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-gray-400">Loading…</span>
              </div>
            )}

            {!loading && data && (data.items?.length ?? 0) === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-gray-300">
                <report.icon className="w-10 h-10 mb-3" />
                <p className="text-sm font-semibold text-gray-400">No data for selected filters</p>
                <p className="text-xs mt-1 text-gray-300">Try widening the date range or clearing filters</p>
              </div>
            )}

            {!loading && data && (data.items?.length ?? 0) > 0 && (
              /* This is the ONLY element with overflow-x-auto — table scrolls, page does not */
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse" style={{ minWidth: "max-content" }}>
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="px-3 py-2.5 text-left text-[9px] font-black text-gray-300 uppercase tracking-widest w-10">#</th>
                      {report.columns.map(col => (
                        <th key={col.key} className="px-3 py-2.5 text-left text-[9px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((row, i) => (
                      <tr key={String(row.id ?? i)} className="border-b border-gray-50 hover:bg-violet-50/20 transition-colors">
                        <td className="px-3 py-2.5 text-gray-300 tabular-nums text-[11px]">{(page - 1) * limit + i + 1}</td>
                        {report.columns.map(col => (
                          <td key={col.key} className="px-3 py-2.5 max-w-[180px] overflow-hidden text-ellipsis whitespace-nowrap">
                            {fmt(row[col.key], col)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pagination */}
          {data && data.totalPages > 1 && !loading && (
            <div className="flex items-center justify-between mt-3">
              <p className="text-xs text-gray-400">
                {(page - 1) * limit + 1}–{Math.min(page * limit, data.total)} of {data.total.toLocaleString()} records
              </p>
              <div className="flex items-center gap-1.5">
                <button disabled={page <= 1} onClick={() => void load(page - 1)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                {Array.from({ length: Math.min(5, data.totalPages) }, (_, idx) => {
                  const start = Math.max(1, Math.min(page - 2, data.totalPages - 4));
                  const pg = start + idx;
                  return (
                    <button key={pg} onClick={() => void load(pg)}
                      className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                        pg === page ? "bg-violet-600 text-white" : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}
                    >{pg}</button>
                  );
                })}
                <button disabled={page >= data.totalPages} onClick={() => void load(page + 1)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
