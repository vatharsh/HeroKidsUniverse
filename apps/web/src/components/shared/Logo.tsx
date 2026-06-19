interface LogoMarkProps {
  size?: number;
}

export function LogoMark({ size = 40 }: LogoMarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <rect width="40" height="40" rx="11" fill="#7C3AED" />
      {/* Open book — left page */}
      <path
        d="M7 27.5 L7 15 Q13.5 12.5 20 14 L20 27 Q13.5 25 7 27.5 Z"
        fill="white"
        fillOpacity="0.85"
      />
      {/* Open book — right page */}
      <path
        d="M33 27.5 L33 15 Q26.5 12.5 20 14 L20 27 Q26.5 25 33 27.5 Z"
        fill="white"
      />
      {/* Spine crease */}
      <line x1="20" y1="14" x2="20" y2="27" stroke="#7C3AED" strokeWidth="1.5" strokeOpacity="0.35" />
      {/* Gold 4-point star above */}
      <path
        d="M20 4 L21 8 L25 8.8 L21 9.6 L20 13 L19 9.6 L15 8.8 L19 8 Z"
        fill="#F59E0B"
      />
    </svg>
  );
}

interface LogoProps {
  size?: number;
  className?: string;
}

export default function Logo({ className = "" }: LogoProps) {
  return (
    <a href="/" aria-label="HeroVerse Kids home" className={`flex items-center gap-2.5 ${className}`}>
      <LogoMark size={36} />
      <span className="font-[family-name:var(--font-display)] font-black text-2xl leading-none">
        <span className="text-gradient-brand">HeroVerse</span>
        <span className="text-gold ml-1">Kids</span>
      </span>
    </a>
  );
}
