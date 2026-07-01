"use client";

import { Loader2, Package, Search, SquareArrowOutUpRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { fetchMyOrdersV2, type OrderV2ListResponse } from "@/lib/merchandise";
import { cn } from "@/lib/utils";

type OrderRow = OrderV2ListResponse["items"][number];

const STATUS_STYLE: Record<string, string> = {
  pending_payment: "bg-amber-50 text-amber-700 border-amber-200",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  digital_ready: "bg-violet-50 text-violet-700 border-violet-200",
  shipped: "bg-cyan-50 text-cyan-700 border-cyan-200",
  delivered: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled: "bg-red-50 text-red-600 border-red-200",
  refunded: "bg-gray-100 text-gray-500 border-gray-200",
  processing: "bg-violet-50 text-violet-700 border-violet-200",
  printing: "bg-indigo-50 text-indigo-700 border-indigo-200",
};

function statusLabel(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, m => m.toUpperCase());
}

export default function AccountOrdersPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetchMyOrdersV2()
      .then(res => setOrders(res.items))
      .catch(e => setError(e instanceof Error ? e.message : "Failed to load orders"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter(o => [
      o.id, o.orderNumber, o.status,
      ...o.items.map(i => i.productNameSnapshot),
    ].some(v => (v ?? "").toLowerCase().includes(q)));
  }, [orders, search]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-ink text-2xl mb-1">My Orders</h2>
          <p className="text-ink-muted text-sm">All your printed and digital merchandise orders.</p>
        </div>
        <Link href="/dashboard/merchandise/create"
          className="flex items-center gap-2 bg-brand text-white text-sm font-bold px-5 py-2.5 rounded-full hover:bg-brand-dark transition">
          <Package className="w-4 h-4" /> New Order
        </Link>
      </div>

      <div className="flex items-center gap-3 rounded-2xl border border-ink/10 bg-white px-4 py-3 shadow-sm">
        <Search className="w-4 h-4 text-ink-muted shrink-0" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by order number, product, or status"
          className="w-full bg-transparent text-sm text-ink placeholder:text-ink-muted focus:outline-none" />
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl px-4 py-3 text-sm">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-brand" /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-ink/10 bg-white py-16 text-center">
          <Package className="w-10 h-10 mx-auto text-ink-muted mb-4" />
          <p className="font-[family-name:var(--font-display)] text-ink text-2xl mb-2">No orders yet</p>
          <p className="text-ink-muted text-sm mb-5">Create your first merchandise piece from a universe, story, or hero.</p>
          <Link href="/dashboard/merchandise/create"
            className="inline-flex items-center gap-2 bg-brand text-white text-sm font-bold px-6 py-3 rounded-full hover:bg-brand-dark transition">
            Start Creating
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-ink/10 bg-white shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink/[0.03]">
                <tr>
                  {["Order #", "Items", "Total", "Status", "Date", ""].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.18em] text-ink-muted whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(order => (
                  <tr key={order.id} className="border-t border-ink/5 hover:bg-ink/[0.02]">
                    <td className="px-4 py-4">
                      <div className="font-mono text-xs font-bold text-ink">{order.orderNumber}</div>
                    </td>
                    <td className="px-4 py-4 max-w-[200px]">
                      {order.items.map((item, i) => (
                        <div key={i} className="text-xs text-ink leading-snug">
                          <span className="font-semibold">{item.productNameSnapshot}</span>
                          {item.attributeSummary && <span className="text-brand font-medium"> · {item.attributeSummary}</span>}
                        </div>
                      ))}
                    </td>
                    <td className="px-4 py-4 font-black text-emerald-700 whitespace-nowrap">₹{Number(order.totalAmount).toLocaleString()}</td>
                    <td className="px-4 py-4">
                      <span className={cn("inline-flex rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em]",
                        STATUS_STYLE[order.status] ?? STATUS_STYLE.pending_payment)}>
                        {statusLabel(order.status)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-ink-muted text-xs whitespace-nowrap">
                      {new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-4 py-4">
                      <Link href={`/dashboard/orders/${order.id}`}
                        className="inline-flex items-center gap-1 rounded-full border border-ink/10 px-3 py-1.5 text-[11px] font-semibold text-ink hover:border-brand hover:text-brand transition">
                        <SquareArrowOutUpRight className="w-3 h-3" /> Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
