import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { UserAddress } from './user-address.entity';

export interface UpsertAddressDto {
  label?: string;
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  country?: string;
  isDefault?: boolean;
}

@Injectable()
export class UserAddressesService {
  constructor(
    @InjectRepository(UserAddress)
    private readonly repo: Repository<UserAddress>,
  ) {}

  async list(userId: string): Promise<UserAddress[]> {
    return this.repo.find({
      where: { userId, isDeleted: false },
      order: { isDefault: 'DESC', createdAt: 'ASC' },
    });
  }

  async create(userId: string, dto: UpsertAddressDto): Promise<UserAddress> {
    if (dto.isDefault) await this.clearDefaults(userId);
    const address = this.repo.create({
      userId,
      label: dto.label ?? null,
      fullName: dto.fullName,
      phone: dto.phone,
      addressLine1: dto.addressLine1,
      addressLine2: dto.addressLine2 ?? null,
      city: dto.city,
      state: dto.state,
      pincode: dto.pincode,
      country: dto.country ?? 'India',
      isDefault: dto.isDefault ?? false,
    });
    return this.repo.save(address);
  }

  async update(userId: string, id: string, dto: Partial<UpsertAddressDto>): Promise<UserAddress> {
    const address = await this.findOwned(userId, id);
    if (dto.isDefault) await this.clearDefaults(userId);
    Object.assign(address, {
      label: dto.label !== undefined ? dto.label ?? null : address.label,
      fullName: dto.fullName ?? address.fullName,
      phone: dto.phone ?? address.phone,
      addressLine1: dto.addressLine1 ?? address.addressLine1,
      addressLine2: dto.addressLine2 !== undefined ? dto.addressLine2 ?? null : address.addressLine2,
      city: dto.city ?? address.city,
      state: dto.state ?? address.state,
      pincode: dto.pincode ?? address.pincode,
      country: dto.country ?? address.country,
      isDefault: dto.isDefault ?? address.isDefault,
    });
    return this.repo.save(address);
  }

  async setDefault(userId: string, id: string): Promise<UserAddress> {
    const address = await this.findOwned(userId, id);
    await this.clearDefaults(userId);
    address.isDefault = true;
    return this.repo.save(address);
  }

  async softDelete(userId: string, id: string): Promise<{ message: string }> {
    const address = await this.findOwned(userId, id);
    address.isDeleted = true;
    address.deletedAt = new Date();
    address.deletedBy = userId;
    await this.repo.save(address);
    return { message: 'Address deleted' };
  }

  private async findOwned(userId: string, id: string): Promise<UserAddress> {
    const address = await this.repo.findOne({ where: { id, isDeleted: false } });
    if (!address) throw new NotFoundException('Address not found');
    if (address.userId !== userId) throw new ForbiddenException();
    return address;
  }

  private async clearDefaults(userId: string): Promise<void> {
    await this.repo.update({ userId, isDefault: true, isDeleted: false }, { isDefault: false });
  }
}
