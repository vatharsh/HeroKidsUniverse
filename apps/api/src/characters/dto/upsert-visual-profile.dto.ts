import { IsOptional, IsString } from 'class-validator';

export class UpsertVisualProfileDto {
  @IsOptional()
  @IsString()
  costumeDescription?: string;

  @IsOptional()
  @IsString()
  hairDescription?: string;

  @IsOptional()
  @IsString()
  faceDescription?: string;

  @IsOptional()
  @IsString()
  skinTone?: string;

  @IsOptional()
  @IsString()
  eyeDescription?: string;

  @IsOptional()
  @IsString()
  accessories?: string;

  @IsOptional()
  @IsString()
  colors?: string;

  @IsOptional()
  @IsString()
  doNotChangeRules?: string;
}
