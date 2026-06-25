"use client";

import {
  BadgePercent,
  LayoutDashboard,
  LogOut,
  ReceiptText,
  ScrollText,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { useAuth } from "@/contexts/AuthContext";

const NAV = [
  { href: "/influencer/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/influencer/coupons", label: "My Coupon Codes", icon: BadgePercent },
  { href: "/influencer/commissions", label: "My Commissions", icon: ScrollText },
  { href: "/influencer/payouts", label: "Payout History", icon: ReceiptText },
  { href: "/influencer/profile", label: "Profile", icon: UserRound },
];

export default function InfluencerLayout({ children }: { children: ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.role === "admin") {
      router.replace("/admin");
      return;
    }
    if (user.role !== "influencer") {
      router.replace("/dashboard");
    }
  }, [loading, router, user]);

  if (loading || !user || user.role !== "influencer") {
    return (
      <div className="min-h-screen bg-space flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/70 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.18),transparent_30%),linear-gradient(180deg,#120723_0%,#1d0f3a_18%,#f8f2ff_18%,#fff_100%)]">
      <div className="max-w-7xl mx-auto px-4 md:px-6 pt-6 pb-10">
        <div className="rounded-[28px] border border-white/10 bg-space/90 backdrop-blur-md shadow-[0_20px_60px_rgba(18,7,35,0.35)] overflow-hidden">
          <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-gold/80 font-bold">Influencer Portal</p>
              <h1 className="font-[family-name:var(--font-display)] text-3xl text-white mt-1">Hero Kids Universe</h1>
            </div>
            <button
              type="button"
              onClick={() => { void logout(); router.push("/"); }}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/80 hover:text-white hover:bg-white/10 transition"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>

          <div className="grid md:grid-cols-[240px_minmax(0,1fr)]">
            <aside className="border-r border-white/10 bg-black/10 p-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 mb-4">
                <p className="text-white font-semibold">{user.name}</p>
                <p className="text-white/55 text-sm">{user.email}</p>
              </div>
              <nav className="space-y-1.5">
                {NAV.map(({ href, label, icon: Icon }) => {
                  const active = pathname === href;
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition ${
                        active
                          ? "bg-violet-500 text-white shadow-[0_10px_30px_rgba(139,92,246,0.35)]"
                          : "text-white/70 hover:text-white hover:bg-white/8"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="font-medium">{label}</span>
                    </Link>
                  );
                })}
              </nav>
            </aside>

            <main className="min-h-[calc(100vh-140px)] bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.02))]">
              <div className="p-5 md:p-6">
                {(() => {
                  const activePage = NAV.find(n => n.href === pathname);
                  if (!activePage) return null;
                  return (
                    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-[13px] mb-5">
                      <span className="text-white/40">Influencer Portal</span>
                      <span className="text-white/20 mx-1">›</span>
                      <span className="text-white/80 font-semibold">{activePage.label}</span>
                    </nav>
                  );
                })()}
                {children}
              </div>
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
