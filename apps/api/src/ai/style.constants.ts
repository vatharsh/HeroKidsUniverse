/**
 * Single source of truth for the visual style used across all image generation
 * (avatars, scene illustrations, backgrounds). Semi-realistic cinematic 3D —
 * Pixar/DreamWorks quality render. Committing to one register means the avatar
 * and every story page share the same look, eliminating style-translation drift.
 */
export const STORYBOOK_STYLE =
  'warm cinematic 3D render, Pixar/DreamWorks quality — think Coco or Encanto visual quality, ' +
  'semi-realistic skin texture with stylised warmth, volumetric lighting, ' +
  'IDENTITY-FAITHFUL faces — preserve exact face shape, skin tone, hair style/colour, ' +
  'eye shape, age, and every distinctive feature (glasses, dimples, beard, moles, etc.) from the reference, ' +
  'Indian family warmth, rich saturated cinematic environments with depth and atmosphere, ' +
  'clean visual space for app-rendered speech bubble overlays';

/**
 * Background-only scenes — same style so characters composite seamlessly.
 */
export const BACKGROUND_SCENE_STYLE =
  'warm cinematic 3D render, Pixar/DreamWorks quality — think Coco or Encanto visual quality, ' +
  'volumetric lighting, rich saturated cinematic environments with depth and atmosphere, ' +
  'Indian warmth and colour palette, wide cinematic composition';

/**
 * Avatar portrait style — must exactly match STORYBOOK_STYLE so the avatar
 * sits naturally inside story illustrations without any style gap.
 */
export const AVATAR_STYLE =
  'warm cinematic 3D portrait render, Pixar/DreamWorks quality — Coco or Encanto level detail, ' +
  'semi-realistic skin texture with stylised warmth, volumetric studio lighting, ' +
  'RENDERING STYLE CHANGE ONLY — face geometry stays identical: ' +
  'same face shape, skin tone, hairstyle/colour/length, eye shape, nose, lips, jaw, age, expression, ' +
  'and every distinctive feature (glasses, beard, dimples, moles, freckles, braces, etc.). ' +
  'Indian family warmth, soft cinematic studio lighting, clean neutral gradient background. ' +
  'The person must be instantly recognisable compared to the reference.';
