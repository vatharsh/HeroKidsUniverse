import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';

import { PlatformSetting } from '../../admin/platform-setting.entity';
import { InfluencerCommission } from '../../influencers/influencer-commission.entity';
import { CouponType } from '../../influencers/influencer-coupon-code.entity';
import { InfluencersService } from '../../influencers/influencers.service';
import { User } from '../../users/user.entity';
import { ProductAttribute } from '../catalog/product-attribute.entity';
import { ProductAttributeValue } from '../catalog/product-attribute-value.entity';
import { ProductCategory } from '../catalog/product-category.entity';
import { CatalogProductType, Product } from '../catalog/product.entity';
import { MerchandiseDesign } from '../merchandise-design.entity';
import { OrderStatusHistory } from '../order-status-history.entity';
import { PaymentMethod } from '../order.entity';
import { OrderPaymentDetail, OrderPaymentTransactionType } from '../payments/order-payment-detail.entity';
import { OrderPaymentState, OrderPaymentSummary } from '../payments/order-payment-summary.entity';
import { CreateOrderV2Dto } from './dto/create-order-v2.dto';
import { CommerceOrderStatus, CommerceOrderType, Order } from './order.entity';
import { OrderItemAttribute } from './order-item-attribute.entity';
import { OrderItemAttributeValue } from './order-item-attribute-value.entity';
import { OrderItem } from './order-item.entity';

@Injectable()
export class OrderV2Service implements OnModuleInit {
  private readonly logger = new Logger(OrderV2Service.name);

  constructor(
    @InjectRepository(Order)
    private readonly ordersRepo: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemsRepo: Repository<OrderItem>,
    @InjectRepository(OrderItemAttribute)
    private readonly orderItemAttributesRepo: Repository<OrderItemAttribute>,
    @InjectRepository(OrderItemAttributeValue)
    private readonly orderItemAttributeValuesRepo: Repository<OrderItemAttributeValue>,
    @InjectRepository(OrderStatusHistory)
    private readonly statusHistoryRepo: Repository<OrderStatusHistory>,
    @InjectRepository(OrderPaymentSummary)
    private readonly paymentSummaryRepo: Repository<OrderPaymentSummary>,
    @InjectRepository(OrderPaymentDetail)
    private readonly paymentDetailRepo: Repository<OrderPaymentDetail>,
    @InjectRepository(Product)
    private readonly productsRepo: Repository<Product>,
    @InjectRepository(ProductCategory)
    private readonly categoriesRepo: Repository<ProductCategory>,
    @InjectRepository(ProductAttribute)
    private readonly attributesRepo: Repository<ProductAttribute>,
    @InjectRepository(ProductAttributeValue)
    private readonly attributeValuesRepo: Repository<ProductAttributeValue>,
    @InjectRepository(MerchandiseDesign)
    private readonly designsRepo: Repository<MerchandiseDesign>,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    private readonly influencersService: InfluencersService,
    private readonly dataSource: DataSource,
    @InjectRepository(PlatformSetting)
    private readonly settingsRepo: Repository<PlatformSetting>,
  ) {}

  async onModuleInit() {
    try {
      const setting = await this.settingsRepo.findOne({ where: { key: 'SANDBOX_MODE' } });
      const isSandbox = setting ? setting.value === 'true' : true;
      if (isSandbox) {
        const result = await this.ordersRepo
          .createQueryBuilder()
          .update()
          .set({ isSandbox: true })
          .where('isSandbox = false')
          .execute();
        if (result.affected && result.affected > 0) {
          this.logger.log(`Backfilled ${result.affected} v2 orders to isSandbox=true`);
        }
      }
    } catch (err) {
      this.logger.warn('Order isSandbox backfill skipped', err);
    }
  }

