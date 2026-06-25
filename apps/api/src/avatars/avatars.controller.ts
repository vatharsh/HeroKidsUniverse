import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { AvatarsService } from './avatars.service';

@Controller('avatars')
export class AvatarsController {
  constructor(private readonly avatarsService: AvatarsService) {}

  @Get()
  getStats(@CurrentUser() user: CurrentUserPayload) {
    return this.avatarsService.getStats(user.id);
  }

  @Post('generate')
  @UseInterceptors(FileInterceptor('photo'))
  generate(
    @CurrentUser() user: CurrentUserPayload,
    @UploadedFile() photo: Express.Multer.File,
    @Body('type') type: string,
    @Body('adjustmentHint') adjustmentHint?: string,
  ) {
    if (!photo) throw new BadRequestException('photo is required');
    if (type !== 'hero' && type !== 'character') {
      throw new BadRequestException('type must be hero or character');
    }
    return this.avatarsService.generate(user.id, photo, type, adjustmentHint);
  }
}
