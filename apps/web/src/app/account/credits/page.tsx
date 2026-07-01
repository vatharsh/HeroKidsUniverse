"use client";

import { CreditCard, Loader2, ShoppingBag, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { creditsApi, type CreditTransaction, type CreditTransactionsPage } from "@/lib/account";
import { cn } from "@/lib/utils";

const REASON_META: Record<string, { label: string; icon: string; color: string }> = {
  purchase:           { label: "Credit Purchase",   icon: "🛒", color: "text-emerald-600" },
  story_generation:   { label: "Story Generated",   icon: "📖", color: "text-brand" },
  character_slot_used:{ label: "Character Slot",    icon: "👤", color: "text-orange-500" },
  avatar_refresh_used:{ label: "Avatar Refresh",    icon: "🔄", color: "text-sky-500" },
  refund:             { label: "Refund",             icon: "↩️", color: "text-emerald-600" },
  referral_bonus:     { label: "Referral Bonus",    icon: "🎁", color: "text-gold" },
  demo:               { label: "Demo Credit",       icon: "🎯", color: "text-purple-500" },
  signup:             { label: "Welcome Bonus",     icon: "🌟", color: "text-gold" },
};

export default function CreditsPage() {
  const [balance, setBalance] = useState<number | null>(null);
  const [txData, setTxData] = useState<CreditTransactionsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [txLoading, setTxLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");

  useEffect(() => {
    creditsApi.getBalance()
      .then(r => setBalance(r.balance))
      .catch(() => setError("Failed to load credits"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setTxLoading(true);
    creditsApi.getTransactions(page, 20)
      .then(setTxData)
      .catch(() => setError("Failed to load transactions"))
      .finally(() => setTxLoading(false));
  }, [page]);

  const lifetimePurchased = txData?.items.filter(t => t.delta > 0).reduce((s, t) => s + t.delta, 0) ?? 0;
  const lifetimeUsed = txData?.items.filter(t => t.delta < 0).reduce((s, t) => s + Math.abs(t.delta), 0) ?? 0;

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-brand" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-ink text-2xl mb-1">Credits & Wallet</h2>
        <p className="text-ink-muted text-sm">Track your credit balance and transaction history.</p>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl px-4 py-3 text-sm">{error}</div>}

      {/* Balance card */}
      <div className="bg-gradient-to-br from-brand to-purple-700 rounded-3xl p-6 text-white flex flex-col sm:flex-row gap-6 items-start sm:items-center">
        <div>
          <p className="text-white/70 text-xs font-bold uppercase tracking-widest mb-1">Current Balance</p>
          <div className="flex items-end gap-2">
            <Sparkles className="w-7 h-7 text-gold" />
            <span className="font-[family-name:var(--font-display)] text-5xl font-black">{balance ?? 0}</span>
            <span className="text-white/60 text-sm mb-1">credits</span>
          </div>
        </div>
        <div className="flex gap-4 sm:ml-auto">
          <div className="text-center">
            <div className="flex items-center gap-1 text-white/70 text-xs mb-0.5"><TrendingUp className="w-3 h-3" /> Purchased</div>
            <p className="text-xl font-black">{lifetimePurchased}</p>
          </div>
          <div className="text-center">
            <div className="flex items-center gap-1 text-white/70 text-xs mb-0.5"><TrendingDown className="w-3 h-3" /> Used</div>
            <p className="text-xl font-black">{lifetimeUsed}</p>
          </div>
        </div>
        <Link href="/account/credits#buy"
          className="flex items-center gap-2 bg-white text-brand font-bold px-6 py-3 rounded-full text-sm hover:bg-white/90 transition sm:ml-4 shrink-0">
          <CreditCard className="w-4 h-4" /> Buy Credits
        </Link>
      </div>

      {/* Buy credits section */}
      <div id="buy" className="bg-white rounded-3xl border border-ink/10 shadow-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <ShoppingBag className="w-5 h-5 text-brand" />
          <h3 className="font-[family-name:var(--font-display)] text-ink text-lg">Buy More Credits</h3>
        </div>
        <p className="text-ink-muted text-sm mb-4">Each story costs 1 credit. Buy packs to generate more personalised episodes.</p>
        <Link href="/dashboard"
          className="inline-flex items-center gap-2 bg-brand text-white text-sm font-bold px-6 py-3 rounded-full hover:bg-brand-dark transition">
          View Credit Packs →
        </Link>
      </div>

      {/* Transaction history */}
      <div>
        <h3 className="font-[family-name:var(--font-display)] text-ink text-xl mb-4">Transaction History</h3>
        {txLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-brand" /></div>
        ) : (txData?.items.length ?? 0) === 0 ? (
          <div className="bg-white rounded-3xl border-2 border-dashed border-ink/10 py-12 text-center">
            <p className="text-ink-muted text-sm">No transactions yet.</p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-3xl border border-ink/10 shadow-card overflow-hidden">
              {txData!.items.map((tx, i) => (
                <TxRow key={tx.id} tx={tx} last={i === txData!.items.length - 1} />
              ))}
            </div>
            {txData && txData.pages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-4">
                <button type="button" disabled={page === 1} onClick={() => setPage(p => p - 1)}
                  className="px-4 py-2 rounded-full border border-ink/15 text-sm font-semibold text-ink-mid hover:border-brand hover:text-brand transition disabled:opacity-40">
                  ← Prev
                </button>
                <span className="text-sm text-ink-muted">Page {page} of {txData.pages}</span>
                <button type="button" disabled={page === txData.pages} onClick={() => setPage(p => p + 1)}
                  className="px-4 py-2 rounded-full border border-ink/15 text-sm font-semibold text-ink-mid hover:border-brand hover:text-brand transition disabled:opacity-40">
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function TxRow({ tx, last }: { tx: CreditTransaction; last: boolean }) {
  const meta = REASON_META[tx.reason] ?? { label: tx.reason, icon: "💳", color: "text-ink" };
  const isCredit = tx.delta > 0;
  return (
    <div className={cn("flex items-center gap-4 px-5 py-4", !last && "border-b border-ink/5")}>
      <div className="w-9 h-9 rounded-full bg-ink/5 flex items-center justify-center text-xl shrink-0">{meta.icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-ink">{meta.label}</p>
        {tx.packName && <p className="text-xs text-ink-muted">{tx.packName}</p>}
        <p className="text-xs text-ink-muted mt-0.5">
          {new Date(tx.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
      {tx.pricePaid && (
        <p className="text-xs text-ink-muted shrink-0">₹{Number(tx.pricePaid).toLocaleString()}</p>
      )}
      <p className={cn("text-base font-black shrink-0", isCredit ? "text-emerald-600" : "text-red-500")}>
        {isCredit ? "+" : ""}{tx.delta}
      </p>
    </div>
  );
}
