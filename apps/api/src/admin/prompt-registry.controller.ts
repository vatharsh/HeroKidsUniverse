import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { PromptRegistrySeedService } from '../ai/prompt-registry-seed.service';
import { PromptRegistryService } from '../ai/prompt-registry.service';

@Controller('admin/ai/prompts')
@Roles('admin')
export class PromptRegistryController {
  constructor(
    private readonly registry: PromptRegistryService,
    private readonly seedService: PromptRegistrySeedService,
  ) {}

  @Post('reseed')
  async reseed() {
    await this.seedService.seed();
    return { success: true, message: 'Prompt registry reseeded with default content.' };
  }

  @Get('templates')
  listTemplates(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('promptType') promptType?: string,
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.registry.listTemplates({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      promptType,
      search,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    });
  }

  @Post('templates')
  createTemplate(@Body() body: any) {
    return this.registry.createTemplate(body);
  }

  @Get('templates/:id')
  getTemplate(@Param('id') id: string) {
    return this.registry.getTemplate(id);
  }

  @Patch('templates/:id')
  updateTemplate(@Param('id') id: string, @Body() body: any) {
    return this.registry.updateTemplate(id, body);
  }

  @Delete('templates/:id')
  deleteTemplate(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.registry.softDeleteTemplate(id, user.id);
  }

  @Get('templates/:id/versions')
  getVersions(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.registry.getVersions(id, {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
  }

  @Post('templates/:id/versions')
  createVersion(@Param('id') id: string, @Body() body: any, @CurrentUser() user: CurrentUserPayload) {
    return this.registry.createVersion(id, body, user.id);
  }

  @Get('versions/:versionId')
  getVersion(@Param('versionId') versionId: string) {
    return this.registry.getVersion(versionId);
  }

  @Patch('versions/:versionId')
  updateVersion(@Param('versionId') versionId: string, @Body() body: any) {
    return this.registry.updateVersion(versionId, body);
  }

  @Post('versions/:versionId/activate')
  activateVersion(@Param('versionId') versionId: string, @CurrentUser() user: CurrentUserPayload) {
    return this.registry.activateVersion(versionId, user.id);
  }

  @Post('versions/:versionId/archive')
  archiveVersion(@Param('versionId') versionId: string) {
    return this.registry.archiveVersion(versionId);
  }

  @Post('versions/:versionId/duplicate')
  duplicateVersion(@Param('versionId') versionId: string, @CurrentUser() user: CurrentUserPayload) {
    return this.registry.duplicateVersion(versionId, user.id);
  }

  @Post('versions/:versionId/rollback')
  rollback(@Param('versionId') versionId: string, @CurrentUser() user: CurrentUserPayload) {
    return this.registry.rollback(versionId, user.id);
  }

  @Get('versions/:versionId/performance')
  getVersionPerformance(@Param('versionId') versionId: string) {
    return this.registry.getVersionPerformance(versionId);
  }

  @Get('compare')
  compareVersions(@Query('leftVersionId') leftVersionId: string, @Query('rightVersionId') rightVersionId: string) {
    return this.registry.compareVersions(leftVersionId, rightVersionId);
  }
}
