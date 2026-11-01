"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import Footer from "@/components/layout/Footer";
import Navbar from "@/components/layout/Navbar";
import { useAuth } from "@/contexts/AuthContext";
import { specialPowersApi, type HeroToday, type PowerBook } from "@/lib/special-powers";

const LEVEL_STYLE: Record<string, string> = {
  bronze: "from-[#cd7f32] to-[#8a5523]",
  silver: "from-slate-200 to-slate-400",
  gold: "from-amber-300 to-amber-500",
  platinum: "from-cyan-100 via-white to-violet-200",
};

/** The child's collection album: 4 collections of 8 special powers, missing ones as silhouettes. */
export default function PowerBookPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [heroes, setHeroes] = useState<HeroToday[]>([]);
  const [heroId, setHeroId] = useState<string | null>(null);
  const [book, setBook] = useState<PowerBook | null>(null);
  const [todayDrop, setTodayDrop] = useState<{ name: string; emoji: string } | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.push("/login?next=/power-book"); return; }
    specialPowersApi.today().then((d) => {
      setHeroes(d.heroes);
      setTodayDrop(d.drop);
      const wanted = new URLSearchParams(window.location.search).get("hero");
      setHeroId(d.heroes.find((h) => h.id === wanted)?.id ?? d.heroes[0]?.id ?? null);
    }).catch(() => setHeroes([]));
  }, [user, loading, router]);

  useEffect(() => {
    if (!heroId) return;
    specialPowersApi.book(heroId).then(setBook).catch(() => setBook(null));
  }, [heroId]);

  const hero = heroes.find((h) => h.id === heroId);

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      <Navbar />
      <header className="bg-page-header pt-28 md:pt-32 pb-10 px-6">
        <div className="max-w-5xl mx-auto">
          <p className="text-gold text-xs font-bold tracking-widest uppercase mb-2">📖 POWER BOOK</p>
          {heroes.length > 1 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {heroes.map((h) => (
                <button key={h.id} type="button" onClick={() => setHeroId(h.id)}
                  className={`text-sm font-semibold px-3 py-1.5 rounded-full ${h.id === heroId ? "bg-gold text-space" : "bg-white/10 text-white/80 hover:bg-white/20"}`}>
                  {h.level?.badge} {h.name}
                </button>
              ))}
            </div>
          )}
          <h1 className="font-[family-name:var(--font-display)] text-white text-4xl md:text-5xl">
            {book?.level?.key === "platinum" ? "Legend " : ""}{hero?.name ?? "Your hero"}&apos;s Power Book
          </h1>
          {book && (
            <p className="text-white/80 mt-2">
              {book.count} of {book.total} special powers found · {book.completeSets} of 4 collections complete
              {book.level && <span className="ml-2 inline-flex items-center gap-1 font-bold text-gold">{book.level.badge} {book.level.name}</span>}
            </p>
          )}
          {book?.next && book.closest && (
            <p className="text-white/70 text-sm mt-1">
              Next: <strong className="text-white">{book.next.badge} {book.next.name}</strong> — finish {book.next.sets} whole collection{book.next.sets === 1 ? "" : "s"}.
              Closest: {book.closest.emoji} {book.closest.name}, {book.closest.missing} to go.
            </p>
          )}
          {todayDrop && (
            <p className="mt-4 inline-block bg-white/10 text-white text-sm rounded-full px-4 py-2">
              🔮 Today a power is hiding in your stories — open any story and use the magic lens!
            </p>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto px-6 py-10 w-full">
        {!book ? (
          heroes.length === 0 && !loading ? (
            <p className="text-ink-muted text-center py-20">Create a hero first — then start collecting powers!</p>
          ) : (
            <div className="flex justify-center py-20"><Loader2 className="w-7 h-7 animate-spin text-brand" /></div>
          )
        ) : (
          <div className="space-y-8">
            {book.collections.map((c) => (
              <section key={c.key} className={`rounded-3xl border p-5 ${c.complete ? "border-gold bg-gold/5 shadow-[0_0_24px_rgba(251,191,36,0.25)]" : "border-ink/10 bg-white"}`}>
                <div className="flex items-center justify-between gap-3 mb-4">
                  <h2 className="font-[family-name:var(--font-display)] text-ink text-2xl">{c.emoji} {c.name}</h2>
                  <span className={`text-sm font-bold ${c.complete ? "text-amber-600" : "text-ink-muted"}`}>{c.complete ? "✓ Complete!" : `${c.have} / ${c.total}`}</span>
                </div>
                <div className="h-2 rounded-full bg-ink/10 overflow-hidden mb-5">
                  <div className="h-full bg-gradient-to-r from-brand to-gold transition-all" style={{ width: `${(c.have / c.total) * 100}%` }} />
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
                  {c.powers.map((p) => p.found ? (
                    <div key={p.key} title={p.description} className="aspect-square rounded-2xl bg-gradient-to-br from-brand/10 to-gold/20 border border-gold/40 flex flex-col items-center justify-center p-1 text-center">
                      <span className="text-3xl">{p.emoji}</span>
                      <span className="text-[10px] font-semibold text-ink leading-tight mt-1 line-clamp-2">{p.name}</span>
                    </div>
                  ) : (
                    <div key={p.key} className="aspect-square rounded-2xl bg-ink/5 border border-dashed border-ink/15 flex items-center justify-center">
                      <span className="text-2xl text-ink/20 font-black">?</span>
                    </div>
                  ))}
                </div>
              </section>
            ))}

            {book.bonus.length > 0 && (
              <section className="rounded-3xl border border-ink/10 bg-white p-5">
                <h2 className="font-[family-name:var(--font-display)] text-ink text-2xl mb-1">✨ Bonus powers</h2>
                <p className="text-ink-muted text-xs mb-4">Extra powers found on special days — fun to collect, outside the 4 collections.</p>
                <div className="flex flex-wrap gap-2">
                  {book.bonus.map((b) => (
                    <span key={b.name} title={b.description} className="text-sm bg-brand/5 border border-brand/20 rounded-full px-3 py-1.5">{b.emoji} {b.name}</span>
                  ))}
                </div>
              </section>
            )}

            <section className="rounded-3xl border border-ink/10 bg-white p-5">
              <h2 className="font-[family-name:var(--font-display)] text-ink text-2xl mb-4">🏆 Hero levels</h2>
              <div className="grid sm:grid-cols-4 gap-3">
                {book.levels.map((l) => {
                  const reached = book.completeSets >= l.sets;
                  return (
                    <div key={l.key} className={`rounded-2xl p-4 text-center ${reached ? `bg-gradient-to-br ${LEVEL_STYLE[l.key]} text-space` : "bg-ink/5 text-ink-muted"}`}>
                      <p className="text-3xl">{l.badge}</p>
                      <p className="font-bold text-sm mt-1">{l.name}</p>
                      <p className="text-[11px] mt-1">{l.sets} collection{l.sets === 1 ? "" : "s"}</p>
                      <p className="text-[11px] mt-1 opacity-80">{l.rewardText}</p>
                      {reached && <p className="text-[11px] font-bold mt-1">✓ Unlocked</p>}
                    </div>
                  );
                })}
              </div>
              <p className="text-ink-muted text-xs mt-4">
                Powers hide in your stories on special days (usually Mon, Wed and Sat) — only for that day. Missed one? It comes round again later.
              </p>
            </section>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
