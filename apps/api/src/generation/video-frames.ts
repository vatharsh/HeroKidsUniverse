import { createCanvas, GlobalFonts, loadImage, type Image, type SKRSContext2D } from '@napi-rs/canvas';

/**
 * Draws the still frames for the story video: cover, one per page (illustration + speech bubbles + page text,
 * laid out like the reader) and an end card. Fonts are bundled (no system fonts exist in the Alpine image).
 */

export type VideoFormat = 'vertical' | 'landscape';

export const VIDEO_SIZE: Record<VideoFormat, { width: number; height: number }> = {
  vertical: { width: 1080, height: 1920 },
  landscape: { width: 1920, height: 1080 },
};

export interface FrameBubble {
  speakerName: string;
  text: string;
  bubbleStyle?: string;
  /** Detected placement (percent of the illustration); absent → simple corner placement. */
  anchorPoint?: { x: number; y: number };
  bubbleRect?: { x: number; y: number; width: number; height: number };
  layoutSource?: string;
}

let fontsRegistered = false;
function registerFonts(): void {
  if (fontsRegistered) return;
  const file = (p: string) => require.resolve(p);
  GlobalFonts.registerFromPath(file('@fontsource/bangers/files/bangers-latin-400-normal.woff2'), 'Bangers');
  GlobalFonts.registerFromPath(file('@fontsource/nunito/files/nunito-latin-700-normal.woff2'), 'Nunito');
  GlobalFonts.registerFromPath(file('@fontsource/nunito/files/nunito-latin-800-normal.woff2'), 'Nunito ExtraBold');
  fontsRegistered = true;
}

const SPEAKER_COLOURS = ['#7c3aed', '#dc2626', '#16a34a', '#2563eb', '#d97706', '#0891b2', '#9333ea', '#e11d48'];
function speakerColour(name: string): string {
  const hash = name.split('').reduce((h, c) => (h * 31 + c.charCodeAt(0)) & 0xffff, 0);
  return SPEAKER_COLOURS[hash % SPEAKER_COLOURS.length];
}

