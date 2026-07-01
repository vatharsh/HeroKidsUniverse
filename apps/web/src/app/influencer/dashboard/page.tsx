"use client";

import { BadgePercent, Banknote, Check, CheckCircle2, Copy, ShoppingBag, Wallet } from "lucide-react";
import { useEffect, useState } from "react";

import { getAccessToken } from "@/lib/api";
import { cn } from "@/lib/utils";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

interface Summary {
  currentCommissionRate: number;
  totalOrdersReferred: number;
  revenueGenerated: number;
  currentWalletBalance: number;
  paidLifetime: number;
  pendingCommission: number;
  approvedCommission: number;
  lastPayoutDate: string | null;
}

interface Coupon {
  id: string;
  code: string;
  discountType: "percentage" | "fixed_amount";
  discountValue: number;
  usageCount: number;
  isActive: boolean;
  expiresAt: string | null;
}

export default function InfluencerDashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;
    fetch(`${BASE}/influencer/dashboard-summary`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((j) => {
        const data = j.data ?? j;
        setSummary(data);
        setCoupons(data.couponCodes ?? []);
      })
      .catch(() => null);
  }, []);

  function handleCopy(id: string, code: string) {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  const activeCoupons = coupons.filter((c) => c.isActive).length;

  const statCards = [
    { label: "Commission Rate",    value: summary ? `${summary.currentCommissionRate}%` : "—", icon: CheckCircle2 },
    { label: "Total Orders",       value: summary?.totalOrdersReferred?.toLocaleString() ?? "—", icon: ShoppingBag },
    { label: "Revenue Generated",  value: summary ? `₹${summary.revenueGenerated.toLocaleString()}` : "—", icon: Banknote },
    { label: "Current Wallet",     value: summary ? `₹${summary.currentWalletBalance.toLocaleString()}` : "—", icon: Wallet },
    { label: "Paid Lifetime",      value: summary ? `₹${summary.paidLifetime.toLocaleString()}` : "—", icon: Banknote },
    { label: "Active Coupons",     value: String(activeCoupons), icon: BadgePercent },
  ];

  return (
    <div className="space-y-6">
      {/* Hero banner */}
      <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(135deg,rgba(124,58,237,0.34),rgba(59,7,100,0.16))] p-6 text-white">
        <p className="text-white/70 text-sm">Welcome to your partner dashboard</p>
        <h2 className="font-[family-name:var(--font-display)] text-4xl mt-2">Track your magic</h2>
        <p className="text-white/70 mt-2 max-w-2xl">
          View your coupon performance, wallet balance, commissions, and payouts in one calm place.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {statCards.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-3xl border border-violet-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">{label}</p>
              <span className="w-10 h-10 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center">
                <Icon className="w-4 h-4" />
              </span>
            </div>
            <p className="text-3xl font-black text-gray-900 mt-4">{value}</p>
          </div>
        ))}
      </div>

      {/* Coupon cards */}
      <div className="rounded-3xl border border-violet-100 bg-white p-5 shadow-sm">
        <p className="text-xs uppercase tracking-[0.28em] text-violet-500 font-bold mb-4">Your Coupon Codes</p>
        {coupons.length === 0 ? (
          <p className="text-sm text-gray-400">No coupon codes assigned yet.</p>
        ) : (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {coupons.map((coupon) => {
              const copied = copiedId === coupon.id;
              const isExpired = coupon.expiresAt ? new Date(coupon.expiresAt) < new Date() : false;
              const status = !coupon.isActive ? "Inactive" : isExpired ? "Expired" : "Active";
              const statusColor = status === "Active"
                ? "bg-emerald-100 text-emerald-700"
                : "bg-gray-100 text-gray-500";

              return (
                <div key={coupon.id} className={cn(
                  "rounded-2xl border p-4 flex flex-col gap-3",
                  coupon.isActive && !isExpired ? "border-violet-100 bg-violet-50/30" : "border-gray-100 bg-gray-50 opacity-70"
                )}>
                  {/* Code + status */}
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-mono font-bold text-xl text-violet-700 leading-none">{coupon.code}</p>
                    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0", statusColor)}>
                      {status}
                    </span>
                  </div>

                  {/* Discount */}
                  <p className="text-sm text-gray-600">
                    {coupon.discountType === "percentage" ? `${coupon.discountValue}% off` : `₹${coupon.discountValue} off`}
                    {coupon.expiresAt && (
                      <span className="text-gray-400 ml-2 text-xs">
                        · Expires {new Date(coupon.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    )}
                  </p>

                  {/* Usage stat */}
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-3xl font-black text-gray-900 leading-none">{coupon.usageCount}</p>
                      <p className="text-xs text-gray-400 mt-0.5">total uses</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCopy(coupon.id, coupon.code)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition-all duration-200",
                        copied
                          ? "bg-emerald-500 text-white scale-95"
                          : "bg-violet-600 hover:bg-violet-700 text-white hover:scale-105 active:scale-95"
                      )}
                    >
                      {copied ? <><Check className="w-3.5 h-3.5" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom row: wallet breakdown */}
      <div className="rounded-3xl border border-violet-100 bg-white p-5 shadow-sm">
        <p className="text-xs uppercase tracking-[0.28em] text-violet-500 font-bold mb-4">Wallet Breakdown</p>
        <div className="space-y-4">
          <WalletRow label="Pending Commission"  value={summary?.pendingCommission ?? 0} />
          <WalletRow label="Approved Commission" value={summary?.approvedCommission ?? 0} />
          <WalletRow label="Paid Lifetime"       value={summary?.paidLifetime ?? 0} />
          <div className="pt-3 border-t border-gray-100">
            <p className="text-sm text-gray-500">Last Payout</p>
            <p className="text-lg font-bold text-gray-900 mt-1">
              {summary?.lastPayoutDate
                ? new Date(summary.lastPayoutDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
                : "No payout yet"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function WalletRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-lg font-bold text-gray-900">₹{value.toLocaleString()}</p>
    </div>
  );
}
