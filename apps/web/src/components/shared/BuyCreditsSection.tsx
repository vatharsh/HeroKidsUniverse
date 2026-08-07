"use client";

import { Loader2, RefreshCw, Sparkles, Users, Zap } from "lucide-react";
import { useEffect, useState } from "react";

import { getAccessToken } from "@/lib/api";
import { fetchActivePacks, type CreditPack } from "@/lib/credits";
import { cn } from "@/lib/utils";

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

// ── Pack card ─────────────────────────────────────────────────────────────────

function PackCard({ pack, onBuy }: { pack: CreditPack; onBuy: (p: CreditPack) => void }) {
  const isOnSale = pack.isOnSale && pack.salePrice != null;
  const effectivePrice = pack.effectivePrice ?? pack.basePrice;
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
          {isOnSale && pack.savingsAmount > 0 && (
            <p className="text-emerald-600 text-xs font-bold">Save ₹{pack.savingsAmount.toLocaleString()}</p>
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

      {pack.promotionName && (
        <p className="text-amber-600 text-xs font-bold">🔥 {pack.promotionName}</p>
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
  onBuy: (p: CreditPack) => void;
}

function BuyablePackCard({ pack, isLoading, onBuy }: { pack: CreditPack; isLoading: boolean; onBuy: (p: CreditPack) => void }) {
  return (
    <div className="relative">
      <PackCard pack={pack} onBuy={onBuy} />
      {isLoading && (
        <div className="absolute inset-0 rounded-2xl bg-white/70 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-brand animate-spin" />
        </div>
      )}
    </div>
  );
}

function PackGroup({ icon: Icon, title, description, packs, payingPackId, onBuy }: PackGroupProps) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-5 h-5 text-brand" />
        <h3 className="font-[family-name:var(--font-display)] text-ink text-xl">{title}</h3>
      </div>
      <p className="text-ink-muted text-sm mb-4">{description}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {packs.map(pack => (
          <BuyablePackCard key={pack.id} pack={pack} isLoading={payingPackId === pack.id} onBuy={onBuy} />
        ))}
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

interface BuyCreditsSectionProps {
  onPurchased?: (newBalance: number) => void;
}

export default function BuyCreditsSection({ onPurchased }: BuyCreditsSectionProps) {
  const [packs, setPacks] = useState<CreditPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [payingPackId, setPayingPackId] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);

  useEffect(() => {
    fetchActivePacks()
      .then(data => setPacks(data))
      .catch(() => {/* leave empty */})
      .finally(() => setLoading(false));
  }, []);

  async function onBuy(pack: CreditPack) {
    setPayError(null);
    setPayingPackId(pack.id);
    try {
      const token = getAccessToken();
      if (!token) { window.location.href = "/login"; return; }

      // 1. Create Razorpay order on backend
      const initRes = await fetch(`${BASE}/credits/packs/${pack.id}/purchase/initiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
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

  return (
    <div className="mt-2 space-y-10">
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-brand" />
        <h2 className="font-[family-name:var(--font-display)] text-ink text-2xl">Top Up Your Account</h2>
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
          onBuy={handleBuy}
        />
      )}

      {storyPacks.length === 0 && slotPacks.length === 0 && refreshPacks.length === 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {packs.map(pack => (
            <BuyablePackCard key={pack.id} pack={pack} isLoading={payingPackId === pack.id} onBuy={handleBuy} />
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
