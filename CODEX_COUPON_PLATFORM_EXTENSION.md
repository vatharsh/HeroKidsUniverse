# CODEX TASK: Extend Coupon System — Add Platform Coupons

## One-Liner Start Prompt
```
Read CODEX_COUPON_PLATFORM_EXTENSION.md and implement every step exactly as described.
```

---

## Context

This project is a NestJS + TypeORM 0.3 + PostgreSQL monorepo at `apps/api/`.
TypeORM has `synchronize: true` in dev — schema changes apply automatically when entity fields change.

The existing coupon system only supports influencer coupons.
We need to extend it to also support **platform coupons** (company-funded discounts, no commission).

**CRITICAL**: Do NOT redesign or replace anything. Extend only. The existing influencer coupon flow must continue working exactly as it does today.

---

## AUDIT FINDINGS — EXISTING ARCHITECTURE

### Coupon Table: `influencer_coupon_codes`
Entity: `apps/api/src/influencers/influencer-coupon-code.entity.ts`

Current fields:
- `id` (uuid PK)
- `influencerId` (uuid, NOT nullable, FK → influencers)
- `influencer` (ManyToOne relation, `nullable: false`)
- `code` (text, unique)
- `discountType` (enum: `percentage | fixed_amount`)
- `discountValue` (decimal 10,2)
- `maxDiscountAmount` (decimal 10,2, nullable)
- `isActive` (boolean, default: true)
- `startsAt` (timestamp, nullable)
- `expiresAt` (timestamp, nullable)
- `usageLimit` (int, nullable)
- `usageCount` (int, default: 0)
- `minimumOrderAmount` (decimal 10,2, nullable)
- `appliesToProductIds` (jsonb, nullable)
- `appliesToCategoryIds` (jsonb, nullable)
- `createdAt`, `updatedAt`
- `isDeleted`, `deletedAt`, `deletedBy` (from SoftDeleteColumns base class)

### Order Table: `orders`
Entity: `apps/api/src/merchandise/orders/order.entity.ts`

Current coupon snapshot fields:
- `couponCode` (text, nullable)
- `couponCodeId` (uuid, nullable)
- `influencerId` (uuid, nullable)
- `couponDiscountType` (text, nullable)
- `couponDiscountValue` (decimal 10,2, nullable)
- `couponDiscountAmount` (decimal 10,2, nullable)
- `influencerCommissionRate` (decimal 5,2, nullable)
- `influencerCommissionAmount` (decimal 10,2, nullable)

**Missing field**: `couponType` — needs to be added.

### Coupon Validation
Service: `apps/api/src/influencers/influencers.service.ts`
Method: `validateCoupon(code: string, context?)` (around line 110)

Current `CouponValidationResult` interface:
```typescript
interface CouponValidationResult {
  valid: boolean;
  errorMessage?: string;
  couponCodeId?: string;
  influencerId?: string;
  discountType?: CouponDiscountType;
  discountValue?: number;
  maxDiscountAmount?: number | null;
  minimumOrderAmount?: number | null;
  appliesToProductIds?: string[] | null;
  appliesToCategoryIds?: string[] | null;
  code?: string;
  warningMessage?: string;
}
```

Current validation steps (in order):
1. Trim and uppercase code
2. Find coupon by code (ILike, isDeleted: false)
3. Check `isActive`
4. Check `startsAt` / `expiresAt`
5. Check `usageLimit`
6. Check `minimumOrderAmount`
7. Check `appliesToProductIds`
8. Check `appliesToCategoryIds`
9. **Look up influencer by `coupon.influencerId` and check influencer is active** ← must be skipped for platform coupons

### Order Creation
Service: `apps/api/src/merchandise/orders/order-v2.service.ts`
Method: `createOrder()` (around line 56)

Coupon flow within transaction (lines ~139–183):
```typescript
const couponResult = dto.couponCode
  ? await this.influencersService.validateCoupon(dto.couponCode, { ... })
  : null;

// ...discount calculation...

// Order record stores (lines ~176–183):
couponCode:               couponResult?.valid ? couponResult.code ?? null : null,
couponCodeId:             couponResult?.valid ? couponResult.couponCodeId ?? null : null,
influencerId:             couponResult?.valid ? couponResult.influencerId ?? null : null,
couponDiscountType:       couponResult?.valid ? couponResult.discountType ?? null : null,
couponDiscountValue:      couponResult?.valid ? couponResult.discountValue ?? null : null,
couponDiscountAmount:     couponResult?.valid ? discountAmount : null,
influencerCommissionRate: null,   // filled after commission creation
influencerCommissionAmount: null, // filled after commission creation
```

