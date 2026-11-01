"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useAuth } from "@/contexts/AuthContext";
import { specialPowersApi } from "@/lib/special-powers";

const DISMISS_KEY = "hk_power_announce_dismissed";

/**
 * Glowing, pulsing pill on the home page on power days. Parents are sent to find it; visitors are
 * invited to create a hero. Closing it hides it for the rest of that day.
 */
export default function HiddenPowerAnnouncement() {
  const { user } = useAuth();
  const [drop, setDrop] = useState<{ name: string; emoji: string; foundToday: number | null } | null>(null);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    specialPowersApi.publicToday().then((d) => {
      if (!d?.name) return;
      setDrop(d);
      let dismissed = "";
      try { dismissed = localStorage.getItem(DISMISS_KEY) ?? ""; } catch { /* storage blocked */ }
      setHidden(dismissed === `${new Date().toDateString()}:${d.name}`);
    }).catch(() => {});
  }, []);

  if (!drop || hidden) return null;

  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, `${new Date().toDateString()}:${drop!.name}`); } catch { /* storage blocked */ }
    setHidden(true);
  }

  const href = user ? "/dashboard" : "/register";
  return (
    <div className="fixed bottom-5 inset-x-0 z-[55] flex justify-center px-4 pointer-events-none">
      <div className="pointer-events-auto relative max-w-xl w-full">
        {/* Glow ring that pulses behind the pill */}
        <div aria-hidden className="absolute -inset-1 rounded-full bg-gradient-to-r from-gold via-pink-400 to-brand opacity-70 blur-md animate-pulse motion-reduce:animate-none" />
        <div className="relative flex items-center gap-3 rounded-full bg-space text-white pl-3 pr-2 py-2 shadow-2xl border border-gold/50">
          <span className="text-3xl leading-none animate-bounce motion-reduce:animate-none" aria-hidden>{drop.emoji}</span>
          <p className="flex-1 text-sm leading-snug">
            <span className="font-bold text-gold">✨ Power day!</span>{" "}
            {user
              ? <>The <strong>{drop.name}</strong> is hiding in your stories — today only.</>
              : <>A special power is hiding in every hero&apos;s story today.</>}
            {drop.foundToday ? <span className="text-white/70"> {drop.foundToday} heroes found it!</span> : null}
          </p>
          <Link href={href} className="shrink-0 bg-gold text-space font-bold text-xs px-4 py-2 rounded-full hover:brightness-110">
            {user ? "Find it 🔮" : "Create your hero"}
          </Link>
          <button type="button" onClick={dismiss} aria-label="Close" className="shrink-0 w-7 h-7 rounded-full text-white/60 hover:text-white hover:bg-white/10">×</button>
        </div>
      </div>
    </div>
  );
}
