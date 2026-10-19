/**
 * Deterministic speech-bubble layout.
 *
 * Input: where each character's head and mouth actually are in the finished illustration (from vision
 * detection), plus the page's bubbles. Output: a rectangle for each bubble and the point its tail should
 * reach. All coordinates are percentages (0–100) of the image width/height.
 *
 * Rules: a bubble never covers any face or another bubble, stays inside the image, sits as close to its
 * speaker as possible (above the head preferred), and thought bubbles float above the thinker's head.
 */

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface LocatedCharacter {
  name: string;
  head: Box;
  mouth: Point | null;
}

export interface BubbleInput {
  speakerName: string;
  text: string;
  bubbleStyle?: string;
}

export interface PlacedBubble {
  bubbleRect: Box;
  anchorPoint: Point;
  /** 1 when the speaker was found in the image; lower when we had to compromise. */
  layoutConfidence: number;
}

const MARGIN = 2;        // keep bubbles off the image edge
const FACE_PADDING = 1.5; // breathing room around every face
const GAP = 4.5;         // space between a bubble and the speaker's head (the tail spans it)

/** Rough rendered size of a bubble, as % of a square image ~380px wide in the reader. */
export function estimateBubbleSize(text: string, imageAspect = 1): { width: number; height: number } {
  const chars = text.length;
  const width = Math.min(44, Math.max(24, 18 + chars * 0.55));
  const charsPerLine = Math.max(8, Math.floor(width * 0.62));
  const lines = Math.max(1, Math.ceil(chars / charsPerLine));
  // speaker label + padding + text lines; taller images make each line a smaller % of the height
  const height = (6 + lines * 4.6) * imageAspect;
  return { width, height };
}

function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function inflate(box: Box, by: number): Box {
  return { x: box.x - by, y: box.y - by, width: box.width + by * 2, height: box.height + by * 2 };
}

function insideImage(box: Box): boolean {
  return box.x >= MARGIN && box.y >= MARGIN && box.x + box.width <= 100 - MARGIN && box.y + box.height <= 100 - MARGIN;
}

/** The point on the bubble's edge closest to the anchor — where the tail leaves the bubble. */
function tailBase(rect: Box, anchor: Point): Point {
  return {
    x: Math.min(rect.x + rect.width - 3, Math.max(rect.x + 3, anchor.x)),
    y: anchor.y > rect.y + rect.height ? rect.y + rect.height : anchor.y < rect.y ? rect.y : rect.y + rect.height / 2,
  };
}

/**
 * Where the tail should stop: it aims at the mouth but ends at the edge of the speaker's head, so it never
 * covers the face (classic comic tails point at the speaker rather than drawing over them).
 */
