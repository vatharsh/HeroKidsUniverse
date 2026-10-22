import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://herokidsuniverse.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages: Array<[string, number]> = [["", 1], ["/demo", 0.8], ["/register", 0.7], ["/login", 0.4], ["/contact", 0.4], ["/privacy", 0.3], ["/terms", 0.3]];
  return pages.map(([path, priority]) => ({ url: `${SITE_URL}${path}`, changeFrequency: "weekly", priority }));
}
