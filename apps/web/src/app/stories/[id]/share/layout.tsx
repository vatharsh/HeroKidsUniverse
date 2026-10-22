import type { Metadata } from "next";
import type { ReactNode } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

interface PublicStory {
  title: string | null;
  coverImageUrl: string | null;
  pages?: Array<{ imageUrl?: string }>;
  hero?: { name?: string } | null;
}

function absolute(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `${new URL(API).origin}${url.startsWith("/") ? "" : "/"}${url}`;
}

/** Link previews (WhatsApp, Instagram, iMessage) show the story's title and cover; search engines don't index it. */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  let story: PublicStory | null = null;
  try {
    const res = await fetch(`${API}/stories/${encodeURIComponent(id)}/public`, { next: { revalidate: 3600 } });
    if (res.ok) story = ((await res.json()) as { data: PublicStory }).data;
  } catch { /* fall back to the site-wide preview */ }

  const hero = story?.hero?.name;
  const title = story?.title ? `${story.title} — Hero Kids Universe` : "A Hero Kids Universe story";
  const description = hero
    ? `${hero} is the hero of this illustrated story. Make your child the hero of their own story series.`
    : "An illustrated story where a child is the hero. Make your child the hero of their own story series.";
  const picture = story?.coverImageUrl ?? story?.pages?.find((p) => p.imageUrl)?.imageUrl ?? null;
  // The ~40 KB preview copy keeps link previews fast (WhatsApp skips large images).
  const image = picture ? absolute(picture).replace(/\.(png|jpe?g)$/i, ".preview.webp") : undefined;

  return {
    title: { absolute: title }, // already includes the brand; skip the site-wide " · Hero Kids Universe" suffix
    description,
    robots: { index: false, follow: true },
    openGraph: { title, description, type: "article", ...(image ? { images: [{ url: image, width: 640 }] } : {}) },
    twitter: { card: image ? "summary_large_image" : "summary", title, description, ...(image ? { images: [image] } : {}) },
  };
}

export default function ShareLayout({ children }: { children: ReactNode }) {
  return children;
}
