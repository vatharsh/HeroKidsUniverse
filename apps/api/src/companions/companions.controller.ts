import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { CompanionsService } from './companions.service';
import { CreateCompanionDto } from './dto/create-companion.dto';

@Controller('companions')
export class CompanionsController {
  constructor(private readonly companionsService: CompanionsService) {}

  @Get('universe/:universeId')
  getByUniverse(@Param('universeId') universeId: string) {
    return this.companionsService.getByUniverse(universeId);
  }

  @Post('universe/:universeId')
  createOrReplace(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Param('universeId') universeId: string,
    @Body() dto: CreateCompanionDto,
  ) {
    return this.companionsService.createOrReplace(currentUser.id, universeId, dto);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  remove(@CurrentUser() currentUser: CurrentUserPayload, @Param('id') id: string) {
    return this.companionsService.remove(currentUser.id, id);
  }
}
