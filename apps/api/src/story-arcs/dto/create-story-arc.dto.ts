import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateStoryArcDto {
  @IsUUID()
  universeId!: string;

  @IsString()
  @MinLength(3)
  title!: string;

  @IsOptional()
  @IsString()
  summary?: string;
}
