"use client";

import { Bell, Check, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { notifApi, type NotificationPrefs } from "@/lib/account";
import { usePublicPlatformSettings } from "@/lib/platform-settings";
import { cn } from "@/lib/utils";

type PrefKey = keyof Omit<NotificationPrefs, "id">;

const PREFS: { key: PrefKey; label: string; description: string; icon: string; storeOnly?: boolean }[] = [
  { key: "storyUpdates",      icon: "📖", label: "Story ready",      description: "An email when your story is ready to read, or if something goes wrong." },
  { key: "orderUpdates",      icon: "📦", label: "Order updates",    description: "Shipping and delivery updates for printed books and merchandise.", storeOnly: true },
  { key: "promotionalEmails", icon: "🎉", label: "News & offers",    description: "New adventures, special offers and occasional discounts. Off unless you turn it on." },
];

/** "News & offers" is one switch for parents; it sets both marketing consents together. */
const LINKED: Partial<Record<PrefKey, PrefKey[]>> = { promotionalEmails: ["promotionalEmails", "specialOffers"] };

export default function NotificationsPage() {
  const { flags } = usePublicPlatformSettings();
  const visiblePrefs = PREFS.filter((p) => !p.storeOnly || flags.ENABLE_MERCHANDISE === true);
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    notifApi.get()
      .then(setPrefs)
      .catch(() => setError("Failed to load preferences"))
      .finally(() => setLoading(false));
  }, []);

  async function toggle(key: PrefKey) {
    if (!prefs) return;
    setSaving(key); setSuccess(false);
    const newVal = !prefs[key];
    try {
      const updated = await notifApi.update(Object.fromEntries((LINKED[key] ?? [key]).map((k) => [k, newVal])));
      setPrefs(updated);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch {
      setError("Failed to save preferences");
    } finally {
      setSaving(null);
    }
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-brand" /></div>;

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-ink text-2xl mb-1">Notification Preferences</h2>
        <p className="text-ink-muted text-sm">Choose which emails and updates you&apos;d like to receive.</p>
      </div>

      {success && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl px-4 py-3 text-sm flex items-center gap-2">
          <Check className="w-4 h-4" /> Preferences saved.
        </div>
      )}
      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl px-4 py-3 text-sm">{error}</div>}

      <div className="bg-white rounded-3xl border border-ink/10 shadow-card overflow-hidden">
        <div className="px-6 py-4 border-b border-ink/6 flex items-center gap-3">
          <Bell className="w-5 h-5 text-brand" />
          <h3 className="font-semibold text-ink">Email Notifications</h3>
        </div>
        <div className="divide-y divide-ink/6">
          {visiblePrefs.map((pref) => {
            const enabled = prefs ? prefs[pref.key] as boolean : false;
            const isSaving = saving === pref.key;
            return (
              <div key={pref.key} className="px-6 py-4 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl mt-0.5">{pref.icon}</span>
                  <div>
                    <p className="text-ink text-sm font-semibold">{pref.label}</p>
                    <p className="text-ink-muted text-xs leading-relaxed mt-0.5">{pref.description}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => toggle(pref.key)}
                  disabled={isSaving}
                  className={cn(
                    "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none mt-0.5",
                    enabled ? "bg-brand" : "bg-ink/20",
                    isSaving && "opacity-60 cursor-not-allowed",
                  )}
                  role="switch"
                  aria-checked={enabled}
                >
                  <span
                    className={cn(
                      "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out",
                      enabled ? "translate-x-5" : "translate-x-0",
                    )}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-ink-muted text-xs">
        We never sell your contact information. Emails you need — payment receipts, sign-in codes and password resets — are always sent.
      </p>
    </div>
  );
}
