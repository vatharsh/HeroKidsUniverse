# HeroKids Universe — Admin & AI Analytics Platform
## Codex Implementation Prompt

---

## READ THIS FIRST

This is the HeroKids Universe NestJS + TypeORM + PostgreSQL backend monorepo.
API source lives in `apps/api/src/`. TypeORM runs with `synchronize: true` in dev — no migration files needed, just define entities and they auto-create.

All API responses are wrapped by `TransformInterceptor` → `{ success: true, data: T, timestamp }`.
Auth uses JWT via `JwtAuthGuard` (applied globally). Use `@Public()` decorator to skip auth.
Admin-only routes must use a `@Roles('admin')` guard — see instructions below for creating it.

**Existing entities you will query (do NOT recreate them):**
- `users` table → `User` entity (`apps/api/src/users/user.entity.ts`) — has `role`, `plan`, `credits`, `createdAt`
- `stories` table → `Story` entity (`apps/api/src/stories/story.entity.ts`) — has `status`, `theme`, `storyMode`, `videoStatus`, `videoUrl`, `createdAt`, `userId`, `universeId`
- `universes` table → `Universe` entity (`apps/api/src/universes/universe.entity.ts`)
- `generation_jobs` table → `GenerationJob` entity (`apps/api/src/generation/generation-job.entity.ts`) — has `status` (queued/generating_story/generating_cover/generating_images/generating_audio/saving_memory/completed/failed), `userId`, `storyId`, `universeId`, `currentStep`, `progressPercentage`, `errorMessage`, `startedAt`, `completedAt`
- `ai_usage_logs` table → `AiUsageLog` entity (`apps/api/src/ai/entities/ai-usage-log.entity.ts`) — has `userId`, `storyId`, `provider`, `model`, `operation` (story_generation/image_generation/narration/avatar_generation), `inputTokens`, `outputTokens`, `imagesGenerated`, `estimatedCostUsd`, `createdAt`
- `story_generation_costs` table → `StoryGenerationCost` entity (`apps/api/src/ai/entities/story-generation-cost.entity.ts`) — has `storyId`, `storyCostUsd`, `imageCostUsd`, `audioCostUsd`, `totalCostUsd`, `createdAt`
- `credit_transactions` table → `CreditTransaction` entity (`apps/api/src/credits/credit-transaction.entity.ts`)

---

## TASK 1 — Admin Role Guard

Add `admin` value to the `UserRole` enum in `apps/api/src/users/user.entity.ts`:
```typescript
Admin = 'admin'
```

Create `apps/api/src/auth/guards/roles.guard.ts`:
- Reads `@Roles(...roles)` decorator from route metadata
- Checks `request.user.role` against allowed roles
- Throws `ForbiddenException` if not matched

Create `apps/api/src/auth/decorators/roles.decorator.ts`:
- `@Roles(...roles: string[])` sets metadata key `roles`

Apply `RolesGuard` globally in `app.module.ts` providers (after `JwtAuthGuard`).

---

## TASK 2 — New Entities to Create

### 2a. Merchandise Order (`apps/api/src/merchandise/order.entity.ts`)

```typescript
export enum OrderStatus {
  Pending     = 'pending',
  Processing  = 'processing',
  Printed     = 'printed',
  Shipped     = 'shipped',
  Delivered   = 'delivered',
  Cancelled   = 'cancelled',
  Refunded    = 'refunded',
}

export enum ProductType {
  Poster      = 'poster',
  Certificate = 'certificate',
  StickerSheet = 'sticker_sheet',
  Book        = 'book',
  Video       = 'video',
}

@Entity('merchandise_orders')
export class MerchandiseOrder {
  @PrimaryGeneratedColumn('uuid') id
  @Column({ type: 'uuid' }) userId
  @Column({ type: 'uuid', nullable: true }) storyId
  @Column({ type: 'uuid', nullable: true }) universeId
  @Column({ type: 'enum', enum: ProductType }) productType
  @Column({ type: 'text' }) productName
  @Column({ type: 'decimal', precision: 10, scale: 2 }) amountInr  // price in INR
  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.Pending }) status
  @Column({ type: 'text', nullable: true }) trackingNumber
  @Column({ type: 'text', nullable: true }) trackingUrl
  @Column({ type: 'text', nullable: true }) printFileUrl
  @Column({ type: 'text', nullable: true }) downloadUrl   // for digital products
  @Column({ type: 'text', nullable: true }) razorpayOrderId
  @Column({ type: 'text', nullable: true }) razorpayPaymentId
  @Column({ type: 'text', nullable: true }) shippingName
  @Column({ type: 'text', nullable: true }) shippingAddress
  @Column({ type: 'text', nullable: true }) shippingCity
  @Column({ type: 'text', nullable: true }) shippingPincode
  @Column({ type: 'text', nullable: true }) shippingPhone
  @Column({ type: 'text', nullable: true }) adminNotes
  @CreateDateColumn() createdAt
  @UpdateDateColumn() updatedAt
}
```

