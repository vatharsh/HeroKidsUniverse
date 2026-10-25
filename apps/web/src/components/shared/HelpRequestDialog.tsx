"use client";

import { Check, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { SUPPORT_REASONS, supportApi, type SupportReason, type SupportRequest } from "@/lib/support";

/**
 * "Need help?" form for an order or a story. Sends a request the team sees in Admin → Help requests;
 * nothing is refunded automatically.
 */
export default function HelpRequestDialog({
  orderId,
  storyId,
  title,
  onClose,
  onSent,
}: {
  orderId?: string;
  storyId?: string;
  title: string;
  onClose: () => void;
  onSent?: (r: SupportRequest) => void;
}) {
  // On an order the money problems come first; on a story, "came out wrong" does.
  const options = SUPPORT_REASONS
    .filter((r) => (storyId ? r.forStory : r.forOrder))
    .sort((a, b) => (storyId ? 0 : Number(a.value === "story_wrong") - Number(b.value === "story_wrong")));
  const [reason, setReason] = useState<SupportReason>(storyId ? "story_wrong" : options[0].value);
  const [message, setMessage] = useState("");
  const [pickedStory, setPickedStory] = useState(storyId ?? "");
  const [stories, setStories] = useState<Array<{ id: string; title: string | null; createdAt: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const needsStory = reason === "story_wrong" && !storyId;
  useEffect(() => {
    if (!needsStory || stories.length) return;
    supportApi.myStories()
      .then((list) => setStories(list.filter((s) => s.title).slice(0, 30)))
      .catch(() => setStories([]));
  }, [needsStory, stories.length]);

  async function submit() {
    setError("");
    if (needsStory && !pickedStory) { setError("Please pick the story that came out wrong."); return; }
    if (message.trim().length < 5) { setError("Please tell us a little about what happened."); return; }
    setBusy(true);
    try {
      const r = await supportApi.create({ orderId, storyId: pickedStory || undefined, reason, message: message.trim() });
      setSent(true);
      onSent?.(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send your request");
    } finally {
      setBusy(false);
    }
  }

  // Portalled to <body> so headers with backdrop-blur/transform (story page) can't trap or hide it.
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4" onClick={onClose}>
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 text-ink" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="font-[family-name:var(--font-display)] text-2xl">Need help?</h3>
            <p className="text-ink-muted text-xs mt-0.5">{title}</p>
          </div>
          <button type="button" onClick={onClose} className="text-ink-muted hover:text-ink" aria-label="Close"><X className="w-5 h-5" /></button>
        </div>

        {sent ? (
          <div className="text-center py-6">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3"><Check className="w-6 h-6" /></div>
            <p className="font-semibold">Request received</p>
            <p className="text-ink-muted text-sm mt-1">We&apos;ll look into it and reply by email within 2 working days.</p>
            <button type="button" onClick={onClose} className="mt-5 bg-brand text-white font-bold px-6 py-2.5 rounded-full text-sm">Done</button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-semibold">What went wrong?</p>
              {options.map((o) => (
                <label key={o.value} className={`flex items-start gap-3 rounded-2xl border px-3 py-2.5 cursor-pointer text-sm ${reason === o.value ? "border-brand bg-brand/5" : "border-ink/10"}`}>
                  <input type="radio" name="reason" checked={reason === o.value} onChange={() => setReason(o.value)} className="mt-1 accent-[#6d28d9]" />
                  <span>{o.label}</span>
                </label>
              ))}
            </div>

            {needsStory && (
              <div>
                <p className="text-sm font-semibold mb-1.5">Which story?</p>
                <select value={pickedStory} onChange={(e) => setPickedStory(e.target.value)}
                  className="w-full rounded-xl border border-ink/15 bg-cream px-3 py-2.5 text-sm focus:outline-none focus:border-brand">
                  <option value="">Pick a story</option>
                  {stories.map((s) => (
                    <option key={s.id} value={s.id}>{s.title} · {new Date(s.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <p className="text-sm font-semibold mb-1.5">Tell us more</p>
              <textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1000}
                placeholder={reason === "story_wrong" ? "e.g. On page 3 the hero doesn't look like my child" : "What happened?"}
                className="w-full rounded-xl border border-ink/15 bg-cream px-3 py-2.5 text-sm focus:outline-none focus:border-brand resize-none" />
            </div>

            {error && <p className="text-red-600 text-sm">{error}</p>}

            <button type="button" onClick={submit} disabled={busy}
              className="w-full bg-brand hover:bg-brand-dark disabled:opacity-60 text-white font-bold py-3 rounded-full text-sm flex items-center justify-center gap-2">
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} Send request
            </button>
            <p className="text-ink-muted text-[11px] text-center">
              If a story came out wrong, we&apos;ll return the credit. See our <a href="/refunds" className="underline">refund policy</a>.
            </p>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
