import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { CreditPacksService } from '../credits/credit-packs.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { OrderV2Service } from '../merchandise/orders/order-v2.service';
import { AdminService } from './admin.service';

@Controller('admin')
@Roles('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly orderV2Service: OrderV2Service,
    private readonly creditPacksService: CreditPacksService,
  ) {}

  @Get('dashboard')
  dashboard() {
    return this.adminService.getDashboard();
  }

  @Get('users')
  users(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('search') search?: string,
  ) {
    return this.adminService.listUsers(Number(page), Number(limit), search);
  }

  @Get('users/:id')
  user(@Param('id') id: string) {
    return this.adminService.getUserDetail(id);
  }

  @Patch('users/:id')
  updateUser(@Param('id') id: string, @Body() body: any) {
    return this.adminService.updateUser(id, body);
  }

  @Get('universes')
  universes(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('search') search?: string,
  ) {
    return this.adminService.listUniverses(Number(page), Number(limit), search);
  }

  @Get('stories')
  stories(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('userId') userId?: string,
    @Query('universeId') universeId?: string,
    @Query('status') status?: string,
    @Query('theme') theme?: string,
  ) {
    return this.adminService.listStories(Number(page), Number(limit), { userId, universeId, status, theme });
  }

  @Get('stories/:id')
  story(@Param('id') id: string) {
    return this.adminService.getStoryDetail(id);
  }

  @Delete('stories/:id')
  deleteStory(@Param('id') id: string) {
    return this.adminService.deleteStory(id);
  }

  @Get('generation-jobs')
  jobs(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.adminService.listJobs(Number(page), Number(limit), status, search);
  }

  @Post('generation-jobs/:id/retry')
  retryJob(@Param('id') id: string) {
    return this.adminService.retryJob(id);
  }

  @Delete('generation-jobs/:id')
  deleteJob(@Param('id') id: string) {
    return this.adminService.deleteJob(id);
  }

  @Get('orders')
  orders(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('status') status?: string,
    @Query('userId') userId?: string,
    @Query('includeDeleted') includeDeleted?: string,
  ) {
    return this.orderV2Service.adminListOrders({
      page: Number(page),
      limit: Number(limit),
      status,
      userId,
      includeDeleted: includeDeleted === 'true',
    });
  }

  @Get('orders/:id')
  order(@Param('id') id: string, @Query('includeDeleted') includeDeleted?: string) {
    return this.orderV2Service.adminGetOrder(id, includeDeleted === 'true');
  }

  @Patch('orders/:id/status')
  updateOrder(@Param('id') id: string, @CurrentUser() currentUser: CurrentUserPayload, @Body() body: any) {
    return this.orderV2Service.adminUpdateStatus(id, body.status, body.note, currentUser.id);
  }

  @Get('orders/:id/payment')
  orderPayment(@Param('id') id: string, @Query('includeDeleted') includeDeleted?: string) {
    return this.orderV2Service.getPaymentView(id, includeDeleted === 'true');
  }

  @Get('payments')
  payments(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.adminService.listPayments(Number(page), Number(limit), status, search);
  }

  @Get('ai-analytics')
  aiAnalytics() {
    return this.adminService.getAiAnalytics();
  }

  @Post('backfill-ai-costs')
  backfillAiCosts() {
    return this.adminService.backfillAiCosts();
  }

  @Get('influencers')
  influencers(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('search') search?: string,
  ) {
    return this.adminService.listInfluencers(Number(page), Number(limit), search);
  }

  @Post('influencers')
  createInfluencer(@Body() body: any) {
    return this.adminService.createInfluencer(body);
  }

  @Patch('influencers/:id')
  updateInfluencer(@Param('id') id: string, @Body() body: any) {
    return this.adminService.updateInfluencer(id, body);
  }

  @Get('coupons')
  listAllCoupons(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('couponType') couponType?: string,
    @Query('isActive') isActive?: string,
    @Query('search') search?: string,
  ) {
    return this.adminService.listAllCoupons({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 50,
      couponType,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      search,
    });
  }

  @Post('coupons/platform')
  createPlatformCoupon(@Body() body: any) {
    return this.adminService.createPlatformCoupon(body);
  }

  @Patch('coupons/:id')
  updateCoupon(@Param('id') id: string, @Body() body: any) {
    return this.adminService.updateCoupon(id, body);
  }

  @Get('merchandise-analytics')
  merchandiseAnalytics() {
    return this.adminService.getMerchandiseAnalytics();
  }

  @Get('health')
  health() {
    return this.adminService.getHealth();
  }

  @Get('settings')
  getSettings() {
    return this.adminService.getSettings();
  }

  @Patch('settings/:key')
  upsertSetting(@Param('key') key: string, @Body('value') value: unknown) {
    return this.adminService.upsertSetting(key, value);
  }

  @Get('credit-packs')
  listCreditPacks() {
    return this.creditPacksService.listAllPacks();
  }

  @Post('credit-packs')
  createCreditPack(@Body() body: any) {
    return this.creditPacksService.createPack(body);
  }

  @Patch('credit-packs/:id')
  updateCreditPack(@Param('id') id: string, @Body() body: any) {
    return this.creditPacksService.updatePack(id, body);
  }

  @Delete('credit-packs/:id')
  deleteCreditPack(@Param('id') id: string, @CurrentUser() currentUser: CurrentUserPayload) {
    return this.creditPacksService.deletePack(id, currentUser.id);
  }
}
