import { Body, Controller, Get, Headers, HttpCode, Param, Post, Req } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { PaymentRefundsService } from './payment-refunds.service';

@Controller('admin/orders')
@Roles('admin')
export class AdminPaymentRefundsController {
  constructor(private readonly refunds: PaymentRefundsService) {}

  @Get(':id/refund-preview')
  preview(@Param('id') id: string) {
    return this.refunds.preview(id);
  }

  @Post(':id/refund')
  refund(@Param('id') id: string, @Body() body: { amount: number; note?: string }, @CurrentUser() admin: CurrentUserPayload) {
    return this.refunds.refund(id, Number(body.amount), admin.id, body.note?.slice(0, 200));
  }
}

/** Razorpay calls this for refunds made in the Razorpay dashboard (see RAZORPAY_WEBHOOK_SECRET). */
@Controller('payments/razorpay')
export class RazorpayWebhookController {
  constructor(private readonly refunds: PaymentRefundsService) {}

  @Public()
  @Post('webhook')
  @HttpCode(200)
  webhook(@Req() req: RawBodyRequest<Request>, @Headers('x-razorpay-signature') signature?: string) {
    return this.refunds.handleWebhook(req.rawBody, signature);
  }
}
