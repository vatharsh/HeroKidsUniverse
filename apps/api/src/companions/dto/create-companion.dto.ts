import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

import { CompanionType } from '../entities/universe-companion.entity';

export class CreateCompanionDto {
  @IsEnum(CompanionType)
  type!: CompanionType;

  @IsString()
  @MaxLength(50)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @IsUUID()
  petCharacterId?: string;
}
