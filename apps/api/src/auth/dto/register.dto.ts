import { Equals, IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsString()
  referralCode?: string;

  /** Parent/guardian confirmation + acceptance of the Terms and Privacy Policy (needed for children's data). */
  @Equals(true, { message: 'Please confirm you are the parent or guardian and accept the Terms and Privacy Policy.' })
  acceptTerms!: boolean;
}
