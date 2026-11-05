import * as crypto from 'crypto';

import { CreditPacksService } from './credit-packs.service';
import { PaymentRefundsService } from './payment-refunds.service';

/** A paid pack must be credited exactly once, whether the browser, the webhook, or both report it. */
function setup() {
  const credited: string[] = [];
  const user = { id: 'u1', credits: 3, characterSlotsTotal: 1, avatarRefreshTokens: 0 };
  const svc = Object.create(CreditPacksService.prototype) as CreditPacksService & Record<string, unknown>;
  Object.assign(svc, {
    logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
    _razorpay: { orders: { fetch: jest.fn(async () => ({ amount: 49900, notes: { userId: 'u1', packId: 'p1', subtotal: '499', discount: '0' } })) } },
    transactionsRepository: { findOne: jest.fn(async ({ where }: { where: { razorpayPaymentId: string } }) => (credited.includes(where.razorpayPaymentId) ? { userId: 'u1' } : null)) },
    usersRepository: { findOne: jest.fn(async () => user) },
    creditPacksRepository: { findOne: jest.fn(async () => ({ id: 'p1', name: 'Pack' })) },
    creditUser: jest.fn(async (_u: string, _p: unknown, _t: number, _o: string, paymentId: string) => {
      credited.push(paymentId);
      user.credits += 5;
      return { user, newBalance: user.credits, characterSlotsTotal: 1, avatarRefreshTokens: 0 };
    }),
    recordCreditOrder: jest.fn(async () => undefined),
  });
  return { svc, credited, user };
}

const sign = (orderId: string, paymentId: string) =>
  crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET ?? '').update(`${orderId}|${paymentId}`).digest('hex');

describe('payment.captured webhook', () => {
  it('credits a paid pack when the browser never came back', async () => {
    const { svc, credited, user } = setup();
    await expect(svc.creditFromWebhook('order_1', 'pay_1', 49900)).resolves.toEqual({ credited: true });
    expect(credited).toEqual(['pay_1']);
    expect(user.credits).toBe(8);
  });

  it('does nothing when the browser already credited it — and the browser succeeds if the webhook came first', async () => {
    const { svc, credited, user } = setup();
    await svc.creditFromWebhook('order_1', 'pay_1', 49900);
    await expect(svc.creditFromWebhook('order_1', 'pay_1', 49900)).resolves.toEqual({ credited: false });
    await expect(svc.verifyAndCredit('u1', 'p1', 'order_1', 'pay_1', sign('order_1', 'pay_1'))).resolves.toMatchObject({ newBalance: 8 });
    expect(credited).toEqual(['pay_1']);
    expect(user.credits).toBe(8);
  });

  it('never credits when the amount paid does not match the order', async () => {
    const { svc, credited } = setup();
    await expect(svc.creditFromWebhook('order_1', 'pay_1', 100)).resolves.toEqual({ credited: false });
    expect(credited).toEqual([]);
  });

  it('skips orders that are not credit-pack orders', async () => {
    const { svc, credited } = setup();
    (svc._razorpay as { orders: { fetch: jest.Mock } }).orders.fetch.mockResolvedValueOnce({ amount: 49900, notes: {} });
    await expect(svc.creditFromWebhook('order_x', 'pay_1', 49900)).resolves.toEqual({ credited: false });
    expect(credited).toEqual([]);
  });

  it('the signed webhook routes payment.captured to crediting', async () => {
    process.env.RAZORPAY_WEBHOOK_SECRET = 'whsec_test';
    const creditPacks = { creditFromWebhook: jest.fn(async () => ({ credited: true })) };
    const refunds = new PaymentRefundsService({} as never, {} as never, creditPacks as never);
    const body = Buffer.from(JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_9', order_id: 'order_9', amount: 49900 } } } }));
    const sig = crypto.createHmac('sha256', 'whsec_test').update(body).digest('hex');
    await expect(refunds.handleWebhook(body, sig)).resolves.toEqual({ ok: true });
    expect(creditPacks.creditFromWebhook).toHaveBeenCalledWith('order_9', 'pay_9', 49900);
    await expect(refunds.handleWebhook(body, 'bad')).rejects.toThrow('Invalid signature');
  });
});
