# CODEX: Pricing & Promotions — Credit Packs Backend

## ONE-LINER
Read `CODEX_PRICING_PROMOTIONS.md` and implement every step exactly as described.

---

## AUDIT FINDINGS (read before touching anything)

Current codebase state — do NOT recreate these:

| Item | Location | State |
|---|---|---|
| Credit wallet | `User.credits` (int field on user) | EXISTS |
| Credit transactions | `apps/api/src/credits/credit-transaction.entity.ts` | EXISTS — extend, don't replace |
| CreditsService | `apps/api/src/credits/credits.service.ts` | EXISTS — only has `getCredits()` + `claimDemoCredit()` |
| CreditsController | `apps/api/src/credits/credits.controller.ts` | EXISTS — `GET /credits`, `POST /credits/demo` |
| CreditsModule | `apps/api/src/credits/credits.module.ts` | EXISTS |
| Platform settings | `apps/api/src/admin/platform-setting.entity.ts` | EXISTS — SETTING_DEFAULTS map |
| AdminService | `apps/api/src/admin/admin.service.ts` | EXISTS |
| AdminController | `apps/api/src/admin/admin.controller.ts` | EXISTS |
| Credit packs | NONE | DOES NOT EXIST — create from scratch |
| Buy credits flow | NONE | DOES NOT EXIST — create from scratch |
| Razorpay for credits | NONE | NOT INTEGRATED — implement fresh |
| Feature credit costs | Hardcoded `user.credits -= 1` in `stories.service.ts` | EXISTS — leave as-is for now |

Payment pattern for reference (merchandise uses manual mock payments):
- `apps/api/src/merchandise/orders/order-v2.service.ts` — has payment summary + detail pattern
- `apps/api/src/payments/payment.entity.ts` — legacy Payment entity (not used for credit packs)

---

## STEP 1 — Create `credit_pack.entity.ts`

File: `apps/api/src/credits/credit-pack.entity.ts`

```typescript
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum PromotionType {
  Percentage = 'percentage',
  FlatAmount = 'flat_amount',
}

@Entity('credit_packs')
export class CreditPack {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', unique: true })
  slug!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  // Pricing
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  basePrice!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  salePrice!: number | null;

  @Column({ type: 'text', default: 'INR' })
  currency!: string;

  // Credits
  @Column({ type: 'int' })
  credits!: number;

  @Column({ type: 'int', default: 0 })
  bonusCredits!: number;

  // Promotion
  @Column({ type: 'text', nullable: true })
  promotionName!: string | null;

  @Column({ type: 'enum', enum: PromotionType, nullable: true })
  promotionType!: PromotionType | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  promotionValue!: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  promotionStart!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  promotionEnd!: Date | null;

  // Display
  @Column({ type: 'text', nullable: true })
  badge!: string | null;

  @Column({ type: 'boolean', default: false })
  isFeatured!: boolean;

  @Column({ type: 'boolean', default: false })
  isMostPopular!: boolean;

  @Column({ type: 'boolean', default: false })
  isBestValue!: boolean;

  @Column({ type: 'int', default: 0 })
  sortOrder!: number;

  // Lifecycle
  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'boolean', default: false })
  isDeleted!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  deletedBy!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
```

---

## STEP 2 — Extend `CreditTransaction` entity

File: `apps/api/src/credits/credit-transaction.entity.ts`

Add these fields after the existing `referenceId` column:

```typescript
@Column({ type: 'int', default: 0 })
bonusCredits!: number;

@Column({ type: 'uuid', nullable: true })
packId!: string | null;

@Column({ type: 'text', nullable: true })
packName!: string | null;

@Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
pricePaid!: number | null;

@Column({ type: 'text', nullable: true })
razorpayOrderId!: string | null;

@Column({ type: 'text', nullable: true })
razorpayPaymentId!: string | null;
```

Add `Signup = 'signup'` to the `CreditTransactionReason` enum (for free signup credits).

---

