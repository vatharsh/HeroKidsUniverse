"use client";

import { Loader2, RefreshCw, Sparkles, Tag, Users, X, Zap } from "lucide-react";
import { useEffect, useState } from "react";

import { getAccessToken } from "@/lib/api";
import { fetchActivePacks, promotionLabel, type CreditPack } from "@/lib/credits";
import { cn } from "@/lib/utils";
import { COUPON_STORAGE_KEY } from "@/lib/coupon-link";
import { useAuth } from "@/contexts/AuthContext";
import MaintenanceNotice from "@/components/shared/MaintenanceNotice";
import { useMaintenance, usePublicPlatformSettings } from "@/lib/platform-settings";
import { profileApi } from "@/lib/account";
import { INDIAN_STATES } from "@/lib/indian-states";

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => { open(): void };
  }
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => void;
  prefill?: { name?: string; email?: string; contact?: string };
  theme?: { color?: string };
  modal?: { ondismiss?: () => void };
}

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) { resolve(true); return; }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

// ── Coupons ───────────────────────────────────────────────────────────────────

interface PackQuote { subtotal: number; discount: number; total: number; cappedAtPct?: number; error?: string }
interface AppliedCoupon { code: string; quotes: Record<string, PackQuote> }


function rememberCoupon(code: string | null) {
  try {
    if (code) localStorage.setItem(COUPON_STORAGE_KEY, code);
    else localStorage.removeItem(COUPON_STORAGE_KEY);
  } catch { /* storage unavailable — the coupon still applies for this visit */ }
}

function recalledCoupon(): string | null {
  try {
    const fromLink = new URLSearchParams(window.location.search).get("coupon");
    return fromLink?.trim() || localStorage.getItem(COUPON_STORAGE_KEY);
  } catch {
    return null;
  }
}

// ── Pack card ─────────────────────────────────────────────────────────────────

function PackCard({ pack, quote, couponCode, onBuy }: { pack: CreditPack; quote?: PackQuote; couponCode?: string; onBuy: (p: CreditPack) => void }) {
  const hasCoupon = !!quote && quote.discount > 0;
  const isOnSale = (pack.isOnSale && pack.salePrice != null) || hasCoupon;
  const effectivePrice = hasCoupon ? quote.total : (pack.effectivePrice ?? pack.basePrice);
  const resource = getPackResource(pack);

  return (
    <div
      className={cn(
        "relative bg-white rounded-2xl border p-5 flex flex-col gap-3 shadow-card",
        pack.isMostPopular ? "border-brand ring-2 ring-brand/20" : "border-ink/10",
      )}
    >
      {pack.badge && (
        <span className="absolute -top-3 left-5 bg-brand text-white text-[10px] font-black px-3 py-1 rounded-full">
          {pack.badge}
        </span>
      )}

      <div>
        <p className="font-extrabold text-ink text-base">{pack.name}</p>
        {pack.description && (
          <p className="text-ink-muted text-xs mt-0.5">{pack.description}</p>
        )}
      </div>

      <div className="flex items-end justify-between gap-2">
        <div>
          {isOnSale && (
            <p className="text-ink-muted text-xs line-through">₹{Number(pack.basePrice).toLocaleString()}</p>
          )}
          <p className="text-ink font-black text-2xl">₹{Number(effectivePrice).toLocaleString()}</p>
          {hasCoupon ? (
            <>
              <p className="text-emerald-600 text-xs font-bold">{couponCode} saves you ₹{quote.discount.toLocaleString()}</p>
              {quote.cappedAtPct !== undefined && (
                <p className="text-ink-muted text-[11px]">Max {quote.cappedAtPct}% off on credit packs</p>
              )}
            </>
          ) : isOnSale && pack.savingsAmount > 0 && (
            <p className="text-emerald-600 text-xs font-bold">Save ₹{pack.savingsAmount.toLocaleString()}</p>
          )}
          {couponCode && !hasCoupon && quote?.error && (
            <p className="text-ink-muted text-[11px]">Coupon doesn&apos;t apply to this pack</p>
          )}
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1 justify-end">
            <span className="text-brand font-black text-lg">{resource.amount}</span>
            <span className="text-brand/60 text-sm font-semibold">{resource.short}</span>
          </div>
          {(pack.packType ?? "story_credits") === "story_credits" && pack.bonusCredits > 0 && (
            <p className="text-brand/60 text-xs font-bold">+{pack.bonusCredits} bonus</p>
          )}
        </div>
      </div>

      {promotionLabel(pack) && (
        <p className="text-amber-600 text-xs font-bold">🔥 {promotionLabel(pack)}</p>
      )}

      <button
        onClick={() => onBuy(pack)}
        className={cn(
          "w-full mt-auto py-2.5 rounded-full font-bold text-sm transition-all flex items-center justify-center gap-2",
          pack.isMostPopular
            ? "bg-brand hover:bg-brand-dark text-white shadow-brand hover:scale-[1.02]"
            : "bg-brand-50 hover:bg-brand text-brand hover:text-white border border-brand/20",
        )}
      >
        Buy {pack.name}
      </button>
    </div>
  );
}

