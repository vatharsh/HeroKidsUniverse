import { cleanCastRoles } from './stories.service';

describe('cleanCastRoles ("plays as…")', () => {
  const vedant = 'f0c537a6-362b-490b-b9b5-f44dc586f242';
  const kayra = 'e0b87af9-e3b0-467f-90e2-e1368a3bc223';

  it("keeps roles only for this story's cast, tidied and kept short", () => {
    expect(cleanCastRoles({ [vedant]: '  the   Genie ', [kayra]: 'a pirate', stranger: 'the King' }, [vedant]))
      .toEqual({ [vedant]: 'the Genie' });
    expect(cleanCastRoles({ [vedant]: 'x'.repeat(80) }, [vedant])?.[vedant]).toHaveLength(40);
  });

  it('is null when nobody plays a part', () => {
    expect(cleanCastRoles(undefined, [vedant])).toBeNull();
    expect(cleanCastRoles({ [vedant]: '   ' }, [vedant])).toBeNull();
  });
});
