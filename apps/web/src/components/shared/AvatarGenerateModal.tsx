"use client";

import { Loader2, RefreshCw, X, ZoomIn, ZoomOut } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { getAccessToken } from "@/lib/api";
import { isHeicFile, releasePreparedImagePreview } from "@/lib/image-upload";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

type GenerateType = "hero" | "character";

interface Props {
  photoFile: File;
  photoPreview: string;
  generateType: GenerateType;
  characterName?: string;
  generationsUsed: number;
  maxGenerations: number;
  onSuccess: (avatarUrl: string) => void;
  onCancel: () => void;
}

type Step = "crop" | "confirm" | "loading" | "result";

const ADJUSTMENT_OPTIONS: Array<{ label: string; hint: string; emoji: string }> = [
  { label: "More realistic",  emoji: "🎨", hint: "Make the artistic style more photo-realistic with softer artistic treatment while keeping the storybook hero aesthetic." },
  { label: "Fix hairstyle",   emoji: "💇", hint: "Pay very close attention to matching the exact hairstyle: the shape, texture, color, and length from the reference photo." },
  { label: "Fix expression",  emoji: "😊", hint: "Closely match the smile, expression, and emotional warmth from the reference photo. Preserve the exact facial expression." },
  { label: "Try again",       emoji: "🔄", hint: "" },
];

const CROP_SIZE = 240; // circular viewport diameter in px
const MIN_SCALE = 0.5;
const MAX_SCALE = 4;

