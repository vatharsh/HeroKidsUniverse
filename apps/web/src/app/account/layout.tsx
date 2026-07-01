"use client";

import {
  BookOpen,
  CreditCard,
  KeyRound,
  LogOut,
  MapPin,
  Package,
  Shield,
  Sparkles,
  Star,
  User,
  Users,
  Bell,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import Navbar from "@/components/layout/Navbar";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/account",              icon: User,      label: "Profile" },
  { href: "/account/password",     icon: KeyRound,  label: "Password" },
  { href: "/account/addresses",    icon: MapPin,    label: "Addresses" },
  { href: "/account/orders",       icon: Package,   label: "My Orders" },
  { href: "/account/credits",      icon: CreditCard, label: "Credits & Wallet" },
  { href: "/account/characters",   icon: Users,     label: "My Characters" },
  { href: "/account/universes",    icon: Star,      label: "My Universes" },
  { href: "/account/notifications",icon: Bell,      label: "Notifications" },
  { href: "/account/privacy",      icon: Shield,    label: "Privacy & Data" },
];

export default function AccountLayout({ children }: { children: ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace("/login"); return; }
    if (user.role === "admin") { router.replace("/admin"); return; }
    if (user.role === "influencer") { router.replace("/influencer/dashboard"); return; }
  }, [loading, router, user]);

  if (loading || !user || user.role !== "parent") {
    return (
      <div className="min-h-screen bg-space flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/70 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  async function handleLogout() {
    await logout();
    router.push("/");
  }

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      <Navbar />

      {/* Dark page header */}
      <header className="bg-page-header pt-28 md:pt-32 pb-8 px-6">
        <div className="max-w-5xl mx-auto">
          <p className="text-gold text-xs font-bold tracking-widest uppercase mb-1">MY ACCOUNT</p>
          <h1 className="font-[family-name:var(--font-display)] text-white text-3xl md:text-4xl">
            {user.name.split(" ")[0]}&apos;s Account
          </h1>
        </div>
      </header>

      {/* Mobile tab strip */}
      <div className="md:hidden bg-white border-b border-ink/10 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sticky top-0 z-20 shadow-sm">
        <div className="flex gap-0 px-4">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-3.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors",
                  active ? "border-brand text-brand" : "border-transparent text-ink-muted hover:text-ink",
                )}
              >
                <item.icon className="w-3.5 h-3.5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Desktop layout: sidebar + content */}
      <div className="flex-1 max-w-5xl mx-auto w-full px-6 py-8 flex gap-8">
        {/* Sidebar */}
        <aside className="hidden md:flex flex-col w-52 shrink-0">
          <nav className="flex flex-col gap-1 sticky top-8">
            {NAV.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all",
                    active
                      ? "bg-brand text-white shadow-sm"
                      : "text-ink-muted hover:bg-ink/5 hover:text-ink",
                  )}
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  {item.label}
                </Link>
              );
            })}

            <div className="mt-2 pt-2 border-t border-ink/10">
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold text-red-500 hover:bg-red-50 w-full transition-all"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                Logout
              </button>
            </div>

            {/* Credits chip */}
            <div className="mt-4 bg-brand/8 border border-brand/20 rounded-2xl p-4 text-center">
              <Sparkles className="w-5 h-5 text-brand mx-auto mb-1" />
              <p className="font-[family-name:var(--font-display)] text-brand text-xl">{user.credits}</p>
              <p className="text-ink-muted text-xs">Credits</p>
              <Link href="/account/credits" className="block mt-2 text-xs font-semibold text-brand hover:underline">
                Top Up →
              </Link>
            </div>
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