## STEP 3 — Create `CreditPacksService`

File: `apps/api/src/credits/credit-packs.service.ts`

Implement these methods:

### 3a. `computeEffectivePrice(pack: CreditPack): { effectivePrice: number; isOnSale: boolean; savingsAmount: number; savingsPct: number }`

- Check if current UTC time is within `[promotionStart, promotionEnd]`
- If in window AND `salePrice` is set → `effectivePrice = salePrice`, `isOnSale = true`
- Otherwise → `effectivePrice = basePrice`, `isOnSale = false`
- `savingsAmount = basePrice - effectivePrice`
- `savingsPct = Math.round((savingsAmount / basePrice) * 100)`

### 3b. `listActivePacks()`

Returns all packs where `isActive = true AND isDeleted = false`, ordered by `sortOrder ASC`.

For each pack, call `computeEffectivePrice()` and include the result in the response:
```
{
  ...pack,
  effectivePrice,
  isOnSale,
  savingsAmount,
  savingsPct,
  totalCredits: pack.credits + pack.bonusCredits,
}
```

### 3c. `listAllPacks()` — admin

Returns ALL packs (including inactive) where `isDeleted = false`, ordered by `sortOrder ASC`. Also includes computed price fields.

### 3d. `createPack(dto)` — admin

Validate:
- `credits > 0`
- `bonusCredits >= 0`
- `salePrice` (if set) must be `<= basePrice`
- `promotionEnd` (if set) must be after `promotionStart`

Create and save. Return saved pack with computed fields.

### 3e. `updatePack(id, dto)` — admin

Load by `id`, apply partial updates, re-validate same rules, save and return with computed fields.

### 3f. `deletePack(id, adminId)` — admin

Soft delete: set `isDeleted = true`, `deletedAt = new Date()`, `deletedBy = adminId`.

### 3g. `initiatePurchase(userId, packId): Promise<{ razorpayOrderId: string; amount: number; currency: string; keyId: string }>`

- Load pack (active, not deleted) or throw `NotFoundException`
- Compute effective price
- Create Razorpay order via Razorpay Node SDK (`razorpay` package):
  ```
  amount: Math.round(effectivePrice * 100),  // paise
  currency: pack.currency,
  notes: { userId, packId, packName: pack.name }
  ```
- Return `{ razorpayOrderId, amount: effectivePrice, currency: pack.currency, keyId: process.env.RAZORPAY_KEY_ID }`

### 3h. `verifyAndCredit(userId, packId, razorpayOrderId, razorpayPaymentId, razorpaySignature): Promise<{ newBalance: number }>`

- Verify signature:
  ```
  const body = razorpayOrderId + '|' + razorpayPaymentId;
  const expectedSignature = crypto.createHmac('sha256', RAZORPAY_KEY_SECRET).update(body).digest('hex');
  if (expectedSignature !== razorpaySignature) throw new UnauthorizedException('Invalid payment signature');
  ```
- Check for duplicate: if a CreditTransaction with `razorpayPaymentId` already exists, throw `ConflictException`
- Load pack, compute effective price
- In a DB transaction:
  - `user.credits += pack.credits + pack.bonusCredits`
  - Save CreditTransaction with:
    ```
    delta: pack.credits + pack.bonusCredits,
    reason: CreditTransactionReason.Purchase,
    referenceId: razorpayOrderId,
    bonusCredits: pack.bonusCredits,
    packId: pack.id,
    packName: pack.name,
    pricePaid: effectivePrice,
    razorpayOrderId,
    razorpayPaymentId,
    ```
- Return `{ newBalance: user.credits }`

---

## STEP 4 — Update `CreditsController`

File: `apps/api/src/credits/credits.controller.ts`

Add these endpoints (all require JWT auth):

```
GET  /credits/packs                          → creditPacksService.listActivePacks()
POST /credits/packs/:id/purchase/initiate    → creditPacksService.initiatePurchase(userId, id)
POST /credits/packs/:id/purchase/verify      → creditPacksService.verifyAndCredit(userId, id, body.razorpayOrderId, body.razorpayPaymentId, body.razorpaySignature)
```

