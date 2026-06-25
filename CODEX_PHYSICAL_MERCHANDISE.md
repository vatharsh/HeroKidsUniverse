# Backend Task: HeroKids Universe Commerce System — Catalog + Orders Refactor

## Context

This is a NestJS + TypeORM + PostgreSQL monorepo backend at `apps/api/`.
TypeORM is configured with `synchronize: true` — no migration files needed; entity changes auto-create/alter columns on restart.

### What Already Exists

The merchandise module lives at `apps/api/src/merchandise/` with:

- `merchandise.catalog.ts` — hardcoded product/template catalog (keep as legacy fallback, do NOT delete)
- `order.entity.ts` — `MerchandiseOrder` entity (legacy, keep, add soft-delete columns)
- `merchandise-design.entity.ts` — `MerchandiseDesign` entity (keep as-is; design IDs are referenced from new order_items)
- `order-status-history.entity.ts` — `OrderStatusHistory` entity (legacy, keep)
- `merchandise.service.ts` — business logic
- `merchandise.controller.ts` — REST endpoints
- `merchandise.module.ts` — NestJS module
- `dto/create-design.dto.ts`
- `dto/create-order.dto.ts`
- `dto/create-cart-order.dto.ts`

`app.module.ts` registers all entities in the TypeORM `entities` array.

Feature flags in `platform_settings` table:
- `ENABLE_MERCHANDISE` — gates the entire merchandise surface
- `ENABLE_PHYSICAL_ORDERS` — gates physical product orders

---

## Global Rule: Soft Delete on Every Table

**Every table created or modified in this task MUST include these three columns:**

```typescript
@Column({ type: 'boolean', default: false })
isDeleted!: boolean;

@Column({ type: 'timestamp', nullable: true })
deletedAt!: Date | null;

@Column({ type: 'uuid', nullable: true })
deletedBy!: string | null;   // userId of who deleted it
```

**Rules:**
- Never use physical `DELETE`. All delete operations set `isDeleted = true`, `deletedAt = new Date()`, `deletedBy = actingUserId`.
- All user-facing and admin queries default to `WHERE is_deleted = false`.
- Admins may optionally pass `?includeDeleted=true` to see soft-deleted records (implement this filter on admin endpoints only).
- Orders remain visible to users even if related product/category/variant is later soft deleted — because order_items store snapshots.
- Existing records default to `isDeleted = false` automatically via the column default.

---

## Part 1 — Catalog Entities

Create all files in `apps/api/src/merchandise/catalog/`.

### 1.1 `product-category.entity.ts`

```
Table: product_categories
```

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | auto-generated |
| name | text | e.g. "Apparel" |
| slug | text unique | e.g. "apparel" |
| description | text nullable | |
| isActive | boolean default true | |
| sortOrder | int default 0 | |
| isDeleted | boolean default false | |
| deletedAt | timestamp nullable | |
| deletedBy | uuid nullable | |
| createdAt | timestamp auto | |
| updatedAt | timestamp auto | |

---

### 1.2 `product.entity.ts`

```
Table: products
```

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| categoryId | uuid | FK → product_categories.id |
| name | text | |
| slug | text unique | |
| description | text nullable | |
| productType | enum | `digital` / `physical` |
| basePrice | decimal(10,2) | base unit price in INR |
| salePrice | decimal(10,2) nullable | discounted price if set |
| previewImageUrl | text nullable | |
| requiredAssetType | text nullable | `hero_avatar`, `story_cover`, `story_pdf`, `universe_cover`, or null |
| isActive | boolean default true | |
| sortOrder | int default 0 | |
| isDeleted | boolean default false | |
| deletedAt | timestamp nullable | |
| deletedBy | uuid nullable | |
| createdAt | timestamp auto | |
| updatedAt | timestamp auto | |

---

### 1.3 `product-attribute.entity.ts`

```
Table: product_attributes
```

