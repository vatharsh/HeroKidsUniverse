import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';

import { PlatformSetting } from '../admin/platform-setting.entity';
import { Character } from '../characters/entities/character.entity';
import { Hero } from '../heroes/hero.entity';
import { Story } from '../stories/story.entity';
import { Universe } from '../universes/universe.entity';
import { User } from '../users/user.entity';
import { CreateDesignDto } from './dto/create-design.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import {
  getMerchandiseProduct,
  getTemplatesForProduct,
  MERCHANDISE_PRODUCTS,
  type MerchandiseProductCatalogItem,
} from './merchandise.catalog';
import { MerchandiseDesign } from './merchandise-design.entity';
import {
  FulfillmentType,
  MerchandiseOrder,
  OrderStatus,
  PaymentMethod,
  PaymentProvider,
  PaymentStatus,
  ProductType,
} from './order.entity';
import { OrderStatusHistory } from './order-status-history.entity';

type OwnedAssetContext = {
  universe: Universe | null;
  hero: Hero | null;
  character: Character | null;
  story: Story | null;
};

type EmbeddedPreviewImage = {
  sourceUrl: string;
  dataUrl: string;
  embedded: boolean;
  error: string | null;
};

@Injectable()
export class MerchandiseService {
  constructor(
    @InjectRepository(MerchandiseDesign)
    private readonly designsRepository: Repository<MerchandiseDesign>,
    @InjectRepository(MerchandiseOrder)
    private readonly ordersRepository: Repository<MerchandiseOrder>,
    @InjectRepository(OrderStatusHistory)
    private readonly historyRepository: Repository<OrderStatusHistory>,
    @InjectRepository(PlatformSetting)
    private readonly settingsRepository: Repository<PlatformSetting>,
    @InjectRepository(Hero)
    private readonly heroesRepository: Repository<Hero>,
    @InjectRepository(Character)
    private readonly charactersRepository: Repository<Character>,
    @InjectRepository(Story)
    private readonly storiesRepository: Repository<Story>,
    @InjectRepository(Universe)
    private readonly universesRepository: Repository<Universe>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly configService: ConfigService,
  ) {}

  async findProducts() {
    await this.ensureMerchandiseEnabled();
    const physicalEnabled = await this.isPhysicalOrdersEnabled();

    return MERCHANDISE_PRODUCTS.filter((product) => physicalEnabled || product.fulfillmentType === FulfillmentType.Digital);
  }

  async findTemplates(productId?: string) {
    await this.ensureMerchandiseEnabled();
    if (!productId) {
      return [];
    }
    const product = this.requireProduct(productId);
    const physicalEnabled = await this.isPhysicalOrdersEnabled();
    if (product.fulfillmentType === FulfillmentType.Physical && !physicalEnabled) {
      return [];
    }
    return getTemplatesForProduct(productId);
  }

