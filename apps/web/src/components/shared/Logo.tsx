interface LogoMarkProps {
  size?: number;
  animated?: boolean;
}

export function LogoMark({ size = 54, animated = true }: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      fill="none"
      aria-hidden="true"
      className={animated ? "logo-fly" : ""}
    >
      <defs>
        {/* 3-D sphere background — lighter top-left, dark bottom-right */}
        <radialGradient id="lm-bg" cx="0.32" cy="0.28" r="0.72">
          <stop offset="0%"   stopColor="#3B1B9E" />
          <stop offset="55%"  stopColor="#1A0860" />
          <stop offset="100%" stopColor="#07021E" />
        </radialGradient>

        {/* Cape: Superman red → HeroVerse purple */}
        <linearGradient id="lm-cape" x1="0" y1="0" x2="1" y2="0.6">
          <stop offset="0%"   stopColor="#DC2626" />
          <stop offset="42%"  stopColor="#7C3AED" />
          <stop offset="100%" stopColor="#312E81" />
        </linearGradient>

        {/* Cape fold shadow */}
        <linearGradient id="lm-cape-shadow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="white"   stopOpacity="0.18" />
          <stop offset="100%" stopColor="black"   stopOpacity="0.28" />
        </linearGradient>

        {/* Metallic rim */}
        <linearGradient id="lm-rim" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="#C4B5FD" stopOpacity="0.9" />
          <stop offset="35%"  stopColor="#7C3AED" stopOpacity="0.4" />
          <stop offset="70%"  stopColor="#4C1D95" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#A78BFA" stopOpacity="0.7" />
        </linearGradient>

        {/* Skin shading — fist + face */}
        <radialGradient id="lm-skin" cx="0.35" cy="0.3" r="0.7">
          <stop offset="0%"   stopColor="#FDE68A" />
          <stop offset="100%" stopColor="#D97706" />
        </radialGradient>

        {/* Suit */}
        <linearGradient id="lm-suit" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#1E1B4B" />
          <stop offset="100%" stopColor="#0F0D2E" />
        </linearGradient>

        {/* Clip to badge circle */}
        <clipPath id="lm-clip">
          <circle cx="40" cy="40" r="36.5" />
        </clipPath>
      </defs>

      {/* ── Outer dark ring (depth / cast shadow) ─────────────────── */}
      <circle cx="40" cy="41" r="38" fill="black" fillOpacity="0.45" />

      {/* ── Main badge sphere ─────────────────────────────────────── */}
      <circle cx="40" cy="40" r="37" fill="url(#lm-bg)" />

      {/* ── All artwork clipped to badge circle ───────────────────── */}
      <g clipPath="url(#lm-clip)">

        {/* Background stars */}
        <circle cx="58" cy="10" r="1.3" fill="white"   fillOpacity="0.55" />
        <circle cx="70" cy="22" r="0.9" fill="white"   fillOpacity="0.35" />
        <circle cx="12" cy="15" r="1.5" fill="#FFE236" fillOpacity="0.65" />
        <circle cx="68" cy="58" r="1"   fill="white"   fillOpacity="0.4"  />
        <circle cx="10" cy="52" r="0.8" fill="#FFE236" fillOpacity="0.45" />
        <circle cx="72" cy="40" r="1.1" fill="white"   fillOpacity="0.3"  />
        <circle cx="22" cy="68" r="0.9" fill="white"   fillOpacity="0.3"  />
        <circle cx="55" cy="72" r="1.2" fill="#FFE236" fillOpacity="0.5"  />

        {/* Speed streaks (flying-left motion, behind hero) */}
        <g className="logo-streak">
          <line x1="2"  y1="28" x2="20" y2="27.2" stroke="white" strokeWidth="1.2" strokeOpacity="0.6" strokeLinecap="round" />
          <line x1="2"  y1="33" x2="17" y2="32.4" stroke="white" strokeWidth="0.8" strokeOpacity="0.5" strokeLinecap="round" />
          <line x1="2"  y1="38" x2="13" y2="37.5" stroke="white" strokeWidth="0.6" strokeOpacity="0.4" strokeLinecap="round" />
        </g>

        {/* ── CAPE (largest element, fills right 60%) ──────────────── */}
        {/* Main cape body */}
        <path
          d="M 28 33
             L 25 25
             Q 44 10 74 12
             Q 84 24 82 44
             Q 80 64 66 74
             Q 44 82 26 70
             L 29 58
             Q 34 52 34 48
             L 34 42
             Q 31 38 28 33 Z"
          fill="url(#lm-cape)"
        />
        {/* Cape fold highlight (top edge lit from above) */}
        <path
          d="M 27 27 Q 48 12 74 14"
          fill="none" stroke="white" strokeWidth="1.8" strokeOpacity="0.22" strokeLinecap="round"
        />
        {/* Cape inner fold (depth crease along shoulder) */}
        <path
          d="M 29 36 Q 36 40 36 48"
          fill="none" stroke="black" strokeWidth="1.2" strokeOpacity="0.3" strokeLinecap="round"
        />
        {/* Batman scalloped bottom edge (3 points) */}
        <path
          d="M 30 60 Q 36 68 42 62 Q 46 70 52 64 Q 56 72 62 66 Q 66 74 70 68"
          fill="none" stroke="#07021E" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"
        />

        {/* ── BODY / SUIT ──────────────────────────────────────────── */}
        <path
          d="M 28 34 Q 36 30 46 32 Q 54 34 56 42 Q 48 50 36 49 Q 29 47 28 41 Z"
          fill="url(#lm-suit)"
          stroke="#111" strokeWidth="0.8"
        />
        {/* Suit top-edge highlight */}
        <path
          d="M 30 34 Q 40 31 50 33"
          fill="none" stroke="white" strokeWidth="1" strokeOpacity="0.18" strokeLinecap="round"
        />

        {/* ── CHEST EMBLEM — 5-point star (Superman ✕ HeroVerse) ──── */}
        <path
          d="M 40 33 L 41.6 38 L 47 38 L 42.7 41 L 44.3 46 L 40 43 L 35.7 46 L 37.3 41 L 33 38 L 38.4 38 Z"
          fill="#FFE236" fillOpacity="0.92" stroke="#B45309" strokeWidth="0.6"
        />

        {/* ── EXTENDED ARM + FIST (Superman flying fist) ───────────── */}
        {/* Sleeve */}
        <path
          d="M 28 34 Q 18 28 8 22"
          stroke="#1E1B4B" strokeWidth="8" strokeLinecap="round" fill="none"
        />
        {/* Arm highlight */}
        <path
          d="M 28 32 Q 19 26 10 21"
          stroke="white" strokeWidth="1.5" strokeLinecap="round" fill="none" strokeOpacity="0.12"
        />
        {/* Glove */}
        <circle cx="7" cy="21" r="7.5" fill="url(#lm-skin)" stroke="#1E1B4B" strokeWidth="1.5" />
        {/* Knuckle fold */}
        <path
          d="M 4 19.5 Q 7 17 10 19.5"
          stroke="#92400E" strokeWidth="1" fill="none" strokeOpacity="0.55" strokeLinecap="round"
        />
        {/* Thumb hint */}
        <ellipse cx="5" cy="24" rx="2.5" ry="1.8" fill="#FBBF24" fillOpacity="0.7" transform="rotate(-30,5,24)" />

        {/* ── HEAD ─────────────────────────────────────────────────── */}
        <circle cx="22" cy="36" r="11" fill="url(#lm-skin)" stroke="#1E1B4B" strokeWidth="1.5" />
        {/* Face highlight (3D) */}
        <ellipse cx="17" cy="30" rx="4.5" ry="3.5" fill="white" fillOpacity="0.2" />

        {/* ── BATMAN COWL (on top of head) ─────────────────────────── */}
        {/* Cowl base covers upper 60% of head */}
        <path
          d="M 11 37 Q 11 23 22 21 Q 33 23 33 37 Q 29 41.5 22 42 Q 15 41.5 11 37 Z"
          fill="#111827"
        />
        {/* LEFT bat ear — tall and pointed */}
        <polygon points="14,27  9,10  21,27"  fill="#111827" />
        <polygon points="14,27  9,10  21,27"  fill="url(#lm-suit)" fillOpacity="0.3" />
        {/* RIGHT bat ear */}
        <polygon points="30,27  35,10  23,27" fill="#111827" />
        <polygon points="30,27  35,10  23,27" fill="url(#lm-suit)" fillOpacity="0.3" />
        {/* Ear edge highlights */}
        <line x1="10" y1="11" x2="17" y2="27" stroke="#3730A3" strokeWidth="0.8" strokeOpacity="0.5" />
        <line x1="34" y1="11" x2="27" y2="27" stroke="#3730A3" strokeWidth="0.8" strokeOpacity="0.5" />

        {/* Eye slits (Batman yellow) */}
        <ellipse cx="17" cy="33.5" rx="4"   ry="2.2" fill="#FFE236" />
        <ellipse cx="27" cy="33.5" rx="4"   ry="2.2" fill="#FFE236" />
        {/* Eye inner glow */}
        <ellipse cx="16" cy="32.8" rx="1.8" ry="1"   fill="white"   fillOpacity="0.5" />
        <ellipse cx="26" cy="32.8" rx="1.8" ry="1"   fill="white"   fillOpacity="0.5" />

        {/* Lower face (chin strap / jaw visible) */}
        <path
          d="M 13 38 Q 15 44 22 45 Q 29 44 31 38"
          fill="#FBBF24" fillOpacity="0.85"
          stroke="#111827" strokeWidth="1.2"
        />
        {/* Kid smile */}
        <path
          d="M 18 41.5 Q 22 44 26 41.5"
          stroke="#92400E" strokeWidth="1.2" fill="none" strokeOpacity="0.7" strokeLinecap="round"
        />

        {/* Cowl top highlight */}
        <ellipse cx="19" cy="23" rx="5" ry="3" fill="white" fillOpacity="0.12" transform="rotate(-15,19,23)" />

        {/* ── TRAILING BOOTS (peeking from cape edge) ──────────────── */}
        <rect x="66" y="32" width="10" height="14" rx="4" fill="#1E1B4B" stroke="#111" strokeWidth="1" />
        <rect x="64" y="48" width="10" height="14" rx="4" fill="#1E1B4B" stroke="#111" strokeWidth="1" />
        {/* Boot sole glint */}
        <line x1="67" y1="43" x2="74" y2="43" stroke="white" strokeWidth="0.7" strokeOpacity="0.2" />
        <line x1="65" y1="59" x2="72" y2="59" stroke="white" strokeWidth="0.7" strokeOpacity="0.2" />

      </g>{/* end clip */}

      {/* ── Metallic rim (rendered over clip) ─────────────────────── */}
      <circle cx="40" cy="40" r="37" fill="none" stroke="url(#lm-rim)" strokeWidth="3.5" />

      {/* Top-left specular shine (3D convex lens) */}
      <ellipse cx="23" cy="19" rx="11" ry="8" fill="white" fillOpacity="0.12" transform="rotate(-30,23,19)" />

      {/* Bottom-right ambient occlusion shadow */}
      <ellipse cx="57" cy="60" rx="14" ry="9" fill="black" fillOpacity="0.18" />
    </svg>
  );
}

/* ── Wordmark ──────────────────────────────────────────────────────── */
interface LogoProps {
  className?: string;
  iconSize?: number;
  animated?: boolean;
}

export default function Logo({ className = "", iconSize = 54, animated = true }: LogoProps) {
  return (
    <a
      href="/"
      aria-label="HeroVerse Kids home"
      className={`flex items-center gap-3 group ${className}`}
    >
      <LogoMark size={iconSize} animated={animated} />
      <span className="leading-none">
        <span
          className="block font-[family-name:var(--font-comic)] tracking-wide leading-none"
          style={{
            fontSize: "clamp(18px, 2.2vw, 24px)",
            background: "linear-gradient(135deg, #C4B5FD 0%, #A78BFA 35%, #7C3AED 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          HEROVERSE
        </span>
        <span
          className="block font-[family-name:var(--font-comic)] text-gold leading-none tracking-[0.18em]"
          style={{ fontSize: "clamp(12px, 1.4vw, 15px)" }}
        >
          KIDS
        </span>
      </span>
    </a>
  );
}
