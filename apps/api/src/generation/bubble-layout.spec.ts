import { Box, LocatedCharacter, layoutBubbles } from './bubble-layout';

const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
const inside = (p: { x: number; y: number }, b: Box) => p.x > b.x && p.x < b.x + b.width && p.y > b.y && p.y < b.y + b.height;
const near = (p: { x: number; y: number }, b: Box, by = 3) =>
  inside(p, { x: b.x - by, y: b.y - by, width: b.width + by * 2, height: b.height + by * 2 });

const hero: LocatedCharacter = { name: 'Siddhant', head: { x: 42, y: 40, width: 14, height: 16 }, mouth: { x: 49, y: 52 } };
const daadi: LocatedCharacter = { name: 'Daadi', head: { x: 76, y: 34, width: 14, height: 17 }, mouth: { x: 83, y: 46 } };
const bhaiya: LocatedCharacter = { name: 'Vedant Bhaiya', head: { x: 8, y: 36, width: 15, height: 17 }, mouth: { x: 15, y: 48 } };
const cast = [hero, daadi, bhaiya];

describe('layoutBubbles', () => {
  it('points the tail at the speaker but stops it at the edge of their head', () => {
    const [placed] = layoutBubbles([{ speakerName: 'Siddhant', text: 'Look! The maze core is finally opening!' }], cast);
    expect(placed).not.toBeNull();
    expect(inside(placed!.anchorPoint, hero.head)).toBe(false); // never drawn over the face
    expect(near(placed!.anchorPoint, hero.head)).toBe(true);    // but right at the speaker
    for (const c of cast) expect(overlaps(placed!.bubbleRect, c.head)).toBe(false);
  });

  it('prefers a spot above the speaker\'s head when there is room', () => {
    const [placed] = layoutBubbles([{ speakerName: 'Siddhant', text: 'Full speed ahead!' }], cast);
    expect(placed!.bubbleRect.y + placed!.bubbleRect.height).toBeLessThanOrEqual(hero.head.y);
  });

  it('floats thought bubbles above the head and points them at the top of the head', () => {
    const [placed] = layoutBubbles([{ speakerName: 'Daadi', text: 'I hope he is safe…', bubbleStyle: 'thinking' }], cast);
    expect(placed!.anchorPoint.y).toBe(daadi.head.y);
    expect(placed!.bubbleRect.y + placed!.bubbleRect.height).toBeLessThanOrEqual(daadi.head.y);
  });

  it('never stacks two bubbles on top of each other', () => {
    const [a, b] = layoutBubbles([
      { speakerName: 'Siddhant', text: 'I will protect my family, no matter what!' },
      { speakerName: 'Vedant Bhaiya', text: 'I tracked his wake! The maze splits into two gates!' },
    ], cast);
    expect(overlaps(a!.bubbleRect, b!.bubbleRect)).toBe(false);
  });

  it('keeps bubbles inside the image', () => {
    const edge: LocatedCharacter = { name: 'Daadi', head: { x: 84, y: 5, width: 14, height: 15 }, mouth: { x: 91, y: 16 } };
    const [placed] = layoutBubbles([{ speakerName: 'Daadi', text: 'Use Starlight Resonance, Siddhant!' }], [edge]);
    const r = placed!.bubbleRect;
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.y).toBeGreaterThanOrEqual(0);
    expect(r.x + r.width).toBeLessThanOrEqual(100);
    expect(r.y + r.height).toBeLessThanOrEqual(100);
  });

  it('nudges an above-head bubble inside the image when the speaker is near the top', () => {
    const tall: LocatedCharacter = { name: 'Vedant Bhaiya', head: { x: 33, y: 23, width: 16, height: 20 }, mouth: { x: 38, y: 39 } };
    const kid: LocatedCharacter = { name: 'Siddhant', head: { x: 45, y: 38, width: 20, height: 22 }, mouth: { x: 52, y: 55 } };
    const [placed] = layoutBubbles([{ speakerName: 'Vedant Bhaiya', text: 'Commander, our next adventure is calling from the peaks!' }], [tall, kid]);
    expect(placed!.bubbleRect.y + placed!.bubbleRect.height).toBeLessThanOrEqual(tall.head.y);
  });

  it('does not draw a tail across another character\'s face', () => {
    const [placed] = layoutBubbles([{ speakerName: 'Siddhant', text: 'Look! The maze core is finally opening!' }], cast);
    const r = placed!.bubbleRect;
    const base = { x: Math.min(r.x + r.width - 3, Math.max(r.x + 3, hero.mouth!.x)), y: r.y + r.height };
    for (const other of [daadi, bhaiya]) {
      for (let i = 1; i < 20; i++) {
        const x = base.x + ((hero.mouth!.x - base.x) * i) / 20;
        const y = base.y + ((hero.mouth!.y - base.y) * i) / 20;
        const h = other.head;
        expect(x > h.x && x < h.x + h.width && y > h.y && y < h.y + h.height).toBe(false);
      }
    }
  });

  it('matches speakers by first name and returns null for speakers not in the picture', () => {
    const [byFirstName, missing] = layoutBubbles([
      { speakerName: 'Vedant', text: 'Commander, our next adventure is calling!' },
      { speakerName: 'Vortox', text: 'You cannot stop me!' },
    ], cast);
    expect(near(byFirstName!.anchorPoint, bhaiya.head)).toBe(true);
    expect(missing).toBeNull();
  });
});
