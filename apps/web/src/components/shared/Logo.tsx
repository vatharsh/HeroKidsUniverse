import Image from "next/image";
// logo.png lives at the monorepo root — imported as a static asset
import logoSrc from "../../../../../logo.png";

interface LogoProps {
  className?: string;
  iconSize?: number;
  animated?: boolean;
}

export function LogoMark({ size = 132, animated = true }: { size?: number; animated?: boolean }) {
  return (
    <Image
      src={logoSrc}
      alt="HeroVerse Kids logo"
      width={size}
      height={size}
      priority
      className={animated ? "logo-fly" : ""}
      style={{ objectFit: "contain" }}
    />
  );
}

export default function Logo({ className = "", iconSize = 132, animated = true }: LogoProps) {
  return (
    <a
      href="/"
      aria-label="HeroVerse Kids home"
      className={`flex items-center gap-3 ${className}`}
    >
      <LogoMark size={iconSize} animated={animated} />
      <span className="leading-none">
        <span
          className="block font-[family-name:var(--font-comic)] leading-none tracking-wide"
          style={{
            fontSize: "clamp(17px, 2vw, 22px)",
            background: "linear-gradient(135deg, #C4B5FD 0%, #A78BFA 35%, #7C3AED 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          HEROVERSE
        </span>
        <span
          className="block font-[family-name:var(--font-comic)] text-gold leading-none"
          style={{ fontSize: "clamp(11px, 1.3vw, 14px)", letterSpacing: "0.2em" }}
        >
          KIDS
        </span>
      </span>
    </a>
  );
}
