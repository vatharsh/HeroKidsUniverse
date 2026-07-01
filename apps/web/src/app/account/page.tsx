"use client";

import { Check, Loader2, Pencil, X } from "lucide-react";
import { useEffect, useState } from "react";

import { profileApi, type UserProfile } from "@/lib/account";

export default function AccountProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    profileApi.get()
      .then((p) => { setProfile(p); setName(p.name); setPhone(p.phone ?? ""); })
      .catch(() => setError("Failed to load profile"))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const updated = await profileApi.update({ name: name.trim(), phone: phone.trim() });
      setProfile(updated);
      setEditing(false);
      setSuccess("Profile updated.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function cancelEdit() {
    if (!profile) return;
    setName(profile.name);
    setPhone(profile.phone ?? "");
    setEditing(false);
    setError("");
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-brand" /></div>;

  const planLabel = profile?.plan ? profile.plan.charAt(0).toUpperCase() + profile.plan.slice(1) : "Basic";
  const memberSince = profile ? new Date(profile.createdAt).toLocaleDateString("en-IN", { month: "long", year: "numeric" }) : "";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-ink text-2xl mb-1">Profile</h2>
        <p className="text-ink-muted text-sm">Your personal information and account details.</p>
      </div>

      {success && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl px-4 py-3 text-sm flex items-center gap-2">
          <Check className="w-4 h-4" /> {success}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl px-4 py-3 text-sm">{error}</div>
      )}

      {/* Profile card */}
      <div className="bg-white rounded-3xl border border-ink/10 shadow-card overflow-hidden">
        {/* Avatar strip */}
        <div className="bg-gradient-to-r from-brand/20 via-purple-100 to-gold/10 px-6 py-6 flex items-center gap-5">
          <div className="w-16 h-16 rounded-full bg-brand flex items-center justify-center text-white font-[family-name:var(--font-display)] text-2xl shadow-lg">
            {profile?.name?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div>
            <p className="font-[family-name:var(--font-display)] text-ink text-xl">{profile?.name}</p>
            <p className="text-ink-muted text-xs">Member since {memberSince}</p>
          </div>
          {!editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="ml-auto flex items-center gap-2 text-sm font-semibold text-brand hover:text-brand-dark transition"
            >
              <Pencil className="w-3.5 h-3.5" /> Edit
            </button>
          )}
        </div>

        <div className="p-6 space-y-5">
          {editing ? (
            <>
              <div>
                <label className="text-ink-mid text-sm font-medium block mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-ink/15 bg-cream text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition"
                />
              </div>
              <div>
                <label className="text-ink-mid text-sm font-medium block mb-1.5">Email <span className="text-ink-muted font-normal">(read-only)</span></label>
                <input
                  type="email"
                  value={profile?.email ?? ""}
                  disabled
                  className="w-full px-4 py-3 rounded-xl border border-ink/10 bg-ink/4 text-ink-muted cursor-not-allowed"
                />
              </div>
              <div>
                <label className="text-ink-mid text-sm font-medium block mb-1.5">Phone <span className="text-ink-muted font-normal">— optional</span></label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full px-4 py-3 rounded-xl border border-ink/15 bg-cream text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={save}
                  disabled={saving || !name.trim()}
                  className="flex-1 bg-brand disabled:opacity-50 text-white font-bold py-3 rounded-full text-sm transition hover:bg-brand-dark flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {saving ? "Saving…" : "Save Changes"}
                </button>
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="px-6 py-3 rounded-full border border-ink/15 text-ink-mid text-sm font-semibold hover:border-ink/30 transition flex items-center gap-2"
                >
                  <X className="w-4 h-4" /> Cancel
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              {[
                { label: "Full Name", value: profile?.name },
                { label: "Email", value: profile?.email },
                { label: "Phone", value: profile?.phone ?? "—" },
                { label: "Plan", value: planLabel },
                { label: "Referral Code", value: profile?.referralCode ?? "—" },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between py-2 border-b border-ink/6 last:border-0">
                  <span className="text-ink-muted text-sm">{row.label}</span>
                  <span className="text-ink text-sm font-semibold">{row.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { icon: "⚡", label: "Credits", value: profile?.credits ?? 0 },
          { icon: "👥", label: "Char Slots", value: `${profile?.characterSlotsUsed ?? 0}/${profile?.characterSlotsTotal ?? 3}` },
          { icon: "🔄", label: "Avatar Refreshes", value: profile?.avatarRefreshTokens ?? 0 },
          { icon: "🌟", label: "Plan", value: planLabel },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-ink/10 p-4 text-center shadow-sm">
            <p className="text-2xl mb-1">{s.icon}</p>
            <p className="font-[family-name:var(--font-display)] text-ink text-xl">{s.value}</p>
            <p className="text-ink-muted text-xs">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
