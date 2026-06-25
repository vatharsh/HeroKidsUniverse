import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateHeroPowerDto {
  @IsUUID()
  universeId!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  emoji?: string;
}