Commission creation gate (line ~280):
```typescript
if (couponResult?.valid && order.couponCodeId && order.influencerId) {
  await this.influencersService.createCommissionForOrder({ ... });
  // ...update order commission fields...
}
```

### Admin Coupon Endpoints (current)
Controller: `apps/api/src/influencers/admin-influencers.controller.ts`

- `GET /admin/influencers/:id/coupons` — list influencer's coupons
- `POST /admin/influencers/:id/coupons` — create coupon for influencer
- `PATCH /admin/influencers/:id/coupons/:cid` — update coupon

**No global coupon management endpoint exists yet.**

### Public Coupon Validation Endpoint
Controller: `apps/api/src/influencers/influencer-public.controller.ts`

- `POST /influencers/coupon/validate` — validates any coupon code (used by checkout UI)

---

## IMPLEMENTATION STEPS

Implement ALL steps in order. Do not skip any.

---

### STEP 1 — Add `CouponType` enum to entity file

File: `apps/api/src/influencers/influencer-coupon-code.entity.ts`

Add the enum at the top of the file (alongside the existing `CouponDiscountType` enum):

```typescript
export enum CouponType {
  Influencer = 'influencer',
  Platform = 'platform',
}
```

---

### STEP 2 — Extend `InfluencerCouponCode` entity

File: `apps/api/src/influencers/influencer-coupon-code.entity.ts`

Make two changes:

**2a. Make `influencerId` nullable** (required for platform coupons which have no influencer):

Change:
```typescript
@Index()
@Column({ type: 'uuid' })
influencerId!: string;

@ManyToOne(() => Influencer, (influencer) => influencer.couponCodes, { nullable: false, onDelete: 'NO ACTION' })
@JoinColumn({ name: 'influencerId' })
influencer!: Influencer;
```

To:
```typescript
@Index()
@Column({ type: 'uuid', nullable: true })
influencerId!: string | null;

@ManyToOne(() => Influencer, (influencer) => influencer.couponCodes, { nullable: true, onDelete: 'NO ACTION' })
@JoinColumn({ name: 'influencerId' })
influencer!: Influencer | null;
```

**2b. Add `couponType` column** (with default `'influencer'` so existing rows get the right value automatically via TypeORM synchronize):

Add after the `influencer` relation:
```typescript
@Column({ type: 'enum', enum: CouponType, default: CouponType.Influencer })
couponType!: CouponType;
```

---

### STEP 3 — Add `couponType` snapshot field to Order entity

File: `apps/api/src/merchandise/orders/order.entity.ts`

Add after the `influencerId` column:
```typescript
@Column({ type: 'text', nullable: true })
couponType!: string | null;
```

---

### STEP 4 — Update `validateCoupon()` in InfluencersService

File: `apps/api/src/influencers/influencers.service.ts`

**4a. Update `CouponValidationResult` interface** — add `couponType` field:

Find the interface (look for `interface CouponValidationResult`) and add:
```typescript
couponType?: CouponType;
```

**4b. Update the validation logic** — skip the influencer-active check for platform coupons:

The current code (around line 147) does something like:
```typescript
const influencer = await this.influencersRepo.findOne({
  where: { id: coupon.influencerId, isDeleted: false },
});
if (!influencer || influencer.status !== InfluencerStatus.Active) {
  return { valid: false, errorMessage: '...' };
}
```

Wrap that block in a condition so it only runs for influencer coupons:
```typescript
if (coupon.couponType !== CouponType.Platform) {
  if (!coupon.influencerId) {
    return { valid: false, errorMessage: 'Invalid coupon configuration.' };
  }
  const influencer = await this.influencersRepo.findOne({
    where: { id: coupon.influencerId, isDeleted: false },
  });
  if (!influencer || influencer.status !== InfluencerStatus.Active) {
    return { valid: false, errorMessage: 'This coupon is no longer available.' };
  }
}
```

**4c. Include `couponType` in the returned result object**:

In the success return, add:
```typescript
couponType: coupon.couponType,
```

Also import `CouponType` at the top of the file from `./influencer-coupon-code.entity`.

---

### STEP 5 — Update `order-v2.service.ts` to handle platform coupons

File: `apps/api/src/merchandise/orders/order-v2.service.ts`

**5a. Store `couponType` in the order record** during order creation.

Find the order creation block (around line 176) where coupon fields are stored, and add:
```typescript
couponType: couponResult?.valid ? (couponResult.couponType ?? null) : null,
```

**5b. Change the commission creation gate** from:
```typescript
if (couponResult?.valid && order.couponCodeId && order.influencerId) {
```

