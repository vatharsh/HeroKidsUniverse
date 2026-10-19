import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Repository } from 'typeorm';

import { PlatformSetting, SETTING_DEFAULTS } from '../../admin/platform-setting.entity';
import { indianVoiceGuide } from '../indian-voice-guide';

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
    @Optional() @InjectRepository(PlatformSetting)
    private readonly settingsRepo?: Repository<PlatformSetting>,
  ) {
    const apiKey = this.config.get<string>('GEMINI_API_KEY') ?? '';
    this.model = this.config.get<string>('GEMINI_MODEL') ?? SETTING_DEFAULTS.STORY_GENERATION_MODEL.value;
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async generateStory(input: StoryGenerationInput): Promise<StoryGenerationOutput> {
    const { prompt, activePromptVersion } = await this.buildPrompt(input);
    const modelNames = await this.getModelFallbacks();
    const maxRetries = 3;
    let lastError: Error = new Error('All Gemini models failed');

    for (const [modelIndex, modelName] of modelNames.entries()) {
      // JSON mode: the model must return parseable JSON (previously a malformed reply silently dropped
      // the story to the next, weaker model).
      const model = this.genAI.getGenerativeModel({
        model: modelName,
        generationConfig: { responseMimeType: 'application/json' },
      });

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
            err instanceof SyntaxError || // malformed JSON — worth one more try on the same model
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
            const next = modelNames[modelIndex + 1];
            // Never downgrade silently: a fallback means a different (usually weaker) writer.
            this.logger.error(
              `Story model ${modelName} failed: ${msg.slice(0, 300)}` +
              (next ? ` — falling back to ${next}` : ' — no fallback left'),
            );
            break;
          }
        }
      }
    }

    throw lastError;
  }

  /**
   * Primary model comes from the STORY_GENERATION_MODEL platform setting (admin-selectable), then the
   * GEMINI_MODEL env var. Fallbacks are same-tier models only — no silent drop to Flash-Lite.
   */
  private async getModelFallbacks(): Promise<string[]> {
    const setting = await this.settingsRepo
      ?.findOne({ where: { key: 'STORY_GENERATION_MODEL' } })
      .catch(() => null);
    const primary = setting?.value?.trim() || this.model;

    const configured = this.config.get<string>('GEMINI_MODEL_FALLBACKS')
      ?.split(',')
      .map((model) => model.trim())
      .filter(Boolean) ?? [];

    // Retired / no-longer-served models are dropped even if still configured somewhere.
    const retired = new Set(['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash']);
    return [...new Set([primary, ...configured, 'gemini-3.8-flash', 'gemini-3.6-flash'])]
      .filter((model) => !retired.has(model));
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
        indianVoiceGuide(await this.getHinglishLevel()),
        this.buildRuntimeQualityContract(),
      ].join('\n\n');
      return { prompt, activePromptVersion: dbVersion };
    }

    this.logger.warn(`[PROMPT] story_generation — using hardcoded fallback (DB: ${dbVersion ? `legacy v${dbVersion.version}` : 'not found'})`);
    return { prompt: this.buildHardcodedPrompt(vars), activePromptVersion: null };
  }

  private async getHinglishLevel(): Promise<'none' | 'light'> {
    const row = await this.settingsRepo?.findOne({ where: { key: 'STORY_HINGLISH_LEVEL' } }).catch(() => null);
    return (row?.value ?? SETTING_DEFAULTS.STORY_HINGLISH_LEVEL.value) === 'none' ? 'none' : 'light';
  }

  private buildRuntimeQualityContract(): string {
    return `RUNTIME QUALITY CONTRACT — MUST FOLLOW EVEN IF EARLIER PROMPT TEXT CONFLICTS:
- speechBubbles are metadata only. Never ask image generation to draw text or bubbles.
- Each speechBubble must include speakerName, text, emotion, bubbleStyle and anchorTarget ONLY. Do NOT output positions or coordinates (no preferredPosition, tailDirection, anchorPoint or faceSide) — the app places bubbles from the finished illustration.
- anchorTarget: "mouth" for spoken dialogue; "head" for bubbleStyle "thinking".
- Every speaking character must have characterDirections with position, expression, expressionDetails.eyes, expressionDetails.mouth, expressionDetails.eyebrows, expressionDetails.gaze, expressionDetails.headTilt, pose, action, lookingAt, mouthState "speaking", isSpeaking true.
- Non-speaking visible characters must have reaction expressions and mouthState "closed", "smiling", or "surprised".
- Include narrationText on every page. Dialogue may appear in narrationText only once; do not duplicate speech bubble text in narration.
- text and narrationText must not contain the same dialogue line twice.
- Every page must have imageVariant: "reuse" (first page of scene or no visual change from scene base) or "expression" (genuine change in character expression/pose/position). First page of each scene must always be "reuse".
- Every page must have participationMoment: exactly ONE page must have { type, prompt, hint? }; all others must have null. Participation page should be around page 3-5.
- Every named supporting character must have at least one speech bubble in the story (enforce engagement rules).
- Always refer to the hero by their first name exactly as given in Hero details (never by a title like "Commander") in speakerName, characterDirections.name, characters.name and dialogue.speaker.
- COSTUME LOCK: Every character's outfit established on page 1 must remain IDENTICAL across ALL pages of this story. Never change, replace, or vary any character's clothing mid-story. A costume change may ONLY occur if explicitly written into the plot AND reflected in storyStateUpdate.costumeChange. If no costumeChange is declared, the outfit is frozen.
- HERO OUTFIT LOCK: If the hero has a defined superhero costume, it appears on every page. If not, whatever the hero wears on page 1 is locked for the entire story — never change it.
- CHARACTER SCALE LOCK: The height and body size of every character relative to the hero must remain IDENTICAL across all pages. If a supporting character is taller or shorter than the hero in page 1, that size ratio is frozen for all subsequent pages. Never shrink or grow any character between scenes.
- ADVENTURE OUTFITS (decided ONCE for the whole story): dress EVERY character, including grandparents and parents, for where this story takes place, so the world feels real. On a spaceship or in space: proper space suits. Underwater: diving suits. Snow or ice: warm winter gear. Jungle or mountains: explorer clothes. A royal palace: festive traditional wear. At home or school: everyday clothes. Add a personal or Indian touch where it fits (e.g. Daadi's space suit with a soft saree-print trim, and her bindi). Write the hero's outfit in storyVisualState.costume and every other named character's outfit in storyVisualState.characterOutfits, e.g. { "Daadi": "silver-and-maroon space suit with saree-print trim", "Vedant Bhaiya": "navy space suit with a mission patch" }. Keep glasses, bindis and similar personal features. These outfits NEVER change from page to page, and every scene description must repeat them exactly. The HERO always wears the costume in storyVisualState.costume on every page; adventure outfits are for everyone else (the hero's costume may only gain accessories such as a helmet). No real-world logos, brands or flags on any outfit (no NASA, no foreign flags); patches may show the Indian tricolour or an original mission badge.
- CHARACTER LOOKS (for characters with no photo): for every named character who is not the hero and not listed as a supporting character from a photo — villains, creatures, robots, companions, new friends — describe ONE fixed appearance in storyVisualState.characterLooks, e.g. { "Vortox": "a small shadowy purple space creature with swirling tentacles and big glowing yellow eyes" }. Include species or age, body shape, colours and clothing. This look never changes from page to page.`;
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

    // Gear, villains and episode variety — shared by custom and universe-driven stories.
    const gearLines = ctx?.heroGear?.length
      ? [
          "Hero's Gear (physical items the hero owns — bring 1 or 2 that fit this adventure and USE them in the plot):",
          ...ctx.heroGear.map((g) => `- ${g.emoji ? `${g.emoji} ` : ''}${g.name}${g.description ? ` — ${g.description}` : ''}${g.look ? ` (looks like: ${g.look})` : ''}`),
          'Put the gear the hero carries in storyVisualState.weapon, with its look, so the illustrator draws it.',
        ]
      : [];
    const villainLines = ctx?.returningVillain
      ? [
          `RETURNING VILLAIN — ${ctx.returningVillain.name} is back! They escaped${ctx.returningVillain.lastEpisode ? ` at the end of "${ctx.returningVillain.lastEpisode}"` : ''}${ctx.returningVillain.scheme ? ` after trying to ${ctx.returningVillain.scheme}` : ''}.`,
          `- ${ctx.returningVillain.name} is this episode's villain, with a NEW scheme. Characters should recognise them ("Not ${ctx.returningVillain.name} again!").`,
          ctx.returningVillain.look ? `- Their look never changes: put exactly "${ctx.returningVillain.look}" in storyVisualState.characterLooks["${ctx.returningVillain.name}"].` : '',
        ].filter(Boolean)
      : [
          'VILLAIN: create a NEW named villain with a clear, specific goal and a funny or memorable quirk.',
          ctx?.pastVillains?.length ? `- Already used in this universe (do NOT reuse these names or the same kind of creature): ${ctx.pastVillains.join(', ')}` : '',
        ].filter(Boolean);
    const episodeVarietyLines = !ctx ? [] : [
      ...(ctx.recentEpisodes?.length
        ? [
            'RECENT EPISODES (newest first) — this episode must feel DIFFERENT from all of them: new setting, new kind of problem, new title pattern:',
            ...ctx.recentEpisodes.map((e) => `- "${e.title}"${e.shape ? ` [${e.shape}]` : ''}${e.villain ? ` — villain: ${e.villain}` : ''}`),
          ]
        : []),
      ...(ctx.storyShape && !hasCustomStory
        ? ['', `STORY SHAPE FOR THIS EPISODE — ${ctx.storyShape.label}: ${ctx.storyShape.brief}`]
        : []),
      '',
      ...villainLines,
      '- How the villain\'s story ends must fit the plot. Vary it: outsmarted and "defeated", "captured", "befriended" once they are understood, or "escaped" vowing to return (about one episode in three). Report it in villain.outcome.',
      '',
      ...gearLines,
      '',
      'REWARD (optional — about every other episode): if the hero earns something, it is usually a PHYSICAL object with one clear use — e.g. a sword that cuts through enchanted vines, a shield that reflects light, a bow that shoots rope arrows, an ancient amulet that lights up near danger, a compass that points to whoever is lost, a flute that calms animals, a staff, a helmet, gauntlets, a map that redraws itself. Only occasionally a new ability. Never a duplicate of the hero\'s gear. Gear is used to protect, unlock, climb, cut through obstacles or signal — never to hurt anyone. Describe it in reward (kind "artifact" or "power") with an emoji and its look.',
    ];

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
              ...episodeVarietyLines,
              '',
              'UNIVERSE INTEGRATION RULES:',
              '- The custom adventure above is the story — follow it faithfully.',
              `- But it lives inside "${ctx.universeName}". The tone, world, and identity of this universe must be present.`,
              `- The hero IS known as ${ctx.heroTitle ?? heroName} in this universe; use that identity naturally.`,
              '- If the hero has established powers, they use them during the adventure where it makes sense.',
              "- The hero's companion (if any) may join the adventure.",
              '- Add 1–3 entries to newMemories so this adventure becomes part of universe history.',
              '- If the hero earns a new power, add it to newPowers[] AND add a newMemories entry with type "power_earned".',
              '- Report the villain in villain{}; add a "villain_defeated" memory only if villain.outcome is "defeated" or "captured".',
              '- If a new quest opens, add it to newQuests[] AND add a newMemories entry with type "quest_opened". If the story resolves one of the open quests, list its exact title in questsCompleted[].',
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
              'Open Quests (may optionally advance ONE of these — or ignore them and follow the story shape):',
              ctx.openQuests.length ? ctx.openQuests.map((q) => `- ${q}`).join('\n') : '- None',
              companionLine,
              '',
              ...episodeVarietyLines,
              '',
              'IMPORTANT CONTINUITY RULES:',
              '- Reference past events naturally in the story if relevant',
              '- The hero may use existing powers and gear in new ways',
              '- If storyMode is "continue_arc", the story MUST open exactly where the last episode ended — page 1 must directly react to the cliffhanger above',
              '- If storyMode is "new_arc", introduce a fresh threat but keep universe consistent',
              '- If the hero earns a new power in this story, add its name to newPowers[] AND add a newMemories entry with type "power_earned" and the same name as title',
              '- Report the villain in villain{}; add a "villain_defeated" memory only if villain.outcome is "defeated" or "captured"',
              '- The story may open a new quest — add its title to newQuests[] AND add a newMemories entry with type "quest_opened". If it resolves an open quest, list that exact title in questsCompleted[]',
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
            "anchorTarget": "mouth"
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
  "cliffhanger": "One concrete, surprising final moment that sets up the next episode",
  "storyVisualState": {
    "costume": "Describe the hero's full costume for this story",
    "companion": "Companion name and type, or null",
    "weapon": "Primary weapon or item, or null",
    "powers": ["Power 1", "Power 2"],
    "inventory": ["Item 1", "Item 2"]
  },
  "newPowers": [],
  "newQuests": ["Quest title if a new quest opened — else empty array"],
  "villain": { "name": "Villain name", "look": "Their one fixed appearance", "scheme": "What they wanted, in a few words", "outcome": "defeated | captured | befriended | escaped" },
  "reward": { "name": "Item or power name", "kind": "artifact | power", "emoji": "🗡️", "description": "What it does, one line", "look": "How it looks" },
  "questsCompleted": ["Exact title of an open quest this story resolved — else empty array"],
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
newPowers and newQuests may be empty arrays if none were earned/opened. reward is null when nothing was earned.
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
