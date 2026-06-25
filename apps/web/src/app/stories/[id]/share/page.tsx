"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

interface StoryPage {
  pageNumber: number;
  text: string;
  imageUrl?: string;
}

interface Story {
  id: string;
  title: string | null;
  theme: string;
  pages: StoryPage[];
  coverImageUrl: string | null;
  hero: { name: string; age: number; gender: string; avatarUrl: string | null };
}

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

export default function StorySharePage() {
  const { id } = useParams<{ id: string }>();

  const [story, setStory]     = useState<Story | null>(null);
  const [error, setError]     = useState("");
  const [page, setPage]       = useState(0);
  const [copied, setCopied]   = useState(false);

  useEffect(() => {
    fetch(`${BASE}/stories/${id}/public`)
      .then(async (res) => {
        if (!res.ok) { setError("This story isn't available."); return; }
        const { data } = await res.json();
        setStory(data);
      })
      .catch(() => setError("Failed to load story."));
  }, [id]);

  function handleCopyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (error) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <p className="text-5xl mb-4">😢</p>
          <p className="text-ink font-semibold mb-6">{error}</p>
          <a href="/register"
            className="bg-brand text-white font-bold px-6 py-3 rounded-full inline-block hover:bg-brand-dark transition">
            Create Your Own Story →
          </a>
        </div>
      </div>
    );
  }

  if (!story) {
    return (
      <div className="min-h-screen bg-space-gradient flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-bounce">✨</div>
          <p className="text-white text-lg">Loading story…</p>
        </div>
      </div>
    );
  }

  const totalPages = story.pages.length;
  const currentPage = story.pages[page];
  const isLastPage = page === totalPages - 1;

  const panelIdx = Math.min(currentPage?.pageNumber ?? page + 1, 8);
  const src = currentPage?.imageUrl ?? `/story-panels/page_${panelIdx}.png`;

  return (
    <div className="min-h-screen bg-space-gradient flex flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-4 bg-space/80 backdrop-blur border-b border-white/10">
        <a href="/"
          className="font-[family-name:var(--font-display)] text-white text-base hover:text-gold transition">
          HeroVerse ✨
        </a>
        <div className="flex items-center gap-3">
          <span className="text-white/40 text-sm">{page + 1} / {totalPages}</span>
          <button
            type="button"
            onClick={handleCopyLink}
            className="text-xs font-semibold bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-full transition flex items-center gap-2"
          >
            {copied ? "✓ Copied!" : "Share Link"}
          </button>
        </div>
      </header>

      {/* Story title + hero */}
      <div className="text-center px-6 pt-6 pb-2">
        <p className="text-white/50 text-xs uppercase tracking-widest mb-1">
          {story.hero?.name}&apos;s Adventure
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-white text-2xl md:text-3xl line-clamp-2">
          {story.title ?? "A Magical Story"}
        </h1>
      </div>

      {/* Page content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-6 gap-6 max-w-lg mx-auto w-full">
        <div className="w-full bg-white rounded-3xl shadow-[0_8px_40px_rgba(0,0,0,0.4)] overflow-hidden">
          {/* Panel image */}
          <div className="relative w-full overflow-hidden" style={{ aspectRatio: "376/499" }}>
            <div
              className="absolute inset-0 scale-110"
              style={{
                backgroundImage: `url(${src})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                filter: "blur(14px) brightness(0.5)",
              }}
            />
            <img src={src} alt={`Page ${page + 1}`}
              className="absolute inset-0 w-full h-full object-contain z-10" />
            <div className="absolute top-3 left-3 z-20 bg-gold text-space font-[family-name:var(--font-comic)] text-xs font-bold px-3 py-1 rounded-full shadow">
              PAGE {page + 1}
            </div>
            <div className="absolute top-3 right-3 z-20 bg-black/40 backdrop-blur text-white text-xs font-semibold px-3 py-1 rounded-full">
              {story.hero?.name}
            </div>
          </div>

          {/* Story text */}
          <div className="px-7 py-6">
            <p className="font-[family-name:var(--font-body)] text-ink text-xl leading-relaxed text-center">
              {currentPage?.text}
            </p>
            {isLastPage && (
              <p className="font-[family-name:var(--font-display)] text-brand text-2xl text-center mt-4">
                ✨ The End ✨
              </p>
            )}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-6 w-full justify-center">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-20 text-white text-2xl flex items-center justify-center transition"
          >
            ‹
          </button>

          <div className="flex gap-2 flex-wrap justify-center">
            {story.pages.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setPage(i)}
                className={`rounded-full transition-all ${i === page ? "w-5 h-2.5 bg-gold" : "w-2.5 h-2.5 bg-white/25 hover:bg-white/50"}`}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page === totalPages - 1}
            className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-20 text-white text-2xl flex items-center justify-center transition"
          >
            ›
          </button>
        </div>

        {/* CTA — always visible at bottom */}
        <div className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-5 text-center mt-2">
          <p className="text-white/60 text-sm mb-1">Want your child to be the hero?</p>
          <p className="font-[family-name:var(--font-display)] text-white text-lg mb-4">
            Create a free personalised story in 60 seconds
          </p>
          <a
            href="/register"
            className="bg-brand hover:bg-brand-dark text-white font-[family-name:var(--font-display)] text-base px-8 py-3 rounded-full transition hover:scale-105 shadow-brand inline-block"
          >
            Start Free →
          </a>
          <p className="text-white/30 text-xs mt-3">No credit card · First story free</p>
        </div>
      </main>
    </div>
  );
}
