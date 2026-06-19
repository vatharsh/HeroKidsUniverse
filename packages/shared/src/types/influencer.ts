export type InfluencerTier = 'bronze' | 'silver' | 'gold';

export const COMMISSION_RATES: Record<InfluencerTier, number> = {
  bronze: 0.15,
  silver: 0.20,
  gold: 0.25,
};

export interface Influencer {
  id: string;
  userId: string;
  referralCode: string;
  tier: InfluencerTier;
  totalReferrals: number;
  totalEarningsInr: number;
  pendingPayoutInr: number;
  createdAt: Date;
}

export interface Referral {
  id: string;
  influencerId: string;
  referredUserId: string;
  orderId: string;
  commissionInr: number;
  paid: boolean;
  createdAt: Date;
}