The `GET /credits/packs` endpoint should be public (no auth guard) — use `@Public()` decorator if it exists in the codebase, otherwise remove the `@UseGuards` for that route only.

---

## STEP 5 — Add Admin Credit Pack Endpoints to `AdminController`

File: `apps/api/src/admin/admin.controller.ts`

Inject `CreditPacksService`. Add:

```
GET    /admin/credit-packs              → creditPacksService.listAllPacks()
POST   /admin/credit-packs              → creditPacksService.createPack(body)
PATCH  /admin/credit-packs/:id          → creditPacksService.updatePack(id, body)
DELETE /admin/credit-packs/:id          → creditPacksService.deletePack(id, currentUser.id)
```

---

## STEP 6 — Update `CreditsModule`

File: `apps/api/src/credits/credits.module.ts`

- Import `CreditPack` entity in `TypeOrmModule.forFeature`
- Register `CreditPacksService` as a provider
- Export `CreditPacksService` so it can be injected into `AdminModule`

---

## STEP 7 — Update `AdminModule` (or `AdminService`)

File: `apps/api/src/admin/admin.module.ts` (check if it exists, or find how AdminController is registered)

Import `CreditsModule` so `CreditPacksService` is available in `AdminController`.

---

## STEP 8 — Add Razorpay to `.env.example`

Append to `apps/api/.env.example`:
```
RAZORPAY_KEY_ID=rzp_test_xxxx
RAZORPAY_KEY_SECRET=xxxx
```

Install Razorpay SDK if not present:
```
cd apps/api && npm install razorpay
```

---

## STEP 9 — Seed Default Credit Packs

File: Create `apps/api/src/credits/credit-packs.seed.ts`

Seed these 3 packs via a method `seedDefaultPacks(creditPacksService)` that checks if any pack exists before inserting (idempotent):

```typescript
const DEFAULT_PACKS = [
  {
    name: 'Starter',
    slug: 'starter',
    description: 'Perfect for trying out HeroKids Universe',
    basePrice: 149,
    salePrice: null,
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
];
```

Call `seedDefaultPacks` from `main.ts` after `app.listen()` — wrap in try/catch, just log errors.

---

## STEP 10 — Validation Rules (implement inside service methods)

| Rule | Where |
|---|---|
| `credits > 0` | `createPack` + `updatePack` |
| `bonusCredits >= 0` | `createPack` + `updatePack` |
| `salePrice <= basePrice` when both set | `createPack` + `updatePack` |
| `promotionEnd > promotionStart` when both set | `createPack` + `updatePack` |
| Razorpay signature verification | `verifyAndCredit` |
| Duplicate payment check (idempotency) | `verifyAndCredit` |

---

## ACCEPTANCE CRITERIA

- `GET /credits/packs` returns active packs with `effectivePrice`, `isOnSale`, `savingsAmount`, `savingsPct`, `totalCredits`
- `POST /credits/packs/:id/purchase/initiate` returns `razorpayOrderId`, `amount`, `currency`, `keyId`
- `POST /credits/packs/:id/purchase/verify` credits the wallet and returns `newBalance`
- Admin CRUD endpoints work for credit packs
- Default 3 packs seeded on first boot
- No existing `CreditsService.getCredits()` or `claimDemoCredit()` functionality is broken
- No duplicate credit packs tables or conflicting payment systems introduced
- TypeScript compiles without errors (`npx tsc --noEmit`)

---

## DO NOT

- Do not modify the merchandise order payment flow
- Do not create a new payment entity — use `CreditTransaction` for the purchase record
- Do not hardcode any prices in service logic — all prices come from the `credit_packs` table
- Do not remove existing `CreditTransactionReason` enum values
- Do not add migration files — `synchronize: true` in dev handles schema changes
