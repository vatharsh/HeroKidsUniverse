import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { MerchandiseSizeChart } from './merchandise-size-chart.entity';
import { ProductAttribute } from './product-attribute.entity';
import { ProductAttributeValue } from './product-attribute-value.entity';
import { ProductCategory } from './product-category.entity';
import { Product } from './product.entity';

@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(ProductCategory)
    private readonly categoriesRepo: Repository<ProductCategory>,
    @InjectRepository(Product)
    private readonly productsRepo: Repository<Product>,
    @InjectRepository(ProductAttribute)
    private readonly attributesRepo: Repository<ProductAttribute>,
    @InjectRepository(ProductAttributeValue)
    private readonly attributeValuesRepo: Repository<ProductAttributeValue>,
    @InjectRepository(MerchandiseSizeChart)
    private readonly sizeChartRepo: Repository<MerchandiseSizeChart>,
  ) {}

  listCategories(): Promise<ProductCategory[]> {
    return this.categoriesRepo.find({
      where: { isDeleted: false, isActive: true },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  async listProducts(categorySlug?: string): Promise<Product[]> {
    let categoryId: string | undefined;
    if (categorySlug) {
      const category = await this.categoriesRepo.findOne({ where: { slug: categorySlug, isDeleted: false, isActive: true } });
      if (!category) return [];
      categoryId = category.id;
    }

    return this.productsRepo.find({
      where: {
        isDeleted: false,
        isActive: true,
        ...(categoryId ? { categoryId } : {}),
      },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  async getProductBySlug(slug: string) {
    const product = await this.productsRepo.findOne({ where: { slug, isDeleted: false, isActive: true } });
    if (!product) throw new NotFoundException('Product not found');
    const [rawAttributes, sizeChart] = await Promise.all([
      this.getProductAttributes(product.id),
      this.getSizeChart(product.id),
    ]);
    const attributes = await Promise.all(
      rawAttributes.map(async (attribute) => ({
        ...attribute,
        values: await this.getProductAttributeValues(attribute.id),
      })),
    );
    return { ...product, attributes, sizeChart };
  }

  getProductAttributes(productId: string): Promise<ProductAttribute[]> {
    return this.attributesRepo.find({
      where: { productId, isDeleted: false, isActive: true },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  getProductAttributeValues(attributeId: string): Promise<ProductAttributeValue[]> {
    return this.attributeValuesRepo.find({
      where: { attributeId, isDeleted: false, isActive: true },
      order: { sortOrder: 'ASC', label: 'ASC' },
    });
  }

  getSizeChart(productId: string): Promise<MerchandiseSizeChart[]> {
    return this.sizeChartRepo.find({
      where: { productId, isDeleted: false, isActive: true },
      order: { sortOrder: 'ASC' },
    });
  }

  adminListCategories(opts?: { includeDeleted?: boolean }): Promise<ProductCategory[]> {
    return this.categoriesRepo.find({
      where: opts?.includeDeleted ? {} : { isDeleted: false },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  adminListProducts(categoryId?: string, opts?: { includeDeleted?: boolean }): Promise<Product[]> {
    return this.productsRepo.find({
      where: {
        ...(opts?.includeDeleted ? {} : { isDeleted: false }),
        ...(categoryId ? { categoryId } : {}),
      },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  createCategory(dto: Partial<ProductCategory>): Promise<ProductCategory> {
    return this.categoriesRepo.save(this.categoriesRepo.create({
      name: dto.name ?? '',
      slug: dto.slug ?? '',
      description: dto.description ?? null,
      isActive: dto.isActive ?? true,
      sortOrder: dto.sortOrder ?? 0,
    }));
  }

  async updateCategory(id: string, dto: Partial<ProductCategory>): Promise<ProductCategory> {
    const row = await this.mustFind(this.categoriesRepo, id);
    Object.assign(row, dto);
    return this.categoriesRepo.save(row);
  }

  async softDeleteCategory(id: string, deletedBy: string): Promise<void> {
    const row = await this.mustFind(this.categoriesRepo, id);
    row.isDeleted = true;
    row.deletedAt = new Date();
    row.deletedBy = deletedBy;
    await this.categoriesRepo.save(row);
  }

  createProduct(dto: Partial<Product>): Promise<Product> {
    return this.productsRepo.save(this.productsRepo.create({
      categoryId: dto.categoryId!,
      name: dto.name ?? '',
      slug: dto.slug ?? '',
      description: dto.description ?? null,
      productType: dto.productType!,
      basePrice: dto.basePrice ?? 0,
      salePrice: dto.salePrice ?? null,
      previewImageUrl: dto.previewImageUrl ?? null,
      requiredAssetType: dto.requiredAssetType ?? null,
      isActive: dto.isActive ?? true,
      sortOrder: dto.sortOrder ?? 0,
    }));
  }

  async updateProduct(id: string, dto: Partial<Product>): Promise<Product> {
    const row = await this.mustFind(this.productsRepo, id);
    Object.assign(row, dto);
    return this.productsRepo.save(row);
  }

  async softDeleteProduct(id: string, deletedBy: string): Promise<void> {
    const row = await this.mustFind(this.productsRepo, id);
    row.isDeleted = true;
    row.deletedAt = new Date();
    row.deletedBy = deletedBy;
    await this.productsRepo.save(row);
  }

  async listAttributes(productId: string, opts?: { includeDeleted?: boolean }): Promise<ProductAttribute[]> {
    return this.attributesRepo.find({
      where: {
        productId,
        ...(opts?.includeDeleted ? {} : { isDeleted: false }),
      },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  createAttribute(dto: Partial<ProductAttribute>): Promise<ProductAttribute> {
    return this.attributesRepo.save(this.attributesRepo.create({
      productId: dto.productId!,
      name: dto.name ?? '',
      slug: dto.slug ?? '',
      inputType: dto.inputType ?? 'select',
      isRequired: dto.isRequired ?? true,
      isActive: dto.isActive ?? true,
      sortOrder: dto.sortOrder ?? 0,
    }));
  }

  async updateAttribute(id: string, dto: Partial<ProductAttribute>): Promise<ProductAttribute> {
    const row = await this.mustFind(this.attributesRepo, id);
    Object.assign(row, dto);
    return this.attributesRepo.save(row);
  }

  async softDeleteAttribute(id: string, deletedBy: string): Promise<void> {
    const row = await this.mustFind(this.attributesRepo, id);
    row.isDeleted = true;
    row.deletedAt = new Date();
    row.deletedBy = deletedBy;
    await this.attributesRepo.save(row);
  }

  listAttributeValues(attributeId: string, opts?: { includeDeleted?: boolean }): Promise<ProductAttributeValue[]> {
    return this.attributeValuesRepo.find({
      where: {
        attributeId,
        ...(opts?.includeDeleted ? {} : { isDeleted: false }),
      },
      order: { sortOrder: 'ASC', label: 'ASC' },
    });
  }

  createAttributeValue(dto: Partial<ProductAttributeValue>): Promise<ProductAttributeValue> {
    return this.attributeValuesRepo.save(this.attributeValuesRepo.create({
      attributeId: dto.attributeId!,
      value: dto.value ?? '',
      label: dto.label ?? '',
      priceModifier: dto.priceModifier ?? 0,
      metadataJson: dto.metadataJson ?? null,
      isActive: dto.isActive ?? true,
      sortOrder: dto.sortOrder ?? 0,
    }));
  }

  async updateAttributeValue(id: string, dto: Partial<ProductAttributeValue>): Promise<ProductAttributeValue> {
    const row = await this.mustFind(this.attributeValuesRepo, id);
    Object.assign(row, dto);
    return this.attributeValuesRepo.save(row);
  }

  async softDeleteAttributeValue(id: string, deletedBy: string): Promise<void> {
    const row = await this.mustFind(this.attributeValuesRepo, id);
    row.isDeleted = true;
    row.deletedAt = new Date();
    row.deletedBy = deletedBy;
    await this.attributeValuesRepo.save(row);
  }

  async upsertSizeChart(productId: string, entries: Array<Partial<MerchandiseSizeChart>>) {
    const existing = await this.sizeChartRepo.find({ where: { productId } });
    const byLabel = new Map(existing.map((row) => [row.sizeLabel, row]));
    for (const entry of entries) {
      const row = byLabel.get(entry.sizeLabel ?? '') ?? this.sizeChartRepo.create({ productId, sizeLabel: entry.sizeLabel ?? '' });
      Object.assign(row, { ...entry, productId });
      await this.sizeChartRepo.save(row);
    }
  }

  private async mustFind<T extends { id: string }>(repo: Repository<T>, id: string): Promise<T> {
    const row = await repo.findOne({ where: { id } as any });
    if (!row) throw new NotFoundException('Record not found');
    return row;
  }
}
