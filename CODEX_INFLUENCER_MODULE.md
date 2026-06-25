# Backend Task: HeroKids Universe — Influencer/Affiliate Module

## Context

NestJS + TypeORM + PostgreSQL monorepo at `apps/api/`. TypeORM `synchronize: true` — no migrations, just add/update entities. All API responses wrapped via `TransformInterceptor` as `{ success: true, data: T, timestamp }`.

**Read these files before writing any code:**
- `apps/api/src/influencers/influencer.entity.ts` — existing Influencer entity (extend, do NOT replace)
- `apps/api/src/influencers/influencer-referral.entity.ts` — existing referral (keep for backward compat)
- `apps/api/src/influencers/influencers.module.ts` — existing module (extend)
- `apps/api/src/merchandise/soft-delete-columns.ts` — `SoftDeleteColumns` abstract class (all new entities must extend this)
- `apps/api/src/merchandise/orders/order.entity.ts` — `Order` entity (add coupon fields)
- `apps/api/src/merchandise/orders/dto/create-order-v2.dto.ts` — CreateOrderV2Dto (add couponCode)
- `apps/api/src/merchandise/orders/order-v2.service.ts` — order creation service (add coupon logic)
- `apps/api/src/upload/upload.service.ts` — R2/local upload service (add `uploadPaymentProof` method)
- `apps/api/src/admin/admin.controller.ts` — admin controller pattern (`@Controller('admin')` + `@Roles('admin')`)
- `apps/api/src/app.module.ts` — register new entities/modules here

---

## Audit — What Already Exists (DO NOT recreate)

- `apps/api/src/influencers/influencer.entity.ts`: table `influencers`, columns: id, name, code, email, platform, commissionPct, active, createdAt, updatedAt
- `apps/api/src/influencers/influencer-referral.entity.ts`: table `influencer_referrals`, basic referral rows
- `apps/api/src/influencers/influencers.module.ts`: bare module, no service/controller yet
- Admin endpoints `GET/POST/PATCH /admin/influencers` in `apps/api/src/admin/admin.service.ts` and `admin.controller.ts`
- Order entity has `discountAmount` column already; checkout hardcodes it to 0

---

## Task: Implement Missing Backend Pieces

---

## STEP 1 — Extend existing Influencer entity

**File:** `apps/api/src/influencers/influencer.entity.ts`

Add to existing `Influencer` class (do not remove existing columns):

```
@Column({ type: 'text', nullable: true })
phone: string | null;

@Column({ type: 'text', nullable: true })
socialHandle: string | null;

@Column({ type: 'enum', enum: InfluencerStatus, default: InfluencerStatus.Active })
status: InfluencerStatus;

@Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
maxCommissionRate: number | null;

@Column({ type: 'text', nullable: true })
paymentMethod: string | null;

@Column({ type: 'jsonb', nullable: true })
paymentDetailsJson: Record<string, unknown> | null;

@Column({ type: 'text', nullable: true })
notes: string | null;

// Keep existing: name, code, email, platform, commissionPct, active
// Also extend SoftDeleteColumns — add isDeleted, deletedAt, deletedBy via:
```

Change `export class Influencer {` to `export class Influencer extends SoftDeleteColumns {` and import `SoftDeleteColumns` from `'../merchandise/soft-delete-columns'`.

Add enum:
```typescript
export enum InfluencerStatus {
  Active = 'active',
  Inactive = 'inactive',
  Blocked = 'blocked',
}
```

Keep existing `active` boolean column as-is for backward compat.

---

## STEP 2 — New Entity: InfluencerCouponCode

**File:** `apps/api/src/influencers/influencer-coupon-code.entity.ts`

Table: `influencer_coupon_codes`

