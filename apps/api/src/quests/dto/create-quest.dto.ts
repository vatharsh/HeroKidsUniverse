import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateQuestDto {
  @IsUUID()
  universeId!: string;

  @IsString()
  @MinLength(3)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;
}
