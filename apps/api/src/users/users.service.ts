import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';

import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}

  async getProfile(userId: string) {
    const user = await this.usersRepo.findOneOrFail({ where: { id: userId } });
    return this.toProfile(user);
  }

  async updateProfile(userId: string, dto: { name?: string; phone?: string }) {
    const user = await this.usersRepo.findOneOrFail({ where: { id: userId } });
    if (dto.name !== undefined) user.name = dto.name.trim();
    if (dto.phone !== undefined) user.phone = dto.phone.trim() || null;
    await this.usersRepo.save(user);
    return this.toProfile(user);
  }

  async changePassword(userId: string, dto: { currentPassword: string; newPassword: string }) {
    const user = await this.usersRepo.findOneOrFail({ where: { id: userId } });
    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid) throw new BadRequestException('Current password is incorrect');
    if (dto.newPassword.length < 8) throw new BadRequestException('Password must be at least 8 characters');
    user.passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.usersRepo.save(user);
    return { message: 'Password changed successfully' };
  }

  async findById(id: string): Promise<User> {
    const user = await this.usersRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  private toProfile(user: User) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone ?? null,
      profileImageUrl: user.profileImageUrl ?? null,
      role: user.role,
      plan: user.plan,
      credits: user.credits,
      characterSlotsTotal: user.characterSlotsTotal,
      characterSlotsUsed: user.characterSlotsUsed,
      avatarRefreshTokens: user.avatarRefreshTokens,
      referralCode: user.referralCode,
      createdAt: user.createdAt,
    };
  }
}