  async createDesign(userId: string, dto: CreateDesignDto) {
    await this.ensureMerchandiseEnabled();
    const product = this.requireProduct(dto.productId);
    if (product.fulfillmentType === FulfillmentType.Physical && !(await this.isPhysicalOrdersEnabled())) {
      throw new ForbiddenException('Physical merchandise is currently disabled');
    }
    if (!dto.heroId && !dto.storyId && !dto.characterId) {
      throw new BadRequestException('Select at least a hero, character, or story for the design');
    }

    const context = await this.loadOwnedAssets(userId, dto.universeId, dto.storyId, dto.heroId, dto.characterId);
    const design = this.designsRepository.create({
      userId,
      productId: product.id,
      productName: product.name,
      fulfillmentType: product.fulfillmentType,
      universeId: context.universe?.id ?? null,
      storyId: context.story?.id ?? dto.storyId ?? null,
      heroId: context.hero?.id ?? dto.heroId ?? null,
      displayName: dto.displayName?.trim() || null,
      titleText: dto.titleText?.trim() || null,
      subtitle: dto.subtitle?.trim() || null,
      message: dto.message?.trim() || null,
      themeColor: dto.themeColor?.trim() || null,
      quantity: dto.quantity ?? 1,
      data: {
        productId: product.id,
        productName: product.name,
        productType: product.productType,
        fulfillmentType: product.fulfillmentType,
        displayName: dto.displayName?.trim() || null,
        titleText: dto.titleText?.trim() || null,
        subtitle: dto.subtitle?.trim() || null,
        message: dto.message?.trim() || null,
        themeColor: dto.themeColor?.trim() || null,
        quantity: dto.quantity ?? 1,
        universe: context.universe
          ? { id: context.universe.id, name: context.universe.name, heroTitle: context.universe.heroTitle, tagline: context.universe.tagline }
          : null,
        hero: context.hero
          ? { id: context.hero.id, name: context.hero.name, avatarUrl: context.hero.avatarUrl, dob: context.hero.dob, gender: context.hero.gender }
          : null,
        character: context.character
          ? { id: context.character.id, name: context.character.name, avatarUrl: context.character.avatarUrl, role: context.character.role }
          : null,
        story: context.story
          ? { id: context.story.id, title: context.story.title, coverImageUrl: context.story.coverImageUrl, theme: context.story.theme }
          : null,
      },
      previewUrl: null,
    });

    return this.serializeDesign(await this.designsRepository.save(design), context);
  }

  async generatePreview(userId: string, designId: string) {
    await this.ensureMerchandiseEnabled();
    const design = await this.getOwnedDesign(userId, designId);
    const product = this.requireProduct(design.productId);
    const context = await this.getDesignContext(design);
    const preview = await this.buildPreviewDataUrl(product, design, context);

    design.previewUrl = preview.previewUrl;
    design.data = {
      ...(design.data ?? {}),
      previewGeneratedAt: new Date().toISOString(),
      previewProduct: product.name,
      previewSourceImageUrl: preview.sourceImage.sourceUrl || null,
      previewSourceImageEmbedded: preview.sourceImage.embedded,
      previewSourceImageError: preview.sourceImage.error,
      previewAvatarImageUrl: preview.avatarImage.sourceUrl || null,
      previewAvatarImageEmbedded: preview.avatarImage.embedded,
      previewAvatarImageError: preview.avatarImage.error,
    };
    const saved = await this.designsRepository.save(design);
    return this.serializeDesign(saved, context);
  }

  async findMine(userId: string) {
    await this.ensureMerchandiseEnabled();
    const [orders, designs] = await Promise.all([
      this.ordersRepository.find({ where: { userId, isDeleted: false }, order: { createdAt: 'DESC' } }),
      this.designsRepository.find({ where: { userId, isDeleted: false } }),
    ]);
    const designMap = new Map(designs.map((design) => [design.id, design]));

    return orders.map((order) => this.serializeOrderSummary(order, designMap.get(order.designId ?? '') ?? null));
  }

  async findOne(userId: string, id: string) {
    await this.ensureMerchandiseEnabled();
    const order = await this.ordersRepository.findOne({ where: { id, userId, isDeleted: false } });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const [design, history, user] = await Promise.all([
      order.designId ? this.designsRepository.findOne({ where: { id: order.designId, userId, isDeleted: false } }) : Promise.resolve(null),
      this.historyRepository.find({ where: { orderId: order.id, isDeleted: false }, order: { createdAt: 'ASC' } }),
      this.usersRepository.findOne({ where: { id: order.userId } }),
    ]);

    return {
      ...this.serializeOrderDetail(order, design),
      userEmail: user?.email ?? null,
      history,
    };
  }

  async createOrder(userId: string, dto: CreateOrderDto) {
    await this.ensureMerchandiseEnabled();
    const { order, design } = await this.createOrderRecord(userId, dto, this.ordersRepository.manager);
    return this.serializeOrderDetail(order, design);
  }