```typescript
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { SoftDeleteColumns } from '../merchandise/soft-delete-columns';

export enum CouponDiscountType {
  Percentage = 'percentage',
  FixedAmount = 'fixed_amount',
}

@Entity('influencer_coupon_codes')
export class InfluencerCouponCode extends SoftDeleteColumns {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) influencerId: string;
  @Column({ type: 'text', unique: true }) code: string;           // uppercase unique, e.g. MOM20
  @Column({ type: 'enum', enum: CouponDiscountType }) discountType: CouponDiscountType;
  @Column({ type: 'decimal', precision: 10, scale: 2 }) discountValue: number;  // 10 = 10% or ₹10
  @Column({ type: 'boolean', default: true }) isActive: boolean;
  @Column({ type: 'timestamp', nullable: true }) startsAt: Date | null;
  @Column({ type: 'timestamp', nullable: true }) expiresAt: Date | null;
  @Column({ type: 'int', nullable: true }) usageLimit: number | null;
  @Column({ type: 'int', default: 0 }) usageCount: number;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
```

---

## STEP 3 — New Entity: InfluencerCommissionRule

**File:** `apps/api/src/influencers/influencer-commission-rule.entity.ts`

Table: `influencer_commission_rules`

```typescript
@Entity('influencer_commission_rules')
export class InfluencerCommissionRule extends SoftDeleteColumns {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid', nullable: true }) influencerId: string | null;  // null = global rule
  @Column({ type: 'int', default: 0 }) minSuccessfulOrders: number;
  @Column({ type: 'decimal', precision: 5, scale: 2 }) commissionRate: number;  // e.g. 10, 12, 15, 20
  @Column({ type: 'boolean', default: true }) isActive: boolean;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
```

Seed global defaults when none exist (in service init or a seed method):
- minSuccessfulOrders=0, commissionRate=10
- minSuccessfulOrders=100, commissionRate=12
- minSuccessfulOrders=200, commissionRate=15
- minSuccessfulOrders=500, commissionRate=20

---

## STEP 4 — New Entity: InfluencerCommission

**File:** `apps/api/src/influencers/influencer-commission.entity.ts`

Table: `influencer_commissions`

```typescript
export enum CommissionStatus {
  Pending = 'pending',
  Approved = 'approved',
  Paid = 'paid',
  Cancelled = 'cancelled',
  Reversed = 'reversed',
}

@Entity('influencer_commissions')
export class InfluencerCommission extends SoftDeleteColumns {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) influencerId: string;
  @Column({ type: 'uuid' }) couponCodeId: string;
  @Column({ type: 'uuid' }) orderId: string;
  @Column({ type: 'text' }) orderNumber: string;
  @Column({ type: 'uuid' }) userId: string;
  @Column({ type: 'decimal', precision: 10, scale: 2 }) orderTotal: number;
  @Column({ type: 'decimal', precision: 10, scale: 2 }) discountAmount: number;
  @Column({ type: 'decimal', precision: 5, scale: 2 }) commissionRate: number;
  @Column({ type: 'decimal', precision: 10, scale: 2 }) commissionAmount: number;
  @Column({ type: 'enum', enum: CommissionStatus, default: CommissionStatus.Approved })
  status: CommissionStatus;
  @Column({ type: 'timestamp', nullable: true }) earnedAt: Date | null;
  @Column({ type: 'timestamp', nullable: true }) paidAt: Date | null;
  @Column({ type: 'uuid', nullable: true }) payoutId: string | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
```

---

## STEP 5 — New Entity: InfluencerWallet

**File:** `apps/api/src/influencers/influencer-wallet.entity.ts`

Table: `influencer_wallets`

```typescript
@Entity('influencer_wallets')
export class InfluencerWallet extends SoftDeleteColumns {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid', unique: true }) influencerId: string;
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 }) pendingAmount: number;
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 }) approvedAmount: number;
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 }) paidAmountLifetime: number;
  @Column({ type: 'timestamp', nullable: true }) lastPayoutAt: Date | null;
  @Column({ type: 'text', default: 'INR' }) currency: string;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
```

