/**
 * Small WebP copies of story pictures for lists and cards. A generated picture is a ~1.2 MB PNG;
 * the preview is ~40–70 KB. It sits next to the original with a predictable name, so the website
 * can ask for it without a database column and fall back to the original if it isn't there yet:
 *   …/1-<uuid>.png  →  …/1-<uuid>.preview.webp
 * Keep in step with previewMediaUrl() in apps/web/src/lib/media-url.ts.
 */
export const PREVIEW_SUFFIX = '.preview.webp';
const PREVIEW_WIDTH = 640;

export function previewPathFor(pathOrUrl: string): string | null {
  if (!/\.(png|jpe?g)$/i.test(pathOrUrl)) return null;
  return pathOrUrl.replace(/\.(png|jpe?g)$/i, PREVIEW_SUFFIX);
}

export async function makePreview(image: Buffer): Promise<Buffer> {
  // Loaded on first use: if the image library can't load on a server, only previews stop —
  // the API still starts and lists fall back to the full pictures.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const sharp = require('sharp') as typeof import('sharp');
  return sharp(image)
    .resize({ width: PREVIEW_WIDTH, withoutEnlargement: true })
    .webp({ quality: 72 })
    .toBuffer();
}

export function imageContentType(filename: string): string {
  if (/\.webp$/i.test(filename)) return 'image/webp';
  if (/\.jpe?g$/i.test(filename)) return 'image/jpeg';
  return 'image/png';
}
