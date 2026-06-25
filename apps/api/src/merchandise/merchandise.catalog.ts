import { FulfillmentType, ProductType } from './order.entity';

export interface MerchandiseProductCatalogItem {
  id: string;
  name: string;
  description: string;
  unitPriceInr: number;
  productType: ProductType;
  fulfillmentType: FulfillmentType;
  active: boolean;
  badge: string;
  previewImageUrl: string;
  templateIds: string[];
}

export interface MerchandiseTemplateCatalogItem {
  id: string;
  productId: string;
  name: string;
  description: string;
  layout: 'single' | 'split' | 'collage';
  supportsHero: boolean;
  supportsStory: boolean;
  supportsUniverse: boolean;
  supportsQuantity: boolean;
  defaultThemeColor: string;
}

export const MERCHANDISE_PRODUCTS: MerchandiseProductCatalogItem[] = [
  {
    id: 'hero_poster_pdf',
    name: 'Hero Poster PDF',
    description: 'A polished printable poster starring the hero avatar and story title.',
    unitPriceInr: 199,
    productType: ProductType.Poster,
    fulfillmentType: FulfillmentType.Digital,
    active: true,
    badge: 'Digital',
    previewImageUrl: '/merchandise/hero-poster.png',
    templateIds: ['hero-poster-classic'],
  },
  {
    id: 'hero_certificate_pdf',
    name: 'Hero Certificate PDF',
    description: 'A keepsake certificate with the child’s name, title, and universe seal.',
    unitPriceInr: 149,
    productType: ProductType.Certificate,
    fulfillmentType: FulfillmentType.Digital,
    active: true,
    badge: 'Digital',
    previewImageUrl: '/merchandise/hero-certificate.png',
    templateIds: ['hero-certificate-classic'],
  },
  {
    id: 'sticker_sheet_pdf',
    name: 'Sticker Sheet PDF',
    description: 'A fun printable sheet with the hero avatar, badges, and power icons.',
    unitPriceInr: 179,
    productType: ProductType.StickerSheet,
    fulfillmentType: FulfillmentType.Digital,
    active: true,
    badge: 'Digital',
    previewImageUrl: '/merchandise/sticker-sheet.png',
    templateIds: ['sticker-sheet-collage'],
  },
  {
    id: 'printed_hero_poster',
    name: 'Printed Hero Poster',
    description: 'A premium physical poster ready for print and shipping.',
    unitPriceInr: 499,
    productType: ProductType.Poster,
    fulfillmentType: FulfillmentType.Physical,
    active: true,
    badge: 'Physical',
    previewImageUrl: '/merchandise/printed-poster.png',
    templateIds: ['printed-poster-pro'],
  },
  {
    id: 'printed_story_cover_poster',
    name: 'Printed Story Cover Poster',
    description: 'A large-format poster featuring the story cover and title art.',
    unitPriceInr: 549,
    productType: ProductType.Book,
    fulfillmentType: FulfillmentType.Physical,
    active: true,
    badge: 'Physical',
    previewImageUrl: '/merchandise/story-cover-poster.png',
    templateIds: ['story-cover-poster'],
  },
];

export const MERCHANDISE_TEMPLATES: MerchandiseTemplateCatalogItem[] = [
  {
    id: 'hero-poster-classic',
    productId: 'hero_poster_pdf',
    name: 'Classic Hero Poster',
    description: 'Bold portrait composition with the hero centered in a spotlight.',
    layout: 'single',
    supportsHero: true,
    supportsStory: true,
    supportsUniverse: true,
    supportsQuantity: false,
    defaultThemeColor: '#6d28d9',
  },
  {
    id: 'hero-certificate-classic',
    productId: 'hero_certificate_pdf',
    name: 'Hero Certificate',
    description: 'Formal certificate layout with clean borders and celebration flourishes.',
    layout: 'single',
    supportsHero: true,
    supportsStory: true,
    supportsUniverse: true,
    supportsQuantity: false,
    defaultThemeColor: '#1d4ed8',
  },
  {
    id: 'sticker-sheet-collage',
    productId: 'sticker_sheet_pdf',
    name: 'Sticker Collage',
    description: 'Multiple rounded frames for the hero avatar, powers, and badges.',
    layout: 'collage',
    supportsHero: true,
    supportsStory: false,
    supportsUniverse: true,
    supportsQuantity: false,
    defaultThemeColor: '#db2777',
  },
  {
    id: 'printed-poster-pro',
    productId: 'printed_hero_poster',
    name: 'Printed Poster',
    description: 'High-contrast print layout with stronger footer and trim-safe spacing.',
    layout: 'single',
    supportsHero: true,
    supportsStory: true,
    supportsUniverse: true,
    supportsQuantity: true,
    defaultThemeColor: '#7c3aed',
  },
  {
    id: 'story-cover-poster',
    productId: 'printed_story_cover_poster',
    name: 'Story Cover Poster',
    description: 'Heroic cover treatment built around the selected story cover image.',
    layout: 'split',
    supportsHero: true,
    supportsStory: true,
    supportsUniverse: true,
    supportsQuantity: true,
    defaultThemeColor: '#be185d',
  },
];

export function getMerchandiseProduct(productId: string) {
  return MERCHANDISE_PRODUCTS.find((product) => product.id === productId) ?? null;
}

export function getMerchandiseTemplate(templateId: string) {
  return MERCHANDISE_TEMPLATES.find((template) => template.id === templateId) ?? null;
}

export function getTemplatesForProduct(productId: string) {
  return MERCHANDISE_TEMPLATES.filter((template) => template.productId === productId);
}
