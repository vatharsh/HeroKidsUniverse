import { Module } from '@nestjs/common';

import { IMAGE_GENERATION_PROVIDER } from './interfaces/image-generation.provider';
import { NARRATION_PROVIDER } from './interfaces/narration.provider';
import { STORY_GENERATION_PROVIDER } from './interfaces/story-generation.provider';
import { GeminiStoryProvider } from './providers/gemini-story.provider';
import { OpenAIImageProvider } from './providers/openai-image.provider';
import { OpenAITTSProvider } from './providers/openai-tts.provider';

@Module({
  providers: [
    { provide: STORY_GENERATION_PROVIDER, useClass: GeminiStoryProvider },
    { provide: IMAGE_GENERATION_PROVIDER, useClass: OpenAIImageProvider },
    { provide: NARRATION_PROVIDER, useClass: OpenAITTSProvider },
  ],
  exports: [STORY_GENERATION_PROVIDER, IMAGE_GENERATION_PROVIDER, NARRATION_PROVIDER],
})
export class AiModule {}
