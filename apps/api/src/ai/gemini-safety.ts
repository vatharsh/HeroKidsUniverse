import { HarmBlockThreshold, HarmCategory } from '@google/generative-ai';

/**
 * Strictest-practical Gemini safety filters for a children's product. Sexual content is blocked at
 * the lowest level; the rest at "medium" so ordinary adventure peril (a villain, a storm) still works.
 */
export const GEMINI_CHILD_SAFETY_SETTINGS = [
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
];

/** Appended to every picture request. */
export const CHILD_SAFE_IMAGE_RULE =
  'CHILD-SAFE PICTURE for a 4–12 year old reader: everyone fully and modestly clothed; no blood, wounds, injuries or gore; ' +
  'no weapon pointed at or hurting anyone; nothing horror-like or frightening; no smoking, alcohol or drugs; no romance or kissing.';

/** Second try after the image model refused to draw: same scene, told plainly and gently. */
export const GENTLE_REDRAW_NOTE =
  CHILD_SAFE_IMAGE_RULE + ' Keep this a calm, gentle, wholesome storybook picture: friendly faces, everyone fully dressed exactly as on ' +
  'their character sheets (long sleeves and full-length clothes are fine), relaxed poses, no close-ups of bodies, a bright happy mood.';

/** True when a Gemini response was stopped by its safety filters. */
export function isGeminiSafetyStop(
  finishReason?: string | null,
  blockReason?: string | null,
): boolean {
  return (
    !!blockReason ||
    [
      'SAFETY',
      'IMAGE_SAFETY',
      'PROHIBITED_CONTENT',
      'BLOCKLIST',
      'SPII',
    ].includes(String(finishReason ?? ''))
  );
}

/**
 * Clothing words that make Gemini's image filter refuse pictures of children ("PROHIBITED_CONTENT") even in
 * an innocent outfit — e.g. "baggy trousers, loose linen shirt" was refused for a 7-year-old while the same
 * outfit without them was drawn every time. Dropped from outfit text before it reaches an image prompt (longer forms listed first so they match whole).
 */
const RISKY_CLOTHING_WORDS = /\b(loose-fitting|tight-fitting|skin-tight|bare-chested|see-through|loose|baggy|tight|skimpy|revealing|sheer|bare|shirtless|topless|midriff|cropped)\b[\s-]*/gi;

export function childSafeOutfit(text: string): string;
export function childSafeOutfit(text: string | null | undefined): string | null;
export function childSafeOutfit(text: string | null | undefined): string | null {
  if (!text) return text ?? null;
  return text.replace(RISKY_CLOTHING_WORDS, '').replace(/\s{2,}/g, ' ').replace(/\s+([,.;])/g, '$1').trim();
}
