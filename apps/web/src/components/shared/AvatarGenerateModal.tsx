"use client";

import { Loader2, RefreshCw, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { getAccessToken } from "@/lib/api";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

type GenerateType = "hero" | "character";

interface Props {
  photoFile: File;
  photoPreview: string;
  generateType: GenerateType;
  generationsUsed: number;
  maxGenerations: number;
  onSuccess: (avatarUrl: string) => void;
  onCancel: () => void;
}

type Step = "confirm" | "loading" | "result";

const ADJUSTMENT_OPTIONS: Array<{ label: string; hint: string; emoji: string }> = [
  { label: "More realistic",  emoji: "🎨", hint: "Make the artistic style more photo-realistic with softer artistic treatment while keeping the storybook hero aesthetic." },
  { label: "Fix hairstyle",   emoji: "💇", hint: "Pay very close attention to matching the exact hairstyle: the shape, texture, color, and length from the reference photo." },
  { label: "Fix expression",  emoji: "😊", hint: "Closely match the smile, expression, and emotional warmth from the reference photo. Preserve the exact facial expression." },
  { label: "Try again",       emoji: "🔄", hint: "" },
];

export default function AvatarGenerateModal({
  photoFile, photoPreview, generateType,
  generationsUsed, maxGenerations,
  onSuccess, onCancel,
}: Props) {
  const [step, setStep]                   = useState<Step>("confirm");
  const [consented, setConsented]         = useState(false);
  const [generated, setGenerated]         = useState<string | null>(null);
  const [error, setError]                 = useState("");
  const [usedSoFar, setUsedSoFar]         = useState(generationsUsed);

  const remaining = maxGenerations - usedSoFar;
  const atLimit   = remaining <= 0;
  const isCharacter = generateType === "character";
  const unitLabel = isCharacter ? "Avatar Refresh" : "avatar generation";
  const unitLabelPlural = isCharacter ? "Avatar Refreshes" : "avatar generations";

  async function handleGenerate(adjustmentHint = "") {
    setStep("loading");
    setError("");
    try {
      const token = getAccessToken() ?? "";
      const form = new FormData();
      form.append("photo", photoFile);
      form.append("type", generateType);
      if (adjustmentHint) form.append("adjustmentHint", adjustmentHint);

      const res  = await fetch(`${BASE}/avatars/generate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const json = await res.json() as { data?: { avatarUrl?: string }; message?: string };
      if (!res.ok || !json.data?.avatarUrl) throw new Error(json.message ?? "Generation failed");

      setGenerated(json.data.avatarUrl);
      setUsedSoFar(u => u + 1);
      setStep("result");
    } catch {
      setError("Couldn't generate the avatar. Please try again or choose a preset.");
      setStep(generated ? "result" : "confirm");
    }
  }

  // Block closing while generation is in-flight — a credit AND OpenAI cost are already committed
  const canClose = step !== "loading";

  function handleBackdropClick() {
    if (canClose) onCancel();
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-ink/70 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm relative overflow-hidden" onClick={e => e.stopPropagation()}>

        {canClose ? (
          <button type="button" onClick={onCancel}
            className="absolute top-4 right-4 text-ink-muted hover:text-ink transition z-10">
            <X className="w-5 h-5" />
          </button>
        ) : (
          <div className="absolute top-4 right-4 z-10" title="Please wait — generation in progress">
            <X className="w-5 h-5 text-ink/20 cursor-not-allowed" />
          </div>
        )}

        {/* ── Confirm ─────────────────────────────────────────────────── */}
        {step === "confirm" && (
          <div className="p-8">
            <h3 className="font-[family-name:var(--font-display)] text-ink text-xl mb-5">
              {isCharacter ? "Refresh avatar" : "Generate hero avatar"}
            </h3>

            <div className="flex justify-center mb-4">
              <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-ink/10 shadow">
                <img src={photoPreview} alt="Uploaded photo" className="w-full h-full object-cover" />
              </div>
            </div>

            <div className={`rounded-xl px-4 py-3 mb-5 text-center text-sm ${
              atLimit
                ? "bg-red-50 border border-red-200"
                : remaining === 1
                  ? "bg-amber-50 border border-amber-200"
                  : "bg-brand-50 border border-brand/20"
            }`}>
              {atLimit ? (
                <p className="text-red-600 font-semibold text-sm">
                  {isCharacter
                    ? "You have no Avatar Refreshes remaining."
                    : `You've used all ${maxGenerations} avatar generations.`}
                </p>
              ) : (
                <p className={`font-semibold text-sm ${remaining === 1 ? "text-amber-700" : "text-brand"}`}>
                  {isCharacter
                    ? `${remaining} Avatar Refresh${remaining !== 1 ? "es" : ""} remaining`
                    : `${remaining} of ${maxGenerations} generation${maxGenerations !== 1 ? "s" : ""} remaining`}
                </p>
              )}
              <p className="text-xs text-ink-muted mt-0.5">Each attempt uses 1 {unitLabel}.</p>
            </div>

            <div className="bg-ink/5 border border-ink/10 rounded-2xl p-4 mb-5">
              <p className="font-semibold text-ink text-sm mb-2.5 flex items-center gap-1.5">
                🔒 What happens to your photo
              </p>
              <ul className="space-y-1.5 text-xs text-ink-mid leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="text-brand mt-0.5 flex-shrink-0">✓</span>
                  Used <strong>only to create the storybook avatar</strong>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-brand mt-0.5 flex-shrink-0">✓</span>
                  Original photo <strong>permanently deleted</strong> immediately after
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-brand mt-0.5 flex-shrink-0">✓</span>
                  Only the illustrated avatar is saved — private to you
                </li>
              </ul>
            </div>

            {atLimit ? (
              <div className="space-y-2">
                <Link
                  href="/dashboard?topup=1"
                  className="w-full flex items-center justify-center bg-brand text-white font-bold py-3 rounded-full text-sm transition hover:bg-brand-dark"
                >
                  Buy Avatar Refreshes →
                </Link>
                <button type="button" onClick={onCancel}
                  className="w-full border border-ink/15 text-ink-mid hover:text-ink py-3 rounded-full text-sm font-semibold transition">
                  Choose a preset avatar instead
                </button>
              </div>
            ) : (
              <>
                <label className="flex items-start gap-3 mb-4 cursor-pointer">
                  <input type="checkbox" checked={consented} onChange={e => setConsented(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded accent-brand flex-shrink-0" />
                  <span className="text-ink-mid text-xs leading-relaxed">
                    I confirm I am the parent or guardian of the child in this photo and consent to avatar generation.
                  </span>
                </label>

                {error && <p className="text-red-500 text-xs mb-3">{error}</p>}

                <button type="button" disabled={!consented} onClick={() => void handleGenerate()}
                  className="w-full bg-brand disabled:bg-ink/20 disabled:cursor-not-allowed text-white font-bold py-3 rounded-full text-sm transition-all enabled:hover:bg-brand-dark mb-3">
                  {isCharacter ? "Refresh Avatar" : "Generate Avatar"} — uses 1 of {remaining} remaining
                </button>
                <button type="button" onClick={onCancel}
                  className="w-full text-center text-ink-muted hover:text-ink text-xs transition">
                  Cancel · choose a preset avatar instead
                </button>
              </>
            )}
          </div>
        )}

        {/* ── Loading ─────────────────────────────────────────────────── */}
        {step === "loading" && (
          <div className="p-10 flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-brand/20 mb-5 relative">
              <img src={photoPreview} alt="Your photo" className="w-full h-full object-cover opacity-30" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-brand animate-spin" />
              </div>
            </div>
            <p className="font-[family-name:var(--font-display)] text-ink text-lg mb-1">
              {isCharacter ? "Creating cartoon avatar…" : "Creating your hero avatar…"}
            </p>
            <p className="text-ink-muted text-xs mb-3">This takes ~20–30 seconds. Please keep this window open.</p>
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-xs text-amber-700 font-semibold">
              ⚠️ Do not close — 1 Avatar Refresh is being used
            </div>
            <p className="text-xs text-ink-muted/60 mt-3">
              🔒 Your photo will be permanently deleted once the avatar is created.
            </p>
          </div>
        )}

        {/* ── Result ──────────────────────────────────────────────────── */}
        {step === "result" && generated && (
          <div className="p-6 flex flex-col items-center">
            <p className="font-[family-name:var(--font-display)] text-ink text-xl mb-4 text-center">
              Avatar ready ✨
            </p>

            {/* Before / After */}
            <div className="flex items-center gap-5 mb-4">
              <div className="flex flex-col items-center gap-1.5">
                <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-ink/10 opacity-40">
                  <img src={photoPreview} alt="Original" className="w-full h-full object-cover" />
                </div>
                <p className="text-ink-muted text-[10px]">Photo<br/>(deleted ✓)</p>
              </div>
              <span className="text-ink-muted text-xl">→</span>
              <div className="flex flex-col items-center gap-1.5">
                <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-brand/30 shadow-lg shadow-brand/20">
                  <img src={generated} alt="Generated avatar" className="w-full h-full object-cover" />
                </div>
                <p className="text-brand text-[10px] font-semibold">Your avatar ✨</p>
              </div>
            </div>

            {/* Approval question */}
            <p className="text-ink font-semibold text-sm text-center mb-3">
              Does this look like your child?
            </p>

            {error && <p className="text-red-500 text-xs mb-3 text-center">{error}</p>}

            {/* Primary: looks good */}
            <button type="button" onClick={() => onSuccess(generated)}
              className="w-full bg-brand hover:bg-brand-dark text-white font-bold py-3 rounded-full text-sm shadow-brand transition mb-3">
              ✓ Looks good — use this avatar
            </button>

            {/* Adjustment options */}
            {remaining > 0 && (
              <div className="w-full">
                <p className="text-ink-muted text-[11px] text-center mb-2">
                  Not quite right? Adjust it ({remaining} {remaining !== 1 ? unitLabelPlural : unitLabel} left):
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {ADJUSTMENT_OPTIONS.map(({ label, hint, emoji }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => void handleGenerate(hint)}
                      className="flex items-center gap-1.5 justify-center border border-ink/15 rounded-full py-2 text-xs font-semibold text-ink-mid hover:border-brand hover:text-brand transition"
                    >
                      <RefreshCw className="w-3 h-3" />
                      {emoji} {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button type="button" onClick={onCancel}
              className="w-full text-center text-ink-muted hover:text-ink text-xs transition mt-3">
              Discard · choose a preset instead
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
