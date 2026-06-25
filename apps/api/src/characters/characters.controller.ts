import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { CharactersService } from './characters.service';
import { CreateCharacterDto } from './dto/create-character.dto';
import { UpdateCharacterDto } from './dto/update-character.dto';

@Controller('characters')
export class CharactersController {
  constructor(private readonly charactersService: CharactersService) {}

  @Post()
  @UseInterceptors(FileInterceptor('photo'))
  create(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Body() createCharacterDto: CreateCharacterDto,
    @UploadedFile() photo?: Express.Multer.File,
  ) {
    return this.charactersService.create(currentUser.id, createCharacterDto, photo);
  }

  @Get()
  findAll(@CurrentUser() currentUser: CurrentUserPayload) {
    return this.charactersService.findAll(currentUser.id);
  }

  @Get('me/economy')
  getEconomy(@CurrentUser() currentUser: CurrentUserPayload) {
    return this.charactersService.getCharacterEconomy(currentUser.id);
  }

  @Get(':id')
  findOne(@CurrentUser() currentUser: CurrentUserPayload, @Param('id') id: string) {
    return this.charactersService.findOne(currentUser.id, id);
  }

  @Post(':id/avatar/refresh')
  @UseInterceptors(FileInterceptor('photo'))
  refreshAvatar(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Param('id') id: string,
    @UploadedFile() photo: Express.Multer.File,
    @Body('adjustmentHint') adjustmentHint?: string,
  ) {
    return this.charactersService.refreshAvatar(currentUser.id, id, photo, adjustmentHint);
  }

  @Patch(':id')
  @UseInterceptors(FileInterceptor('photo'))
  update(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Param('id') id: string,
    @Body() updateCharacterDto: UpdateCharacterDto,
    @UploadedFile() photo?: Express.Multer.File,
  ) {
    return this.charactersService.update(currentUser.id, id, updateCharacterDto, photo);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  remove(@CurrentUser() currentUser: CurrentUserPayload, @Param('id') id: string) {
    return this.charactersService.remove(currentUser.id, id);
  }
}
