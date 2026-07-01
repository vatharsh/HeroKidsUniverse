"use client";

import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { getAccessToken } from "@/lib/api";
import { cn } from "@/lib/utils";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

interface ProfileData {
  name: string;
  email: string | null;
  phone: string | null;
  platform: string | null;
  socialHandle: string | null;
  paymentMethod: string | null;
  paymentDetailsJson: Record<string, unknown> | null;
  notes: string | null;
}

function passwordStrength(pw: string): { label: string; color: string } {
  if (pw.length < 8) return { label: "Too short", color: "text-red-500" };
  if (pw.length < 12) return { label: "Moderate", color: "text-amber-500" };
  return { label: "Strong", color: "text-emerald-600" };
}

export default function InfluencerProfilePage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [notes, setNotes] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);

  // Password change state
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;
    fetch(`${BASE}/influencer/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((j) => {
        const d = (j.data ?? j) as ProfileData;
        setProfile(d);
        setNotes(d.notes ?? "");
      })
      .catch(() => null);
  }, []);

  async function saveNotes() {
    const token = getAccessToken();
    if (!token) return;
    setNotesSaving(true);
    try {
      await fetch(`${BASE}/influencer/notes`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ notes: notes.trim() || null }),
      });
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2500);
    } finally {
      setNotesSaving(false);
    }
  }

  async function changePassword() {
    setPwError("");
    if (!currentPw || !newPw || !confirmPw) { setPwError("All fields are required."); return; }
    if (newPw !== confirmPw) { setPwError("New passwords do not match."); return; }
    if (newPw.length < 8) { setPwError("Password must be at least 8 characters."); return; }
    const token = getAccessToken();
    if (!token) return;
    setPwSaving(true);
    try {
      const res = await fetch(`${BASE}/influencer/me/password`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw, confirmPassword: confirmPw }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string };
        setPwError(body.message ?? "Failed to update password.");
        return;
      }
      setPwSuccess(true);
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
      setTimeout(() => setPwSuccess(false), 3000);
    } catch {
      setPwError("Something went wrong. Please try again.");
    } finally {
      setPwSaving(false);
    }
  }

  const strength = passwordStrength(newPw);

  return (
    <div className="space-y-6">
      {/* Profile info */}
      <div className="rounded-3xl border border-violet-100 bg-white p-6 shadow-sm">
        <h2 className="font-[family-name:var(--font-display)] text-3xl text-gray-900 mb-2">Profile</h2>
        <p className="text-gray-500 mb-6">Your profile details are managed by the HeroKids team.</p>
        <div className="grid md:grid-cols-2 gap-4">
          {[
            ["Name", profile?.name],
            ["Email", profile?.email],
            ["Phone", profile?.phone],
            ["Social Platform", profile?.platform],
            ["Social Handle", profile?.socialHandle],
            ["Payment Method", profile?.paymentMethod],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
              <p className="text-sm text-gray-500">{label}</p>
              <p className="text-lg font-semibold text-gray-900 mt-1">{value || "—"}</p>
            </div>
          ))}
        </div>
        {profile?.paymentDetailsJson && (
          <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 mt-4">
            <p className="text-sm text-gray-500">Payment Details</p>
            <pre className="text-sm text-gray-800 mt-2 whitespace-pre-wrap">{JSON.stringify(profile.paymentDetailsJson, null, 2)}</pre>
          </div>
        )}
      </div>

      {/* Change Password */}
      <div className="rounded-3xl border border-violet-100 bg-white p-6 shadow-sm">
        <h3 className="font-[family-name:var(--font-display)] text-xl text-gray-900 mb-1">Change Password</h3>
        <p className="text-sm text-gray-500 mb-5">Enter your current password to set a new one.</p>

        {pwError && <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl px-4 py-3 text-sm mb-4">{pwError}</div>}
        {pwSuccess && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl px-4 py-3 text-sm mb-4">Password updated successfully.</div>}

        <div className="space-y-4 max-w-md">
          {/* Current password */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">Current Password</label>
            <div className="relative">
              <input
                type={showCurrentPw ? "text" : "password"}
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:border-violet-400 focus:bg-white pr-10 transition"
                placeholder="Your current password"
              />
              <button type="button" onClick={() => setShowCurrentPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* New password */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">New Password</label>
            <div className="relative">
              <input
                type={showNewPw ? "text" : "password"}
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:border-violet-400 focus:bg-white pr-10 transition"
                placeholder="At least 8 characters"
              />
              <button type="button" onClick={() => setShowNewPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {newPw && <p className={cn("text-xs mt-1 font-medium", strength.color)}>{strength.label}</p>}
          </div>

          {/* Confirm password */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">Confirm New Password</label>
            <div className="relative">
              <input
                type={showConfirmPw ? "text" : "password"}
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:border-violet-400 focus:bg-white pr-10 transition"
                placeholder="Repeat new password"
              />
              <button type="button" onClick={() => setShowConfirmPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showConfirmPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {confirmPw && newPw && confirmPw !== newPw && (
              <p className="text-xs mt-1 text-red-500 font-medium">Passwords don't match</p>
            )}
          </div>

          <button
            type="button"
            onClick={() => void changePassword()}
            disabled={pwSaving}
            className="rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold px-6 py-2.5 transition disabled:opacity-50 flex items-center gap-2"
          >
            {pwSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            {pwSaving ? "Updating…" : "Update Password"}
          </button>
        </div>
      </div>

      {/* Notes for admin */}
      <div className="rounded-3xl border border-violet-100 bg-white p-6 shadow-sm">
        <h3 className="font-semibold text-gray-900 mb-1">Notes for Admin</h3>
        <p className="text-sm text-gray-500 mb-4">
          Use this to share your bank details, UPI ID, payment preferences, or any other info you want the HeroKids team to see.
        </p>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={5}
          placeholder="e.g. UPI: yourname@upi | Bank: HDFC, Account: 1234567890, IFSC: HDFC0001234 | Preferred payout: every month-end"
          className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 resize-none focus:outline-none focus:border-violet-400 focus:bg-white transition"
        />
        <div className="flex items-center justify-between mt-3">
          <p className="text-xs text-gray-400">Visible to HeroKids admin only.</p>
          <button
            onClick={() => void saveNotes()}
            disabled={notesSaving}
            className="rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold px-5 py-2 transition disabled:opacity-50"
          >
            {notesSaving ? "Saving…" : notesSaved ? "Saved ✓" : "Save Notes"}
          </button>
        </div>
      </div>
    </div>
  );
}