export default function AvatarGenerateModal({
  photoFile, photoPreview, generateType,
  characterName,
  generationsUsed, maxGenerations,
  onSuccess, onCancel,
}: Props) {
  const [step, setStep]         = useState<Step>("crop");
  const [consented, setConsented] = useState(false);
  const [generated, setGenerated] = useState<string | null>(null);
  const [error, setError]       = useState("");
  const [usedSoFar, setUsedSoFar] = useState(generationsUsed);

  // Cropped file replaces the original when sending to the API
  const [croppedFile, setCroppedFile]       = useState<File>(photoFile);
  const [croppedPreview, setCroppedPreview] = useState<string>(photoPreview);

  useEffect(() => {
    if (isHeicFile(photoFile) || photoPreview.startsWith("data:image/heic") || photoPreview.startsWith("data:image/heif")) {
      setError("This iPhone HEIC photo could not be converted for preview. Please choose another photo or set iPhone Camera Format to Most Compatible.");
      setStep("confirm");
    }
  }, [photoFile, photoPreview]);

  // ── Crop state ─────────────────────────────────────────────────────────────
  const [scale, setScale]   = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const naturalRef          = useRef({ w: 1, h: 1 });
  const imgElRef            = useRef<HTMLImageElement | null>(null);

  // Pointer drag
  const pointerRef = useRef<{ id: number; startX: number; startY: number; startOX: number; startOY: number } | null>(null);
  // Pinch-to-zoom
  const pinchRef   = useRef<{ dist: number; scale: number } | null>(null);

  const minScale = useCallback(() => {
    const { w, h } = naturalRef.current;
    return Math.max(CROP_SIZE / w, CROP_SIZE / h);
  }, []);

  function clampOffset(ox: number, oy: number, s: number) {
    const { w, h } = naturalRef.current;
    const halfExtra = { x: (w * s - CROP_SIZE) / 2, y: (h * s - CROP_SIZE) / 2 };
    return {
      x: Math.min(halfExtra.x, Math.max(-halfExtra.x, ox)),
      y: Math.min(halfExtra.y, Math.max(-halfExtra.y, oy)),
    };
  }

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const img = e.currentTarget;
    imgElRef.current = img;
    naturalRef.current = { w: img.naturalWidth, h: img.naturalHeight };
    const initScale = Math.max(CROP_SIZE / img.naturalWidth, CROP_SIZE / img.naturalHeight);
    setScale(initScale);
    setOffset({ x: 0, y: 0 });
  }

  // Pointer events — unified mouse + touch (via `touch-action: none` on the container)
  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointerRef.current = { id: e.pointerId, startX: e.clientX, startY: e.clientY, startOX: offset.x, startOY: offset.y };
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!pointerRef.current || pointerRef.current.id !== e.pointerId) return;
    const dx = e.clientX - pointerRef.current.startX;
    const dy = e.clientY - pointerRef.current.startY;
    setOffset(clampOffset(pointerRef.current.startOX + dx, pointerRef.current.startOY + dy, scale));
  }

  function onPointerUp() { pointerRef.current = null; }

  // Wheel zoom
  function onWheel(e: React.WheelEvent<HTMLDivElement>) {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.08 : 0.93;
    setScale(prev => {
      const next = Math.min(MAX_SCALE, Math.max(minScale(), prev * factor));
      setOffset(o => clampOffset(o.x, o.y, next));
      return next;
    });
  }

  // Touch pinch (two fingers on mobile)
  function onTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchRef.current = { dist: Math.hypot(dx, dy), scale };
    }
  }

  function onTouchMove(e: React.TouchEvent<HTMLDivElement>) {
    if (e.touches.length === 2 && pinchRef.current) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const newDist = Math.hypot(dx, dy);
      const ratio = newDist / pinchRef.current.dist;
      const next = Math.min(MAX_SCALE, Math.max(minScale(), pinchRef.current.scale * ratio));
      setScale(next);
      setOffset(o => clampOffset(o.x, o.y, next));
    }
  }

  function onTouchEnd() { pinchRef.current = null; }

  function adjustScale(delta: number) {
    setScale(prev => {
      const next = Math.min(MAX_SCALE, Math.max(minScale(), prev + delta));
      setOffset(o => clampOffset(o.x, o.y, next));
      return next;
    });
  }

  // ── Export crop ────────────────────────────────────────────────────────────
  async function applyCrop() {
    const img = imgElRef.current;
    if (!img) { setStep("confirm"); return; }

    const { w, h } = naturalRef.current;
    const exportSize = 512;

    const canvas = document.createElement("canvas");
    canvas.width = exportSize;
    canvas.height = exportSize;
    const ctx = canvas.getContext("2d");
    if (!ctx) { setStep("confirm"); return; }

    // Visible region in image-space coordinates
    const srcW = CROP_SIZE / scale;
    const srcH = CROP_SIZE / scale;
    const srcX = w / 2 - srcW / 2 - offset.x / scale;
    const srcY = h / 2 - srcH / 2 - offset.y / scale;

    ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, exportSize, exportSize);

    canvas.toBlob(blob => {
      if (!blob) { setStep("confirm"); return; }
      const file = new File([blob], "avatar-crop.jpg", { type: "image/jpeg" });
      const url  = URL.createObjectURL(blob);
      setCroppedFile(file);
      setCroppedPreview(url);
      setStep("confirm");
    }, "image/jpeg", 0.92);
  }

  const remaining   = maxGenerations - usedSoFar;
  const atLimit     = remaining <= 0;
  const isCharacter = generateType === "character";
  const unitLabel   = isCharacter ? "Avatar Refresh" : "avatar generation";
  const unitLabelPlural = isCharacter ? "Avatar Refreshes" : "avatar generations";

  async function handleGenerate(adjustmentHint = "") {
    setStep("loading");
    setError("");
    try {
      const token = getAccessToken() ?? "";
      const form = new FormData();
      form.append("photo", croppedFile);
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

  // Block closing while generation is in-flight
  const canClose = step !== "loading";

  function handleBackdropClick() { if (canClose) onCancel(); }

  // Revoke object URLs on unmount
  useEffect(() => {
    return () => {
      if (croppedPreview !== photoPreview) URL.revokeObjectURL(croppedPreview);
      releasePreparedImagePreview(photoPreview);
    };
  }, [croppedPreview, photoPreview]);

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

        {/* ── Crop ──────────────────────────────────────────────────────── */}
        {step === "crop" && (
          <div className="p-6">
            <h3 className="font-[family-name:var(--font-display)] text-ink text-xl mb-1">
              Position the photo
            </h3>
            <p className="text-ink-muted text-xs mb-4">Drag to reposition · scroll or pinch to zoom · center the face</p>

            {/* Circular crop viewport */}
            <div className="flex flex-col items-center gap-3 mb-5">
              <div
                className="relative overflow-hidden rounded-full border-4 border-brand/30 shadow-lg cursor-grab active:cursor-grabbing select-none"
                style={{ width: CROP_SIZE, height: CROP_SIZE, touchAction: "none" }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                onWheel={onWheel}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoPreview}
                  alt="Crop preview"
                  onLoad={onImageLoad}
                  onError={() => {
                    setError("This photo could not be displayed. Please choose another image.");
                    setStep("confirm");
                  }}
                  draggable={false}
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                    transformOrigin: "center",
                    maxWidth: "none",
                    width: naturalRef.current.w,
                    height: naturalRef.current.h,
                    pointerEvents: "none",
                  }}
                />
                {/* Guide circle overlay */}
                <div className="absolute inset-0 rounded-full ring-2 ring-brand/40 pointer-events-none" />
              </div>

              {/* Zoom buttons */}
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => adjustScale(-0.15)}
                  className="p-2 rounded-full border border-ink/15 text-ink-mid hover:border-brand hover:text-brand transition">
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-[10px] text-ink-muted w-12 text-center">{Math.round(scale * 100)}%</span>
                <button type="button" onClick={() => adjustScale(0.15)}
                  className="p-2 rounded-full border border-ink/15 text-ink-mid hover:border-brand hover:text-brand transition">
                  <ZoomIn className="w-4 h-4" />
                </button>
              </div>
            </div>

            <button type="button" onClick={() => void applyCrop()}
              className="w-full bg-brand hover:bg-brand-dark text-white font-bold py-3 rounded-full text-sm transition mb-2">
              Use this crop →
            </button>
            <button type="button" onClick={onCancel}
              className="w-full text-center text-ink-muted hover:text-ink text-xs transition">
              Cancel · choose a preset avatar instead
            </button>
          </div>
        )}

        {/* ── Confirm ─────────────────────────────────────────────────── */}
        {step === "confirm" && (
          <div className="p-8">
            <h3 className="font-[family-name:var(--font-display)] text-ink text-xl mb-5">
              {isCharacter ? "Refresh avatar" : "Generate hero avatar"}
            </h3>

            <div className="flex justify-center mb-4">
              <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-ink/10 shadow relative group">
                <img src={croppedPreview} alt="Cropped photo" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setStep("crop")}
                  className="absolute inset-0 flex items-center justify-center bg-ink/50 opacity-0 group-hover:opacity-100 transition rounded-full text-white text-[10px] font-semibold"
                >
                  Re-crop
                </button>
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
              <img src={croppedPreview} alt="Your photo" className="w-full h-full object-cover opacity-30" />
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

            <div className="flex items-center gap-5 mb-4">
              <div className="flex flex-col items-center gap-1.5">
                <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-ink/10 opacity-40">
                  <img src={croppedPreview} alt="Original" className="w-full h-full object-cover" />
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

            <p className="text-ink font-semibold text-sm text-center mb-3">
              {characterName ? `Does this look like ${characterName}?` : "Does this look right?"}
            </p>

            {error && <p className="text-red-500 text-xs mb-3 text-center">{error}</p>}

            <button type="button" onClick={() => onSuccess(generated)}
              className="w-full bg-brand hover:bg-brand-dark text-white font-bold py-3 rounded-full text-sm shadow-brand transition mb-3">
              ✓ Looks good — use this avatar
            </button>

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
