import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PlatformSetting } from '../admin/platform-setting.entity';
import { IMAGE_GENERATION_PROVIDER } from './interfaces/image-generation.provider';
import { NARRATION_PROVIDER } from './interfaces/narration.provider';
import { STORY_GENERATION_PROVIDER } from './interfaces/story-generation.provider';
import { PromptRegistryModule } from './prompt-registry.module';
import { GeminiCharacterLocator } from './providers/gemini-character-locator.service';
import { GeminiStoryProvider } from './providers/gemini-story.provider';
import { GeminiTTSProvider } from './providers/gemini-tts.provider';
import { ImageProviderDispatcher } from './providers/image-provider-dispatcher.service';
import { NanoBananaImageProvider } from './providers/nano-banana-image.provider';
import { NarrationProviderDispatcher } from './providers/narration-provider-dispatcher.service';
import { OpenAIImageProvider } from './providers/openai-image.provider';
import { OpenAITTSProvider } from './providers/openai-tts.provider';

@Module({
  imports: [
    PromptRegistryModule,
    TypeOrmModule.forFeature([PlatformSetting]),
  ],
  providers: [
    OpenAIImageProvider,
    NanoBananaImageProvider,
    ImageProviderDispatcher,
    OpenAITTSProvider,
    GeminiTTSProvider,
    NarrationProviderDispatcher,
    GeminiCharacterLocator,
    { provide: STORY_GENERATION_PROVIDER, useClass: GeminiStoryProvider },
    { provide: IMAGE_GENERATION_PROVIDER, useClass: ImageProviderDispatcher },
    { provide: NARRATION_PROVIDER, useClass: NarrationProviderDispatcher },
  ],
  exports: [STORY_GENERATION_PROVIDER, IMAGE_GENERATION_PROVIDER, NARRATION_PROVIDER, GeminiCharacterLocator],
})
export class AiModule {}
