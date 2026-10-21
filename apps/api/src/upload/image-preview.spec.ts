import sharp from 'sharp';

import { imageContentType, makePreview, previewPathFor } from './image-preview';

describe('image previews', () => {
  it('names the preview next to the original', () => {
    expect(previewPathFor('stories/s1/pages/1-abc.png')).toBe('stories/s1/pages/1-abc.preview.webp');
    expect(previewPathFor('https://cdn.example.com/stories/x.jpg')).toBe('https://cdn.example.com/stories/x.preview.webp');
    expect(previewPathFor('audio/x.mp3')).toBeNull();
  });

  it('makes a small 640px-wide WebP', async () => {
    const png = await sharp({ create: { width: 1024, height: 1024, channels: 3, background: '#7c3aed' } }).png().toBuffer();
    const preview = await makePreview(png);
    const meta = await sharp(preview).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.width).toBe(640);
    expect(preview.length).toBeLessThan(png.length);
  });

  it('serves the right content type', () => {
    expect(imageContentType('a.preview.webp')).toBe('image/webp');
    expect(imageContentType('a.png')).toBe('image/png');
  });
});
