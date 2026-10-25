"use client";

import { CreditCard, Loader2, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

import BuyCreditsSection from "@/components/shared/BuyCreditsSection";
import { creditsApi, type CreditTransaction, type CreditTransactionsPage } from "@/lib/account";
import { cn, formatInr } from "@/lib/utils";

const REASON_META: Record<string, { label: string; icon: string }> = {
  purchase:            { label: "Purchase",              icon: "🛒" },
  story_generation:    { label: "Story made",            icon: "📖" },
  character_slot_used: { label: "Character added",       icon: "👤" },
  avatar_refresh_used: { label: "Avatar Refresh used",   icon: "🔄" },
  refund:              { label: "Refund",                icon: "↩️" },
  referral_bonus:      { label: "Referral bonus",        icon: "🎁" },
  demo:                { label: "Demo credit",           icon: "🎯" },
  signup:              { label: "Welcome gift",          icon: "🌟" },
};

const plural = (n: number, one: string, many: string) => `${n} ${Math.abs(n) === 1 ? one : many}`;
const signed = (n: number, one: string, many: string) => `${n > 0 ? "+" : "−"}${plural(Math.abs(n), one, many)}`;

/** What a history row actually changed — credits, Avatar Refreshes, character slots, or a free story. */
function describe(tx: CreditTransaction): { label: string; amount: string; positive: boolean } {
  const meta = REASON_META[tx.reason]?.label ?? tx.reason.replace(/_/g, " ");
  const refreshes = tx.avatarRefreshTokensDelta ?? 0;
  const slots = tx.characterSlotsDelta ?? 0;
  const parts: string[] = [];
  if (tx.delta) parts.push(signed(tx.delta, "credit", "credits"));
  if (refreshes) parts.push(signed(refreshes, "refresh", "refreshes"));
  if (slots) parts.push(signed(slots, "slot", "slots"));
  const positive = tx.delta > 0 || refreshes > 0 || slots > 0;

  if (tx.reason === "story_generation" && tx.delta === 0) return { label: "Free story made", amount: "Free", positive: true };
  if (tx.reason === "signup" && !parts.length) return { label: "Welcome gift", amount: "1 free story", positive: true };
  if (tx.reason === "refund") {
    if (refreshes > 0) return { label: "Avatar Refresh returned", amount: parts.join(" · "), positive: true };
    if (tx.delta > 0) return { label: "Story credit returned", amount: parts.join(" · "), positive: true };
    return { label: "Free story returned", amount: "Free story back", positive: true };
  }
  return { label: meta, amount: parts.join(" · ") || "—", positive };
}

export default function CreditsPage() {
  const [summary, setSummary] = useState<{ balance: number; previewCredits: number; avatarRefreshTokens: number } | null>(null);
  const [txData, setTxData] = useState<CreditTransactionsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [txLoading, setTxLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");

  function loadSummary() {
    return creditsApi.getBalance()
      .then(r => setSummary({ balance: r.balance, previewCredits: r.previewCredits ?? 0, avatarRefreshTokens: r.avatarRefreshTokens }))
      .catch(() => setError("Failed to load credits"));
  }

  useEffect(() => {
    void loadSummary().finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setTxLoading(true);
    creditsApi.getTransactions(page, 20)
      .then(setTxData)
      .catch(() => setError("Failed to load transactions"))
      .finally(() => setTxLoading(false));
  }, [page]);

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-brand" /></div>;

  const stats = [
    { label: "Story credits", value: summary?.balance ?? 0, hint: "1 credit = 1 full story" },
    { label: "Free story", value: summary?.previewCredits ? `${summary.previewCredits} left` : "Used", hint: "Short preview story" },
    { label: "Avatar Refreshes", value: summary?.avatarRefreshTokens ?? 0, hint: "For a new avatar look" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-ink text-2xl mb-1">Credits</h2>
        <p className="text-ink-muted text-sm">What you have left, top-ups, and everything you&apos;ve used.</p>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl px-4 py-3 text-sm">{error}</div>}

      {/* Balance card */}
      <div className="bg-gradient-to-br from-brand to-purple-700 rounded-3xl p-6 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="grid grid-cols-3 gap-3 flex-1">
            {stats.map((s, i) => (
              <div key={s.label} className={cn("rounded-2xl px-3 py-3", i === 0 ? "bg-white/15" : "bg-white/5")}>
                <p className="text-white/70 text-[11px] font-bold uppercase tracking-wider">{s.label}</p>
                <p className="font-[family-name:var(--font-display)] text-3xl mt-1 flex items-center gap-1.5">
                  {i === 0 && <Sparkles className="w-5 h-5 text-gold" />}{s.value}
                </p>
                <p className="text-white/60 text-[11px] mt-0.5">{s.hint}</p>
              </div>
            ))}
          </div>
          <a href="#buy"
            className="flex items-center justify-center gap-2 bg-white text-brand font-bold px-6 py-3 rounded-full text-sm hover:bg-white/90 transition shrink-0">
            <CreditCard className="w-4 h-4" /> Buy Credits
          </a>
        </div>
      </div>

      {/* Buy right here — no second page to find */}
      <div id="buy" className="bg-white rounded-3xl border border-ink/10 shadow-card p-6 scroll-mt-24">
        <BuyCreditsSection onPurchased={() => { void loadSummary(); setPage(1); }} />
      </div>

      {/* Transaction history */}
      <div>
        <h3 className="font-[family-name:var(--font-display)] text-ink text-xl mb-4">History</h3>
        {txLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-brand" /></div>
        ) : (txData?.items.length ?? 0) === 0 ? (
          <div className="bg-white rounded-3xl border-2 border-dashed border-ink/10 py-12 text-center">
            <p className="text-ink-muted text-sm">Nothing here yet.</p>
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
  const icon = REASON_META[tx.reason]?.icon ?? "💳";
  const { label, amount, positive } = describe(tx);
  return (
    <div className={cn("flex items-center gap-4 px-5 py-4", !last && "border-b border-ink/5")}>
      <div className="w-9 h-9 rounded-full bg-ink/5 flex items-center justify-center text-xl shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-ink">{label}</p>
        {tx.packName && <p className="text-xs text-ink-muted">{tx.packName}</p>}
        <p className="text-xs text-ink-muted mt-0.5">
          {new Date(tx.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
      {tx.pricePaid ? <p className="text-xs text-ink-muted shrink-0">{formatInr(Number(tx.pricePaid))}</p> : null}
      <p className={cn("text-sm font-black shrink-0 text-right", positive ? "text-emerald-600" : "text-red-500")}>{amount}</p>
    </div>
  );
}