To:
```typescript
if (
  couponResult?.valid &&
  order.couponCodeId &&
  order.influencerId &&
  couponResult.couponType !== 'platform'
) {
```

This ensures platform coupons never trigger commission creation.

Import `CouponType` if needed: `import { CouponType } from '../../influencers/influencer-coupon-code.entity'`
Or simply compare against the string `'platform'` to avoid the import.

---

### STEP 6 — Add platform coupon creation to AdminService

File: `apps/api/src/admin/admin.service.ts`

Ensure `InfluencerCouponCode`, `CouponType`, and `CouponDiscountType` are imported.

Add these methods to the AdminService class:

```typescript
async createPlatformCoupon(dto: {
  code: string;
  discountType: CouponDiscountType;
  discountValue: number;
  maxDiscountAmount?: number | null;
  usageLimit?: number | null;
  minimumOrderAmount?: number | null;
  startsAt?: string | null;
  expiresAt?: string | null;
  isActive?: boolean;
  appliesToProductIds?: string[] | null;
  appliesToCategoryIds?: string[] | null;
}) {
  const existing = await this.dataSource
    .getRepository(InfluencerCouponCode)
    .findOne({ where: { code: ILike(dto.code.trim().toUpperCase()), isDeleted: false } });
  if (existing) {
    throw new ConflictException(`Coupon code "${dto.code.toUpperCase()}" already exists`);
  }
  return this.dataSource.getRepository(InfluencerCouponCode).save(
    this.dataSource.getRepository(InfluencerCouponCode).create({
      code: dto.code.trim().toUpperCase(),
      couponType: CouponType.Platform,
      influencerId: null,
      discountType: dto.discountType,
      discountValue: dto.discountValue,
      maxDiscountAmount: dto.maxDiscountAmount ?? null,
      usageLimit: dto.usageLimit ?? null,
      minimumOrderAmount: dto.minimumOrderAmount ?? null,
      startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      isActive: dto.isActive ?? true,
      appliesToProductIds: dto.appliesToProductIds ?? null,
      appliesToCategoryIds: dto.appliesToCategoryIds ?? null,
    }),
  );
}

async updateCoupon(
  id: string,
  dto: Partial<{
    code: string;
    discountType: CouponDiscountType;
    discountValue: number;
    maxDiscountAmount: number | null;
    usageLimit: number | null;
    minimumOrderAmount: number | null;
    startsAt: string | null;
    expiresAt: string | null;
    isActive: boolean;
  }>,
) {
  const coupon = await this.dataSource
    .getRepository(InfluencerCouponCode)
    .findOneOrFail({ where: { id, isDeleted: false } });
  if (dto.code) coupon.code = dto.code.trim().toUpperCase();
  if (dto.discountType !== undefined) coupon.discountType = dto.discountType;
  if (dto.discountValue !== undefined) coupon.discountValue = dto.discountValue;
  if ('maxDiscountAmount' in dto) coupon.maxDiscountAmount = dto.maxDiscountAmount ?? null;
  if ('usageLimit' in dto) coupon.usageLimit = dto.usageLimit ?? null;
  if ('minimumOrderAmount' in dto) coupon.minimumOrderAmount = dto.minimumOrderAmount ?? null;
  if ('startsAt' in dto) coupon.startsAt = dto.startsAt ? new Date(dto.startsAt) : null;
  if ('expiresAt' in dto) coupon.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
  if (dto.isActive !== undefined) coupon.isActive = dto.isActive;
  return this.dataSource.getRepository(InfluencerCouponCode).save(coupon);
}

async listAllCoupons(params: {
  page?: number;
  limit?: number;
  couponType?: string;
  isActive?: boolean;
  search?: string;
}) {
  const page = params.page ?? 1;
  const limit = params.limit ?? 50;
  const repo = this.dataSource.getRepository(InfluencerCouponCode);
  const qb = repo
    .createQueryBuilder('c')
    .where('c.isDeleted = false')
    .leftJoinAndSelect('c.influencer', 'influencer')
    .orderBy('c.createdAt', 'DESC')
    .skip((page - 1) * limit)
    .take(limit);

  if (params.couponType) {
    qb.andWhere('c.couponType = :couponType', { couponType: params.couponType });
  }
  if (params.isActive !== undefined) {
    qb.andWhere('c.isActive = :isActive', { isActive: params.isActive });
  }
  if (params.search) {
    qb.andWhere('c.code ILIKE :search', { search: `%${params.search}%` });
  }

  const [items, total] = await qb.getManyAndCount();
  return { items, total, page, limit };
}
```

