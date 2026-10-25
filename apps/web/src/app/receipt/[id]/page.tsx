"use client";

import { Loader2, Printer } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import HelpRequestDialog from "@/components/shared/HelpRequestDialog";
import { useAuth } from "@/contexts/AuthContext";
import { fetchOrderV2Detail, type OrderV2Detail } from "@/lib/merchandise";
import { formatInr } from "@/lib/utils";

/** Printable payment receipt for a credit-pack purchase (not a GST tax invoice). */
export default function ReceiptPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const [order, setOrder] = useState<OrderV2Detail | null>(null);
  const [error, setError] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { window.location.href = `/login?next=/receipt/${id}`; return; }
    fetchOrderV2Detail(id)
      .then(setOrder)
      .catch(() => setError("We couldn't find this receipt."));
  }, [id, user, authLoading]);

  if (error) {
    return (
      <main className="min-h-screen bg-cream flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-ink-mid">{error}</p>
        <Link href="/account/orders" className="text-brand font-semibold hover:underline">← My Orders</Link>
      </main>
    );
  }
  if (!order) return <main className="min-h-screen bg-cream flex items-center justify-center"><Loader2 className="w-7 h-7 animate-spin text-brand" /></main>;

  const paidAt = new Date(order.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit" });
  const paid = order.status === "digital_ready" || order.status === "paid" || order.status === "delivered";
  const discount = Number(order.discountAmount ?? 0);
  const inv = order.invoice ?? null;

  return (
    <main className="min-h-screen bg-cream py-10 px-4 print:bg-white print:py-0">
      <div className="max-w-xl mx-auto mb-4 flex items-center justify-between print:hidden">
        <Link href="/account/orders" className="text-sm text-ink-muted hover:text-brand">← My Orders</Link>
        <button type="button" onClick={() => window.print()}
          className="inline-flex items-center gap-2 bg-brand text-white text-sm font-bold px-5 py-2.5 rounded-full hover:bg-brand-dark transition">
          <Printer className="w-4 h-4" /> Print / Save as PDF
        </button>
      </div>

      <article className="max-w-xl mx-auto bg-white rounded-3xl border border-ink/10 shadow-card p-8 print:shadow-none print:border-0 print:rounded-none">
        <header className="flex items-start justify-between gap-4 pb-6 border-b border-ink/10">
          <div>
            <p className="font-[family-name:var(--font-display)] text-brand text-2xl">HeroKids Universe</p>
            {inv ? (
              <>
                <p className="text-ink text-xs font-semibold mt-1">{inv.supplier.legalName}</p>
                <p className="text-ink-muted text-xs max-w-[220px]">{inv.supplier.address}</p>
                <p className="text-ink text-xs mt-1">GSTIN: <span className="font-mono font-semibold">{inv.supplier.gstin}</span></p>
                <p className="text-ink-muted text-xs">State: {inv.supplier.state}{inv.supplier.stateCode ? ` (${inv.supplier.stateCode})` : ""}</p>
              </>
            ) : (
              <p className="text-ink-muted text-xs mt-1">by Accurate IT Solution · herokidsuniverse.com</p>
            )}
            <p className="text-ink-muted text-xs">support@herokidsuniverse.com</p>
          </div>
          <div className="text-right">
            <p className="text-ink text-lg font-bold">{inv ? "Tax invoice" : "Payment receipt"}</p>
            <p className="text-ink-muted text-xs font-mono mt-1">{inv ? inv.number : order.orderNumber}</p>
            {inv && <p className="text-ink-muted text-[11px] font-mono">Order {order.orderNumber}</p>}
            <p className="text-ink-muted text-xs">{paidAt}</p>
          </div>
        </header>

        <section className="py-5 text-sm">
          <p className="text-ink-muted text-xs uppercase tracking-wider font-bold mb-1">Billed to</p>
          <p className="text-ink font-semibold">{order.customerName || user?.name}</p>
          <p className="text-ink-mid">{order.customerEmail || user?.email}</p>
          {inv?.placeOfSupply && (
            <p className="text-ink-muted text-xs mt-1">Place of supply: {inv.placeOfSupply}{inv.placeOfSupplyCode ? ` (${inv.placeOfSupplyCode})` : ""}</p>
          )}
        </section>

        <table className="w-full text-sm">
          <tbody>
            <tr className="border-t border-ink/10">
              <td className="py-3 text-ink">{order.title ?? "Credit pack"}</td>
              <td className="py-3 text-right text-ink">{formatInr(Number(order.subtotalAmount))}</td>
            </tr>
            {discount > 0 && (
              <tr className="border-t border-ink/10">
                <td className="py-3 text-ink-mid">Discount{order.couponCode ? ` (${order.couponCode})` : ""}</td>
                <td className="py-3 text-right text-emerald-700">−{formatInr(discount)}</td>
              </tr>
            )}
            <tr className="border-t-2 border-ink">
              <td className="py-3 font-bold text-ink">Total {paid ? "paid" : ""}{inv ? " (incl. GST)" : ""}</td>
              <td className="py-3 text-right font-bold text-ink">{formatInr(Number(order.totalAmount))}</td>
            </tr>
          </tbody>
        </table>

        {inv && (
          <table className="w-full text-xs mt-4 border border-ink/10 rounded-xl overflow-hidden">
            <thead className="bg-ink/[0.03] text-ink-muted">
              <tr>
                <th className="text-left font-semibold px-3 py-2">SAC</th>
                <th className="text-right font-semibold px-3 py-2">Taxable value</th>
                {inv.igst > 0 ? (
                  <th className="text-right font-semibold px-3 py-2">IGST {inv.rate}%</th>
                ) : (
                  <>
                    <th className="text-right font-semibold px-3 py-2">CGST {inv.rate / 2}%</th>
                    <th className="text-right font-semibold px-3 py-2">SGST {inv.rate / 2}%</th>
                  </>
                )}
                <th className="text-right font-semibold px-3 py-2">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-ink/10 text-ink">
                <td className="px-3 py-2 font-mono">{inv.sac}</td>
                <td className="px-3 py-2 text-right">{formatInr(inv.taxable)}</td>
                {inv.igst > 0 ? (
                  <td className="px-3 py-2 text-right">{formatInr(inv.igst)}</td>
                ) : (
                  <>
                    <td className="px-3 py-2 text-right">{formatInr(inv.cgst)}</td>
                    <td className="px-3 py-2 text-right">{formatInr(inv.sgst)}</td>
                  </>
                )}
                <td className="px-3 py-2 text-right font-semibold">{formatInr(inv.total)}</td>
              </tr>
            </tbody>
          </table>
        )}

        <p className={`mt-4 inline-block text-xs font-bold px-3 py-1 rounded-full ${paid ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
          {paid ? "Paid ✓ · Online payment via Razorpay" : `Status: ${order.status.replace(/_/g, " ")}`}
        </p>

        <div className="mt-6 print:hidden">
          <button type="button" onClick={() => setHelpOpen(true)} className="text-sm font-semibold text-brand hover:underline">
            Need help with this order?
          </button>
        </div>
        {helpOpen && (
          <HelpRequestDialog orderId={order.id} title={`Order ${order.orderNumber}${order.title ? ` · ${order.title}` : ""}`} onClose={() => setHelpOpen(false)} />
        )}

        <p className="text-ink-muted text-[11px] mt-8 leading-relaxed">
          {inv
            ? "Prices include GST. This is a computer-generated tax invoice and needs no signature. Questions? Write to support@herokidsuniverse.com with the invoice number above."
            : "This is a payment receipt, not a GST tax invoice. Questions about this payment? Write to support@herokidsuniverse.com with the receipt number above."}
        </p>
      </article>
    </main>
  );
}
