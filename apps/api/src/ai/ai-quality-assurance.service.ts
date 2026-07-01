import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PlatformSetting, SETTING_DEFAULTS } from '../admin/platform-setting.entity';
import { CharacterCanon } from '../characters/entities/character-canon.entity';
import { Hero } from '../heroes/hero.entity';
import { StoryPage, StoryStatus, StoryVisualState } from '../stories/story.entity';
import { Story } from '../stories/story.entity';
import { Universe } from '../universes/universe.entity';
import { UploadService } from '../upload/upload.service';
import { IMAGE_GENERATION_PROVIDER } from './interfaces/image-generation.provider';
import type { ImageGenerationInput, ImageGenerationProvider } from './interfaces/image-generation.provider';
import { StoryQaPage } from './entities/story-qa-page.entity';
import { StoryQaRun } from './entities/story-qa-run.entity';

interface QaSettings {
  enabled: boolean;
  enableAutoRegeneration: boolean;
  enableIdentityQa: boolean;
  enableStoryQa: boolean;
  enableExpressionQa: boolean;
  enableDialogueQa: boolean;
  enableCompositionQa: boolean;
  enableNarrationQa: boolean;
  minIdentityScore: number;
  minStoryScore: number;
  minExpressionScore: number;
  minOverallConfidence: number;
  maxRetries: number;
  weightIdentity: number;
  weightStory: number;
  weightExpression: number;
  weightDialogue: number;
  weightComposition: number;
  weightNarration: number;
  weightStateConsistency: number;
  qaVersion: string;
  storyPromptVersion: string;
  imagePromptVersion: string;
  forceRegeneration: boolean;
  disableQaLogging: boolean;
  maxCostPerStory: number;
  stopRegenOnBudget: boolean;
  imageCostPerRegen: number;
  retryStrategy: string;
}

export interface PageQaResult {
  pageNumber: number;
  identityScore: number;
  storyScore: number;
  expressionScore: number;
  dialogueScore: number;
  compositionScore: number;
  narrationScore: number;
  overallScore: number;
  issues: string[];
  accepted: boolean;
  retryCount: number;
  imageCostUsd: number;
  ttsCostUsd: number;
  acceptedImageUrl: string | null;
}

export interface StoryQaResult {
  overallConfidence: number;
  overallStatus: string;
  pages: PageQaResult[];
  finalPages: StoryPage[];
  avgIdentityScore: number;
  avgStoryScore: number;
  avgExpressionScore: number;
  avgDialogueScore: number;
  avgCompositionScore: number;
  avgNarrationScore: number;
  pagesRetried: number;
  topIssues: string[];
}

@Injectable()
export class AIQualityAssuranceService {
  private readonly logger = new Logger(AIQualityAssuranceService.name);

  constructor(
    @Inject(IMAGE_GENERATION_PROVIDER) private readonly imageProvider: ImageGenerationProvider,
    private readonly uploadService: UploadService,
    @InjectRepository(StoryQaRun) private readonly qaRunRepo: Repository<StoryQaRun>,
    @InjectRepository(StoryQaPage) private readonly qaPageRepo: Repository<StoryQaPage>,
    @InjectRepository(Story) private readonly storiesRepo: Repository<Story>,
    @InjectRepository(CharacterCanon) private readonly canonRepo: Repository<CharacterCanon>,
    @InjectRepository(Universe) private readonly universesRepo: Repository<Universe>,
    @InjectRepository(PlatformSetting) private readonly settingsRepo: Repository<PlatformSetting>,
  ) {}

