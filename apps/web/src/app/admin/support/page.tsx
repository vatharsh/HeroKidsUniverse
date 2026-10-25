"use client";

import { LifeBuoy, Loader2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { supportApi, type AdminSupportRequest } from "@/lib/support";

const STATUS_STYLE: Record<string, string> = {
  open: "bg-amber-100 text-amber-800",
  credited: "bg-emerald-100 text-emerald-700",
  refunded: "bg-emerald-100 text-emerald-700",
  resolved: "bg-gray-100 text-gray-600",
  declined: "bg-gray-100 text-gray-600",
};

export default function AdminSupportPage() {
  const [tab, setTab] = useState<"open" | "all">("open");
  const [data, setData] = useState<{ open: number; items: AdminSupportRequest[] } | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    supportApi.adminList(tab).then(setData).catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, [tab]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <LifeBuoy className="w-5 h-5 text-violet-600" />
            <h1 className="text-gray-900 text-2xl font-extrabold">Help requests</h1>
          </div>
          <p className="text-gray-500 text-sm mt-1">Refund and story problems sent by parents. Reply within 2 working days — the parent is emailed whatever you choose.</p>
        </div>
        <div className="flex gap-1">
          {(["open", "all"] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full ${tab === t ? "bg-violet-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {t === "open" ? `Open${data ? ` (${data.open})` : ""}` : "All"}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
      {!data ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-violet-600" /></div>
      ) : data.items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 py-16 text-center text-gray-400 text-sm">
          {tab === "open" ? "Nothing waiting — all caught up. 🎉" : "No help requests yet."}
        </div>
      ) : (
        <div className="space-y-4">
          {data.items.map((r) => <RequestCard key={r.id} r={r} onDone={load} />)}
        </div>
      )}
    </div>
  );
}

function RequestCard({ r, onDone }: { r: AdminSupportRequest; onDone: () => void }) {
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function act(action: "credit" | "refunded" | "declined" | "resolved") {
    if (action === "declined" && reply.trim().length < 5) { setError("Add a short reply explaining why."); return; }
    const confirmText = {
      credit: `Return the credit for "${r.story?.title ?? "this story"}" to ${r.user?.email}?`,
      refunded: "Mark this as refunded? (Refund the money first from the order's Refund panel.)",
      declined: "Decline this request and email your reply?",
      resolved: "Mark as resolved and email your reply?",
    }[action];
    if (!window.confirm(confirmText)) return;
    setBusy(action); setError("");
    try {
      await supportApi.resolve(r.id, action, reply.trim());
      window.dispatchEvent(new Event("help-requests-changed"));
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  const open = r.status === "open";
  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-gray-900">{r.reasonText}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {r.user?.name || "Parent"} · {r.user?.email} · balance {r.user?.credits ?? 0} credits ·{" "}
            {new Date(r.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
          </p>
        </div>
        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${STATUS_STYLE[r.status] ?? STATUS_STYLE.resolved}`}>{r.statusText}</span>
      </div>

      <div className="flex flex-wrap gap-2 mt-3 text-xs">
        {r.order && (
          <Link href={`/admin/orders?open=${r.order.id}&num=${encodeURIComponent(r.order.orderNumber)}`} className="rounded-full bg-violet-50 text-violet-700 px-3 py-1 font-semibold hover:bg-violet-100">
            🧾 {r.order.orderNumber} · ₹{r.order.total} · {r.order.status.replace(/_/g, " ")}
          </Link>
        )}
        {r.story && (
          <Link href={`/stories/${r.story.id}`} target="_blank" className="rounded-full bg-sky-50 text-sky-700 px-3 py-1 font-semibold hover:bg-sky-100">
            📖 {r.story.title ?? "Untitled story"}{r.story.isPreview ? " (free preview)" : ""}
          </Link>
        )}
      </div>

      <p className="mt-3 text-sm text-gray-800 bg-gray-50 rounded-xl px-4 py-3 whitespace-pre-line">“{r.message}”</p>
      {r.adminReply && <p className="mt-2 text-xs text-gray-500">Your reply: {r.adminReply}</p>}

      {open && (
        <div className="mt-4 space-y-2">
          <textarea rows={2} value={reply} onChange={(e) => setReply(e.target.value)}
            placeholder="Reply to the parent (emailed with your choice; required to decline)"
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-violet-400" />
          <div className="flex flex-wrap gap-2">
            {r.story && (
              <button type="button" disabled={!!busy} onClick={() => act("credit")}
                className="rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 px-4 py-2 text-sm font-semibold text-white">
                {busy === "credit" ? "…" : "Return the credit"}
              </button>
            )}
            {r.order?.isCreditPack && (
              <>
                <Link href={`/admin/orders?open=${r.order.id}&num=${encodeURIComponent(r.order.orderNumber)}`}
                  className="rounded-xl border border-rose-300 text-rose-700 hover:bg-rose-50 px-4 py-2 text-sm font-semibold">
                  Refund money →
                </Link>
                <button type="button" disabled={!!busy} onClick={() => act("refunded")}
                  className="rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-60 px-4 py-2 text-sm font-semibold text-gray-700">
                  Mark refunded
                </button>
              </>
            )}
            <button type="button" disabled={!!busy} onClick={() => act("resolved")}
              className="rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-60 px-4 py-2 text-sm font-semibold text-gray-700">
              Resolved
            </button>
            <button type="button" disabled={!!busy} onClick={() => act("declined")}
              className="rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-60 px-4 py-2 text-sm font-semibold text-gray-500">
              Decline
            </button>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}
