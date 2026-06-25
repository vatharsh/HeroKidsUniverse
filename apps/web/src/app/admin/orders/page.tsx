"use client";

import { Eye, Loader2, Package, RefreshCw, Save, Tag, X } from "lucide-react";
import { useEffect, useState } from "react";

import { getAccessToken } from "@/lib/api";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

const ORDER_STATUSES = ["", "pending_payment", "paid", "processing", "digital_ready", "print_file_generated", "sent_to_print", "printing", "shipped", "delivered", "cancelled", "failed", "refunded"];

interface OrderItem {
  productNameSnapshot: string;
  categoryNameSnapshot: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  attributeSummary: string;
}

interface Order {
  id: string;
  userId: string;
  userEmail: string | null;
  userName: string | null;
  orderNumber: string;
  orderType: string;
  status: string;
  totalAmount: number;
  currency: string;
  itemCount: number;
  createdAt: string;
  items: OrderItem[];
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  shippingName?: string | null;
  shippingAddressLine1?: string | null;
  shippingCity?: string | null;
  shippingPincode?: string | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  adminNotes?: string | null;
}

interface DetailItemAttribute {
  attributeNameSnapshot: string;
  values: { attributeLabelSnapshot: string; attributeValueSnapshot: string; priceModifierSnapshot: number }[];
}

interface DetailItem {
  id: string;
  productNameSnapshot: string;
  productSlugSnapshot: string;
  categoryNameSnapshot: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  previewUrl: string | null;
  attributes: DetailItemAttribute[];
}

interface PaymentSummary {
  paymentStatus: string;
  totalPaidAmount: number;
  totalRefundedAmount: number;
  outstandingAmount: number;
  currency: string;
  paymentMethodSummary: string;
}

interface PaymentDetail {
  transactionType: string;
  paymentProvider: string;
  paymentMethod: string;
  amount: number;
  currency: string;
  status: string;
  transactionId: string | null;
  providerReference: string | null;
  createdAt: string;
}

interface StatusHistoryEntry {
  oldStatus: string | null;
  newStatus: string;
  note: string | null;
  changedByUserId: string;
  createdAt: string;
}

interface OrderDetail {
  id: string;
  orderNumber: string;
  orderType: string;
  status: string;
  subtotalAmount: number;
  discountAmount: number;
  shippingAmount: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  couponCode: string | null;
  couponType: string | null;
  couponDiscountType: string | null;
  couponDiscountValue: number | null;
  couponDiscountAmount: number | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  paymentMethod: string | null;
  shippingName: string | null;
  shippingPhone: string | null;
  shippingAddressLine1: string | null;
  shippingAddressLine2: string | null;
  shippingCity: string | null;
  shippingState: string | null;
  shippingPincode: string | null;
  shippingCountry: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
  items: DetailItem[];
  paymentSummary: PaymentSummary | null;
  paymentDetails: PaymentDetail[];
  statusHistory: StatusHistoryEntry[];
}

