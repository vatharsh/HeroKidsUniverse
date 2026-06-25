import { CreditPacksService } from './credit-packs.service';
import { CreditPackType, PromotionType } from './credit-pack.entity';

const DEFAULT_PACKS = [
  {
    name: 'Starter',
    slug: 'starter',
    description: 'Perfect for trying out HeroKids Universe',
    basePrice: 149,
    salePrice: null,
    packType: CreditPackType.StoryCredits,
    credits: 1,
    bonusCredits: 0,
    badge: null,
    isFeatured: false,
    isMostPopular: false,
    isBestValue: false,
    sortOrder: 1,
    isActive: true,
  },
  {
    name: 'Family Pack',
    slug: 'family-pack',
    description: '5 stories — enough for weeks of adventures',
    basePrice: 699,
    salePrice: 499,
    packType: CreditPackType.StoryCredits,
    credits: 5,
    bonusCredits: 1,
    promotionName: 'Launch Offer',
    promotionType: PromotionType.FlatAmount,
    promotionValue: 200,
    badge: '⭐ Most Popular',
    isFeatured: true,
    isMostPopular: true,
    isBestValue: false,
    sortOrder: 2,
    isActive: true,
  },
  {
    name: 'Birthday Pack',
    slug: 'birthday-pack',
    description: '10 stories — the ultimate gift for young heroes',
    basePrice: 1499,
    salePrice: 999,
    packType: CreditPackType.StoryCredits,
    credits: 10,
    bonusCredits: 3,
    promotionName: 'Best Value',
    promotionType: PromotionType.FlatAmount,
    promotionValue: 500,
    badge: '💎 Best Value',
    isFeatured: false,
    isMostPopular: false,
    isBestValue: true,
    sortOrder: 3,
    isActive: true,
  },
  {
    name: 'Character Slot Pack',
    slug: 'character-slot-pack',
    description: 'Add 3 more heroes, family members, or friends to your universe',
    basePrice: 199,
    salePrice: null,
    packType: CreditPackType.CharacterSlots,
    credits: 0,
    bonusCredits: 0,
    characterSlots: 3,
    avatarRefreshTokens: 0,
    badge: null,
    isFeatured: false,
    isMostPopular: false,
    isBestValue: false,
    sortOrder: 4,
    isActive: true,
  },
  {
    name: 'Avatar Refresh Pack',
    slug: 'avatar-refresh-pack',
    description: 'Try 5 fresh avatar looks for your cast',
    basePrice: 149,
    salePrice: null,
    packType: CreditPackType.AvatarRefreshes,
    credits: 0,
    bonusCredits: 0,
    characterSlots: 0,
    avatarRefreshTokens: 5,
    badge: null,
    isFeatured: false,
    isMostPopular: false,
    isBestValue: false,
    sortOrder: 5,
    isActive: true,
  },
];

export async function seedDefaultPacks(creditPacksService: CreditPacksService) {
  const existing = await creditPacksService.listAllPacks();
  const existingSlugs = new Set(existing.map((pack) => pack.slug));

  for (const pack of DEFAULT_PACKS) {
    if (!existingSlugs.has(pack.slug)) {
      await creditPacksService.createPack(pack);
    }
  }
}