---

## STEP 6 — New Entity: InfluencerPayout

**File:** `apps/api/src/influencers/influencer-payout.entity.ts`

Table: `influencer_payouts`

```typescript
export enum PayoutStatus {
  Draft = 'draft',
  Paid = 'paid',
  Cancelled = 'cancelled',
}

@Entity('influencer_payouts')
export class InfluencerPayout extends SoftDeleteColumns {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) influencerId: string;
  @Column({ type: 'text', unique: true }) payoutNumber: string;  // PAY-YYYYMMDD-XXXXX
  @Column({ type: 'decimal', precision: 10, scale: 2 }) amount: number;
  @Column({ type: 'text', default: 'INR' }) currency: string;
  @Column({ type: 'enum', enum: PayoutStatus, default: PayoutStatus.Draft }) status: PayoutStatus;
  @Column({ type: 'text', nullable: true }) paymentMethod: string | null;
  @Column({ type: 'text', nullable: true }) paymentReference: string | null;
  @Column({ type: 'text', nullable: true }) paymentProofUrl: string | null;
  @Column({ type: 'text', nullable: true }) paymentProofFileType: string | null;  // 'pdf' | 'image'
  @Column({ type: 'text', nullable: true }) adminNote: string | null;
  @Column({ type: 'uuid', nullable: true }) paidByUserId: string | null;
  @Column({ type: 'timestamp', nullable: true }) paidAt: Date | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
```

Payout number generation: `PAY-${YYYYMMDD}-${randomAlphanumeric(6).toUpperCase()}`

---

## STEP 7 — New Entity: InfluencerPayoutCommission

**File:** `apps/api/src/influencers/influencer-payout-commission.entity.ts`

Table: `influencer_payout_commissions`

```typescript
@Entity('influencer_payout_commissions')
export class InfluencerPayoutCommission {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) payoutId: string;
  @Column({ type: 'uuid' }) commissionId: string;
  @Column({ type: 'decimal', precision: 10, scale: 2 }) amount: number;
  @CreateDateColumn() createdAt: Date;
}
```

---

## STEP 8 — Extend Order entity

**File:** `apps/api/src/merchandise/orders/order.entity.ts`

Add these nullable columns to the existing `Order` class (do NOT touch existing columns):

```typescript
@Column({ type: 'text', nullable: true })
couponCode: string | null;

@Column({ type: 'uuid', nullable: true })
couponCodeId: string | null;

@Column({ type: 'uuid', nullable: true })
influencerId: string | null;

@Column({ type: 'text', nullable: true })
discountType: string | null;  // 'percentage' | 'fixed_amount'

@Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
discountValue: number | null;  // original coupon value (e.g., 10 for 10%)
```

`discountAmount` already exists — it stores the computed ₹ discount.

---

## STEP 9 — Extend CreateOrderV2Dto

**File:** `apps/api/src/merchandise/orders/dto/create-order-v2.dto.ts`

Add:
```typescript
@IsOptional()
@IsString()
couponCode?: string;
```

---

## STEP 10 — New InfluencersService

**File:** `apps/api/src/influencers/influencers.service.ts`

Inject repositories for all new entities. Implement these methods:

### `validateCoupon(code: string): Promise<CouponValidationResult>`

```
CouponValidationResult {
  valid: boolean;
  errorMessage?: string;
  couponCodeId?: string;
  influencerId?: string;
  discountType?: CouponDiscountType;
  discountValue?: number;
  code?: string;
}
```