### 2b. Order Status History (`apps/api/src/merchandise/order-status-history.entity.ts`)

```typescript
@Entity('order_status_history')
export class OrderStatusHistory {
  @PrimaryGeneratedColumn('uuid') id
  @Column({ type: 'uuid' }) orderId
  @Column({ type: 'text', nullable: true }) oldStatus
  @Column({ type: 'text' }) newStatus
  @Column({ type: 'text', nullable: true }) note
  @Column({ type: 'uuid', nullable: true }) changedBy   // admin userId
  @CreateDateColumn() createdAt
}
```

### 2c. Payment Record (`apps/api/src/payments/payment.entity.ts`)

```typescript
export enum PaymentStatus {
  Created  = 'created',
  Captured = 'captured',
  Failed   = 'failed',
  Refunded = 'refunded',
}

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid') id
  @Column({ type: 'uuid' }) userId
  @Column({ type: 'uuid', nullable: true }) orderId
  @Column({ type: 'text' }) razorpayOrderId
  @Column({ type: 'text', nullable: true }) razorpayPaymentId
  @Column({ type: 'decimal', precision: 10, scale: 2 }) amountInr
  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.Created }) status
  @Column({ type: 'text', nullable: true }) method   // card/upi/netbanking
  @Column({ type: 'jsonb', nullable: true }) metadata
  @CreateDateColumn() createdAt
  @UpdateDateColumn() updatedAt
}
```

### 2d. Influencer (`apps/api/src/influencers/influencer.entity.ts`)

```typescript
@Entity('influencers')
export class Influencer {
  @PrimaryGeneratedColumn('uuid') id
  @Column({ type: 'text' }) name
  @Column({ type: 'text', unique: true }) code           // promo/referral code
  @Column({ type: 'text', nullable: true }) email
  @Column({ type: 'text', nullable: true }) platform     // instagram/youtube/etc
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 }) commissionPct
  @Column({ type: 'boolean', default: true }) active
  @CreateDateColumn() createdAt
  @UpdateDateColumn() updatedAt
}
```

### 2e. Influencer Referral (`apps/api/src/influencers/influencer-referral.entity.ts`)

```typescript
@Entity('influencer_referrals')
export class InfluencerReferral {
  @PrimaryGeneratedColumn('uuid') id
  @Column({ type: 'uuid' }) influencerId
  @Column({ type: 'uuid' }) userId            // referred user
  @Column({ type: 'uuid', nullable: true }) orderId
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 }) revenueInr
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 }) commissionInr
  @Column({ type: 'boolean', default: false }) commissionPaid
  @CreateDateColumn() createdAt
}
```

### 2f. Extend AiUsageLog

Add to `AiOperation` enum in `apps/api/src/ai/entities/ai-usage-log.entity.ts`:
```typescript
CharacterSheetGeneration = 'character_sheet_generation',
CoverGeneration          = 'cover_generation',
StoryPageGeneration      = 'story_page_generation',
VideoGeneration          = 'video_generation',
MerchandiseGeneration    = 'merchandise_generation',
StoryContinuation        = 'story_continuation',
```

Add to `AiUsageLog` entity columns:
```typescript
@Column({ type: 'int', default: 0 }) audioSeconds   // for narration logs
@Column({ type: 'uuid', nullable: true }) universeId
```

Add to `StoryGenerationCost` entity:
```typescript
@Column({ type: 'decimal', precision: 10, scale: 6, default: 0 }) videoCostUsd
@Column({ type: 'uuid', nullable: true }) userId
```

---

## TASK 3 — Admin Module

Create `apps/api/src/admin/admin.module.ts`, `admin.controller.ts`, `admin.service.ts`.

Register all necessary entities via `TypeOrmModule.forFeature([...])`. Import modules as needed.

### Admin Controller routes (all protected with `@Roles('admin')`)

