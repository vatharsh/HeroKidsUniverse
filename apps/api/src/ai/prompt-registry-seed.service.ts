import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PromptTemplateVersion } from './entities/prompt-template-version.entity';
import { PromptTemplate } from './entities/prompt-template.entity';
import { PromptRegistryService } from './prompt-registry.service';


const PLACEHOLDER_TEXT =
  '[Prompt text managed in code — see service implementation. Migrate here when ready.]';

const SEED_PROMPTS: Array<{
  promptKey: string;
  name: string;
  promptType: string;
  provider: string;
  defaultModel: string;
  promptText: string;
  variablesJson?: object;
  changeNotes: string;
}> = [
  {
    promptKey: 'story_generation',
    name: 'Story Generation',
    promptType: 'story_generation',
    provider: 'gemini',
    defaultModel: 'gemini-2.5-flash-lite',
    variablesJson: {
      required: ['heroName', 'heroAge', 'heroGender', 'heroRef', 'pageCount', 'sceneCount', 'climaxPage', 'supportingCharactersLine', 'visualIdentityLines', 'sceneEntries'],
      optional: ['customStoryDirective', 'themeDescriptionLine', 'universeSection', 'visualStateSection', 'storySourceLine'],
    },
    changeNotes: 'v2 — full prompt template with {{variable}} placeholders; code injects all dynamic values, DB controls all rules and structure.',
    promptText: `You are a creative children's storybook author for HeroKids Universe.
{{customStoryDirective}}
Hero details:
- Name: {{heroName}}
- Age: {{heroAge}}
- Gender: {{heroGender}}
{{themeDescriptionLine}}
{{supportingCharactersLine}}
{{universeSection}}

Write a {{pageCount}}-page illustrated storybook where {{heroRef}} is the main character.

CANONICAL VISUAL IDENTITY RULES FOR THE ILLUSTRATOR:
{{visualIdentityLines}}

Do NOT invent new facial features, glasses, bindis, moustaches, hairstyles, age changes, body type changes, or clothing for these named people unless explicitly stated above.
Each named character should appear as the same person on every page. If the scene has multiple children, do not duplicate one child's face for another child.
{{visualStateSection}}

Rules:
- Each page: 2-3 short sentences (max 40 words per page) suitable for age {{heroAge}}
- Use simple, exciting language kids love
- Include dialogue and warm emotion
- Build to a joyful climax on page {{climaxPage}}
- Page {{pageCount}}: resolve happily — end with a soft sentence hinting at the next adventure
- The hero always succeeds through kindness, courage, or cleverness — never violence
{{storySourceLine}}
- In every sceneDescription: explicitly name the costume, companion, and weapon from the Story Visual State — do not leave them out
- In characters: always describe the expression and pose for the main hero on every page
- Speech bubbles: only add dialogue if it adds to the scene; avoid generic exclamations

CRITICAL SCENE DESCRIPTION RULE:
Each sceneDescription must describe EVERY character who appears with their FULL visual identity locked in parentheses — age, skin tone, hair, clothing, and current expression. Use the canonical identity above. Repeat the full description every time a character appears (even if they appeared on previous pages) — the illustrator sees only one page at a time.
Example: "Siddhant (8-year-old boy, warm brown skin, short straight black hair, black t-shirt, excited wide grin) reaches toward the glowing stone, while his father (40s Indian man, medium brown skin, short black hair with slight grey, white collared shirt, warm proud smile) watches from behind."
Supporting characters without a reference photo must still have a fixed, consistent appearance description that does NOT change across pages.

SCENE RULES:
- There are exactly {{sceneCount}} scenes covering all {{pageCount}} pages. Each scene produces ONE shared illustration used across its pages.
- Scene 1 must be the most visually striking — it doubles as the story cover.
- Each scene must look visually DISTINCT from every other scene — different location, lighting, composition, or action.
- NEVER reuse the same setting, character grouping, or colour palette across two consecutive scenes.

ILLUSTRATION BRIEF RULES (for the illustrationBrief field):
- Start with composition style: "WIDE CINEMATIC:" or "DYNAMIC ACTION:" or "INTIMATE SCENE:" or "CLOSE-UP PORTRAIT:"
- Describe who is in the scene, their exact positions (e.g. "hero left-center, villain right"), what they are doing, costume, lighting, mood.
- End with: "No text, no speech bubbles, characters with safe margins from edges."
- Length: 3-5 sentences. Make each scene brief visually DISTINCT from the others.

CROP HINT:
- First page of each scene: "full_width" (full establishing shot).
- Second page of a scene (if present): "zoom_center" (slightly tighter on the action).

SPEECH BUBBLE PLACEMENT RULES:
- Speech bubbles are rendered later by the app, not drawn into images.
- Use structured preferredPosition + tailDirection so the bubble sits near the speaker and the tail points toward the mouth/lower face.
- If speaker stands LEFT, prefer "top-right" with tailDirection "down-left".
- If speaker stands RIGHT, prefer "top-left" with tailDirection "down-right".
- If speaker stands CENTER, alternate "top-left" and "top-right".
- Avoid covering face, eyes, mouth, hands, or important action.

CHARACTER DIRECTION RULES:
- Every named character visible in a scene MUST appear in characterDirections.
- visible: true if character appears in the frame, false if off-screen.
- position: where the character stands in the frame — "left", "center", "right", "foreground", or "background". Be specific; the image model uses this to place the character.
- expression must be CONCRETE: not "happy" but "wide grin, sparkling eyes, eyebrows raised in delight".
- expressionDetails must include eyes, mouth, eyebrows, gaze, and headTilt.
- mouthState: "speaking" if a speech bubble belongs to them, "smiling", "surprised", or "closed" otherwise.
- action: a vivid verb phrase describing what they are doing RIGHT NOW on this page.
- lookingAt: what their gaze targets (e.g. "the glowing stone", "the villain", "camera").
- isSpeaking: true for exactly one character per speechBubble entry.
- If a character is speaking: expressionDetails.mouth = "open, mid-sentence".

SPEECH BUBBLE RULES:
- speechBubbles carries the structured rendering metadata — the frontend places them; they are NEVER baked into the AI image.
- Also populate the dialogue array (legacy) with the same lines for backward compatibility.
- REQUIRED FIELDS: speakerName, text, bubbleStyle, preferredPosition, tailDirection.
- Also include anchorTarget: "mouth" or "lower_face".
- speakerName: MUST be the exact name of a character who appears on that page.
- text: short child-friendly spoken line, max 12 words. Must be dialogue, not narration.
- bubbleStyle: "normal" | "excited" | "whisper" | "thinking" | "surprised"
- preferredPosition: where the bubble should float — pick based on where the character stands:
    Character on LEFT → "bottom-left"
    Character on RIGHT → "bottom-right"
    Character at top of frame → "top-left" or "top-right"
    Default: "bottom-left" for first speaker, "bottom-right" for second speaker.
- tailDirection: direction the tail points FROM the bubble TOWARD the speaker's mouth:
    Bubble bottom-left, character above-right → "up-right"
    Bubble bottom-right, character above-left → "up-left"
    Bubble top-left, character below-right → "down-right"
    Bubble top-right, character below-left → "down-left"
- avoidCovering: list body parts to avoid: ["face"] always, add "hands" if the character's hands are in focus.
- maxWidthPercent: 44 (leave the other half of the image clear).
- Max 2 speechBubbles per page. Set speechBubbles to [] if no one speaks. Do NOT invent dialogue.

STORY STATE UPDATE RULES:
- storyStateUpdate must be present on every page, even if all arrays are empty.
- Only set newItems/removedItems if the story explicitly gives or takes an item.
- Only set costumeChange if the story explicitly changes the hero's outfit.
- locationChange: set if the scene moves to a new place.
- Powers persist unless explicitly lost.
- Items persist unless explicitly lost or used up.

Respond with ONLY valid JSON (no markdown, no code fences):
{
  "title": "Story title here",
  "cliffhanger": "One sentence hinting at the next adventure",
  "storyVisualState": {
    "costume": "Describe the hero's full costume for this story",
    "companion": "Companion name and type, or null",
    "weapon": "Primary weapon or item, or null",
    "powers": ["Power 1", "Power 2"],
    "inventory": ["Item 1", "Item 2"]
  },
  "newPowers": [],
  "newQuests": [],
  "newMemories": [],
  "scenes": [
{{sceneEntries}}
  ],
  "pages": []
}

IMPORTANT: The "pages" array MUST be empty []. All pages must be inside "scenes". This is required.
newMemories type must be one of: character_met, villain_defeated, power_earned, item_found, location_discovered, quest_opened, quest_completed, achievement_unlocked
newPowers and newQuests may be empty arrays if none were earned/opened.
background: one sentence, specific location + time of day + lighting mood
camera: choose from: wide angle, medium shot, close-up on face, low angle looking up, bird's eye view, over-the-shoulder
characters: EVERY named character visible in the scene must appear with expression + pose
dialogue: only lines that are spoken aloud (not thoughts); omit if no one speaks; max 2 dialogues per page
storyVisualState: for universe stories this reflects the hero's current look; for standalone stories design it to match the theme.
characterDirections: required for every page; at minimum include the hero with expression and pose.
speechBubbles: structured dialogue metadata; also echo in dialogue array for backward compat.
storyStateUpdate: required on every page; use empty arrays when nothing changes.`,
  },

  {
    promptKey: 'image_generation',
    name: 'Image Generation',
    promptType: 'image_generation',
    provider: 'openai',
    defaultModel: 'gpt-image-1',
    variablesJson: {
      required: ['style', 'heroIdentityLine', 'sceneDescription'],
      optional: ['referenceOrderLine', 'storyStateLockLine', 'castLine', 'characterDirectionLine', 'cameraLine', 'faceVisibilityLine', 'identityBoostLine'],
    },
    changeNotes: 'v2 — full prompt template with {{variable}} placeholders; code injects all computed blocks, DB controls structure and rules.',
    promptText: `{{style}}
{{referenceOrderLine}}
{{heroIdentityLine}}
{{storyStateLockLine}}
{{castLine}}
{{characterDirectionLine}}
{{cameraLine}}
{{faceVisibilityLine}}
{{identityBoostLine}}
{{sceneDescription}}
If the scene description conflicts with the reference portraits or identity descriptions, ignore the conflicting visual detail and follow the identity descriptions/reference portraits.
IDENTITY LOCK: do not turn people into generic cartoon archetypes. Do not add glasses, bindis, moustaches, jewellery, white hair, facial hair, or age changes unless the identity description or reference image has them.
CAST LOCK: draw only the named characters required by the scene. Do not duplicate a child face for another child. Each named person must remain visually distinct and consistent across pages.
Child-safe, joyful and adventurous atmosphere. NO text, NO words, NO letters, NO speech bubbles, NO captions, NO written dialogue anywhere in the image. Leave clean visual space where speech bubbles will be overlaid.`,
  },

  {
    promptKey: 'identity_qa',
    name: 'Identity QA',
    promptType: 'identity_qa',
    provider: 'openai',
    defaultModel: 'gpt-4o-mini',
    variablesJson: { required: ['heroName'] },
    changeNotes: 'Initial seed — extracted from OpenAIImageProvider.checkFaceConsistency(). Code reads this at runtime.',
    promptText: `Image 1 is the approved cartoon avatar of a child named {{heroName}}. Image 2 is a generated storybook illustration that must depict the same child.
Compare face identity: face shape, skin tone, hairstyle, hair colour, eye shape, age, glasses/accessories, distinctive features.
Score consistency 1–10 (10 = near-perfect match, 1 = completely different child).
Return ONLY valid JSON:
{"identityScore": 8, "issues": ["hairstyle lengthened"], "recommendation": "accept"}
recommendation = "accept" when identityScore >= 7; "regenerate" when < 7. issues is empty array if none.`,
  },

  {
    promptKey: 'character_canon',
    name: 'Character Canon Generation',
    promptType: 'character_canon',
    provider: 'openai',
    defaultModel: 'gpt-4o-mini',
    variablesJson: { required: ['avatarDescription'] },
    changeNotes: 'Initial seed — extracted from CharacterCanonService.generateCanonFromAvatar(). Code reads this at runtime.',
    promptText: `You are analyzing a children's storybook avatar to extract a detailed character canon for consistent future illustration.

Avatar description: "{{avatarDescription}}"

Return ONLY valid JSON matching this exact structure (no markdown):
{
  "identityJson": {
    "approximate_age_range": "e.g. 7-9 years",
    "gender_presentation_if_clear": "boy/girl/unclear",
    "skin_tone": "e.g. warm medium brown",
    "face_shape": "e.g. round with soft cheeks",
    "facial_proportions": "e.g. wide forehead, compact lower face",
    "eye_shape": "e.g. almond-shaped, slightly upturned",
    "eye_color_if_clear": "e.g. dark brown or null",
    "eyebrow_shape": "e.g. naturally arched, medium thickness",
    "nose_shape": "e.g. small button nose",
    "mouth_shape": "e.g. medium width, slightly full lips",
    "smile_description": "e.g. wide open smile with visible teeth",
    "cheek_description": "e.g. round full cheeks",
    "jawline_description": "e.g. soft rounded jawline",
    "ear_visibility": "e.g. partially visible or hidden",
    "hairstyle": "e.g. short straight black hair with fringe",
    "hair_color": "e.g. very dark brown/black",
    "hair_length": "e.g. short, above ears",
    "hair_texture": "e.g. straight and fine",
    "build_visible": "e.g. slim or null if not visible",
    "expression_default": "e.g. cheerful and bright",
    "glasses": false,
    "facial_hair": false,
    "jewellery": null,
    "bindi": false,
    "freckles": false,
    "moles": null,
    "dimples": true,
    "braces": false,
    "other_distinctive_features": [],
    "visual_rules": {
      "must_preserve": ["face shape", "skin tone", "hairstyle", "hair color", "eye shape", "smile", "age appearance", "dimples"],
      "must_not_add": ["glasses", "facial hair", "bindi", "jewellery", "different hairstyle", "different skin tone"],
      "must_not_change": ["face shape", "skin tone", "hairstyle", "age appearance"],
      "acceptable_variations": ["clothing", "lighting", "background", "facial expression within age-appropriate range"]
    }
  },
  "appearanceSummary": "One dense paragraph (60-90 words) describing this character for a storybook illustrator, covering face, hair, skin, distinctive features, and style. This will be injected directly into image generation prompts.",
  "neverChangeRules": [
    "Never change the child's hairstyle.",
    "Never change the skin tone.",
    "Never enlarge the eyes into generic cartoon eyes.",
    "Never change the face shape.",
    "Never make the child look older or younger.",
    "Never add glasses — not present in approved avatar.",
    "Never add facial hair.",
    "Never remove dimples — present in approved avatar.",
    "Never make the character look like a generic cartoon child."
  ],
  "distinctiveFeatures": ["dimples", "short black fringe"],
  "faceMetrics": {
    "face_width_category": "medium",
    "face_length_category": "short",
    "eye_size_category": "medium",
    "eye_spacing_category": "medium",
    "nose_size_category": "small",
    "mouth_width_category": "medium",
    "cheek_fullness_category": "full",
    "chin_shape": "round",
    "forehead_visibility": "full",
    "overall_face_silhouette": "round"
  },
  "qualityScore": 85
}

qualityScore guidelines (0–100):
- Deduct 30 if no face clearly visible
- Deduct 20 if face is very small or distant
- Deduct 10 if face is partially obscured
- Deduct 10 if image is low quality/blurry
- Deduct 5 for each distinctive feature that cannot be confirmed
- Full score if face is clear, front or three-quarter angle, well-lit`,
  },

  {
    promptKey: 'character_vision',
    name: 'Character Vision Analysis',
    promptType: 'character_vision',
    provider: 'openai',
    defaultModel: 'gpt-4o-mini',
    variablesJson: { required: ['imageUrl'] },
    changeNotes: 'Initial seed — used by OpenAIImageProvider.describeCharacterAppearanceFromUrl().',
    promptText: `Describe the character's physical appearance in this image for storybook illustration consistency.
Focus on: face shape, skin tone, hairstyle, hair colour, eye shape, age appearance, distinctive features, clothing style.
Be specific and concrete — this description will be used to instruct an AI image generator to reproduce the same child consistently.
Return a single dense paragraph (60–100 words). Do not use bullet points.`,
  },

  {
    promptKey: 'narration',
    name: 'Narration (TTS)',
    promptType: 'narration',
    provider: 'openai',
    defaultModel: 'gpt-4o-mini-tts',
    variablesJson: { required: ['pageText'], optional: ['voice', 'speedRatio', 'accentStyle', 'tone'] },
    changeNotes: 'Initial seed — TTS instructions managed via platform settings (TTS_VOICE, TTS_SPEED_RATIO, TTS_ACCENT_STYLE, TTS_TONE).',
    promptText: `[TTS INSTRUCTIONS — v1.0]
Voice: {{voice}} (OpenAI TTS voice name)
Speed: {{speedRatio}}
Accent style: {{accentStyle}}
Tone: {{tone}}

Narration text to synthesise:
{{pageText}}

Delivery guidelines:
- Clear neutral Indian English, like a warm Indian parent or grandparent telling a bedtime story
- Natural Indian pronunciation and rhythm; avoid American audiobook vowel sounds and British documentary style
- Medium-slow pace for children aged 5–12, with clear syllables
- Bedtime story tone: soothing but animated enough to hold a child's attention
- Emphasise character names and action words with gentle energy`,
  },

  {
    promptKey: 'avatar_generation',
    name: 'Avatar Generation',
    promptType: 'avatar_generation',
    provider: 'openai',
    defaultModel: 'gpt-image-1',
    variablesJson: { required: ['heroName', 'heroAge', 'heroDescription'], optional: ['themeDescription', 'superpower'] },
    changeNotes: 'Initial seed — prompt built dynamically by OpenAIImageProvider. Generation logic stays in code.',
    promptText: `[CODE_MANAGED — prompt built by OpenAIImageProvider.generateAvatar()]

Generate a vibrant children's storybook avatar portrait of {{heroName}}, aged {{heroAge}}.
Style: circular portrait badge, warm vibrant watercolour illustration, bold cheerful colours, soft outlines.
Character: {{heroDescription}}
The child should look like the real child described above. Do not change ethnicity, skin tone, hairstyle, or face shape.
Format: circular portrait, head and shoulders, centred, no background clutter.
No text, no speech bubbles, no UI elements.`,
  },

  {
    promptKey: 'avatar_regeneration',
    name: 'Avatar Regeneration',
    promptType: 'avatar_regeneration',
    provider: 'openai',
    defaultModel: 'gpt-image-1',
    variablesJson: { required: ['heroName', 'heroAge', 'canonSummary', 'regenerationNote'], optional: ['previousIssues'] },
    changeNotes: 'Initial seed — regeneration prompt built by OpenAIImageProvider.',
    promptText: `[CODE_MANAGED — prompt built by OpenAIImageProvider.regenerateAvatar()]

Regenerate a storybook avatar portrait of {{heroName}}, aged {{heroAge}}.
CANON IDENTITY (must match exactly): {{canonSummary}}
Regeneration note: {{regenerationNote}}
Previous issues to avoid: {{previousIssues}}

Style: circular portrait badge, warm vibrant watercolour illustration, bold cheerful colours, soft outlines.
The child MUST match the canon identity above — same face shape, skin tone, hair, and distinctive features.
Format: circular portrait, head and shoulders, centred. No text, no speech bubbles.`,
  },

  {
    promptKey: 'scene_generation',
    name: 'Scene Generation',
    promptType: 'scene_generation',
    provider: 'openai',
    defaultModel: 'gpt-image-1',
    variablesJson: { required: ['illustrationBrief', 'heroName', 'heroAge'], optional: ['heroCanonSummary', 'storyVisualState', 'supportingCharacters'] },
    changeNotes: 'Initial seed — scene prompt built by generation pipeline. Uses same rules as image_generation.',
    promptText: `[CODE_MANAGED — scene prompt built by generation pipeline, follows image_generation rules]

Scene illustration brief: {{illustrationBrief}}

Apply all IMAGE_GENERATION_RULES. Hero canon identity and Story Visual State must be respected exactly.
Art style: vibrant watercolour children's book illustration, cinematic composition, warm atmosphere.
No text or UI visible in image.`,
  },

  {
    promptKey: 'speech_bubble',
    name: 'Speech Bubble',
    promptType: 'speech_bubble',
    provider: 'gemini',
    defaultModel: 'gemini-2.5-flash-lite',
    variablesJson: { required: ['pageText', 'characters', 'dialogue'] },
    changeNotes: 'Initial seed — speech bubble placement managed by generation pipeline.',
    promptText: `[CODE_MANAGED — speech bubble layout computed by generation pipeline]

Given the page narration and dialogue, determine speech bubble placement.
Page text: {{pageText}}
Characters on page: {{characters}}
Dialogue: {{dialogue}}

For each line of dialogue, return:
- speakerName: exact character name
- text: the spoken line
- bubbleStyle: "normal" | "excited" | "whisper" | "thinking" | "surprised"
- placementHint: position relative to speaker (e.g. "upper left near Siddhant")

Return ONLY valid JSON array of speech bubble objects. Max 2 bubbles per page.`,
  },

  {
    promptKey: 'story_qa',
    name: 'Story QA',
    promptType: 'story_qa',
    provider: 'gemini',
    defaultModel: 'gemini-2.5-flash-lite',
    variablesJson: {},
    changeNotes: 'Initial seed — Story QA is algorithmic (no LLM call). Scoring rules documented here for reference.',
    promptText: `[ALGORITHMIC — no LLM call. Scoring logic in AIQualityAssuranceService.scoreStory()]

Story continuity scoring rules (0–10):
- Start at 10
- Deduct 3 if narration text is missing or <10 chars
- Deduct 1 if costume changed unexpectedly vs Story Visual State
- Deduct 1 if companion is missing from story state snapshot
- Deduct 0.5 if same location for 3+ consecutive pages
- Minimum score: 0

Checks performed:
1. Narration text presence and length
2. Costume consistency with storyVisualState
3. Companion presence in story state snapshot
4. Location stagnation detection`,
  },

  {
    promptKey: 'expression_qa',
    name: 'Expression QA',
    promptType: 'expression_qa',
    provider: 'gemini',
    defaultModel: 'gemini-2.5-flash-lite',
    variablesJson: {},
    changeNotes: 'Initial seed — Expression QA is algorithmic (no LLM call). Scoring rules documented here.',
    promptText: `[ALGORITHMIC — no LLM call. Scoring logic in AIQualityAssuranceService.scoreExpression()]

Expression-to-dialogue alignment scoring rules (0–10):
- Start at 10
- For each character direction where character is speaking:
  - Map emotion keyword to expected expression keywords
  - Deduct 1.5 per mismatch (emotion says "excited" but expression says "frowning")
- Minimum score: 5

Emotion → expression mapping:
- excited/happy/joyful/thrilled → smil/bright/excit/joy/gleam
- sad/cry/upset/unhappy → sad/frown/tears/sorr
- scared/afraid/fear/nervous → fear/wide/scared/nervous/trem
- angry/furious/mad → angry/frown/furrowed/stern
- surprised/shocked/amazed → surprised/wide/shock/amaz
- determined/focused/brave → determin/focus/resolv/brave/confident`,
  },

  {
    promptKey: 'dialogue_qa',
    name: 'Dialogue QA',
    promptType: 'dialogue_qa',
    provider: 'gemini',
    defaultModel: 'gemini-2.5-flash-lite',
    variablesJson: {},
    changeNotes: 'Initial seed — Dialogue QA is algorithmic (no LLM call). Scoring rules documented here.',
    promptText: `[ALGORITHMIC — no LLM call. Scoring logic in AIQualityAssuranceService.scoreDialogue()]

Dialogue validity scoring rules (0–10):
- Start at 10
- Deduct 2 if speech bubble has no valid speaker name
- Deduct 1 if speech bubble text is empty
- Deduct 1.5 per duplicate speech bubble text on the same page
- Deduct 1 if dialogue text appears verbatim in narration (>10 chars match)
- Minimum score: 0`,
  },

  {
    promptKey: 'composition_qa',
    name: 'Composition QA',
    promptType: 'composition_qa',
    provider: 'openai',
    defaultModel: 'gpt-4o-mini',
    variablesJson: { required: ['imageUrl'] },
    changeNotes: 'Initial seed — Composition QA via vision model. Currently a placeholder; full vision analysis pending.',
    promptText: `[VISION QA — currently returns placeholder score of 8. Full implementation pending.]

Analyse the composition of this children's storybook illustration.
Score quality 1–10 across these dimensions:
- Character placement (are characters centred and well-framed?)
- Background depth (is there meaningful background?)
- Colour balance (warm, vibrant, age-appropriate?)
- Safe margins (are characters away from edges?)
- Clarity (is the scene immediately readable?)

Return ONLY valid JSON:
{"compositionScore": 8, "issues": [], "recommendation": "accept"}
recommendation = "accept" when compositionScore >= 6; "flag" when < 6.`,
  },

  {
    promptKey: 'confidence_engine',
    name: 'Confidence Engine',
    promptType: 'confidence_engine',
    provider: 'gemini',
    defaultModel: 'gemini-2.5-flash-lite',
    variablesJson: {},
    changeNotes: 'Initial seed — Confidence Engine is fully algorithmic. Formula documented here.',
    promptText: `[ALGORITHMIC — no LLM call. Confidence formula in AIQualityAssuranceService.calculateConfidence()]

Overall confidence calculation (0–100):
confidence = (
  avgIdentityScore × weightIdentity +
  avgStoryScore × weightStory +
  avgExpressionScore × weightExpression +
  avgDialogueScore × weightDialogue +
  avgCompositionScore × weightComposition +
  avgNarrationScore × weightNarration +
  avgStoryScore × weightStateConsistency
) / totalWeight × 10

Default weights (configurable via platform settings):
- Identity: 40%  (QA_WEIGHT_IDENTITY)
- Story: 20%     (QA_WEIGHT_STORY)
- Expression: 10% (QA_WEIGHT_EXPRESSION)
- Dialogue: 10%  (QA_WEIGHT_DIALOGUE)
- Composition: 10% (QA_WEIGHT_COMPOSITION)
- Narration: 5%  (QA_WEIGHT_NARRATION)
- State Consistency: 5% (QA_WEIGHT_STATE_CONSISTENCY)

Status thresholds: pass ≥ 90, pass_with_warning ≥ 70, fail < 70`,
  },

  {
    promptKey: 'merchandise_preview',
    name: 'Merchandise Preview',
    promptType: 'merchandise_preview',
    provider: 'openai',
    defaultModel: 'gpt-image-1',
    variablesJson: { required: ['heroName', 'heroCanonSummary', 'productType', 'designBrief'] },
    changeNotes: 'Initial seed — merchandise preview prompt for physical product mockups.',
    promptText: `Generate a children's merchandise product mockup featuring {{heroName}}.
Product type: {{productType}}
Design brief: {{designBrief}}
Hero identity: {{heroCanonSummary}}

Style: vibrant, colourful, age-appropriate (4–12 years). The hero must match the canon identity exactly.
Show the product in a clean, well-lit mockup style suitable for an e-commerce listing.
No text overlays unless part of the product design. High contrast, cheerful colours.`,
  },

  {
    promptKey: 'companion_generation',
    name: 'Companion Generation',
    promptType: 'companion_generation',
    provider: 'openai',
    defaultModel: 'gpt-image-1',
    variablesJson: { required: ['companionName', 'companionType', 'universeTheme', 'heroName'] },
    changeNotes: 'Initial seed — companion avatar generation prompt.',
    promptText: `Generate a children's storybook avatar for {{heroName}}'s companion named {{companionName}} ({{companionType}}).
Universe theme: {{universeTheme}}

Style: vibrant watercolour children's book illustration, circular portrait badge format.
The companion should look friendly, loyal, and exciting for a child aged 4–12.
Match the energy and colour palette of the universe theme.
No text, no speech bubbles. Circular portrait, centred, head/full-body depending on companion type.`,
  },
];