Validation checks (in order):
1. Find coupon by `code` (case-insensitive: `ILIKE`) where `isDeleted=false`
2. If not found → `{ valid: false, errorMessage: 'Coupon code not found' }`
3. If `!isActive` → `{ valid: false, errorMessage: 'Coupon code is not active' }`
4. If `expiresAt && expiresAt < now` → `{ valid: false, errorMessage: 'Coupon code has expired' }`
5. If `startsAt && startsAt > now` → `{ valid: false, errorMessage: 'Coupon code is not yet active' }`
6. If `usageLimit !== null && usageCount >= usageLimit` → `{ valid: false, errorMessage: 'Coupon usage limit reached' }`
7. Find influencer by `coupon.influencerId` where `isDeleted=false`
8. If not found or `!influencer.active` → `{ valid: false, errorMessage: 'Influencer is not active' }`
9. Return `{ valid: true, couponCodeId, influencerId, discountType, discountValue, code: coupon.code }`

### `calculateCommissionRate(influencerId: string): Promise<number>`

Logic:
1. Count `influencer_commissions` rows where `influencerId=id AND status IN ('approved','paid')` → `successfulOrders`
2. Fetch rules: first try `influencer_commission_rules` where `influencerId=id AND isActive=true AND isDeleted=false`, ordered by `minSuccessfulOrders DESC`
3. If no influencer-specific rules, fetch global rules where `influencerId IS NULL AND isActive=true AND isDeleted=false`, ordered by `minSuccessfulOrders DESC`
4. If no rules at all, return hardcoded default based on tier:
   - 500+ → 20, 200+ → 15, 100+ → 12, else → 10
5. From the applicable rule list, find highest `minSuccessfulOrders` where `successfulOrders >= minSuccessfulOrders`
6. Return that rule's `commissionRate`
7. Cap at `influencer.maxCommissionRate` if set and less than calculated rate

### `createCommissionForOrder(params): Promise<void>`

Params: `{ influencerId, couponCodeId, orderId, orderNumber, userId, orderTotal, discountAmount, shippingAmount, taxAmount }`

Logic:
1. Calculate `commissionableAmount = orderTotal - shippingAmount - taxAmount` (min 0)
2. Get `commissionRate` via `calculateCommissionRate(influencerId)`
3. `commissionAmount = round2(commissionableAmount * commissionRate / 100)`
4. Insert `influencer_commissions` row with `status=approved`, `earnedAt=now()`
5. Upsert `influencer_wallets` row: increment `approvedAmount += commissionAmount`
   - If wallet doesn't exist, create it with `approvedAmount=commissionAmount`
6. Increment `influencer_coupon_codes.usageCount += 1` for this coupon

All in a single DB transaction.

### `settlePayoutFull(adminUserId: string, influencerId: string, dto: SettlePayoutDto): Promise<InfluencerPayout>`

`SettlePayoutDto`: `{ amount: number, paymentMethod: string, paymentReference?: string, paymentProofUrl?: string, paymentProofFileType?: string, adminNote?: string }`

Logic (all in transaction):
1. Find all `influencer_commissions` where `influencerId=id AND status=approved AND paidAt IS NULL AND isDeleted=false`, ordered by `createdAt ASC`
2. Validate `dto.amount` equals sum of all approved commissions (MVP: only allow full payout — throw `BadRequestException` if mismatch)
3. Generate `payoutNumber`
4. Create `influencer_payouts` row with `status=paid`, `paidAt=now()`, `paidByUserId=adminUserId`
5. For each commission: create `influencer_payout_commissions` row, update commission `status=paid`, `paidAt=now()`, `payoutId=payout.id`
6. Update wallet: `approvedAmount -= dto.amount`, `paidAmountLifetime += dto.amount`, `lastPayoutAt=now()`
7. Return saved payout

### CRUD methods:

`listInfluencers(filters: { search?, page?, limit?, status? })` — query `influencers` where `isDeleted=false`, join wallet amounts via subquery or separate fetch, return paginated result with `{ ...influencer, wallet: { approvedAmount, paidAmountLifetime } }`

`getInfluencerDetail(id)` — return influencer + coupon codes + wallet + commission summary (count, total earned) + recent commissions (last 20) + recent payouts (last 10)

`createInfluencer(dto)` — create influencer + create empty wallet; return saved

