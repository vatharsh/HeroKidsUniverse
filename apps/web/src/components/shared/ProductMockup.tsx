"use client";

import { cn } from "@/lib/utils";

export interface ProductMockupProps {
  productSlug: string;
  avatarUrl?: string | null;
  storyCoverUrl?: string | null;
  heroName?: string;
  storyTitle?: string;
  universeTitle?: string;
  customTitle?: string;
  customSubtitle?: string;
  selectedVariants?: Record<string, string>;
  className?: string;
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

const T_SHIRT_COLOR_MAP: Record<string, string> = {
  white:    "#FFFFFF",
  black:    "#111111",
  purple:   "#7C3AED",
  sky_blue: "#0EA5E9",
  yellow:   "#F59E0B",
};

function AvatarCircle({ url, size = 80, className }: { url?: string | null; size?: number; className?: string }) {
  return (
    <div
      className={cn("rounded-full overflow-hidden flex items-center justify-center bg-gradient-to-br from-violet-100 to-brand-50 border-2 border-white/60 shadow-sm flex-shrink-0", className)}
      style={{ width: size, height: size }}
    >
      {url ? (
        <img src={url} alt="avatar" className="w-full h-full object-cover" />
      ) : (
        <span style={{ fontSize: size * 0.45 }}>🦸</span>
      )}
    </div>
  );
}

// ─── Poster ───────────────────────────────────────────────────────────────────

function PosterMockup({ avatarUrl, storyCoverUrl, heroName, storyTitle, customTitle }: ProductMockupProps) {
  const bg = storyCoverUrl ? undefined : "linear-gradient(160deg,#4c1d95 0%,#7c3aed 40%,#db2777 100%)";
  const title = customTitle || storyTitle || (heroName ? `${heroName}'s Adventure` : "Hero Story");
  const subtitle = heroName ? `Starring ${heroName}` : "HeroKids Universe";

  return (
    <div
      className="relative w-full aspect-[2/3] rounded-2xl overflow-hidden shadow-xl flex flex-col items-center justify-between p-5"
      style={{ background: bg }}
    >
      {/* Cover image as bg */}
      {storyCoverUrl && (
        <img src={storyCoverUrl} alt="cover" className="absolute inset-0 w-full h-full object-cover" />
      )}
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

      {/* Frame border */}
      <div className="absolute inset-2 border-2 border-white/30 rounded-xl pointer-events-none" />

      {/* Avatar */}
      <div className="relative z-10 mt-4">
        <AvatarCircle url={avatarUrl} size={88} className="border-4 border-white/60 shadow-xl" />
      </div>

      {/* Bottom text */}
      <div className="relative z-10 text-center pb-2 w-full">
        <p className="font-[family-name:var(--font-display)] text-white text-xl font-black leading-tight drop-shadow-md px-2">
          {title}
        </p>
        <p className="text-white/70 text-xs mt-1 font-medium">{subtitle}</p>
        <p className="text-white/40 text-[10px] mt-1 uppercase tracking-widest">HeroKids Universe</p>
      </div>
    </div>
  );
}

// ─── Certificate ──────────────────────────────────────────────────────────────

function CertificateMockup({ heroName, customTitle, customSubtitle }: ProductMockupProps) {
  const name = heroName || "Young Hero";
  const achievement = customTitle || "Certificate of Heroism";
  const sub = customSubtitle || "For extraordinary courage, creativity, and adventure";

  return (
    <div className="w-full aspect-[3/2] bg-white rounded-xl shadow-xl overflow-hidden flex flex-col items-center justify-center p-5 relative">
      {/* Outer border */}
      <div className="absolute inset-2 border-4 border-amber-400/60 rounded-lg" />
      <div className="absolute inset-3 border border-amber-300/40 rounded-lg" />

      {/* Corner ornaments */}
      {["top-4 left-4", "top-4 right-4", "bottom-4 left-4", "bottom-4 right-4"].map(pos => (
        <div key={pos} className={`absolute ${pos} w-6 h-6 text-amber-400 text-sm`}>✦</div>
      ))}

      <div className="relative z-10 text-center px-4">
        <p className="text-amber-600 text-[10px] font-bold uppercase tracking-[0.2em] mb-1">
          HeroKids Universe
        </p>
        <div className="text-3xl mb-2">🏅</div>
        <p className="font-[family-name:var(--font-display)] text-gray-800 text-xl font-black leading-tight">
          {achievement}
        </p>
        <div className="w-16 h-px bg-amber-400 mx-auto my-2" />
        <p className="text-gray-400 text-[10px] uppercase tracking-widest mb-2">Proudly presented to</p>
        <p className="font-[family-name:var(--font-display)] text-gray-900 text-2xl font-black">{name}</p>
        <p className="text-gray-500 text-[11px] mt-2 leading-snug px-2">{sub}</p>
        <div className="flex items-center justify-center gap-4 mt-3">
          <div className="text-amber-400 text-lg">★★★★★</div>
        </div>
      </div>
    </div>
  );
}

// ─── Sticker Sheet ────────────────────────────────────────────────────────────

const STICKER_SHAPES = [
  "rounded-full",
  "rounded-[12px]",
  "rounded-full",
  "rounded-xl",
  "rounded-full",
  "rounded-[12px]",
  "rounded-full",
  "rounded-xl",
  "rounded-full",
  "rounded-[12px]",
  "rounded-full",
  "rounded-xl",
];

const STICKER_COLORS = [
  "from-violet-400 to-purple-600",
  "from-pink-400 to-rose-600",
  "from-sky-400 to-blue-600",
  "from-amber-400 to-orange-500",
  "from-emerald-400 to-teal-600",
  "from-fuchsia-400 to-pink-600",
];

function StickerSheetMockup({ avatarUrl, heroName }: ProductMockupProps) {
  const name = heroName || "Hero";

  return (
    <div className="w-full aspect-[3/4] bg-white rounded-xl shadow-xl overflow-hidden p-3 relative border border-gray-200">
      {/* A4 label */}
      <div className="absolute top-2 right-2 text-[9px] text-gray-300 font-mono">A4 · 210×297mm</div>

      <div className="grid grid-cols-3 gap-2 h-full">
        {STICKER_SHAPES.map((shape, i) => (
          <div key={i} className={cn(
            "bg-gradient-to-br flex flex-col items-center justify-center p-1 border-2 border-dashed border-gray-200 overflow-hidden aspect-square",
            shape,
            STICKER_COLORS[i % STICKER_COLORS.length],
          )}>
            {avatarUrl ? (
              <img src={avatarUrl} alt={name} className="w-[55%] h-[55%] rounded-full object-cover border-2 border-white/60" />
            ) : (
              <span className="text-lg">🦸</span>
            )}
            <p className="text-white text-[7px] font-black mt-0.5 truncate w-full text-center px-1 leading-none">
              {name}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── T-Shirt ──────────────────────────────────────────────────────────────────

function TShirtMockup({ avatarUrl, heroName, storyCoverUrl, selectedVariants }: ProductMockupProps) {
  const colorKey  = selectedVariants?.color ?? "white";
  const fill      = T_SHIRT_COLOR_MAP[colorKey] ?? "#FFFFFF";
  const isDark    = ["black", "purple"].includes(colorKey);
  const placement = selectedVariants?.placement ?? "front_center";
  const size      = selectedVariants?.size;

  const artUrl = avatarUrl || storyCoverUrl;
  const heroLabel = heroName || "HERO";

  return (
    <div className="w-full aspect-[3/4] flex flex-col items-center justify-center bg-gray-50 rounded-xl shadow-inner p-4 relative">
      {size && (
        <div className="absolute top-3 right-3 bg-white border border-gray-200 rounded-lg px-2 py-1 text-[10px] font-bold text-gray-600">
          {size}
        </div>
      )}

      {/* T-shirt SVG */}
      <div className="relative w-44">
        <svg viewBox="0 0 200 220" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full drop-shadow-lg">
          {/* Shirt body */}
          <path
            d="M60 20 L30 10 L5 50 L30 60 L25 200 L175 200 L170 60 L195 50 L170 10 L140 20 C135 35 120 45 100 45 C80 45 65 35 60 20Z"
            fill={fill}
            stroke="#00000020"
            strokeWidth="1.5"
          />
          {/* Neck */}
          <path d="M60 20 C65 35 80 45 100 45 C120 45 135 35 140 20" fill="none" stroke="#00000015" strokeWidth="1" />
          {/* Sleeve shadow */}
          <path d="M30 60 L5 50 L30 10 L60 20" fill="#00000008" />
          <path d="M170 60 L195 50 L170 10 L140 20" fill="#00000008" />
        </svg>

        {/* Art placement */}
        {placement !== "back_center" && artUrl && (
          <div className="absolute inset-0 flex items-center justify-center mt-10">
            <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-white/80 shadow-md">
              <img src={artUrl} alt="design" className="w-full h-full object-cover" />
            </div>
          </div>
        )}
        {placement !== "back_center" && !artUrl && (
          <div className="absolute inset-0 flex flex-col items-center justify-center mt-10">
            <span className={`text-2xl ${isDark ? "text-white/40" : "text-black/20"}`}>🦸</span>
            <p className={`text-[9px] font-black tracking-widest mt-1 ${isDark ? "text-white/40" : "text-black/20"}`}>
              {heroLabel}
            </p>
          </div>
        )}
      </div>

      <p className="text-gray-500 text-[10px] mt-2 capitalize">
        {colorKey.replace("_", " ")} · {placement.replace("_", " ")}
      </p>
    </div>
  );
}

// ─── Pencil / Name Labels ─────────────────────────────────────────────────────

function PencilLabelsMockup({ avatarUrl, heroName, customTitle }: ProductMockupProps) {
  const name = customTitle || heroName || "My Name";
  const labels = Array.from({ length: 10 });

  return (
    <div className="w-full aspect-[3/4] bg-white rounded-xl shadow-xl overflow-hidden p-4 border border-gray-200 flex flex-col gap-2.5">
      <p className="text-[9px] text-gray-300 font-mono text-right">10 labels per sheet</p>

      {labels.map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-2 bg-gradient-to-r from-violet-50 to-brand-50 border border-violet-200/60 rounded-lg px-2 py-1 flex-shrink-0"
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt={name} className="w-5 h-5 rounded-full object-cover border border-white shadow-sm flex-shrink-0" />
          ) : (
            <span className="text-sm flex-shrink-0">🦸</span>
          )}
          <p className="font-[family-name:var(--font-display)] text-violet-800 text-[11px] font-black truncate flex-1">{name}</p>
          <div className="w-4 h-4 rounded-full bg-brand/20 flex-shrink-0" />
        </div>
      ))}
    </div>
  );
}

// ─── School Labels ────────────────────────────────────────────────────────────

function SchoolLabelsMockup({ avatarUrl, heroName, customTitle, customSubtitle }: ProductMockupProps) {
  const name   = heroName || customTitle || "Student Name";
  const detail = customSubtitle || "Class 3B · Roll No. 12";
  const labels = Array.from({ length: 12 });

  return (
    <div className="w-full aspect-[3/4] bg-white rounded-xl shadow-xl overflow-hidden p-3 border border-gray-200">
      <p className="text-[9px] text-gray-300 font-mono text-right mb-2">12 labels per sheet</p>
      <div className="grid grid-cols-2 gap-2">
        {labels.map((_, i) => (
          <div key={i} className="flex items-center gap-1.5 bg-sky-50 border border-sky-200/60 rounded-lg px-2 py-1.5">
            {avatarUrl ? (
              <img src={avatarUrl} alt={name} className="w-6 h-6 rounded-full object-cover border border-white shadow-sm flex-shrink-0" />
            ) : (
              <span className="text-sm flex-shrink-0">📚</span>
            )}
            <div className="min-w-0">
              <p className="text-sky-900 font-black text-[9px] truncate leading-tight">{name}</p>
              <p className="text-sky-500 text-[8px] truncate leading-tight">{detail}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Storybook ────────────────────────────────────────────────────────────────

function StorybookMockup({ avatarUrl, storyCoverUrl, heroName, storyTitle, customTitle, selectedVariants }: ProductMockupProps) {
  const title   = customTitle || storyTitle || (heroName ? `${heroName}'s Story` : "My Hero Story");
  const binding = selectedVariants?.binding ?? "softcover";
  const bg      = storyCoverUrl ? undefined : "linear-gradient(135deg,#6d28d9 0%,#4c1d95 100%)";

  const BINDING_LABEL: Record<string, string> = {
    softcover:    "Softcover Paperback",
    hardcover:    "Hardcover",
    premium_gift: "Premium Gift Edition",
  };

  return (
    <div className="w-full aspect-[3/4] flex flex-col items-center justify-center bg-gray-100 rounded-xl shadow-inner p-5 gap-4">
      {/* Book */}
      <div className="relative flex">
        {/* Spine */}
        <div className="w-4 bg-gradient-to-b from-violet-900 to-purple-900 rounded-l-sm shadow-lg flex-shrink-0"
          style={{ height: "calc(100%)" }}>
        </div>

        {/* Cover */}
        <div
          className="relative w-36 aspect-[2/3] rounded-r-lg overflow-hidden shadow-2xl flex flex-col items-center justify-between p-3"
          style={{ background: bg }}
        >
          {storyCoverUrl && (
            <img src={storyCoverUrl} alt="cover" className="absolute inset-0 w-full h-full object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

          {/* Avatar */}
          <div className="relative z-10 mt-2">
            <AvatarCircle url={avatarUrl} size={56} className="border-2 border-white/70 shadow-lg" />
          </div>

          {/* Title */}
          <div className="relative z-10 text-center w-full pb-1">
            <p className="font-[family-name:var(--font-display)] text-white text-xs font-black leading-tight px-1">
              {title}
            </p>
            <p className="text-white/50 text-[9px] mt-0.5">HeroKids Universe</p>
          </div>
        </div>
      </div>

      {/* Edition badge */}
      <div className="bg-white/80 border border-gray-200 rounded-full px-3 py-1 text-xs font-semibold text-gray-600">
        {BINDING_LABEL[binding] ?? binding}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ProductMockup(props: ProductMockupProps) {
  const { productSlug, className } = props;

  const inner = (() => {
    switch (productSlug) {
      case "hero_poster_pdf":
      case "printed_story_cover_poster":
      case "printed_hero_poster":
      case "hero_poster":
        return <PosterMockup {...props} />;

      case "hero_certificate_pdf":
        return <CertificateMockup {...props} />;

      case "sticker_sheet_pdf":
      case "sticker_sheet":
        return <StickerSheetMockup {...props} />;

      case "hero_apparel":
        return <TShirtMockup {...props} />;

      case "pencil_labels":
        return <PencilLabelsMockup {...props} />;

      case "school_labels":
        return <SchoolLabelsMockup {...props} />;

      case "printed_storybook":
        return <StorybookMockup {...props} />;

      default:
        return <PosterMockup {...props} />;
    }
  })();

  return <div className={cn("w-full", className)}>{inner}</div>;
}