Defines an attribute type for a product (e.g. Size, Color, Placement, Binding).

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| productId | uuid | FK → products.id |
| name | text | e.g. "Size" |
| slug | text | e.g. "size" |
| inputType | text default 'select' | `select`, `color`, `radio` |
| isRequired | boolean default true | |
| isActive | boolean default true | |
| sortOrder | int default 0 | |
| isDeleted | boolean default false | |
| deletedAt | timestamp nullable | |
| deletedBy | uuid nullable | |
| createdAt | timestamp auto | |
| updatedAt | timestamp auto | |

---

### 1.4 `product-attribute-value.entity.ts`

```
Table: product_attribute_values
```

Defines valid values for an attribute (e.g. "White", "L", "Hardcover").

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| attributeId | uuid | FK → product_attributes.id |
| value | text | e.g. "white" (machine key) |
| label | text | e.g. "White" (display label) |
| priceModifier | decimal(10,2) default 0 | added to basePrice if selected |
| metadataJson | jsonb nullable | e.g. `{ "hex": "#FFFFFF" }` for colors |
| isActive | boolean default true | |
| sortOrder | int default 0 | |
| isDeleted | boolean default false | |
| deletedAt | timestamp nullable | |
| deletedBy | uuid nullable | |
| createdAt | timestamp auto | |
| updatedAt | timestamp auto | |

---

### 1.5 `product-variant.entity.ts`

```
Table: product_variants
```

A specific purchasable configuration (e.g. "Purple XL T-Shirt").
Variants are **optional** — simple products (e.g. Hero Poster PDF) need no variants.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| productId | uuid | FK → products.id |
| name | text | e.g. "Purple XL" |
| sku | text nullable | |
| priceModifier | decimal(10,2) default 0 | |
| stockQuantity | int nullable | null = unlimited |
| isActive | boolean default true | |
| sortOrder | int default 0 | |
| metadataJson | jsonb nullable | |
| isDeleted | boolean default false | |
| deletedAt | timestamp nullable | |
| deletedBy | uuid nullable | |
| createdAt | timestamp auto | |
| updatedAt | timestamp auto | |

---

### 1.6 `product-variant-attribute-value.entity.ts`

```
Table: product_variant_attribute_values
```

Links a variant to the specific attribute values that define it.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| variantId | uuid | FK → product_variants.id |
| attributeValueId | uuid | FK → product_attribute_values.id |
| isDeleted | boolean default false | |
| deletedAt | timestamp nullable | |
| deletedBy | uuid nullable | |
| createdAt | timestamp auto | |
| updatedAt | timestamp auto | |

---

### 1.7 `merchandise-size-chart.entity.ts`

```
Table: merchandise_size_charts
```

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| productId | uuid | FK → products.id (slug: hero_apparel) |
| sizeLabel | text | e.g. "7-8Y" |
| ageRange | text nullable | e.g. "7–8 Years" |
| chestInches | decimal(5,1) nullable | |
| lengthInches | decimal(5,1) nullable | |
| shoulderInches | decimal(5,1) nullable | |
| chestCm | decimal(5,1) nullable | inches × 2.54 |
| lengthCm | decimal(5,1) nullable | |
| shoulderCm | decimal(5,1) nullable | |
| sortOrder | int default 0 | |
| isActive | boolean default true | |
| isDeleted | boolean default false | |
| deletedAt | timestamp nullable | |
| deletedBy | uuid nullable | |
| createdAt | timestamp auto | |
| updatedAt | timestamp auto | |

---

## Part 2 — Order Entities

Create all files in `apps/api/src/merchandise/orders/`.

### 2.1 `order.entity.ts` (NEW — different from legacy `merchandise_orders`)

```
Table: orders
```

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| userId | uuid | FK → users.id |
| orderNumber | text unique | auto-generated: `HKU-YYYYMMDD-XXXXXX` |
| orderType | enum | `digital` / `physical` / `mixed` |
| status | enum | see statuses below |
| subtotalAmount | decimal(10,2) | sum of item totals before tax/discount/shipping |
| discountAmount | decimal(10,2) default 0 | |
| shippingAmount | decimal(10,2) default 0 | |
| taxAmount | decimal(10,2) default 0 | GST extracted (18/118 × total) |
| totalAmount | decimal(10,2) | final MRP-inclusive total |
| currency | text default 'INR' | |
| shippingName | text nullable | |
| shippingPhone | text nullable | |
| shippingAddressLine1 | text nullable | |
| shippingAddressLine2 | text nullable | |
| shippingCity | text nullable | |
| shippingState | text nullable | |
| shippingPincode | text nullable | |
| shippingCountry | text default 'India' nullable | |
| trackingNumber | text nullable | |
| trackingUrl | text nullable | |
| adminNotes | text nullable | |
| isDeleted | boolean default false | |
| deletedAt | timestamp nullable | |
| deletedBy | uuid nullable | |
| createdAt | timestamp auto | |
| updatedAt | timestamp auto | |

