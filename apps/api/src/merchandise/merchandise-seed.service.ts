import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { MerchandiseSizeChart } from './catalog/merchandise-size-chart.entity';
import { ProductAttribute } from './catalog/product-attribute.entity';
import { ProductAttributeValue } from './catalog/product-attribute-value.entity';
import { ProductCategory } from './catalog/product-category.entity';
import { CatalogProductType, Product } from './catalog/product.entity';

@Injectable()
export class MerchandiseSeedService implements OnModuleInit {
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

  async onModuleInit() {
    await this.seedCategories();
    await this.seedProducts();
    await this.seedAttributes();
    await this.seedSizeChart();
  }

  private async seedCategories() {
    const rows = [
      ['Books', 'books', 0],
      ['Apparel', 'apparel', 1],
      ['Prints', 'prints', 2],
      ['Stationery', 'stationery', 3],
    ] as const;

    for (const [name, slug, sortOrder] of rows) {
      const existing = await this.categoriesRepo.findOne({ where: { slug } });
      if (existing) continue;
      await this.categoriesRepo.save(this.categoriesRepo.create({ name, slug, sortOrder, isActive: true, description: null }));
    }
  }

  private async seedProducts() {
    const categories = await this.categoriesRepo.find({ where: { isDeleted: false } });
    const categoryBySlug = new Map(categories.map((row) => [row.slug, row]));
    const rows = [
      ['books', 'printed_storybook', 'Printed Storybook', CatalogProductType.Physical, 799, 'story_pdf', 'A professionally printed personalized storybook featuring your child as the hero.'],
      ['apparel', 'hero_apparel', 'HeroKids Universe Apparel', CatalogProductType.Physical, 599, 'hero_avatar', "Personalized HeroKids clothing featuring your child's hero avatar and universe branding."],
      ['prints', 'hero_poster_pdf', 'Hero Poster PDF', CatalogProductType.Digital, 199, 'hero_avatar', null],
      ['prints', 'printed_story_cover_poster', 'Printed Story Cover Poster', CatalogProductType.Physical, 549, 'story_cover', null],
      ['prints', 'hero_certificate_pdf', 'Hero Certificate PDF', CatalogProductType.Digital, 149, 'hero_avatar', null],
      ['stationery', 'sticker_sheet_pdf', 'Sticker Sheet PDF', CatalogProductType.Digital, 179, 'hero_avatar', null],
      ['stationery', 'pencil_labels', 'Pencil Labels', CatalogProductType.Digital, 99, 'hero_avatar', null],
      ['stationery', 'school_labels', 'School Labels', CatalogProductType.Digital, 129, 'hero_avatar', null],
    ] as const;

    for (const [categorySlug, slug, name, productType, basePrice, requiredAssetType, description] of rows) {
      const existing = await this.productsRepo.findOne({ where: { slug } });
      if (existing) continue;
      const category = categoryBySlug.get(categorySlug);
      if (!category) continue;
      await this.productsRepo.save(this.productsRepo.create({
        categoryId: category.id,
        slug,
        name,
        productType,
        basePrice,
        salePrice: null,
        requiredAssetType,
        description,
        previewImageUrl: null,
        isActive: true,
        sortOrder: 0,
      }));
    }
  }

