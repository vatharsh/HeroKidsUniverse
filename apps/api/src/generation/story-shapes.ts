/**
 * Plot shapes for universe episodes. Each episode gets one that the last few episodes didn't use —
 * without this every story came out as "find the glowing relic, soothe a monster, ask what ancient
 * mystery lies next".
 */
export interface StoryShape {
  key: string;
  label: string;
  brief: string;
}

export const STORY_SHAPES: StoryShape[] = [
  { key: 'rescue', label: 'Rescue', brief: 'Someone the hero cares about (a friend, a family member, a creature) is trapped or taken. The hero must reach them and get them out.' },
  { key: 'mystery', label: 'Mystery', brief: 'Something strange keeps happening. The hero follows real clues, suspects the wrong person once, then unmasks the true culprit.' },
  { key: 'race', label: 'Race against time', brief: 'A clear deadline — before sunset, before the tide comes in, before the festival starts. Show the clock running out.' },
  { key: 'trickster', label: 'Trickster', brief: 'The villain plays clever tricks and illusions. The hero cannot win by strength — only by out-thinking the trickster.' },
  { key: 'contest', label: 'Contest', brief: 'The hero enters a contest or tournament of courage and cleverness against a rival who cheats. Three rounds, the last one the hardest.' },
  { key: 'festival', label: 'Festival in danger', brief: 'An Indian festival (Diwali, Holi, Onam, Pongal, Eid, Ganesh Chaturthi or similar) is about to be ruined. The hero saves the celebration.' },
  { key: 'misunderstood', label: 'Misunderstood creature', brief: 'Everyone blames a strange creature for the trouble. The hero discovers it is innocent and helps find who is really behind it.' },
  { key: 'return', label: 'Return the treasure', brief: 'A treasure was stolen from where it belongs. The hero sneaks into the villain\'s lair to take it back and return it.' },
  { key: 'journey', label: 'Journey home', brief: 'The hero is stranded somewhere far away and must find a way back home, meeting a helper and crossing three obstacles.' },
  { key: 'invention', label: 'Clever invention', brief: 'The problem can\'t be solved with what they have. The hero designs and builds a clever gadget, it fails once, then works.' },
  { key: 'mishap', label: 'Magical mishap', brief: 'A spell or gadget goes wrong — the hero shrinks, time freezes, or two characters swap places — and must undo it.' },
  { key: 'guardian', label: 'Guardian\'s test', brief: 'An ancient guardian tests the hero\'s heart (honesty, kindness, patience) before handing over something precious.' },
];

/** Picks a shape the recent episodes didn't use, so consecutive stories feel different. */
export function pickStoryShape(recentShapeKeys: Array<string | null | undefined>, random: () => number = Math.random): StoryShape {
  const recent = new Set(recentShapeKeys.filter((k): k is string => !!k).slice(0, 4));
  const fresh = STORY_SHAPES.filter((s) => !recent.has(s.key));
  const pool = fresh.length ? fresh : STORY_SHAPES;
  return pool[Math.floor(random() * pool.length)];
}
