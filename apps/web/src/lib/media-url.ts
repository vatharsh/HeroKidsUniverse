const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

function apiOrigin(): string {
  try {
    return new URL(API_BASE).origin;
  } catch {
    return "";
  }
}

export function resolveMediaUrl(url: string | null | undefined): string {
  const raw = url?.trim() ?? "";
  if (!raw) return "";
  if (/^(data:|blob:|https?:\/\/)/i.test(raw)) return raw;

  const origin = apiOrigin();
  if (!origin) return raw;

  if (raw.startsWith("/api/")) return `${origin}${raw}`;
  if (raw.startsWith("/upload/")) return `${origin}/api${raw}`;
  if (raw.startsWith("upload/")) return `${origin}/api/${raw}`;

  return raw.startsWith("/") ? `${origin}${raw}` : raw;
}

/**
 * The small WebP copy the API stores next to each story picture (…/x.png → …/x.preview.webp).
 * Keep in step with previewPathFor() in apps/api/src/upload/image-preview.ts. Use through
 * <PreviewImg>, which falls back to the full picture when an older one has no preview.
 */
export function previewMediaUrl(url: string | null | undefined): string {
  const resolved = resolveMediaUrl(url);
  if (!resolved || /^(data:|blob:)/i.test(resolved)) return "";
  const [path, query = ""] = resolved.split("?");
  if (!/\.(png|jpe?g)$/i.test(path)) return "";
  return path.replace(/\.(png|jpe?g)$/i, ".preview.webp") + (query ? `?${query}` : "");
}