**Order status enum values:**
```typescript
pending_payment, paid, processing, digital_ready, print_file_generated,
sent_to_print, printing, shipped, delivered, cancelled, failed, refunded
```

**Order number generation:** `HKU-${YYYYMMDD}-${6-digit random uppercase alphanum}`.
Generate at order creation. Ensure uniqueness with a retry loop.

---

### 2.2 `order-item.entity.ts`

```
Table: order_items
```

One row per product line in an order. Stores snapshots so historical display is accurate even if catalog changes.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| orderId | uuid | FK → orders.id |
| productId | uuid nullable | live FK (nullable so order survives product deletion) |
| productNameSnapshot | text | copy of product.name at order time |
| productSlugSnapshot | text | copy of product.slug |
| categoryNameSnapshot | text nullable | copy of category.name |
| quantity | int | |
| unitPrice | decimal(10,2) | effective price including variant modifiers, MRP-inclusive |
| totalPrice | decimal(10,2) | unitPrice × quantity |
| designId | uuid nullable | FK → merchandise_designs.id |
| heroId | uuid nullable | |
| storyId | uuid nullable | |
| universeId | uuid nullable | |
| previewUrl | text nullable | |
| printFileUrl | text nullable | |
| metadataJson | jsonb nullable | any extra context |
| isDeleted | boolean default false | |
| deletedAt | timestamp nullable | |
| deletedBy | uuid nullable | |
| createdAt | timestamp auto | |
| updatedAt | timestamp auto | |

---

### 2.3 `order-item-attribute.entity.ts`

```
Table: order_item_attributes
```

One row per attribute selected for an order item (e.g. the "Size" attribute).

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| orderItemId | uuid | FK → order_items.id |
| attributeNameSnapshot | text | copy of attribute.name at order time |
| attributeSlugSnapshot | text | |
| isDeleted | boolean default false | |
| deletedAt | timestamp nullable | |
| deletedBy | uuid nullable | |
| createdAt | timestamp auto | |
| updatedAt | timestamp auto | |

---

### 2.4 `order-item-attribute-value.entity.ts`

```
Table: order_item_attribute_values
```

One row per attribute value selected (e.g. "Purple" for Color).

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| orderItemAttributeId | uuid | FK → order_item_attributes.id |
| attributeValueSnapshot | text | copy of attribute_value.value |
| attributeLabelSnapshot | text | copy of attribute_value.label |
| priceModifierSnapshot | decimal(10,2) | copy of price modifier at order time |
| metadataJson | jsonb nullable | e.g. color hex at order time |
| isDeleted | boolean default false | |
| deletedAt | timestamp nullable | |
| deletedBy | uuid nullable | |
| createdAt | timestamp auto | |
| updatedAt | timestamp auto | |

---

### 2.5 `order-status-history.entity.ts` (NEW — replaces legacy)

```
Table: order_status_history
```

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| orderId | uuid | FK → orders.id |
| oldStatus | text nullable | |
| newStatus | text | |
| note | text nullable | |
| changedByUserId | uuid nullable | |
| isDeleted | boolean default false | |
| deletedAt | timestamp nullable | |
| deletedBy | uuid nullable | |
| createdAt | timestamp auto | |

---

## Part 3 — Payment Entities

Create all files in `apps/api/src/merchandise/payments/`.

### 3.1 `order-payment-summary.entity.ts`

```
Table: order_payment_summaries
```

