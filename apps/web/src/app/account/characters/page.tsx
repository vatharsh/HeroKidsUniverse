"use client";

import { ExternalLink, Loader2, Pencil, Plus, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { getAccessToken } from "@/lib/api";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

interface Hero {
  id: string;
  name: string | null;
  gender: string | null;
  avatarUrl: string | null;
}

interface Character {
  id: string;
  name: string;
  role: string;
  avatarUrl: string | null;
  universeId: string | null;
  createdAt: string;
}

export default function AccountCharactersPage() {
  const [hero, setHero] = useState<Hero | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = getAccessToken();
    const h = { Authorization: `Bearer ${token}` };
    Promise.all([
      fetch(`${BASE}/heroes`,     { headers: h }).then(r => r.json()).catch(() => ({ data: [] })),
      fetch(`${BASE}/characters`, { headers: h }).then(r => r.json()).catch(() => ({ data: [] })),
    ])
      .then(([heroRes, charRes]) => {
        if (Array.isArray(heroRes.data) && heroRes.data.length > 0) setHero(heroRes.data[0] as Hero);
        if (Array.isArray(charRes.data)) setCharacters(charRes.data as Character[]);
      })
      .catch(() => setError("Failed to load characters"))
      .finally(() => setLoading(false));
  }, []);

  async function deleteChar(id: string) {
    if (!confirm("Delete this character? This cannot be undone.")) return;
    const token = getAccessToken();
    await fetch(`${BASE}/characters/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    setCharacters(prev => prev.filter(c => c.id !== id));
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-brand" /></div>;

  const total = (hero ? 1 : 0) + characters.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-ink text-2xl mb-1">My Characters</h2>
          <p className="text-ink-muted text-sm">{total} character{total !== 1 ? "s" : ""} in your universe.</p>
        </div>
        <Link href="/characters" className="flex items-center gap-2 text-sm font-semibold text-brand border border-brand/30 px-4 py-2 rounded-full hover:bg-brand/5 transition">
          <ExternalLink className="w-4 h-4" /> Manage All
        </Link>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl px-4 py-3 text-sm">{error}</div>}

      {total === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-ink/10 bg-white py-16 text-center">
          <Users className="w-10 h-10 mx-auto text-ink-muted mb-4" />
          <p className="font-[family-name:var(--font-display)] text-ink text-2xl mb-2">No characters yet</p>
          <p className="text-ink-muted text-sm mb-5">Create characters to include them in your episodes.</p>
          <Link href="/characters"
            className="inline-flex items-center gap-2 bg-brand text-white text-sm font-bold px-6 py-3 rounded-full hover:bg-brand-dark transition">
            <Plus className="w-4 h-4" /> Add Character
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {/* Hero card — always first */}
          {hero && (
            <div className="bg-white rounded-2xl border-2 border-brand/30 shadow-sm overflow-hidden hover:shadow-md transition-shadow relative">
              <div className="absolute top-2 left-2 z-10 bg-brand text-white text-[10px] font-bold px-2 py-0.5 rounded-full tracking-wide">
                HERO
              </div>
              <div className="w-full h-28 bg-gradient-to-br from-brand/20 to-purple-100 flex items-center justify-center">
                {hero.avatarUrl
                  ? <img src={hero.avatarUrl} alt={hero.name ?? "Hero"} className="w-full h-full object-cover" />
                  : <span className="text-4xl font-bold text-ink/20">{(hero.name ?? "H")[0]}</span>}
              </div>
              <div className="p-4">
                <p className="font-[family-name:var(--font-display)] text-ink text-base leading-snug">{hero.name ?? "Unnamed Hero"}</p>
                <p className="text-brand text-xs font-semibold mt-0.5 capitalize">{hero.gender ?? "Hero"}</p>
                <div className="flex items-center gap-2 mt-3 pt-2 border-t border-ink/6">
                  <Link href="/characters?editHero=1"
                    className="flex items-center gap-1 text-xs text-brand font-semibold hover:underline transition">
                    <Pencil className="w-3 h-3" /> Edit
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Supporting characters */}
          {characters.map(c => (
            <div key={c.id} className="bg-white rounded-2xl border border-ink/10 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
              <div className="w-full h-28 bg-gradient-to-br from-brand/10 to-purple-50 flex items-center justify-center">
                {c.avatarUrl
                  ? <img src={c.avatarUrl} alt={c.name} className="w-full h-full object-cover" />
                  : <span className="text-4xl font-bold text-ink/20">{c.name[0]}</span>}
              </div>
              <div className="p-4">
                <p className="font-[family-name:var(--font-display)] text-ink text-base leading-snug">{c.name}</p>
                <p className="text-ink-muted text-xs capitalize mt-0.5">{c.role}</p>
                <div className="flex items-center gap-2 mt-3 pt-2 border-t border-ink/6">
                  <Link href={`/characters?edit=${c.id}`}
                    className="flex items-center gap-1 text-xs text-brand font-semibold hover:underline transition">
                    <Pencil className="w-3 h-3" /> Edit
                  </Link>
                  <button type="button" onClick={() => deleteChar(c.id)}
                    className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 transition ml-auto">
                    <Trash2 className="w-3 h-3" /> Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
