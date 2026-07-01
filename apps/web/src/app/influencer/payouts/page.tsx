"use client";

import { Download } from "lucide-react";
import { useEffect, useState } from "react";

import { getAccessToken } from "@/lib/api";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

interface PayoutRow {
  id: string;
  payoutNumber: string;
  amount: number;
  paymentMethod: string | null;
  paymentReference: string | null;
  paidDate: string | null;
  status: string;
  paymentProofUrl: string | null;
}

interface PageData {
  items: PayoutRow[];
  page: number;
  totalPages: number;
}

function buildReceiptText(row: PayoutRow): string {
  const lines = [
    "══════════════════════════════════════",
    "        HeroKids Universe",
    "        Influencer Payout Receipt",
    "══════════════════════════════════════",
    `Payout #     : ${row.payoutNumber}`,
    `Amount       : ₹${row.amount.toLocaleString("en-IN")}`,
    `Status       : ${row.status.toUpperCase()}`,
    `Method       : ${row.paymentMethod ?? "—"}`,
    `Reference    : ${row.paymentReference ?? "—"}`,
    `Paid Date    : ${row.paidDate ? new Date(row.paidDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "—"}`,
    "──────────────────────────────────────",
    "Thank you for being a HeroKids partner!",
    "support@herokidsuniverse.com",
    "══════════════════════════════════════",
  ];
  return lines.join("\n");
}

function downloadReceipt(row: PayoutRow) {
  const text = buildReceiptText(row);
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `receipt-${row.payoutNumber}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function InfluencerPayoutsPage() {
  const [data, setData] = useState<PageData | null>(null);
  const [page, setPage] = useState(1);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    fetch(`${BASE}/influencer/payouts?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((j) => setData((j.data ?? j) as PageData))
      .catch(() => null);
  }, [page, dateFrom, dateTo]);

  return (
    <div className="rounded-3xl border border-violet-100 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap gap-3 items-end justify-between mb-6">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-3xl text-gray-900">Payout History</h2>
          <p className="text-gray-500">Paid payouts remain visible even after your wallet resets.</p>
        </div>
        <div className="flex gap-2">
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
        </div>
      </div>
      <div className="space-y-3">
        {(data?.items ?? []).map((row) => (
          <div key={row.id} className="rounded-2xl border border-gray-100 p-4 flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-gray-900">{row.payoutNumber}</p>
              <p className="text-sm text-gray-500 mt-1">
                {row.paymentMethod ?? "—"}{row.paymentReference ? ` · ${row.paymentReference}` : ""}
                {row.paidDate ? ` · ${new Date(row.paidDate).toLocaleDateString()}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-lg font-black text-emerald-700">₹{row.amount.toLocaleString()}</p>
                <p className="text-xs text-gray-500 capitalize">{row.status}</p>
                {row.paymentProofUrl && (
                  <a href={row.paymentProofUrl} target="_blank" className="text-xs text-violet-600 hover:underline mt-1 inline-block" rel="noreferrer">
                    View Proof
                  </a>
                )}
              </div>
              {row.status === "paid" && (
                <button
                  type="button"
                  onClick={() => downloadReceipt(row)}
                  title="Download Receipt"
                  className="flex items-center gap-1.5 text-xs font-semibold text-violet-600 border border-violet-200 px-3 py-2 rounded-xl hover:bg-violet-50 transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> Receipt
                </button>
              )}
            </div>
          </div>
        ))}
        {(data?.items ?? []).length === 0 && <p className="text-sm text-gray-400">No payouts yet.</p>}
      </div>
      <div className="flex items-center justify-between mt-5 text-sm">
        <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="disabled:opacity-40">← Prev</button>
        <span>Page {data?.page ?? 1} of {data?.totalPages ?? 1}</span>
        <button disabled={page >= (data?.totalPages ?? 1)} onClick={() => setPage((p) => p + 1)} className="disabled:opacity-40">Next →</button>
      </div>
    </div>
  );
}
