import type { StoryPage } from '../stories/story.entity';

/**
 * Thumbnails for the universe page (villains, gear, quests, timeline, arcs), picked from the
 * illustrations a story already has — no extra AI images. A villain gets the first page it appears
 * on; gear and powers get the page where they're mentioned; quests get their cliffhanger page.
 */
export interface StoryImages {
  id: string;
  coverImageUrl: string | null;
  pages: StoryPage[] | null;
}

export interface Thumbnail {
  thumbnailUrl: string | null;
  thumbnailStoryId: string | null;
}

const STOP_WORDS = new Set([
  'the', 'and', 'with', 'from', 'into', 'that', 'this', 'their', 'your', 'about', 'power', 'powers',
  'found', 'defeated', 'earned', 'opened', 'completed', 'quest', 'villain', 'story',
  // quest titles start with verbs that appear on almost every page
  'find', 'save', 'stop', 'help', 'defeat', 'return', 'bring', 'protect', 'discover', 'rescue', 'reach', 'learn', 'free',
]);

function keywords(text: string): string[] {
  return [...new Set(text.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !STOP_WORDS.has(w)))];
}

function pageImage(page: StoryPage): string | null {
  return page.imageUrl || page.backgroundUrl || null;
}

function pageText(page: StoryPage): string {
  const dialogue = (page.dialogue ?? []).map((d) => d.text).join(' ');
  return `${page.text ?? ''} ${page.narrationText ?? ''} ${dialogue}`.toLowerCase();
}

/** Whole-word match, allowing a plural ("flute" matches "flutes", not "flutelike"). */
function hasWord(words: Set<string>, word: string): boolean {
  return words.has(word) || words.has(`${word}s`) || words.has(`${word}es`);
}

export function pickThumbnail(
  story: StoryImages | undefined,
  opts: { name?: string | null; character?: string | null; prefer?: 'first' | 'last'; fallback?: 'cover' | 'lastPage' } = {},
): Thumbnail {
  if (!story) return { thumbnailUrl: null, thumbnailStoryId: null };
  const pages = (story.pages ?? []).filter((p) => pageImage(p));
  const ordered = opts.prefer === 'last' ? [...pages].reverse() : pages;
  const found = (page: StoryPage | undefined) =>
    page ? { thumbnailUrl: pageImage(page), thumbnailStoryId: story.id } : null;

  const character = opts.character?.trim().toLowerCase();
  if (character) {
    const hit = ordered.find((p) => (p.characters ?? []).some((c) => {
      const n = (c.name ?? '').toLowerCase();
      return n && (n.includes(character) || character.includes(n));
    }));
    if (hit) return found(hit)!;
  }

  const name = opts.name?.trim().toLowerCase();
  if (name) {
    const exact = ordered.find((p) => pageText(p).includes(name));
    if (exact) return found(exact)!;
    const words = keywords(name);
    if (words.length) {
      let best: StoryPage | undefined;
      let bestScore = 0;
      for (const p of ordered) {
        const pageWords = new Set(pageText(p).split(/[^a-z0-9]+/));
        const score = words.filter((w) => hasWord(pageWords, w)).length;
        if (score > bestScore) { best = p; bestScore = score; }
      }
      if (best) return found(best)!;
    }
  }

  if (opts.fallback === 'lastPage' && pages.length) return found(pages[pages.length - 1])!;
  if (story.coverImageUrl) return { thumbnailUrl: story.coverImageUrl, thumbnailStoryId: story.id };
  return found(pages[0]) ?? { thumbnailUrl: null, thumbnailStoryId: story.id };
}
