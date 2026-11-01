"use client";

import { useEffect, useState } from "react";

import { specialPowersApi, type PowerLevel } from "@/lib/special-powers";

const RING: Record<PowerLevel["key"], string> = {
  bronze: "ring-[3px] ring-[#cd7f32] shadow-[0_0_12px_rgba(205,127,50,0.55)]",
  silver: "ring-[3px] ring-slate-300 shadow-[0_0_14px_rgba(203,213,225,0.8)]",
  gold: "ring-[3px] ring-amber-400 shadow-[0_0_18px_rgba(251,191,36,0.85)]",
  platinum: "ring-[3px] ring-cyan-200 shadow-[0_0_22px_rgba(165,243,252,0.95)]",
};

/** The level each of my heroes has reached in the Power Book (shared request). */
export function useHeroLevel(heroId: string | null | undefined): PowerLevel | null {
  const [level, setLevel] = useState<PowerLevel | null>(null);
  useEffect(() => {
    if (!heroId) return;
    let active = true;
    specialPowersApi.today().then((d) => { if (active) setLevel(d.heroes.find((h) => h.id === heroId)?.level ?? null); }).catch(() => {});
    return () => { active = false; };
  }, [heroId]);
  return level;
}

/**
 * Wraps a hero's round avatar with their Power Book frame (bronze → platinum) and a small badge.
 * Renders the avatar unchanged until the hero reaches Bronze.
 */
export default function HeroFrame({ heroId, children, className = "", badge = true }: { heroId: string | null | undefined; children: React.ReactNode; className?: string; badge?: boolean }) {
  const level = useHeroLevel(heroId);
  if (!level) return <>{children}</>;
  return (
    <span className={`relative inline-flex rounded-full ${RING[level.key]} ${level.key === "platinum" ? "animate-pulse" : ""} ${className}`} title={level.name}>
      {children}
      {badge && <span className="absolute -bottom-1 -right-1 text-sm leading-none drop-shadow" aria-label={level.name}>{level.badge}</span>}
    </span>
  );
}

/** "Siddhant · 🥇 Gold Hero" (or "Legend" for Platinum). */
export function HeroTitle({ heroId, name }: { heroId: string | null | undefined; name: string }) {
  const level = useHeroLevel(heroId);
  if (!level) return <>{name}</>;
  return <>{level.key === "platinum" ? `Legend ${name}` : name} <span className="opacity-80">· {level.badge} {level.name}</span></>;
}
