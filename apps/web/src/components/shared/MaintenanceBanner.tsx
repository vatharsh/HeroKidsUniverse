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
      <div role="status" className="fixed bottom-0 inset-x-0 z-[60] bg-amber-400 text-ink border-t-4 border-amber-500 shadow-[0_-8px_30px_rgba(245,158,11,0.45)]">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-start sm:items-center gap-3 text-sm">
          {/* Pulsing dot + gently glowing icon draw the eye; the text itself stays still and readable. */}
          <span className="relative flex h-3 w-3 mt-1 sm:mt-0 flex-shrink-0" aria-hidden>
            <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75 animate-ping motion-reduce:animate-none" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-red-600" />
          </span>
          <span className="text-xl leading-none animate-pulse motion-reduce:animate-none" aria-hidden>🛠️</span>
          <p className="leading-snug font-semibold">
            <span className="font-extrabold uppercase tracking-wide mr-1.5">Maintenance:</span>
            {maintenance.full}
            {isAdmin && <span className="ml-2 font-bold text-red-700">Admin: maintenance mode is ON — you can still use everything.</span>}
          </p>
        </div>
      </div>
    </>
  );
}
