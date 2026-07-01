"use client";

import { ExternalLink, Loader2, Star } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { getAccessToken } from "@/lib/api";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

interface Universe {
  id: string;
  name: string;
  heroTitle: string | null;
  tagline: string | null;
  coverImageUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function AccountUniversesPage() {
  const [universes, setUniverses] = useState<Universe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = getAccessToken();
    fetch(`${BASE}/universes/mine`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(b => {
        const data = b.data;
        setUniverses(Array.isArray(data) ? data : data ? [data] : []);
      })
      .catch(() => setError("Failed to load universes"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-brand" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-ink text-2xl mb-1">My Universes</h2>
          <p className="text-ink-muted text-sm">Your living story universes — each one grows with every episode.</p>
        </div>
        <Link href="/universe"
          className="flex items-center gap-2 text-sm font-semibold text-brand border border-brand/30 px-4 py-2 rounded-full hover:bg-brand/5 transition">
          <ExternalLink className="w-4 h-4" /> Open Universe
        </Link>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl px-4 py-3 text-sm">{error}</div>}

      {universes.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-ink/10 bg-white py-16 text-center">
          <Star className="w-10 h-10 mx-auto text-ink-muted mb-4" />
          <p className="font-[family-name:var(--font-display)] text-ink text-2xl mb-2">No universes yet</p>
          <p className="text-ink-muted text-sm mb-5">Start creating your child&apos;s living hero universe.</p>
          <Link href="/create"
            className="inline-flex items-center gap-2 bg-brand text-white text-sm font-bold px-6 py-3 rounded-full hover:bg-brand-dark transition">
            Create First Universe
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {universes.map(u => (
            <div key={u.id} className="bg-white rounded-2xl border border-ink/10 shadow-card overflow-hidden hover:shadow-lg transition-shadow">
              <div className="bg-gradient-to-br from-space to-brand/40 h-28 flex items-center justify-center">
                {u.coverImageUrl
                  ? <img src={u.coverImageUrl} alt={u.name} className="w-full h-full object-cover" />
                  : <span className="text-5xl opacity-60">🌌</span>}
              </div>
              <div className="p-5">
                <p className="font-[family-name:var(--font-display)] text-ink text-lg">{u.name}</p>
                {u.heroTitle && <p className="text-brand text-xs font-semibold mt-0.5">🦸 {u.heroTitle}</p>}
                {u.tagline && <p className="text-ink-muted text-xs mt-1 italic line-clamp-2">{u.tagline}</p>}
                <p className="text-ink-muted text-xs mt-2">
                  Last updated {new Date(u.updatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </p>
                <Link href="/universe"
                  className="mt-4 flex items-center gap-1 text-sm font-semibold text-brand hover:text-brand-dark transition">
                  Open Universe <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
