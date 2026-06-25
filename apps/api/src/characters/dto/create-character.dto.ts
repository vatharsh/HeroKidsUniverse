import { IsDateString, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export const CHARACTER_ROLES = ['friend', 'sibling', 'pet', 'villain', 'other'] as const;
export type CharacterRole = (typeof CHARACTER_ROLES)[number];

export class CreateCharacterDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  @IsIn(CHARACTER_ROLES)
  role?: CharacterRole;

  @IsOptional()
  @IsDateString()
  dob?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;
}