  async createOrder(userId: string, dto: CreateOrderV2Dto) {
    return this.dataSource.transaction(async (manager) => {
      const productSlugs = dto.items.map((item) => item.productSlug);
      const products = await manager.find(Product, {
        where: { slug: In(productSlugs), isDeleted: false, isActive: true },
      });
      if (products.length !== productSlugs.length) {
        throw new NotFoundException('One or more products were not found');
      }

      const categories = await manager.find(ProductCategory, { where: { isDeleted: false } });
      const categoriesById = new Map(categories.map((category) => [category.id, category]));

      const productIds = products.map((product) => product.id);
      const attributes = await manager.find(ProductAttribute, {
        where: { productId: In(productIds), isDeleted: false, isActive: true },
      });
      const attributesByProduct = new Map<string, ProductAttribute[]>();
      for (const attribute of attributes) {
        attributesByProduct.set(attribute.productId, [...(attributesByProduct.get(attribute.productId) ?? []), attribute]);
      }

      const attributeIds = attributes.map((attribute) => attribute.id);
      const attributeValues = attributeIds.length
        ? await manager.find(ProductAttributeValue, {
            where: { attributeId: In(attributeIds), isDeleted: false, isActive: true },
          })
        : [];
      const valuesByAttributeId = new Map<string, ProductAttributeValue[]>();
      for (const value of attributeValues) {
        valuesByAttributeId.set(value.attributeId, [...(valuesByAttributeId.get(value.attributeId) ?? []), value]);
      }

      const productsBySlug = new Map(products.map((product) => [product.slug, product]));
      const designsById = new Map<string, MerchandiseDesign>();

      const normalizedItems = [];
      for (const item of dto.items) {
        const product = productsBySlug.get(item.productSlug);
        if (!product) throw new NotFoundException(`Product ${item.productSlug} not found`);

        const selectedAttributes = item.selectedAttributes ?? {};
        const productAttributes = attributesByProduct.get(product.id) ?? [];
        const resolvedSelections: Array<{
          attribute: ProductAttribute;
          value: ProductAttributeValue;
        }> = [];

        for (const [slug, selectedValueKey] of Object.entries(selectedAttributes)) {
          const attribute = productAttributes.find((row) => row.slug === slug);
          if (!attribute) throw new BadRequestException(`Invalid attribute ${slug} for ${product.slug}`);
          const value = (valuesByAttributeId.get(attribute.id) ?? []).find((row) => row.value === selectedValueKey);
          if (!value) throw new BadRequestException(`Invalid value ${selectedValueKey} for ${slug}`);
          resolvedSelections.push({ attribute, value });
        }

        for (const attribute of productAttributes.filter((row) => row.isRequired)) {
          if (!(attribute.slug in selectedAttributes)) {
            throw new BadRequestException(`Missing required attribute ${attribute.slug}`);
          }
        }

        let design: MerchandiseDesign | null = null;
        if (item.designId) {
          design = designsById.get(item.designId)
            ?? await manager.findOne(MerchandiseDesign, { where: { id: item.designId, userId, isDeleted: false } });
          if (!design) throw new NotFoundException('Design not found');
          designsById.set(item.designId, design);
        }

        normalizedItems.push({ product, category: categoriesById.get(product.categoryId) ?? null, selections: resolvedSelections, design, item });
      }

      const hasPhysical = normalizedItems.some(({ product }) => product.productType === CatalogProductType.Physical);
      if (hasPhysical && (!dto.shippingAddressLine1 || !dto.shippingCity || !dto.shippingPincode || !dto.shippingName || !dto.shippingPhone)) {
        throw new BadRequestException('Physical items require full shipping details');
      }

      const subtotalAmount = normalizedItems.reduce((sum, row) => {
        const base = getEffectiveBasePrice(row.product);
        const modifier = row.selections.reduce((acc, selection) => acc + Number(selection.value.priceModifier), 0);
        return sum + (base + modifier) * row.item.quantity;
      }, 0);
      const couponResult = dto.couponCode
        ? await this.influencersService.validateCoupon(dto.couponCode, {
            subtotalAmount,
            productIds: normalizedItems.map((row) => row.product.id),
            categoryIds: normalizedItems.map((row) => row.product.categoryId),
            userId,
          })
        : null;
      if (dto.couponCode && couponResult && !couponResult.valid) {
        throw new BadRequestException(couponResult.errorMessage);
      }
      let discountAmount = 0;
      if (couponResult?.valid) {
        if (couponResult.discountType === 'percentage') {
          discountAmount = round2((subtotalAmount * (couponResult.discountValue ?? 0)) / 100);
          if (couponResult.maxDiscountAmount !== null && couponResult.maxDiscountAmount !== undefined) {
            discountAmount = Math.min(discountAmount, couponResult.maxDiscountAmount);
          }
        } else {
          discountAmount = Math.min(couponResult.discountValue ?? 0, subtotalAmount);
        }
      }
      const shippingAmount = 0;
      const totalAmount = round2(subtotalAmount - discountAmount + shippingAmount);
      const taxAmount = round2((totalAmount * 18) / 118);
      const orderType = hasPhysical
        ? normalizedItems.every(({ product }) => product.productType === CatalogProductType.Physical)
          ? CommerceOrderType.Physical
          : CommerceOrderType.Mixed
        : CommerceOrderType.Digital;

      const order = await manager.save(Order, manager.create(Order, {
        userId,
        orderNumber: await this.generateOrderNumber(manager),
        orderType,
        status: CommerceOrderStatus.Paid,
        subtotalAmount,
        discountAmount,
        couponCode: couponResult?.valid ? couponResult.code ?? null : null,
        couponCodeId: couponResult?.valid ? couponResult.couponCodeId ?? null : null,
        influencerId: couponResult?.valid ? couponResult.influencerId ?? null : null,
        couponType: couponResult?.valid ? (couponResult.couponType ?? null) : null,
        couponDiscountType: couponResult?.valid ? couponResult.discountType ?? null : null,
        couponDiscountValue: couponResult?.valid ? couponResult.discountValue ?? null : null,
        couponDiscountAmount: couponResult?.valid ? discountAmount : null,
        influencerCommissionRate: null,
        influencerCommissionAmount: null,
        shippingAmount,
        taxAmount,
        totalAmount,
        currency: 'INR',
        customerName: dto.customerName ?? null,
        customerEmail: dto.customerEmail ?? null,
        customerPhone: dto.customerPhone ?? null,
        paymentMethod: dto.paymentMethod,
        shippingName: dto.shippingName ?? null,
        shippingPhone: dto.shippingPhone ?? dto.customerPhone ?? null,
        shippingAddressLine1: dto.shippingAddressLine1 ?? null,
        shippingAddressLine2: dto.shippingAddressLine2 ?? null,
        shippingCity: dto.shippingCity ?? null,
        shippingState: dto.shippingState ?? null,
        shippingPincode: dto.shippingPincode ?? null,
        shippingCountry: dto.shippingCountry ?? 'India',
        trackingNumber: null,
        trackingUrl: null,
        adminNotes: null,
      }));

      for (const row of normalizedItems) {
        const unitBase = getEffectiveBasePrice(row.product);
        const modifier = row.selections.reduce((acc, selection) => acc + Number(selection.value.priceModifier), 0);
        const unitPrice = round2(unitBase + modifier);
        const totalPrice = round2(unitPrice * row.item.quantity);

        const orderItem = await manager.save(OrderItem, manager.create(OrderItem, {
          orderId: order.id,
          productId: row.product.id,
          productNameSnapshot: row.product.name,
          productSlugSnapshot: row.product.slug,
          categoryNameSnapshot: row.category?.name ?? null,
          quantity: row.item.quantity,
          unitPrice,
          totalPrice,
          designId: row.design?.id ?? row.item.designId ?? null,
          heroId: row.item.heroId ?? null,
          storyId: row.item.storyId ?? null,
          universeId: row.item.universeId ?? null,
          previewUrl: row.design?.previewUrl ?? null,
          printFileUrl: row.product.productType === CatalogProductType.Physical ? row.design?.previewUrl ?? null : null,
          metadataJson: {
            selectedAttributes: row.item.selectedAttributes ?? {},
          },
        }));

        for (const selection of row.selections) {
          const orderItemAttribute = await manager.save(OrderItemAttribute, manager.create(OrderItemAttribute, {
            orderItemId: orderItem.id,
            attributeNameSnapshot: selection.attribute.name,
            attributeSlugSnapshot: selection.attribute.slug,
          }));

          await manager.save(OrderItemAttributeValue, manager.create(OrderItemAttributeValue, {
            orderItemAttributeId: orderItemAttribute.id,
            attributeValueSnapshot: selection.value.value,
            attributeLabelSnapshot: selection.value.label,
            priceModifierSnapshot: Number(selection.value.priceModifier),
            metadataJson: selection.value.metadataJson ?? null,
          }));
        }
      }

      const paymentSummary = await manager.save(OrderPaymentSummary, manager.create(OrderPaymentSummary, {
        orderId: order.id,
        paymentStatus: OrderPaymentState.Paid,
        totalPaidAmount: totalAmount,
        totalRefundedAmount: 0,
        outstandingAmount: 0,
        currency: 'INR',
        paymentMethodSummary: dto.paymentMethod.toUpperCase(),
      }));

      await manager.save(OrderPaymentDetail, manager.create(OrderPaymentDetail, {
        orderId: order.id,
        paymentSummaryId: paymentSummary.id,
        transactionType: OrderPaymentTransactionType.Payment,
        paymentProvider: 'manual',
        paymentMethod: dto.paymentMethod,
        transactionId: null,
        providerReference: null,
        amount: totalAmount,
        currency: 'INR',
        status: 'success',
        rawResponseJson: { mocked: true },
      }));

      await manager.save(OrderStatusHistory, manager.create(OrderStatusHistory, {
        orderId: order.id,
        oldStatus: null,
        newStatus: CommerceOrderStatus.Paid,
        note: 'Order created',
        changedByUserId: userId,
      }));

      if (couponResult?.valid && order.couponCodeId) {
        if (order.influencerId && couponResult.couponType !== CouponType.Platform) {
          await this.influencersService.createCommissionForOrder({
            influencerId: order.influencerId,
            couponCodeId: order.couponCodeId,
            orderId: order.id,
            orderNumber: order.orderNumber,
            userId,
            subtotalAmount,
            orderTotal: totalAmount,
            discountAmount,
            shippingAmount: 0,
            taxAmount: Number(order.taxAmount),
          });
          const commission = await manager.findOneByOrFail(InfluencerCommission, { orderId: order.id });
          const refreshedOrder = await manager.findOneByOrFail(Order, { id: order.id });
          refreshedOrder.influencerCommissionRate = Number(commission.commissionRate);
          refreshedOrder.influencerCommissionAmount = Number(commission.commissionAmount);
          await manager.save(Order, refreshedOrder);
        } else {
          // Platform coupon: record usage and increment usageCount (no commission)
          await this.influencersService.recordCouponUsageForOrder(order.couponCodeId, userId, order.id);
        }
      }

      return this.getOrderDetail(order.id, userId, false, manager);
    });
  }

