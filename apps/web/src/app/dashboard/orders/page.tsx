"use client";

import { Loader2, Package, Search, SquareArrowOutUpRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import Footer from "@/components/layout/Footer";
import Navbar from "@/components/layout/Navbar";
import Breadcrumb from "@/components/shared/Breadcrumb";
import { useAuth } from "@/contexts/AuthContext";
import { usePublicPlatformSettings } from "@/lib/platform-settings";
import { fetchMyOrdersV2, type OrderV2ListResponse } from "@/lib/merchandise";
import { cn } from "@/lib/utils";

type OrderRow = OrderV2ListResponse["items"][number];

const STATUS_STYLE: Record<string, string> = {
  pending_payment: "bg-amber-50 text-amber-700 border-amber-200",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  digital_ready: "bg-violet-50 text-violet-700 border-violet-200",
  print_file_generated: "bg-sky-50 text-sky-700 border-sky-200",
  sent_to_print: "bg-blue-50 text-blue-700 border-blue-200",
  printing: "bg-indigo-50 text-indigo-700 border-indigo-200",
  shipped: "bg-cyan-50 text-cyan-700 border-cyan-200",
  delivered: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled: "bg-red-50 text-red-600 border-red-200",
  failed: "bg-gray-100 text-gray-500 border-gray-200",
  refunded: "bg-gray-100 text-gray-500 border-gray-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  processing: "bg-violet-50 text-violet-700 border-violet-200",
  printed: "bg-sky-50 text-sky-700 border-sky-200",
};

function statusLabel(status: string) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

export default function MyOrdersPage() {
  const { user, loading: authLoading } = useAuth();
  const { flags, loading: flagsLoading } = usePublicPlatformSettings();
  const router = useRouter();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (authLoading || flagsLoading) return;
    if (flags.ENABLE_MERCHANDISE === false) return;
    if (!user) { router.push("/login"); return; }

    setLoading(true);
    fetchMyOrdersV2()
      .then((res) => setOrders(res.items))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load orders"))
      .finally(() => setLoading(false));
  }, [authLoading, flagsLoading, flags.ENABLE_MERCHANDISE, router, user]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((order) => [
      order.id,
      order.orderNumber,
      order.status,
      ...order.items.map((i) => i.productNameSnapshot),
    ].some((v) => (v ?? "").toLowerCase().includes(q)));
  }, [orders, search]);

  if (authLoading || flagsLoading) {
    return <div className="min-h-screen bg-space-gradient flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-white" /></div>;
  }

  if (flags.ENABLE_MERCHANDISE === false) {
    return (
      <div className="min-h-screen bg-cream flex flex-col">
        <Navbar />
        <main className="flex-1 max-w-5xl mx-auto px-6 py-24 w-full">
          <div className="rounded-3xl border border-ink/10 bg-white p-8 shadow-card">
            <h1 className="font-[family-name:var(--font-display)] text-ink text-3xl mb-3">My Orders</h1>
            <p className="text-ink-muted text-sm">Merchandise is currently hidden in platform settings.</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      <Navbar />
      <header className="bg-page-header pt-28 md:pt-32 pb-10 px-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-gold/5 rounded-full blur-2xl pointer-events-none" />
        <div className="relative max-w-7xl mx-auto flex items-end justify-between gap-6 flex-wrap">
          <div>
            <Breadcrumb crumbs={[{ label: "My Orders" }]} variant="dark" className="mb-4" />
            <h1 className="font-[family-name:var(--font-display)] text-white text-4xl md:text-5xl">My Orders</h1>
            <p className="text-white/50 text-sm mt-2">Track your printed and digital merchandise in one place.</p>
          </div>
          <Link href="/dashboard/merchandise/create" className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white hover:bg-brand-dark transition self-start md:self-auto">
            <Package className="w-4 h-4" />
            Create New
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-6 py-10 w-full">
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-ink/10 bg-white px-4 py-3 shadow-sm">
          <Search className="w-4 h-4 text-ink-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by order number, product, or status"
            className="w-full bg-transparent text-sm text-ink placeholder:text-ink-muted focus:outline-none"
          />
        </div>

        {error && (
          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>
        )}

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand" /></div>
        ) : filtered.length === 0 ? (
          <div className="rounded-3xl border-2 border-dashed border-ink/10 bg-white py-16 text-center shadow-card">
            <Package className="w-10 h-10 mx-auto text-ink-muted mb-4" />
            <h2 className="font-[family-name:var(--font-display)] text-ink text-2xl mb-2">No orders yet</h2>
            <p className="text-ink-muted text-sm mb-6">Create your first merchandise piece from a universe, story, or hero.</p>
            <Link href="/dashboard/merchandise/create" className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white hover:bg-brand-dark transition">
              Start Creating
            </Link>
          </div>
        ) : (
          <div className="overflow-hidden rounded-3xl border border-ink/10 bg-white shadow-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-ink/[0.03]">
                  <tr>
                    {["Order #", "Items", "Total", "Type", "Status", "Created", ""].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.18em] text-ink-muted whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((order) => (
                    <tr key={order.id} className="border-t border-ink/5 hover:bg-ink/[0.02]">
                      <td className="px-4 py-4">
                        <div className="font-mono text-xs font-bold text-ink">{order.orderNumber}</div>
                        <div className="text-[11px] text-ink-muted mt-0.5">{new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</div>
                      </td>
                      <td className="px-4 py-4 max-w-[200px]">
                        {order.items.map((item, i) => (
                          <div key={i} className="text-xs text-ink leading-snug">
                            <span className="font-semibold">{item.productNameSnapshot}</span>
                            {item.attributeSummary && <span className="text-brand font-medium"> · {item.attributeSummary}</span>}
                            {i < order.items.length - 1 && <br />}
                          </div>
                        ))}
                      </td>
                      <td className="px-4 py-4 font-black text-emerald-700 whitespace-nowrap">₹{Number(order.totalAmount).toLocaleString()}</td>
                      <td className="px-4 py-4">
                        <span className="text-xs font-semibold text-ink capitalize">{order.orderType}</span>
                      </td>
                      <td className="px-4 py-4">
                        <span className={cn("inline-flex rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em]", STATUS_STYLE[order.status] ?? STATUS_STYLE.pending_payment)}>
                          {statusLabel(order.status)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-ink-muted text-sm whitespace-nowrap">
                        {new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      <td className="px-4 py-4">
                        <Link href={`/dashboard/orders/${order.id}`} className="inline-flex items-center gap-1 rounded-full border border-ink/10 bg-white px-3 py-1.5 text-[11px] font-semibold text-ink hover:border-brand hover:text-brand transition">
                          <SquareArrowOutUpRight className="w-3 h-3" />
                          Details
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