  async createCartOrder(userId: string, items: CreateOrderDto[]) {
    await this.ensureMerchandiseEnabled();
    const saved = await this.ordersRepository.manager.transaction(async (manager) => {
      const orders: Array<{ order: MerchandiseOrder; design: MerchandiseDesign }> = [];
      for (const item of items) {
        orders.push(await this.createOrderRecord(userId, item, manager, `Cart checkout item ${orders.length + 1}`));
      }
      return orders;
    });

    return {
      orders: saved.map(({ order, design }) => this.serializeOrderDetail(order, design)),
      totalAmountInr: saved.reduce((sum, { order }) => sum + Number(order.amountInr), 0),
    };
  }

  private async createOrderRecord(
    userId: string,
    dto: CreateOrderDto,
    manager: EntityManager,
    note = 'Order created from user checkout',
  ) {
    const design = await manager.findOne(MerchandiseDesign, { where: { id: dto.designId, userId, isDeleted: false } });
    if (!design) {
      throw new NotFoundException('Design not found');
    }

    const product = this.requireProduct(dto.productId);
    if (design.productId !== product.id) {
      throw new BadRequestException('Design and product do not match');
    }
    if (product.fulfillmentType === FulfillmentType.Physical && !(await this.isPhysicalOrdersEnabled())) {
      throw new ForbiddenException('Physical merchandise is currently disabled');
    }
    if (dto.quantity < 1) {
      throw new BadRequestException('Quantity must be at least 1');
    }

    const isPhysical = product.fulfillmentType === FulfillmentType.Physical;
    const shippingAddress = dto.shippingAddress?.trim() || null;
    const shippingCity = dto.shippingCity?.trim() || null;
    const shippingPincode = dto.shippingPincode?.trim() || null;
    const shippingPhone = dto.customerPhone?.trim() || null;
    const shippingCountry = dto.shippingCountry?.trim() || 'India';

    if (isPhysical) {
      if (!shippingAddress || !shippingCity || !shippingPincode || !dto.customerName?.trim() || !shippingPhone) {
        throw new BadRequestException('Physical products require full shipping details');
      }
    }

    const amountInr = product.unitPriceInr * dto.quantity;
    const paymentMethod = dto.paymentMethod ?? PaymentMethod.Cash;
    const status = isPhysical ? OrderStatus.PrintFileGenerated : OrderStatus.DigitalReady;
    const order = manager.create(MerchandiseOrder, {
      userId,
      designId: design.id,
      productId: product.id,
      storyId: design.storyId,
      universeId: design.universeId,
      heroId: design.heroId,
      productType: product.productType,
      fulfillmentType: product.fulfillmentType,
      productName: product.name,
      quantity: dto.quantity,
      amountInr,
      status,
      paymentProvider: PaymentProvider.Manual,
      paymentMethod,
      paymentStatus: PaymentStatus.MockPaid,
      customerName: dto.customerName?.trim() || null,
      customerEmail: dto.customerEmail?.trim() || null,
      customerPhone: dto.customerPhone?.trim() || null,
      shippingName: dto.shippingName?.trim() || dto.customerName?.trim() || null,
      shippingAddress,
      shippingAddressLine2: dto.shippingAddressLine2?.trim() || null,
      shippingCity,
      shippingState: dto.shippingState?.trim() || null,
      shippingPincode,
      shippingCountry,
      shippingPhone,
      trackingNumber: null,
      trackingUrl: null,
      printFileUrl: isPhysical ? design.previewUrl ?? null : null,
      downloadUrl: isPhysical ? null : design.previewUrl ?? null,
      razorpayOrderId: null,
      razorpayPaymentId: null,
      adminNotes: null,
    });

    const saved = await manager.save(MerchandiseOrder, order);
    await manager.save(
      OrderStatusHistory,
      manager.create(OrderStatusHistory, {
        orderId: saved.id,
        oldStatus: null,
        newStatus: status,
        note,
        changedByUserId: userId,
      }),
    );

    return { order: saved, design };
  }

  async getOwnedDesign(userId: string, designId: string) {
    const design = await this.designsRepository.findOne({ where: { id: designId, userId, isDeleted: false } });
    if (!design) {
      throw new NotFoundException('Design not found');
    }
    return design;
  }