One row per order. Aggregated payment state.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| orderId | uuid unique | FK → orders.id |
| paymentStatus | enum | `pending`, `paid`, `partially_paid`, `failed`, `refunded`, `partially_refunded` |
| totalPaidAmount | decimal(10,2) default 0 | |
| totalRefundedAmount | decimal(10,2) default 0 | |
| outstandingAmount | decimal(10,2) | totalAmount − totalPaidAmount |
| currency | text default 'INR' | |
| paymentMethodSummary | text nullable | e.g. "UPI" |
| isDeleted | boolean default false | |
| deletedAt | timestamp nullable | |
| deletedBy | uuid nullable | |
| createdAt | timestamp auto | |
| updatedAt | timestamp auto | |

---

### 3.2 `order-payment-detail.entity.ts`

```
Table: order_payment_details
```

One row per payment/refund transaction. Designed to support future Razorpay/Stripe.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| orderId | uuid | FK → orders.id |
| paymentSummaryId | uuid | FK → order_payment_summaries.id |
| transactionType | enum | `payment`, `refund`, `partial_refund`, `adjustment` |
| paymentProvider | text | `manual`, `razorpay`, `stripe` |
| paymentMethod | text | `cash`, `card`, `upi`, `wallet`, `netbanking` |
| transactionId | text nullable | internal reference |
| providerReference | text nullable | Razorpay payment_id, etc. |
| amount | decimal(10,2) | |
| currency | text default 'INR' | |
| status | text | `pending`, `success`, `failed` |
| rawResponseJson | jsonb nullable | full provider response |
| isDeleted | boolean default false | |
| deletedAt | timestamp nullable | |
| deletedBy | uuid nullable | |
| createdAt | timestamp auto | |

---

## Part 4 — Soft Delete on Existing Entities

Add the three soft-delete columns to these **existing** entities (TypeORM synchronize will add them):

- `apps/api/src/merchandise/order.entity.ts` (legacy MerchandiseOrder)
- `apps/api/src/merchandise/merchandise-design.entity.ts`
- `apps/api/src/merchandise/order-status-history.entity.ts` (legacy)

```typescript
@Column({ type: 'boolean', default: false })
isDeleted!: boolean;

@Column({ type: 'timestamp', nullable: true })
deletedAt!: Date | null;

@Column({ type: 'uuid', nullable: true })
deletedBy!: string | null;
```

---

## Part 5 — Seed Service

Create `apps/api/src/merchandise/merchandise-seed.service.ts`.
Implement `OnModuleInit`. All seed logic is **idempotent** — check existence before inserting.

### 5.1 Seed Categories

| name | slug | sortOrder |
|------|------|-----------|
| Books | books | 0 |
| Apparel | apparel | 1 |
| Prints | prints | 2 |
| Stationery | stationery | 3 |

### 5.2 Seed Products

**Books — Printed Storybook**

| Field | Value |
|-------|-------|
| slug | printed_storybook |
| name | Printed Storybook |
| productType | physical |
| basePrice | 799 |
| requiredAssetType | story_pdf |
| description | A professionally printed personalized storybook featuring your child as the hero. |

**Apparel — Hero T-Shirt**

| Field | Value |
|-------|-------|
| slug | hero_apparel |
| name | HeroKids Universe Apparel |
| productType | physical |
| basePrice | 599 |
| requiredAssetType | hero_avatar |
| description | Personalized HeroKids clothing featuring your child's hero avatar and universe branding. |

**Prints — Hero Poster PDF**

| Field | Value |
|-------|-------|
| slug | hero_poster_pdf |
| name | Hero Poster PDF |
| productType | digital |
| basePrice | 199 |
| requiredAssetType | hero_avatar |

**Prints — Story Cover Poster**

| Field | Value |
|-------|-------|
| slug | printed_story_cover_poster |
| name | Printed Story Cover Poster |
| productType | physical |
| basePrice | 549 |
| requiredAssetType | story_cover |

**Prints — Hero Certificate PDF**

| Field | Value |
|-------|-------|
| slug | hero_certificate_pdf |
| name | Hero Certificate PDF |
| productType | digital |
| basePrice | 149 |
| requiredAssetType | hero_avatar |

