"use client";

import Image from "next/image";
import { Menu, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import Logo from "@/components/shared/Logo";
import universeIconSrc from "../../../../../universe.png";

const navLinks = [
  { href: "/#how-it-works", label: "How It Works" },
  { href: "/#themes",       label: "Themes" },
  { href: "/#pricing",      label: "Pricing" },
];

const NAV_FONT = "font-[family-name:var(--font-display)]";

function UniverseIconLink({
  className = "",
  labelClassName = "",
  iconSize = "clamp(72px, 5.8vw, 96px)",
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
        "inline-flex items-center justify-center rounded-full overflow-hidden",
        "transition-transform duration-200 hover:scale-105",
        "logo-3d animate-float-slow",
        className,
      )}
    >
      <span className="relative block overflow-hidden rounded-full" style={{ width: iconSize, height: iconSize }}>
        <Image
          src={universeIconSrc}
          alt=""
          fill
          sizes={typeof iconSize === "number" ? `${iconSize}px` : "121px"}
          className="object-cover scale-[1.45]"
        />
      </span>
      <span className={cn("sr-only", labelClassName)}>Universe</span>
    </a>
  );
}

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const showSolid = isScrolled;

  async function handleLogout() {
    await logout();
    router.push("/");
  }

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
                  href="/dashboard/orders"
                  className={cn(NAV_FONT, "text-white/70 hover:text-white text-lg px-3 py-1.5 transition-colors duration-200")}
                >
                  My Orders
                </a>
              )}
              {/* User avatar + name */}
              <a
                href={user.role === "influencer" ? "/influencer/dashboard" : "/dashboard"}
                className="flex items-center gap-2.5 text-white/80 hover:text-white transition-colors"
              >
                <span className={cn(NAV_FONT, "w-10 h-10 rounded-full bg-brand flex items-center justify-center text-white text-lg")}>
                  {initial}
                </span>
                <span className={cn(NAV_FONT, "text-xl")}>{user.name.split(" ")[0]}</span>
              </a>
              <button
                type="button"
                onClick={handleLogout}
                className={cn(NAV_FONT, "text-white/60 hover:text-white text-xl px-3 py-1.5 transition-colors")}
              >
                Logout
              </button>
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
                {user.role !== "influencer" && (
                  <a href="/dashboard/orders" className={cn(NAV_FONT, "text-white/80 hover:text-white text-xl")}>
                    My Orders
                  </a>
                )}
                <a href={user.role === "influencer" ? "/influencer/dashboard" : "/dashboard"} className={cn(NAV_FONT, "text-white/80 hover:text-white text-xl")}>
                  Dashboard
                </a>
                <button
                  type="button"
                  onClick={handleLogout}
                  className={cn(NAV_FONT, "text-white/60 hover:text-white text-xl text-left")}
                >
                  Logout
                </button>
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
