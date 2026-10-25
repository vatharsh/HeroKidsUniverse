"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useMaintenance } from "@/lib/platform-settings";

/**
 * Shown in place of an action that's paused during maintenance (creating, buying, signing up).
 * Renders `children` when nothing is paused — or for admins, who are never blocked.
 */
export default function MaintenanceNotice({ what, children }: { what: string; children: React.ReactNode }) {
  const maintenance = useMaintenance();
  const { user } = useAuth();
  if (!maintenance || user?.role === "admin") return <>{children}</>;
  return (
    <div className="rounded-3xl border-2 border-amber-400 bg-amber-50 p-6 text-center shadow-[0_0_0_4px_rgba(251,191,36,0.25)]">
      <p className="text-4xl mb-2 animate-pulse motion-reduce:animate-none" aria-hidden>🛠️</p>
      <h3 className="font-[family-name:var(--font-display)] text-ink text-2xl mb-2">{what} is paused for a little while</h3>
      <p className="text-ink-mid text-sm leading-relaxed">{maintenance.full}</p>
    </div>
  );
}
