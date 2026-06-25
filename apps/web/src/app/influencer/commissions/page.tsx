"use client";

import { useEffect, useState } from "react";

import { getAccessToken } from "@/lib/api";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

interface CommissionRow {
  id: string;
  orderDate: string;
  orderNumber: string;
  customer: string;
  orderTotal: number;
  discountGiven: number;
  commissionRate: number;
  commissionAmount: number;
  commissionStatus: string;
}

interface PageData {
  items: CommissionRow[];
  page: number;
  totalPages: number;
}

export default function InfluencerCommissionsPage() {
  const [data, setData] = useState<PageData | null>(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (status) params.set("status", status);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    fetch(`${BASE}/influencer/orders?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((j) => setData((j.data ?? j) as PageData))
      .catch(() => null);
  }, [page, status, dateFrom, dateTo]);

  return (
    <div className="rounded-3xl border border-violet-100 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap gap-3 items-end justify-between mb-6">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-3xl text-gray-900">My Commissions</h2>
          <p className="text-gray-500">Only your own referred orders appear here.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border border-gray-200 px-3 py-2 text-sm">
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="paid">Paid</option>
            <option value="cancelled">Cancelled</option>
            <option value="reversed">Reversed</option>
          </select>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-gray-500">
              {["Order Date", "Order Number", "Customer", "Order Total", "Discount", "Rate", "Commission", "Status"].map((h) => (
                <th key={h} className="text-left py-3 pr-4 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(data?.items ?? []).map((row) => (
              <tr key={row.id} className="border-b border-gray-50">
                <td className="py-3 pr-4">{new Date(row.orderDate).toLocaleDateString()}</td>
                <td className="py-3 pr-4 font-mono text-violet-700 font-semibold">{row.orderNumber}</td>
                <td className="py-3 pr-4">{row.customer}</td>
                <td className="py-3 pr-4">₹{row.orderTotal.toLocaleString()}</td>
                <td className="py-3 pr-4 text-rose-600">₹{row.discountGiven.toLocaleString()}</td>
                <td className="py-3 pr-4">{row.commissionRate}%</td>
                <td className="py-3 pr-4 font-bold text-emerald-700">₹{row.commissionAmount.toLocaleString()}</td>
                <td className="py-3 pr-4 capitalize">{row.commissionStatus}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between mt-5 text-sm">
        <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="disabled:opacity-40">← Prev</button>
        <span>Page {data?.page ?? 1} of {data?.totalPages ?? 1}</span>
        <button disabled={page >= (data?.totalPages ?? 1)} onClick={() => setPage((p) => p + 1)} className="disabled:opacity-40">Next →</button>
      </div>
    </div>
  );
}