**Stationery — Sticker Sheet PDF**

| Field | Value |
|-------|-------|
| slug | sticker_sheet_pdf |
| name | Sticker Sheet PDF |
| productType | digital |
| basePrice | 179 |
| requiredAssetType | hero_avatar |

**Stationery — Pencil Labels**

| Field | Value |
|-------|-------|
| slug | pencil_labels |
| name | Pencil Labels |
| productType | digital |
| basePrice | 99 |
| requiredAssetType | hero_avatar |

**Stationery — School Labels**

| Field | Value |
|-------|-------|
| slug | school_labels |
| name | School Labels |
| productType | digital |
| basePrice | 129 |
| requiredAssetType | hero_avatar |

---

### 5.3 Seed Attributes + Values

**Hero Apparel — Size**

| attribute | value | label | sortOrder |
|-----------|-------|-------|-----------|
| size | 2-3Y | 2-3Y | 0 |
| size | 3-4Y | 3-4Y | 1 |
| size | 5-6Y | 5-6Y | 2 |
| size | 7-8Y | 7-8Y | 3 |
| size | 9-10Y | 9-10Y | 4 |
| size | 11-12Y | 11-12Y | 5 |
| size | 13-14Y | 13-14Y | 6 |
| size | 15-16Y | 15-16Y | 7 |
| size | S | S | 8 |
| size | M | M | 9 |
| size | L | L | 10 |
| size | XL | XL | 11 |
| size | XXL | XXL | 12 |

All size values: `priceModifier = 0`, `inputType = select`, `isRequired = true`.

**Hero Apparel — Color**

| value | label | hex | sortOrder |
|-------|-------|-----|-----------|
| white | White | #FFFFFF | 0 |
| black | Black | #111111 | 1 |
| purple | Purple | #7C3AED | 2 |
| sky_blue | Sky Blue | #0EA5E9 | 3 |
| yellow | Yellow | #F59E0B | 4 |

Store hex in `metadataJson: { "hex": "..." }`. All `priceModifier = 0`. `inputType = color`.

**Hero Apparel — Print Placement**

| value | label | sortOrder |
|-------|-------|-----------|
| front_center | Front Center | 0 |
| back_center | Back Center | 1 |
| front_back | Front + Back | 2 |

`inputType = radio`, `priceModifier = 0`.

**Printed Storybook — Binding**

| value | label | priceModifier | sortOrder |
|-------|-------|---------------|-----------|
| softcover | Softcover | 0 | 0 |
| hardcover | Hardcover | 700 | 1 |
| premium_gift | Premium Gift Edition | 1700 | 2 |

`inputType = radio`, `isRequired = true`.

**Printed Storybook — Paper Quality** (seeded but no values — admin can add later)

| attribute | slug | inputType |
|-----------|------|-----------|
| Paper Quality | paper_quality | select |

---

### 5.4 Seed Size Chart (for Hero Apparel product)

Kids sizes:

| sizeLabel | ageRange | chestInches | lengthInches | shoulderInches | sortOrder |
|-----------|----------|-------------|-------------|----------------|-----------|
| 2-3Y | 2–3 Years | 22.0 | 15.5 | 10.5 | 0 |
| 3-4Y | 3–4 Years | 24.0 | 16.5 | 11.0 | 1 |
| 5-6Y | 5–6 Years | 26.0 | 18.0 | 12.0 | 2 |
| 7-8Y | 7–8 Years | 28.0 | 19.5 | 12.5 | 3 |
| 9-10Y | 9–10 Years | 30.0 | 21.0 | 13.5 | 4 |
| 11-12Y | 11–12 Years | 32.0 | 22.5 | 14.0 | 5 |
| 13-14Y | 13–14 Years | 34.0 | 24.0 | 15.0 | 6 |
| 15-16Y | 15–16 Years | 36.0 | 25.0 | 15.5 | 7 |

Adult sizes:

