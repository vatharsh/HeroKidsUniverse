"use client";

import { Check, CreditCard, Loader2, RefreshCw, Smartphone, Sparkles, Users, Wallet, X, Zap } from "lucide-react";
import { useEffect, useState } from "react";

import { getAccessToken } from "@/lib/api";
import { fetchActivePacks, type CreditPack } from "@/lib/credits";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open(): void };
  }
}

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

type PaymentMethod = "upi" | "card" | "cash";

const PAYMENT_METHODS: { id: PaymentMethod; label: string; icon: React.ElementType; sub: string }[] = [
  { id: "upi",  label: "UPI",         icon: Smartphone, sub: "Google Pay, PhonePe, Paytm" },
  { id: "card", label: "Card",        icon: CreditCard, sub: "Credit / Debit card"        },
  { id: "cash", label: "Cash / COD",  icon: Wallet,     sub: "Pay at counter"             },
];

interface MockPaymentModalProps {
  pack: CreditPack;
  onClose: () => void;
  onSuccess: (newBalance: number) => void;
}

function MockPaymentModal({ pack, onClose, onSuccess }: MockPaymentModalProps) {
  const [method, setMethod] = useState<PaymentMethod>("upi");
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);
  const [error, setError] = useState("");

  const effectivePrice = pack.effectivePrice ?? pack.basePrice;
  const resource = getPackResource(pack);

  async function pay() {
    setPaying(true);
    setError("");
    try {
      const token = getAccessToken();
      if (!token) { window.location.href = "/login"; return; }

      const res = await fetch(`${BASE}/credits/packs/${pack.id}/purchase/mock`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ paymentMethod: method }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(err.message ?? "Payment failed");
      }
      const body = await res.json() as { data?: { newBalance: number }; newBalance?: number };
      const newBalance = body.data?.newBalance ?? (body as unknown as { newBalance: number }).newBalance ?? 0;
      setPaid(true);
      setTimeout(() => {
        onSuccess(newBalance);
        onClose();
        window.location.reload();
      }, 1400);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setPaying(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-[380px] bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="font-bold text-gray-900">{pack.name}</p>
            <p className="text-xs text-gray-500">{resource.label}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              {pack.isOnSale && (
                <p className="text-[10px] text-gray-400 line-through">₹{Number(pack.basePrice).toLocaleString()}</p>
              )}
              <p className="font-black text-gray-900 text-lg">₹{Number(effectivePrice).toLocaleString()}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {paid ? (
          <div className="flex flex-col items-center gap-3 py-10 px-5">
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
              <Check className="w-6 h-6 text-emerald-600" />
            </div>
            <p className="font-bold text-gray-900">Payment Successful!</p>
            <p className="text-sm text-gray-500 text-center">
              {resource.label} added to your account
            </p>
          </div>
        ) : (
          <div className="p-5 flex flex-col gap-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Select Payment Method</p>

            <div className="flex flex-col gap-2">
              {PAYMENT_METHODS.map(({ id, label, icon: Icon, sub }) => (
                <button
                  key={id}
                  onClick={() => setMethod(id)}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left",
                    method === id
                      ? "border-brand bg-brand-50"
                      : "border-gray-100 hover:border-gray-200 bg-white",
                  )}
                >
                  <div className={cn(
                    "w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0",
                    method === id ? "bg-brand text-white" : "bg-gray-100 text-gray-500",
                  )}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className={cn("font-semibold text-sm", method === id ? "text-brand" : "text-gray-800")}>{label}</p>
                    <p className="text-[11px] text-gray-400">{sub}</p>
                  </div>
                  {method === id && (
                    <div className="ml-auto w-4 h-4 rounded-full bg-brand flex items-center justify-center flex-shrink-0">
                      <Check className="w-2.5 h-2.5 text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>

            {error && <p className="text-red-500 text-xs text-center">{error}</p>}

            <button
              onClick={() => void pay()}
              disabled={paying}
              className="w-full py-3 rounded-full bg-brand hover:bg-brand-dark text-white font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {paying ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Pay ₹{Number(effectivePrice).toLocaleString()}</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
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
  onBuy: (p: CreditPack) => void;
}

function PackGroup({ icon: Icon, title, description, packs, onBuy }: PackGroupProps) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-5 h-5 text-brand" />
        <h3 className="font-[family-name:var(--font-display)] text-ink text-xl">{title}</h3>
      </div>
      <p className="text-ink-muted text-sm mb-4">{description}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {packs.map(pack => <PackCard key={pack.id} pack={pack} onBuy={onBuy} />)}
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
  const [buyingPack, setBuyingPack] = useState<CreditPack | null>(null);

  useEffect(() => {
    fetchActivePacks()
      .then(data => setPacks(data))
      .catch(() => {/* leave empty */})
      .finally(() => setLoading(false));
  }, []);

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

  return (
    <>
      <div className="mt-2 space-y-10">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-brand" />
          <h2 className="font-[family-name:var(--font-display)] text-ink text-2xl">Top Up Your Account</h2>
        </div>

        {storyPacks.length > 0 && (
          <PackGroup
            icon={Zap}
            title="Story Credits"
            description="Each credit generates one full story episode — illustrated, narrated, and downloadable as a PDF."
            packs={storyPacks}
            onBuy={setBuyingPack}
          />
        )}

        {slotPacks.length > 0 && (
          <PackGroup
            icon={Users}
            title="Character Slots"
            description="Each slot lets you add one more family member or character to your cast — a sibling, parent, pet, or sidekick who can appear in future stories."
            packs={slotPacks}
            onBuy={setBuyingPack}
          />
        )}

        {refreshPacks.length > 0 && (
          <PackGroup
            icon={RefreshCw}
            title="Avatar Refreshes"
            description="Not happy with your child's cartoon portrait? Each refresh regenerates the AI avatar from the same photo — try a different style or a better likeness."
            packs={refreshPacks}
            onBuy={setBuyingPack}
          />
        )}

        {storyPacks.length === 0 && slotPacks.length === 0 && refreshPacks.length === 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {packs.map(pack => <PackCard key={pack.id} pack={pack} onBuy={setBuyingPack} />)}
          </div>
        )}
      </div>

      {buyingPack && (
        <MockPaymentModal
          pack={buyingPack}
          onClose={() => setBuyingPack(null)}
          onSuccess={(newBalance) => {
            setBuyingPack(null);
            onPurchased?.(newBalance);
          }}
        />
      )}
    </>
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
