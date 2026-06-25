import { Body, Controller, Get, Param, Post } from '@nestjs/common';

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

  @Post('demo')
  claimDemoCredit(@CurrentUser() currentUser: CurrentUserPayload) {
    return this.creditsService.claimDemoCredit(currentUser.id);
  }

  @Post('packs/:id/purchase/initiate')
  initiatePurchase(@CurrentUser() currentUser: CurrentUserPayload, @Param('id') id: string) {
    return this.creditPacksService.initiatePurchase(currentUser.id, id);
  }

  @Post('packs/:id/purchase/mock')
  mockPurchase(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Param('id') id: string,
    @Body('paymentMethod') paymentMethod?: string,
  ) {
    return this.creditPacksService.mockPurchase(currentUser.id, id, paymentMethod);
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
