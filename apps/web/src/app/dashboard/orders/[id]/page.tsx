"use client";

import { Download, FileText, Loader2, Package, Tag, Truck, Undo2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import Footer from "@/components/layout/Footer";
import Navbar from "@/components/layout/Navbar";
import Breadcrumb from "@/components/shared/Breadcrumb";
import { useAuth } from "@/contexts/AuthContext";
import { usePublicPlatformSettings } from "@/lib/platform-settings";
import { fetchOrderV2Detail, type OrderV2Detail } from "@/lib/merchandise";
import { cn } from "@/lib/utils";

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

const TIMELINE = [
  "pending_payment",
  "paid",
  "digital_ready",
  "print_file_generated",
  "sent_to_print",
  "printing",
  "shipped",
  "delivered",
];

function statusLabel(status: string) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { flags, loading: flagsLoading } = usePublicPlatformSettings();
  const [order, setOrder] = useState<OrderV2Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (authLoading || flagsLoading) return;
    if (flags.ENABLE_MERCHANDISE === false) return;
    if (!user) { router.push("/login"); return; }

    setLoading(true);
    fetchOrderV2Detail(id)
      .then(setOrder)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load order"))
      .finally(() => setLoading(false));
  }, [authLoading, flagsLoading, flags.ENABLE_MERCHANDISE, id, router, user]);

  const activeIndex = useMemo(
    () => TIMELINE.indexOf(order?.status ?? ""),
    [order?.status],
  );

  const statusHistory = order?.statusHistory as Array<{ id?: string; newStatus: string; note: string | null; createdAt: string }> | undefined;
  const items = order?.items as Array<{
    id: string;
    productNameSnapshot: string;
    productSlugSnapshot: string | null;
    fulfillmentTypeSnapshot: string | null;
    categoryNameSnapshot: string | null;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    previewUrl: string | null;
    printFileUrl: string | null;
    attributes: Array<{ attributeNameSnapshot: string; values: Array<{ attributeLabelSnapshot: string; priceModifierSnapshot: number }> }>;
  }> | undefined;

  const paymentSummary = order?.paymentSummary as { paymentStatus: string; totalPaidAmount: number; paymentMethodSummary: string } | null;
  const isPhysical = order?.orderType === "physical" || order?.orderType === "mixed";

  if (authLoading || flagsLoading) {
    return <div className="min-h-screen bg-space-gradient flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-white" /></div>;
  }

  if (flags.ENABLE_MERCHANDISE === false) {
    return (
      <div className="min-h-screen bg-cream flex flex-col">
        <Navbar />
        <main className="flex-1 max-w-5xl mx-auto px-6 py-24 w-full">
          <div className="rounded-3xl border border-ink/10 bg-white p-8 shadow-card">
            <h1 className="font-[family-name:var(--font-display)] text-ink text-3xl mb-3">Order Details</h1>
            <p className="text-ink-muted text-sm">Merchandise is currently hidden in platform settings.</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (loading) {
    return <div className="min-h-screen bg-cream flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-brand" /></div>;
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-cream flex flex-col">
        <Navbar />
        <main className="flex-1 max-w-5xl mx-auto px-6 py-24 w-full">
          <div className="rounded-3xl border border-ink/10 bg-white p-8 shadow-card">
            <p className="text-ink-muted text-sm mb-4">{error || "Order not found"}</p>
            <Link href="/dashboard/orders" className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-3 text-sm font-semibold text-white hover:bg-brand-dark transition">
              <Undo2 className="w-4 h-4" />
              Back to orders
            </Link>
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
            <Breadcrumb crumbs={[{ label: "My Orders", href: "/dashboard/orders" }, { label: "Order Details" }]} variant="dark" className="mb-4" />
            <h1 className="font-[family-name:var(--font-display)] text-white text-4xl md:text-5xl">Order Details</h1>
            <p className="text-white/50 text-sm mt-2">{order.orderNumber} · {new Date(order.createdAt).toLocaleDateString("en-IN")}</p>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-6 py-10 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-[0.95fr_1.05fr] gap-8">

          <section className="space-y-6">
            {/* Order items */}
            <div className="rounded-3xl border border-ink/10 bg-white p-6 shadow-card">
              <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted">Order</p>
                  <h2 className="font-[family-name:var(--font-display)] text-ink text-2xl">{order.orderNumber}</h2>
                </div>
                <span className={cn("inline-flex rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em]", STATUS_STYLE[order.status] ?? STATUS_STYLE.pending_payment)}>
                  {statusLabel(order.status)}
                </span>
              </div>

              <div className="space-y-3">
                {(items ?? []).map((item) => {
                  const isDigital =
                    item.fulfillmentTypeSnapshot === "digital" ||
                    (item.productSlugSnapshot?.includes("_pdf") ?? false);
                  return (
                    <div key={item.id} className="rounded-2xl border border-ink/10 bg-ink/[0.02] p-4">
                      <div className="flex items-start gap-3">
                        {item.previewUrl && (
                          <div className="w-16 h-20 rounded-xl overflow-hidden bg-ink/5 shrink-0">
                            <img src={item.previewUrl} alt={item.productNameSnapshot} className="w-full h-full object-cover" />
                          </div>
                        )}
                        {!item.previewUrl && (
                          <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center shrink-0">
                            {isDigital ? <FileText className="w-4 h-4 text-brand" /> : <Package className="w-4 h-4 text-brand" />}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-ink text-sm">{item.productNameSnapshot}</p>
                            <span className={cn(
                              "text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full border",
                              isDigital
                                ? "bg-violet-50 text-violet-600 border-violet-200"
                                : "bg-sky-50 text-sky-600 border-sky-200",
                            )}>
                              {isDigital ? "Digital" : "Physical"}
                            </span>
                          </div>
                          {item.categoryNameSnapshot && <p className="text-[11px] text-ink-muted">{item.categoryNameSnapshot}</p>}
                          {item.attributes.length > 0 && (
                            <p className="text-[11px] text-brand font-semibold mt-0.5">
                              {item.attributes.map((a) => a.values.map((v) => v.attributeLabelSnapshot).join(", ")).join(" · ")}
                            </p>
                          )}
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-ink-muted">Qty {item.quantity} × ₹{Number(item.unitPrice).toLocaleString()}</span>
                            <span className="text-sm font-black text-ink">₹{Number(item.totalPrice).toLocaleString()}</span>
                          </div>

                          {/* Digital: download or pending */}
                          {isDigital && item.printFileUrl && (
                            <a
                              href={item.printFileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-dark transition"
                            >
                              <Download className="w-3 h-3" />
                              Download
                            </a>
                          )}
                          {isDigital && !item.printFileUrl && (
                            <p className="mt-2 text-[11px] text-amber-600 font-semibold">
                              File being prepared — check back soon.
                            </p>
                          )}

                          {/* Physical: shipping status hint */}
                          {!isDigital && (
                            <p className="mt-2 text-[11px] text-sky-600 font-semibold">
                              {order.status === "delivered"
                                ? "Delivered"
                                : order.status === "shipped"
                                  ? "Shipped — on the way"
                                  : order.status === "printing" || order.status === "sent_to_print"
                                    ? "Being printed"
                                    : "Awaiting fulfilment"}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 rounded-xl border border-ink/8 bg-ink/[0.02] p-3 space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-ink-muted">
                  <span>Subtotal</span>
                  <span className="font-semibold">₹{Math.round(Number(order.subtotalAmount)).toLocaleString()}</span>
                </div>
                {Number(order.discountAmount) > 0 && (
                  <div className="flex items-center justify-between text-emerald-600">
                    <span className="flex items-center gap-1">
                      <Tag className="w-3 h-3" />
                      {order.couponCode ? (
                        <span>
                          Coupon <span className="font-black uppercase tracking-wider">{order.couponCode}</span>
                          {order.couponDiscountType === "percent" && order.couponDiscountValue
                            ? ` (${order.couponDiscountValue}% off)`
                            : ""}
                        </span>
                      ) : "Discount"}
                    </span>
                    <span className="font-semibold">−₹{Math.round(Number(order.discountAmount)).toLocaleString()}</span>
                  </div>
                )}
                {Number(order.shippingAmount) > 0 && (
                  <div className="flex items-center justify-between text-ink-muted">
                    <span>Shipping</span>
                    <span className="font-semibold">₹{Math.round(Number(order.shippingAmount)).toLocaleString()}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-ink-muted">
                  <span>GST @ 18%</span>
                  <span className="font-semibold">₹{Math.round(Number(order.taxAmount)).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between font-bold text-ink pt-1 border-t border-ink/8">
                  <span>Total</span>
                  <span className="text-base">₹{Number(order.totalAmount).toLocaleString()}</span>
                </div>
                {paymentSummary && (
                  <div className="flex items-center justify-between text-ink-muted pt-1 border-t border-ink/8">
                    <span>Payment</span>
                    <span className="font-semibold capitalize">{paymentSummary.paymentMethodSummary}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Shipping */}
            <div className="rounded-3xl border border-ink/10 bg-white p-6 shadow-card">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-2xl bg-violet-50 flex items-center justify-center text-violet-700">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-[family-name:var(--font-display)] text-ink text-2xl">Shipping & Tracking</h2>
                  <p className="text-ink-muted text-sm">Manual fulfilment for physical orders.</p>
                </div>
              </div>

              {isPhysical ? (
                <div className="space-y-3 text-sm">
                  <Value label="Name" value={(order as unknown as Record<string, string>).shippingName ?? "—"} />
                  <Value label="Address" value={(order as unknown as Record<string, string>).shippingAddressLine1 ?? "—"} />
                  <Value label="Address Line 2" value={(order as unknown as Record<string, string>).shippingAddressLine2 ?? "—"} />
                  <Value label="City" value={(order as unknown as Record<string, string>).shippingCity ?? "—"} />
                  <Value label="State" value={(order as unknown as Record<string, string>).shippingState ?? "—"} />
                  <Value label="Pincode" value={(order as unknown as Record<string, string>).shippingPincode ?? "—"} />
                  <Value label="Country" value={(order as unknown as Record<string, string>).shippingCountry ?? "India"} />
                </div>
              ) : (
                <p className="text-ink-muted text-sm">Digital order — your download will appear once the file is ready.</p>
              )}

              {(order as unknown as Record<string, string>).trackingUrl && (
                <div className="mt-4">
                  <a href={(order as unknown as Record<string, string>).trackingUrl} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-ink/10 bg-white px-4 py-3 text-sm font-semibold text-ink hover:border-brand hover:text-brand transition">
                    Track Order
                  </a>
                </div>
              )}
            </div>
          </section>

          <section className="space-y-6">
            {/* Status timeline */}
            <div className="rounded-3xl border border-ink/10 bg-white p-6 shadow-card">
              <h2 className="font-[family-name:var(--font-display)] text-ink text-2xl mb-4">Status Timeline</h2>
              <div className="space-y-3">
                {(statusHistory?.length ? statusHistory : TIMELINE.map((s, i) => ({ id: `${s}-${i}`, newStatus: s, note: null, createdAt: order.createdAt }))).map((entry, index) => (
                  <div key={entry.id ?? index} className={cn(
                    "rounded-2xl border p-4",
                    index <= activeIndex ? "border-brand/20 bg-brand/5" : "border-ink/10 bg-white",
                  )}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-ink">{statusLabel(entry.newStatus)}</p>
                      <span className="text-[11px] text-ink-muted">
                        {new Date(entry.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    </div>
                    {entry.note && <p className="text-sm text-ink-muted mt-1">{entry.note}</p>}
                  </div>
                ))}
              </div>
            </div>

            {/* Customer details */}
            <div className="rounded-3xl border border-ink/10 bg-white p-6 shadow-card">
              <h2 className="font-[family-name:var(--font-display)] text-ink text-2xl mb-4">Customer Details</h2>
              <div className="space-y-3 text-sm">
                <Value label="Name" value={(order as unknown as Record<string, string>).customerName ?? "—"} />
                <Value label="Email" value={(order as unknown as Record<string, string>).customerEmail ?? "—"} />
                <Value label="Phone" value={(order as unknown as Record<string, string>).customerPhone ?? "—"} />
                <Value label="Order Type" value={order.orderType} />
                <Value label="Currency" value={order.currency} />
              </div>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function Value({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-ink/10 bg-ink/[0.02] px-4 py-3">
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-ink-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold text-ink break-words">{value}</p>
    </div>
  );
}