#### `GET /admin/dashboard`
Return:
```typescript
{
  totalUsers: number,
  totalUniverses: number,
  totalStories: number,
  storiesToday: number,
  activeGenerations: number,           // GenerationJob.status IN (queued, generating_*)
  pendingMerchandiseOrders: number,
  ordersShippedToday: number,
  totalRevenueInr: number,             // sum of captured payments
  revenueToday: number,
  revenueThisMonth: number,
  totalAiCostUsd: number,
  aiCostToday: number,
  aiCostThisMonth: number,
  estimatedGrossProfitInr: number,     // revenueThisMonth - (aiCostThisMonth * USD_TO_INR)
  profitMarginPct: number,
  mostPopularTheme: string,
  mostPopularProduct: string,
  aiCostWarning: boolean,              // true if daily/monthly threshold exceeded
}
```

Use env var `USD_TO_INR` (default 83) for currency conversion.
Check env vars `AI_DAILY_COST_WARNING` and `AI_MONTHLY_COST_WARNING` for threshold alerts.

#### `GET /admin/users`
Query params: `page` (default 1), `limit` (default 20), `search` (optional email/name filter)
Return paginated list: `{ items: User[], total: number, page, limit }`
Include per-user: `storyCount`, `universeCount`, `totalAiCostUsd` (join with ai_usage_logs)

#### `GET /admin/users/:id`
Return full user detail with story count, universe count, credit history, total AI cost.

#### `PATCH /admin/users/:id`
Allow updating: `role`, `plan`, `credits`, `isPremium`

#### `GET /admin/universes`
Query params: `page`, `limit`, `search`
Return paginated universes with: `storyCount`, `imageCount`, `aiCostUsd` per universe

#### `GET /admin/stories`
Query params: `page`, `limit`, `userId`, `universeId`, `status`, `theme`
Return paginated stories with title, user email, hero name, status, cost

#### `GET /admin/stories/:id`
Return full story detail including pages, cost breakdown from `story_generation_costs`

#### `DELETE /admin/stories/:id`
Hard delete a story.

#### `GET /admin/generation-jobs`
Query params: `page`, `limit`, `status` (filter by job status)
Return paginated jobs with: user email, universe name, story title, currentStep, progressPercentage, duration (completedAt - startedAt or now - startedAt), errorMessage

#### `POST /admin/generation-jobs/:id/retry`
Reset job status to `queued`, clear errorMessage, clear startedAt/completedAt.

#### `DELETE /admin/generation-jobs/:id`
Cancel (delete) a generation job.

#### `GET /admin/orders`
Query params: `page`, `limit`, `status`, `search` (order ID or user email)
Return paginated orders with user email, product, amount, status, tracking

#### `GET /admin/orders/:id`
Return full order with status history.

#### `PATCH /admin/orders/:id`
Allow updating: `status`, `trackingNumber`, `trackingUrl`, `adminNotes`, `printFileUrl`
On status change: auto-insert a row into `order_status_history` with `oldStatus`, `newStatus`, `changedBy` (admin userId from JWT), `note` from request body.

#### `GET /admin/payments`
Query params: `page`, `limit`, `status`
Return paginated payments with user email.

#### `GET /admin/ai-analytics`
Return:
```typescript
{
  // Totals
  aiCostToday: number,
  aiCostThisMonth: number,
  totalStoriesGenerated: number,
  totalImagesGenerated: number,
  totalNarrationSeconds: number,
  totalVideosGenerated: number,         // count of stories with videoStatus = 'completed'
  avgCostPerStory: number,
  avgCostPerImage: number,
  avgCostPerNarrationMinute: number,

  // By provider (group ai_usage_logs by provider)
  byProvider: Array<{
    provider: string,
    requestCount: number,
    storiesGenerated: number,
    imagesGenerated: number,
    narrationSeconds: number,
    estimatedCostUsd: number,
  }>,

  // By model (group by provider + model)
  byModel: Array<{
    provider: string,
    model: string,
    requestCount: number,
    totalInputTokens: number,
    totalOutputTokens: number,
    imagesGenerated: number,
    audioSeconds: number,
    estimatedCostUsd: number,
  }>,

  // By operation/feature
  byOperation: Array<{
    operation: string,
    requestCount: number,
    avgCostUsd: number,
    totalCostUsd: number,
  }>,

  // Top expensive stories (join story_generation_costs + stories + users)
  topExpensiveStories: Array<{
    storyId: string,
    title: string,
    userEmail: string,
    storyCostUsd: number,
    imageCostUsd: number,
    audioCostUsd: number,
    videoCostUsd: number,
    totalCostUsd: number,
  }>,   // top 10

  // Top expensive users
  topExpensiveUsers: Array<{
    userId: string,
    name: string,
    email: string,
    storyCount: number,
    imagesGenerated: number,
    audioSeconds: number,
    totalAiCostUsd: number,
  }>,   // top 10

  // Universe analytics
  universeAnalytics: Array<{
    universeId: string,
    universeName: string,
    storyCount: number,
    imagesGenerated: number,
    audioCount: number,
    totalAiCostUsd: number,
  }>,   // top 20 by cost
}
```

