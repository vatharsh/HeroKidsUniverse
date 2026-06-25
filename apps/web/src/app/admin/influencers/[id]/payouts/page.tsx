"use client";

import {
  ArrowLeft, Check, ExternalLink, FileText, Image, Loader2, Plus, Upload, Wallet, X,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { getAccessToken } from "@/lib/api";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Commission {
  id: string;
  orderNumber: string;
  orderTotal: number;
  discountAmount: number;
  commissionRate: number;
  commissionAmount: number;
  status: string;
  earnedAt: string | null;
  createdAt: string;
}

interface Payout {
  id: string;
  payoutNumber: string;
  amount: number;
  currency: string;
  status: string;
  paymentMethod: string | null;
  paymentReference: string | null;
  paymentProofUrl: string | null;
  paymentProofFileType: string | null;
  adminNote: string | null;
  paidAt: string | null;
  createdAt: string;
}

interface WalletData {
  approvedAmount: number;
  paidAmountLifetime: number;
  lastPayoutAt: string | null;
}

interface InfluencerBasic {
  id: string;
  name: string;
  email: string | null;
  paymentMethod: string | null;
}

const PAYOUT_STATUS_STYLE: Record<string, string> = {
  draft:     "bg-amber-50 text-amber-700",
  paid:      "bg-emerald-50 text-emerald-700",
  cancelled: "bg-gray-100 text-gray-500",
};

export default function InfluencerPayoutsPage() {
  const params = useParams();
  const id = params.id as string;

  const [influencer, setInfluencer] = useState<InfluencerBasic | null>(null);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [unpaidCommissions, setUnpaidCommissions] = useState<Commission[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);

  const [settling, setSettling] = useState(false);
  const [form, setForm] = useState({
    amount: "",
    paymentMethod: "upi",
    paymentReference: "",
    adminNote: "",
  });
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofUploading, setProofUploading] = useState(false);
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [proofFileType, setProofFileType] = useState<string | null>(null);
  const [settleError, setSettleError] = useState("");
  const [settleSuccess, setSettleSuccess] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);

    Promise.all([
      fetch(`${BASE}/admin/influencers/${id}`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(`${BASE}/admin/influencers/${id}/wallet`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(`${BASE}/admin/influencers/${id}/commissions?page=1&limit=100`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(`${BASE}/admin/influencers/${id}/payouts`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    ]).then(([infRes, walletRes, commRes, payoutRes]) => {
      const inf = infRes.data ?? infRes;
      setInfluencer(inf as InfluencerBasic);
      setWallet(walletRes.data ?? walletRes);
      const comms = ((commRes.data ?? commRes).items ?? []) as Commission[];
      setUnpaidCommissions(comms.filter(c => c.status === "approved"));
      setPayouts((payoutRes.data ?? payoutRes) as Payout[]);
      setForm(f => ({ ...f, paymentMethod: (inf as InfluencerBasic).paymentMethod ?? "upi" }));
    }).catch(() => null).finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function uploadProof(file: File) {
    const token = getAccessToken();
    if (!token) return;
    setProofUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${BASE}/admin/influencers/${id}/payouts/upload-proof`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!res.ok) throw new Error("Upload failed");
      const j = await res.json() as { data?: { url: string; fileType: string } };
      const result = j.data ?? (j as unknown as { url: string; fileType: string });
      setProofUrl(result.url);
      setProofFileType(result.fileType);
    } catch {
      setSettleError("Failed to upload proof file");
    } finally {
      setProofUploading(false);
    }
  }

  async function handleSettle() {
    const token = getAccessToken();
    if (!token || !form.amount) return;
    setSettling(true);
    setSettleError("");
    try {
      const res = await fetch(`${BASE}/admin/influencers/${id}/payouts`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(form.amount),
          paymentMethod: form.paymentMethod,
          paymentReference: form.paymentReference || undefined,
          adminNote: form.adminNote || undefined,
          paymentProofUrl: proofUrl ?? undefined,
          paymentProofFileType: proofFileType ?? undefined,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(j.message ?? "Failed to settle");
      }
      setSettleSuccess(true);
      setProofFile(null);
      setProofUrl(null);
      setProofFileType(null);
      setForm({ amount: "", paymentMethod: "upi", paymentReference: "", adminNote: "" });
      load();
      setTimeout(() => setSettleSuccess(false), 3000);
    } catch (err) {
      setSettleError(err instanceof Error ? err.message : "Failed to settle payout");
    } finally {
      setSettling(false);
    }
  }

  const totalUnpaid = unpaidCommissions.reduce((s, c) => s + Number(c.commissionAmount), 0);

  if (loading) return (
    <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 text-violet-500 animate-spin" /></div>
  );

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6">
        <Link href="/admin/influencers" className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition">
          <ArrowLeft className="w-3.5 h-3.5" /> Influencers
        </Link>
        <span className="text-gray-300 text-xs">/</span>
        <Link href={`/admin/influencers/${id}`} className="text-xs text-gray-500 hover:text-gray-800 transition">{influencer?.name}</Link>
        <span className="text-gray-300 text-xs">/</span>
        <span className="text-xs font-semibold text-gray-800">Payouts</span>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left: settle form + unpaid commissions */}
        <div className="col-span-2 space-y-6">

          {/* Wallet summary */}
          <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Wallet className="w-4 h-4 text-amber-600" />
              <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Wallet — {influencer?.name}</p>
            </div>
            <div className="grid grid-cols-3 gap-4 text-xs">
              <div>
                <p className="text-amber-600 mb-0.5">Unpaid (Approved)</p>
                <p className="text-2xl font-black text-amber-800">₹{Number(wallet?.approvedAmount ?? 0).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-amber-600 mb-0.5">Paid Lifetime</p>
                <p className="text-2xl font-black text-emerald-700">₹{Number(wallet?.paidAmountLifetime ?? 0).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-amber-600 mb-0.5">Last Payout</p>
                <p className="text-sm font-semibold text-gray-700">{wallet?.lastPayoutAt ? new Date(wallet.lastPayoutAt).toLocaleDateString() : "—"}</p>
              </div>
            </div>
          </div>

          {/* Unpaid commissions */}
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Unpaid Approved Commissions</p>
              <span className="text-xs font-black text-amber-700">Total: ₹{totalUnpaid.toLocaleString()}</span>
            </div>
            {unpaidCommissions.length === 0 ? (
              <p className="text-gray-400 text-xs px-5 py-4">No unpaid commissions. All settled!</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-50 bg-gray-50">
                    {["Order #", "Order Total", "Discount", "Rate", "Commission", "Date"].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 text-gray-400 font-semibold text-[10px] uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {unpaidCommissions.map(c => (
                    <tr key={c.id} className="border-b border-gray-50 last:border-0">
                      <td className="px-4 py-2.5 font-mono font-bold text-gray-800">{c.orderNumber}</td>
                      <td className="px-4 py-2.5">₹{Number(c.orderTotal).toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-red-400">−₹{Number(c.discountAmount).toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-gray-600">{c.commissionRate}%</td>
                      <td className="px-4 py-2.5 font-bold text-emerald-600">₹{Number(c.commissionAmount).toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-gray-400 whitespace-nowrap">{new Date(c.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-200 bg-amber-50">
                    <td colSpan={4} className="px-4 py-2.5 text-xs font-bold text-amber-700">Total Payable</td>
                    <td className="px-4 py-2.5 text-sm font-black text-amber-800">₹{totalUnpaid.toLocaleString()}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            )}
          </div>

          {/* Settle payout form */}
          {unpaidCommissions.length > 0 && (
            <div className="rounded-xl border border-violet-100 bg-white overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-violet-50 bg-violet-50/50">
                <p className="text-xs font-bold uppercase tracking-widest text-violet-700">Settle Payout</p>
                <p className="text-[11px] text-gray-500 mt-0.5">Pay the full approved balance. Upload payment proof.</p>
              </div>
              <div className="px-5 py-5 space-y-4">
                {settleError && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{settleError}</p>}
                {settleSuccess && (
                  <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">
                    <Check className="w-3.5 h-3.5" /> Payout settled successfully!
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Amount (₹) *</label>
                    <input
                      type="number"
                      value={form.amount}
                      onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                      placeholder={String(totalUnpaid)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:border-violet-400"
                    />
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, amount: String(totalUnpaid) }))}
                      className="text-[10px] text-violet-600 hover:underline mt-1"
                    >
                      Use full balance ₹{totalUnpaid.toLocaleString()}
                    </button>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Payment Method</label>
                    <select
                      value={form.paymentMethod}
                      onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value }))}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-400"
                    >
                      <option value="upi">UPI</option>
                      <option value="bank_transfer">Bank Transfer</option>
                      <option value="paypal">PayPal</option>
                      <option value="manual">Manual/Cash</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500 block mb-1">Payment Reference / UTR</label>
                    <input
                      value={form.paymentReference}
                      onChange={e => setForm(f => ({ ...f, paymentReference: e.target.value }))}
                      placeholder="UTR number, transaction ID…"
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-400"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500 block mb-1">Admin Note</label>
                    <textarea
                      value={form.adminNote}
                      onChange={e => setForm(f => ({ ...f, adminNote: e.target.value }))}
                      rows={2}
                      placeholder="Internal note…"
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-violet-400"
                    />
                  </div>
                </div>

                {/* Proof upload */}
                <div>
                  <label className="text-xs text-gray-500 block mb-2">Payment Proof (PDF / Image)</label>
                  <input
                    type="file"
                    ref={fileRef}
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    onChange={e => {
                      const f = e.target.files?.[0];
                      if (f) { setProofFile(f); void uploadProof(f); }
                    }}
                    className="hidden"
                  />
                  {proofFile ? (
                    <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
                      {proofFileType === "pdf" ? <FileText className="w-4 h-4 text-red-500" /> : <Image className="w-4 h-4 text-blue-500" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-800 truncate">{proofFile.name}</p>
                        {proofUploading && <p className="text-[11px] text-gray-400">Uploading…</p>}
                        {proofUrl && !proofUploading && <p className="text-[11px] text-emerald-600">Uploaded ✓</p>}
                      </div>
                      {proofUploading && <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-500" />}
                      <button onClick={() => { setProofFile(null); setProofUrl(null); setProofFileType(null); }} className="text-gray-300 hover:text-red-500 transition">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="flex items-center gap-2 rounded-lg border-2 border-dashed border-gray-200 hover:border-violet-300 px-4 py-3 text-xs text-gray-400 hover:text-violet-600 transition w-full"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Click to upload PDF, PNG, JPG, or WEBP (max 10MB)
                    </button>
                  )}
                </div>

                <button
                  onClick={() => void handleSettle()}
                  disabled={settling || !form.amount || proofUploading}
                  className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold py-3 rounded-xl transition disabled:opacity-50"
                >
                  {settling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Settle Payout of ₹{Number(form.amount || 0).toLocaleString()}
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Right: payout history */}
        <div>
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm sticky top-4">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Payout History</p>
            </div>
            {payouts.length === 0 ? (
              <p className="text-xs text-gray-400 px-4 py-4">No payouts yet.</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {payouts.map(p => (
                  <div key={p.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="font-mono text-[11px] font-bold text-gray-700">{p.payoutNumber}</span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${PAYOUT_STATUS_STYLE[p.status] ?? "bg-gray-100 text-gray-500"}`}>
                        {p.status}
                      </span>
                    </div>
                    <p className="text-sm font-black text-emerald-600">₹{Number(p.amount).toLocaleString()}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {p.paymentMethod?.toUpperCase() ?? "—"}
                      {p.paymentReference && ` · ${p.paymentReference}`}
                    </p>
                    {p.paidAt && (
                      <p className="text-[11px] text-gray-400">{new Date(p.paidAt).toLocaleDateString()}</p>
                    )}
                    {p.adminNote && (
                      <p className="text-[11px] text-gray-500 mt-1 italic">{p.adminNote}</p>
                    )}
                    {p.paymentProofUrl && (
                      <a
                        href={p.paymentProofUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 mt-1.5 text-[11px] text-violet-600 hover:underline"
                      >
                        {p.paymentProofFileType === "pdf" ? <FileText className="w-3 h-3" /> : <Image className="w-3 h-3" />}
                        View Proof <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