  private serializeOrderSummary(order: MerchandiseOrder, design: MerchandiseDesign | null) {
    return {
      id: order.id,
      designId: order.designId,
      productId: order.productId,
      productType: order.productType,
      fulfillmentType: order.fulfillmentType,
      productName: order.productName,
      amountInr: Number(order.amountInr),
      quantity: order.quantity,
      status: order.status,
      paymentMethod: order.paymentMethod,
      paymentProvider: order.paymentProvider,
      paymentStatus: order.paymentStatus,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      customerPhone: order.customerPhone,
      trackingNumber: order.trackingNumber,
      trackingUrl: order.trackingUrl,
      downloadUrl: order.downloadUrl,
      printFileUrl: order.printFileUrl,
      previewUrl: design?.previewUrl ?? null,
      design: design ? this.serializeDesign(design) : null,
      createdAt: order.createdAt,
    };
  }

  private serializeOrderDetail(order: MerchandiseOrder, design: MerchandiseDesign | null) {
    return {
      ...this.serializeOrderSummary(order, design),
      shippingName: order.shippingName,
      shippingAddress: order.shippingAddress,
      shippingAddressLine2: order.shippingAddressLine2,
      shippingCity: order.shippingCity,
      shippingState: order.shippingState,
      shippingPincode: order.shippingPincode,
      shippingCountry: order.shippingCountry,
      shippingPhone: order.shippingPhone,
      adminNotes: order.adminNotes,
      updatedAt: order.updatedAt,
    };
  }

  private async getDesignContext(design: MerchandiseDesign): Promise<OwnedAssetContext> {
    const characterId = typeof design.data?.character === 'object' && design.data.character && 'id' in design.data.character
      ? String((design.data.character as { id?: unknown }).id ?? '')
      : '';
    const [universe, hero, character, story] = await Promise.all([
      design.universeId ? this.universesRepository.findOne({ where: { id: design.universeId } }) : Promise.resolve(null),
      design.heroId ? this.heroesRepository.findOne({ where: { id: design.heroId } }) : Promise.resolve(null),
      characterId ? this.charactersRepository.findOne({ where: { id: characterId } }) : Promise.resolve(null),
      design.storyId ? this.storiesRepository.findOne({ where: { id: design.storyId } }) : Promise.resolve(null),
    ]);
    return { universe, hero, character, story };
  }

  private async loadOwnedAssets(userId: string, universeId?: string, storyId?: string, heroId?: string, characterId?: string): Promise<OwnedAssetContext> {
    const [hero, character, story] = await Promise.all([
      heroId ? this.heroesRepository.findOne({ where: { id: heroId, userId } }) : Promise.resolve(null),
      characterId ? this.charactersRepository.findOne({ where: { id: characterId, userId } }) : Promise.resolve(null),
      storyId ? this.storiesRepository.findOne({ where: { id: storyId, userId } }) : Promise.resolve(null),
    ]);

    // Validate ownership for explicitly passed IDs
    if (heroId && !hero) throw new NotFoundException('Hero not found or does not belong to you');
    if (characterId && !character) throw new NotFoundException('Character not found or does not belong to you');
    if (storyId && !story) throw new NotFoundException('Story not found or does not belong to you');

    const resolvedHero = hero ?? (story?.heroId ? await this.heroesRepository.findOne({ where: { id: story.heroId, userId } }) : null);

    // Only enforce ownership for an explicitly passed universeId
    if (universeId) {
      const universe = await this.universesRepository.findOne({ where: { id: universeId, userId } });
      if (!universe) throw new NotFoundException('Universe not found or does not belong to you');
      return { universe, hero: resolvedHero, character, story };
    }

    // For universeId derived from hero/story, look up best-effort (don't throw if stale)
    const derivedUniverseId = story?.universeId ?? resolvedHero?.universeId ?? character?.universeId ?? null;
    const universe = derivedUniverseId
      ? await this.universesRepository.findOne({ where: { id: derivedUniverseId, userId } })
      : null;

    return { universe: universe ?? null, hero: resolvedHero, character, story };
  }

