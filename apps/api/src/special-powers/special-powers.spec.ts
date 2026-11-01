import { levelFor, POWER_LEVELS, POWER_SUGGESTIONS } from './special-powers.catalog';

describe('hidden powers levels', () => {
  it('climbs Bronze → Silver → Gold at 3 / 6 / 10 finds', () => {
    expect(levelFor(0)).toMatchObject({ level: null, next: { name: 'Bronze Hero' }, toNext: 3 });
    expect(levelFor(3).level?.name).toBe('Bronze Hero');
    expect(levelFor(5)).toMatchObject({ level: { name: 'Bronze Hero' }, next: { name: 'Silver Hero' }, toNext: 1 });
    expect(levelFor(6).level?.reward).toBe('avatar_refresh');
    expect(levelFor(10).level?.reward).toBe('story_credit');
    expect(levelFor(25)).toMatchObject({ level: { name: 'Gold Hero' }, next: null, toNext: 0 });
  });

  it('has plenty of ready-made powers with unique names', () => {
    expect(POWER_SUGGESTIONS.length).toBeGreaterThanOrEqual(20);
    expect(new Set(POWER_SUGGESTIONS.map((p) => p.name)).size).toBe(POWER_SUGGESTIONS.length);
    expect(POWER_LEVELS.map((l) => l.at)).toEqual([3, 6, 10]);
  });
});