| sizeLabel | ageRange | chestInches | lengthInches | shoulderInches | sortOrder |
|-----------|----------|-------------|-------------|----------------|-----------|
| S | Adult | 38.0 | 27.0 | 16.5 | 8 |
| M | Adult | 40.0 | 28.0 | 17.5 | 9 |
| L | Adult | 42.0 | 29.0 | 18.5 | 10 |
| XL | Adult | 44.0 | 30.0 | 19.5 | 11 |
| XXL | Adult | 46.0 | 31.0 | 20.5 | 12 |

Compute `*Cm` = `inches × 2.54` rounded to 1 decimal place.

---

## Part 6 — Service Layer

### 6.1 `catalog.service.ts`

Create `apps/api/src/merchandise/catalog/catalog.service.ts`.

Methods:

```typescript
// User-facing (always exclude isDeleted = true)
listCategories(): Promise<ProductCategory[]>
listProducts(categorySlug?: string): Promise<Product[]>
getProductBySlug(slug: string): Promise<Product & { attributes, sizeChart }>
getProductAttributes(productId: string): Promise<ProductAttribute[]>
getProductAttributeValues(attributeId: string): Promise<ProductAttributeValue[]>
getSizeChart(productId: string): Promise<MerchandiseSizeChart[]>

// Admin (add { includeDeleted?: boolean } option)
adminListCategories(opts?): Promise<ProductCategory[]>
adminListProducts(categoryId?, opts?): Promise<Product[]>
createCategory(dto): Promise<ProductCategory>
updateCategory(id, dto): Promise<ProductCategory>
softDeleteCategory(id, deletedBy): Promise<void>
createProduct(dto): Promise<Product>
updateProduct(id, dto): Promise<Product>
softDeleteProduct(id, deletedBy): Promise<void>
createAttribute(dto): Promise<ProductAttribute>
updateAttribute(id, dto): Promise<ProductAttribute>
softDeleteAttribute(id, deletedBy): Promise<void>
createAttributeValue(dto): Promise<ProductAttributeValue>
updateAttributeValue(id, dto): Promise<ProductAttributeValue>
softDeleteAttributeValue(id, deletedBy): Promise<void>
upsertSizeChart(productId, entries): Promise<void>
```

### 6.2 `order-v2.service.ts`

Create `apps/api/src/merchandise/orders/order-v2.service.ts`.

The "v2" prefix avoids collision with the existing `MerchandiseService`.

Methods:

```typescript
// Create order — transactional
createOrder(userId: string, dto: CreateOrderV2Dto): Promise<Order>
// dto includes:
//   items: Array<{
//     productSlug: string;
//     quantity: number;
//     designId?: string;
//     heroId?: string; storyId?: string; universeId?: string;
//     selectedAttributes: Record<string, string>; // { "size": "7-8Y", "color": "purple", "placement": "front_center" }
//   }>
//   shippingName?, shippingPhone?, shippingAddressLine1? ... (required if any physical item)
//   paymentMethod: 'cash' | 'card' | 'upi'
//   customerName?, customerEmail?, customerPhone?

// List user's orders
listMyOrders(userId: string): Promise<OrderSummary[]>

// Get single order (user must own it)
getMyOrder(userId: string, orderId: string): Promise<OrderDetail>

// Admin: list all orders
adminListOrders(filters?): Promise<OrderSummary[]>

// Admin: get any order
adminGetOrder(orderId: string): Promise<OrderDetail>

// Admin: update order status
adminUpdateStatus(orderId: string, newStatus: string, note?: string, adminId?: string): Promise<void>

// Admin: soft delete order (extreme edge case)
adminSoftDeleteOrder(orderId: string, adminId: string): Promise<void>
```

**createOrder logic (run in a TypeORM transaction):**

1. Validate all product slugs exist and are not soft-deleted.
2. For each item with `selectedAttributes`, look up `ProductAttributeValue` records by (productId + attribute.slug + value key). Validate they exist and are not soft-deleted.
3. Compute `unitPrice = product.basePrice + sum(attributeValue.priceModifier)`. Use `salePrice` if set and lower.
4. Build `order_items` rows with snapshots.
5. Build `order_item_attributes` + `order_item_attribute_values` rows.
6. Compute `subtotalAmount`, `taxAmount` (18/118 extraction), `totalAmount`.
7. Create `order_payment_summary` with `paymentStatus = paid` and `totalPaidAmount = totalAmount` (mock — treat all orders as immediately paid for now).
8. Create `order_payment_details` with `transactionType = payment`, `paymentProvider = manual`, `status = success`.
9. Create `order_status_history` entry: `oldStatus = null`, `newStatus = paid`.
10. Generate unique `orderNumber`.
11. Set `order.status = paid`, `order.orderType` based on whether all items are digital / physical / mixed.

