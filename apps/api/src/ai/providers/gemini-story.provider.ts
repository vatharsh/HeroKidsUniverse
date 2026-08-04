import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

import {
  StoryGenerationInput,
  StoryGenerationOutput,
  StoryGenerationProvider,
} from '../interfaces/story-generation.provider';
import { PromptTemplateVersion } from '../entities/prompt-template-version.entity';
import { PromptRegistryService } from '../prompt-registry.service';

function isLegacyPromptText(text: string): boolean {
  return (
    text.startsWith('[CODE_MANAGED') ||
    text === '[Prompt text managed in code — see service implementation. Migrate here when ready.]'
  );
}

@Injectable()
export class GeminiStoryProvider implements StoryGenerationProvider {
  private readonly logger = new Logger(GeminiStoryProvider.name);
  private readonly genAI: GoogleGenerativeAI;
  private readonly model: string;

  constructor(
    private readonly config: ConfigService,
    private readonly promptRegistry: PromptRegistryService,
  ) {
    const apiKey = this.config.get<string>('GEMINI_API_KEY') ?? '';
    this.model = this.config.get<string>('GEMINI_MODEL') ?? 'gemini-2.5-flash';
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async generateStory(input: StoryGenerationInput): Promise<StoryGenerationOutput> {
    const { prompt, activePromptVersion } = await this.buildPrompt(input);
    const modelNames = this.getModelFallbacks();
    const maxRetries = 3;
    let lastError: Error = new Error('All Gemini models failed');

    for (const modelName of modelNames) {
      const model = this.genAI.getGenerativeModel({ model: modelName });

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          const result = await model.generateContent(prompt);
          const rawResponse = result.response.text().trim();
          const json = rawResponse.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
          const generated = JSON.parse(json) as StoryGenerationOutput;

          return {
            ...generated,
            provider: 'gemini',
            model: modelName,
            prompt,
            promptKey: activePromptVersion ? 'story_generation' : null,
            promptTemplateId: activePromptVersion?.promptTemplateId ?? null,
            promptTemplateVersionId: activePromptVersion?.id ?? null,
            promptVersion: activePromptVersion?.version ?? null,
            rawResponse,
            inputTokens: result.response.usageMetadata?.promptTokenCount ?? 0,
            outputTokens: result.response.usageMetadata?.candidatesTokenCount ?? 0,
          };
        } catch (err) {
          const msg = err instanceof Error ? err.message : '';
          const retryDelayMs = this.getRetryDelayMs(msg, attempt);
          const isQuota = this.isQuotaError(msg);
          const isRetryable = isQuota ||
            msg.includes('503') ||
            msg.includes('overloaded') ||
            msg.includes('high demand');

          if (isRetryable && attempt < maxRetries - 1) {
            this.logger.warn(
              `Model ${modelName} ${isQuota ? 'quota-limited' : 'busy'} ` +
              `(attempt ${attempt + 1}/${maxRetries}), retrying in ${Math.round(retryDelayMs / 1000)}s`,
            );
            await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
          } else {
            lastError = err instanceof Error ? err : new Error(msg);
            break;
          }
        }
      }
    }