// ── Section groups ─────────────────────────────────────────────────────────────

interface PackGroupProps {
  icon: React.ElementType;
  title: string;
  description: string;
  packs: CreditPack[];
  payingPackId: string | null;
  coupon: AppliedCoupon | null;
  onBuy: (p: CreditPack) => void;
}

function BuyablePackCard({ pack, isLoading, coupon, onBuy }: { pack: CreditPack; isLoading: boolean; coupon: AppliedCoupon | null; onBuy: (p: CreditPack) => void }) {
  return (
    <div className="relative">
      <PackCard pack={pack} quote={coupon?.quotes[pack.id]} couponCode={coupon?.code} onBuy={onBuy} />
      {isLoading && (
        <div className="absolute inset-0 rounded-2xl bg-white/70 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-brand animate-spin" />
        </div>
      )}
    </div>
  );
}

function PackGroup({ icon: Icon, title, description, packs, payingPackId, coupon, onBuy }: PackGroupProps) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-5 h-5 text-brand" />
        <h3 className="font-[family-name:var(--font-display)] text-ink text-xl">{title}</h3>
      </div>
      <p className="text-ink-muted text-sm mb-4">{description}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {packs.map(pack => (
          <BuyablePackCard key={pack.id} pack={pack} isLoading={payingPackId === pack.id} coupon={coupon} onBuy={onBuy} />
        ))}
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

interface BuyCreditsSectionProps {
  onPurchased?: (newBalance: number) => void;
  /** Tags the purchase for the admin dashboard, e.g. "quota_card". */
  source?: string;
}

