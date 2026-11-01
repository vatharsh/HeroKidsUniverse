"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { specialPowersApi } from "@/lib/special-powers";

type Today = Awaited<ReturnType<typeof specialPowersApi.today>>;

/** Dashboard banner on days a special power is hiding in the stories, with each hero's collection progress. */
export default function HiddenPowerBanner() {
  const [data, setData] = useState<Today | null>(null);
  useEffect(() => {
    specialPowersApi.today().then(setData).catch(() => setData(null));
  }, []);
  if (!data?.drop || data.heroes.length === 0) return null;
  const allFound = data.heroes.every((h) => h.foundToday);
  return (
    <div className={`mb-6 rounded-3xl bg-gradient-to-r from-space via-brand to-purple-700 text-white px-5 py-4 shadow-brand flex flex-col sm:flex-row sm:items-center gap-3 ${allFound ? "" : "ring-4 ring-gold/70 animate-[pulse_2s_ease-in-out_infinite] motion-reduce:animate-none"}`}>
      <span className="text-4xl leading-none animate-pulse" aria-hidden>{allFound ? data.drop.emoji : "🔮"}</span>
      <div className="flex-1">
        <p className="font-[family-name:var(--font-display)] text-xl">
          {allFound ? `Today's ${data.drop.name} is in your collection!` : `✨ A special power is hiding in your stories today!`}
        </p>
        <p className="text-white/80 text-sm">
          {allFound
            ? "Come back for the next hidden power — it's only around for one day."
            : `Open any story and use the 🔮 magic lens to find the ${data.drop.emoji} ${data.drop.name}. Today only!`}
          {data.drop.foundToday ? ` ${data.drop.foundToday} heroes have found it already!` : ""}
        </p>
        <div className="flex flex-wrap gap-2 mt-2">
          {data.heroes.map((h) => (
            <Link key={h.id} href={`/power-book?hero=${h.id}`} className="text-[11px] font-semibold bg-white/15 hover:bg-white/25 rounded-full px-2.5 py-1">
              {h.name ?? "Hero"}: {h.level ? `${h.level.badge} ${h.level.name} · ` : ""}{h.count}/{h.total} powers
              {h.foundToday ? " · ✓ today" : ""}
              {h.next && h.closest ? ` · ${h.closest.missing} more ${h.closest.emoji} for ${h.next.badge}` : ""}
            </Link>
          ))}
          <Link href="/power-book" className="text-[11px] font-bold text-gold underline-offset-2 hover:underline px-1 py-1">📖 Open Power Book →</Link>
        </div>
      </div>
    </div>
  );
}
