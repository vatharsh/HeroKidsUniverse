"use client";

import { ChevronDown, Menu, Sparkles, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import Logo from "@/components/shared/Logo";

const navLinks = [
  { href: "/#how-it-works", label: "How It Works" },
  { href: "/#themes",       label: "Themes" },
  { href: "/#pricing",      label: "Pricing" },
];

const NAV_FONT = "font-[family-name:var(--font-display)]";

function UniverseIconLink({
  className = "",
  labelClassName = "",
  iconSize = "clamp(48px, 4vw, 58px)",
  onClick,
}: {
  className?: string;
  labelClassName?: string;
  iconSize?: number | string;
  onClick?: () => void;
}) {
  return (
    <a
      href="/universe"
      title="Universe"
      aria-label="Universe"
      onClick={onClick}
      className={cn(
        "group inline-flex items-center gap-2 rounded-full",
        "transition-transform duration-200 hover:scale-105 active:scale-95",
        className,
      )}
    >
      <span
        className={cn(
          "relative grid place-items-center overflow-hidden rounded-full",
          "border border-gold/45 bg-[radial-gradient(circle_at_34%_22%,rgba(253,230,138,0.42),rgba(124,58,237,0.36)_38%,rgba(11,5,32,0.98)_76%)]",
          "shadow-[inset_0_2px_12px_rgba(255,255,255,0.18),inset_0_-12px_18px_rgba(11,5,32,0.52),0_10px_24px_rgba(0,0,0,0.25),0_0_24px_rgba(245,158,11,0.22)]",
        )}
        style={{ width: iconSize, height: iconSize }}
      >
        <span className="absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.22),transparent)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        <span className="absolute left-[18%] top-[20%] h-1 w-1 rounded-full bg-white/80 shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
        <span className="absolute right-[24%] bottom-[22%] h-1.5 w-1.5 rounded-full bg-gold-light shadow-[0_0_10px_rgba(253,230,138,0.8)]" />
        <span className="absolute h-[54%] w-[54%] rounded-full bg-[radial-gradient(circle_at_35%_30%,#FDE68A_0%,#F59E0B_24%,#7C3AED_58%,#25105D_100%)] shadow-[inset_-8px_-10px_14px_rgba(11,5,32,0.45),0_0_18px_rgba(245,158,11,0.35)]" />
        <span className="absolute h-[24%] w-[78%] rotate-[-20deg] rounded-full border-2 border-gold-light/90 border-t-white/30 shadow-[0_0_12px_rgba(245,158,11,0.35)]" />
        <span className="absolute h-[24%] w-[78%] rotate-[-20deg] rounded-full border-2 border-transparent border-b-space/80" />
        <span className="absolute right-[17%] top-[21%] h-2.5 w-2.5 rounded-full bg-[#55D7FF] shadow-[inset_-2px_-2px_4px_rgba(11,5,32,0.45),0_0_10px_rgba(85,215,255,0.55)]" />
        <Sparkles className="absolute right-[11%] top-[10%] h-4 w-4 text-gold-light drop-shadow-[0_0_8px_rgba(253,230,138,0.8)]" />
      </span>
      <span className={cn("sr-only", labelClassName)}>Universe</span>
    </a>
  );
}

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pathname = usePathname();
  const { user } = useAuth();
  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const showSolid = isScrolled;

  // First letter of name for avatar
  const initial = user?.name?.[0]?.toUpperCase() ?? "?";

  return (
    <nav
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        showSolid && "bg-space/95 backdrop-blur-md border-b border-white/10",
      )}
    >
      <div className="max-w-7xl mx-auto px-6 h-24 md:h-28 flex items-center justify-between">
        <Logo iconSize="clamp(94px, 7.2vw, 121px)" />

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-10">
          {pathname === "/" && navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={cn(NAV_FONT, "text-white/80 hover:text-gold text-2xl tracking-wide transition-colors duration-200")}
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Desktop right side */}
        <div className="hidden md:flex items-center gap-5">
          {user ? (
            <>
              <UniverseIconLink className="mr-1" />
              {user.role !== "influencer" && (
                <a
                  href="/dashboard"
                  className={cn(NAV_FONT, "text-white/70 hover:text-white text-lg px-3 py-1.5 transition-colors duration-200")}
                >
                  Dashboard
                </a>
              )}
              {/* User avatar + name → account */}
              <a
                href={user.role === "influencer" ? "/influencer/dashboard" : "/account"}
                className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border border-white/15 hover:border-white/35 hover:bg-white/8 transition-all duration-200 group"
                title="My Account"
              >
                <span className={cn(NAV_FONT, "w-9 h-9 rounded-full bg-brand flex items-center justify-center text-white text-base ring-2 ring-brand/40 group-hover:ring-brand/70 transition-all")}>
                  {initial}
                </span>
                <span className={cn(NAV_FONT, "text-lg text-white/85 group-hover:text-white transition-colors")}>{user.name.split(" ")[0]}</span>
                <ChevronDown className="w-3.5 h-3.5 text-white/40 group-hover:text-white/70 transition-colors" />
              </a>
            </>
          ) : (
            <>
              <a
                href="/login"
                className={cn(NAV_FONT, "text-white/80 hover:text-white text-xl px-4 py-1.5 transition-colors duration-200")}
              >
                Login
              </a>
              <a
                href="/create"
                className={cn(NAV_FONT, "bg-brand hover:bg-brand-dark text-white text-xl px-6 py-2.5 rounded-full shadow-brand transition-all hover:scale-105")}
              >
                ✨ Create Story
              </a>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          type="button"
          className="md:hidden text-white"
          aria-label="Toggle navigation menu"
          aria-expanded={isMenuOpen}
          onClick={() => setIsMenuOpen((open) => !open)}
        >
          {isMenuOpen ? <X className="w-7 h-7" /> : <Menu className="w-7 h-7" />}
        </button>
      </div>

      {/* Mobile menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-space/95 backdrop-blur border-b border-white/10">
          <div className="px-6 py-5 flex flex-col gap-5">
            {pathname === "/" && navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={cn(NAV_FONT, "text-white/80 hover:text-gold text-xl transition-colors")}
                onClick={() => setIsMenuOpen(false)}
              >
                {link.label}
              </a>
            ))}
            {user ? (
              <>
                <UniverseIconLink className="self-start" onClick={() => setIsMenuOpen(false)} />
                <a href={user.role === "influencer" ? "/influencer/dashboard" : "/account"} className={cn(NAV_FONT, "text-white/80 hover:text-white text-xl")}>
                  My Account
                </a>
                <a href="/dashboard" className={cn(NAV_FONT, "text-white/80 hover:text-white text-xl")}>
                  Dashboard
                </a>
              </>
            ) : (
              <>
                <a href="/login" className={cn(NAV_FONT, "text-white/80 hover:text-white text-xl")}>
                  Login
                </a>
                <a
                  href="/create"
                  className={cn(NAV_FONT, "bg-brand hover:bg-brand-dark text-white text-xl px-7 py-2.5 rounded-full shadow-brand transition text-center")}
                >
                  ✨ Create Story
                </a>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