export default function BuyCreditsSection({ onPurchased, source }: BuyCreditsSectionProps) {
  const maintenance = useMaintenance();
  const { user: viewer } = useAuth();
  const [packs, setPacks] = useState<CreditPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [payingPackId, setPayingPackId] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const [couponInput, setCouponInput] = useState("");
  // GST invoices need the parent's state (place of supply); asked once, remembered on the account.
  const { flags } = usePublicPlatformSettings();
  const gstOn = flags.GST_ENABLED === true;
  const [billingState, setBillingState] = useState("");
  useEffect(() => {
    if (!gstOn) return;
    profileApi.get().then((p) => { if (p.billingState) setBillingState(p.billingState); }).catch(() => {});
  }, [gstOn]);
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [applyingCoupon, setApplyingCoupon] = useState(false);

  useEffect(() => {
    fetchActivePacks()
      .then(data => setPacks(data))
      .catch(() => {/* leave empty */})
      .finally(() => setLoading(false));
    // A coupon from an influencer link (?coupon=CODE) or an earlier visit is applied automatically.
    const recalled = recalledCoupon();
    if (recalled && getAccessToken()) void applyCoupon(recalled, true);
  }, []);

  async function applyCoupon(raw: string, silent = false) {
    const code = raw.trim();
    if (!code) return;
    const token = getAccessToken();
    if (!token) { setCouponError("Log in to use a coupon code."); return; }
    setApplyingCoupon(true);
    setCouponError(null);
    try {
      const res = await fetch(`${BASE}/credits/packs/quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ couponCode: code }),
      });
      const body = await res.json().catch(() => ({})) as { data?: { valid: boolean; code: string; errorMessage?: string; quotes: Record<string, PackQuote> }; message?: string };
      const result = body.data;
      if (!res.ok || !result) throw new Error(body.message ?? "Could not check this coupon");
      if (!result.valid) throw new Error(result.errorMessage ?? "This coupon isn't valid");
      setCoupon({ code: result.code, quotes: result.quotes });
      setCouponInput(result.code);
      rememberCoupon(result.code);
    } catch (err) {
      setCoupon(null);
      rememberCoupon(null);
      if (!silent) setCouponError(err instanceof Error ? err.message : "This coupon isn't valid");
    } finally {
      setApplyingCoupon(false);
    }
  }

  function removeCoupon() {
    setCoupon(null);
    setCouponInput("");
    setCouponError(null);
    rememberCoupon(null);
  }

  async function onBuy(pack: CreditPack) {
    setPayError(null);
    setPayingPackId(pack.id);
    try {
      const token = getAccessToken();
      if (!token) { window.location.href = "/login"; return; }

      // 1. Create Razorpay order on backend
      const couponCode = coupon && (coupon.quotes[pack.id]?.discount ?? 0) > 0 ? coupon.code : undefined;
      const initRes = await fetch(`${BASE}/credits/packs/${pack.id}/purchase/initiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ couponCode, source, billingState: billingState || undefined }),
      });
      if (!initRes.ok) {
        const err = await initRes.json().catch(() => ({})) as { message?: string };
        throw new Error(err.message ?? "Could not create payment order");
      }
      const initBody = await initRes.json() as { data: { razorpayOrderId: string; amount: number; currency: string; keyId: string } };
      const { razorpayOrderId, amount, currency, keyId } = initBody.data;

      // 2. Load Razorpay SDK
      const loaded = await loadRazorpayScript();
      if (!loaded) throw new Error("Failed to load Razorpay SDK. Check your connection.");

      // 3. Open Razorpay checkout (shows UPI, cards, netbanking, wallets — all natively)
      const rzp = new window.Razorpay({
        key: keyId,
        amount: Math.round(amount * 100), // Razorpay expects paise
        currency,
        name: "HeroKids Universe",
        description: pack.name,
        order_id: razorpayOrderId,
        theme: { color: "#7C3AED" },
        handler: async (response) => {
          try {
            const verRes = await fetch(`${BASE}/credits/packs/${pack.id}/purchase/verify`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              }),
            });
            if (!verRes.ok) {
              const err = await verRes.json().catch(() => ({})) as { message?: string };
              throw new Error(err.message ?? "Payment verification failed");
            }
            const body = await verRes.json() as { data?: { newBalance: number } };
            const newBalance = body.data?.newBalance ?? 0;
            if (couponCode) removeCoupon();
            onPurchased?.(newBalance);
          } catch (err) {
            setPayError(err instanceof Error ? err.message : "Payment verification failed");
          } finally {
            setPayingPackId(null);
          }
        },
        modal: {
          ondismiss: () => setPayingPackId(null),
        },
      });
      rzp.open();
    } catch (err) {
      setPayError(err instanceof Error ? err.message : "Payment failed");
      setPayingPackId(null);
    }
  }

  if (maintenance && viewer?.role !== "admin") {
    return <MaintenanceNotice what="Buying credits">{null}</MaintenanceNotice>;
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-5 h-5 text-brand animate-spin" />
      </div>
    );
  }

  if (packs.length === 0) return null;

  const storyPacks   = packs.filter(p => (p.packType ?? "story_credits") === "story_credits");
  const slotPacks    = packs.filter(p => p.packType === "character_slots");
  const refreshPacks = packs.filter(p => p.packType === "avatar_refreshes");

  const handleBuy = (p: CreditPack) => void onBuy(p);
  const cappedPct = coupon ? Object.values(coupon.quotes).find(q => q.cappedAtPct !== undefined)?.cappedAtPct : undefined;

  return (
    <div className="mt-2 space-y-10">
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-brand" />
        <h2 className="font-[family-name:var(--font-display)] text-ink text-2xl">Top Up Your Account</h2>
      </div>
      <p className="-mt-6 text-xs text-ink-muted leading-relaxed">
        Credits are added instantly, never expire, and can&apos;t be refunded for cash. If a story goes wrong, we&apos;ll give the credit back.{" "}
        <a href="/refunds" className="underline hover:text-brand">Refund policy</a>
 Prices include GST.
      </p>

      {gstOn && (
        <label className="-mt-4 flex flex-wrap items-center gap-2 text-xs text-ink-mid">
          Your state <span className="text-ink-muted">(for your GST invoice)</span>
          <select value={billingState} onChange={(e) => setBillingState(e.target.value)}
            className="rounded-full border border-ink/15 bg-white px-3 py-1.5 text-xs text-ink focus:outline-none focus:border-brand">
            <option value="">Select state</option>
            {INDIAN_STATES.map((st) => <option key={st} value={st}>{st}</option>)}
          </select>
        </label>
      )}

      <div className="bg-white rounded-2xl border border-ink/10 p-4 shadow-card">
        {coupon ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-ink flex items-center gap-2">
              <Tag className="w-4 h-4 text-emerald-600" />
              <span>
                <span className="font-black">{coupon.code}</span> applied — discounted prices are shown below.
                {cappedPct !== undefined && (
                  <span className="block text-xs text-ink-muted mt-0.5">
                    Coupons can take at most {cappedPct}% off a credit pack, so your discount is {cappedPct}% here.
                  </span>
                )}
              </span>
            </p>
            <button onClick={removeCoupon} className="text-ink-muted hover:text-ink text-xs font-bold flex items-center gap-1">
              <X className="w-3.5 h-3.5" /> Remove
            </button>
          </div>
        ) : (
          <form
            onSubmit={e => { e.preventDefault(); void applyCoupon(couponInput); }}
            className="flex flex-col sm:flex-row sm:items-center gap-2"
          >
            <label htmlFor="coupon-code" className="text-sm font-bold text-ink flex items-center gap-2 shrink-0">
              <Tag className="w-4 h-4 text-brand" /> Have a coupon code?
            </label>
            <div className="flex gap-2 flex-1">
              <input
                id="coupon-code"
                value={couponInput}
                onChange={e => { setCouponInput(e.target.value.toUpperCase()); setCouponError(null); }}
                placeholder="Enter code"
                autoComplete="off"
                className="flex-1 min-w-0 rounded-full border border-ink/15 px-4 py-2 text-sm font-bold tracking-wide uppercase focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
              <button
                type="submit"
                disabled={applyingCoupon || !couponInput.trim()}
                className="px-5 py-2 rounded-full bg-brand text-white text-sm font-bold disabled:opacity-50 flex items-center gap-2"
              >
                {applyingCoupon && <Loader2 className="w-4 h-4 animate-spin" />} Apply
              </button>
            </div>
          </form>
        )}
        {couponError && <p className="text-red-500 text-xs mt-2">{couponError}</p>}
      </div>

      {payError && (
        <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-3">{payError}</p>
      )}

      {storyPacks.length > 0 && (
        <PackGroup
          icon={Zap}
          title="Story Credits"
          description="Each credit generates one full story episode — illustrated, narrated, and downloadable as a PDF."
          packs={storyPacks}
          payingPackId={payingPackId}
          coupon={coupon}
          onBuy={handleBuy}
        />
      )}

      {slotPacks.length > 0 && (
        <PackGroup
          icon={Users}
          title="Character Slots"
          description="Each slot lets you add one more family member or character to your cast — a sibling, parent, pet, or sidekick who can appear in future stories."
          packs={slotPacks}
          payingPackId={payingPackId}
          coupon={coupon}
          onBuy={handleBuy}
        />
      )}

      {refreshPacks.length > 0 && (
        <PackGroup
          icon={RefreshCw}
          title="Avatar Refreshes"
          description="Not happy with your child's cartoon portrait? Each refresh regenerates the AI avatar from the same photo — try a different style or a better likeness."
          packs={refreshPacks}
          payingPackId={payingPackId}
          coupon={coupon}
          onBuy={handleBuy}
        />
      )}

      {storyPacks.length === 0 && slotPacks.length === 0 && refreshPacks.length === 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {packs.map(pack => (
            <BuyablePackCard key={pack.id} pack={pack} isLoading={payingPackId === pack.id} coupon={coupon} onBuy={handleBuy} />
          ))}
        </div>
      )}
    </div>
  );
}

function getPackResource(pack: CreditPack) {
  const packType = pack.packType ?? "story_credits";
  if (packType === "character_slots") {
    const amount = pack.characterSlots ?? 0;
    return { amount, short: "slots", label: `${amount} Character Slot${amount !== 1 ? "s" : ""}` };
  }
  if (packType === "avatar_refreshes") {
    const amount = pack.avatarRefreshTokens ?? 0;
    return { amount, short: "refreshes", label: `${amount} Avatar Refresh${amount !== 1 ? "es" : ""}` };
  }
  const amount = pack.credits + pack.bonusCredits;
  return { amount, short: "cr", label: `${amount} Story Credit${amount !== 1 ? "s" : ""}` };
}
