"use client";

import { ChevronDown, Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import Logo from "@/components/shared/Logo";
import UniverseBubbleIcon from "@/components/layout/UniverseBubbleIcon";

const navLinks = [
  { href: "/#how-it-works", label: "How It Works" },
  { href: "/#themes",       label: "Themes" },
  { href: "/#pricing",      label: "Pricing" },
];

const NAV_FONT = "font-[family-name:var(--font-display)]";

function UniverseIconLink({
  className = "",
  labelClassName = "",
  iconSize = 42,
  onClick,
}: {
  className?: string;
  labelClassName?: string;
  iconSize?: number | string;
  onClick?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <a
      href="/universe"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title="My Universe — your hero's worlds, friends, powers and story timeline"
      onClick={onClick}
      className={cn(
        // No frame around it — just the icon and the words, like the other header links.
        "group relative overflow-hidden inline-flex items-center gap-1.5 py-0.5 pr-1",
        "transition-transform duration-200 hover:scale-[1.03] active:scale-95",
        className,
      )}
    >
      <span className="uni-anim relative animate-[uniBreathe_4s_ease-in-out_infinite]">
        <UniverseBubbleIcon size={typeof iconSize === "number" ? iconSize : 42} fast={hovered} />
      </span>
      <span className={cn(NAV_FONT, "text-lg leading-none text-white/85 group-hover:text-gold-light whitespace-nowrap transition-colors", labelClassName)}>My Universe</span>
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