/** Word-wraps text to a max width; returns lines. */
function wrap(ctx: SKRSContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function roundRect(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Blurred, darkened copy of the illustration filling the whole frame (the reader's backdrop). */
function drawBackdrop(ctx: SKRSContext2D, img: Image | null, width: number, height: number): void {
  ctx.fillStyle = '#1a0f3a';
  ctx.fillRect(0, 0, width, height);
  if (!img) return;
  const scale = Math.max(width / img.width, height / img.height) * 1.1;
  ctx.save();
  ctx.filter = 'blur(36px) brightness(0.45)';
  ctx.drawImage(img, (width - img.width * scale) / 2, (height - img.height * scale) / 2, img.width * scale, img.height * scale);
  ctx.restore();
}

/** The illustration with rounded corners. Returns its box so bubbles can be placed on it. */
function drawIllustration(ctx: SKRSContext2D, img: Image, x: number, y: number, size: number) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 40;
  roundRect(ctx, x, y, size, size, 36);
  ctx.fillStyle = '#000';
  ctx.fill();
  ctx.restore();
  ctx.save();
  roundRect(ctx, x, y, size, size, 36);
  ctx.clip();
  // object-fit: cover into the square
  const scale = Math.max(size / img.width, size / img.height);
  ctx.drawImage(img, x + (size - img.width * scale) / 2, y + (size - img.height * scale) / 2, img.width * scale, img.height * scale);
  ctx.restore();
  return { x, y, size };
}

function drawBubbles(ctx: SKRSContext2D, bubbles: FrameBubble[], box: { x: number; y: number; size: number }): void {
  const s = box.size / 100;
  const pad = box.size * 0.022;
  const nameSize = Math.round(box.size * 0.026);
  const textSize = Math.round(box.size * 0.036);

  bubbles.slice(0, 2).forEach((b, i) => {
    const detected = b.layoutSource === 'detected' && b.bubbleRect && b.anchorPoint;
    const width = detected ? b.bubbleRect!.width * s : box.size * 0.44;
    ctx.font = `${textSize}px Bangers`;
    const lines = wrap(ctx, b.text.toUpperCase(), width - pad * 2);
    const height = pad * 2 + nameSize + 6 + lines.length * textSize * 1.12;

    let bx: number;
    let by: number;
    let anchor: { x: number; y: number };
    if (detected) {
      const r = b.bubbleRect!;
      anchor = { x: box.x + b.anchorPoint!.x * s, y: box.y + b.anchorPoint!.y * s };
      bx = box.x + r.x * s;
      // Pin the edge that faces the speaker so the tail always starts on the bubble (like the reader).
      const below = b.anchorPoint!.y > r.y + r.height / 2;
      by = below ? box.y + (r.y + r.height) * s - height : box.y + r.y * s;
    } else {
      bx = i === 0 ? box.x + box.size * 0.04 : box.x + box.size * 0.52;
      by = box.y + box.size * 0.05;
      anchor = { x: bx + width * (i === 0 ? 0.3 : 0.7), y: by + height + box.size * 0.06 };
    }

    const thinking = b.bubbleStyle === 'thinking';
    const anchorBelow = anchor.y > by + height / 2;
    const baseX = Math.min(bx + width - 28, Math.max(bx + 28, anchor.x));
    const baseY = anchorBelow ? by + height - 2 : by + 2;

    // Tail first, so the bubble body covers the seam.
    ctx.lineWidth = Math.max(4, box.size * 0.0045);
    ctx.strokeStyle = '#000';
    ctx.fillStyle = b.bubbleStyle === 'surprised' ? '#fff9c4' : '#fff';
    if (thinking) {
      [0.35, 0.62, 0.86].forEach((t, k) => {
        ctx.beginPath();
        ctx.arc(baseX + (anchor.x - baseX) * t, baseY + (anchor.y - baseY) * t, [13, 9, 6][k] * (box.size / 1000), 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });
    } else {
      const half = Math.min(18, width / 8);
      ctx.beginPath();
      ctx.moveTo(baseX - half, baseY);
      ctx.lineTo(anchor.x, anchor.y);
      ctx.lineTo(baseX + half, baseY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    ctx.save();
    if (thinking) ctx.setLineDash([10, 8]);
    roundRect(ctx, bx, by, width, height, thinking ? 34 : 18);
    ctx.shadowColor = 'rgba(0,0,0,0.85)';
    ctx.shadowOffsetX = 5;
    ctx.shadowOffsetY = 5;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = speakerColour(b.speakerName);
    ctx.font = `${nameSize}px Bangers`;
    ctx.textBaseline = 'top';
    ctx.fillText(b.speakerName.toUpperCase(), bx + pad, by + pad);
    ctx.fillStyle = '#111';
    ctx.font = `${textSize}px Bangers`;
    lines.forEach((line, k) => ctx.fillText(line, bx + pad, by + pad + nameSize + 6 + k * textSize * 1.12));
  });
}

/** Centered page text in a panel, shrinking the font until it fits. */
function drawPageText(ctx: SKRSContext2D, text: string, x: number, y: number, w: number, h: number): void {
  let size = 50;
  let lines: string[] = [];
  for (; size >= 30; size -= 2) {
    ctx.font = `${size}px Nunito`;
    lines = wrap(ctx, text, w);
    if (lines.length * size * 1.4 <= h) break;
  }
  const blockHeight = lines.length * size * 1.4;
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'center';
  lines.forEach((line, i) => ctx.fillText(line, x + w / 2, y + (h - blockHeight) / 2 + i * size * 1.4));
  ctx.textAlign = 'left';
}

function drawSmallLabel(ctx: SKRSContext2D, text: string, x: number, y: number, align: CanvasTextAlign, colour = '#f5c542', size = 40): void {
  ctx.font = `${size}px Bangers`;
  ctx.fillStyle = colour;
  ctx.textBaseline = 'top';
  ctx.textAlign = align;
  ctx.fillText(text, x, y);
  ctx.textAlign = 'left';
}

export async function renderPageFrame(params: {
  format: VideoFormat;
  image: Buffer;
  bubbles: FrameBubble[];
  text: string;
  title: string;
  pageNumber: number;
  totalPages: number;
}): Promise<Buffer> {
  registerFonts();
  const { width, height } = VIDEO_SIZE[params.format];
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const img = await loadImage(params.image);
  drawBackdrop(ctx, img, width, height);

  if (params.format === 'vertical') {
    drawSmallLabel(ctx, params.title, width / 2, 90, 'center');
    const box = drawIllustration(ctx, img, 40, 200, 1000);
    drawBubbles(ctx, params.bubbles, box);
    drawPageText(ctx, params.text, 70, 1250, width - 140, 540);
    drawSmallLabel(ctx, `${params.pageNumber} / ${params.totalPages}`, width / 2, 1820, 'center', 'rgba(255,255,255,0.55)', 34);
  } else {
    const box = drawIllustration(ctx, img, 60, 40, 1000);
    drawBubbles(ctx, params.bubbles, box);
    drawSmallLabel(ctx, params.title, 1120 + 370, 70, 'center');
    drawPageText(ctx, params.text, 1120, 170, 740, 780);
    drawSmallLabel(ctx, `${params.pageNumber} / ${params.totalPages}`, 1120 + 370, 980, 'center', 'rgba(255,255,255,0.55)', 34);
  }
  return canvas.toBuffer('image/png');
}

export async function renderCoverFrame(params: { format: VideoFormat; image: Buffer | null; title: string; heroName: string }): Promise<Buffer> {
  registerFonts();
  const { width, height } = VIDEO_SIZE[params.format];
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const img = params.image ? await loadImage(params.image) : null;
  drawBackdrop(ctx, img, width, height);
  const vertical = params.format === 'vertical';
  if (img) drawIllustration(ctx, img, vertical ? 90 : 160, vertical ? 360 : 90, vertical ? 900 : 900);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const textX = vertical ? width / 2 : 1120 + 370;
  const textW = vertical ? width - 140 : 700;
  ctx.font = '86px Bangers';
  ctx.fillStyle = '#ffffff';
  const titleLines = wrap(ctx, params.title, textW);
  const titleTop = vertical ? 1320 : 380;
  titleLines.forEach((l, i) => ctx.fillText(l, textX, titleTop + i * 96));
  ctx.font = '42px Nunito';
  ctx.fillStyle = '#f5c542';
  ctx.fillText(`A HeroKids Universe story starring ${params.heroName}`, textX, titleTop + titleLines.length * 96 + 30, textW);
  ctx.textAlign = 'left';
  return canvas.toBuffer('image/png');
}

export async function renderEndFrame(params: { format: VideoFormat; image: Buffer | null }): Promise<Buffer> {
  registerFonts();
  const { width, height } = VIDEO_SIZE[params.format];
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  drawBackdrop(ctx, params.image ? await loadImage(params.image) : null, width, height);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '150px Bangers';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('The End', width / 2, height / 2 - 60);
  ctx.font = '46px Nunito';
  ctx.fillStyle = '#f5c542';
  ctx.fillText('Made with HeroKids Universe', width / 2, height / 2 + 70);
  ctx.textAlign = 'left';
  return canvas.toBuffer('image/png');
}
