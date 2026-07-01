"use client";

import {
  Activity, BarChart3, BookOpen, Bot, Briefcase, ChevronRight, DollarSign, Globe,
  LayoutDashboard, LogOut, Package, Settings, ShieldCheck, ShoppingCart,
  Tag, Users, Zap, FileText, ScrollText,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ElementType, type ReactNode } from "react";

import { useAuth } from "@/contexts/AuthContext";
import { getAccessToken } from "@/lib/api";
import { usePublicPlatformSettings } from "@/lib/platform-settings";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

interface NavItem {
  href: string;
  icon: ElementType;
  label: string;
  flagKey?: string;
}

const NAV: NavItem[] = [
  { href: "/admin",                  icon: LayoutDashboard, label: "Dashboard"        },
  { href: "/admin/users",            icon: Users,           label: "Users"            },
  { href: "/admin/universes",        icon: Globe,           label: "Universes"        },
  { href: "/admin/stories",          icon: BookOpen,        label: "Stories"          },
  { href: "/admin/generation-jobs",  icon: Zap,             label: "Generation Jobs"  },
  { href: "/admin/orders",           icon: ShoppingCart,    label: "Orders"           },
  { href: "/admin/merchandise",      icon: Package,         label: "Merchandise",  flagKey: "ENABLE_MERCHANDISE" },
  { href: "/admin/ai-analytics",     icon: Bot,             label: "AI Analytics"     },
  { href: "/admin/qa",               icon: Activity,        label: "AI Quality"       },
  { href: "/admin/ai-prompts",       icon: ScrollText,      label: "Prompt Registry"  },
  { href: "/admin/character-canons", icon: ShieldCheck,     label: "Character Canons" },
  { href: "/admin/influencers",      icon: Briefcase,       label: "Influencers", flagKey: "ENABLE_INFLUENCER_PROGRAM" },
  { href: "/admin/coupons",          icon: Tag,             label: "Coupons"          },
  { href: "/admin/pricing",          icon: DollarSign,      label: "Pricing"          },
  { href: "/admin/payments",         icon: BarChart3,       label: "Payments"         },
  { href: "/admin/reports",          icon: FileText,        label: "Reports"          },
  { href: "/admin/settings",         icon: Settings,        label: "Settings"         },
];

interface HealthData {
  revenueToday: number;
  aiCostToday: number;
  storiesGeneratedToday: number;
  activeJobs: number;
  healthStatus: "Good" | "Warning" | "Critical";
  usdToInr: number;
}

function HealthBar() {
  const [data, setData] = useState<HealthData | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;
    const load = () => {
      fetch(`${BASE}/admin/health`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(j => {
          const d = j.data ?? j;
          if (d && typeof d.revenueToday !== "undefined") setData(d as HealthData);
        })
        .catch(() => null);
    };
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, []);

  const healthColor = {
    Good:     "text-emerald-600 bg-emerald-50 border-emerald-200",
    Warning:  "text-amber-600 bg-amber-50 border-amber-200",
    Critical: "text-red-600 bg-red-50 border-red-200",
  }[data?.healthStatus ?? "Good"];

  const dot = {
    Good:     "bg-emerald-500",
    Warning:  "bg-amber-500",
    Critical: "bg-red-500",
  }[data?.healthStatus ?? "Good"];

  return (
    <div className="sticky top-0 z-20 bg-white border-b border-gray-200 px-6 py-2.5 flex items-center gap-6 shadow-sm">
      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mr-2 whitespace-nowrap">HeroKids Health</span>

      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-gray-400 uppercase tracking-wide">Revenue Today</span>
        <span className="text-sm font-bold text-gray-900">
          {data ? `₹${(data.revenueToday ?? 0).toLocaleString()}` : "—"}
        </span>
      </div>

      <div className="w-px h-4 bg-gray-200" />

      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-gray-400 uppercase tracking-wide">AI Cost Today</span>
        <span className="text-sm font-bold text-gray-900">
          {data ? `₹${((data.aiCostToday ?? 0) * (data.usdToInr ?? 96)).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"}
        </span>
      </div>

      <div className="w-px h-4 bg-gray-200" />

      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-gray-400 uppercase tracking-wide">Stories</span>
        <span className="text-sm font-bold text-gray-900">
          {data?.storiesGeneratedToday ?? "—"}
        </span>
      </div>

      <div className="w-px h-4 bg-gray-200" />

      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-gray-400 uppercase tracking-wide">Active Jobs</span>
        <span className={`text-sm font-bold ${(data?.activeJobs ?? 0) > 0 ? "text-violet-600" : "text-gray-900"}`}>
          {data?.activeJobs ?? "—"}
        </span>
      </div>

      <div className="w-px h-4 bg-gray-200" />

      <div className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${healthColor}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
        {data?.healthStatus ?? "—"}
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { flags } = usePublicPlatformSettings();

  useEffect(() => {
    if (!loading && (!user || user.role !== "admin")) {
      router.replace("/dashboard");
    }
  }, [user, loading, router]);

  if (loading || !user || user.role !== "admin") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,rgba(244,240,255,0.7)_0%,rgba(248,250,252,1)_20%,rgba(255,255,255,1)_100%)] flex">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col shadow-sm h-screen sticky top-0">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center text-white text-sm font-black shadow-sm">H</div>
            <div>
              <p className="text-gray-900 text-sm font-extrabold leading-none tracking-tight">HeroKids</p>
              <p className="text-violet-500 text-[10px] leading-none mt-0.5 uppercase tracking-wider font-bold">Admin</p>
            </div>
          </div>
        </div>

        {/* Nav — scrollable */}
        <nav className="flex-1 overflow-y-auto py-4 px-2 flex flex-col gap-0.5 min-h-0">
          {NAV.filter((item) => !item.flagKey || flags[item.flagKey] !== false).map(({ href, icon: Icon, label }) => {
            const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? "bg-violet-50 text-violet-700 font-bold"
                    : "text-gray-500 hover:text-gray-800 hover:bg-gray-100"
                }`}
              >
                <Icon className={`w-4 h-4 flex-shrink-0 ${active ? "text-violet-600" : ""}`} />
                {label}
                {active && <ChevronRight className="w-3 h-3 ml-auto text-violet-400" />}
              </Link>
            );
          })}
        </nav>

        {/* User + Logout — always pinned at bottom */}
        <div className="flex-shrink-0 border-t border-gray-100 p-3 space-y-1">
          <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg">
            <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 text-xs font-bold flex-shrink-0">
              {user.name?.[0]?.toUpperCase() ?? "A"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-gray-900 text-xs font-semibold truncate">{user.name}</p>
              <p className="text-gray-400 text-[10px] truncate">{user.email}</p>
            </div>
          </div>
          <button
            onClick={() => { void logout(); router.push("/"); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-red-500 hover:bg-red-50 hover:text-red-600 transition-all"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-auto flex flex-col relative">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,0.08),transparent_45%),radial-gradient(circle_at_top_left,rgba(251,191,36,0.06),transparent_35%)]" />
        <HealthBar />
        <div className="flex-1 relative">
          {children}
        </div>
      </main>
    </div>
  );
}
