import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

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
  @ArrayMaxSize(3, { message: 'You can pick up to 3 characters per story' })
  @IsUUID(undefined, { each: true })
  characterIds?: string[];

  /** "Plays as…" for cast members in this story, by character id (e.g. { "<id>": "the Genie" }). */
  @IsOptional()
  @IsObject()
  castRoles?: Record<string, string>;

  /** New look for the hero in this story (and, inside a universe, the episodes after it). */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  heroOutfit?: string;

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

  @IsOptional()
  @IsBoolean()
  skipCompanion?: boolean;
}
