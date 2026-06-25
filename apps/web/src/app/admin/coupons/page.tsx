"use client";

import {
  Check, Copy, Edit2, Loader2, Plus, Save, Tag, X,
} from "lucide-react";
import { useEffect, useState } from "react";

import { getAccessToken } from "@/lib/api";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

// ─── Types ────────────────────────────────────────────────────────────────────

type CouponType = "influencer" | "platform";
type DiscountType = "percentage" | "fixed_amount";

interface Coupon {
  id: string;
  code: string;
  couponType: CouponType;
  discountType: DiscountType;
  discountValue: number;
  maxDiscountAmount: number | null;
  isActive: boolean;
  usageCount: number;
  usageLimit: number | null;
  minimumOrderAmount: number | null;
  startsAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  influencer?: { id: string; name: string; code: string } | null;
}

interface FormState {
  code: string;
  discountType: DiscountType;
  discountValue: string;
  maxDiscountAmount: string;
  usageLimit: string;
  minimumOrderAmount: string;
  startsAt: string;
  expiresAt: string;
  isActive: boolean;
}

const EMPTY_FORM: FormState = {
  code: "",
  discountType: "percentage",
  discountValue: "10",
  maxDiscountAmount: "",
  usageLimit: "",
  minimumOrderAmount: "",
  startsAt: "",
  expiresAt: "",
  isActive: true,
};

// ─── Platform coupon modal ────────────────────────────────────────────────────