**OrderSummary serialization:**
```typescript
{
  id, orderNumber, status, orderType, totalAmount, currency,
  itemCount, createdAt,
  items: [{ productNameSnapshot, categoryNameSnapshot, quantity, unitPrice, totalPrice, previewUrl, attributeSummary: "7-8Y · Purple · Front Center" }]
}
```

**OrderDetail serialization:** Full order + all items + all attribute values + payment summary + status history.

---

## Part 7 — Controller Endpoints

### 7.1 User-facing — `merchandise-catalog.controller.ts`

```
@Controller('merchandise/catalog')
```

All endpoints `@Public()`.

```
GET /merchandise/catalog/categories           → listCategories()
GET /merchandise/catalog/products             → listProducts(categorySlug?)
GET /merchandise/catalog/products/:slug       → getProductBySlug(slug) — full detail including attributes + size chart
GET /merchandise/catalog/size-chart/:productId → getSizeChart(productId)
```

### 7.2 User order endpoints — add to existing `merchandise.controller.ts` OR create `order-v2.controller.ts`

```
POST /merchandise/v2/orders      → createOrder (auth required)
GET  /merchandise/v2/orders      → listMyOrders (auth required)
GET  /merchandise/v2/orders/:id  → getMyOrder (auth required)
```

### 7.3 Admin — `admin-catalog.controller.ts`

```
@Controller('admin/catalog')
@Roles('admin')
```

```
GET    /admin/catalog/categories                          → adminListCategories(?includeDeleted)
POST   /admin/catalog/categories                          → createCategory
PATCH  /admin/catalog/categories/:id                      → updateCategory
DELETE /admin/catalog/categories/:id                      → softDeleteCategory

GET    /admin/catalog/products                            → adminListProducts(?categoryId, ?includeDeleted)
POST   /admin/catalog/products                            → createProduct
PATCH  /admin/catalog/products/:id                        → updateProduct
DELETE /admin/catalog/products/:id                        → softDeleteProduct

GET    /admin/catalog/products/:productId/attributes      → listAttributes
POST   /admin/catalog/products/:productId/attributes      → createAttribute
PATCH  /admin/catalog/attributes/:id                      → updateAttribute
DELETE /admin/catalog/attributes/:id                      → softDeleteAttribute

GET    /admin/catalog/attributes/:attributeId/values      → listAttributeValues
POST   /admin/catalog/attributes/:attributeId/values      → createAttributeValue
PATCH  /admin/catalog/attribute-values/:id                → updateAttributeValue
DELETE /admin/catalog/attribute-values/:id                → softDeleteAttributeValue

GET    /admin/catalog/products/:productId/size-chart      → getSizeChart
POST   /admin/catalog/products/:productId/size-chart      → upsertSizeChart (body: array of rows)
```

### 7.4 Admin order endpoints — `admin-orders.controller.ts`

```
@Controller('admin/orders')
@Roles('admin')
```

```
GET   /admin/orders                     → adminListOrders(?status, ?userId, ?includeDeleted)
GET   /admin/orders/:id                 → adminGetOrder
PATCH /admin/orders/:id/status          → adminUpdateStatus (body: { status, note })
GET   /admin/orders/:id/payment         → get payment summary + details
```

---

## Part 8 — Module + App Registration

### 8.1 Create new NestJS modules

Create:
- `apps/api/src/merchandise/catalog/catalog.module.ts`
- `apps/api/src/merchandise/orders/orders-v2.module.ts`

Or alternatively, register all new entities and providers within the existing `MerchandiseModule`. Either approach is fine — just ensure all entities are registered via `TypeOrmModule.forFeature([...])`.

### 8.2 Register all new entities in `app.module.ts`

