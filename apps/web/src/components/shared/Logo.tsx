import Image from "next/image";
import logoSrc from "../../../../../Hero-Kids-Universe-1.png";

import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  iconSize?: number | string;
  animated?: boolean;
  fit?: "nav" | "full";
}

export function LogoMark({
  size = 136,
  animated = true,
  fit = "nav",
}: {
  size?: number | string;
  animated?: boolean;
  fit?: "nav" | "full";
}) {
  return (
    <span
      className={cn(
        "logo-3d relative inline-flex shrink-0 items-center justify-center rounded-full",
        "border border-gold/30 bg-space/55 p-0.5 shadow-[inset_0_2px_8px_rgba(255,255,255,0.12),inset_0_-8px_20px_rgba(11,5,32,0.45),0_14px_30px_rgba(0,0,0,0.28),0_0_22px_rgba(124,58,237,0.34)]",
        animated && "logo-fly",
      )}
      style={{ width: size, height: size }}
    >
      <span className="absolute inset-0 rounded-full border border-white/10" />
      <span className="absolute left-2 right-2 top-1 h-3 rounded-full bg-white/15 blur-sm" />
      <span className="relative z-10 h-full w-full overflow-hidden rounded-full flex items-center justify-center">
        <Image
          src={logoSrc}
          alt="Hero Kids Universe logo"
          width={1254}
          height={1254}
          priority
          sizes="160px"
          className={cn(
            "object-contain",
            fit === "nav" ? "h-[96%] w-auto" : "h-[100%] w-auto",
          )}
        />
      </span>
    </span>
  );
}

export default function Logo({
  className = "",
  iconSize = 136,
  animated = true,
  fit = "nav",
}: LogoProps) {
  return (
    <a
      href="/"
      aria-label="Hero Kids Universe home"
      className={cn("flex items-center", className)}
    >
      <LogoMark size={iconSize} animated={animated} fit={fit} />
    </a>
  );
}