  async runStoryQA(params: {
    story: Story;
    hero: Hero;
    heroCanon: CharacterCanon | null;
    pages: StoryPage[];
    storyVisualState: StoryVisualState | null;
    imageGenerationInput?: Partial<ImageGenerationInput>;
  }): Promise<StoryQaResult> {
    const { story, hero, heroCanon, pages, storyVisualState, imageGenerationInput } = params;
    const startedAt = Date.now();

    this.logger.log(`QA starting for story ${story.id} (${pages.length} pages, hero=${hero.id})`);

    let settings: QaSettings;
    try {
      settings = await this.loadQaSettings();
    } catch (err) {
      this.logger.error(`QA FAILED: could not load settings for story ${story.id}`, err instanceof Error ? err.stack : String(err));
      throw err;
    }

    if (!settings.enabled || pages.length === 0) {
      this.logger.log(`QA skipped for story ${story.id}: enabled=${settings.enabled} pages=${pages.length}`);
      return this.buildSkippedResult(pages);
    }

    this.logger.log(`QA scoring ${pages.length} pages for story ${story.id} (identity=${settings.enableIdentityQa} story=${settings.enableStoryQa} expression=${settings.enableExpressionQa})`);

    // Score all pages concurrently
    let pageResults: PageQaResult[];
    try {
      pageResults = await Promise.all(
        pages.map((page) => this.scorePage(page, hero, heroCanon, storyVisualState, settings, pages)),
      );
    } catch (err) {
      this.logger.error(`QA FAILED during page scoring for story ${story.id}`, err instanceof Error ? err.stack : String(err));
      throw err;
    }

    this.logger.log(`QA page scoring done for story ${story.id}: ${pageResults.map(p => `p${p.pageNumber}:${p.identityScore}/${p.storyScore}`).join(' ')}`);

    // Calculate overall confidence
    const overallConfidence = this.calculateConfidence(pageResults, settings);

    // Auto-regeneration: attempt to fix failed pages
    let finalPages = [...pages];
    let pagesRetried = 0;

    // QA_RETRY_STRATEGY=never means do not attempt any regeneration
    const regenDisabledByStrategy = settings.retryStrategy === 'never';
    if (regenDisabledByStrategy) {
      this.logger.log(`QA_RETRY_STRATEGY=never — auto-regeneration suppressed for story ${story.id}`);
    }

    // forceRegeneration: mark all pages as not accepted to force all through the regen loop
    if (settings.forceRegeneration) {
      pageResults.forEach((pr) => { pr.accepted = false; });
      this.logger.warn(`QA_FORCE_REGENERATION is enabled for story ${story.id} — all pages will be regenerated`);
    }

    if (
      settings.enableAutoRegeneration &&
      !regenDisabledByStrategy &&
      (settings.forceRegeneration || overallConfidence < settings.minOverallConfidence) &&
      imageGenerationInput
    ) {
      let regenCostSoFar = 0;

      for (const pr of pageResults) {
        // Budget guard: stop before attempting the next image if budget is already exhausted
        if (settings.stopRegenOnBudget && (regenCostSoFar + settings.imageCostPerRegen) > settings.maxCostPerStory) {
          this.logger.warn(
            `QA budget would be exceeded for story ${story.id}: spent $${regenCostSoFar.toFixed(4)}, next image $${settings.imageCostPerRegen} > budget $${settings.maxCostPerStory} — stopping auto-regeneration`,
          );
          break;
        }

        if (pr.accepted) continue;
        if (pr.identityScore >= settings.minIdentityScore) continue; // only retry identity failures
        const originalPage = finalPages.find((p) => p.pageNumber === pr.pageNumber);
        if (!originalPage?.imageUrl) continue;

        const maxRetries = Math.max(1, settings.maxRetries);
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          // Pre-attempt budget check: would this attempt exceed the budget?
          if (settings.stopRegenOnBudget && (regenCostSoFar + settings.imageCostPerRegen) > settings.maxCostPerStory) break;

          try {
            this.logger.log(`QA auto-regenerating page ${pr.pageNumber} attempt ${attempt}/${maxRetries} (identityScore=${pr.identityScore})`);
            const regenInput: ImageGenerationInput = {
              ...(imageGenerationInput as ImageGenerationInput),
              sceneDescription: originalPage.sceneDescription ?? imageGenerationInput.sceneDescription ?? '',
              identityBoostMode: true,
            };
            const output = await this.imageProvider.generateImage(regenInput);
            let newUrl: string | undefined;
            if (output.imageBase64) {
              newUrl = await this.uploadService.uploadGeneratedImage(
                story.userId, story.id, originalPage.pageNumber, output.imageBase64,
              );
            } else {
              newUrl = output.imageUrl;
            }
            if (newUrl) {
              regenCostSoFar += settings.imageCostPerRegen;
              pr.acceptedImageUrl = newUrl;
              pr.retryCount++;
              pr.accepted = true;
              finalPages = finalPages.map((p) =>
                p.pageNumber === pr.pageNumber ? { ...p, imageUrl: newUrl } : p,
              );
              pagesRetried++;
              break; // success — stop retrying this page
            }
          } catch (err) {
            this.logger.warn(`QA auto-regeneration failed for page ${pr.pageNumber} attempt ${attempt}/${maxRetries}`, err);
          }
          if (pr.accepted) break;
        }
      }
    }

