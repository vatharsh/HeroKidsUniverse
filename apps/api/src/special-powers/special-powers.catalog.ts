/** Ready-made special powers for Admin → Hidden Powers (one click to schedule). */
export const POWER_SUGGESTIONS: Array<{ name: string; emoji: string; description: string }> = [
  { name: 'Comet Shield', emoji: '☄️', description: 'A glowing shield made from a comet’s tail that blocks any danger.' },
  { name: 'Diwali Light', emoji: '🪔', description: 'A tiny diya flame that lights up any darkness and shows hidden paths.' },
  { name: 'Rainbow Bridge', emoji: '🌈', description: 'Creates a rainbow you can walk across to reach far-away places.' },
  { name: 'Whisper of the Wind', emoji: '🌬️', description: 'Lets the hero hear secrets carried by the wind.' },
  { name: 'Starlight Map', emoji: '🗺️', description: 'A map drawn in starlight that shows the way home from anywhere.' },
  { name: 'Peacock Feather of Courage', emoji: '🦚', description: 'Gives the hero extra courage when they feel scared.' },
  { name: 'Tiny-Tiny Shrink', emoji: '🐜', description: 'Shrinks the hero to ant size to sneak through tiny places.' },
  { name: 'Mango Magic', emoji: '🥭', description: 'One bite gives the hero super-speed for a whole minute.' },
  { name: 'Moon Boots', emoji: '🌙', description: 'Boots that let the hero jump as high as the clouds.' },
  { name: 'Animal Talk', emoji: '🐘', description: 'The hero can understand and talk to any animal.' },
  { name: 'Thunder Clap', emoji: '⚡', description: 'One clap makes a friendly thunder that scares away bullies.' },
  { name: 'Lotus Bubble', emoji: '🪷', description: 'A lotus-shaped bubble that lets the hero breathe underwater.' },
  { name: 'Kite of the Skies', emoji: '🪁', description: 'A magic kite that can carry the hero over mountains.' },
  { name: 'Mirror of Kindness', emoji: '🪞', description: 'Shows the good side of anyone the hero meets.' },
  { name: 'Snow Spark', emoji: '❄️', description: 'Freezes trouble for ten seconds — just enough time to think.' },
  { name: 'Golden Compass', emoji: '🧭', description: 'Always points to whoever needs the hero’s help.' },
  { name: 'Dragon Breath (Friendly)', emoji: '🐉', description: 'A warm puff of dragon breath that keeps friends cosy.' },
  { name: 'Laughing Spell', emoji: '😂', description: 'Makes even grumpy villains burst into giggles.' },
  { name: 'Invisible Cloak', emoji: '🫥', description: 'Turns the hero invisible for a little while.' },
  { name: 'Seed of the Giant Tree', emoji: '🌱', description: 'Grows a giant tree in seconds to climb, hide in or shelter under.' },
  { name: 'Holi Colour Burst', emoji: '🎨', description: 'A burst of colours that brings joy and breaks sad spells.' },
  { name: 'Echo Shout', emoji: '📣', description: 'The hero’s voice echoes across the whole universe to call friends.' },
  { name: 'Time-Pause Watch', emoji: '⏱️', description: 'Pauses time for five seconds — once per adventure.' },
  { name: 'Healing Hug', emoji: '🤗', description: 'A hug that heals scrapes and cheers up sad hearts.' },
];

/** Hero levels by special powers found. Rewards go to the parent's account automatically. */
export const POWER_LEVELS: Array<{ at: number; name: string; badge: string; reward: 'none' | 'avatar_refresh' | 'story_credit'; rewardText: string }> = [
  { at: 3, name: 'Bronze Hero', badge: '🥉', reward: 'none', rewardText: 'Bronze Hero badge' },
  { at: 6, name: 'Silver Hero', badge: '🥈', reward: 'avatar_refresh', rewardText: 'Silver Hero badge + 1 free Avatar Refresh' },
  { at: 10, name: 'Gold Hero', badge: '🥇', reward: 'story_credit', rewardText: 'Gold Hero badge + 1 free story' },
];

export function levelFor(count: number) {
  const reached = [...POWER_LEVELS].reverse().find((l) => count >= l.at) ?? null;
  const next = POWER_LEVELS.find((l) => count < l.at) ?? null;
  return { count, level: reached, next, toNext: next ? next.at - count : 0 };
}
