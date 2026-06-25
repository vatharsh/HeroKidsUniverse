import { ArrayMaxSize, IsArray, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

import { StoryMode, StoryTheme } from '../story.entity';

export class CreateStoryDto {
  @IsUUID()
  heroId!: string;

  @IsOptional()
  @IsEnum(StoryTheme)
  theme?: StoryTheme;

  @IsOptional()
  @IsUUID()
  universeId?: string;

  @IsOptional()
  @IsEnum(StoryMode)
  storyMode?: StoryMode;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  storyContext?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @IsUUID(undefined, { each: true })
  characterIds?: string[];

  @IsOptional()
  @IsString()
  companionType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  companionName?: string;

  @IsOptional()
  @IsUUID()
  companionPetId?: string;
}
