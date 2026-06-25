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
import { CreateHeroDto } from './dto/create-hero.dto';
import { UpdateHeroDto } from './dto/update-hero.dto';
import { HeroesService } from './heroes.service';

@Controller('heroes')
export class HeroesController {
  constructor(private readonly heroesService: HeroesService) {}

  @Post()
  @UseInterceptors(FileInterceptor('photo'))
  create(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Body() createHeroDto: CreateHeroDto,
    @UploadedFile() photo?: Express.Multer.File,
  ) {
    return this.heroesService.create(currentUser.id, createHeroDto, photo);
  }

  @Get()
  findAll(@CurrentUser() currentUser: CurrentUserPayload) {
    return this.heroesService.findAll(currentUser.id);
  }

  @Get(':id')
  findOne(@CurrentUser() currentUser: CurrentUserPayload, @Param('id') id: string) {
    return this.heroesService.findOne(currentUser.id, id);
  }

  @Patch(':id')
  @UseInterceptors(FileInterceptor('photo'))
  update(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Param('id') id: string,
    @Body() updateHeroDto: UpdateHeroDto,
    @UploadedFile() photo?: Express.Multer.File,
  ) {
    return this.heroesService.update(currentUser.id, id, updateHeroDto, photo);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  remove(@CurrentUser() currentUser: CurrentUserPayload, @Param('id') id: string) {
    return this.heroesService.remove(currentUser.id, id);
  }
}
