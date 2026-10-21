import { InfluencersService } from './influencers.service';

type Rule = { minSuccessfulOrders: number; commissionRate: number };

const GLOBAL: Rule[] = [
  { minSuccessfulOrders: 250, commissionRate: 15 },
  { minSuccessfulOrders: 100, commissionRate: 12 },
  { minSuccessfulOrders: 0, commissionRate: 10 },
];

function service(opts: { commissionPct: number; orders: number; overrides?: Rule[]; global?: Rule[]; maxSetting?: string; influencerMax?: number | null }) {
  const svc = Object.create(InfluencersService.prototype) as InfluencersService;
  Object.assign(svc, {
    influencersRepo: { findOne: async () => ({ id: 'i1', commissionPct: opts.commissionPct, maxCommissionRate: opts.influencerMax ?? null }) },
    commissionsRepo: { count: async () => opts.orders },
    commissionRulesRepo: {
      find: async ({ where }: { where: { influencerId: unknown } }) =>
        typeof where.influencerId === 'string' ? opts.overrides ?? [] : opts.global ?? GLOBAL,
    },
    dataSource: { getRepository: () => ({ findOne: async () => (opts.maxSetting ? { value: opts.maxSetting } : null) }) },
  });
  return svc;
}

describe('calculateCommissionRate', () => {
  it('uses the influencer default as the starting rate', async () => {
    expect(await service({ commissionPct: 12, orders: 0 }).calculateCommissionRate('i1')).toBe(12);
  });

  it('lets tiers raise the rate above the default', async () => {
    expect(await service({ commissionPct: 10, orders: 120 }).calculateCommissionRate('i1')).toBe(12);
    expect(await service({ commissionPct: 11, orders: 300 }).calculateCommissionRate('i1')).toBe(15);
  });

  it('never goes above the platform limit, even with overrides or a high default', async () => {
    expect(await service({ commissionPct: 25, orders: 0 }).calculateCommissionRate('i1')).toBe(15);
    expect(await service({ commissionPct: 10, orders: 600, overrides: [{ minSuccessfulOrders: 0, commissionRate: 30 }] }).calculateCommissionRate('i1')).toBe(15);
    expect(await service({ commissionPct: 10, orders: 0, overrides: [{ minSuccessfulOrders: 0, commissionRate: 18 }], maxSetting: '20' }).calculateCommissionRate('i1')).toBe(18);
  });

  it('falls back to 15%-capped tiers if all global tiers are deleted', async () => {
    expect(await service({ commissionPct: 0, orders: 600, global: [] }).calculateCommissionRate('i1')).toBe(15);
  });

  it('respects a lower per-influencer max', async () => {
    expect(await service({ commissionPct: 10, orders: 300, influencerMax: 11 }).calculateCommissionRate('i1')).toBe(11);
  });
});
