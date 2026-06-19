"use client";

import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import Logo from "@/components/shared/Logo";

const navLinks = [
  { href: "/#how-it-works", label: "How It Works" },
  { href: "/#themes",       label: "Themes" },
  { href: "/#pricing",      label: "Pricing" },
];

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pathname = usePathname();
  const isHome = pathname === "/";

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* On non-home pages the navbar is always solid so white text is visible
     on cream/white content backgrounds. */
  const showSolid = isScrolled || !isHome;

  return (
    <nav
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        showSolid && "bg-space/95 backdrop-blur-md border-b border-white/10",
      )}
    >
      <div className="max-w-7xl mx-auto px-6 h-36 flex items-center justify-between">
        <Logo />

        {/* Desktop links — only anchor links on homepage */}
        <div className="hidden md:flex items-center gap-8">
          {isHome && navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-white/70 hover:text-white text-sm font-medium transition"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-2">
          <a
            href="/login"
            className="text-white/80 hover:text-white text-sm font-medium px-4 py-2 transition"
          >
            Login
          </a>
          <a
            href="/create"
            className="bg-brand hover:bg-brand-dark text-white text-sm font-semibold px-5 py-2 rounded-full shadow-brand transition hover:scale-105"
          >
            Create Story
          </a>
        </div>

        <button
          type="button"
          className="md:hidden text-white"
          aria-label="Toggle navigation menu"
          aria-expanded={isMenuOpen}
          onClick={() => setIsMenuOpen((open) => !open)}
        >
          {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {isMenuOpen && (
        <div className="md:hidden bg-space/95 backdrop-blur border-b border-white/10">
          <div className="px-6 py-4 flex flex-col gap-4">
            {isHome && navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-white/70 hover:text-white text-sm font-medium transition"
                onClick={() => setIsMenuOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <a
              href="/login"
              className="text-white/80 hover:text-white text-sm font-medium"
            >
              Login
            </a>
            <a
              href="/create"
              className="bg-brand hover:bg-brand-dark text-white text-sm font-semibold px-5 py-2 rounded-full shadow-brand transition text-center"
            >
              Create Story
            </a>
          </div>
        </div>
      )}
    </nav>
  );
}