    // Persist run record
    const topIssues = this.collectTopIssues(pageResults);
    const avgIdentityScore    = this.avg(pageResults.map((p) => p.identityScore));
    const avgStoryScore       = this.avg(pageResults.map((p) => p.storyScore));
    const avgExpressionScore  = this.avg(pageResults.map((p) => p.expressionScore));
    const avgDialogueScore    = this.avg(pageResults.map((p) => p.dialogueScore));
    const avgCompositionScore = this.avg(pageResults.map((p) => p.compositionScore));
    const avgNarrationScore   = this.avg(pageResults.map((p) => p.narrationScore));
    const overallStatus       = this.getStatus(overallConfidence);
    const generationTimeMs    = Date.now() - startedAt;

    let run: StoryQaRun | null = null;
    if (settings.disableQaLogging) {
      this.logger.warn(`QA_DISABLE_QA_LOGGING is enabled — skipping DB write for story ${story.id}`);
    } else
    try {
      run = await this.qaRunRepo.save(
        this.qaRunRepo.create({
          storyId: story.id,
          userId: story.userId,
          qaVersion: settings.qaVersion,
          storyPromptVersion: settings.storyPromptVersion,
          imagePromptVersion: settings.imagePromptVersion,
          avgIdentityScore,
          avgStoryScore,
          avgExpressionScore,
          avgDialogueScore,
          avgCompositionScore,
          avgNarrationScore,
          overallConfidence,
          overallStatus,
          pagesRetried,
          topIssues,
          generationTimeMs,
        }),
      );
      this.logger.log(`QA run record saved: ${run.id} for story ${story.id}`);

      await Promise.all(
        pageResults.map((pr) =>
          this.qaPageRepo.save(
            this.qaPageRepo.create({
              storyQaRunId: run!.id,
              storyId: story.id,
              pageNumber: pr.pageNumber,
              identityScore: pr.identityScore,
              storyScore: pr.storyScore,
              expressionScore: pr.expressionScore,
              dialogueScore: pr.dialogueScore,
              compositionScore: pr.compositionScore,
              narrationScore: pr.narrationScore,
              overallScore: pr.overallScore,
              accepted: pr.accepted,
              retryCount: pr.retryCount,
              issues: pr.issues,
              acceptedImageUrl: pr.acceptedImageUrl,
              generationTimeMs,
            }),
          ),
        ),
      );
      this.logger.log(`QA page records saved (${pageResults.length} pages) for story ${story.id}`);
    } catch (err) {
      this.logger.error(
        `QA DB SAVE FAILED for story ${story.id}: ${err instanceof Error ? err.message : String(err)}`,
        err instanceof Error ? err.stack : undefined,
      );
    }

    // Update story.overallConfidence
    try {
      await this.storiesRepo.update(story.id, { overallConfidence });
    } catch {}