@Injectable()
export class PromptRegistrySeedService implements OnModuleInit {
  private readonly logger = new Logger(PromptRegistrySeedService.name);

  constructor(
    private readonly registry: PromptRegistryService,
    @InjectRepository(PromptTemplate) private readonly tplRepo: Repository<PromptTemplate>,
    @InjectRepository(PromptTemplateVersion) private readonly verRepo: Repository<PromptTemplateVersion>,
  ) {}

  async onModuleInit() {
    await this.cleanup();
    await this.seed();
  }

  /** Remove duplicate templates (same promptKey) and duplicate isCurrent versions. */
  async cleanup() {
    try {
      // Deduplicate templates — keep the earliest created, soft-delete the rest
      for (const seed of SEED_PROMPTS) {
        const all = await this.tplRepo.find({
          where: { promptKey: seed.promptKey, isDeleted: false },
          order: { createdAt: 'ASC' },
        });
        if (all.length <= 1) continue;
        const [keep, ...dupes] = all;
        for (const dupe of dupes) {
          await this.verRepo.update({ promptTemplateId: dupe.id }, { isDeleted: true, deletedAt: new Date(), isCurrent: false });
          await this.tplRepo.update(dupe.id, { isDeleted: true, deletedAt: new Date() });
          this.logger.warn(`Cleaned up duplicate template ${dupe.id} for key ${seed.promptKey}, keeping ${keep.id}`);
        }
      }

      // Deduplicate isCurrent versions — keep the most recently activated, deactivate the rest
      const templates = await this.tplRepo.find({ where: { isDeleted: false } });
      for (const tpl of templates) {
        const currentVersions = await this.verRepo.find({
          where: { promptTemplateId: tpl.id, isCurrent: true, isDeleted: false },
          order: { activatedAt: 'DESC' },
        });
        if (currentVersions.length <= 1) continue;
        const [, ...stale] = currentVersions;
        for (const v of stale) {
          await this.verRepo.update(v.id, { isCurrent: false, status: 'inactive', deactivatedAt: new Date() });
        }
        this.logger.warn(`Deduplicated ${stale.length} extra isCurrent versions for template ${tpl.promptKey}`);
      }
    } catch (err) {
      this.logger.warn(`Cleanup step failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async seed() {
    for (const seed of SEED_PROMPTS) {
      try {
        const existing = await this.registry.getActivePrompt(seed.promptKey);
        const isLegacy = !existing ||
          existing.promptText === PLACEHOLDER_TEXT ||
          existing.promptText.startsWith('[CODE_MANAGED') ||
          existing.promptText.startsWith('[Prompt text managed in code') ||
          existing.promptText.startsWith('[TTS INSTRUCTIONS') ||
          existing.promptText.startsWith('[ALGORITHMIC') ||
          existing.promptText.startsWith('[VISION QA');
        if (!isLegacy) continue;

        // Find or create the canonical template for this key
        let template = await this.tplRepo.findOne({ where: { promptKey: seed.promptKey, isDeleted: false } });
        if (!template) {
          template = await this.registry.createTemplate({
            promptKey: seed.promptKey,
            name: seed.name,
            promptType: seed.promptType,
            provider: seed.provider,
            defaultModel: seed.defaultModel,
          });
        }

        // Find a unique version name
        const existingVersions = await this.verRepo.find({
          where: { promptTemplateId: template.id, isDeleted: false },
          select: ['version'],
        });
        const takenNames = new Set(existingVersions.map(v => v.version));
        let versionName = 'v1.0.0';
        let suffix = 1;
        while (takenNames.has(versionName)) {
          versionName = `v1.0.${suffix}`;
          suffix += 1;
        }

        const version = await this.registry.createVersion(template.id, {
          version: versionName,
          promptText: seed.promptText,
          variablesJson: seed.variablesJson,
          changeNotes: seed.changeNotes,
        }, null);

        await this.registry.activateVersion(version.id, null);
        this.logger.log(`Seeded prompt: ${seed.promptKey} @ ${versionName}`);
      } catch (error) {
        this.logger.warn(`Prompt seed skipped for ${seed.promptKey}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
}
