import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UploadService } from '../upload/upload.service';
import { InfluencerCouponCode } from './influencer-coupon-code.entity';
import { Influencer } from './influencer.entity';
import { InfluencersService } from './influencers.service';

@Controller('admin/influencers')
@Roles('admin')
@UsePipes(new ValidationPipe({ whitelist: false, transform: false }))
export class AdminInfluencersController {
  constructor(
    private readonly influencersService: InfluencersService,
    private readonly uploadService: UploadService,
  ) {}

  @Get()
  findAll(
    @Query('search') search?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('status') status?: string,
  ) {
    return this.influencersService.listInfluencers({
      search,
      page: Number(page),
      limit: Number(limit),
      status,
    });
  }

  @Post()
  create(@Body() dto: Partial<Influencer>) {
    return this.influencersService.createInfluencer(dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.influencersService.getInfluencerDetail(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<Influencer>) {
    return this.influencersService.updateInfluencer(id, dto);
  }

  @Post(':id/login')
  createLogin(@Param('id') id: string, @Body() dto: { email: string; password: string }) {
    return this.influencersService.createInfluencerLogin(id, dto);
  }

  @Post(':id/reset-password')
  resetPassword(@Param('id') id: string, @Body() dto: { password: string }) {
    return this.influencersService.resetInfluencerPassword(id, dto.password);
  }

  @Patch(':id/login-status')
  setLoginStatus(@Param('id') id: string, @Body() dto: { enabled: boolean }) {
    return this.influencersService.setInfluencerLoginEnabled(id, dto.enabled);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() currentUser: CurrentUserPayload) {
    return this.influencersService.softDeleteInfluencer(id, currentUser.id);
  }

  @Get(':id/coupons')
  listCoupons(@Param('id') id: string) {
    return this.influencersService.listCouponCodes(id);
  }

  @Post(':id/coupons')
  createCoupon(@Param('id') id: string, @Body() dto: Partial<InfluencerCouponCode>) {
    return this.influencersService.createCouponCode(id, dto);
  }

  @Patch(':id/coupons/:cid')
  updateCoupon(@Param('cid') cid: string, @Body() dto: Partial<InfluencerCouponCode>) {
    return this.influencersService.updateCouponCode(cid, dto);
  }

  @Get(':id/commissions')
  listCommissions(@Param('id') id: string, @Query('page') page = '1', @Query('limit') limit = '20') {
    return this.influencersService.listCommissions(id, Number(page), Number(limit));
  }

  @Get(':id/wallet')
  getWallet(@Param('id') id: string) {
    return this.influencersService.getWallet(id);
  }

  @Get(':id/payouts')
  listPayouts(@Param('id') id: string) {
    return this.influencersService.listPayouts(id);
  }

  @Post(':id/payouts')
  settlePayout(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: { amount: number; paymentMethod: string; paymentReference?: string; paymentProofUrl?: string; paymentProofFileType?: string; adminNote?: string },
  ) {
    return this.influencersService.settlePayoutFull(currentUser.id, id, dto);
  }

  @Get(':id/commission-rules')
  listRules(@Param('id') id: string) {
    return this.influencersService.listCommissionRules(id);
  }

  @Put(':id/commission-rules')
  upsertRules(@Param('id') id: string, @Body() rules: Array<{ minSuccessfulOrders: number; commissionRate: number }>) {
    return this.influencersService.upsertCommissionRules(id, rules);
  }

  @Post(':id/payouts/upload-proof')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async uploadProof(@Param('id') id: string, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('File is required');
    return this.uploadService.uploadPaymentProof(id, file);
  }
}