    // Update character confidence
    if (heroCanon) {
      await this.updateCharacterConfidence(heroCanon, pageResults, avgStoryScore).catch(() => {});
    }

    // Update universe confidence
    if (story.universeId) {
      await this.updateUniverseConfidence(story).catch(() => {});
    }

    this.logger.log(
      `QA complete for story ${story.id}: confidence=${overallConfidence} status=${overallStatus} retried=${pagesRetried}`,
    );

    return {
      overallConfidence,
      overallStatus,
      pages: pageResults,
      finalPages,
      avgIdentityScore,
      avgStoryScore,
      avgExpressionScore,
      avgDialogueScore,
      avgCompositionScore,
      avgNarrationScore,
      pagesRetried,
      topIssues,
    };
  }

  // ─── Per-page scoring ──────────────────────────────────────────────────────

  private async scorePage(
    page: StoryPage,
    hero: Hero,
    heroCanon: CharacterCanon | null,
    storyVisualState: StoryVisualState | null,
    settings: QaSettings,
    allPages: StoryPage[],
  ): Promise<PageQaResult> {
    const issues: string[] = [];

    const [identityScore, storyScore, expressionScore, dialogueScore, compositionScore, narrationScore] =
      await Promise.all([
        settings.enableIdentityQa
          ? this.scoreIdentity(page, hero, heroCanon).catch(() => 5)
          : Promise.resolve(8),
        settings.enableStoryQa
          ? Promise.resolve(this.scoreStory(page, storyVisualState, allPages, issues))
          : Promise.resolve(8),
        settings.enableExpressionQa
          ? Promise.resolve(this.scoreExpression(page, issues))
          : Promise.resolve(8),
        settings.enableDialogueQa
          ? Promise.resolve(this.scoreDialogue(page, issues))
          : Promise.resolve(8),
        settings.enableCompositionQa
          ? this.scoreComposition(page, issues).catch(() => 8)
          : Promise.resolve(8),
        settings.enableNarrationQa
          ? Promise.resolve(this.scoreNarration(page, issues))
          : Promise.resolve(8),
      ]);

    // Weighted page score (0–10)
    const weights = settings;
    const totalW = weights.weightIdentity + weights.weightStory + weights.weightExpression
      + weights.weightDialogue + weights.weightComposition + weights.weightNarration;
    const overallScore = (
      identityScore * weights.weightIdentity +
      storyScore * weights.weightStory +
      expressionScore * weights.weightExpression +
      dialogueScore * weights.weightDialogue +
      compositionScore * weights.weightComposition +
      narrationScore * weights.weightNarration
    ) / totalW;

    const accepted = identityScore >= settings.minIdentityScore
      && storyScore >= settings.minStoryScore
      && expressionScore >= settings.minExpressionScore;

    return {
      pageNumber: page.pageNumber,
      identityScore: Math.round(identityScore * 10) / 10,
      storyScore: Math.round(storyScore * 10) / 10,
      expressionScore: Math.round(expressionScore * 10) / 10,
      dialogueScore: Math.round(dialogueScore * 10) / 10,
      compositionScore: Math.round(compositionScore * 10) / 10,
      narrationScore: Math.round(narrationScore * 10) / 10,
      overallScore: Math.round(overallScore * 10) / 10,
      issues,
      accepted,
      retryCount: 0,
      imageCostUsd: 0,
      ttsCostUsd: 0,
      acceptedImageUrl: page.imageUrl ?? null,
    };
  }

  private async scoreIdentity(
    page: StoryPage,
    hero: Hero,
    _heroCanon: CharacterCanon | null,
  ): Promise<number> {
    if (!page.imageUrl) {
      this.logger.debug(`Identity QA page ${page.pageNumber}: no imageUrl, score=0`);
      return 0;
    }
    if (!hero.avatarUrl) {
      this.logger.debug(`Identity QA page ${page.pageNumber}: no avatarUrl, score=8 (skip)`);
      return 8;
    }

    try {
      const result = await this.imageProvider.checkFaceConsistencyFromUrl(
        hero.avatarUrl,
        page.imageUrl,
        hero.name ?? 'Hero',
      );
      const score = result?.identityScore ?? 5;
      this.logger.log(`Identity QA page ${page.pageNumber}: score=${score}/10 rec=${result?.recommendation ?? 'unknown'}`);
      return score;
    } catch (err) {
      this.logger.warn(
        `Identity QA page ${page.pageNumber} failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return 5;
    }
  }

  private scoreStory(
    page: StoryPage,
    storyVisualState: StoryVisualState | null,
    allPages: StoryPage[],
    issues: string[],
  ): number {
    let score = 10;

    if (!page.text || page.text.length < 10) {
      score -= 3;
      issues.push(`page ${page.pageNumber}: narration text missing or too short`);
    }

    if (storyVisualState) {
      const snap = page.storyStateSnapshot;
      if (snap) {
        if (storyVisualState.costume && snap.costume && snap.costume !== storyVisualState.costume) {
          score -= 1;
          issues.push(`page ${page.pageNumber}: costume changed unexpectedly`);
        }
        if (storyVisualState.companion && snap.companions && !snap.companions.some((c) =>
          storyVisualState.companion && c.includes(storyVisualState.companion.split(' ')[0]))) {
          score -= 1;
          issues.push(`page ${page.pageNumber}: companion missing from story state`);
        }
      }
    }

    // Check for stagnant location (3+ consecutive pages same location)
    const idx = allPages.findIndex((p) => p.pageNumber === page.pageNumber);
    if (idx >= 3) {
      const recentLocations = allPages.slice(idx - 2, idx + 1).map((p) => p.storyStateSnapshot?.location);
      if (recentLocations.every((l) => l && l === recentLocations[0])) {
        score -= 0.5;
      }
    }

    return Math.max(0, score);
  }

  private scoreExpression(page: StoryPage, issues: string[]): number {
    const dirs = page.characterDirections;
    const bubbles = page.speechBubbles ?? page.dialogue?.map((d) => ({ speakerName: d.speaker, text: d.text, emotion: d.emotion })) ?? [];

    if (!dirs || dirs.length === 0) return 9;
    if (bubbles.length === 0) return 9;

    let score = 10;
    let mismatches = 0;

    for (const dir of dirs) {
      const bubble = bubbles.find((b) => {
        const bSpeaker = 'speakerName' in b ? b.speakerName : (b as { speaker?: string }).speaker ?? '';
        return bSpeaker?.toLowerCase().includes(dir.name.toLowerCase().split(' ')[0]);
      });
      if (!bubble) continue;

      const emotion = bubble.emotion ?? '';
      const expr = dir.expression?.toLowerCase() ?? '';

      const emotionMap: Array<[string[], string[]]> = [
        [['excited', 'happy', 'joyful', 'thrilled'], ['smil', 'bright', 'excit', 'joy', 'gleam']],
        [['sad', 'cry', 'upset', 'unhappy'], ['sad', 'frown', 'tears', 'sorr']],
        [['scared', 'afraid', 'fear', 'nervous'], ['fear', 'wide', 'scared', 'nervous', 'trem']],
        [['angry', 'furious', 'mad'], ['angry', 'frown', 'furrowed', 'stern']],
        [['surprised', 'shocked', 'amazed'], ['surprised', 'wide', 'shock', 'amaz']],
        [['determined', 'focused', 'brave'], ['determin', 'focus', 'resolv', 'brave', 'confident']],
      ];

      let matched = false;
      for (const [emotionKeywords, expressionKeywords] of emotionMap) {
        const emotionMatches = emotionKeywords.some((k) => emotion.toLowerCase().includes(k));
        if (emotionMatches) {
          const exprMatches = expressionKeywords.some((k) => expr.includes(k));
          if (!exprMatches) {
            mismatches++;
            issues.push(`page ${page.pageNumber}: ${dir.name}'s expression may not match emotion "${emotion}"`);
          }
          matched = true;
          break;
        }
      }
      void matched;
    }

    score -= mismatches * 1.5;
    return Math.max(5, score);
  }

  private scoreDialogue(page: StoryPage, issues: string[]): number {
    const bubbles = page.speechBubbles ?? page.dialogue?.map((d) => ({ speakerName: d.speaker, text: d.text })) ?? [];
    if (bubbles.length === 0) return 10;

    let score = 10;
    const seenTexts = new Set<string>();

    for (const b of bubbles) {
      const speaker = 'speakerName' in b ? b.speakerName : (b as { speaker?: string }).speaker ?? '';
      const text = b.text ?? '';

      if (!speaker || speaker === 'undefined' || speaker === 'null') {
        score -= 2;
        issues.push(`page ${page.pageNumber}: speech bubble has no valid speaker`);
      }
      if (!text || text.length === 0) {
        score -= 1;
        issues.push(`page ${page.pageNumber}: speech bubble has empty text`);
      }
      if (seenTexts.has(text)) {
        score -= 1.5;
        issues.push(`page ${page.pageNumber}: duplicate speech bubble text`);
      }
      seenTexts.add(text);

      const finalNarration = (page.finalNarrationText ?? page.narrationText ?? page.text ?? '').toLowerCase();
      const normalizedDialogue = text.toLowerCase();
      const first = finalNarration.indexOf(normalizedDialogue);
      if (text.length > 10 && first !== -1 && finalNarration.indexOf(normalizedDialogue, first + 1) !== -1) {
        score -= 2;
        issues.push(`page ${page.pageNumber}: narration repeats dialogue more than once`);
      }
    }

    return Math.max(0, score);
  }

  private async scoreComposition(page: StoryPage, issues: string[]): Promise<number> {
    // Composition QA via vision model — only runs when QA_ENABLE_COMPOSITION_QA is true
    // (already handled at caller level; this is a fallback)
    if (!page.imageUrl) {
      issues.push(`page ${page.pageNumber}: no image for composition check`);
      return 5;
    }
    let score = 8;
    const bubbles = page.speechBubbles ?? [];
    if (bubbles.length > 2) {
      score -= 1;
      issues.push(`page ${page.pageNumber}: too many speech bubbles for clean composition`);
    }
    for (const bubble of bubbles) {
      if (!bubble.preferredPosition || !bubble.tailDirection) {
        score -= 1;
        issues.push(`page ${page.pageNumber}: speech bubble missing structured placement`);
      }
      if (!bubble.anchorTarget && !bubble.anchor) {
        score -= 0.5;
        issues.push(`page ${page.pageNumber}: speech bubble missing speaker anchor target`);
      }
    }
    const hasSpeakingDirection = page.characterDirections?.some((d) => d.isSpeaking || d.mouthState === 'speaking');
    if (bubbles.length > 0 && !hasSpeakingDirection) {
      score -= 1.5;
      issues.push(`page ${page.pageNumber}: speech exists but no speaking character direction`);
    }
    return Math.max(0, score);
  }

  private scoreNarration(page: StoryPage, issues: string[]): number {
    const finalText = page.finalNarrationText ?? page.narrationText ?? page.text;
    if (!finalText || finalText.length < 20) {
      issues.push(`page ${page.pageNumber}: narration text very short`);
      return 6;
    }
    if (page.audioUrl) return 10;

    // No audio but text exists
    issues.push(`page ${page.pageNumber}: narration audio missing`);
    return 5;
  }

  // ─── Confidence calculation ───────────────────────────────────────────────

  private calculateConfidence(pages: PageQaResult[], settings: QaSettings): number {
    if (pages.length === 0) return 0;

    const avgIdentity    = this.avg(pages.map((p) => p.identityScore));
    const avgStory       = this.avg(pages.map((p) => p.storyScore));
    const avgExpression  = this.avg(pages.map((p) => p.expressionScore));
    const avgDialogue    = this.avg(pages.map((p) => p.dialogueScore));
    const avgComposition = this.avg(pages.map((p) => p.compositionScore));
    const avgNarration   = this.avg(pages.map((p) => p.narrationScore));

    const totalWeight =
      settings.weightIdentity + settings.weightStory + settings.weightExpression +
      settings.weightDialogue + settings.weightComposition + settings.weightNarration +
      settings.weightStateConsistency;

    const raw = (
      avgIdentity    * settings.weightIdentity +
      avgStory       * settings.weightStory +
      avgExpression  * settings.weightExpression +
      avgDialogue    * settings.weightDialogue +
      avgComposition * settings.weightComposition +
      avgNarration   * settings.weightNarration +
      avgStory       * settings.weightStateConsistency  // reuse story score for state consistency weight
    ) / totalWeight;

    return Math.min(100, Math.max(0, Math.round(raw * 10)));
  }

  private getStatus(confidence: number): string {
    if (confidence >= 90) return 'pass';
    if (confidence >= 70) return 'pass_with_warning';
    return 'fail';
  }

  // ─── Tracking helpers ─────────────────────────────────────────────────────

  private async updateCharacterConfidence(
    canon: CharacterCanon,
    pageResults: PageQaResult[],
    avgStoryScore: number,
  ): Promise<void> {
    const identityScores = pageResults.map((p) => p.identityScore);
    const newAvgIdentity = this.avg(identityScores); // 0–10
    const prevStability = canon.identityStability ?? newAvgIdentity * 10;
    const updatedStability = prevStability * 0.7 + newAvgIdentity * 10 * 0.3; // EMA α=0.3
    const avatarQuality = (canon.qualityScore ?? 80);
    const characterConfidence =
      avatarQuality * 0.3 +
      updatedStability * 0.4 +
      avgStoryScore * 10 * 0.3;

    await this.canonRepo.update(canon.id, {
      identityStability: Math.round(updatedStability * 10) / 10,
      storyConsistency: Math.round(avgStoryScore * 10),
      characterConfidence: Math.round(characterConfidence * 10) / 10,
    });
  }

  private async updateUniverseConfidence(story: Story): Promise<void> {
    if (!story.universeId) return;
    const recent = await this.storiesRepo.find({
      where: { universeId: story.universeId, status: StoryStatus.Completed },
      order: { createdAt: 'DESC' },
      take: 20,
      select: ['overallConfidence'],
    });
    const valid = recent.filter((s) => s.overallConfidence !== null).map((s) => s.overallConfidence!);
    if (valid.length === 0) return;
    const avg = this.avg(valid);
    await this.universesRepo.update(story.universeId, { avgConfidence: Math.round(avg * 10) / 10 });
  }

  // ─── Utility ─────────────────────────────────────────────────────────────

  private avg(nums: number[]): number {
    if (nums.length === 0) return 0;
    return nums.reduce((a, b) => a + b, 0) / nums.length;
  }

  private collectTopIssues(pages: PageQaResult[]): string[] {
    const freq = new Map<string, number>();
    for (const p of pages) {
      for (const issue of p.issues) {
        // Normalise: strip page number prefix for aggregation
        const key = issue.replace(/^page \d+:\s*/, '');
        freq.set(key, (freq.get(key) ?? 0) + 1);
      }
    }
    return [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([reason, count]) => `${reason} (×${count})`);
  }

  private buildSkippedResult(pages: StoryPage[]): StoryQaResult {
    const neutral: PageQaResult = {
      pageNumber: 0,
      identityScore: 10, storyScore: 10, expressionScore: 10,
      dialogueScore: 10, compositionScore: 10, narrationScore: 10,
      overallScore: 10, issues: [], accepted: true,
      retryCount: 0, imageCostUsd: 0, ttsCostUsd: 0, acceptedImageUrl: null,
    };
    return {
      overallConfidence: 100,
      overallStatus: 'pass',
      pages: pages.map((p) => ({ ...neutral, pageNumber: p.pageNumber, acceptedImageUrl: p.imageUrl ?? null })),
      finalPages: pages,
      avgIdentityScore: 10, avgStoryScore: 10, avgExpressionScore: 10,
      avgDialogueScore: 10, avgCompositionScore: 10, avgNarrationScore: 10,
      pagesRetried: 0, topIssues: [],
    };
  }

  private async loadQaSettings(): Promise<QaSettings> {
    const rows = await this.settingsRepo.find();
    const map = new Map(rows.map((r) => [r.key, r.value]));

    const bool = (key: string, def: boolean) => {
      const v = map.get(key);
      if (v === undefined) return (SETTING_DEFAULTS[key]?.value ?? String(def)) === 'true';
      return v === 'true';
    };
    const num = (key: string, def: number) => {
      const v = map.get(key) ?? SETTING_DEFAULTS[key]?.value;
      const n = Number(v);
      return Number.isFinite(n) ? n : def;
    };
    const str = (key: string, def: string) => map.get(key) ?? SETTING_DEFAULTS[key]?.value ?? def;

    return {
      enabled:                   bool('QA_ENABLED', true),
      enableAutoRegeneration:    bool('QA_ENABLE_AUTO_REGENERATION', true),
      enableIdentityQa:          bool('QA_ENABLE_IDENTITY_QA', true),
      enableStoryQa:             bool('QA_ENABLE_STORY_QA', true),
      enableExpressionQa:        bool('QA_ENABLE_EXPRESSION_QA', true),
      enableDialogueQa:          bool('QA_ENABLE_DIALOGUE_QA', true),
      enableCompositionQa:       bool('QA_ENABLE_COMPOSITION_QA', false),
      enableNarrationQa:         bool('QA_ENABLE_NARRATION_QA', true),
      minIdentityScore:          num('QA_MIN_IDENTITY_SCORE', 6),
      minStoryScore:             num('QA_MIN_STORY_SCORE', 6),
      minExpressionScore:        num('QA_MIN_EXPRESSION_SCORE', 5),
      minOverallConfidence:      num('QA_MIN_OVERALL_CONFIDENCE', 70),
      maxRetries:                num('QA_MAX_RETRIES', 2),
      weightIdentity:            num('QA_WEIGHT_IDENTITY', 40),
      weightStory:               num('QA_WEIGHT_STORY', 20),
      weightExpression:          num('QA_WEIGHT_EXPRESSION', 10),
      weightDialogue:            num('QA_WEIGHT_DIALOGUE', 10),
      weightComposition:         num('QA_WEIGHT_COMPOSITION', 10),
      weightNarration:           num('QA_WEIGHT_NARRATION', 5),
      weightStateConsistency:    num('QA_WEIGHT_STATE_CONSISTENCY', 5),
      qaVersion:                 str('QA_VERSION', '1.0'),
      storyPromptVersion:        str('QA_STORY_PROMPT_VERSION', '1.0'),
      imagePromptVersion:        str('QA_IMAGE_PROMPT_VERSION', '1.0'),
      forceRegeneration:         bool('QA_FORCE_REGENERATION', false),
      disableQaLogging:          bool('QA_DISABLE_QA_LOGGING', false),
      maxCostPerStory:           num('QA_MAX_COST_PER_STORY', 0.35),
      stopRegenOnBudget:         bool('QA_STOP_REGEN_ON_BUDGET', true),
      imageCostPerRegen:         num('OPENAI_IMAGE_COST_PER_IMAGE', 0.011),
      retryStrategy:             str('QA_RETRY_STRATEGY', 'page_only'),
    };
  }
}
