export default function Footer() {
  return (
    <footer className="bg-space text-white">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="flex justify-between items-center flex-wrap gap-6 pb-10 border-b border-white/10">
          <a href="/" aria-label="HeroVerse Kids home">
            <span className="font-[family-name:var(--font-display)] font-black text-2xl">
              <span className="text-gradient-brand">HeroVerse</span>
              <span className="text-gold ml-1">Kids</span>
            </span>
          </a>

          <div className="flex gap-6">
            <a href="/privacy" className="text-white/50 hover:text-white text-sm transition">
              Privacy
            </a>
            <a href="/terms" className="text-white/50 hover:text-white text-sm transition">
              Terms
            </a>
            <a href="/contact" className="text-white/50 hover:text-white text-sm transition">
              Contact
            </a>
          </div>
        </div>

        <div className="flex justify-between items-center flex-wrap gap-4 pt-8 text-sm text-white/40">
          <p>Made with ✨ for magical childhoods</p>
          <p>© 2025 HeroVerse Kids. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
