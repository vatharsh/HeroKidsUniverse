import Logo from "@/components/shared/Logo";

export default function Footer() {
  return (
    <footer className="bg-space text-white">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex justify-between items-center flex-wrap gap-6 pb-6 border-b border-white/10">
          <Logo iconSize="clamp(80px, 7vw, 110px)" fit="full" animated={false} />

          <div className="flex items-center gap-6 flex-wrap">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/80">
              <span aria-hidden className="flex h-3 w-4 flex-col overflow-hidden rounded-[2px]">
                <span className="flex-1 bg-[#FF9933]" />
                <span className="flex-1 bg-white" />
                <span className="flex-1 bg-[#138808]" />
              </span>
              Proudly Made in India
            </span>
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
          <p>Made with ✨ for magical childhoods · Stories, pictures and narration are AI-generated</p>
          <p>© {new Date().getFullYear()} Accurate IT Solution. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