interface Paginated {
  items: Order[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const STATUS_STYLE: Record<string, string> = {
  pending_payment:       "bg-amber-50 text-amber-700",
  paid:                  "bg-emerald-50 text-emerald-700",
  digital_ready:         "bg-violet-50 text-violet-700",
  print_file_generated:  "bg-sky-50 text-sky-700",
  sent_to_print:         "bg-blue-50 text-blue-700",
  printing:              "bg-indigo-50 text-indigo-700",
  processing:            "bg-violet-100 text-violet-700",
  shipped:               "bg-cyan-50 text-cyan-700",
  delivered:             "bg-emerald-100 text-emerald-800",
  cancelled:             "bg-red-50 text-red-600",
  failed:                "bg-gray-100 text-gray-500",
  refunded:              "bg-gray-100 text-gray-500",
};

function SectionHeader({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2 mt-5 first:mt-0">{children}</p>;
}

function Row({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex justify-between gap-3 text-xs py-1 border-b border-gray-50 last:border-0">
      <span className="text-gray-400 shrink-0">{label}</span>
      <span className="text-gray-800 text-right break-all">{value}</span>
    </div>
  );
}

function ViewDrawer({ orderId, orderNumber, onClose }: { orderId: string; orderNumber: string; onClose: () => void }) {
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;
    fetch(`${BASE}/admin/v2/orders/${orderId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(j => {
        if (j.data) setDetail(j.data as OrderDetail);
        else setError("Failed to load order");
      })
      .catch(() => setError("Network error"))
      .finally(() => setLoading(false));
  }, [orderId]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-[480px] h-full bg-white border-l border-gray-200 shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <p className="font-mono text-xs font-bold text-gray-800">{orderNumber}</p>
            {detail && (
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[detail.status] ?? "bg-gray-100 text-gray-500"}`}>
                {detail.status}
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 p-1"><X className="w-4 h-4" /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading && (
            <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 text-violet-500 animate-spin" /></div>
          )}
          {error && <p className="text-red-500 text-xs">{error}</p>}

          {detail && (
            <>
              {/* Overview */}
              <SectionHeader>Order</SectionHeader>
              <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 space-y-0">
                <Row label="Number"     value={<span className="font-mono font-bold">{detail.orderNumber}</span>} />
                <Row label="Type"       value={<span className="capitalize">{detail.orderType}</span>} />
                <Row label="Status"     value={<span className={`px-2 py-0.5 rounded-full font-semibold ${STATUS_STYLE[detail.status] ?? "bg-gray-100 text-gray-500"}`}>{detail.status}</span>} />
                <Row label="Created"    value={new Date(detail.createdAt).toLocaleString()} />
                {detail.adminNotes     && <Row label="Admin notes" value={detail.adminNotes} />}
                {detail.trackingNumber && <Row label="Tracking #"  value={detail.trackingNumber} />}
                {detail.trackingUrl    && <Row label="Tracking URL" value={<a href={detail.trackingUrl} target="_blank" rel="noreferrer" className="text-violet-600 underline">{detail.trackingUrl}</a>} />}
              </div>

              {/* Customer */}
              <SectionHeader>Customer</SectionHeader>
              <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 space-y-0">
                <Row label="Name"    value={detail.customerName} />
                <Row label="Email"   value={detail.customerEmail} />
                <Row label="Phone"   value={detail.customerPhone} />
                <Row label="Payment" value={detail.paymentMethod?.toUpperCase()} />
              </div>

              {/* Shipping */}
              {detail.shippingName && (
                <>
                  <SectionHeader>Shipping Address</SectionHeader>
                  <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 space-y-0">
                    <Row label="Name"    value={detail.shippingName} />
                    <Row label="Phone"   value={detail.shippingPhone} />
                    <Row label="Line 1"  value={detail.shippingAddressLine1} />
                    <Row label="Line 2"  value={detail.shippingAddressLine2} />
                    <Row label="City"    value={detail.shippingCity} />
                    <Row label="State"   value={detail.shippingState} />
                    <Row label="Pincode" value={detail.shippingPincode} />
                    <Row label="Country" value={detail.shippingCountry} />
                  </div>
                </>
              )}

              {/* Items */}
              <SectionHeader>Items ({detail.items.length})</SectionHeader>
              <div className="space-y-2">
                {detail.items.map((item) => (
                  <div key={item.id} className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <div>
                        <p className="text-xs font-bold text-gray-800">{item.productNameSnapshot}</p>
                        {item.categoryNameSnapshot && (
                          <p className="text-[11px] text-gray-400">{item.categoryNameSnapshot}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-black text-emerald-600">₹{item.totalPrice.toLocaleString()}</p>
                        <p className="text-[11px] text-gray-400">₹{item.unitPrice.toLocaleString()} × {item.quantity}</p>
                      </div>
                    </div>
                    {item.attributes.length > 0 && (
                      <div className="space-y-0.5 border-t border-gray-100 pt-2 mt-1">
                        {item.attributes.map((attr) => (
                          <div key={attr.attributeNameSnapshot} className="flex justify-between text-[11px]">
                            <span className="text-gray-400">{attr.attributeNameSnapshot}</span>
                            <span className="text-gray-700 font-medium">
                              {attr.values.map(v => v.attributeLabelSnapshot).join(", ")}
                              {attr.values.some(v => v.priceModifierSnapshot !== 0) && (
                                <span className="text-gray-400 ml-1">
                                  (+₹{attr.values.reduce((s, v) => s + v.priceModifierSnapshot, 0)})
                                </span>
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Pricing */}
              <SectionHeader>Pricing</SectionHeader>
              <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 space-y-0">
                <Row label="Subtotal"  value={`₹${Number(detail.subtotalAmount).toLocaleString()}`} />
                {Number(detail.discountAmount) > 0 && (
                  <Row label={
                    <span className="flex items-center gap-1">
                      <Tag className="w-3 h-3 text-emerald-500" />
                      {detail.couponCode ? (
                        <>Coupon <span className="font-mono font-black text-violet-600">{detail.couponCode}</span>
                          {detail.couponType && <span className="ml-1 text-[10px] text-gray-400 uppercase">({detail.couponType})</span>}
                          {detail.couponDiscountType === "percent" && detail.couponDiscountValue
                            ? <span className="ml-1 text-gray-400"> {detail.couponDiscountValue}% off</span>
                            : null}
                        </>
                      ) : "Discount"}
                    </span>
                  } value={<span className="text-emerald-600 font-semibold">−₹{Number(detail.discountAmount).toLocaleString()}</span>} />
                )}
                {detail.shippingAmount > 0  && <Row label="Shipping"  value={`₹${Number(detail.shippingAmount).toLocaleString()}`} />}
                {detail.taxAmount > 0       && <Row label="GST (18%)" value={`₹${Number(detail.taxAmount).toFixed(2)}`} />}
                <div className="flex justify-between text-xs font-black pt-1 mt-1 border-t border-gray-200">
                  <span className="text-gray-700">Total</span>
                  <span className="text-emerald-600">₹{Number(detail.totalAmount).toLocaleString()}</span>
                </div>
              </div>

              {/* Payment */}
              {detail.paymentSummary && (
                <>
                  <SectionHeader>Payment</SectionHeader>
                  <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 space-y-0">
                    <Row label="Status"    value={
                      <span className={detail.paymentSummary.paymentStatus === "paid" ? "text-emerald-600 font-semibold" : "text-amber-600 font-semibold"}>
                        {detail.paymentSummary.paymentStatus}
                      </span>
                    } />
                    <Row label="Paid"      value={`₹${detail.paymentSummary.totalPaidAmount.toLocaleString()}`} />
                    {detail.paymentSummary.totalRefundedAmount > 0 && (
                      <Row label="Refunded" value={`₹${detail.paymentSummary.totalRefundedAmount.toLocaleString()}`} />
                    )}
                    {detail.paymentSummary.outstandingAmount > 0 && (
                      <Row label="Outstanding" value={<span className="text-red-600">₹{detail.paymentSummary.outstandingAmount.toLocaleString()}</span>} />
                    )}
                    <Row label="Method"    value={detail.paymentSummary.paymentMethodSummary} />
                  </div>
                  {detail.paymentDetails.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {detail.paymentDetails.map((pd, i) => (
                        <div key={i} className="rounded-lg border border-gray-100 bg-white px-4 py-2.5 text-[11px] space-y-0.5">
                          <div className="flex justify-between">
                            <span className="text-gray-400">{pd.transactionType} · {pd.paymentProvider} · {pd.paymentMethod?.toUpperCase()}</span>
                            <span className={pd.status === "success" ? "text-emerald-600 font-semibold" : "text-red-500 font-semibold"}>{pd.status}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">{new Date(pd.createdAt).toLocaleString()}</span>
                            <span className="text-gray-700 font-bold">₹{pd.amount.toLocaleString()}</span>
                          </div>
                          {pd.transactionId && <p className="text-gray-400 font-mono">{pd.transactionId}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Status History */}
              {detail.statusHistory.length > 0 && (
                <>
                  <SectionHeader>Status History</SectionHeader>
                  <div className="relative pl-4">
                    <div className="absolute left-[7px] top-0 bottom-0 w-px bg-gray-100" />
                    {detail.statusHistory.map((h, i) => (
                      <div key={i} className="relative mb-3 last:mb-0">
                        <div className="absolute -left-[13px] top-1 w-2.5 h-2.5 rounded-full bg-violet-500 border-2 border-white" />
                        <p className="text-xs font-semibold text-gray-800">
                          {h.oldStatus ? `${h.oldStatus} → ` : ""}<span className="text-violet-600">{h.newStatus}</span>
                        </p>
                        {h.note && <p className="text-[11px] text-gray-500 mt-0.5">{h.note}</p>}
                        <p className="text-[11px] text-gray-400 mt-0.5">{new Date(h.createdAt).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div className="h-6" />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function EditDrawer({ order, onClose, onSaved }: { order: Order; onClose: () => void; onSaved: () => void }) {
  const [status, setStatus] = useState(order.status);
  const [note, setNote] = useState("");
  const [adminNotes, setAdminNotes] = useState(order.adminNotes ?? "");
  const [saving, setSaving] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    const token = getAccessToken();
    if (!token) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`${BASE}/admin/v2/orders/${order.id}/status`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status, note: note || undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(body.message ?? "Failed to update");
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function saveNotes() {
    const token = getAccessToken();
    if (!token) return;
    setSavingNotes(true);
    setError("");
    try {
      const res = await fetch(`${BASE}/admin/v2/orders/${order.id}/notes`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ adminNotes }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(body.message ?? "Failed to save notes");
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save notes");
    } finally {
      setSavingNotes(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="w-96 h-full bg-white border-l border-gray-200 p-6 overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-gray-900 font-bold">Update Order</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
        </div>

        <p className="text-gray-400 text-xs mb-1 font-mono font-bold">{order.orderNumber}</p>
        <p className="text-gray-400 text-xs mb-4">{order.items.map(i => i.productNameSnapshot).join(", ")}</p>

        {error && <p className="text-red-600 text-xs mb-3 rounded-lg bg-red-50 px-3 py-2">{error}</p>}

        <div className="space-y-4">
          <div>
            <label className="text-gray-500 text-xs block mb-1.5">Status</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-800 text-sm focus:outline-none focus:border-violet-400"
            >
              {ORDER_STATUSES.filter(Boolean).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className="text-gray-500 text-xs block mb-1.5">Note for this status change (optional)</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              placeholder="Add a note for this status change…"
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-800 text-sm placeholder:text-gray-400 focus:outline-none focus:border-violet-400 resize-none"
            />
          </div>

          {order.customerName && (
            <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 space-y-1 text-xs">
              <p className="text-gray-500 font-semibold mb-1">Customer</p>
              <p className="text-gray-700">{order.customerName}</p>
              {order.customerEmail && <p className="text-gray-500">{order.customerEmail}</p>}
              {order.customerPhone && <p className="text-gray-500">{order.customerPhone}</p>}
              {order.shippingAddressLine1 && <p className="text-gray-500 mt-1">{order.shippingAddressLine1}{order.shippingCity ? `, ${order.shippingCity}` : ""}{order.shippingPincode ? ` – ${order.shippingPincode}` : ""}</p>}
            </div>
          )}
        </div>

        <button
          onClick={() => void save()}
          disabled={saving}
          className="mt-6 w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold py-2.5 rounded-lg transition disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Update Status
        </button>

        <div className="mt-6 pt-6 border-t border-gray-100">
          <label className="text-gray-500 text-xs block mb-1.5 font-semibold uppercase tracking-wide">Admin Notes</label>
          <p className="text-gray-400 text-[11px] mb-2">Internal notes — not visible to the customer.</p>
          <textarea
            value={adminNotes}
            onChange={e => setAdminNotes(e.target.value)}
            rows={4}
            placeholder="Add internal notes about this order…"
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-800 text-sm placeholder:text-gray-400 focus:outline-none focus:border-violet-400 resize-none"
          />
          <button
            onClick={() => void saveNotes()}
            disabled={savingNotes}
            className="mt-2 w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-900 text-white text-sm font-semibold py-2 rounded-lg transition disabled:opacity-50"
          >
            {savingNotes ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save Notes
          </button>
        </div>
      </div>
    </div>
  );
}

export default function OrdersPage() {
  const [data, setData] = useState<Paginated | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Order | null>(null);
  const [viewing, setViewing] = useState<{ id: string; orderNumber: string } | null>(null);

  function fetchOrders(p = page, s = status) {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: "20" });
    if (s) params.set("status", s);
    fetch(`${BASE}/admin/v2/orders?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(j => setData(j.data ?? j))
      .catch(() => null)
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchOrders(); }, []); // eslint-disable-line

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {viewing && <ViewDrawer orderId={viewing.id} orderNumber={viewing.orderNumber} onClose={() => setViewing(null)} />}
      {editing && <EditDrawer order={editing} onClose={() => setEditing(null)} onSaved={() => fetchOrders()} />}

      <div className="mb-6 flex items-center gap-3">
        <Package className="w-5 h-5 text-amber-600" />
        <h1 className="text-gray-900 text-2xl font-extrabold">Merchandise Orders</h1>
        <button onClick={() => fetchOrders()} className="ml-auto text-gray-400 hover:text-gray-700 transition p-1.5 rounded-lg hover:bg-gray-100">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { setPage(1); fetchOrders(1, status); } }}
          placeholder="Search by order number…"
          className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-gray-800 text-xs placeholder:text-gray-400 focus:outline-none focus:border-violet-400 w-56"
        />
        {ORDER_STATUSES.map(s => (
          <button
            key={s || "all"}
            onClick={() => { setStatus(s); setPage(1); fetchOrders(1, s); }}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all border ${
              status === s ? "bg-violet-600 text-white border-violet-600" : "border-gray-200 text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            {s || "All"}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              {["Order #", "Items", "Total", "Type", "Status", "Created", "Actions"].map(h => (
                <th key={h} className="text-left px-4 py-3 text-gray-500 text-xs font-semibold uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center"><Loader2 className="w-5 h-5 text-violet-600 animate-spin mx-auto" /></td></tr>
            ) : data?.items.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400 text-xs">No orders found</td></tr>
            ) : (
              data?.items.map(order => (
                <tr key={order.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-mono text-xs font-bold text-gray-800">{order.orderNumber}</div>
                    <div className="text-[11px] text-gray-400 truncate max-w-[140px]" title={order.userEmail ?? order.userId}>
                      {order.userName ?? order.userEmail ?? order.userId?.slice(0, 8) ?? "—"}
                    </div>
                  </td>
                  <td className="px-4 py-3 max-w-[200px]">
                    {order.items.map((item, i) => (
                      <div key={i} className="text-xs text-gray-800 leading-snug">
                        <span className="font-semibold">{item.productNameSnapshot}</span>
                        {item.attributeSummary && <span className="text-violet-600"> · {item.attributeSummary}</span>}
                        {" "}×{item.quantity}
                      </div>
                    ))}
                  </td>
                  <td className="px-4 py-3 text-emerald-600 text-xs font-black whitespace-nowrap">₹{Number(order.totalAmount).toLocaleString()}</td>
                  <td className="px-4 py-3 text-xs text-gray-600 capitalize">{order.orderType}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[order.status] ?? "bg-gray-100 text-gray-500"}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{new Date(order.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setViewing({ id: order.id, orderNumber: order.orderNumber })}
                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 font-medium transition"
                        title="View full details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        View
                      </button>
                      <button
                        onClick={() => setEditing(order)}
                        className="text-xs text-violet-600 font-semibold hover:underline"
                      >
                        Edit
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {data && data.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
          <span>{data.total} orders</span>
          <div className="flex gap-2">
            <button onClick={() => { setPage(p => p - 1); fetchOrders(page - 1); }} disabled={page === 1} className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-30 hover:border-gray-300 transition">Prev</button>
            <span className="px-3 py-1.5">{page} / {data.totalPages}</span>
            <button onClick={() => { setPage(p => p + 1); fetchOrders(page + 1); }} disabled={page === data.totalPages} className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-30 hover:border-gray-300 transition">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
