import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';

import { CurrentUser } from './decorators/current-user.decorator';
import type { CurrentUserPayload } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { AllowUnverified } from './decorators/allow-unverified.decorator';
import { ForgotPasswordDto, ResetPasswordDto, VerifyEmailDto } from './dto/email-code.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { AuthService } from './auth.service';
import type { AuthTokensResponse } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  register(@Body() registerDto: RegisterDto): Promise<AuthTokensResponse> {
    return this.authService.register(registerDto);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() loginDto: LoginDto): Promise<AuthTokensResponse> {
    return this.authService.login(loginDto);
  }

  @Public()
  @UseGuards(JwtRefreshGuard)
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  refresh(@CurrentUser() currentUser: CurrentUserPayload) {
    return this.authService.refresh(currentUser);
  }

  @AllowUnverified()
  @HttpCode(HttpStatus.OK)
  @Post('verify-email')
  verifyEmail(@CurrentUser() currentUser: CurrentUserPayload, @Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(currentUser.id, dto.code);
  }

  @AllowUnverified()
  @HttpCode(HttpStatus.OK)
  @Post('verify-email/resend')
  resendVerification(@CurrentUser() currentUser: CurrentUserPayload) {
    return this.authService.sendVerificationCode(currentUser.id);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.email, dto.code, dto.newPassword);
  }

  @AllowUnverified()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  logout() {
    return { message: 'Logged out' };
  }

  @AllowUnverified()
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() currentUser: CurrentUserPayload) {
    return this.authService.me(currentUser);
  }
}