#### `GET /admin/influencers`
Return all influencers with: `usersReferred`, `storiesGenerated`, `revenueGeneratedInr`, `commissionOwedInr`, `commissionPaidInr`

#### `POST /admin/influencers`
Create influencer: `{ name, code, email, platform, commissionPct }`

#### `PATCH /admin/influencers/:id`
Update influencer.

#### `GET /admin/merchandise-analytics`
Return:
```typescript
{
  posterPdfsGenerated: number,
  certificatePdfsGenerated: number,
  stickerSheetsGenerated: number,
  videosExported: number,
  booksOrdered: number,
  totalRevenueInr: number,
  revenueByProduct: Array<{ productType: string, count: number, revenueInr: number }>,
}
```

---

## TASK 4 — User-Facing Order Routes

Create `apps/api/src/merchandise/merchandise.module.ts` and `merchandise.controller.ts`.

#### `GET /merchandise/my-orders`
Authenticated user sees their own orders only.
Return: `{ id, productType, productName, amountInr, status, trackingNumber, trackingUrl, downloadUrl, createdAt }`

#### `POST /merchandise/orders`
User places a new order. Body: `{ productType, productName, amountInr, storyId?, universeId?, razorpayOrderId? }`

---

## TASK 5 — Register Everything in AppModule

In `apps/api/src/app.module.ts`, import:
- `AdminModule`
- `MerchandiseModule`
- Any new modules (payments, influencers) if you create them as separate modules

---

## TASK 6 — Environment Variables

Document these in `apps/api/.env` (add if not present — do NOT overwrite existing values):
```
USD_TO_INR=83
AI_DAILY_COST_WARNING=10
AI_MONTHLY_COST_WARNING=200
```

---

## IMPLEMENTATION NOTES

1. **All admin queries must be efficient.** Use TypeORM QueryBuilder with aggregate functions (`SUM`, `COUNT`, `AVG`, `GROUP BY`) rather than loading all rows into memory.

2. **Date filtering pattern** for "today" and "this month":
   ```typescript
   const todayStart = new Date(); todayStart.setHours(0,0,0,0);
   const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
   // Use .andWhere('entity.createdAt >= :start', { start: todayStart })
   ```

3. **Currency**: All AI costs are stored in USD (`estimatedCostUsd`). All merchandise prices are in INR (`amountInr`). Conversion uses `USD_TO_INR` env var. Show USD costs as-is in AI analytics; convert to INR for profit calculations.

4. **Pagination pattern**: Return `{ items: T[], total: number, page: number, limit: number, totalPages: number }`.

5. **Admin guard**: Any route decorated with `@Roles('admin')` should throw `403 Forbidden` if `request.user.role !== 'admin'`.

6. **Do not break existing routes.** Only add new files and new modules. Only modify existing entity files to add enum values or columns (additive changes are safe with synchronize:true).

7. **TypeORM decimal columns**: When reading `decimal` columns, TypeORM returns strings. Cast with `Number(value)` or `parseFloat(value)` before arithmetic.

8. **Order status history**: Insert automatically inside `AdminService.updateOrder()` — do not rely on callers to do it.

9. **No frontend work**: This prompt is backend-only. Do not create any `.tsx`, `.html`, or CSS files.

---

## ACCEPTANCE CRITERIA

All of the following questions must be answerable via API without manual DB queries:

- `GET /admin/dashboard` → revenue today, AI cost today, estimated profit, active generations
- `GET /admin/ai-analytics` → which stories cost the most, which users consume the most AI
- `GET /admin/orders?status=pending` → which orders need attention
- `GET /admin/generation-jobs?status=failed` → which jobs are failing
- `GET /admin/influencers` → which influencer generated the most revenue
- `GET /admin/ai-analytics` → average cost per story, cost by provider, cost by operation
