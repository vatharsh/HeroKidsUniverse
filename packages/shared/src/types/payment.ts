export type CreditPack = 'single' | 'family' | 'birthday';

export const CREDIT_PACKS: Record<CreditPack, { credits: number; priceInr: number; label: string }> = {
  single: { credits: 1, priceInr: 149, label: 'Single Story' },
  family: { credits: 5, priceInr: 499, label: 'Family Pack' },
  birthday: { credits: 10, priceInr: 999, label: 'Birthday Pack' },
};

export interface Order {
  id: string;
  userId: string;
  razorpayOrderId: string;
  pack: CreditPack;
  credits: number;
  amountInr: number;
  status: 'created' | 'paid' | 'failed';
  createdAt: Date;
}

export interface CreateOrderDto {
  pack: CreditPack;
}
