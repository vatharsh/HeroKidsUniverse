import { InfluencersService } from './influencers.service';

function service() {
  const svc = Object.create(InfluencersService.prototype) as InfluencersService;
  Object.assign(svc, {
    couponCodesRepo: {
      findOne: async () => ({
        id: 'c1', code: 'MOM10', isActive: true, couponType: 'influencer', influencerId: 'i1',
        discountType: 'percentage', discountValue: 10, usageLimit: null, usageCount: 0,
        minimumOrderAmount: null, maxDiscountAmount: null, perUserUsageLimit: null,
        expiresAt: null, startsAt: null, appliesToProductIds: null, appliesToCategoryIds: null,
      }),
    },
    influencersRepo: { findOne: async () => ({ id: 'i1', userId: 'influencer-user', status: 'active' }) },
    couponUsageRepo: { count: async () => 0 },
    dataSource: { getRepository: () => ({ findOne: async () => ({ value: 'true' }) }) },
  });
  return svc;
}

describe('influencer using their own coupon', () => {
  it('is refused for the influencer who owns the code', async () => {
    const result = await service().validateCoupon('MOM10', { userId: 'influencer-user' });
    expect(result.valid).toBe(false);
    expect(result.errorMessage).toMatch(/your own code/);
  });

  it('still works for parents', async () => {
    const result = await service().validateCoupon('MOM10', { userId: 'parent-user' });
    expect(result.valid).toBe(true);
  });
});
