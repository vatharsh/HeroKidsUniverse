"use client";

import { Check, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { useState } from "react";

import { profileApi } from "@/lib/account";

export default function ChangePasswordPage() {
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const strengthScore = newPw.length === 0 ? 0
    : newPw.length < 8 ? 1
    : newPw.length < 12 && !/[^a-zA-Z0-9]/.test(newPw) ? 2
    : 3;
  const strengthLabel = ["", "Too short", "Moderate", "Strong"][strengthScore];
  const strengthColor = ["", "bg-red-400", "bg-amber-400", "bg-emerald-500"][strengthScore];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);
    if (newPw !== confirmPw) { setError("New passwords do not match"); return; }
    if (newPw.length < 8) { setError("Password must be at least 8 characters"); return; }
    setSaving(true);
    try {
      await profileApi.changePassword({ currentPassword: currentPw, newPassword: newPw, confirmPassword: confirmPw });
      setSuccess(true);
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to change password");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-ink text-2xl mb-1">Change Password</h2>
        <p className="text-ink-muted text-sm">Choose a strong password you haven&apos;t used before.</p>
      </div>

      {success && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl px-4 py-3 text-sm flex items-center gap-2">
          <Check className="w-4 h-4" /> Password changed successfully.
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl px-4 py-3 text-sm">{error}</div>
      )}

      <form onSubmit={submit} className="bg-white rounded-3xl border border-ink/10 shadow-card p-6 space-y-5">
        <div className="w-12 h-12 rounded-2xl bg-brand/10 flex items-center justify-center mb-2">
          <KeyRound className="w-6 h-6 text-brand" />
        </div>

        {/* Current password */}
        <div>
          <label className="text-ink-mid text-sm font-medium block mb-1.5">Current Password</label>
          <div className="relative">
            <input
              type={showCurrent ? "text" : "password"}
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              required
              className="w-full px-4 py-3 pr-11 rounded-xl border border-ink/15 bg-cream text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition"
              placeholder="Enter current password"
            />
            <button type="button" onClick={() => setShowCurrent(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink transition">
              {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* New password */}
        <div>
          <label className="text-ink-mid text-sm font-medium block mb-1.5">New Password</label>
          <div className="relative">
            <input
              type={showNew ? "text" : "password"}
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              required
              minLength={8}
              className="w-full px-4 py-3 pr-11 rounded-xl border border-ink/15 bg-cream text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition"
              placeholder="At least 8 characters"
            />
            <button type="button" onClick={() => setShowNew(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink transition">
              {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {newPw.length > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-ink/10 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${strengthColor}`}
                  style={{ width: `${(strengthScore / 3) * 100}%` }} />
              </div>
              <span className="text-xs text-ink-muted">{strengthLabel}</span>
            </div>
          )}
        </div>

        {/* Confirm password */}
        <div>
          <label className="text-ink-mid text-sm font-medium block mb-1.5">Confirm New Password</label>
          <input
            type="password"
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-xl border border-ink/15 bg-cream text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition"
            placeholder="Repeat new password"
          />
          {confirmPw.length > 0 && newPw !== confirmPw && (
            <p className="text-red-500 text-xs mt-1">Passwords do not match</p>
          )}
        </div>

        <button
          type="submit"
          disabled={saving || !currentPw || !newPw || !confirmPw}
          className="w-full bg-brand disabled:opacity-50 text-white font-bold py-3.5 rounded-full text-sm transition hover:bg-brand-dark flex items-center justify-center gap-2"
        >
          {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Changing…</> : "Change Password"}
        </button>
      </form>
    </div>
  );
}