`updateInfluencer(id, dto)` — update allowed fields, return saved

`softDeleteInfluencer(id, adminUserId)` — set isDeleted=true, deletedAt, deletedBy

`createCouponCode(influencerId, dto)` — validate code uniqueness (case-insensitive), uppercase `dto.code`, create

`updateCouponCode(id, dto)` — update allowed fields

`listCouponCodes(influencerId)` — all active coupon codes for influencer

`listCommissions(influencerId, page, limit)` — paginated commissions for influencer

`listPayouts(influencerId)` — all payouts for influencer

`getWallet(influencerId)` — wallet row for influencer

`listCommissionRules(influencerId?)` — rules for influencer or global (influencerId=null)

`upsertCommissionRules(influencerId: string | null, rules: { minSuccessfulOrders: number, commissionRate: number }[])` — replace all rules for that influencer/global scope in a transaction (soft-delete old, insert new)

### `reverseCommissionForOrder(orderId: string)` 

Find commission by `orderId` where `status IN ('pending','approved')`, set `status=cancelled`. Update wallet: `approvedAmount -= commission.commissionAmount` (floor at 0).

---

## STEP 11 — New Admin Influencer Controller

**File:** `apps/api/src/influencers/admin-influencers.controller.ts`

```typescript
@Controller('admin/influencers')
@Roles('admin')
export class AdminInfluencersController {
  constructor(private readonly influencersService: InfluencersService, private readonly uploadService: UploadService) {}
```

Endpoints:

```
GET    /admin/influencers                    → listInfluencers({ search, page, limit, status })
POST   /admin/influencers                    → createInfluencer(dto)
GET    /admin/influencers/:id                → getInfluencerDetail(id)
PATCH  /admin/influencers/:id               → updateInfluencer(id, dto)
DELETE /admin/influencers/:id               → softDeleteInfluencer(id, currentUser.sub)

GET    /admin/influencers/:id/coupons        → listCouponCodes(id)
POST   /admin/influencers/:id/coupons        → createCouponCode(id, dto)
PATCH  /admin/influencers/:id/coupons/:cid   → updateCouponCode(cid, dto)

GET    /admin/influencers/:id/commissions    → listCommissions(id, page, limit)
GET    /admin/influencers/:id/wallet         → getWallet(id)

GET    /admin/influencers/:id/payouts        → listPayouts(id)
POST   /admin/influencers/:id/payouts        → settlePayoutFull(currentUser.sub, id, dto)

GET    /admin/influencers/:id/commission-rules  → listCommissionRules(id)
PUT    /admin/influencers/:id/commission-rules  → upsertCommissionRules(id, rules)

GET    /admin/influencer-settings/commission-rules   → listCommissionRules(null)  // global
PUT    /admin/influencer-settings/commission-rules   → upsertCommissionRules(null, rules)

POST   /admin/influencers/:id/payouts/upload-proof   → upload proof file, return { url, fileType }
```

