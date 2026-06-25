"use client";

import {
  Briefcase, Check, ChevronDown, ChevronRight, Eye, Loader2, Plus, RefreshCw,
  Search, Tag, Wallet, X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { getAccessToken } from "@/lib/api";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

interface WalletSummary {
  approvedAmount: number;
  paidAmountLifetime: number;
}

interface Influencer {
  id: string;
  name: string;
  code: string;
  email: string | null;
  platform: string | null;
  commissionPct: number;
  active: boolean;
  status?: string;
  wallet?: WalletSummary;
  commissionOwedInr?: number;
  commissionPaidInr?: number;
}

interface Paginated {
  items: Influencer[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const STATUS_STYLE: Record<string, string> = {
  active:   "bg-emerald-50 text-emerald-700",
  inactive: "bg-gray-100 text-gray-500",
  blocked:  "bg-red-50 text-red-600",
};

// ── Coupon code auto-suggestions ───────────────────────────────────────────────

function generateCodeSuggestions(name: string, discountValue: string): string[] {
  const val = (discountValue || "10").replace(/\D/g, "") || "10";
  const words = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (s: string) => {
    if (!seen.has(s) && s.length > val.length) { seen.add(s); out.push(s); }
  };
  push(words[0].slice(0, 7) + val);
  if (words.length >= 2) push((words[0].slice(0, 4) + words[1].slice(0, 4)) + val);
  if (words.length >= 2) push(words[words.length - 1].slice(0, 7) + val);
  return out.slice(0, 3);
}

// ── Create influencer wizard ───────────────────────────────────────────────────

function NewModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [profile, setProfile] = useState({
    name: "", email: "", phone: "", platform: "", socialHandle: "",
    commissionPct: "10", paymentMethod: "upi", status: "active",
    notes: "", temporaryPassword: "",
  });
  const [couponEnabled, setCouponEnabled] = useState(true);
  const [coupon, setCoupon] = useState({
    code: "",
    discountType: "percentage" as "percentage" | "fixed_amount",
    discountValue: "10",
    maxDiscountAmount: "", minimumOrderAmount: "", usageLimit: "", expiresAt: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showPortal, setShowPortal] = useState(false);

  const suggestions = useMemo(
    () => generateCodeSuggestions(profile.name, coupon.discountValue),
    [profile.name, coupon.discountValue],
  );

  function goStep2() {
    setError("");
    if (!coupon.code && suggestions.length > 0) {
      setCoupon(c => ({ ...c, code: suggestions[0] }));
    }
    setStep(2);
  }

  async function save() {
    const token = getAccessToken();
    if (!token || !profile.name.trim()) return;
    setSaving(true);
    setError("");
    try {
      const body: Record<string, unknown> = {
        name: profile.name,
        email: profile.email || undefined,
        phone: profile.phone || undefined,
        platform: profile.platform || undefined,
        socialHandle: profile.socialHandle || undefined,
        commissionPct: Number(profile.commissionPct),
        paymentMethod: profile.paymentMethod || undefined,
        notes: profile.notes || undefined,
        temporaryPassword: profile.temporaryPassword || undefined,
        status: profile.status,
        active: profile.status === "active",
      };
      if (couponEnabled && coupon.code.trim()) {
        body.couponCode = coupon.code.trim();
        body.initialCouponDiscountType = coupon.discountType;
        body.initialCouponDiscountValue = Number(coupon.discountValue);
        if (coupon.maxDiscountAmount) body.initialCouponMaxDiscountAmount = Number(coupon.maxDiscountAmount);
        if (coupon.minimumOrderAmount) body.initialCouponMinimumOrderAmount = Number(coupon.minimumOrderAmount);
        if (coupon.usageLimit) body.initialCouponUsageLimit = Number(coupon.usageLimit);
        if (coupon.expiresAt) body.initialCouponExpiresAt = coupon.expiresAt;
      }
      const res = await fetch(`${BASE}/admin/influencers`, {
        method: "POST",
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
      setError(err instanceof Error ? err.message : "Failed to create influencer");
    } finally {
      setSaving(false);
    }
  }

  // Economics preview
  const discN = Number(coupon.discountValue || 0);
  const commN = Number(profile.commissionPct || 0);
  const base = 1000;
  const rawD = coupon.discountType === "percentage" ? (base * discN) / 100 : discN;
  const capD = coupon.maxDiscountAmount ? Math.min(rawD, Number(coupon.maxDiscountAmount)) : rawD;
  const custD = Math.min(base, Math.round(capD * 100) / 100);
  const custP = base - custD;
  const infC = Math.round(custP * commN) / 100;
  const warn = discN > 15 || discN + commN > 25;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="w-[520px] bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>

        {/* Header + step indicator */}
        <div className="px-6 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-gray-900 font-bold text-lg">New Influencer</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100 transition">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center">
            <div className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${step === 1 ? "bg-violet-600 text-white" : "bg-violet-100 text-violet-600"}`}>
                {step > 1 ? <Check className="w-3 h-3" /> : "1"}
              </div>
              <span className={`text-xs font-semibold ${step === 1 ? "text-violet-700" : "text-gray-400"}`}>Profile</span>
            </div>
            <div className="flex-1 h-px bg-gray-200 mx-3" />
            <div className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${step === 2 ? "bg-violet-600 text-white" : "bg-gray-100 text-gray-400"}`}>
                2
              </div>
              <span className={`text-xs font-semibold ${step === 2 ? "text-violet-700" : "text-gray-400"}`}>Coupon Code</span>
            </div>
          </div>
        </div>

        {/* ── Step 1: Profile ─────────────────────────────────────────────── */}
        {step === 1 && (
          <div className="px-6 py-5 space-y-4 max-h-[58vh] overflow-y-auto">
            {error && <p className="text-red-600 text-xs bg-red-50 rounded-lg px-3 py-2">{error}</p>}

            <div>
              <label className="text-gray-500 text-xs block mb-1">Name <span className="text-red-400">*</span></label>
              <input
                value={profile.name}
                onChange={e => setProfile(p => ({ ...p, name: e.target.value }))}
                placeholder="Mom Blogger"
                autoFocus
                onKeyDown={e => { if (e.key === "Enter" && profile.name.trim()) goStep2(); }}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-gray-800 text-sm font-semibold placeholder:font-normal placeholder:text-gray-400 focus:outline-none focus:border-violet-400 focus:bg-white transition"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-gray-500 text-xs block mb-1">Email</label>
                <input
                  type="email"
                  value={profile.email}
                  onChange={e => setProfile(p => ({ ...p, email: e.target.value }))}
                  placeholder="blogger@example.com"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-800 text-sm placeholder:text-gray-400 focus:outline-none focus:border-violet-400 transition"
                />
              </div>
              <div>
                <label className="text-gray-500 text-xs block mb-1">Phone</label>
                <input
                  value={profile.phone}
                  onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))}
                  placeholder="9999999999"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-800 text-sm placeholder:text-gray-400 focus:outline-none focus:border-violet-400 transition"
                />
              </div>
              <div>
                <label className="text-gray-500 text-xs block mb-1">Platform</label>
                <select
                  value={profile.platform}
                  onChange={e => setProfile(p => ({ ...p, platform: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-800 text-sm focus:outline-none focus:border-violet-400 transition"
                >
                  <option value="">Select platform</option>
                  <option value="instagram">Instagram</option>
                  <option value="youtube">YouTube</option>
                  <option value="facebook">Facebook</option>
                  <option value="tiktok">TikTok</option>
                  <option value="twitter">Twitter / X</option>
                  <option value="linkedin">LinkedIn</option>
                  <option value="blog">Blog / Website</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="text-gray-500 text-xs block mb-1">Social Handle</label>
                <input
                  value={profile.socialHandle}
                  onChange={e => setProfile(p => ({ ...p, socialHandle: e.target.value }))}
                  placeholder="@username"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-800 text-sm placeholder:text-gray-400 focus:outline-none focus:border-violet-400 transition"
                />
              </div>
              <div>
                <label className="text-gray-500 text-xs block mb-1">Default Commission %</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={profile.commissionPct}
                    onChange={e => setProfile(p => ({ ...p, commissionPct: e.target.value }))}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 pr-7 text-gray-800 text-sm focus:outline-none focus:border-violet-400 transition"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none">%</span>
                </div>
              </div>
              <div>
                <label className="text-gray-500 text-xs block mb-1">Status</label>
                <select
                  value={profile.status}
                  onChange={e => setProfile(p => ({ ...p, status: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-800 text-sm focus:outline-none focus:border-violet-400 transition"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="blocked">Blocked</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-gray-500 text-xs block mb-1">Notes</label>
              <textarea
                value={profile.notes}
                onChange={e => setProfile(p => ({ ...p, notes: e.target.value }))}
                rows={2}
                placeholder="Internal notes about this influencer"
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-800 text-sm resize-none placeholder:text-gray-400 focus:outline-none focus:border-violet-400 transition"
              />
            </div>

            {/* Portal access — collapsible */}
            <div className="rounded-xl border border-gray-100 overflow-hidden">
              <button
                type="button"
                onClick={() => setShowPortal(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition"
              >
                <span className="text-xs font-semibold text-gray-600">
                  Portal Access
                  <span className="text-gray-400 font-normal ml-1">(optional — set later if you prefer)</span>
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${showPortal ? "rotate-180" : ""}`} />
              </button>
              {showPortal && (
                <div className="px-4 pb-4 pt-3 space-y-3 border-t border-gray-100">
                  <div>
                    <label className="text-gray-500 text-xs block mb-1">Temporary Password</label>
                    <input
                      type="password"
                      value={profile.temporaryPassword}
                      onChange={e => setProfile(p => ({ ...p, temporaryPassword: e.target.value }))}
                      placeholder="min 8 characters"
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-800 text-sm placeholder:text-gray-400 focus:outline-none focus:border-violet-400 transition"
                    />
                    <p className="text-[11px] text-gray-400 mt-1">Influencer logs in with their email + this password.</p>
                  </div>
                  <div>
                    <label className="text-gray-500 text-xs block mb-1">Payment Method</label>
                    <select
                      value={profile.paymentMethod}
                      onChange={e => setProfile(p => ({ ...p, paymentMethod: e.target.value }))}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-800 text-sm focus:outline-none focus:border-violet-400 transition"
                    >
                      <option value="upi">UPI</option>
                      <option value="bank">Bank Transfer</option>
                      <option value="paypal">PayPal</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Step 2: Coupon Code ──────────────────────────────────────────── */}
        {step === 2 && (
          <div className="px-6 py-5 space-y-4 max-h-[58vh] overflow-y-auto">
            {error && <p className="text-red-600 text-xs bg-red-50 rounded-lg px-3 py-2">{error}</p>}

            {/* Toggle */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-gray-800">Create a coupon code</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Customers use this to get a discount — sales are attributed to <strong className="text-gray-600">{profile.name}</strong>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCouponEnabled(v => !v)}
                className={`relative mt-0.5 w-10 h-5 rounded-full transition-colors shrink-0 ${couponEnabled ? "bg-violet-600" : "bg-gray-200"}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${couponEnabled ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
            </div>

            {couponEnabled ? (
              <>
                {/* Suggestions */}
                {suggestions.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-400 mb-2">Suggested — click to select:</p>
                    <div className="flex gap-2 flex-wrap">
                      {suggestions.map(s => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setCoupon(c => ({ ...c, code: s }))}
                          className={`font-mono text-sm font-bold px-3 py-1.5 rounded-lg border transition ${
                            coupon.code === s
                              ? "bg-violet-600 text-white border-violet-600 shadow-sm"
                              : "bg-gray-50 text-violet-700 border-gray-200 hover:border-violet-400 hover:bg-violet-50"
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Code input */}
                <div>
                  <label className="text-gray-500 text-xs block mb-1">
                    Code <span className="text-red-400">*</span>
                    <span className="text-gray-400 font-normal ml-1">— or type your own</span>
                  </label>
                  <input
                    value={coupon.code}
                    onChange={e => setCoupon(c => ({ ...c, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") }))}
                    placeholder="MOM10"
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-violet-700 text-base font-mono font-black tracking-widest placeholder:text-gray-300 placeholder:font-normal placeholder:tracking-normal focus:outline-none focus:border-violet-400 focus:bg-white transition"
                  />
                </div>

                {/* Discount type + value */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-gray-500 text-xs block mb-1">Discount Type</label>
                    <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                      {(["percentage", "fixed_amount"] as const).map(val => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setCoupon(c => ({ ...c, discountType: val }))}
                          className={`flex-1 text-xs font-semibold py-2 transition ${coupon.discountType === val ? "bg-violet-600 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
                        >
                          {val === "percentage" ? "% Off" : "₹ Off"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-gray-500 text-xs block mb-1">
                      Value {coupon.discountType === "percentage" ? "(%)" : "(₹)"}
                    </label>
                    <input
                      type="number"
                      value={coupon.discountValue}
                      onChange={e => setCoupon(c => ({ ...c, discountValue: e.target.value }))}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-800 text-sm focus:outline-none focus:border-violet-400 transition"
                    />
                  </div>
                </div>

                {/* Optional fields */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-gray-500 text-xs block mb-1">Usage Limit</label>
                    <input
                      type="number"
                      value={coupon.usageLimit}
                      onChange={e => setCoupon(c => ({ ...c, usageLimit: e.target.value }))}
                      placeholder="unlimited"
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-800 text-sm placeholder:text-gray-400 focus:outline-none focus:border-violet-400 transition"
                    />
                  </div>
                  <div>
                    <label className="text-gray-500 text-xs block mb-1">Expires At</label>
                    <input
                      type="date"
                      value={coupon.expiresAt}
                      onChange={e => setCoupon(c => ({ ...c, expiresAt: e.target.value }))}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-800 text-sm focus:outline-none focus:border-violet-400 transition"
                    />
                  </div>
                  <div>
                    <label className="text-gray-500 text-xs block mb-1">Min Order (₹)</label>
                    <input
                      type="number"
                      value={coupon.minimumOrderAmount}
                      onChange={e => setCoupon(c => ({ ...c, minimumOrderAmount: e.target.value }))}
                      placeholder="optional"
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-800 text-sm placeholder:text-gray-400 focus:outline-none focus:border-violet-400 transition"
                    />
                  </div>
                  <div>
                    <label className="text-gray-500 text-xs block mb-1">Max Discount (₹)</label>
                    <input
                      type="number"
                      value={coupon.maxDiscountAmount}
                      onChange={e => setCoupon(c => ({ ...c, maxDiscountAmount: e.target.value }))}
                      placeholder="optional cap"
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-800 text-sm placeholder:text-gray-400 focus:outline-none focus:border-violet-400 transition"
                    />
                  </div>
                </div>

                {/* Economics preview */}
                <div className={`rounded-xl border p-3 ${warn ? "border-amber-200 bg-amber-50" : "border-violet-100 bg-violet-50"}`}>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-violet-500 mb-2">Preview on ₹1,000 order</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <span className="text-gray-500">Customer saves</span>
                    <span className="text-right font-semibold text-rose-600">₹{custD.toLocaleString()}</span>
                    <span className="text-gray-500">Customer pays</span>
                    <span className="text-right font-semibold text-gray-800">₹{custP.toLocaleString()}</span>
                    <span className="text-gray-500">Influencer earns ({commN}%)</span>
                    <span className="text-right font-semibold text-emerald-700">₹{infC.toLocaleString()}</span>
                    <span className="text-gray-500">Total marketing cost</span>
                    <span className={`text-right font-bold ${warn ? "text-amber-700" : "text-gray-900"}`}>₹{(custD + infC).toLocaleString()}</span>
                  </div>
                  {warn && <p className="text-[11px] text-amber-700 mt-2 font-medium">High discount or commission — check margin before publishing.</p>}
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 text-xs text-amber-800">
                <p className="font-semibold mb-1">No coupon code will be created</p>
                <p className="text-amber-700">Customers won{"'"}t have a code to attribute to this influencer. You can add coupon codes later from their profile page.</p>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100">
          {step === 1 ? (
            <button
              onClick={goStep2}
              disabled={!profile.name.trim()}
              className="w-full bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold py-2.5 rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              Next: Set Up Coupon Code
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <div className="space-y-2">
              <button
                onClick={() => void save()}
                disabled={saving || (couponEnabled && !coupon.code.trim())}
                className="w-full bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold py-2.5 rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {saving
                  ? "Creating…"
                  : couponEnabled && coupon.code
                    ? `Create Influencer + Code ${coupon.code}`
                    : "Create Influencer"}
              </button>
              <button
                type="button"
                onClick={() => setStep(1)}
                disabled={saving}
                className="w-full text-gray-500 hover:text-gray-800 text-sm py-1.5 transition disabled:opacity-50"
              >
                ← Back to Profile
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── List page ──────────────────────────────────────────────────────────────────

export default function InfluencersPage() {
  const [data, setData] = useState<Paginated | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  function fetchData(p = page, q = search, s = statusFilter) {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: "20" });
    if (q) params.set("search", q);
    if (s) params.set("status", s);
    fetch(`${BASE}/admin/influencers?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(j => setData(j.data ?? j))
      .catch(() => null)
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchData(); }, []); // eslint-disable-line

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {showNew && <NewModal onClose={() => setShowNew(false)} onSaved={() => fetchData()} />}

      <div className="mb-6 flex items-center gap-3">
        <Briefcase className="w-5 h-5 text-amber-600" />
        <h1 className="text-gray-900 text-2xl font-black">Influencers</h1>
        <div className="ml-auto flex gap-2">
          <Link
            href="/admin/influencer-settings"
            className="text-xs text-gray-500 font-medium px-3 py-1.5 rounded-lg border border-gray-200 hover:border-gray-300 transition"
          >
            Commission Settings
          </Link>
          <button onClick={() => fetchData()} className="text-gray-400 hover:text-gray-700 transition p-1.5 rounded-lg hover:bg-gray-100">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition"
          >
            <Plus className="w-3.5 h-3.5" /> Add Influencer
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
          <Search className="w-3.5 h-3.5 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { setPage(1); fetchData(1, search, statusFilter); } }}
            placeholder="Search name, email, platform…"
            className="bg-transparent outline-none text-sm text-gray-800 placeholder:text-gray-400 w-60"
          />
        </div>
        {(["", "active", "inactive", "blocked"] as const).map(s => (
          <button
            key={s || "all"}
            onClick={() => { setStatusFilter(s); setPage(1); fetchData(1, search, s); }}
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
              {["Influencer", "Platform", "Code", "Commission", "Unpaid Balance", "Paid Lifetime", "Status", "Actions"].map(h => (
                <th key={h} className="text-left px-4 py-3 text-gray-500 text-xs font-semibold uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-10 text-center"><Loader2 className="w-5 h-5 text-violet-600 animate-spin mx-auto" /></td></tr>
            ) : data?.items.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400 text-xs">No influencers yet</td></tr>
            ) : (
              data?.items.map(inf => {
                const approved = inf.wallet?.approvedAmount ?? inf.commissionOwedInr ?? 0;
                const paidLifetime = inf.wallet?.paidAmountLifetime ?? inf.commissionPaidInr ?? 0;
                const statusKey = inf.status ?? (inf.active ? "active" : "inactive");
                return (
                  <tr key={inf.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="text-xs font-bold text-gray-900">{inf.name}</div>
                      {inf.email && <div className="text-[11px] text-gray-400">{inf.email}</div>}
                    </td>
                    <td className="px-4 py-3">
                      {inf.platform
                        ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 capitalize">{inf.platform}</span>
                        : <span className="text-gray-400 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Tag className="w-3 h-3 text-violet-400" />
                        <span className="font-mono text-xs font-bold text-violet-700">{inf.code}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs font-bold text-gray-800">{inf.commissionPct}%</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Wallet className="w-3 h-3 text-amber-500" />
                        <span className="text-xs font-bold text-amber-700">₹{Number(approved).toLocaleString()}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-emerald-600 text-xs font-semibold">₹{Number(paidLifetime).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_STYLE[statusKey] ?? "bg-gray-100 text-gray-500"}`}>
                        {statusKey}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Link
                          href={`/admin/influencers/${inf.id}`}
                          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 font-medium transition"
                        >
                          <Eye className="w-3.5 h-3.5" /> View
                        </Link>
                        <Link
                          href={`/admin/influencers/${inf.id}/payouts`}
                          className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-800 font-semibold transition"
                        >
                          <Check className="w-3.5 h-3.5" /> Settle
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {data && data.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
          <span>{data.total} influencers</span>
          <div className="flex gap-2">
            <button onClick={() => { setPage(p => p - 1); fetchData(page - 1); }} disabled={page === 1} className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-30 hover:border-gray-300 transition">Prev</button>
            <span className="px-3 py-1.5">{page} / {data.totalPages}</span>
            <button onClick={() => { setPage(p => p + 1); fetchData(page + 1); }} disabled={page === data.totalPages} className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-30 hover:border-gray-300 transition">Next</button>
          </div>
        </div>
      )}

      {data && (
        <div className="mt-6 grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total Influencers</p>
            <p className="text-2xl font-black text-gray-900">{data.total}</p>
          </div>
          <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
            <p className="text-xs text-amber-600 uppercase tracking-wide mb-1">Total Unpaid Balance</p>
            <p className="text-2xl font-black text-amber-700">
              ₹{data.items.reduce((s, i) => s + Number(i.wallet?.approvedAmount ?? i.commissionOwedInr ?? 0), 0).toLocaleString()}
            </p>
          </div>
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
            <p className="text-xs text-emerald-600 uppercase tracking-wide mb-1">Total Paid Lifetime</p>
            <p className="text-2xl font-black text-emerald-700">
              ₹{data.items.reduce((s, i) => s + Number(i.wallet?.paidAmountLifetime ?? i.commissionPaidInr ?? 0), 0).toLocaleString()}
            </p>
          </div>
        </div>
      )}

      <div className="mt-4 flex items-center gap-2 text-xs text-gray-400">
        <ChevronRight className="w-3 h-3" />
        <span>Click "View" to manage coupons, commissions, and profile · Click "Settle" to initiate payout</span>
      </div>
    </div>
  );
}