  private serializeDesign(design: MerchandiseDesign, context?: OwnedAssetContext) {
    return {
      id: design.id,
      userId: design.userId,
      productId: design.productId,
      productName: design.productName,
      fulfillmentType: design.fulfillmentType,
      universeId: design.universeId,
      storyId: design.storyId,
      heroId: design.heroId,
      displayName: design.displayName,
      titleText: design.titleText,
      subtitle: design.subtitle,
      message: design.message,
      themeColor: design.themeColor,
      quantity: design.quantity,
      data: design.data,
      previewUrl: design.previewUrl,
      universe: context?.universe ?? null,
      hero: context?.hero ?? null,
      story: context?.story ?? null,
      createdAt: design.createdAt,
      updatedAt: design.updatedAt,
    };
  }

  private requireProduct(productId: string): MerchandiseProductCatalogItem {
    const product = getMerchandiseProduct(productId);
    if (!product || !product.active) {
      throw new NotFoundException('Merchandise product not found');
    }
    return product;
  }

  private async ensureMerchandiseEnabled() {
    if (!(await this.getBooleanSetting('ENABLE_MERCHANDISE', true))) {
      throw new ForbiddenException('Merchandise is disabled');
    }
  }

  private async isPhysicalOrdersEnabled() {
    return this.getBooleanSetting('ENABLE_PHYSICAL_ORDERS', true);
  }

  private async getBooleanSetting(key: string, fallback: boolean) {
    const row = await this.settingsRepository.findOne({ where: { key } });
    if (!row) return fallback;
    return row.value === 'true' || row.value === '1';
  }