  private async seedAttributes() {
    const apparel = await this.productsRepo.findOne({ where: { slug: 'hero_apparel' } });
    const storybook = await this.productsRepo.findOne({ where: { slug: 'printed_storybook' } });
    if (apparel) {
      const sizeAttr = await this.upsertAttribute(apparel.id, 'Size', 'size', 'select', true, 0);
      const colorAttr = await this.upsertAttribute(apparel.id, 'Color', 'color', 'color', true, 1);
      const placementAttr = await this.upsertAttribute(apparel.id, 'Print Placement', 'placement', 'radio', true, 2);

      const sizes = ['2-3Y', '3-4Y', '5-6Y', '7-8Y', '9-10Y', '11-12Y', '13-14Y', '15-16Y', 'S', 'M', 'L', 'XL', 'XXL'];
      for (const [index, size] of sizes.entries()) {
        await this.upsertAttributeValue(sizeAttr.id, size, size, index, 0, null);
      }
      const colors = [
        ['white', 'White', '#FFFFFF'],
        ['black', 'Black', '#111111'],
        ['purple', 'Purple', '#7C3AED'],
        ['sky_blue', 'Sky Blue', '#0EA5E9'],
        ['yellow', 'Yellow', '#F59E0B'],
      ] as const;
      for (const [index, [value, label, hex]] of colors.entries()) {
        await this.upsertAttributeValue(colorAttr.id, value, label, index, 0, { hex });
      }
      const placements = [
        ['front_center', 'Front Center'],
        ['back_center', 'Back Center'],
        ['front_back', 'Front + Back'],
      ] as const;
      for (const [index, [value, label]] of placements.entries()) {
        await this.upsertAttributeValue(placementAttr.id, value, label, index, 0, null);
      }
    }

    if (storybook) {
      const bindingAttr = await this.upsertAttribute(storybook.id, 'Binding', 'binding', 'radio', true, 0);
      await this.upsertAttribute(storybook.id, 'Paper Quality', 'paper_quality', 'select', false, 1);
      const bindings = [
        ['softcover', 'Softcover', 0],
        ['hardcover', 'Hardcover', 700],
        ['premium_gift', 'Premium Gift Edition', 1700],
      ] as const;
      for (const [index, [value, label, modifier]] of bindings.entries()) {
        await this.upsertAttributeValue(bindingAttr.id, value, label, index, modifier, null);
      }
    }
  }

  private async seedSizeChart() {
    const apparel = await this.productsRepo.findOne({ where: { slug: 'hero_apparel' } });
    if (!apparel) return;
    const rows = [
      ['2-3Y', '2–3 Years', 22.0, 15.5, 10.5],
      ['3-4Y', '3–4 Years', 24.0, 16.5, 11.0],
      ['5-6Y', '5–6 Years', 26.0, 18.0, 12.0],
      ['7-8Y', '7–8 Years', 28.0, 19.5, 12.5],
      ['9-10Y', '9–10 Years', 30.0, 21.0, 13.5],
      ['11-12Y', '11–12 Years', 32.0, 22.5, 14.0],
      ['13-14Y', '13–14 Years', 34.0, 24.0, 15.0],
      ['15-16Y', '15–16 Years', 36.0, 25.0, 15.5],
      ['S', 'Adult', 38.0, 27.0, 16.5],
      ['M', 'Adult', 40.0, 28.0, 17.5],
      ['L', 'Adult', 42.0, 29.0, 18.5],
      ['XL', 'Adult', 44.0, 30.0, 19.5],
      ['XXL', 'Adult', 46.0, 31.0, 20.5],
    ] as const;

    for (const [sortOrder, [sizeLabel, ageRange, chestInches, lengthInches, shoulderInches]] of rows.entries()) {
      const existing = await this.sizeChartRepo.findOne({ where: { productId: apparel.id, sizeLabel } });
      if (existing) continue;
      await this.sizeChartRepo.save(this.sizeChartRepo.create({
        productId: apparel.id,
        sizeLabel,
        ageRange,
        chestInches,
        lengthInches,
        shoulderInches,
        chestCm: toCm(chestInches),
        lengthCm: toCm(lengthInches),
        shoulderCm: toCm(shoulderInches),
        sortOrder,
        isActive: true,
      }));
    }
  }

  private async upsertAttribute(productId: string, name: string, slug: string, inputType: string, isRequired: boolean, sortOrder: number) {
    const existing = await this.attributesRepo.findOne({ where: { productId, slug } });
    if (existing) return existing;
    return this.attributesRepo.save(this.attributesRepo.create({ productId, name, slug, inputType, isRequired, isActive: true, sortOrder }));
  }

  private async upsertAttributeValue(attributeId: string, value: string, label: string, sortOrder: number, priceModifier: number, metadataJson: Record<string, unknown> | null) {
    const existing = await this.attributeValuesRepo.findOne({ where: { attributeId, value } });
    if (existing) return existing;
    return this.attributeValuesRepo.save(this.attributeValuesRepo.create({
      attributeId,
      value,
      label,
      priceModifier,
      metadataJson,
      isActive: true,
      sortOrder,
    }));
  }
}

function toCm(value: number): number {
  return Math.round(value * 2.54 * 10) / 10;
}
