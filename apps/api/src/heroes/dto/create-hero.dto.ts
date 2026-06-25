import { IsDateString, IsEnum, IsOptional, IsString, IsUrl, MinLength } from 'class-validator';

import { HeroGender } from '../hero.entity';

export class CreateHeroDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsDateString()
  dob!: string;

  @IsEnum(HeroGender)
  gender!: HeroGender;

  @IsOptional()
  @IsUrl({ require_tld: false })
  avatarUrl?: string;
}
