import { COLLECTIONS, POWER_LEVELS, POWER_LIBRARY, progressFor } from './special-powers.catalog';

const keysOf = (collection: string) => POWER_LIBRARY.filter((p) => p.collection === collection).map((p) => p.key);

describe('Power Book', () => {
  it('has 32 powers in 4 collections of 8 with unique keys and names', () => {
    expect(POWER_LIBRARY).toHaveLength(32);
    COLLECTIONS.forEach((c) => expect(keysOf(c.key)).toHaveLength(8));
    expect(new Set(POWER_LIBRARY.map((p) => p.key)).size).toBe(32);
    expect(new Set(POWER_LIBRARY.map((p) => p.name)).size).toBe(32);
  });

  it('levels by complete collections, not by count', () => {
    // 7 from each collection = 28 powers but no collection complete → no level yet.
    const almost = COLLECTIONS.flatMap((c) => keysOf(c.key).slice(0, 7));
    expect(progressFor(almost)).toMatchObject({ count: 28, completeSets: 0, level: null, next: { name: 'Bronze Hero' } });
    expect(progressFor(keysOf('sky')).level?.name).toBe('Bronze Hero');
    expect(progressFor([...keysOf('sky'), ...keysOf('earth')]).level?.name).toBe('Silver Hero');
    expect(progressFor([...keysOf('sky'), ...keysOf('earth'), ...keysOf('heart')]).level?.reward).toBe('story_credit');
    expect(progressFor(POWER_LIBRARY.map((p) => p.key))).toMatchObject({ completeSets: 4, level: { name: 'Platinum Legend' }, next: null });
  });

  it('points to the collection closest to finishing', () => {
    expect(progressFor(keysOf('festivals').slice(0, 6)).closest).toMatchObject({ name: 'Festivals of India', missing: 2 });
    expect(POWER_LEVELS.map((l) => l.sets)).toEqual([1, 2, 3, 4]);
  });
});
