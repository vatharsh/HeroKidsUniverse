import { BadRequestException, ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { JwtSignOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';

import { Influencer, InfluencerStatus } from '../influencers/influencer.entity';
import { INFLUENCER_PROGRAM_PAUSED_MESSAGE, isInfluencerProgramEnabled } from '../influencers/influencer-program';
import { PlatformSetting, SETTING_DEFAULTS } from '../admin/platform-setting.entity';
import { CreditTransaction, CreditTransactionReason } from '../credits/credit-transaction.entity';
import { User, UserRole } from '../users/user.entity';
import { CurrentUserPayload } from './decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { EmailCodeService } from './email-code.service';
import { isEmailVerificationRequired, needsEmailVerification } from './email-verification-policy';
import { MailService } from '../mail/mail.service';
import { isDisposableEmail } from './disposable-email';

/** Bump when the Terms or Privacy Policy change materially (matches the date on those pages). */
const TERMS_VERSION = '2026-10-21';

export interface AuthUserResponse {
  id: string;
  name: string;
  email: string;
  credits: number;
  characterSlotsTotal: number;
  characterSlotsUsed: number;
  avatarRefreshTokens: number;
  previewCredits: number;
  role?: string;
  emailVerified: boolean;
}

export interface AuthTokensResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUserResponse;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Influencer)
    private readonly influencersRepository: Repository<Influencer>,
    @InjectRepository(PlatformSetting)
    private readonly platformSettingsRepository: Repository<PlatformSetting>,
    @InjectRepository(CreditTransaction)
    private readonly creditTransactionsRepository: Repository<CreditTransaction>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailCodes: EmailCodeService,
    private readonly mail: MailService,
  ) {}

  /** Signed-in parent: is a code still needed, and was one just sent? */
  private async verificationRequiredFor(user: User): Promise<boolean> {
    return !user.emailVerifiedAt && needsEmailVerification(user.role)
      && isEmailVerificationRequired(this.platformSettingsRepository, this.mail);
  }

  async sendVerificationCode(userId: string) {
    const user = await this.usersRepository.findOneOrFail({ where: { id: userId } });
    if (user.emailVerifiedAt) return { alreadyVerified: true, resendInSeconds: 0 };
    return { alreadyVerified: false, ...(await this.emailCodes.send(user, 'verify_email')) };
  }

  async verifyEmail(userId: string, code: string) {
    const user = await this.usersRepository.findOneOrFail({ where: { id: userId } });
    if (!user.emailVerifiedAt) {
      await this.emailCodes.consume(user, 'verify_email', code);
      await this.usersRepository.update(user.id, { emailVerifiedAt: new Date() });
    }
    return this.me({ id: user.id, email: user.email });
  }

  /** Always answers the same way, so it can't be used to find out who has an account. */
  async forgotPassword(email: string) {
    const user = await this.usersRepository.findOne({ where: { email: email.toLowerCase().trim() } });
    if (user) {
      await this.emailCodes.send(user, 'reset_password').catch((err: unknown) => {
        this.logger.warn(`Password reset code not sent for ${user.id}: ${err instanceof Error ? err.message : String(err)}`);
      });
    }
    return { message: 'If an account exists for that email, we have sent a code to reset the password.' };
  }

  async resetPassword(email: string, code: string, newPassword: string) {
    const user = await this.usersRepository.findOne({ where: { email: email.toLowerCase().trim() } });
    if (!user) throw new UnauthorizedException('That code isn\'t right. Please ask for a new one.');
    await this.emailCodes.consume(user, 'reset_password', code);
    await this.usersRepository.update(user.id, {
      passwordHash: await bcrypt.hash(newPassword, 12),
      // Receiving the code proves they own the inbox.
      emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
    });
    return { message: 'Your password has been changed. You can sign in now.' };
  }

  async register(registerDto: RegisterDto): Promise<AuthTokensResponse> {
    const email = registerDto.email.toLowerCase();
    if (isDisposableEmail(email)) {
      throw new BadRequestException("Please sign up with your regular email address — temporary email addresses can't be used.");
    }
    const existingUser = await this.usersRepository.findOne({ where: { email }, withDeleted: true });

    if (existingUser) {
      throw new ConflictException('Email is already registered');
    }

    let referredBy: string | null = null;
    if (registerDto.referralCode) {
      const referrer = await this.usersRepository.findOne({
        where: { referralCode: registerDto.referralCode },
      });
      referredBy = referrer ? registerDto.referralCode : null;
    }

    const passwordHash = await bcrypt.hash(registerDto.password, 12);
    const [freeSignupCredits, freePreviewStories, sandboxSetting] = await Promise.all([
      this.getSettingNumber('FREE_SIGNUP_CREDITS', Number(SETTING_DEFAULTS.FREE_SIGNUP_CREDITS.value)),
      this.getSettingNumber('FREE_PREVIEW_STORIES', Number(SETTING_DEFAULTS.FREE_PREVIEW_STORIES.value)),
      this.platformSettingsRepository.findOne({ where: { key: 'SANDBOX_MODE' } }),
    ]);
    const isSandbox = sandboxSetting ? sandboxSetting.value === 'true' : true;
    const user = await this.usersRepository.save(
      this.usersRepository.create({
        email,
        passwordHash,
        name: registerDto.name,
        role: UserRole.Parent,
        credits: freeSignupCredits,
        previewCredits: freePreviewStories,
        referredBy,
        isSandbox,
        // Before launch (Sandbox Mode on) every new account is a test account; real accounts start at go-live.
        isTestAccount: isSandbox,
        termsAcceptedAt: new Date(),
        termsVersion: TERMS_VERSION,
      }),
    );

    if (freeSignupCredits > 0) {
      await this.creditTransactionsRepository.save(
        this.creditTransactionsRepository.create({
          userId: user.id,
          delta: freeSignupCredits,
          reason: CreditTransactionReason.Signup,
          referenceId: null,
        }),
      );
    }
    if (freePreviewStories > 0) {
      // Previews aren't credits, so delta stays 0 — the row just records the grant for support/audit.
      await this.creditTransactionsRepository.save(
        this.creditTransactionsRepository.create({
          userId: user.id,
          delta: 0,
          reason: CreditTransactionReason.Signup,
          referenceId: `free_preview:${freePreviewStories}`,
        }),
      );
    }

    // Send the sign-up code straight away; if it fails the parent can ask for another on the next screen.
    if (await this.verificationRequiredFor(user)) {
      await this.emailCodes.send(user, 'verify_email').catch((err: unknown) => {
        this.logger.error(`Sign-up code not sent for ${user.id}: ${err instanceof Error ? err.message : String(err)}`);
      });
    }

    const tokens = await this.signTokens(user);
    return { ...tokens, user: this.toAuthUser(user) };
  }

  async login(loginDto: LoginDto): Promise<AuthTokensResponse> {
    const email = loginDto.email.toLowerCase();
    const user = await this.usersRepository.findOne({ where: { email } });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(loginDto.password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.role === UserRole.Influencer) {
      if (!(await isInfluencerProgramEnabled(this.platformSettingsRepository))) {
        throw new UnauthorizedException(INFLUENCER_PROGRAM_PAUSED_MESSAGE);
      }
      const influencer = await this.influencersRepository.findOne({ where: { userId: user.id, isDeleted: false } });
      if (!influencer || !influencer.active || influencer.status !== InfluencerStatus.Active) {
        throw new UnauthorizedException('Influencer login is inactive');
      }
      influencer.lastLoginAt = new Date();
      await this.influencersRepository.save(influencer);
    }

    const tokens = await this.signTokens(user);
    return { ...tokens, user: this.toAuthUser(user) };
  }

  async refresh(currentUser: CurrentUserPayload): Promise<{ accessToken: string }> {
    const user = await this.usersRepository.findOne({ where: { id: currentUser.id } });

    if (!user) {
      throw new UnauthorizedException();
    }

    return {
      accessToken: await this.jwtService.signAsync(
        { sub: user.id, email: user.email },
        {
          secret: this.configService.get<string>('JWT_ACCESS_SECRET') ?? 'change_me_access',
          expiresIn: this.getJwtExpiration('JWT_ACCESS_EXPIRES', '15m'),
        },
      ),
    };
  }

  async me(currentUser: CurrentUserPayload) {
    const user = await this.usersRepository.findOneOrFail({ where: { id: currentUser.id } });

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone ?? null,
      profileImageUrl: user.profileImageUrl ?? null,
      role: user.role,
      plan: user.plan,
      isPremium: user.isPremium,
      credits: user.credits,
      characterSlotsTotal: user.characterSlotsTotal,
      characterSlotsUsed: user.characterSlotsUsed,
      avatarRefreshTokens: user.avatarRefreshTokens,
      previewCredits: user.previewCredits,
      referralCode: user.referralCode,
      createdAt: user.createdAt,
      emailVerified: !!user.emailVerifiedAt,
      emailVerificationRequired: await this.verificationRequiredFor(user),
    };
  }

  private async signTokens(user: User) {
    const payload = { sub: user.id, email: user.email };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET') ?? 'change_me_access',
        expiresIn: this.getJwtExpiration('JWT_ACCESS_EXPIRES', '15m'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET') ?? 'change_me_refresh',
        expiresIn: this.getJwtExpiration('JWT_REFRESH_EXPIRES', '7d'),
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private getJwtExpiration(key: string, fallback: string): JwtSignOptions['expiresIn'] {
    return (this.configService.get<string>(key) ?? fallback) as JwtSignOptions['expiresIn'];
  }

  private toAuthUser(user: User): AuthUserResponse {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      credits: user.credits,
      characterSlotsTotal: user.characterSlotsTotal,
      characterSlotsUsed: user.characterSlotsUsed,
      avatarRefreshTokens: user.avatarRefreshTokens,
      previewCredits: user.previewCredits,
      role: user.role,
      emailVerified: !!user.emailVerifiedAt,
    };
  }

  private async getSettingNumber(key: string, fallback: number): Promise<number> {
    const row = await this.platformSettingsRepository.findOne({ where: { key } });
    if (row) return Number(row.value);
    const def = SETTING_DEFAULTS[key];
    const envAliases: Record<string, string[]> = {
      FREE_SIGNUP_CREDITS: ['FREE_SIGNUP_CREDITS'],
      FREE_PREVIEW_STORIES: ['FREE_PREVIEW_STORIES'],
    };
    for (const envKey of envAliases[key] ?? [key]) {
      const raw = this.configService.get<string>(envKey) ?? process.env[envKey];
      if (raw !== undefined && raw !== null) {
        const num = Number(raw);
        if (Number.isFinite(num)) return num;
      }
    }
    return def ? Number(def.value) : fallback;
  }
}
