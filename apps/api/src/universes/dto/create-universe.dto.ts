import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateUniverseDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  heroTitle?: string;

  @IsOptional()
  @IsString()
  tagline?: string;
}
