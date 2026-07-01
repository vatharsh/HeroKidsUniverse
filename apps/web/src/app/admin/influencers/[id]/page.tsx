"use client";

import {
  ArrowLeft, Check, Copy, Edit2, Loader2, Plus, Save, Tag, Wallet, X,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { getAccessToken } from "@/lib/api";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CouponCode {
  id: string;
  code: string;
  discountType: "percentage" | "fixed_amount";
  discountValue: number;
  maxDiscountAmount: number | null;
  isActive: boolean;
  usageCount: number;
  usageLimit: number | null;
  startsAt: string | null;
  expiresAt: string | null;
  minimumOrderAmount: number | null;
  createdAt: string;
}

interface CommissionRule {
  id?: string;
  minSuccessfulOrders: number;
  commissionRate: number;
  isActive: boolean;
}

interface Commission {
  id: string;
  orderNumber: string;
  orderTotal: number;
  discountAmount: number;
  commissionRate: number;
  commissionAmount: number;
  status: string;
  earnedAt: string | null;
  paidAt: string | null;
  createdAt: string;
}

interface WalletData {
  pendingAmount: number;
  approvedAmount: number;
  paidAmountLifetime: number;
  lastPayoutAt: string | null;
  currency: string;
}

interface InfluencerDetail {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  platform: string | null;
  socialHandle: string | null;
  code: string;
  commissionPct: number;
  active: boolean;
  status?: string;
  paymentMethod: string | null;
  paymentDetailsJson: Record<string, unknown> | null;
  notes: string | null;
  createdAt: string;
  login?: {
    enabled: boolean;
    hasAccount: boolean;
    email: string | null;
    lastLoginAt: string | null;
  };
  couponCodes?: CouponCode[];
  wallet?: WalletData;
  commissionRules?: CommissionRule[];
  recentCommissions?: Commission[];
  currentCommissionRate?: number;
  economicsPreview?: {
    exampleSubtotal: number;
    customerDiscount: number;
    customerPays: number;
    influencerCommission: number;
    totalMarketingCost: number;
    effectiveMarketingCost: number;
    warning: string | null;
  };
}

// ─── Commission status styles ─────────────────────────────────────────────────

const COMM_STYLE: Record<string, string> = {
  pending:   "bg-amber-50 text-amber-700",
  approved:  "bg-violet-50 text-violet-700",
  paid:      "bg-emerald-50 text-emerald-700",
  cancelled: "bg-gray-100 text-gray-500",
  reversed:  "bg-red-50 text-red-600",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function SectionHeader({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{children}</p>
      {action}
    </div>
  );
}

// ─── Coupon create/edit modal ─────────────────────────────────────────────────

function CouponModal({
  influencerId, coupon, onClose, onSaved, currentCommissionRate,
}: {
  influencerId: string;
  coupon?: CouponCode;
  onClose: () => void;
  onSaved: () => void;
  currentCommissionRate?: number;
}) {
  const [form, setForm] = useState({
    code: coupon?.code ?? "",
    discountType: coupon?.discountType ?? "percentage",
    discountValue: String(coupon?.discountValue ?? "10"),
    maxDiscountAmount: coupon?.maxDiscountAmount ? String(coupon.maxDiscountAmount) : "",
    usageLimit: coupon?.usageLimit ? String(coupon.usageLimit) : "",
    expiresAt: coupon?.expiresAt ? coupon.expiresAt.slice(0, 10) : "",
    minimumOrderAmount: coupon?.minimumOrderAmount ? String(coupon.minimumOrderAmount) : "",
    isActive: coupon?.isActive ?? true,
  });
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
      expiresAt: form.expiresAt || null,
      minimumOrderAmount: form.minimumOrderAmount ? Number(form.minimumOrderAmount) : null,
      isActive: form.isActive,
    };
    try {
      const url = coupon
        ? `${BASE}/admin/influencers/${influencerId}/coupons/${coupon.id}`
        : `${BASE}/admin/influencers/${influencerId}/coupons`;
      const res = await fetch(url, {
        method: coupon ? "PATCH" : "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(j.message ?? "Failed");
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const exampleSubtotal = 1000;
  const enteredDiscount = Number(form.discountValue || 0);
  const rawDiscount = form.discountType === "percentage"
    ? (exampleSubtotal * enteredDiscount) / 100
    : enteredDiscount;
  const cappedDiscount = form.maxDiscountAmount ? Math.min(rawDiscount, Number(form.maxDiscountAmount)) : rawDiscount;
  const customerDiscount = Math.min(exampleSubtotal, Math.round(cappedDiscount * 100) / 100);
  const customerPays = Math.round((exampleSubtotal - customerDiscount) * 100) / 100;
  const commissionRate = currentCommissionRate ?? 10;
  const influencerCommission = Math.round(customerPays * commissionRate) / 100;
  const totalMarketingCost = Math.round((customerDiscount + influencerCommission) * 100) / 100;
  const effectiveMarketingCost = Math.round((totalMarketingCost / exampleSubtotal) * 10000) / 100;
  const showWarning = enteredDiscount > 15 || enteredDiscount + commissionRate > 25;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="w-96 bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">{coupon ? "Edit Coupon" : "New Coupon Code"}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <div>
            <label className="text-xs text-gray-500 block mb-1">Code (uppercase)</label>
            <input
              value={form.code}
              onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
              placeholder="MOM20"
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono font-bold text-violet-700 focus:outline-none focus:border-violet-400"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Discount Type</label>
              <select
                value={form.discountType}
                onChange={e => setForm(f => ({ ...f, discountType: e.target.value as "percentage" | "fixed_amount" }))}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-400"
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
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-400"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Usage Limit</label>
              <input
                type="number"
                value={form.usageLimit}
                onChange={e => setForm(f => ({ ...f, usageLimit: e.target.value }))}
                placeholder="unlimited"
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-400"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Expires At</label>
              <input
                type="date"
                value={form.expiresAt}
                onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-400"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Max Discount Amount</label>
              <input
                type="number"
                value={form.maxDiscountAmount}
                onChange={e => setForm(f => ({ ...f, maxDiscountAmount: e.target.value }))}
                placeholder="optional cap"
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-400"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Minimum Order Amount</label>
              <input
                type="number"
                value={form.minimumOrderAmount}
                onChange={e => setForm(f => ({ ...f, minimumOrderAmount: e.target.value }))}
                placeholder="optional minimum"
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-400"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
              className="w-4 h-4 accent-violet-600"
            />
            Active
          </label>
          <div className={`rounded-xl border p-3 ${showWarning ? "border-amber-200 bg-amber-50" : "border-violet-100 bg-violet-50"}`}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-violet-500 mb-2">Economics Preview</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <span className="text-gray-500">On ₹1000 order</span>
              <span className="text-right font-semibold text-gray-800">Current commission {commissionRate}%</span>
              <span className="text-gray-500">Customer discount</span>
              <span className="text-right text-rose-600 font-semibold">₹{customerDiscount.toLocaleString()}</span>
              <span className="text-gray-500">Customer pays</span>
              <span className="text-right text-gray-800 font-semibold">₹{customerPays.toLocaleString()}</span>
              <span className="text-gray-500">Influencer commission</span>
              <span className="text-right text-emerald-700 font-semibold">₹{influencerCommission.toLocaleString()}</span>
              <span className="text-gray-500">Total marketing cost</span>
              <span className="text-right text-gray-900 font-bold">₹{totalMarketingCost.toLocaleString()}</span>
              <span className="text-gray-500">Effective marketing cost</span>
              <span className="text-right text-gray-900 font-bold">{effectiveMarketingCost}%</span>
            </div>
            {showWarning && <p className="text-[11px] text-amber-700 mt-3 font-medium">High discount + high commission may reduce margin.</p>}
          </div>
        </div>
        <div className="px-5 py-4 border-t border-gray-100">
          <button
            onClick={() => void save()}
            disabled={saving || !form.code || !form.discountValue}
            className="w-full bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold py-2.5 rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {coupon ? "Save Changes" : "Create Coupon"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Commission rules editor ──────────────────────────────────────────────────

function CommissionRulesEditor({
  influencerId, rules, onSaved,
}: {
  influencerId: string;
  rules: CommissionRule[];
  onSaved: () => void;
}) {
  const [rows, setRows] = useState<{ min: string; rate: string }[]>(
    rules.length > 0
      ? rules.map(r => ({ min: String(r.minSuccessfulOrders), rate: String(r.commissionRate) }))
      : [{ min: "0", rate: "10" }]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function save() {
    const token = getAccessToken();
    if (!token) return;
    setSaving(true);
    setError("");
    try {
      const payload = rows.map(r => ({
        minSuccessfulOrders: Number(r.min),
        commissionRate: Number(r.rate),
      }));
      const res = await fetch(`${BASE}/admin/influencers/${influencerId}/commission-rules`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(j.message ?? "Failed");
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
      <div className="space-y-2 mb-3">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="number"
              value={row.min}
              onChange={e => setRows(rs => rs.map((r, j) => j === i ? { ...r, min: e.target.value } : r))}
              placeholder="Min orders"
              className="w-28 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-400"
            />
            <span className="text-gray-400 text-xs">orders →</span>
            <input
              type="number"
              value={row.rate}
              onChange={e => setRows(rs => rs.map((r, j) => j === i ? { ...r, rate: e.target.value } : r))}
              placeholder="Rate %"
              className="w-24 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-400"
            />
            <span className="text-gray-400 text-xs">%</span>
            {rows.length > 1 && (
              <button onClick={() => setRows(rs => rs.filter((_, j) => j !== i))} className="text-gray-300 hover:text-red-500 transition">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => setRows(rs => [...rs, { min: "", rate: "" }])}
          className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 transition"
        >
          <Plus className="w-3 h-3" /> Add Tier
        </button>
        <button
          onClick={() => void save()}
          disabled={saving}
          className="ml-auto flex items-center gap-1.5 text-xs bg-violet-600 hover:bg-violet-700 text-white font-semibold px-3 py-1.5 rounded-lg transition disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : saved ? <Check className="w-3 h-3" /> : <Save className="w-3 h-3" />}
          {saved ? "Saved!" : "Save Rules"}
        </button>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function InfluencerDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [detail, setDetail] = useState<InfluencerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [editSaving, setEditSaving] = useState(false);
  const [loginPassword, setLoginPassword] = useState("");
  const [loginSaving, setLoginSaving] = useState(false);

  const [couponModal, setCouponModal] = useState<"new" | CouponCode | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [commPage, setCommPage] = useState(1);
  const [commLoading, setCommLoading] = useState(false);

  function load() {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    fetch(`${BASE}/admin/influencers/${id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(j => {
        const d = j.data ?? j;
        setDetail(d as InfluencerDetail);
        setEditForm({
          name: d.name ?? "",
          email: d.email ?? "",
          phone: d.phone ?? "",
          platform: d.platform ?? "",
          socialHandle: d.socialHandle ?? "",
          commissionPct: String(d.commissionPct ?? ""),
          paymentMethod: d.paymentMethod ?? "",
          status: d.status ?? (d.active ? "active" : "inactive"),
        });
      })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  }

  function loadCommissions(p = 1) {
    const token = getAccessToken();
    if (!token) return;
    setCommLoading(true);
    fetch(`${BASE}/admin/influencers/${id}/commissions?page=${p}&limit=20`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(j => setCommissions((j.data ?? j).items ?? []))
      .catch(() => null)
      .finally(() => setCommLoading(false));
  }

  useEffect(() => { load(); loadCommissions(); }, [id]); // eslint-disable-line

  async function saveEdit() {
    const token = getAccessToken();
    if (!token) return;
    setEditSaving(true);
    try {
      const res = await fetch(`${BASE}/admin/influencers/${id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name,
          email: editForm.email || null,
          phone: editForm.phone || null,
          platform: editForm.platform || null,
          socialHandle: editForm.socialHandle || null,
          commissionPct: Number(editForm.commissionPct),
          paymentMethod: editForm.paymentMethod || null,
          status: editForm.status,
          active: editForm.status === "active",
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setEditing(false);
      load();
    } finally {
      setEditSaving(false);
    }
  }

  async function createOrResetLogin() {
    const token = getAccessToken();
    if (!token || !loginPassword.trim() || loginPassword.trim().length < 8) return;
    setLoginSaving(true);
    try {
      const hasAccount = detail?.login?.hasAccount;
      const endpoint = hasAccount ? "reset-password" : "login";
      const body = hasAccount
        ? { password: loginPassword }
        : { email: editForm.email || detail?.email || "", password: loginPassword };
      const res = await fetch(`${BASE}/admin/influencers/${id}/${endpoint}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to update login");
      setLoginPassword("");
      load();
    } finally {
      setLoginSaving(false);
    }
  }

  async function toggleLogin(enabled: boolean) {
    const token = getAccessToken();
    if (!token) return;
    setLoginSaving(true);
    try {
      const res = await fetch(`${BASE}/admin/influencers/${id}/login-status`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) throw new Error("Failed to update login status");
      load();
    } finally {
      setLoginSaving(false);
    }
  }

  if (loading) return (
    <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 text-violet-500 animate-spin" /></div>
  );
  if (error || !detail) return (
    <div className="p-8 text-gray-500 text-sm">{error || "Influencer not found"}</div>
  );

  const wallet = detail.wallet;
  const rules = detail.commissionRules ?? [];
  const coupons = detail.couponCodes ?? [];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {couponModal !== null && (
        <CouponModal
          influencerId={id}
          coupon={couponModal === "new" ? undefined : couponModal}
          currentCommissionRate={detail.currentCommissionRate}
          onClose={() => setCouponModal(null)}
          onSaved={() => { setCouponModal(null); load(); }}
        />
      )}

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6">
        <Link href="/admin/influencers" className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition">
          <ArrowLeft className="w-3.5 h-3.5" /> Influencers
        </Link>
        <span className="text-gray-300 text-xs">/</span>
        <span className="text-xs font-semibold text-gray-800">{detail.name}</span>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left column */}
        <div className="col-span-2 space-y-6">

          {/* Profile */}
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Profile</p>
              <button
                onClick={() => setEditing(e => !e)}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 transition"
              >
                <Edit2 className="w-3.5 h-3.5" /> {editing ? "Cancel" : "Edit"}
              </button>
            </div>
            {editing ? (
              <div className="px-5 py-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {([
                    { key: "name",          label: "Name" },
                    { key: "email",         label: "Email" },
                    { key: "phone",         label: "Phone" },
                    { key: "platform",      label: "Platform" },
                    { key: "socialHandle",  label: "Social Handle" },
                    { key: "commissionPct", label: "Commission %" },
                    { key: "paymentMethod", label: "Payment Method" },
                  ] as { key: string; label: string }[]).map(({ key, label }) => (
                    <div key={key}>
                      <label className="text-xs text-gray-500 block mb-1">{label}</label>
                      <input
                        value={editForm[key] ?? ""}
                        onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-400"
                      />
                    </div>
                  ))}
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Status</label>
                    <select
                      value={editForm.status ?? "active"}
                      onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-400"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="blocked">Blocked</option>
                    </select>
                  </div>
                </div>
                <button
                  onClick={() => void saveEdit()}
                  disabled={editSaving}
                  className="flex items-center gap-2 text-sm bg-violet-600 hover:bg-violet-700 text-white font-semibold px-4 py-2 rounded-lg transition disabled:opacity-50"
                >
                  {editSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Save Profile
                </button>
              </div>
            ) : (
              <div className="px-5 py-4">
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                  {[
                    ["Email",    detail.email],
                    ["Phone",    detail.phone],
                    ["Platform", detail.platform],
                    ["Handle",   detail.socialHandle],
                    ["Commission", `${detail.commissionPct}%`],
                    ["Payment",  detail.paymentMethod],
                    ["Status",   detail.status ?? (detail.active ? "active" : "inactive")],
                    ["Joined",   new Date(detail.createdAt).toLocaleDateString()],
                  ].map(([label, value]) => value ? (
                    <div key={label as string} className="flex justify-between border-b border-gray-50 py-1">
                      <span className="text-gray-400">{label}</span>
                      <span className="text-gray-800 font-medium capitalize">{value}</span>
                    </div>
                  ) : null)}
                </div>
                <div className="mt-4 border-t border-gray-100 pt-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Influencer Notes <span className="normal-case font-normal">(set by influencer, read-only)</span></p>
                  {detail.notes
                    ? <p className="text-xs text-gray-700 bg-amber-50 border border-amber-100 rounded-lg p-3 whitespace-pre-wrap">{detail.notes}</p>
                    : <p className="text-xs text-gray-400 italic">No notes from influencer yet.</p>
                  }
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100">
              <SectionHeader>Login Access</SectionHeader>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                  <p className="text-gray-400">Login Status</p>
                  <p className="mt-1 font-semibold text-gray-900">{detail.login?.enabled ? "Active" : "Inactive"}</p>
                </div>
                <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                  <p className="text-gray-400">Last Login</p>
                  <p className="mt-1 font-semibold text-gray-900">{detail.login?.lastLoginAt ? new Date(detail.login.lastLoginAt).toLocaleString() : "Never"}</p>
                </div>
              </div>
              <div className="grid md:grid-cols-[1fr_auto_auto] gap-3 items-end">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Temporary / Reset Password</label>
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="minimum 8 characters"
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-400"
                  />
                </div>
                <button
                  onClick={() => void createOrResetLogin()}
                  disabled={loginSaving || !(editForm.email || detail.email) || loginPassword.trim().length < 8}
                  className="rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold px-4 py-2.5 disabled:opacity-50"
                >
                  {detail.login?.hasAccount ? "Reset Password" : "Create Login"}
                </button>
                {detail.login?.hasAccount && (
                  <button
                    onClick={() => void toggleLogin(!detail.login?.enabled)}
                    disabled={loginSaving}
                    className="rounded-lg border border-gray-200 text-xs font-semibold px-4 py-2.5 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {detail.login?.enabled ? "Deactivate Login" : "Activate Login"}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Coupon Codes */}
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100">
              <SectionHeader
                action={
                  <button
                    onClick={() => setCouponModal("new")}
                    className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-800 font-semibold transition"
                  >
                    <Plus className="w-3.5 h-3.5" /> New Code
                  </button>
                }
              >
                Coupon Codes
              </SectionHeader>
            </div>
            <div className="px-5 py-4">
              {coupons.length === 0 ? (
                <div className="rounded-xl border-2 border-dashed border-gray-200 p-5 text-center">
                  <Tag className="w-6 h-6 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500 text-xs font-semibold">No coupon codes yet</p>
                  <p className="text-gray-400 text-[11px] mt-0.5">Customers need a code to attribute orders to this influencer.</p>
                  <button
                    onClick={() => setCouponModal("new")}
                    className="mt-3 text-xs text-violet-600 font-semibold hover:text-violet-800 transition"
                  >
                    + Create first coupon code
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {coupons.map((c, idx) => {
                    const firstActiveIdx = coupons.findIndex(x => x.isActive);
                    const isPrimary = idx === firstActiveIdx && c.isActive;
                    const usagePct = c.usageLimit ? Math.min(100, (c.usageCount / c.usageLimit) * 100) : null;
                    return (
                      <div
                        key={c.id}
                        className={`rounded-xl border px-4 py-3 transition ${isPrimary ? "border-violet-200 bg-violet-50/40" : "border-gray-100 bg-gray-50"}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            {/* Code + badges */}
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="font-mono text-base font-black text-violet-700 tracking-wider">{c.code}</span>
                              {isPrimary && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-600 uppercase tracking-wide">
                                  Primary
                                </span>
                              )}
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${c.isActive ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                                {c.isActive ? "Active" : "Inactive"}
                              </span>
                              {c.discountType === "percentage" && Number(c.discountValue) > 15 && (
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700">High Discount</span>
                              )}
                            </div>
                            {/* Discount details */}
                            <p className="text-[11px] text-gray-500">
                              {c.discountType === "percentage" ? `${c.discountValue}% off` : `₹${c.discountValue} off`}
                              {c.minimumOrderAmount ? ` · min ₹${c.minimumOrderAmount}` : ""}
                              {c.maxDiscountAmount ? ` · cap ₹${c.maxDiscountAmount}` : ""}
                              {c.expiresAt ? ` · expires ${new Date(c.expiresAt).toLocaleDateString()}` : " · no expiry"}
                            </p>
                            {/* Usage */}
                            <div className="mt-2">
                              {usagePct !== null ? (
                                <>
                                  <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                                    <span>Used {c.usageCount} of {c.usageLimit}</span>
                                    <span>{Math.round(usagePct)}%</span>
                                  </div>
                                  <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                                    <div
                                      className={`h-1 rounded-full transition-all ${usagePct >= 90 ? "bg-red-400" : "bg-violet-400"}`}
                                      style={{ width: `${usagePct}%` }}
                                    />
                                  </div>
                                </>
                              ) : (
                                <span className="text-[10px] text-gray-400">Used {c.usageCount} times · no limit</span>
                              )}
                            </div>
                          </div>
                          {/* Actions */}
                          <div className="flex items-center gap-0.5 shrink-0">
                            <button
                              onClick={() => {
                                void navigator.clipboard.writeText(c.code);
                                setCopiedId(c.id);
                                setTimeout(() => setCopiedId(null), 1500);
                              }}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-violet-600 hover:bg-violet-50 transition"
                              title="Copy code"
                            >
                              {copiedId === c.id
                                ? <Check className="w-3.5 h-3.5 text-emerald-500" />
                                : <Copy className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              onClick={() => setCouponModal(c)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
                              title="Edit coupon"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Commission Rules */}
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100">
              <SectionHeader>Commission Rules (Override)</SectionHeader>
            </div>
            <div className="px-5 py-4">
              <p className="text-xs text-gray-400 mb-3">Leave empty to use global tier rules. Set per-influencer overrides here.</p>
              <CommissionRulesEditor influencerId={id} rules={rules} onSaved={load} />
            </div>
          </div>

          {/* Recent Commissions */}
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100">
              <SectionHeader>Commission History</SectionHeader>
            </div>
            <div>
              {commLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-4 h-4 text-violet-500 animate-spin" /></div>
              ) : commissions.length === 0 ? (
                <p className="text-gray-400 text-xs px-5 py-4">No commissions yet.</p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      {["Order #", "Order Total", "Discount", "Rate", "Commission", "Status", "Date"].map(h => (
                        <th key={h} className="text-left px-4 py-2.5 text-gray-400 font-semibold uppercase tracking-wide text-[10px] whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {commissions.map(c => (
                      <tr key={c.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-mono font-bold text-gray-800">{c.orderNumber}</td>
                        <td className="px-4 py-2.5 text-gray-700">₹{Number(c.orderTotal).toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-red-500">−₹{Number(c.discountAmount).toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-gray-600">{c.commissionRate}%</td>
                        <td className="px-4 py-2.5 font-bold text-emerald-600">₹{Number(c.commissionAmount).toLocaleString()}</td>
                        <td className="px-4 py-2.5">
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${COMM_STYLE[c.status] ?? "bg-gray-100 text-gray-500"}`}>
                            {c.status}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-gray-400 whitespace-nowrap">{new Date(c.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div className="flex justify-between items-center px-5 py-3 border-t border-gray-50">
                <button onClick={() => { const p = commPage - 1; setCommPage(p); loadCommissions(p); }} disabled={commPage === 1} className="text-xs text-gray-500 disabled:opacity-30">← Prev</button>
                <span className="text-xs text-gray-400">Page {commPage}</span>
                <button onClick={() => { const p = commPage + 1; setCommPage(p); loadCommissions(p); }} disabled={commissions.length < 20} className="text-xs text-gray-500 disabled:opacity-30">Next →</button>
              </div>
            </div>
          </div>

        </div>

        {/* Right column — Wallet + Quick Actions */}
        <div className="space-y-4">

          {/* Wallet */}
          <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Wallet className="w-4 h-4 text-amber-600" />
              <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Wallet</p>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-amber-600">Current Rate</span>
                <span className="font-bold text-amber-800">{detail.currentCommissionRate ?? detail.commissionPct}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-amber-600">Approved (Unpaid)</span>
                <span className="font-black text-amber-800 text-base">₹{Number(wallet?.approvedAmount ?? 0).toLocaleString()}</span>
              </div>
              {(wallet?.pendingAmount ?? 0) > 0 && (
                <div className="flex justify-between">
                  <span className="text-amber-600">Pending</span>
                  <span className="font-semibold text-amber-700">₹{Number(wallet?.pendingAmount ?? 0).toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-amber-100 pt-2 mt-2">
                <span className="text-amber-600">Paid Lifetime</span>
                <span className="font-bold text-emerald-700">₹{Number(wallet?.paidAmountLifetime ?? 0).toLocaleString()}</span>
              </div>
              {wallet?.lastPayoutAt && (
                <div className="flex justify-between">
                  <span className="text-amber-600">Last Payout</span>
                  <span className="text-gray-600">{new Date(wallet.lastPayoutAt).toLocaleDateString()}</span>
                </div>
              )}
            </div>
            <Link
              href={`/admin/influencers/${id}/payouts`}
              className="mt-4 w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold py-2 rounded-lg transition"
            >
              <Check className="w-3.5 h-3.5" /> Settle Payout
            </Link>
          </div>

          {/* Quick Info */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm text-xs space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Quick Info</p>
            <div className="flex justify-between">
              <span className="text-gray-400">Default Commission</span>
              <span className="font-bold text-gray-800">{detail.commissionPct}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Current Tier Rate</span>
              <span className="font-bold text-violet-700">{detail.currentCommissionRate ?? detail.commissionPct}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Coupon Codes</span>
              <span className="font-bold text-gray-800">{coupons.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Active Codes</span>
              <span className="font-bold text-emerald-600">{coupons.filter(c => c.isActive).length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Payment Method</span>
              <span className="font-semibold text-gray-700 uppercase">{detail.paymentMethod ?? "—"}</span>
            </div>
          </div>

          {detail.economicsPreview && (
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm text-xs">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Economics Preview</p>
              <div className="space-y-2">
                <div className="flex justify-between"><span className="text-gray-400">On ₹{detail.economicsPreview.exampleSubtotal}</span><span className="font-semibold text-gray-800">Default 10% discount</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Customer discount</span><span className="text-rose-600 font-semibold">₹{detail.economicsPreview.customerDiscount}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Customer pays</span><span className="font-semibold text-gray-800">₹{detail.economicsPreview.customerPays}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Influencer commission</span><span className="text-emerald-700 font-semibold">₹{detail.economicsPreview.influencerCommission}</span></div>
                <div className="flex justify-between border-t border-gray-100 pt-2"><span className="text-gray-400">Total marketing cost</span><span className="font-bold text-gray-900">₹{detail.economicsPreview.totalMarketingCost}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Effective marketing cost</span><span className="font-bold text-gray-900">{detail.economicsPreview.effectiveMarketingCost}%</span></div>
              </div>
              {detail.economicsPreview.warning && (
                <p className="text-amber-700 font-medium mt-3">{detail.economicsPreview.warning}</p>
              )}
            </div>
          )}

          {/* Payout History link */}
          <Link
            href={`/admin/influencers/${id}/payouts`}
            className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:border-violet-300 transition group"
          >
            <div>
              <p className="text-xs font-bold text-gray-800 group-hover:text-violet-700">Payout History</p>
              <p className="text-[11px] text-gray-400 mt-0.5">View & settle payouts</p>
            </div>
            <ArrowLeft className="w-4 h-4 text-gray-300 rotate-180 group-hover:text-violet-400 transition" />
          </Link>

        </div>
      </div>
    </div>
  );
}
