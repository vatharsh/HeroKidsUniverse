import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { createReadStream, existsSync } from 'fs';
import { join } from 'path';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { UploadService } from './upload.service';

const AVATAR_UPLOAD_DIR    = join(process.cwd(), 'uploads', 'avatars');
const STORY_UPLOAD_DIR     = join(process.cwd(), 'uploads', 'stories');
const CHARACTER_UPLOAD_DIR = join(process.cwd(), 'uploads', 'characters');
const AUDIO_UPLOAD_DIR     = join(process.cwd(), 'uploads', 'audio');
const VIDEO_UPLOAD_DIR     = join(process.cwd(), 'uploads', 'videos');

@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('avatar')
  @UseInterceptors(FileInterceptor('photo'))
  uploadAvatar(
    @CurrentUser() currentUser: CurrentUserPayload,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.uploadService.uploadAvatar(currentUser.id, file);
  }

  @Public()
  @Get('files/:filename')
  serveFile(@Param('filename') filename: string, @Res() res: Response) {
    const filePath = join(AVATAR_UPLOAD_DIR, filename);
    if (!existsSync(filePath)) throw new NotFoundException('File not found');
    res.setHeader('Content-Type', 'image/png');
    createReadStream(filePath).pipe(res);
  }

  @Public()
  @Get('files/stories/:filename')
  serveStoryFile(@Param('filename') filename: string, @Res() res: Response) {
    const filePath = join(STORY_UPLOAD_DIR, filename);
    if (!existsSync(filePath)) throw new NotFoundException('File not found');
    res.setHeader('Content-Type', 'image/png');
    createReadStream(filePath).pipe(res);
  }

  @Public()
  @Get('files/characters/:filename')
  serveCharacterFile(@Param('filename') filename: string, @Res() res: Response) {
    const filePath = join(CHARACTER_UPLOAD_DIR, filename);
    if (!existsSync(filePath)) throw new NotFoundException('File not found');
    res.setHeader('Content-Type', 'image/png');
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
  serveVideoFile(@Param('filename') filename: string, @Res() res: Response) {
    const filePath = join(VIDEO_UPLOAD_DIR, filename);
    if (!existsSync(filePath)) throw new NotFoundException('File not found');
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Accept-Ranges', 'bytes');
    createReadStream(filePath).pipe(res);
  }
}
