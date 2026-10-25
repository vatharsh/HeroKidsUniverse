"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useMaintenance } from "@/lib/platform-settings";

/** Bar along the bottom of every page while maintenance mode is on (the top bar is taken by the navbar). */
export default function MaintenanceBanner() {
  const maintenance = useMaintenance();
  const { user } = useAuth();
  if (!maintenance) return null;
  const isAdmin = user?.role === "admin";
  return (
    <>
      {/* Spacer so the bar never covers the end of the page. */}
      <div aria-hidden className="h-20 sm:h-14" />
      <div role="status" className="fixed bottom-0 inset-x-0 z-[60] bg-ink text-white shadow-[0_-6px_24px_rgba(0,0,0,0.25)]">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-start sm:items-center gap-3 text-sm">
          <span className="text-xl leading-none" aria-hidden>🛠️</span>
          <p className="leading-snug">
            {maintenance.full}
            {isAdmin && <span className="ml-2 text-gold font-semibold">Admin: maintenance mode is ON — you can still use everything.</span>}
          </p>
        </div>
      </div>
    </>
  );
}