function tailTip(from: Point, mouth: Point, head: Box): Point {
  const edge = inflate(head, 0.8);
  for (let i = 1; i <= 40; i++) {
    const p = { x: from.x + ((mouth.x - from.x) * i) / 40, y: from.y + ((mouth.y - from.y) * i) / 40 };
    if (p.x > edge.x && p.x < edge.x + edge.width && p.y > edge.y && p.y < edge.y + edge.height) {
      const prev = { x: from.x + ((mouth.x - from.x) * (i - 1)) / 40, y: from.y + ((mouth.y - from.y) * (i - 1)) / 40 };
      return { x: Math.round(prev.x * 10) / 10, y: Math.round(prev.y * 10) / 10 };
    }
  }
  return mouth;
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function findCharacter(characters: LocatedCharacter[], speakerName: string): LocatedCharacter | undefined {
  const target = speakerName.trim().toLowerCase();
  const first = target.split(/\s+/)[0];
  return characters.find((c) => c.name.trim().toLowerCase() === target)
    ?? characters.find((c) => c.name.trim().toLowerCase().split(/\s+/)[0] === first);
}

function candidateRects(head: Box, size: { width: number; height: number }, thinking: boolean): Box[] {
  const headCx = head.x + head.width / 2;
  const headCy = head.y + head.height / 2;
  const rects: Box[] = [];
  // Try the natural width and a wider, shorter variant (fewer lines fits better above a head near the top).
  const sizes = [size, { width: Math.min(58, size.width * 1.35), height: Math.max(9, size.height * 0.72) }];
  for (const { width: w, height: h } of sizes) {
    // Above the head — slide across, and nudge down inside the image rather than discarding it.
    const above = Math.max(MARGIN, head.y - GAP - h);
    for (let t = 0.1; t <= 0.9001; t += 0.1) rects.push({ x: headCx - w * t, y: above, width: w, height: h });
    if (!thinking) {
      for (const dy of [-0.8, -0.4]) {
        rects.push({ x: head.x - GAP - w, y: headCy + h * dy, width: w, height: h });          // left of head
        rects.push({ x: head.x + head.width + GAP, y: headCy + h * dy, width: w, height: h }); // right of head
      }
      // Below the head (beside the body) — used when everything above is crowded by other characters
      const below = head.y + head.height + GAP;
      for (const t of [0.15, 0.5, 0.85]) rects.push({ x: headCx - w * t, y: below, width: w, height: h });
    }
    // Top band fallbacks (classic comic placement) across the width of the image
    for (const x of [MARGIN, 50 - w / 2, 100 - MARGIN - w]) rects.push({ x, y: MARGIN, width: w, height: h });
  }
  return rects.map((r) => ({ ...r, x: Math.round(r.x * 10) / 10, y: Math.round(r.y * 10) / 10 }));
}

/** Rough region a character's body occupies below their head — covering it is allowed but discouraged. */
function bodyOf(head: Box): Box {
  return { x: head.x - head.width * 0.4, y: head.y + head.height, width: head.width * 1.8, height: head.height * 2.2 };
}

/** Does the straight tail from `from` to `to` pass through `box`? (sampled — boxes are large relative to steps) */
function segmentHits(from: Point, to: Point, box: Box): boolean {
  for (let i = 1; i < 20; i++) {
    const x = from.x + ((to.x - from.x) * i) / 20;
    const y = from.y + ((to.y - from.y) * i) / 20;
    if (x > box.x && x < box.x + box.width && y > box.y && y < box.y + box.height) return true;
  }
  return false;
}

/**
 * Places every bubble on a page. Bubbles whose speaker wasn't detected return null — the reader then
 * falls back to its simple corner placement for that bubble.
 */
export function layoutBubbles(
  bubbles: BubbleInput[],
  characters: LocatedCharacter[],
  imageAspect = 1,
): Array<PlacedBubble | null> {
  const faces = characters.map((c) => inflate(c.head, FACE_PADDING));
  const placed: Box[] = [];
  const tails: Array<{ from: Point; to: Point }> = [];

  return bubbles.map((bubble) => {
    const speaker = findCharacter(characters, bubble.speakerName);
    if (!speaker) return null;

    const thinking = bubble.bubbleStyle === 'thinking';
    const head = speaker.head;
    const anchor: Point = thinking
      ? { x: head.x + head.width / 2, y: head.y }                       // thoughts rise from the top of the head
      : speaker.mouth ?? { x: head.x + head.width / 2, y: head.y + head.height * 0.75 };
    const size = estimateBubbleSize(bubble.text, imageAspect);

    const others = characters.filter((c) => c !== speaker);
    let best: { rect: Box; score: number } | null = null;
    candidateRects(head, size, thinking).forEach((rect) => {
      if (!insideImage(rect)) return;
      if (faces.some((face) => overlaps(rect, face))) return;
      if (placed.some((other) => overlaps(rect, inflate(other, 1)))) return;
      const base = tailBase(rect, anchor);
      const reach = distance(base, anchor);
      const isAbove = rect.y + rect.height <= head.y;
      let score = reach;
      if (!isAbove) score += 8;                                                    // comics read best with bubbles above
      if (reach > 35) score += 25;                                                 // long tails are hard to follow
      if (others.some((o) => segmentHits(base, anchor, o.head))) score += 60;      // tail must not cross another face
      score += others.filter((o) => overlaps(rect, bodyOf(o.head))).length * 12;  // avoid covering other people
      if (placed.some((other) => segmentHits(base, anchor, other))) score += 60;  // tail must not cross another bubble
      if (tails.some((t) => segmentHits(t.from, t.to, rect))) score += 60;        // nor sit on an earlier tail
      if (!best || score < best.score) best = { rect, score };
    });

    if (!best) {
      // Nothing clean fits — use the top-band spot that covers the least face area, flagged low-confidence.
      const fallback = candidateRects(head, size, thinking)
        .filter(insideImage)
        .sort((a, b) => faces.filter((f) => overlaps(a, f)).length - faces.filter((f) => overlaps(b, f)).length)[0];
      if (!fallback) return null;
      placed.push(fallback);
      const tip = thinking ? anchor : tailTip(tailBase(fallback, anchor), anchor, head);
      tails.push({ from: tailBase(fallback, anchor), to: tip });
      return { bubbleRect: fallback, anchorPoint: tip, layoutConfidence: 0.4 };
    }

    const chosen = (best as { rect: Box; score: number }).rect;
    placed.push(chosen);
    const tip = thinking ? anchor : tailTip(tailBase(chosen, anchor), anchor, head);
    tails.push({ from: tailBase(chosen, anchor), to: tip });
    return { bubbleRect: chosen, anchorPoint: tip, layoutConfidence: 1 };
  });
}
