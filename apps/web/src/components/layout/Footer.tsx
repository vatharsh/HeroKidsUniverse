import Logo from "@/components/shared/Logo";

export default function Footer() {
  return (
    <footer className="bg-space text-white">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex justify-between items-center flex-wrap gap-6 pb-6 border-b border-white/10">
          <Logo iconSize="clamp(80px, 7vw, 110px)" fit="full" animated={false} />

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

        <div className="flex justify-between items-center flex-wrap gap-4 pt-5 text-sm text-white/40">
          <p>Made with ✨ for magical childhoods</p>
          <p>© 2025 Accurate IT Solution. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
