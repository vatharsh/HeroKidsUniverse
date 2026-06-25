import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

import {
  StoryGenerationInput,
  StoryGenerationOutput,
  StoryGenerationProvider,
} from '../interfaces/story-generation.provider';

@Injectable()
export class GeminiStoryProvider implements StoryGenerationProvider {
  private readonly logger = new Logger(GeminiStoryProvider.name);
  private readonly genAI: GoogleGenerativeAI;
  private readonly model: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('GEMINI_API_KEY') ?? '';
    this.model = this.config.get<string>('GEMINI_MODEL') ?? 'gemini-2.5-flash-lite';
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async generateStory(input: StoryGenerationInput): Promise<StoryGenerationOutput> {
    const prompt = this.buildPrompt(input);
    const modelNames = [this.model, 'gemini-flash-lite-latest', 'gemini-2.0-flash'];
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
            rawResponse,
            inputTokens: result.response.usageMetadata?.promptTokenCount ?? 0,
            outputTokens: result.response.usageMetadata?.candidatesTokenCount ?? 0,
          };
        } catch (err) {
          const msg = err instanceof Error ? err.message : '';
          const isRetryable = msg.includes('503') || msg.includes('overloaded') || msg.includes('high demand');

          if (isRetryable && attempt < maxRetries - 1) {
            const delay = 5000 * (attempt + 1);
            this.logger.warn(`Model ${modelName} busy (attempt ${attempt + 1}), retrying in ${delay / 1000}s`);
            await new Promise((resolve) => setTimeout(resolve, delay));
          } else {
            lastError = err instanceof Error ? err : new Error(msg);
            break;
          }
        }
      }
    }

    throw lastError;
  }

  private buildPrompt(input: StoryGenerationInput): string {
    const ctx = input.universeContext;
    const heroName = input.heroName;
    const supportingCharacters = input.supportingCharacters?.length
      ? `Supporting characters in this episode: ${input.supportingCharacters.join(', ')}`
      : 'Supporting characters in this episode: none';
    const companionLine = ctx?.companion
      ? `\nThe hero's loyal companion is ${ctx.companion.name} (a ${ctx.companion.type}), who accompanies them on this adventure and grows alongside the hero across every future episode.`
      : '';
    const cliffhangerLine = ctx?.lastCliffhanger
      ? `\nLast Episode Cliffhanger (MUST pick up from this exact moment): "${ctx.lastCliffhanger}"\nLast Episode Title: "${ctx.lastStoryTitle ?? 'Previous Episode'}"`
      : '';

    const universeSection = ctx
      ? `
UNIVERSE: ${ctx.universeName}
Hero Title: ${ctx.heroTitle ?? heroName}
Story Mode: ${ctx.storyMode}
User Story Hint: ${ctx.storyContext ?? 'none'}
${cliffhangerLine}

Universe Memory (what has already happened):
${ctx.recentMemories.length ? ctx.recentMemories.map((memory) => `- ${memory}`).join('\n') : '- This is the first adventure'}

Hero's Current Powers & Items:
${ctx.heroPowers.length ? ctx.heroPowers.map((power) => `- ${power}`).join('\n') : '- None yet'}

Open Quests (may optionally advance one of these):
${ctx.openQuests.length ? ctx.openQuests.map((quest) => `- ${quest}`).join('\n') : '- None'}
${companionLine}

IMPORTANT CONTINUITY RULES:
- Reference past events naturally in the story if relevant
- The hero may use existing powers in new ways
- If storyMode is "continue_arc", the story MUST open exactly where the last episode ended — page 1 must directly react to the cliffhanger above
- If storyMode is "new_arc", introduce a fresh threat but keep universe consistent
- The story may earn the hero a new power or item (you will declare this in extras)
- The story may open a new quest (you will declare this in extras)
`
      : '';

    const n = input.pageCount;
    const climaxPage = n - 1;
    const pageEntries = Array.from({ length: n }, (_, i) =>
      `    { "pageNumber": ${i + 1}, "text": "...", "sceneDescription": "..." }`,
    ).join(',\n');

    return `You are a creative children's storybook author for HeroKids Universe - a living world where children are heroes across many adventures.

Hero details:
- Name: ${input.heroName}
- Age: ${input.heroAge}
- Gender: ${input.heroGender}
- Adventure theme: ${input.themeDescription}
${supportingCharacters}
${universeSection}

Write a ${n}-page illustrated comic story where ${ctx?.heroTitle ?? input.heroName} is the main hero.

Rules:
- Each page: 2-3 short sentences (max 40 words per page) suitable for age ${input.heroAge}
- Use simple, exciting language kids love
- Include dialogue and action
- Build to an exciting climax on page ${climaxPage}
- Page ${n}: resolve happily BUT end with a soft cliffhanger sentence that hints at the next adventure
- The hero always wins through kindness, courage, or cleverness - never violence
- Naturally reference universe history if provided

Respond with ONLY valid JSON (no markdown, no code fences):
{
  "title": "Story title here",
  "cliffhanger": "One sentence hinting at the next adventure, e.g. As Arjun held the Magic Stardust...",
  "newPowers": ["Power Name 1"],
  "newQuests": ["Quest title that was opened in this story"],
  "newMemories": [
    { "type": "power_earned", "title": "Earned Magic Stardust", "detail": "Found in the Crystal Cave" },
    { "type": "villain_defeated", "title": "Defeated Shadow Bot", "detail": "Used teamwork and courage" },
    { "type": "location_discovered", "title": "Moon Crystal Cave", "detail": "Hidden beneath the lunar surface" }
  ],
  "pages": [
${pageEntries}
  ]
}

newMemories type must be one of: character_met, villain_defeated, power_earned, item_found, location_discovered, quest_opened, quest_completed, achievement_unlocked
newPowers and newQuests may be empty arrays if none were earned/opened.`;
  }
}
