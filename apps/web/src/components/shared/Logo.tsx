interface LogoMarkProps {
  size?: number;
}

export function LogoMark({ size = 40 }: LogoMarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      {/* Deep-space background */}
      <rect width="48" height="48" rx="12" fill="#1E0B5C" />

      {/* Subtle radial glow behind hero */}
      <circle cx="24" cy="20" r="15" fill="#5B21B6" fillOpacity="0.4" />

      {/* ── Superhero-kid silhouette (bold, high-contrast gold) ───── */}

      {/* Cape — broad wings behind body */}
      <path
        d="M16 23 Q7 34 10 43 L20 37 Z"
        fill="#F59E0B"
        stroke="#111"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M32 23 Q41 34 38 43 L28 37 Z"
        fill="#F59E0B"
        stroke="#111"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {/* Body / suit */}
      <path
        d="M17 22 L31 22 L29 37 L19 37 Z"
        fill="#7C3AED"
        stroke="#111"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {/* Chest star */}
      <path
        d="M24 25.5 L25.1 28.4 L28 28.4 L25.8 30.2 L26.6 33.1 L24 31.4 L21.4 33.1 L22.2 30.2 L20 28.4 L22.9 28.4Z"
        fill="#FFE236"
        stroke="#111"
        strokeWidth="0.8"
      />

      {/* Head */}
      <circle cx="24" cy="14" r="7" fill="#FBBF24" stroke="#111" strokeWidth="1.5" />

      {/* Eyes */}
      <ellipse cx="21.5" cy="13" rx="1.4" ry="1.6" fill="#111" />
      <ellipse cx="26.5" cy="13" rx="1.4" ry="1.6" fill="#111" />
      {/* Eye gleam */}
      <circle cx="22.2" cy="12.2" r="0.5" fill="white" />
      <circle cx="27.2" cy="12.2" r="0.5" fill="white" />
      {/* Smile */}
      <path d="M21 16 Q24 18.5 27 16" stroke="#111" strokeWidth="1.2" fill="none" strokeLinecap="round" />

      {/* Mask / eye-strip */}
      <path
        d="M17 12 Q24 9.5 31 12 Q31 15.5 24 15.5 Q17 15.5 17 12Z"
        fill="#5B21B6"
        fillOpacity="0.45"
      />

      {/* ── 4-point sparkle star above head ─────────────────────── */}
      <path
        d="M24 3 L25 6 L28 6 L25.5 8 L26.5 11 L24 9.2 L21.5 11 L22.5 8 L20 6 L23 6Z"
        fill="#FFE236"
        stroke="#F59E0B"
        strokeWidth="0.5"
      />

      {/* Distant star dots */}
      <circle cx="6"  cy="8"  r="1.2" fill="#FFE236" fillOpacity="0.85" />
      <circle cx="42" cy="7"  r="0.9" fill="white"   fillOpacity="0.5" />
      <circle cx="40" cy="16" r="1"   fill="#FFE236"  fillOpacity="0.55" />
      <circle cx="5"  cy="20" r="0.8" fill="white"   fillOpacity="0.4" />
    </svg>
  );
}

interface LogoProps {
  className?: string;
}

export default function Logo({ className = "" }: LogoProps) {
  return (
    <a href="/" aria-label="HeroVerse Kids home" className={`flex items-center gap-2.5 ${className}`}>
      <LogoMark size={40} />
      <span className="leading-none">
        <span
          className="block font-[family-name:var(--font-comic)] text-[22px] tracking-wide leading-none"
          style={{
            background: "linear-gradient(135deg, #C4B5FD 0%, #A78BFA 40%, #7C3AED 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          HEROVERSE
        </span>
        <span className="block font-[family-name:var(--font-comic)] text-[14px] tracking-[0.15em] leading-none text-gold">
          KIDS
        </span>
      </span>
    </a>
  );
}
