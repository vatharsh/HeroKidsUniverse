"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";

import { getAccessToken } from "@/lib/api";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

interface PortalMe {
  couponCodes: Array<{
    id: string;
    code: string;
    discountType: "percentage" | "fixed_amount";
    discountValue: number;
    usageCount: number;
    isActive: boolean;
    expiresAt: string | null;
  }>;
}

export default function InfluencerCouponsPage() {
  const [data, setData] = useState<PortalMe | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;
    fetch(`${BASE}/influencer/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((j) => setData((j.data ?? j) as PortalMe))
      .catch(() => null);
  }, []);

  function handleCopy(id: string, code: string) {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  return (
    <div className="rounded-3xl border border-violet-100 bg-white p-6 shadow-sm">
      <h2 className="font-[family-name:var(--font-display)] text-3xl text-gray-900 mb-2">My Coupon Codes</h2>
      <p className="text-gray-500 mb-6">Use these codes in your posts and shares.</p>
      <div className="space-y-4">
        {(data?.couponCodes ?? []).map((coupon) => {
          const copied = copiedId === coupon.id;
          return (
            <div key={coupon.id} className="rounded-2xl border border-gray-100 p-4 flex items-center justify-between gap-4">
              <div>
                <p className="font-mono font-bold text-xl text-violet-700">{coupon.code}</p>
                <p className="text-sm text-gray-500 mt-1">
                  {coupon.discountType === "percentage" ? `${coupon.discountValue}% off` : `₹${coupon.discountValue} off`}
                  {" · "}Used {coupon.usageCount} times
                  {coupon.expiresAt ? ` · Expires ${new Date(coupon.expiresAt).toLocaleDateString()}` : ""}
                </p>
                <p className="text-sm text-gray-700 mt-2">
                  "Use my code <span className="font-semibold">{coupon.code}</span> to create a magical HeroKids Universe storybook."
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(coupon.id, coupon.code)}
                className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-all duration-200 cursor-pointer select-none min-w-[160px] justify-center
                  ${copied
                    ? "bg-emerald-500 text-white scale-95"
                    : "bg-violet-600 hover:bg-violet-700 text-white hover:scale-105 active:scale-95"
                  }`}
              >
                {copied ? (
                  <><Check className="w-4 h-4" /> Copied!</>
                ) : (
                  <><Copy className="w-4 h-4" /> Copy Code</>
                )}
              </button>
            </div>
          );
        })}
        {(data?.couponCodes ?? []).length === 0 && <p className="text-sm text-gray-400">No coupon codes yet.</p>}
      </div>
    </div>
  );
}
