"use client";

import { BadgePercent, Banknote, CheckCircle2, ShoppingBag, Wallet } from "lucide-react";
import { useEffect, useState } from "react";

import { getAccessToken } from "@/lib/api";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

interface Summary {
  primaryCouponCode: string;
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

  const cards = [
    { label: "Coupon Code", value: summary?.primaryCouponCode ?? "—", icon: BadgePercent },
    { label: "Current Rate", value: summary ? `${summary.currentCommissionRate}%` : "—", icon: CheckCircle2 },
    { label: "Total Orders", value: summary?.totalOrdersReferred?.toLocaleString() ?? "—", icon: ShoppingBag },
    { label: "Revenue Generated", value: summary ? `₹${summary.revenueGenerated.toLocaleString()}` : "—", icon: Banknote },
    { label: "Current Wallet", value: summary ? `₹${summary.currentWalletBalance.toLocaleString()}` : "—", icon: Wallet },
    { label: "Paid Lifetime", value: summary ? `₹${summary.paidLifetime.toLocaleString()}` : "—", icon: Banknote },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(135deg,rgba(124,58,237,0.34),rgba(59,7,100,0.16))] p-6 text-white">
        <p className="text-white/70 text-sm">Welcome to your partner dashboard</p>
        <h2 className="font-[family-name:var(--font-display)] text-4xl mt-2">Track your magic</h2>
        <p className="text-white/70 mt-2 max-w-2xl">
          View your coupon performance, wallet balance, commissions, and payouts in one calm place.
        </p>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {cards.map(({ label, value, icon: Icon }) => (
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

      <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-4">
        <div className="rounded-3xl border border-violet-100 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.28em] text-violet-500 font-bold mb-4">Coupon Codes</p>
          <div className="space-y-3">
            {coupons.map((coupon) => (
              <div key={coupon.id} className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="font-mono font-bold text-violet-700">{coupon.code}</p>
                  <p className="text-sm text-gray-500">
                    {coupon.discountType === "percentage" ? `${coupon.discountValue}% off` : `₹${coupon.discountValue} off`}
                    {" · "}used {coupon.usageCount} times
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(coupon.code)}
                  className="rounded-full bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-700 transition"
                >
                  Copy Code
                </button>
              </div>
            ))}
            {coupons.length === 0 && <p className="text-sm text-gray-400">No coupon codes yet.</p>}
          </div>
        </div>

        <div className="rounded-3xl border border-violet-100 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.28em] text-violet-500 font-bold mb-4">Wallet Breakdown</p>
          <div className="space-y-4">
            <WalletRow label="Pending Commission" value={summary?.pendingCommission ?? 0} />
            <WalletRow label="Approved Commission" value={summary?.approvedCommission ?? 0} />
            <WalletRow label="Paid Lifetime" value={summary?.paidLifetime ?? 0} />
            <div className="pt-3 border-t border-gray-100">
              <p className="text-sm text-gray-500">Last Payout</p>
              <p className="text-lg font-bold text-gray-900 mt-1">
                {summary?.lastPayoutDate ? new Date(summary.lastPayoutDate).toLocaleDateString() : "No payout yet"}
              </p>
            </div>
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
