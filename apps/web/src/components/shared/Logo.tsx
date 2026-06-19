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

export default function Logo({ className = "", iconSize = 150, animated = true }: LogoProps) {
  return (
    <a
      href="/"
      aria-label="HeroVerse Kids home"
      className={`flex items-center gap-4 ${className}`}
    >
      <LogoMark size={iconSize} animated={animated} />
      <span className="leading-none flex flex-col gap-1">
        <span
          className="block font-[family-name:var(--font-comic)] leading-none tracking-widest"
          style={{
            fontSize: "48px",
            background: "linear-gradient(135deg, #E9D5FF 0%, #C4B5FD 30%, #A78BFA 60%, #7C3AED 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            textShadow: "none",
            filter: "drop-shadow(0 0 12px rgba(167,139,250,0.5))",
          }}
        >
          HEROVERSE
        </span>
        <span
          className="block font-[family-name:var(--font-comic)] leading-none"
          style={{
            fontSize: "26px",
            letterSpacing: "0.35em",
            color: "#F59E0B",
            filter: "drop-shadow(0 0 8px rgba(245,158,11,0.6))",
          }}
        >
          KIDS
        </span>
      </span>
    </a>
  );
}
