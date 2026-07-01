import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PromptRunSnapshot } from './entities/prompt-run-snapshot.entity';
import { PromptTemplateVersion } from './entities/prompt-template-version.entity';
import { PromptTemplate } from './entities/prompt-template.entity';
import { PromptRegistrySeedService } from './prompt-registry-seed.service';
import { PromptRegistryService } from './prompt-registry.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PromptTemplate, PromptTemplateVersion, PromptRunSnapshot]),
  ],
  providers: [PromptRegistryService, PromptRegistrySeedService],
  exports: [PromptRegistryService, PromptRegistrySeedService],
})
export class PromptRegistryModule {}
