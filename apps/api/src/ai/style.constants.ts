/**
 * Single source of truth for the visual style used across all image generation
 * (avatars, scene illustrations, backgrounds).  Cartoon style is intentional —
 * committing to one register means the avatar and every story page share the
 * same look, so there is zero style-translation drift between them.
 */
export const STORYBOOK_STYLE =
  'warm painterly 2D cartoon, children\'s storybook illustration style, ' +
  'Pixar-adjacent proportions are fine, ' +
  'IDENTITY-FAITHFUL faces — preserve exact face shape, skin tone, hair style/colour, ' +
  'eye shape, age, and distinctive features (glasses, dimples, etc.) from the reference, ' +
  'Indian family warmth, rich colourful environments, ' +
  'clean visual space for app-rendered speech bubble overlays';

/**
 * Same style for background-only scenes (overlay mode) — identical style string
 * so avatars composite seamlessly onto the background.
 */
export const BACKGROUND_SCENE_STYLE =
  'warm painterly 2D cartoon, children\'s storybook illustration style, ' +
  'Pixar-adjacent proportions are fine, ' +
  'Indian family warmth, rich colourful environments, wide cinematic composition';

/**
 * Avatar portrait style — must match STORYBOOK_STYLE so the avatar sits naturally
 * inside story illustrations without a style gap.
 */
export const AVATAR_STYLE =
  'warm painterly 2D cartoon children\'s storybook portrait style, ' +
  'Pixar-adjacent proportions are fine, ' +
  'IDENTITY-FAITHFUL — the output must be instantly recognisable as the same person: ' +
  'same face shape, skin tone, hair style/colour/length, eye shape, age, smile, ' +
  'and any distinctive features (glasses, dimples, freckles, braces, etc.). ' +
  'Indian family warmth, soft studio lighting, clean neutral background';
