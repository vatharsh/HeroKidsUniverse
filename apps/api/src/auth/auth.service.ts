import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { JwtSignOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';

import { Influencer, InfluencerStatus } from '../influencers/influencer.entity';
import { PlatformSetting, SETTING_DEFAULTS } from '../admin/platform-setting.entity';
import { CreditTransaction, CreditTransactionReason } from '../credits/credit-transaction.entity';
import { User, UserRole } from '../users/user.entity';
import { CurrentUserPayload } from './decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

export interface AuthUserResponse {
  id: string;
  name: string;
  email: string;
  credits: number;
  characterSlotsTotal: number;
  characterSlotsUsed: number;
  avatarRefreshTokens: number;
  role?: string;
}

export interface AuthTokensResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUserResponse;
}

@Injectable()
export class AuthService {
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
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthTokensResponse> {
    const email = registerDto.email.toLowerCase();
    const existingUser = await this.usersRepository.findOne({ where: { email } });

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
    const [freeSignupCredits, sandboxSetting] = await Promise.all([
      this.getSettingNumber('FREE_SIGNUP_CREDITS', Number(SETTING_DEFAULTS.FREE_SIGNUP_CREDITS.value)),
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
        referredBy,
        isSandbox,
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
      referralCode: user.referralCode,
      createdAt: user.createdAt,
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
      role: user.role,
    };
  }

  private async getSettingNumber(key: string, fallback: number): Promise<number> {
    const row = await this.platformSettingsRepository.findOne({ where: { key } });
    if (row) return Number(row.value);
    const def = SETTING_DEFAULTS[key];
    const envAliases: Record<string, string[]> = {
      FREE_SIGNUP_CREDITS: ['FREE_SIGNUP_CREDITS'],
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
