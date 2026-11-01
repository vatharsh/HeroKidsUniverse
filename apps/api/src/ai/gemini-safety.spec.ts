import { childSafeOutfit } from './gemini-safety';

describe('childSafeOutfit', () => {
  it('drops clothing words that make the image filter refuse pictures of children', () => {
    expect(childSafeOutfit('Loose cream linen shirt, emerald waistcoat, baggy sand trousers, crimson sash'))
      .toBe('cream linen shirt, emerald waistcoat, sand trousers, crimson sash');
    expect(childSafeOutfit('a loose-fitting kurta and skin-tight leggings')).toBe('a kurta and leggings');
  });

  it('leaves ordinary outfits and words that merely contain those letters alone', () => {
    const suit = 'Royal blue adaptive hero suit with glowing golden lion emblem, energy gauntlets and smart cape.';
    expect(childSafeOutfit(suit)).toBe(suit);
    expect(childSafeOutfit('a bareilly-style embroidered shawl')).toBe('a bareilly-style embroidered shawl');
  });

  it('passes empty values through', () => {
    expect(childSafeOutfit(null)).toBeNull();
    expect(childSafeOutfit('')).toBe('');
  });
});
