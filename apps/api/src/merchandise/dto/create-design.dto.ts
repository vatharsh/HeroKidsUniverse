import { IsIn, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateDesignDto {
  @IsString()
  productId!: string;

  @IsOptional()
  @IsUUID()
  universeId?: string;

  @IsOptional()
  @IsUUID()
  storyId?: string;

  @IsOptional()
  @IsUUID()
  heroId?: string;

  @IsOptional()
  @IsUUID()
  characterId?: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsString()
  titleText?: string;

  @IsOptional()
  @IsString()
  subtitle?: string;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsString()
  themeColor?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;
}
