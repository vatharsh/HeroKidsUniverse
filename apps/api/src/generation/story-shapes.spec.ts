import { STORY_SHAPES, pickStoryShape } from './story-shapes';

describe('pickStoryShape', () => {
  it('never repeats a shape used in the last four episodes', () => {
    const recent = ['rescue', 'mystery', 'race', 'trickster'];
    for (let i = 0; i < 50; i++) {
      const r = i / 50;
      expect(recent).not.toContain(pickStoryShape(recent, () => r).key);
    }
  });

  it('only looks at the four most recent episodes', () => {
    const recent = ['rescue', 'mystery', 'race', 'trickster', 'contest'];
    const picks = new Set(Array.from({ length: 50 }, (_, i) => pickStoryShape(recent, () => i / 50).key));
    expect(picks.has('contest')).toBe(true);
  });

  it('still picks something when every shape was used recently', () => {
    const all = STORY_SHAPES.map((s) => s.key);
    expect(STORY_SHAPES).toContainEqual(pickStoryShape(all, () => 0));
  });

  it('ignores missing shapes from older episodes', () => {
    expect(pickStoryShape([null, undefined], () => 0)).toEqual(STORY_SHAPES[0]);
  });
});