For the proof upload endpoint:
- Use `@UseInterceptors(FileInterceptor('file'))` with multer memoryStorage
- Accept: `image/jpeg`, `image/png`, `image/webp`, `application/pdf`
- Max size: 10MB
- Call `uploadService.uploadPaymentProof(influencerId, file)` (you'll add this method in Step 14)
- Return `{ url, fileType }` where `fileType` is `'pdf'` or `'image'`

**Do NOT add influencer list/create/patch to `apps/api/src/admin/admin.controller.ts`** — the new dedicated controller replaces those routes. Keep the old routes in admin.controller.ts to avoid breaking existing frontend (they can coexist).

---

## STEP 12 — New User-Facing Coupon Endpoint

**File:** `apps/api/src/merchandise/merchandise-catalog.controller.ts` OR create `apps/api/src/influencers/influencer-public.controller.ts`

Add ONE endpoint accessible to logged-in users:

```
POST /influencers/coupon/validate
Body: { code: string }
Auth: JWT (any role)
```

Returns `CouponValidationResult` from `InfluencersService.validateCoupon()`.

If implementing as a new controller:
```typescript
@Controller('influencers')
@UseGuards(AuthGuard('jwt'))
export class InfluencerPublicController {
  @Post('coupon/validate')
  async validateCoupon(@Body() body: { code: string }) {
    return this.influencersService.validateCoupon(body.code);
  }
}
```

---

## STEP 13 — Wire coupon into order creation

**File:** `apps/api/src/merchandise/orders/order-v2.service.ts`

In `createOrder(userId, dto)`:

1. Inject `InfluencersService` (use constructor injection; add to module imports)
2. After product validation and before price calculation, if `dto.couponCode` is provided:
   ```
   const couponResult = await this.influencersService.validateCoupon(dto.couponCode);
   if (!couponResult.valid) throw new BadRequestException(couponResult.errorMessage);
   ```
3. Calculate discount:
   ```
   let discountAmount = 0;
   if (couponResult.valid) {
     if (couponResult.discountType === 'percentage') {
       discountAmount = round2(subtotalAmount * couponResult.discountValue / 100);
     } else {
       discountAmount = Math.min(couponResult.discountValue, subtotalAmount);
     }
   }
   ```
4. Store on order:
   ```
   couponCode: couponResult.code ?? null,
   couponCodeId: couponResult.couponCodeId ?? null,
   influencerId: couponResult.influencerId ?? null,
   discountType: couponResult.discountType ?? null,
   discountValue: couponResult.discountValue ?? null,
   discountAmount,
   ```
5. After order is saved (and payment records created), call:
   ```
   if (couponResult.valid && order.couponCodeId && order.influencerId) {
     await this.influencersService.createCommissionForOrder({
       influencerId: order.influencerId,
       couponCodeId: order.couponCodeId,
       orderId: order.id,
       orderNumber: order.orderNumber,
       userId,
       orderTotal: totalAmount,
       discountAmount,
       shippingAmount: 0,
       taxAmount: Number(order.taxAmount),
     });
   }
   ```

Also: in the `getOrderDetail` response, add these fields to the returned object:
```
couponCode: order.couponCode,
couponCodeId: order.couponCodeId,
influencerId: order.influencerId,
discountType: order.discountType,
discountValue: order.discountValue,
```

And in `listOrders` per-order return, add `couponCode: order.couponCode`.

---

## STEP 14 — Add uploadPaymentProof to UploadService

**File:** `apps/api/src/upload/upload.service.ts`

Add method:
```typescript
async uploadPaymentProof(influencerId: string, file: Express.Multer.File): Promise<{ url: string; fileType: 'pdf' | 'image' }> {
  const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if (!ALLOWED.includes(file.mimetype)) throw new BadRequestException('Invalid file type. Allowed: PDF, JPG, PNG, WEBP');
  if (file.size > 10 * 1024 * 1024) throw new BadRequestException('File too large (max 10MB)');

  const ext = file.mimetype === 'application/pdf' ? 'pdf' : file.originalname.split('.').pop() ?? 'jpg';
  const filename = `payout-proof-${influencerId}-${randomUUID()}.${ext}`;
  const key = `payouts/${influencerId}/${filename}`;
  const fileType: 'pdf' | 'image' = file.mimetype === 'application/pdf' ? 'pdf' : 'image';

  if (this.useR2) {
    const bucket = this.configService.get<string>('R2_BUCKET_NAME') ?? 'heroverse-assets';
    const publicUrl = this.configService.get<string>('R2_PUBLIC_URL') ?? '';
    await this.s3Client!.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: file.buffer, ContentType: file.mimetype }));
    return { url: `${publicUrl}/${key}`, fileType };
  }

  // Local fallback
  const dir = join(process.cwd(), 'uploads', 'payouts', influencerId);
  await mkdir(dir, { recursive: true });
  const localPath = join(dir, filename);
  await writeFile(localPath, file.buffer);
  return { url: `/uploads/payouts/${influencerId}/${filename}`, fileType };
}
```

---

## STEP 15 — Update InfluencersModule

**File:** `apps/api/src/influencers/influencers.module.ts`

```typescript
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Influencer,
      InfluencerReferral,
      InfluencerCouponCode,
      InfluencerCommissionRule,
      InfluencerCommission,
      InfluencerWallet,
      InfluencerPayout,
      InfluencerPayoutCommission,
    ]),
    UploadModule,  // import for UploadService
  ],
  controllers: [AdminInfluencersController, InfluencerPublicController],
  providers: [InfluencersService],
  exports: [InfluencersService, TypeOrmModule],
})
export class InfluencersModule {}
```

---

## STEP 16 — Register new entities in app.module.ts

**File:** `apps/api/src/app.module.ts`

In `TypeOrmModule.forRoot` entities array, add:
```
InfluencerCouponCode,
InfluencerCommissionRule,
InfluencerCommission,
InfluencerWallet,
InfluencerPayout,
InfluencerPayoutCommission,
```

Import from their respective files.

---

## STEP 17 — Wire InfluencersService into MerchandiseModule

**File:** `apps/api/src/merchandise/merchandise.module.ts`

Add `InfluencersModule` to imports array so `OrderV2Service` can inject `InfluencersService`:
```typescript
imports: [TypeOrmModule.forFeature([...]), InfluencersModule],
```

In `OrderV2Service` constructor, add:
```typescript
private readonly influencersService: InfluencersService,
```

Import `InfluencersService` from `'../../influencers/influencers.service'`.

---

## STEP 18 — Order cancellation: reverse commission

**File:** `apps/api/src/merchandise/orders/order-v2.service.ts`

In `updateOrderStatus` (or wherever order status is changed to `cancelled` or `refunded`), after saving the new status, call:
```typescript
if (['cancelled', 'refunded'].includes(newStatus)) {
  await this.influencersService.reverseCommissionForOrder(orderId);
}
```

---

## TypeScript Rules

- Strict null checks — every nullable column must be typed `T | null`
- All DTO fields validated with `class-validator`
- No `any` types
- Run `npx tsc --noEmit` from `apps/api/` at the end — zero errors required

---

## API Summary (all new endpoints)

```
POST   /influencers/coupon/validate                               (JWT, any user)

GET    /admin/influencers                                          (admin)
POST   /admin/influencers                                          (admin)
GET    /admin/influencers/:id                                      (admin)
PATCH  /admin/influencers/:id                                      (admin)
DELETE /admin/influencers/:id                                      (admin)

GET    /admin/influencers/:id/coupons                              (admin)
POST   /admin/influencers/:id/coupons                              (admin)
PATCH  /admin/influencers/:id/coupons/:cid                         (admin)

GET    /admin/influencers/:id/commissions                          (admin)
GET    /admin/influencers/:id/wallet                               (admin)

GET    /admin/influencers/:id/payouts                              (admin)
POST   /admin/influencers/:id/payouts                              (admin)
POST   /admin/influencers/:id/payouts/upload-proof                 (admin, multipart)

GET    /admin/influencers/:id/commission-rules                     (admin)
PUT    /admin/influencers/:id/commission-rules                     (admin)

GET    /admin/influencer-settings/commission-rules                 (admin)
PUT    /admin/influencer-settings/commission-rules                 (admin)
```

---

## DO NOT

- Do NOT delete or alter `influencer_referrals` table/entity
- Do NOT remove existing fields from `influencers` table
- Do NOT touch `apps/api/src/admin/admin.controller.ts` influencer routes (keep for backward compat)
- Do NOT add automatic bank payouts
- Do NOT break existing order creation flow
- Do NOT add commission for digital-only products differently — treat all order types the same for commission purposes
