import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://herokidsuniverse.com";

/** Public marketing pages can be indexed; signed-in and admin areas can't. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/dashboard", "/account", "/create", "/universe", "/characters", "/influencer", "/onboarding", "/verify-email"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
