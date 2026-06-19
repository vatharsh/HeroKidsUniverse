"use client";

import Footer from "@/components/layout/Footer";
import Navbar from "@/components/layout/Navbar";

const stories: { id: string }[] = [];

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-cream flex flex-col">
      <Navbar />

      <header className="bg-space-gradient py-20 text-center">
        <h1 className="font-[family-name:var(--font-display)] font-black text-white text-4xl md:text-5xl mb-3">
          Your Story Library
        </h1>
        <p className="text-white/60 text-lg">Every story, forever yours</p>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-6 py-12 w-full">
        {stories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-8xl mb-6">📚</div>
            <h3 className="font-[family-name:var(--font-display)] font-bold text-ink text-2xl mb-3">
              No stories yet
            </h3>
            <p className="text-ink-muted mb-8 max-w-sm">
              Create your first personalized story and it will appear here.
            </p>
            <a
              href="/create"
              className="bg-brand text-white font-bold px-8 py-3.5 rounded-full shadow-brand hover:bg-brand-dark transition-all hover:scale-105"
            >
              Create First Story →
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {stories.map((story) => (
              <div key={story.id} className="bg-white rounded-2xl shadow-card overflow-hidden">
                <div className="aspect-video bg-gradient-to-br from-brand-100 to-brand flex items-center justify-center">
                  <span className="text-5xl">📖</span>
                </div>
                <div className="p-5">
                  <h3 className="font-[family-name:var(--font-display)] font-bold text-ink mb-2">
                    Arjun&apos;s Space Adventure
                  </h3>
                  <span className="inline-block bg-brand-50 text-brand text-xs font-semibold px-2.5 py-0.5 rounded-full mb-4">
                    🚀 Space Adventure
                  </span>
                  <div className="flex gap-3 flex-wrap">
                    <a
                      href="/story/demo"
                      className="text-ink-muted hover:text-brand text-sm font-medium flex items-center gap-1.5 transition"
                    >
                      📥 Download PDF
                    </a>
                    <a
                      href="/story/demo"
                      className="text-ink-muted hover:text-brand text-sm font-medium flex items-center gap-1.5 transition"
                    >
                      ▶ Play Story
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
