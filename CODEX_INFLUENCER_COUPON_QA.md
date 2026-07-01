# Codex Task: Influencer + Coupon + Commission Backend QA

## One-line prompt for Codex

`Run all tests in apps/api/src/influencers/influencer-coupon-commission.spec.ts, fix any failures caused by API contract changes, and verify the public /influencers/coupon/validate endpoint now accepts subtotalAmount/productIds/categoryIds in the request body and passes them to validateCoupon as context.`

---

## Full context for Codex

### What was built
The HeroKids Universe API has a full influencer + coupon + commission module. The relevant files are:

- `apps/api/src/influencers/influencers.service.ts` — all business logic
- `apps/api/src/influencers/influencer-public.controller.ts` — public coupon validate endpoint
- `apps/api/src/influencers/admin-influencers.controller.ts` — admin CRUD
- `apps/api/src/influencers/influencer-portal.controller.ts` — influencer self-service
- `apps/api/src/admin/admin.controller.ts` + `admin.service.ts` — platform coupon endpoints
- `apps/api/src/merchandise/orders/order-v2.service.ts` — order creation with coupon application

### What was fixed in this session
1. **`apps/api/src/influencers/influencer-public.controller.ts`** — The public `POST /influencers/coupon/validate` endpoint was ignoring `subtotalAmount`, `productIds`, and `categoryIds` from the request body. Fixed to pass them as context to `validateCoupon()`.

### What to verify in Codex

1. **The fix is in place**: In `influencer-public.controller.ts`, the `validateCoupon` method should pass context:
   ```typescript
   validateCoupon(@Body() body: { code: string; subtotalAmount?: number; productIds?: string[]; categoryIds?: string[] }) {
     return this.influencersService.validateCoupon(body.code, {
       subtotalAmount: body.subtotalAmount,
       productIds: body.productIds,
       categoryIds: body.categoryIds,
     });
   }
   ```

2. **Run the integration test suite** (requires API running on port 3000):
   ```bash
   cd apps/api
   npx jest influencer-coupon-commission --forceExit --no-coverage
   ```
   Expected: 55 tests pass.

3. **Run all test suites** to check for regressions:
   ```bash
   npx jest --forceExit --no-coverage
   ```
   Expected: 116 tests pass (5 suites).

### Business rules encoded in tests
- Commission base = `subtotalAmount - discountAmount` (after discount, not before)
- Flat discount is capped at subtotal (never negative total)
- Percentage discount is capped at `maxDiscountAmount` if set
- Coupon validation rejects: expired, future, inactive, usage limit reached, influencer inactive
- Case-insensitive coupon code lookup (ILike)
- Platform coupons (`couponType=platform`) require no active influencer check
- Commission reversal: cancelling/refunding an order sets commission status → `cancelled` and deducts from wallet

### Known remaining gaps (not in scope for Codex)
- No real order creation test (Razorpay not configured in dev)
- Per-user usage limit (single-use per user) — entity field `usageLimit` is global, no per-user tracking column exists
- Coupon usage only increments after successful payment (Razorpay webhook), not at order creation
