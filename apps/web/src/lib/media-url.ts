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