function PlatformCouponModal({
  coupon,
  onClose,
  onSaved,
}: {
  coupon?: Coupon;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>(
    coupon
      ? {
          code: coupon.code,
          discountType: coupon.discountType,
          discountValue: String(coupon.discountValue),
          maxDiscountAmount: coupon.maxDiscountAmount ? String(coupon.maxDiscountAmount) : "",
          usageLimit: coupon.usageLimit ? String(coupon.usageLimit) : "",
          minimumOrderAmount: coupon.minimumOrderAmount ? String(coupon.minimumOrderAmount) : "",
          startsAt: coupon.startsAt ? coupon.startsAt.slice(0, 10) : "",
          expiresAt: coupon.expiresAt ? coupon.expiresAt.slice(0, 10) : "",
          isActive: coupon.isActive,
        }
      : EMPTY_FORM,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    const token = getAccessToken();
    if (!token || !form.code || !form.discountValue) return;
    setSaving(true);
    setError("");
    const body = {
      code: form.code.toUpperCase().trim(),
      discountType: form.discountType,
      discountValue: Number(form.discountValue),
      maxDiscountAmount: form.maxDiscountAmount ? Number(form.maxDiscountAmount) : null,
      usageLimit: form.usageLimit ? Number(form.usageLimit) : null,
      minimumOrderAmount: form.minimumOrderAmount ? Number(form.minimumOrderAmount) : null,
      startsAt: form.startsAt || null,
      expiresAt: form.expiresAt || null,
      isActive: form.isActive,
    };
    try {
      const url = coupon
        ? `${BASE}/admin/coupons/${coupon.id}`
        : `${BASE}/admin/coupons/platform`;
      const res = await fetch(url, {
        method: coupon ? "PATCH" : "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(Array.isArray(j.message) ? j.message[0] : (j.message ?? "Failed"));
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const example = 1000;
  const raw = form.discountType === "percentage"
    ? (example * Number(form.discountValue || 0)) / 100
    : Number(form.discountValue || 0);
  const capped = form.maxDiscountAmount ? Math.min(raw, Number(form.maxDiscountAmount)) : raw;
  const discount = Math.min(example, Math.round(capped * 100) / 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="w-[420px] bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-gray-900">{coupon ? "Edit Coupon" : "New Platform Coupon"}</h3>
            {!coupon && <p className="text-[11px] text-blue-600 font-medium mt-0.5">HeroKids-funded · no commission</p>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-4 space-y-3 max-h-[70vh] overflow-y-auto">
          {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <div>
            <label className="text-xs text-gray-500 block mb-1">Coupon Code (uppercase)</label>
            <input
              value={form.code}
              onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
              placeholder="WELCOME10"
              disabled={!!coupon}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono font-bold text-blue-700 focus:outline-none focus:border-blue-400 disabled:opacity-60"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Discount Type</label>
              <select
                value={form.discountType}
                onChange={e => setForm(f => ({ ...f, discountType: e.target.value as DiscountType }))}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
              >
                <option value="percentage">Percentage (%)</option>
                <option value="fixed_amount">Fixed Amount (₹)</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">
                Value ({form.discountType === "percentage" ? "%" : "₹"})
              </label>
              <input
                type="number"
                value={form.discountValue}
                onChange={e => setForm(f => ({ ...f, discountValue: e.target.value }))}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Max Discount (₹)</label>
              <input
                type="number"
                value={form.maxDiscountAmount}
                onChange={e => setForm(f => ({ ...f, maxDiscountAmount: e.target.value }))}
                placeholder="no cap"
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Minimum Order (₹)</label>
              <input
                type="number"
                value={form.minimumOrderAmount}
                onChange={e => setForm(f => ({ ...f, minimumOrderAmount: e.target.value }))}
                placeholder="no minimum"
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Usage Limit</label>
              <input
                type="number"
                value={form.usageLimit}
                onChange={e => setForm(f => ({ ...f, usageLimit: e.target.value }))}
                placeholder="unlimited"
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Start Date</label>
              <input
                type="date"
                value={form.startsAt}
                onChange={e => setForm(f => ({ ...f, startsAt: e.target.value }))}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-500 block mb-1">Expiry Date</label>
              <input
                type="date"
                value={form.expiresAt}
                onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
              className="w-4 h-4 accent-blue-600"
            />
            Active
          </label>

          <div className="rounded-xl border border-blue-100 bg-blue-50 p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-blue-500 mb-2">Discount Preview (on ₹1,000 order)</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <span className="text-gray-500">Customer saves</span>
              <span className="text-right text-rose-600 font-semibold">₹{discount.toLocaleString()}</span>
              <span className="text-gray-500">Customer pays</span>
              <span className="text-right text-gray-800 font-semibold">₹{(example - discount).toLocaleString()}</span>
              <span className="text-gray-500">Platform funds</span>
              <span className="text-right text-blue-700 font-semibold">₹{discount.toLocaleString()}</span>
              <span className="text-gray-500">Commission</span>
              <span className="text-right text-gray-400 font-semibold">None</span>
            </div>
          </div>
        </div>
        <div className="px-5 py-4 border-t border-gray-100">
          <button
            onClick={() => void save()}
            disabled={saving || !form.code || !form.discountValue}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {coupon ? "Save Changes" : "Create Platform Coupon"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Coupon row ───────────────────────────────────────────────────────────────

function CouponRow({
  coupon,
  onEdit,
}: {
  coupon: Coupon;
  onEdit: (c: Coupon) => void;
}) {
  const [copied, setCopied] = useState(false);
  const isPlatform = coupon.couponType === "platform";
  const usagePct = coupon.usageLimit ? Math.min(100, (coupon.usageCount / coupon.usageLimit) * 100) : null;
  const isExpired = coupon.expiresAt ? new Date(coupon.expiresAt) < new Date() : false;

  return (
    <tr className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-mono font-black text-sm tracking-wider" style={{ color: isPlatform ? "#2563eb" : "#7c3aed" }}>
            {coupon.code}
          </span>
          <button
            onClick={() => { void navigator.clipboard.writeText(coupon.code); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            className="text-gray-300 hover:text-gray-500 transition"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${
          isPlatform ? "bg-blue-50 text-blue-700" : "bg-violet-50 text-violet-700"
        }`}>
          {isPlatform ? "Platform" : "Influencer"}
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-gray-700">
        {coupon.discountType === "percentage" ? `${coupon.discountValue}%` : `₹${coupon.discountValue}`}
        {coupon.maxDiscountAmount ? <span className="text-gray-400"> · cap ₹{coupon.maxDiscountAmount}</span> : null}
      </td>
      <td className="px-4 py-3 text-xs text-gray-500">
        {coupon.influencer ? (
          <span className="font-medium text-violet-700">{coupon.influencer.name}</span>
        ) : (
          <span className="text-gray-300">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="text-xs text-gray-500">
          {usagePct !== null ? (
            <div>
              <div className="flex justify-between text-[10px] mb-1">
                <span>{coupon.usageCount} / {coupon.usageLimit}</span>
                <span>{Math.round(usagePct)}%</span>
              </div>
              <div className="w-20 h-1 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-1 rounded-full ${usagePct >= 90 ? "bg-red-400" : isPlatform ? "bg-blue-400" : "bg-violet-400"}`}
                  style={{ width: `${usagePct}%` }}
                />
              </div>
            </div>
          ) : (
            <span>{coupon.usageCount} uses</span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
        {coupon.expiresAt ? (
          <span className={isExpired ? "text-red-500" : ""}>
            {isExpired ? "Expired " : ""}{new Date(coupon.expiresAt).toLocaleDateString()}
          </span>
        ) : (
          <span className="text-gray-300">No expiry</span>
        )}
      </td>
      <td className="px-4 py-3">
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
          coupon.isActive && !isExpired ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"
        }`}>
          {coupon.isActive && !isExpired ? "Active" : "Inactive"}
        </span>
      </td>
      <td className="px-4 py-3">
        {isPlatform && (
          <button
            onClick={() => onEdit(coupon)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
        )}
      </td>
    </tr>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type FilterType = "all" | "platform" | "influencer";

export default function CouponsAdminPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<"new" | Coupon | null>(null);

  function load(p = page, f = filter, s = search) {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: "50" });
    if (f !== "all") params.set("couponType", f);
    if (s) params.set("search", s);
    fetch(`${BASE}/admin/coupons?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(j => {
        const d = j.data ?? j;
        setCoupons(d.items ?? []);
        setTotal(d.total ?? 0);
      })
      .catch(() => setError("Failed to load coupons"))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []); // eslint-disable-line

  function applyFilter(f: FilterType) {
    setFilter(f);
    setPage(1);
    load(1, f, search);
  }

  function applySearch(s: string) {
    setSearch(s);
    setPage(1);
    load(1, filter, s);
  }

  const platformCount = coupons.filter(c => c.couponType === "platform").length;
  const influencerCount = coupons.filter(c => c.couponType === "influencer").length;
  const activeCount = coupons.filter(c => c.isActive).length;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {modal !== null && (
        <PlatformCouponModal
          coupon={modal === "new" ? undefined : modal}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
        />
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900">Coupons</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage platform & influencer discount codes</p>
        </div>
        <button
          onClick={() => setModal("new")}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition shadow-sm"
        >
          <Plus className="w-4 h-4" /> New Platform Coupon
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Coupons", value: total, color: "text-gray-900" },
          { label: "Platform", value: platformCount, color: "text-blue-700" },
          { label: "Influencer", value: influencerCount, color: "text-violet-700" },
          { label: "Active", value: activeCount, color: "text-emerald-700" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
            <p className={`text-2xl font-black mt-1 ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {(["all", "platform", "influencer"] as FilterType[]).map(f => (
            <button
              key={f}
              onClick={() => applyFilter(f)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold capitalize transition ${
                filter === f ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={search}
          onChange={e => applySearch(e.target.value)}
          placeholder="Search code..."
          className="ml-auto w-48 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
          </div>
        ) : error ? (
          <p className="text-center text-sm text-red-500 py-16">{error}</p>
        ) : coupons.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Tag className="w-8 h-8 mb-3 text-gray-300" />
            <p className="text-sm font-semibold text-gray-500">No coupons found</p>
            <p className="text-xs text-gray-400 mt-1">
              {filter === "platform" ? "Create your first platform coupon above." : "Influencer coupons are created on the influencer detail page."}
            </p>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {["Code", "Type", "Discount", "Influencer", "Usage", "Expiry", "Status", ""].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-gray-400 font-semibold uppercase tracking-wide text-[10px] whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {coupons.map(c => (
                <CouponRow key={c.id} coupon={c} onEdit={setModal} />
              ))}
            </tbody>
          </table>
        )}
        {!loading && coupons.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-50">
            <span className="text-xs text-gray-400">{total} total</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { const p = page - 1; setPage(p); load(p); }}
                disabled={page === 1}
                className="text-xs text-gray-500 disabled:opacity-30 hover:text-gray-700"
              >
                ← Prev
              </button>
              <span className="text-xs text-gray-400">Page {page}</span>
              <button
                onClick={() => { const p = page + 1; setPage(p); load(p); }}
                disabled={coupons.length < 50}
                className="text-xs text-gray-500 disabled:opacity-30 hover:text-gray-700"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400 mt-4">
        Influencer coupon codes are created and managed on the{" "}
        <a href="/admin/influencers" className="text-violet-600 hover:underline">influencer detail page</a>.
        Platform coupons are created here.
      </p>
    </div>
  );
}
