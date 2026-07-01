import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AiModule } from '../ai/ai.module';
import { PromptRegistryModule } from '../ai/prompt-registry.module';
import { PlatformSetting } from '../admin/platform-setting.entity';
import { UniverseCompanion } from '../companions/entities/universe-companion.entity';
import { Hero } from '../heroes/hero.entity';
import { CharacterCanonService } from './character-canon.service';
import { CharacterCanon } from './entities/character-canon.entity';
import { Character } from './entities/character.entity';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([CharacterCanon, Hero, Character, UniverseCompanion, PlatformSetting]),
    AiModule,
    PromptRegistryModule,
  ],
  providers: [CharacterCanonService],
  exports: [CharacterCanonService],
})
export class CharacterCanonModule {}
