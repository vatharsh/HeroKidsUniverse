import type { CreditPack } from './credit-pack.entity';
import { CreditPacksService } from './credit-packs.service';

const service = Object.create(CreditPacksService.prototype) as CreditPacksService;
const day = 86_400_000;
const pack = (over: Partial<CreditPack>) =>
  ({ basePrice: 699, salePrice: 499, promotionStart: null, promotionEnd: null, afterPromotionPrice: 599, ...over }) as CreditPack;

describe('launch offer pricing', () => {
  it('uses the launch price while the offer runs (no end date yet = until launch + N days)', () => {
    expect(service.computeEffectivePrice(pack({}))).toMatchObject({ effectivePrice: 499, isOnSale: true, promotionActive: true, savingsAmount: 200 });
  });

  it('switches to the after-offer price once the offer has ended, still shown against the base price', () => {
    const p = service.computeEffectivePrice(pack({ promotionEnd: new Date(Date.now() - day) }));
    expect(p).toMatchObject({ effectivePrice: 599, isOnSale: true, promotionActive: false, savingsAmount: 100 });
  });

  it('falls back to the base price when no after-offer price is set', () => {
    const p = service.computeEffectivePrice(pack({ promotionEnd: new Date(Date.now() - day), afterPromotionPrice: null }));
    expect(p).toMatchObject({ effectivePrice: 699, isOnSale: false, promotionActive: false });
  });

  it('keeps the launch price until the end date', () => {
    expect(service.computeEffectivePrice(pack({ promotionEnd: new Date(Date.now() + day) })).effectivePrice).toBe(499);
  });
});