    throw lastError;
  }

  private getModelFallbacks(): string[] {
    const configured = this.config.get<string>('GEMINI_MODEL_FALLBACKS')
      ?.split(',')
      .map((model) => model.trim())
      .filter(Boolean) ?? [];

    const defaults = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-1.5-flash'];
    return [...new Set([this.model, ...configured, ...defaults])]
      .filter((model) => model !== 'gemini-2.0-flash');
  }

  private isQuotaError(message: string): boolean {
    return message.includes('[429') ||
      message.includes('429 Too Many Requests') ||
      message.toLowerCase().includes('quota exceeded') ||
      message.includes('RetryInfo');
  }

  private getRetryDelayMs(message: string, attempt: number): number {
    const retryInfo = message.match(/retryDelay"?:"?(\d+(?:\.\d+)?)s/i);
    const retryText = message.match(/retry in (\d+(?:\.\d+)?)s/i);
    const seconds = Number(retryInfo?.[1] ?? retryText?.[1]);
    if (Number.isFinite(seconds) && seconds > 0) {
      return Math.min(65_000, Math.max(1_000, Math.ceil(seconds * 1000)));
    }
    return Math.min(30_000, 5_000 * (attempt + 1));
  }

  private async buildPrompt(input: StoryGenerationInput): Promise<{ prompt: string; activePromptVersion: PromptTemplateVersion | null }> {
    const vars = this.computePromptVariables(input);
    let dbVersion: PromptTemplateVersion | null = null;
    try {
      dbVersion = await this.promptRegistry.getActivePrompt('story_generation');
    } catch (error) {
      this.logger.warn(`Prompt registry story_generation fallback: ${error instanceof Error ? error.message : String(error)}`);
    }

    if (dbVersion && !isLegacyPromptText(dbVersion.promptText)) {
      this.logger.log(`[PROMPT] story_generation v${dbVersion.version} (id=${dbVersion.id}) — DB version active`);
      const prompt = [
        this.promptRegistry.renderPrompt(dbVersion.promptText, vars),
        this.buildRuntimeQualityContract(),
      ].join('\n\n');
      return { prompt, activePromptVersion: dbVersion };
    }

    this.logger.warn(`[PROMPT] story_generation — using hardcoded fallback (DB: ${dbVersion ? `legacy v${dbVersion.version}` : 'not found'})`);
    return { prompt: this.buildHardcodedPrompt(vars), activePromptVersion: null };
  }

  private buildRuntimeQualityContract(): string {
    return `RUNTIME QUALITY CONTRACT — MUST FOLLOW EVEN IF EARLIER PROMPT TEXT CONFLICTS:
- speechBubbles are metadata only. Never ask image generation to draw text or bubbles.
- Each speechBubble must include speakerName, text, emotion, bubbleStyle, preferredPosition, tailDirection, anchorTarget, anchorPoint, AND faceSide.
- anchorTarget: "mouth" or "lower_face" for spoken dialogue; "forehead" for bubbleStyle "thinking".
- anchorPoint: { "x": <0-100>, "y": <0-100> } — the speaker's estimated MOUTH position as a percentage of the image frame. This is used to draw the speech bubble tail directly at the character's face. Rules for estimating:
  * x from characterDirections position: "left"→22, "center"→50, "right"→76. Adjust ±5 for exact framing.
  * y from camera: "close-up on face"→34, "medium shot"→42, "wide angle"→48. "low angle"→38.
  * Foreground character (larger in frame, closer to camera): subtract 5 from y.
  * Background character (smaller, farther from camera): add 5 to y.
  * CRITICAL: Every speaker on the same page MUST have a DIFFERENT anchorPoint. Two speakers standing at different positions will NEVER have the same x value. Never copy the same anchorPoint for two different speakers.
- faceSide: "left" or "right" — which half of the image the speaker's face occupies. Derived from anchorPoint.x: x < 50 → "left", x >= 50 → "right". Used by the frontend to place the bubble on the correct side.
- Place bubbles near speaker: speaker LEFT -> preferredPosition "top-right", tailDirection "down-left"; speaker RIGHT -> "top-left", tailDirection "down-right"; speaker CENTER -> alternate top-left/top-right.
- Every speaking character must have characterDirections with position, expression, expressionDetails.eyes, expressionDetails.mouth, expressionDetails.eyebrows, expressionDetails.gaze, expressionDetails.headTilt, pose, action, lookingAt, mouthState "speaking", isSpeaking true.
- Non-speaking visible characters must have reaction expressions and mouthState "closed", "smiling", or "surprised".
- Include narrationText on every page. Dialogue may appear in narrationText only once; do not duplicate speech bubble text in narration.
- text and narrationText must not contain the same dialogue line twice.
- Every page must have imageVariant: "reuse" (first page of scene or no visual change from scene base) or "expression" (genuine change in character expression/pose/position). First page of each scene must always be "reuse".
- Every page must have participationMoment: exactly ONE page must have { type, prompt, hint? }; all others must have null. Participation page should be around page 3-5.
- Every named supporting character must have at least one speech bubble in the story (enforce engagement rules).
- COSTUME LOCK: Every character's outfit established on page 1 must remain IDENTICAL across ALL pages of this story. Never change, replace, or vary any character's clothing mid-story. A costume change may ONLY occur if explicitly written into the plot AND reflected in storyStateUpdate.costumeChange. If no costumeChange is declared, the outfit is frozen.
- HERO OUTFIT LOCK: If the hero has a defined superhero costume, it appears on every page. If not, whatever the hero wears on page 1 is locked for the entire story — never change it.
- CHARACTER SCALE LOCK: The height and body size of every character relative to the hero must remain IDENTICAL across all pages. If a supporting character is taller or shorter than the hero in page 1, that size ratio is frozen for all subsequent pages. Never shrink or grow any character between scenes.
- ADVENTURE CLOTHING RULE: The hero's BASE costume stays on at all times — adventure environments only ADD accessories on top (never replace the suit). Space → add helmet + jet boosters + glowing visor. Underwater → add breathing mask + fins + aqua-glow trim. Jungle/expedition → add explorer hat + utility vest + vine accents. Ancient ruins/relic quest → add explorer gear + headlamp + utility belt. Fantasy/castle → add magical armour overlay + enchanted cape. Detective/mystery → add trench coat overlay + badge. Future/cyber → add nano-tech armour panels + holographic visor. Ice world → add frost-resistant armour + icy glow. Volcano/fire → add heat shield plating + lava-resistant trim. Supporting characters MUST wear full environment-appropriate attire in the same adventure — absolutely NO sarees, kurta, jeans, t-shirts, school uniforms, or everyday casual clothes inside active adventure environments (space, ruins, underwater, jungle, volcano, etc). This applies to elderly characters and grandparents too — no exceptions for anyone.`;
  }

  private computePromptVariables(input: StoryGenerationInput): Record<string, string> {
    const ctx = input.universeContext;
    const heroName = input.heroName;
    const effectiveStoryContext = input.storyContext ?? ctx?.storyContext ?? null;
    const hasCustomStory = !!effectiveStoryContext;
    const n = input.pageCount;
    const climaxPage = n - 1;
    const heroRef = hasCustomStory ? input.heroName : (ctx?.heroTitle ?? input.heroName);
    const sceneCount = Math.ceil(n / 2);

    const supportingCharactersLine = input.supportingCharacters?.length
      ? `Supporting characters in this episode: ${input.supportingCharacters.join(', ')}`
      : 'Supporting characters in this episode: none';

    const visualIdentityLines = [
      input.heroVisualDescription
        ? `- ${input.heroName} (main hero): ${input.heroVisualDescription}`
        : `- ${input.heroName} (main hero): Use only the hero details below; do not invent visual traits.`,
      ...(input.supportingCharacters ?? []).map((label, index) => {
        const description = input.supportingCharacterVisualDescriptions?.[index];
        return description
          ? `- ${label}: ${description}`
          : `- ${label}: Keep the character visually simple and consistent; do not add glasses, bindis, moustaches, jewellery, or unusual features unless already known.`;
      }),
    ].join('\n');

    const companionLine = ctx?.companion
      ? `\nThe hero's loyal companion is ${ctx.companion.name} (a ${ctx.companion.type}), who accompanies them on this adventure.`
      : '';

    const visualStateSection = input.storyVisualState
      ? [
          'STORY VISUAL STATE (LOCKED — these must appear consistently throughout every page):',
          `Costume: ${input.storyVisualState.costume ?? 'Regular clothes'}`,
          `Companion: ${input.storyVisualState.companion ?? 'None'}`,
          `Weapon/Item: ${input.storyVisualState.weapon ?? 'None'}`,
          `Active Powers: ${input.storyVisualState.powers.join(', ') || 'None'}`,
          `Inventory: ${input.storyVisualState.inventory.join(', ') || 'None'}`,
          '',
          'Every scene description and character reference MUST include these visual elements unless the story explicitly changes them.',
        ].join('\n')
      : '';

    const cliffhangerLine = !hasCustomStory && ctx?.lastCliffhanger
      ? `\nLast Episode Cliffhanger (MUST pick up from this exact moment): "${ctx.lastCliffhanger}"\nLast Episode Title: "${ctx.lastStoryTitle ?? 'Previous Episode'}"`
      : '';

    const universeSection = ctx
      ? (hasCustomStory
          ? [
              `UNIVERSE CONTEXT — this adventure takes place WITHIN "${ctx.universeName}" (apply throughout):`,
              `Hero Title in this Universe: ${ctx.heroTitle ?? heroName}`,
              '',
              `Universe Memory (what has already happened in ${ctx.universeName}):`,
              ctx.recentMemories.length ? ctx.recentMemories.map((m) => `- ${m}`).join('\n') : '- This is the first adventure in this universe',
              '',
              "Hero's Established Powers:",
              ctx.heroPowers.length ? ctx.heroPowers.map((p) => `- ${p}`).join('\n') : '- None yet',
              '',
              'Open Quests:',
              ctx.openQuests.length ? ctx.openQuests.map((q) => `- ${q}`).join('\n') : '- None',
              companionLine,
              '',
              'UNIVERSE INTEGRATION RULES:',
              '- The custom adventure above is the story — follow it faithfully.',
              `- But it lives inside "${ctx.universeName}". The tone, world, and identity of this universe must be present.`,
              `- The hero IS known as ${ctx.heroTitle ?? heroName} in this universe; use that identity naturally.`,
              '- If the hero has established powers, they use them during the adventure where it makes sense.',
              "- The hero's companion (if any) may join the adventure.",
              '- Add 1–3 entries to newMemories so this adventure becomes part of universe history.',
              '- If the hero earns a new power, add it to newPowers[] AND add a newMemories entry with type "power_earned".',
              '- If a villain or antagonist is defeated, add a newMemories entry with type "villain_defeated" and the villain\'s name as title.',
              '- If a new quest opens, add it to newQuests[] AND add a newMemories entry with type "quest_opened".',
            ].join('\n')
          : [
              `UNIVERSE: ${ctx.universeName}`,
              `Hero Title: ${ctx.heroTitle ?? heroName}`,
              `Story Mode: ${ctx.storyMode}`,
              cliffhangerLine,
              '',
              'Universe Memory (what has already happened):',
              ctx.recentMemories.length ? ctx.recentMemories.map((m) => `- ${m}`).join('\n') : '- This is the first adventure',
              '',
              "Hero's Current Powers & Items:",
              ctx.heroPowers.length ? ctx.heroPowers.map((p) => `- ${p}`).join('\n') : '- None yet',
              '',
              'Open Quests (may optionally advance one of these):',
              ctx.openQuests.length ? ctx.openQuests.map((q) => `- ${q}`).join('\n') : '- None',
              companionLine,
              '',
              'IMPORTANT CONTINUITY RULES:',
              '- Reference past events naturally in the story if relevant',
              '- The hero may use existing powers in new ways',
              '- If storyMode is "continue_arc", the story MUST open exactly where the last episode ended — page 1 must directly react to the cliffhanger above',
              '- If storyMode is "new_arc", introduce a fresh threat but keep universe consistent',
              '- If the hero earns a new power in this story, add its name to newPowers[] AND add a newMemories entry with type "power_earned" and the same name as title',
              '- If a villain, monster, or antagonist is defeated or outsmarted, add a newMemories entry with type "villain_defeated" and the villain\'s name as title',
              '- The story may open a new quest — add its title to newQuests[] AND add a newMemories entry with type "quest_opened"',
            ].join('\n'))
      : '';

    const customStoryDirective = hasCustomStory
      ? [
          '══════════════════════════════════════════════════════',
          'MANDATORY STORY DIRECTIVE — YOU MUST FOLLOW THIS EXACTLY',
          '══════════════════════════════════════════════════════',
          `The user has provided a specific story to adapt. Adapt THIS story faithfully into a ${n}-page children's storybook:`,
          '',
          `"${effectiveStoryContext}"`,
          '',
          'YOU MUST:',
          '- Keep the exact characters, setting, activities, and emotional journey from the story above',
          '- Preserve the real names as given (Siddhant, Vedant, Daadu, Daadi, etc.)',
          '- Follow the sequence of events described',
          '- Do NOT invent a different adventure or rename the story with universe titles',
          '- The title must reflect the actual story above, not a universe-generated title',
          '══════════════════════════════════════════════════════',
        ].join('\n')
      : '';

    const themeDescriptionLine = hasCustomStory ? '' : `- Adventure theme: ${input.themeDescription}`;
    const storySourceLine = hasCustomStory
      ? "- STAY TRUE to the user's story — do not drift into a different adventure"
      : '- Naturally reference universe history if provided';

    const pageEntry = (pageNum: number, cropHint: string) =>
      `      {
        "pageNumber": ${pageNum},
        "text": "Narration text for this page (2-3 sentences, max 40 words)",
        "narrationText": "Final voice narration for this page. Include any spoken line only once if it should be heard.",
        "sceneDescription": "Every character visible: name, age, skin tone, hair, clothing, pose, expression, frame position (left/center/right). Include environment.",
        "background": "One sentence: specific location, time of day, lighting mood",
        "camera": "wide angle|medium shot|close-up on face|low angle looking up|bird's eye view",
        "cropHint": "${cropHint}",
        "characterDirections": [
          {
            "name": "${heroRef}",
            "role": "hero",
            "visible": true,
            "position": "left",
            "expression": "wide eyes, excited grin, eyebrows raised",
            "expressionDetails": { "eyes": "wide open, sparkling", "mouth": "open mid-speech", "eyebrows": "raised high", "gaze": "fixed on the glowing stone", "headTilt": "slightly forward" },
            "pose": "holding glowing compass with both hands, leaning forward",
            "action": "reaching toward the glowing stone",
            "lookingAt": "the glowing stone",
            "facingDirection": "three-quarter front",
            "mouthState": "speaking",
            "isSpeaking": true
          }
        ],
        "speechBubbles": [
          {
            "speakerName": "${heroRef}",
            "text": "Spoken line max 12 words",
            "bubbleStyle": "normal",
            "preferredPosition": "top-right",
            "tailDirection": "down-left",
            "anchorTarget": "lower_face",
            "anchorPoint": { "x": 22, "y": 42 },
            "faceSide": "left",
            "avoidCovering": ["face", "hands"],
            "maxWidthPercent": 44
          }
        ],
        "storyStateUpdate": {
          "newItems": [],
          "removedItems": [],
          "newPowers": [],
          "removedPowers": [],
          "locationChange": null,
          "costumeChange": null
        },
        "imageVariant": "reuse",
        "participationMoment": null,
        "characters": [{ "name": "${heroRef}", "expression": "excited grin", "pose": "leaning forward" }],
        "dialogue": [{ "speaker": "${heroRef}", "text": "Same line as speechBubbles", "emotion": "excited", "bubbleStyle": "normal" }]
      }`;

    const sceneEntries = Array.from({ length: sceneCount }, (_, si) => {
      const firstPage = si * 2 + 1;
      const secondPage = firstPage + 1;
      const hasSecond = secondPage <= n;
      const pages = hasSecond
        ? `${pageEntry(firstPage, 'full_width')},\n${pageEntry(secondPage, 'zoom_center')}`
        : pageEntry(firstPage, 'full_width');
      return `    {
      "sceneId": "scene-${si + 1}",
      "title": "Scene ${si + 1} title",
      "illustrationBrief": "Composition style (INTIMATE SCENE / DYNAMIC ACTION / WIDE CINEMATIC): [describe this scene covering pages ${firstPage}${hasSecond ? `-${secondPage}` : ''} — character positions, exact action, expression, costume, setting, lighting, mood. Make this visually DISTINCT from other scenes. Characters with safe margins from edges. No text, no speech bubbles. 3-5 sentences.]",
      "pages": [
${pages}
      ]
    }`;
    }).join(',\n');

    return {
      heroName,
      heroAge: String(input.heroAge),
      heroGender: input.heroGender,
      heroRef,
      pageCount: String(n),
      sceneCount: String(sceneCount),
      climaxPage: String(climaxPage),
      customStoryDirective,
      themeDescriptionLine,
      supportingCharactersLine,
      universeSection,
      visualIdentityLines,
      visualStateSection,
      storySourceLine,
      sceneEntries,
    };
  }

  private buildHardcodedPrompt(v: Record<string, string>): string {
    return `You are a creative children's storybook author for HeroKids Universe.
${v.customStoryDirective ? v.customStoryDirective + '\n' : ''}Hero details:
- Name: ${v.heroName}
- Age: ${v.heroAge}
- Gender: ${v.heroGender}
${v.themeDescriptionLine}
${v.supportingCharactersLine}
${v.universeSection}

Write a ${v.pageCount}-page illustrated storybook where ${v.heroRef} is the main character.

CANONICAL VISUAL IDENTITY RULES FOR THE ILLUSTRATOR:
${v.visualIdentityLines}

Do NOT invent new facial features, glasses, bindis, moustaches, hairstyles, age changes, body type changes, or clothing for these named people unless explicitly stated above.
Each named character should appear as the same person on every page. If the scene has multiple children, do not duplicate one child's face for another child.
${v.visualStateSection}

Rules:
- Each page: 2-3 short sentences (max 40 words per page) suitable for age ${v.heroAge}
- Use simple, exciting language kids love
- Include dialogue and warm emotion
- Build to a joyful climax on page ${v.climaxPage}
- Page ${v.pageCount}: resolve happily — end with a soft sentence hinting at the next adventure
- The hero always succeeds through kindness, courage, or cleverness — never violence
${v.storySourceLine}
- In every sceneDescription: explicitly name the costume, companion, and weapon from the Story Visual State — do not leave them out
- In characters: always describe the expression and pose for the main hero on every page
- Speech bubbles: only add dialogue if it adds to the scene; avoid generic exclamations

ENGAGEMENT RULES:
- Every named supporting character MUST speak at least ONE line of dialogue in a speech bubble somewhere in the story — no silent extras.
- Each supporting character must actively contribute to the plot: give a clue, solve a riddle, distract the villain, use a special skill, or help the hero escape.
- The hero must react to their help with a genuine spoken line or thought bubble.
- Max 10 pages total. Every page must move the plot forward — no filler pages.

PARTICIPATION MOMENT RULE (REQUIRED):
- The story MUST contain exactly ONE participation moment — usually on page 3, 4, or 5.
- A participation moment pauses the action and directly invites the reader to think before the story continues.
- Types: "riddle" (villain/environment poses a riddle for reader to solve), "predict" (ask what happens next), "guess" (mystery object/clue — reader guesses), "choose" (two paths — reader picks).
- The page text must weave participation naturally (e.g. "Can YOU figure out the riddle before Arjun does?").
- On exactly ONE page set "participationMoment": { "type": "...", "prompt": "Direct question ≤ 20 words", "hint": "Optional clue sentence" }.
- On ALL other pages set "participationMoment": null.

CRITICAL SCENE DESCRIPTION RULE:
Each sceneDescription must describe EVERY character who appears with their FULL visual identity locked in parentheses — age, skin tone, hair, clothing, and current expression. Use the canonical identity above. Repeat the full description every time a character appears (even if they appeared on previous pages) — the illustrator sees only one page at a time.
Example: "Siddhant (8-year-old boy, warm brown skin, short straight black hair, black t-shirt, excited wide grin) reaches toward the glowing stone, while his father (40s Indian man, medium brown skin, short black hair with slight grey, white collared shirt, warm proud smile) watches from behind."
Supporting characters without a reference photo must still have a fixed, consistent appearance description that does NOT change across pages.

SCENE RULES:
- There are exactly ${v.sceneCount} scenes covering all ${v.pageCount} pages. Each scene produces ONE shared illustration used across its pages.
- Scene 1 must be the most visually striking — it doubles as the story cover.
- Each scene must look visually DISTINCT from every other scene — different location, lighting, composition, or action.
- NEVER reuse the same setting, character grouping, or colour palette across two consecutive scenes.

IMAGE VARIANT RULE:
- Every page must include "imageVariant": "reuse" or "expression".
- "reuse" — same character positions/expressions as the scene's main illustration; only speech bubbles change. ALWAYS "reuse" for the FIRST page of every scene (it IS the scene image).
- "expression" — genuine visible change in expression, pose, or position from scene base image. Mark "expression" only when there is a real visual change — be conservative to reduce rendering cost.

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
- Also include anchorTarget: "mouth" or "lower_face" for dialogue; "forehead" for bubbleStyle "thinking".
- speakerName: MUST be the exact name of a character who appears on that page.
- text: short child-friendly line, max 12 words. For bubbleStyle "thinking": first-person internal thought (e.g. "I wonder if the key is hidden here…"), max 10 words. For all other styles: spoken dialogue only.
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
- Max 2 speechBubbles per page; at most 1 may have bubbleStyle "thinking" per page. Set speechBubbles to [] if no one speaks. Do NOT invent dialogue.

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
  "newPowers": ["Power name if hero earned one — else empty array"],
  "newQuests": ["Quest title if a new quest opened — else empty array"],
  "newMemories": [
    { "type": "power_earned", "title": "Same power name as in newPowers", "detail": "How the hero earned it" },
    { "type": "villain_defeated", "title": "Villain name", "detail": "How the hero defeated them" },
    { "type": "character_met", "title": "Character name", "detail": "Who they are" }
  ],
  "scenes": [
${v.sceneEntries}
  ],
  "pages": []
}

IMPORTANT: The "pages" array MUST be empty []. All pages must be inside "scenes". This is required.
newMemories: each entry MUST have "type" and "title" (non-empty string). "detail" is optional. Leave array empty [] if no new memories.
newMemories type must be one of: character_met, villain_defeated, power_earned, item_found, location_discovered, quest_opened, quest_completed, achievement_unlocked
newPowers and newQuests may be empty arrays if none were earned/opened.
background: one sentence, specific location + time of day + lighting mood
camera: choose from: wide angle, medium shot, close-up on face, low angle looking up, bird's eye view, over-the-shoulder
characters: EVERY named character visible in the scene must appear with expression + pose
dialogue: spoken lines or internal thoughts (bubbleStyle "thinking"); omit if no one speaks; max 2 dialogues per page
storyVisualState: for universe stories this reflects the hero's current look; for standalone stories design it to match the theme.
characterDirections: required for every page; at minimum include the hero with expression and pose.
speechBubbles: structured dialogue metadata; also echo in dialogue array for backward compat.
storyStateUpdate: required on every page; use empty arrays when nothing changes.
imageVariant: required on every page — "reuse" (same visual as scene base, only bubbles change) or "expression" (genuine visual change). First page of every scene must be "reuse".
participationMoment: required on every page — null on most; exactly ONE page must have { "type": "riddle"|"predict"|"guess"|"choose", "prompt": "≤20-word question", "hint": "optional clue" }.`;
  }
}
