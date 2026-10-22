"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { useAuth } from "@/contexts/AuthContext";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

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
    if (user.role === "influencer") {
      router.replace("/influencer/dashboard");
    }
  }, [loading, router, user]);

  if (loading || !user || user.role !== "parent") {
    return (
      <div className="min-h-screen bg-space flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/70 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return children;
}
