"use client";

import { Check, Copy, Link2 } from "lucide-react";
import { useEffect, useState } from "react";

import { getAccessToken } from "@/lib/api";
import { couponShareLink } from "@/lib/coupon-link";
import { usePublicPlatformSettings } from "@/lib/platform-settings";

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
  const { flags } = usePublicPlatformSettings();
  const packCapPct = Number(flags.CREDIT_PACK_MAX_COUPON_DISCOUNT_PCT ?? 15);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;
    fetch(`${BASE}/influencer/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((j) => setData((j.data ?? j) as PortalMe))
      .catch(() => null);
  }, []);

  function handleCopy(key: string, text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(key);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  return (
    <div className="rounded-3xl border border-violet-100 bg-white p-6 shadow-sm">
      <h2 className="font-[family-name:var(--font-display)] text-3xl text-gray-900 mb-2">My Coupon Codes</h2>
      <p className="text-gray-500 mb-6">Share your link in posts, stories and bios — parents who open it get your discount automatically at checkout.</p>
      <div className="space-y-4">
        {(data?.couponCodes ?? []).map((coupon) => {
          const usable = coupon.isActive && !(coupon.expiresAt && new Date(coupon.expiresAt) < new Date());
          const link = couponShareLink(coupon.code);
          return (
            <div key={coupon.id} className="rounded-2xl border border-gray-100 p-4 flex items-center justify-between gap-4">
              <div>
                <p className="font-mono font-bold text-xl text-violet-700">{coupon.code}</p>
                <p className="text-sm text-gray-500 mt-1">
                  {coupon.discountType === "percentage" ? `${coupon.discountValue}% off` : `₹${coupon.discountValue} off`}
                  {coupon.discountType === "percentage" && coupon.discountValue > packCapPct ? ` (${packCapPct}% on story credit packs)` : ""}
                  {" · "}Used {coupon.usageCount} times
                  {coupon.expiresAt ? ` · Expires ${new Date(coupon.expiresAt).toLocaleDateString()}` : ""}
                </p>
                {usable ? (
                  <>
                    <p className="text-sm text-gray-700 mt-2">
                      &ldquo;Use my code <span className="font-semibold">{coupon.code}</span> to create a magical HeroKids Universe storybook.&rdquo;
                    </p>
                    <p className="text-xs text-gray-400 mt-1 break-all">{link}</p>
                  </>
                ) : (
                  <p className="text-xs font-semibold text-gray-400 mt-2">{coupon.isActive ? "Expired" : "Inactive"} — not working any more</p>
                )}
              </div>
              {usable && (
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => handleCopy(`${coupon.id}:link`, link)}
                    className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-all duration-200 min-w-[160px] justify-center ${
                      copiedId === `${coupon.id}:link` ? "bg-emerald-500 text-white" : "bg-violet-600 hover:bg-violet-700 text-white"
                    }`}
                  >
                    {copiedId === `${coupon.id}:link` ? <><Check className="w-4 h-4" /> Link copied!</> : <><Link2 className="w-4 h-4" /> Copy my link</>}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopy(`${coupon.id}:code`, coupon.code)}
                    className={`flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-all duration-200 min-w-[160px] justify-center border ${
                      copiedId === `${coupon.id}:code` ? "border-emerald-500 text-emerald-600" : "border-violet-200 text-violet-700 hover:bg-violet-50"
                    }`}
                  >
                    {copiedId === `${coupon.id}:code` ? <><Check className="w-4 h-4" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy code</>}
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {(data?.couponCodes ?? []).length === 0 && <p className="text-sm text-gray-400">No coupon codes yet.</p>}
      </div>
    </div>
  );
}
