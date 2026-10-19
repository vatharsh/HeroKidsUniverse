import { Body, Controller, ForbiddenException, Get, Param, Post, Query } from '@nestjs/common';

import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { CreditPacksService } from './credit-packs.service';
import { CreditsService } from './credits.service';

@Controller('credits')
export class CreditsController {
  constructor(
    private readonly creditsService: CreditsService,
    private readonly creditPacksService: CreditPacksService,
  ) {}

  @Public()
  @Get('packs')
  getPacks() {
    return this.creditPacksService.listActivePacks();
  }

  @Get()
  getCredits(@CurrentUser() currentUser: CurrentUserPayload) {
    return this.creditsService.getCredits(currentUser.id);
  }

  @Get('transactions')
  getTransactions(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.creditsService.getTransactions(currentUser.id, Number(page), Number(limit));
  }

  @Post('demo')
  claimDemoCredit(@CurrentUser() currentUser: CurrentUserPayload) {
    assertTestPurchaseAllowed(currentUser);
    return this.creditsService.claimDemoCredit(currentUser.id);
  }

  @Post('packs/quote')
  quoteCoupon(@CurrentUser() currentUser: CurrentUserPayload, @Body('couponCode') couponCode: string) {
    return this.creditPacksService.quoteCoupon(currentUser.id, couponCode ?? '');
  }

  @Post('packs/:id/purchase/initiate')
  initiatePurchase(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Param('id') id: string,
    @Body('couponCode') couponCode?: string,
  ) {
    return this.creditPacksService.initiatePurchase(currentUser.id, id, couponCode);
  }

  @Post('packs/:id/purchase/mock')
  mockPurchase(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Param('id') id: string,
    @Body('paymentMethod') paymentMethod?: string,
    @Body('couponCode') couponCode?: string,
  ) {
    assertTestPurchaseAllowed(currentUser);
    return this.creditPacksService.mockPurchase(currentUser.id, id, paymentMethod, couponCode);
  }

  @Post('packs/:id/purchase/verify')
  verifyPurchase(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Param('id') id: string,
    @Body() body: { razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string },
  ) {
    return this.creditPacksService.verifyAndCredit(
      currentUser.id,
      id,
      body.razorpayOrderId,
      body.razorpayPaymentId,
      body.razorpaySignature,
    );
  }
}

/** Free-credit test endpoints (mock purchase, demo credit) — never open to customers in production. */
function assertTestPurchaseAllowed(user: CurrentUserPayload) {
  if (process.env.NODE_ENV === 'production' && user.role !== 'admin') {
    throw new ForbiddenException('Not available');
  }
}