  async listMyOrders(userId: string) {
    return this.listOrders({ userId, includeDeleted: false });
  }

  async getMyOrder(userId: string, orderId: string) {
    return this.getOrderDetail(orderId, userId, false);
  }

  async adminListOrders(filters?: { status?: string; userId?: string; includeDeleted?: boolean; page?: number; limit?: number }) {
    return this.listOrders({ ...filters, includeDeleted: filters?.includeDeleted ?? false });
  }

  async adminGetOrder(orderId: string, includeDeleted = false) {
    return this.getOrderDetail(orderId, undefined, includeDeleted);
  }

  async adminUpdateStatus(orderId: string, newStatus: string, note?: string, adminId?: string) {
    const order = await this.ordersRepo.findOne({ where: { id: orderId, isDeleted: false } });
    if (!order) throw new NotFoundException('Order not found');
    const oldStatus = order.status;
    order.status = newStatus as CommerceOrderStatus;
    await this.ordersRepo.save(order);
    await this.statusHistoryRepo.save(this.statusHistoryRepo.create({
      orderId,
      oldStatus,
      newStatus,
      note: note ?? null,
      changedByUserId: adminId ?? null,
    }));
    if ([CommerceOrderStatus.Cancelled, CommerceOrderStatus.Refunded].includes(order.status)) {
      await this.influencersService.reverseCommissionForOrder(orderId);
    }
  }

