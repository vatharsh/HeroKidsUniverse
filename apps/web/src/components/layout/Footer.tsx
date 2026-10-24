import Logo from "@/components/shared/Logo";

/** Indian national flag, 3:2, with the 24-spoke Ashoka Chakra (diameter ¾ of the white band). */
function IndianFlag() {
  const spokes = Array.from({ length: 24 }, (_, i) => (i * 360) / 24);
  return (
    <svg aria-hidden viewBox="0 0 900 600" className="h-4 w-6 rounded-[2px]">
      <rect width="900" height="200" fill="#FF9933" />
      <rect y="200" width="900" height="200" fill="#FFFFFF" />
      <rect y="400" width="900" height="200" fill="#138808" />
      <g transform="translate(450 300)" stroke="#000080" fill="none">
        <circle r="75" strokeWidth="10" />
        <circle r="13" fill="#000080" stroke="none" />
        {spokes.map((deg) => (
          <line key={deg} x1="0" y1="0" x2="0" y2="-73" strokeWidth="4" transform={`rotate(${deg})`} />
        ))}
      </g>
    </svg>
  );
}

export default function Footer() {
  return (
    <footer className="bg-space text-white">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex justify-between items-center flex-wrap gap-6 pb-6 border-b border-white/10">
          <Logo iconSize="clamp(80px, 7vw, 110px)" fit="full" animated={false} />

          <div className="flex items-center gap-6 flex-wrap">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/80">
              <IndianFlag />
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
          <p>
            © {new Date().getFullYear()}{" "}
            <a href="https://accurateitsolution.in/" target="_blank" rel="noopener noreferrer" className="text-white/60 hover:text-white underline-offset-2 hover:underline transition">
              Accurate IT Solution
            </a>
            . All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
