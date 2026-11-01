/**
 * The Power Book: 32 special powers in 4 collections of 8. Power days drop these (balanced across
 * collections); completing whole collections levels a hero up. Admin-written powers are "Bonus" —
 * collectable, but they never count towards levels.
 */
export type CollectionKey = 'earth' | 'sky' | 'festivals' | 'heart';

export const COLLECTIONS: Array<{ key: CollectionKey; name: string; emoji: string }> = [
  { key: 'earth', name: 'Earth & Nature', emoji: '🌍' },
  { key: 'sky', name: 'Sky & Space', emoji: '🌌' },
  { key: 'festivals', name: 'Festivals of India', emoji: '🪔' },
  { key: 'heart', name: 'Heart Powers', emoji: '💖' },
];

export interface LibraryPower { key: string; collection: CollectionKey; name: string; emoji: string; description: string }

export const POWER_LIBRARY: LibraryPower[] = [
  // 🌍 Earth & Nature
  { key: 'giant-tree-seed', collection: 'earth', name: 'Seed of the Giant Tree', emoji: '🌱', description: 'Grows a giant tree in seconds to climb, hide in or shelter under.' },
  { key: 'animal-talk', collection: 'earth', name: 'Animal Talk', emoji: '🐘', description: 'The hero can understand and talk to any animal.' },
  { key: 'lotus-bubble', collection: 'earth', name: 'Lotus Bubble', emoji: '🪷', description: 'A lotus-shaped bubble that lets the hero breathe underwater.' },
  { key: 'wind-whisper', collection: 'earth', name: 'Whisper of the Wind', emoji: '🌬️', description: 'Lets the hero hear secrets carried by the wind.' },
  { key: 'tiny-shrink', collection: 'earth', name: 'Tiny-Tiny Shrink', emoji: '🐜', description: 'Shrinks the hero to ant size to sneak through tiny places.' },
  { key: 'mango-magic', collection: 'earth', name: 'Mango Magic', emoji: '🥭', description: 'One bite gives the hero super-speed for a whole minute.' },
  { key: 'friendly-dragon-breath', collection: 'earth', name: 'Dragon Breath (Friendly)', emoji: '🐉', description: 'A warm puff of dragon breath that keeps friends cosy.' },
  { key: 'river-song', collection: 'earth', name: 'River Song', emoji: '🏞️', description: 'A song that calms angry rivers and makes them carry the hero safely.' },
  // 🌌 Sky & Space
  { key: 'comet-shield', collection: 'sky', name: 'Comet Shield', emoji: '☄️', description: 'A glowing shield made from a comet’s tail that blocks any danger.' },
  { key: 'moon-boots', collection: 'sky', name: 'Moon Boots', emoji: '🌙', description: 'Boots that let the hero jump as high as the clouds.' },
  { key: 'starlight-map', collection: 'sky', name: 'Starlight Map', emoji: '🗺️', description: 'A map drawn in starlight that shows the way home from anywhere.' },
  { key: 'sky-kite', collection: 'sky', name: 'Kite of the Skies', emoji: '🪁', description: 'A magic kite that can carry the hero over mountains.' },
  { key: 'thunder-clap', collection: 'sky', name: 'Thunder Clap', emoji: '⚡', description: 'One clap makes a friendly thunder that scares away bullies.' },
  { key: 'rainbow-bridge', collection: 'sky', name: 'Rainbow Bridge', emoji: '🌈', description: 'Creates a rainbow you can walk across to reach far-away places.' },
  { key: 'snow-spark', collection: 'sky', name: 'Snow Spark', emoji: '❄️', description: 'Freezes trouble for ten seconds — just enough time to think.' },
  { key: 'sun-spark', collection: 'sky', name: 'Sun Spark', emoji: '☀️', description: 'A pocket of sunshine that warms, lights and cheers up any gloomy place.' },
  // 🪔 Festivals of India
  { key: 'diwali-light', collection: 'festivals', name: 'Diwali Light', emoji: '🪔', description: 'A tiny diya flame that lights up any darkness and shows hidden paths.' },
  { key: 'holi-colour-burst', collection: 'festivals', name: 'Holi Colour Burst', emoji: '🎨', description: 'A burst of colours that brings joy and breaks sad spells.' },
  { key: 'rakhi-thread', collection: 'festivals', name: 'Rakhi Thread of Protection', emoji: '🧵', description: 'A shining thread that keeps the hero’s brothers, sisters and friends safe.' },
  { key: 'eid-crescent-glow', collection: 'festivals', name: 'Eid Crescent Glow', emoji: '🌛', description: 'A gentle moonglow that turns strangers into friends.' },
  { key: 'christmas-star', collection: 'festivals', name: 'Christmas Star', emoji: '🌟', description: 'A bright star that guides the hero to anyone who is lost.' },
  { key: 'pongal-sweet-pot', collection: 'festivals', name: 'Pongal Sweet Pot', emoji: '🍯', description: 'A pot that never runs out of sweet pongal to share with everyone.' },
  { key: 'onam-flower-carpet', collection: 'festivals', name: 'Onam Flower Carpet', emoji: '🌸', description: 'A carpet of flowers that flies the hero wherever they need to go.' },
  { key: 'navratri-dandiya-spin', collection: 'festivals', name: 'Navratri Dandiya Spin', emoji: '🪘', description: 'A spinning dance so fast it whirls the hero out of any trap.' },
  // 💖 Heart Powers
  { key: 'healing-hug', collection: 'heart', name: 'Healing Hug', emoji: '🤗', description: 'A hug that heals scrapes and cheers up sad hearts.' },
  { key: 'kindness-mirror', collection: 'heart', name: 'Mirror of Kindness', emoji: '🪞', description: 'Shows the good side of anyone the hero meets.' },
  { key: 'courage-feather', collection: 'heart', name: 'Peacock Feather of Courage', emoji: '🦚', description: 'Gives the hero extra courage when they feel scared.' },
  { key: 'laughing-spell', collection: 'heart', name: 'Laughing Spell', emoji: '😂', description: 'Makes even grumpy villains burst into giggles.' },
  { key: 'golden-compass', collection: 'heart', name: 'Golden Compass', emoji: '🧭', description: 'Always points to whoever needs the hero’s help.' },
  { key: 'echo-shout', collection: 'heart', name: 'Echo Shout', emoji: '📣', description: 'The hero’s voice echoes across the whole universe to call friends.' },
  { key: 'invisible-cloak', collection: 'heart', name: 'Invisible Cloak', emoji: '🫥', description: 'Turns the hero invisible for a little while.' },
  { key: 'time-pause-watch', collection: 'heart', name: 'Time-Pause Watch', emoji: '⏱️', description: 'Pauses time for five seconds — once per adventure.' },
];

