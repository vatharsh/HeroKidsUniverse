import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CreateStoryDto } from './dto/create-story.dto';
import { StoriesService } from './stories.service';
import { VideoGenerationService } from '../generation/video-generation.service';

@Controller('stories')
export class StoriesController {
  constructor(
    private readonly storiesService: StoriesService,
    private readonly videoService: VideoGenerationService,
  ) {}

  @Post()
  create(@CurrentUser() currentUser: CurrentUserPayload, @Body() createStoryDto: CreateStoryDto) {
    return this.storiesService.create(currentUser.id, createStoryDto);
  }

  @Get()
  findAll(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Query('universeId') universeId?: string,
    @Query('standalone') standalone?: string,
  ) {
    return this.storiesService.findAll(currentUser.id, universeId, standalone === 'true');
  }

  @Get(':id')
  findOne(@CurrentUser() currentUser: CurrentUserPayload, @Param('id') id: string) {
    return this.storiesService.findOne(currentUser.id, id);
  }

  @Get(':id/recap')
  getRecap(@CurrentUser() currentUser: CurrentUserPayload, @Param('id') id: string) {
    return this.storiesService.getRecap(currentUser.id, id);
  }

  @Public()
  @Get(':id/public')
  findPublic(@Param('id') id: string) {
    return this.storiesService.findOnePublic(id);
  }

  @Post(':id/generate-video')
  async generateVideo(@CurrentUser() cu: CurrentUserPayload, @Param('id') id: string) {
    const story = await this.storiesService.findOne(cu.id, id);
    if (story.videoStatus === 'generating') {
      return { message: 'Video generation already in progress' };
    }
    // Fire-and-forget — returns immediately
    void this.videoService.generateVideo(id, cu.id);
    return { message: 'Video generation started', storyId: id };
  }

  @Get(':id/video-status')
  async getVideoStatus(@CurrentUser() cu: CurrentUserPayload, @Param('id') id: string) {
    const story = await this.storiesService.findOne(cu.id, id);
    return { videoStatus: story.videoStatus ?? 'not_started', videoUrl: story.videoUrl ?? null };
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  remove(@CurrentUser() currentUser: CurrentUserPayload, @Param('id') id: string) {
    return this.storiesService.remove(currentUser.id, id);
  }
}
