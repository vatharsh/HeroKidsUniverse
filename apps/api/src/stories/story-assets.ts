import { Story } from './story.entity';

/** Every stored asset URL a story owns (cover, PDF, video, per-page image/background/audio). */
export function storyAssetUrls(story: Story): string[] {
  return [
    story.coverImageUrl,
    story.pdfUrl,
    story.videoUrl,
    story.videoVariants?.landscape?.url,
    ...(story.pages ?? []).flatMap((p) => [p.imageUrl, p.backgroundUrl, p.audioUrl]),
  ].filter((url): url is string => !!url);
}