export const LIBRARY_BY_KEY = new Map(POWER_LIBRARY.map((p) => [p.key, p]));

export type RewardKind = 'none' | 'avatar_refresh' | 'story_credit' | 'two_story_credits';

/** Levels by complete collections. Rewards go to the parent's account automatically (once). */
export const POWER_LEVELS: Array<{ sets: number; key: string; name: string; badge: string; reward: RewardKind; rewardText: string }> = [
  { sets: 1, key: 'bronze', name: 'Bronze Hero', badge: '🥉', reward: 'none', rewardText: 'Bronze frame around the hero' },
  { sets: 2, key: 'silver', name: 'Silver Hero', badge: '🥈', reward: 'avatar_refresh', rewardText: 'Silver frame + 1 free Avatar Refresh' },
  { sets: 3, key: 'gold', name: 'Gold Hero', badge: '🥇', reward: 'story_credit', rewardText: 'Gold frame + 1 free story' },
  { sets: 4, key: 'platinum', name: 'Platinum Legend', badge: '💎', reward: 'two_story_credits', rewardText: 'Shimmering platinum frame + 2 free stories + “Legend” title' },
];

export type PowerLevel = (typeof POWER_LEVELS)[number];

/** A hero's progress from the library keys they've found. */
export function progressFor(foundKeys: Iterable<string>) {
  const found = new Set(foundKeys);
  const collections = COLLECTIONS.map((c) => {
    const powers = POWER_LIBRARY.filter((p) => p.collection === c.key);
    const have = powers.filter((p) => found.has(p.key)).length;
    return { ...c, have, total: powers.length, complete: have === powers.length };
  });
  const completeSets = collections.filter((c) => c.complete).length;
  const level = [...POWER_LEVELS].reverse().find((l) => completeSets >= l.sets) ?? null;
  const next = POWER_LEVELS.find((l) => completeSets < l.sets) ?? null;
  // The closest collection to finishing, for hints like "3 more Sky & Space powers for Bronze".
  const closest = collections.filter((c) => !c.complete).sort((a, b) => (b.have / b.total) - (a.have / a.total))[0] ?? null;
  return {
    count: [...found].filter((k) => LIBRARY_BY_KEY.has(k)).length,
    total: POWER_LIBRARY.length,
    completeSets,
    level,
    next,
    closest: closest ? { name: closest.name, emoji: closest.emoji, missing: closest.total - closest.have } : null,
    collections,
  };
}