  private async buildPreviewDataUrl(
    product: MerchandiseProductCatalogItem,
    design: MerchandiseDesign,
    context: OwnedAssetContext,
  ) {
    const template = getTemplatesForProduct(product.id)[0] ?? null;
    const theme = design.themeColor ?? template?.defaultThemeColor ?? '#6d28d9';

    const rawTitle = design.titleText ?? product.name;
    const titleLines = wrapTitle(rawTitle, 22).map(escapeXml);

    const subtitle = escapeXml(
      design.subtitle ?? design.displayName ?? context.universe?.heroTitle ?? context.universe?.name ?? 'HeroKids Universe',
    );
    const message = escapeXml(design.message ?? '✦  Made with love  ✦');
    const heroName = escapeXml(context.character?.name ?? context.hero?.name ?? design.displayName ?? 'Hero');
    const universeName = escapeXml(context.universe?.name ?? '');
    const storyTitle = escapeXml(context.story?.title ?? '');
    const storyVisualUrl = this.getStoryVisualUrl(context.story);
    const primaryImageUrl =
      storyVisualUrl
        ?? context.character?.avatarUrl
        ?? context.hero?.avatarUrl
        ?? (context.universe as any)?.coverImageUrl
        ?? '';
    const [sourceImage, avatarImage] = await Promise.all([
      this.embedPreviewImage(primaryImageUrl),
      this.embedPreviewImage(context.character?.avatarUrl ?? context.hero?.avatarUrl ?? ''),
    ]);
    const imageHref = escapeXml(sourceImage.dataUrl);
    const avatarHref = escapeXml(avatarImage.dataUrl);

    // Dynamic vertical layout based on title line count
    const hasTwoTitleLines = titleLines.length >= 2;
    const titleSize = hasTwoTitleLines ? 54 : 64;
    const brandY = 108;
    const titleY1 = 158;
    const titleY2 = titleY1 + titleSize + 8; // second line
    const subtitleY = hasTwoTitleLines ? titleY2 + 44 : titleY1 + 56;
    const imageY = subtitleY + 48;
    const imageH = 650;
    const captionY = imageY + imageH + 26;
    const captionH = 160;
    const bannerY = captionY + captionH + 26;        // message banner
    const bannerH = 108;
    const footerY = bannerY + bannerH + 70;
    const svgH = footerY + 40;

    // Avatar position: bottom-right of caption, overlapping caption top edge
    const avatarCx = 1040;
    const avatarCy = captionY + captionH / 2;
    const avatarR = 74;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1200" height="${svgH}" viewBox="0 0 1200 ${svgH}">
  <defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="0.4" y2="1">
      <stop offset="0%" stop-color="${theme}" />
      <stop offset="100%" stop-color="#0a0618" />
    </linearGradient>
    <radialGradient id="topGlow" cx="80%" cy="0%" r="70%">
      <stop offset="0%" stop-color="${theme}" stop-opacity="0.45" />
      <stop offset="100%" stop-color="${theme}" stop-opacity="0" />
    </radialGradient>
    <filter id="imgShadow" x="-5%" y="-5%" width="110%" height="115%">
      <feDropShadow dx="0" dy="16" stdDeviation="24" flood-color="#000000" flood-opacity="0.55" />
    </filter>
    <clipPath id="imgClip">
      <rect x="80" y="${imageY}" width="1040" height="${imageH}" rx="28" ry="28" />
    </clipPath>
    <clipPath id="avatarClip">
      <circle cx="${avatarCx}" cy="${avatarCy}" r="${avatarR}" />
    </clipPath>
  </defs>

  <!-- Background -->
  <rect width="1200" height="${svgH}" fill="url(#bgGrad)" />
  <rect width="1200" height="${svgH}" fill="url(#topGlow)" />

  <!-- Decorative orbs -->
  <circle cx="1160" cy="60" r="220" fill="rgba(255,255,255,0.05)" />
  <circle cx="-40" cy="${svgH - 80}" r="300" fill="rgba(255,255,255,0.04)" />

  <!-- Outer border frame -->
  <rect x="20" y="20" width="1160" height="${svgH - 40}" rx="56" fill="none" stroke="rgba(255,255,255,0.10)" stroke-width="1.5" />

  <!-- Brand label -->
  <text x="80" y="${brandY}" font-family="Georgia, 'Times New Roman', serif" font-size="20" font-weight="400" fill="rgba(255,255,255,0.45)" letter-spacing="3">&#x2756;  HEROKIDS UNIVERSE  &#x2756;</text>

  <!-- Title -->
  <text x="80" y="${titleY1}" font-family="Georgia, 'Times New Roman', serif" font-size="${titleSize}" font-weight="900" fill="#ffffff">${titleLines[0] ?? ''}</text>
  ${hasTwoTitleLines ? `<text x="80" y="${titleY2}" font-family="Georgia, 'Times New Roman', serif" font-size="${titleSize}" font-weight="900" fill="#ffffff">${titleLines[1]}</text>` : ''}

  <!-- Subtitle -->
  <text x="80" y="${subtitleY}" font-family="Georgia, 'Times New Roman', serif" font-size="26" font-weight="400" fill="rgba(255,255,255,0.60)">${subtitle}</text>

  <!-- Image frame shadow + artwork -->
  <g filter="url(#imgShadow)">
    <rect x="80" y="${imageY}" width="1040" height="${imageH}" rx="28" fill="rgba(255,255,255,0.09)" />
  </g>
  <rect x="80" y="${imageY}" width="1040" height="${imageH}" rx="28" fill="rgba(255,255,255,0.06)" />
  ${imageHref ? `<image href="${imageHref}" x="110" y="${imageY + 30}" width="980" height="${imageH - 60}" preserveAspectRatio="xMidYMid meet" clip-path="url(#imgClip)" />` : ''}

  <!-- Caption card below the clean artwork -->
  <rect x="80" y="${captionY}" width="1040" height="${captionH}" rx="28" fill="rgba(8,4,22,0.78)" />
  <text x="140" y="${captionY + 55}" font-family="Georgia, serif" font-size="36" font-weight="700" fill="#ffffff">${heroName}</text>
  ${storyTitle ? `<text x="140" y="${captionY + 100}" font-family="Georgia, serif" font-size="24" fill="rgba(255,255,255,0.70)">${storyTitle}</text>` : ''}
  ${universeName ? `<text x="140" y="${captionY + 132}" font-family="Georgia, serif" font-size="21" fill="rgba(255,255,255,0.45)">${universeName}</text>` : ''}

  <!-- Avatar circle (overlaps caption top-right) -->
  ${avatarHref ? `
  <circle cx="${avatarCx}" cy="${avatarCy}" r="${avatarR + 6}" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.22)" stroke-width="2" />
  <image href="${avatarHref}" x="${avatarCx - avatarR}" y="${avatarCy - avatarR}" width="${avatarR * 2}" height="${avatarR * 2}" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatarClip)" />
  ` : ''}

  <!-- Message banner -->
  <rect x="80" y="${bannerY}" width="1040" height="${bannerH}" rx="26" fill="rgba(255,255,255,0.09)" stroke="rgba(255,255,255,0.15)" stroke-width="1.5" />
  <text x="600" y="${bannerY + 65}" font-family="Georgia, serif" font-size="28" font-weight="600" fill="rgba(255,255,255,0.90)" text-anchor="middle">${message}</text>

  <!-- Footer -->
  <text x="600" y="${footerY}" font-family="Georgia, serif" font-size="18" fill="rgba(255,255,255,0.22)" text-anchor="middle" letter-spacing="4">CREATED WITH HEROKIDS UNIVERSE</text>
</svg>`;

    return {
      previewUrl: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`,
      sourceImage,
      avatarImage,
    };
  }

  private async embedPreviewImage(rawUrl: string | null | undefined): Promise<EmbeddedPreviewImage> {
    const sourceUrl = rawUrl?.trim() ?? '';
    if (!sourceUrl) {
      return { sourceUrl: '', dataUrl: '', embedded: false, error: null };
    }
    if (sourceUrl.startsWith('data:image/')) {
      return { sourceUrl, dataUrl: sourceUrl, embedded: true, error: null };
    }

    const resolvedUrl = this.resolvePreviewImageUrl(sourceUrl);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(resolvedUrl, { signal: controller.signal });
      if (!response.ok) {
        return {
          sourceUrl,
          dataUrl: '',
          embedded: false,
          error: `Fetch failed with HTTP ${response.status}`,
        };
      }

      const contentType = response.headers.get('content-type')?.split(';')[0] ?? 'image/png';
      if (!contentType.startsWith('image/')) {
        return {
          sourceUrl,
          dataUrl: '',
          embedded: false,
          error: `Unsupported content type: ${contentType}`,
        };
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      return {
        sourceUrl,
        dataUrl: `data:${contentType};base64,${buffer.toString('base64')}`,
        embedded: true,
        error: null,
      };
    } catch (error) {
      return {
        sourceUrl,
        dataUrl: '',
        embedded: false,
        error: error instanceof Error ? error.message : 'Image fetch failed',
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private resolvePreviewImageUrl(sourceUrl: string): string {
    if (/^https?:\/\//i.test(sourceUrl)) {
      return sourceUrl;
    }

    const apiBaseUrl = this.configService.get<string>('API_PUBLIC_URL') ?? 'http://localhost:3000/api';
    const origin = apiBaseUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');
    return `${origin}${sourceUrl.startsWith('/') ? sourceUrl : `/${sourceUrl}`}`;
  }

  private getStoryVisualUrl(story: Story | null): string | null {
    const firstPageImage = story?.pages
      ?.slice()
      .sort((a, b) => a.pageNumber - b.pageNumber)
      .find((page) => page.imageUrl?.trim())?.imageUrl;

    return firstPageImage?.trim() || story?.coverImageUrl?.trim() || null;
  }
}

function wrapTitle(title: string, maxCharsPerLine: number): string[] {
  if (title.length <= maxCharsPerLine) return [title];
  const words = title.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxCharsPerLine) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  // Cap at 2 lines; if overflow, truncate last line with ellipsis
  if (lines.length > 2) {
    const last = lines[1];
    lines.length = 2;
    if (last && last.length > maxCharsPerLine - 1) {
      lines[1] = last.slice(0, maxCharsPerLine - 1) + '…';
    }
  }
  return lines;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
