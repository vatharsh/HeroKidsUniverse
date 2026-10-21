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