Add to the `entities` array:
```
ProductCategory, Product, ProductAttribute, ProductAttributeValue,
ProductVariant, ProductVariantAttributeValue, MerchandiseSizeChart,
Order, OrderItem, OrderItemAttribute, OrderItemAttributeValue,
OrderStatusHistory (new), OrderPaymentSummary, OrderPaymentDetail
```

Import each entity file at the top.

---

## Part 9 — Query Safety (soft delete filter)

For every repository `.find()` or `.createQueryBuilder()` call in the new services, always include:

```typescript
// Repository API
this.repo.find({ where: { isDeleted: false } });

// QueryBuilder API
qb.where('entity.isDeleted = :isDeleted', { isDeleted: false });
```

For admin endpoints that accept `?includeDeleted=true`, skip this filter.

---

## Summary Checklist

**Catalog entities:**
- [ ] `ProductCategory` entity + table `product_categories`
- [ ] `Product` entity + table `products`
- [ ] `ProductAttribute` entity + table `product_attributes`
- [ ] `ProductAttributeValue` entity + table `product_attribute_values`
- [ ] `ProductVariant` entity + table `product_variants`
- [ ] `ProductVariantAttributeValue` entity + table `product_variant_attribute_values`
- [ ] `MerchandiseSizeChart` entity + table `merchandise_size_charts`

**Order entities (new):**
- [ ] `Order` entity + table `orders`
- [ ] `OrderItem` entity + table `order_items`
- [ ] `OrderItemAttribute` entity + table `order_item_attributes`
- [ ] `OrderItemAttributeValue` entity + table `order_item_attribute_values`
- [ ] `OrderStatusHistory` (new) entity + table `order_status_history` (new table, separate from legacy)
- [ ] `OrderPaymentSummary` entity + table `order_payment_summaries`
- [ ] `OrderPaymentDetail` entity + table `order_payment_details`

**Existing entities updated (soft delete columns added):**
- [ ] `MerchandiseOrder` (legacy) — add isDeleted, deletedAt, deletedBy
- [ ] `MerchandiseDesign` — add isDeleted, deletedAt, deletedBy
- [ ] Legacy `OrderStatusHistory` — add isDeleted, deletedAt, deletedBy

**Services:**
- [ ] `CatalogService` — user + admin catalog operations
- [ ] `OrderV2Service` — order creation, listing, admin management
- [ ] `MerchandiseSeedService` — idempotent seeder on startup

**Seeded data:**
- [ ] 4 categories (Books, Apparel, Prints, Stationery)
- [ ] 8 products with correct category links
- [ ] T-shirt attributes: Size (13 values), Color (5 values), Placement (3 values)
- [ ] Storybook attributes: Binding (3 values), Paper Quality (0 values, admin adds later)
- [ ] Size chart for Hero Apparel (13 rows, kids + adult)

**Endpoints:**
- [ ] 4 public catalog endpoints
- [ ] 3 user order v2 endpoints
- [ ] Full admin catalog CRUD (categories, products, attributes, attribute values, size charts)
- [ ] Admin order endpoints (list, detail, status update, payment view)

**Quality:**
- [ ] Every new/modified table has `isDeleted`, `deletedAt`, `deletedBy`
- [ ] All soft deletes set isDeleted=true rather than DELETE
- [ ] All user-facing queries filter `isDeleted = false`
- [ ] Order items store snapshots — not live foreign key lookups
- [ ] `ORDER BY sort_order ASC` on all list queries
- [ ] TypeScript compiles without errors (`pnpm --filter api build` or equivalent)

---

## Do NOT Do

- Do NOT integrate Razorpay (architecture must support it, but do NOT call Razorpay APIs)
- Do NOT add AI image generation
- Do NOT create physical print partner integration
- Do NOT modify the story generation flow
- Do NOT delete or break the existing `MerchandiseService` / `MerchandiseController` / `merchandise.catalog.ts` — legacy endpoints must keep working
- Do NOT use `@Column({ nullable: false })` on soft-delete columns — they must be nullable or have defaults
- Do NOT hardcode product data anywhere except the seed service
