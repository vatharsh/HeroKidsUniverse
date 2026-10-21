import {
  Query,
  Controller,
  Get,
  GoneException,
  NotFoundException,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { createReadStream, existsSync } from 'fs';
import { join } from 'path';

import { Public } from '../auth/decorators/public.decorator';
import { UploadService } from './upload.service';
import { imageContentType } from './image-preview';

const AVATAR_UPLOAD_DIR    = join(process.cwd(), 'uploads', 'avatars');
const STORY_UPLOAD_DIR     = join(process.cwd(), 'uploads', 'stories');
const CHARACTER_UPLOAD_DIR = join(process.cwd(), 'uploads', 'characters');
const AUDIO_UPLOAD_DIR     = join(process.cwd(), 'uploads', 'audio');
const VIDEO_UPLOAD_DIR     = join(process.cwd(), 'uploads', 'videos');

@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  /** Raw photos are never stored (they are only used in memory to draw the cartoon avatar). */
  @Post('avatar')
  uploadAvatar() {
    throw new GoneException('Photos are no longer stored. Create the hero with the photo and we will draw the avatar.');
  }

  @Public()
  @Get('files/:filename')
  serveFile(@Param('filename') filename: string, @Res() res: Response) {
    const filePath = join(AVATAR_UPLOAD_DIR, filename);
    if (!existsSync(filePath)) throw new NotFoundException('File not found');
    res.setHeader('Content-Type', imageContentType(filename));
    createReadStream(filePath).pipe(res);
  }

  @Public()
  @Get('files/stories/:filename')
  serveStoryFile(@Param('filename') filename: string, @Res() res: Response) {
    const filePath = join(STORY_UPLOAD_DIR, filename);
    if (!existsSync(filePath)) throw new NotFoundException('File not found');
    res.setHeader('Content-Type', imageContentType(filename));
    createReadStream(filePath).pipe(res);
  }

  @Public()
  @Get('files/characters/:filename')
  serveCharacterFile(@Param('filename') filename: string, @Res() res: Response) {
    const filePath = join(CHARACTER_UPLOAD_DIR, filename);
    if (!existsSync(filePath)) throw new NotFoundException('File not found');
    res.setHeader('Content-Type', imageContentType(filename));
    createReadStream(filePath).pipe(res);
  }

  @Public()
  @Get('files/audio/:filename')
  serveAudioFile(@Param('filename') filename: string, @Res() res: Response) {
    const filePath = join(AUDIO_UPLOAD_DIR, filename);
    if (!existsSync(filePath)) throw new NotFoundException('File not found');
    res.setHeader('Content-Type', 'audio/mpeg');
    createReadStream(filePath).pipe(res);
  }

  @Public()
  @Get('files/videos/:filename')
  serveVideoFile(@Param('filename') filename: string, @Query('name') name: string | undefined, @Res() res: Response) {
    const filePath = join(VIDEO_UPLOAD_DIR, filename);
    if (!existsSync(filePath)) throw new NotFoundException('File not found');
    res.setHeader('Content-Type', 'video/mp4');
    // Download rather than play in the browser (matches the R2 objects' Content-Disposition).
    const safeName = (name ?? 'herokids-story').replace(/[^a-z0-9-]/gi, '-').slice(0, 80) || 'herokids-story';
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}.mp4"`);
    res.setHeader('Accept-Ranges', 'bytes');
    createReadStream(filePath).pipe(res);
  }
}