  async adminSaveNotes(orderId: string, adminNotes: string) {
    const order = await this.ordersRepo.findOne({ where: { id: orderId, isDeleted: false } });
    if (!order) throw new NotFoundException('Order not found');
    order.adminNotes = adminNotes;
    await this.ordersRepo.save(order);
  }

  async adminSoftDeleteOrder(orderId: string, adminId: string) {
    const order = await this.ordersRepo.findOne({ where: { id: orderId, isDeleted: false } });
    if (!order) throw new NotFoundException('Order not found');
    order.isDeleted = true;
    order.deletedAt = new Date();
    order.deletedBy = adminId;
    await this.ordersRepo.save(order);
  }

  async getPaymentView(orderId: string, includeDeleted = false) {
    const [summary, details] = await Promise.all([
      this.paymentSummaryRepo.findOne({ where: { orderId, ...(includeDeleted ? {} : { isDeleted: false }) } }),
      this.paymentDetailRepo.find({
        where: { orderId, ...(includeDeleted ? {} : { isDeleted: false }) },
        order: { createdAt: 'ASC' },
      }),
    ]);
    if (!summary) throw new NotFoundException('Payment summary not found');
    return { summary, details };
  }

  private async listOrders(input: { userId?: string; status?: string; includeDeleted?: boolean; page?: number; limit?: number }) {
    const page = Math.max(1, input.page ?? 1);
    const limit = Math.max(1, input.limit ?? 20);
    const where: Record<string, unknown> = {};
    if (!input.includeDeleted) where.isDeleted = false;
    if (input.userId) where.userId = input.userId;
    if (input.status) where.status = input.status;

    const [orders, total] = await this.ordersRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const orderIds = orders.map((order) => order.id);
      const items = orderIds.length
        ? await this.orderItemsRepo.find({
            where: { orderId: In(orderIds), ...(input.includeDeleted ? {} : { isDeleted: false }) },
            order: { createdAt: 'ASC' },
          })
        : [];
      const itemIds = items.map((item) => item.id);
      const attributes = itemIds.length
        ? await this.orderItemAttributesRepo.find({
            where: { orderItemId: In(itemIds), ...(input.includeDeleted ? {} : { isDeleted: false }) },
            order: { createdAt: 'ASC' },
          })
        : [];
      const attrIds = attributes.map((a) => a.id);
      const values = attrIds.length
        ? await this.orderItemAttributeValuesRepo.find({
            where: { orderItemAttributeId: In(attrIds), ...(input.includeDeleted ? {} : { isDeleted: false }) },
            order: { createdAt: 'ASC' },
          })
        : [];

    const attrsByItemId = new Map<string, OrderItemAttribute[]>();
    for (const attribute of attributes) {
      attrsByItemId.set(attribute.orderItemId, [...(attrsByItemId.get(attribute.orderItemId) ?? []), attribute]);
    }

    const valuesByAttrId = new Map<string, OrderItemAttributeValue[]>();
    for (const value of values) {
      valuesByAttrId.set(value.orderItemAttributeId, [...(valuesByAttrId.get(value.orderItemAttributeId) ?? []), value]);
    }

    const itemsByOrderId = new Map<string, OrderItem[]>();
    for (const item of items) {
      itemsByOrderId.set(item.orderId, [...(itemsByOrderId.get(item.orderId) ?? []), item]);
    }

    const userIds = [...new Set(orders.map((o) => o.userId))];
    const users = userIds.length
      ? await this.usersRepo.find({ where: { id: In(userIds) }, select: ['id', 'email', 'name'] })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    return {
      items: orders.map((order) => {
        const orderItems = itemsByOrderId.get(order.id) ?? [];
        const user = userMap.get(order.userId);
        return {
          id: order.id,
          orderNumber: order.orderNumber,
          userId: order.userId,
          userEmail: user?.email ?? null,
          userName: user?.name ?? null,
          status: order.status,
          orderType: order.orderType,
          totalAmount: Number(order.totalAmount),
          couponCode: order.couponCode,
          currency: order.currency,
          itemCount: orderItems.length,
          createdAt: order.createdAt,
          items: orderItems.map((item) => ({
            productNameSnapshot: item.productNameSnapshot,
            categoryNameSnapshot: item.categoryNameSnapshot,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
            totalPrice: Number(item.totalPrice),
            previewUrl: item.previewUrl,
            attributeSummary: (attrsByItemId.get(item.id) ?? [])
              .flatMap((attribute) => (valuesByAttrId.get(attribute.id) ?? []).map((value) => value.attributeLabelSnapshot))
              .join(' · '),
          })),
        };
      }),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  private async getOrderDetail(orderId: string, userId?: string, includeDeleted = false, manager?: DataSource['manager']) {
    const em = manager ?? this.dataSource.manager;
    const order = await em.findOne(Order, {
      where: {
        id: orderId,
        ...(userId ? { userId } : {}),
        ...(includeDeleted ? {} : { isDeleted: false }),
      },
    });
    if (!order) throw new NotFoundException('Order not found');

    const [items, paymentSummary, paymentDetails, history] = await Promise.all([
      em.find(OrderItem, {
        where: { orderId, ...(includeDeleted ? {} : { isDeleted: false }) },
        order: { createdAt: 'ASC' },
      }),
      em.findOne(OrderPaymentSummary, { where: { orderId, ...(includeDeleted ? {} : { isDeleted: false }) } }),
      em.find(OrderPaymentDetail, {
        where: { orderId, ...(includeDeleted ? {} : { isDeleted: false }) },
        order: { createdAt: 'ASC' },
      }),
      em.find(OrderStatusHistory, {
        where: { orderId, ...(includeDeleted ? {} : { isDeleted: false }) },
        order: { createdAt: 'ASC' },
      }),
    ]);

    const itemIdList = items.map((item) => item.id);
    const filteredAttributes = itemIdList.length
      ? await em.find(OrderItemAttribute, {
          where: { orderItemId: In(itemIdList), ...(includeDeleted ? {} : { isDeleted: false }) },
          order: { createdAt: 'ASC' },
        })
      : [];
    const attrIdList = filteredAttributes.map((a) => a.id);
    const filteredValues = attrIdList.length
      ? await em.find(OrderItemAttributeValue, {
          where: { orderItemAttributeId: In(attrIdList), ...(includeDeleted ? {} : { isDeleted: false }) },
          order: { createdAt: 'ASC' },
        })
      : [];

    const attrsByItemId = new Map<string, OrderItemAttribute[]>();
    for (const attribute of filteredAttributes) {
      attrsByItemId.set(attribute.orderItemId, [...(attrsByItemId.get(attribute.orderItemId) ?? []), attribute]);
    }
    const valuesByAttrId = new Map<string, OrderItemAttributeValue[]>();
    for (const value of filteredValues) {
      valuesByAttrId.set(value.orderItemAttributeId, [...(valuesByAttrId.get(value.orderItemAttributeId) ?? []), value]);
    }

    return {
      ...order,
      subtotalAmount: Number(order.subtotalAmount),
      discountAmount: Number(order.discountAmount),
      couponCode: order.couponCode,
      couponCodeId: order.couponCodeId,
      influencerId: order.influencerId,
      couponDiscountType: order.couponDiscountType,
      couponDiscountValue: order.couponDiscountValue === null ? null : Number(order.couponDiscountValue),
      couponDiscountAmount: order.couponDiscountAmount === null ? null : Number(order.couponDiscountAmount),
      influencerCommissionRate: order.influencerCommissionRate === null ? null : Number(order.influencerCommissionRate),
      influencerCommissionAmount: order.influencerCommissionAmount === null ? null : Number(order.influencerCommissionAmount),
      shippingAmount: Number(order.shippingAmount),
      taxAmount: Number(order.taxAmount),
      totalAmount: Number(order.totalAmount),
      items: items.map((item) => ({
        ...item,
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.totalPrice),
        attributes: (attrsByItemId.get(item.id) ?? []).map((attribute) => ({
          ...attribute,
          values: (valuesByAttrId.get(attribute.id) ?? []).map((value) => ({
            ...value,
            priceModifierSnapshot: Number(value.priceModifierSnapshot),
          })),
        })),
      })),
      paymentSummary: paymentSummary
        ? {
            ...paymentSummary,
            totalPaidAmount: Number(paymentSummary.totalPaidAmount),
            totalRefundedAmount: Number(paymentSummary.totalRefundedAmount),
            outstandingAmount: Number(paymentSummary.outstandingAmount),
          }
        : null,
      paymentDetails: paymentDetails.map((detail) => ({ ...detail, amount: Number(detail.amount) })),
      statusHistory: history,
    };
  }

  private async generateOrderNumber(manager: DataSource['manager']): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const random = Math.random().toString(36).slice(2, 8).toUpperCase();
      const candidate = `HKU-${stamp}-${random}`;
      const existing = await manager.findOne(Order, { where: { orderNumber: candidate } });
      if (!existing) return candidate;
    }
    throw new BadRequestException('Could not generate unique order number');
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function getEffectiveBasePrice(product: Product): number {
  const basePrice = Number(product.basePrice);
  const salePrice = product.salePrice === null || product.salePrice === undefined ? null : Number(product.salePrice);
  return salePrice !== null && salePrice < basePrice ? salePrice : basePrice;
}