**Required imports** at top of admin.service.ts (add if missing):
```typescript
import { ConflictException } from '@nestjs/common';
import { ILike } from 'typeorm';
import { InfluencerCouponCode, CouponType, CouponDiscountType } from '../influencers/influencer-coupon-code.entity';
```

---

### STEP 7 — Add admin controller endpoints for platform coupons

File: `apps/api/src/admin/admin.controller.ts`

Add these three endpoints anywhere after the existing influencer endpoints (import `Query` from `@nestjs/common` if not already imported):

```typescript
@Get('coupons')
listAllCoupons(
  @Query('page') page?: string,
  @Query('limit') limit?: string,
  @Query('couponType') couponType?: string,
  @Query('isActive') isActive?: string,
  @Query('search') search?: string,
) {
  return this.adminService.listAllCoupons({
    page: page ? Number(page) : 1,
    limit: limit ? Number(limit) : 50,
    couponType,
    isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    search,
  });
}

@Post('coupons/platform')
createPlatformCoupon(@Body() body: any) {
  return this.adminService.createPlatformCoupon(body);
}

@Patch('coupons/:id')
updateCoupon(@Param('id') id: string, @Body() body: any) {
  return this.adminService.updateCoupon(id, body);
}
```

Import `Param` from `@nestjs/common` if not already imported.

---

### STEP 8 — Verify the public validation endpoint still works for platform coupons

File: `apps/api/src/influencers/influencer-public.controller.ts`

This endpoint calls `influencersService.validateCoupon(body.code)` with no context.
After Step 4, this will work correctly for both coupon types — no change needed.
Just verify the endpoint exists and calls `validateCoupon`.

---

### STEP 9 — Verify `createCouponCode()` in InfluencersService still works for influencer coupons

File: `apps/api/src/influencers/influencers.service.ts`

Find the `createCouponCode(influencerId, dto)` method (called from admin when creating coupons for a specific influencer).
It should set `influencerId` and can optionally set `couponType: CouponType.Influencer` explicitly (though it will default correctly).

Add `couponType: CouponType.Influencer` to the entity creation in `createCouponCode()` if it's not already there, to make the type explicit.

---

## TESTING CHECKLIST

After implementation, verify with these manual curl tests:

### Test 1: Create platform coupon
```bash
curl -X POST http://localhost:3000/api/admin/coupons/platform \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "WELCOME10",
    "discountType": "percentage",
    "discountValue": 10,
    "isActive": true
  }'
```
Expected: 201 with coupon record, `couponType: "platform"`, `influencerId: null`

### Test 2: Validate platform coupon
```bash
curl -X POST http://localhost:3000/api/influencers/coupon/validate \
  -H "Content-Type: application/json" \
  -d '{"code": "WELCOME10"}'
```
Expected: `{ valid: true, couponType: "platform" }` — no influencer fields

### Test 3: Place order with platform coupon
```bash
curl -X POST http://localhost:3000/api/orders/v2 \
  -H "Authorization: Bearer USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "couponCode": "WELCOME10",
    "items": [...],
    "paymentMethod": "upi"
  }'
```
Expected: Order with discount applied, `couponType: "platform"`, `influencerId: null`, `influencerCommissionRate: null`, `influencerCommissionAmount: null`
No `influencer_commissions` record should be created.
No wallet update should occur.

### Test 4: Existing influencer coupon still works
Place an order with an existing influencer coupon code.
Expected: Commission created, wallet updated, everything as before.

### Test 5: List all coupons
```bash
curl "http://localhost:3000/api/admin/coupons?couponType=platform" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```
Expected: Returns only platform coupons.

```bash
curl "http://localhost:3000/api/admin/coupons?couponType=influencer" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```
Expected: Returns only influencer coupons.

---

## WHAT NOT TO DO

- Do NOT delete or rename the `influencer_coupon_codes` table
- Do NOT create a separate `platform_coupons` table
- Do NOT modify the commission calculation logic (`calculateCommissionRate`, `createCommissionForOrder`)
- Do NOT touch `InfluencerWallet`, `InfluencerCommission`, or payout flows
- Do NOT change the `POST /admin/influencers/:id/coupons` endpoint — it still creates influencer coupons under a specific influencer
- Do NOT add migrations manually — TypeORM `synchronize: true` handles schema changes automatically in dev

---

## DELIVERABLES

After completing all steps, provide:
1. Summary of each file changed and what was changed
2. Confirmation that all 5 tests above pass
3. Confirmation that the TypeScript compilation passes (`cd apps/api && npm run build`)
