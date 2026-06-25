import { PartialType } from '@nestjs/swagger';
import { IsOptional, IsUrl } from 'class-validator';

import { CreateHeroDto } from './create-hero.dto';

export class UpdateHeroDto extends PartialType(CreateHeroDto) {
  @IsOptional()
  @IsUrl({ require_tld: false })
  avatarUrl?: string;
}
