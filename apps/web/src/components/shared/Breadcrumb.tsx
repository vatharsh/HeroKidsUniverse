import { ChevronRight, Home } from "lucide-react";

export interface Crumb {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  crumbs: Crumb[];
  variant?: "dark" | "light";
  className?: string;
}

export default function Breadcrumb({ crumbs, variant = "light", className = "" }: BreadcrumbProps) {
  const baseText  = variant === "dark" ? "text-white/50" : "text-ink-muted";
  const linkHover = variant === "dark" ? "hover:text-white" : "hover:text-brand";
  const activeTxt = variant === "dark" ? "text-white/90" : "text-ink";
  const chevron   = variant === "dark" ? "text-white/25" : "text-ink/25";

  return (
    <nav aria-label="Breadcrumb" className={`flex items-center gap-1 text-[13px] ${className}`}>
      <a href="/dashboard" className={`${baseText} ${linkHover} transition flex items-center gap-1`}>
        <Home className="w-3.5 h-3.5" />
        <span>Dashboard</span>
      </a>
      {crumbs.map((crumb, i) => (
        <span key={i} className="flex items-center gap-1">
          <ChevronRight className={`w-3.5 h-3.5 ${chevron}`} />
          {crumb.href ? (
            <a href={crumb.href} className={`${baseText} ${linkHover} transition`}>{crumb.label}</a>
          ) : (
            <span className={`font-semibold ${activeTxt}`}>{crumb.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
