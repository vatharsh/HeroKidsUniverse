import type { StoryPage } from '../stories/story.entity';
import { pickThumbnail, type StoryImages } from './universe-thumbnails';

const page = (n: number, text: string, characters: string[] = []): StoryPage => ({
  pageNumber: n,
  text,
  imageUrl: `/img/${n}.png`,
  characters: characters.map((name) => ({ name })) as StoryPage['characters'],
});

const story: StoryImages = {
  id: 's1',
  coverImageUrl: '/img/cover.png',
  pages: [
    page(1, 'Siddhant wakes up in the castle.', ['Siddhant']),
    page(2, 'Grumblor the Frost Troll blocks the bridge!', ['Siddhant', 'Grumblor']),
    page(3, 'Siddhant finds the Ember-Spur Flute glowing in the snow.', ['Siddhant']),
    page(4, 'But a shadow moves behind the gate...', ['Siddhant']),
  ],
};

describe('pickThumbnail', () => {
  it('uses the first page a villain appears on', () => {
    expect(pickThumbnail(story, { character: 'Grumblor the Frost Troll', name: 'Grumblor' }).thumbnailUrl).toBe('/img/2.png');
  });

  it('finds gear by name, then by its key words', () => {
    expect(pickThumbnail(story, { name: 'Ember-Spur Flute' }).thumbnailUrl).toBe('/img/3.png');
    expect(pickThumbnail(story, { name: 'The Glowing Flute of Embers' }).thumbnailUrl).toBe('/img/3.png');
  });

  it('falls back to the cliffhanger page or the cover', () => {
    expect(pickThumbnail(story, { name: 'Find the lost crown', fallback: 'lastPage' }).thumbnailUrl).toBe('/img/4.png');
    expect(pickThumbnail(story, { name: 'Unrelated thing' }).thumbnailUrl).toBe('/img/cover.png');
  });

  it('returns nothing without a story', () => {
    expect(pickThumbnail(undefined, { name: 'x' })).toEqual({ thumbnailUrl: null, thumbnailStoryId: null });
  });
});
