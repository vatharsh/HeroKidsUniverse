/**
 * Per-User Coupon Usage Limit Tests
 *
 * Verifies that:
 * - perUserUsageLimit field is stored and returned on coupons
 * - Validate endpoint rejects when userId has reached per-user limit
 * - Validate passes for a different user even when one user is at limit
 * - Validate passes when no userId provided (backwards-compatible)
 * - Cancelled/reversed orders remove usage record (re-use allowed)
 * - Global usageLimit and perUserUsageLimit work independently
 * - Platform coupons respect perUserUsageLimit
 * - RBAC: per-user check requires userId in request body (not forced on public endpoint)
 * - No duplicate usage records for same orderId (unique constraint)
 */

import { Pool } from 'pg';

const API = 'http://localhost:3000/api';
const DB_URL = 'postgresql://user:pass@localhost:5432/heroverse';

async function login(email: string, password: string): Promise<string> {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Login failed for ${email}: ${res.status}`);
  const json = (await res.json()) as { data: { accessToken: string } };
  return json.data.accessToken;
}

async function apiFetch(path: string, token: string, method = 'GET', body?: object) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: (await res.json().catch(() => null)) as Record<string, unknown> };
}

async function publicPost(path: string, body: object) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: (await res.json().catch(() => null)) as Record<string, unknown> };
}

async function dbQuery(sql: string, params: unknown[] = []) {
  const pool = new Pool({ connectionString: DB_URL });
  try {
    const result = await pool.query(sql, params);
    return result.rows;
  } finally {
    await pool.end();
  }
}

async function getUserId(email: string): Promise<string> {
  const rows = await dbQuery('SELECT id FROM users WHERE email = $1 LIMIT 1', [email]);
  return rows[0]?.id ?? '';
}

async function insertUsageRecord(couponCodeId: string, userId: string, orderId: string) {
  await dbQuery(
    `INSERT INTO coupon_usage_records (id, "couponCodeId", "userId", "orderId", "createdAt")
     VALUES (gen_random_uuid(), $1, $2, $3, NOW())
     ON CONFLICT ("orderId") DO NOTHING`,
    [couponCodeId, userId, orderId],
  );
}

async function deleteUsageRecords(couponCodeId: string, userId?: string) {
  if (userId) {
    await dbQuery(
      `DELETE FROM coupon_usage_records WHERE "couponCodeId" = $1 AND "userId" = $2`,
      [couponCodeId, userId],
    );
  } else {
    await dbQuery(`DELETE FROM coupon_usage_records WHERE "couponCodeId" = $1`, [couponCodeId]);
  }
}

describe('Per-User Coupon Usage Limit', () => {
  let adminToken: string;
  let influencerId: string;
  let puulCouponId: string;
  let platformCouponId: string;
  let parentUserId: string;
  let adminUserId: string;

  const PUUL_CODE = `PUUL_${Date.now()}`;
  const PLAT_PUUL_CODE = `PLATPUUL_${Date.now()}`;
  const ORDER_SIM_1 = `00000000-0000-0000-0000-${String(Date.now()).slice(-12)}`;
  const ORDER_SIM_2 = `00000000-0000-0001-0000-${String(Date.now()).slice(-12)}`;

  beforeAll(async () => {
    adminToken = await login('admin@herokids.com', 'admin@123');
    parentUserId = await getUserId('vatharsh@gmail.com');
    adminUserId = await getUserId('admin@herokids.com');

    const rows = await dbQuery(
      `SELECT id FROM influencers WHERE name = 'Mom Blogger Test' AND "isDeleted" = false LIMIT 1`,
    );
    influencerId = rows[0]?.id ?? '';
  }, 15000);

  // ─── Coupon Creation with perUserUsageLimit ───────────────────────────────────

  describe('Coupon creation and schema', () => {
    it('Creates influencer coupon with perUserUsageLimit=1', async () => {
      const { status, json } = await apiFetch(
        `/admin/influencers/${influencerId}/coupons`,
        adminToken,
        'POST',
        {
          code: PUUL_CODE,
          discountType: 'percentage',
          discountValue: 10,
          perUserUsageLimit: 1,
          isActive: true,
        },
      );
      expect(status).toBe(201);
      const c = (json?.data ?? {}) as Record<string, unknown>;
      expect(c.code).toBe(PUUL_CODE);
      expect(Number(c.perUserUsageLimit)).toBe(1);
      puulCouponId = c.id as string;
    });

    it('Existing coupons without perUserUsageLimit default to null (unlimited)', async () => {
      const { json } = await apiFetch(`/admin/influencers/${influencerId}/coupons`, adminToken);
      const coupons = (json?.data ?? []) as Array<{ code: string; perUserUsageLimit: unknown }>;
      const existing = coupons.find((c) => c.code === 'MOM10');
      if (existing) {
        expect(existing.perUserUsageLimit).toBeNull();
      }
    });

    it('Creates platform coupon with perUserUsageLimit=2', async () => {
      const { status, json } = await apiFetch('/admin/coupons/platform', adminToken, 'POST', {
        code: PLAT_PUUL_CODE,
        discountType: 'percentage',
        discountValue: 5,
        perUserUsageLimit: 2,
        isActive: true,
      });
      expect([200, 201]).toContain(status);
      const c = (json?.id ? json : (json?.data as Record<string, unknown>)) ?? {};
      expect(Number(c.perUserUsageLimit)).toBe(2);
      platformCouponId = c.id as string;
    });

    it('PATCH /admin/influencers/:id/coupons/:cid can set perUserUsageLimit', async () => {
      const { status, json } = await apiFetch(
        `/admin/influencers/${influencerId}/coupons/${puulCouponId}`,
        adminToken,
        'PATCH',
        { perUserUsageLimit: 3 },
      );
      expect(status).toBe(200);
      expect(Number((json?.data as Record<string, unknown>)?.perUserUsageLimit)).toBe(3);
      // Reset back to 1 for test isolation
      await apiFetch(
        `/admin/influencers/${influencerId}/coupons/${puulCouponId}`,
        adminToken,
        'PATCH',
        { perUserUsageLimit: 1 },
      );
    });

    it('PATCH /admin/coupons/:id can set perUserUsageLimit to null (remove limit)', async () => {
      const { status, json } = await apiFetch(`/admin/coupons/${platformCouponId}`, adminToken, 'PATCH', {
        perUserUsageLimit: null,
      });
      expect([200, 201]).toContain(status);
      const c = (json?.id ? json : (json?.data as Record<string, unknown>)) ?? {};
      expect(c.perUserUsageLimit).toBeNull();
      // Restore
      await apiFetch(`/admin/coupons/${platformCouponId}`, adminToken, 'PATCH', { perUserUsageLimit: 2 });
    });
  });

  // ─── Validate: no userId (backwards compatible) ───────────────────────────────

  describe('Validation: without userId (per-user check skipped)', () => {
    it('Valid coupon with no userId returns valid=true regardless of per-user limit', async () => {
      const { json } = await publicPost('/influencers/coupon/validate', { code: PUUL_CODE });
      const d = (json?.data ?? {}) as Record<string, unknown>;
      expect(d.valid).toBe(true);
      expect(d.perUserUsageLimit).toBe(1);
    });

    it('Returns perUserUsageLimit field in valid response', async () => {
      const { json } = await publicPost('/influencers/coupon/validate', { code: PUUL_CODE });
      const d = (json?.data ?? {}) as Record<string, unknown>;
      expect(d.perUserUsageLimit).toBeDefined();
    });
  });

  // ─── Validate: with userId, no prior usage ────────────────────────────────────

  describe('Validation: userId present, no prior usage', () => {
    beforeAll(async () => {
      await deleteUsageRecords(puulCouponId, parentUserId);
      await deleteUsageRecords(puulCouponId, adminUserId);
    });

    it('Valid for user with no prior usage', async () => {
      const { json } = await publicPost('/influencers/coupon/validate', {
        code: PUUL_CODE,
        userId: parentUserId,
      });
      const d = (json?.data ?? {}) as Record<string, unknown>;
      expect(d.valid).toBe(true);
    });

    it('Valid for different user with no prior usage', async () => {
      const { json } = await publicPost('/influencers/coupon/validate', {
        code: PUUL_CODE,
        userId: adminUserId,
      });
      const d = (json?.data ?? {}) as Record<string, unknown>;
      expect(d.valid).toBe(true);
    });
  });

  // ─── Validate: user at limit ──────────────────────────────────────────────────

  describe('Validation: user at per-user limit', () => {
    beforeAll(async () => {
      await deleteUsageRecords(puulCouponId);
      await insertUsageRecord(puulCouponId, parentUserId, ORDER_SIM_1);
    });

    it('Rejects when userId has reached perUserUsageLimit=1', async () => {
      const { json } = await publicPost('/influencers/coupon/validate', {
        code: PUUL_CODE,
        userId: parentUserId,
      });
      const d = (json?.data ?? {}) as Record<string, unknown>;
      expect(d.valid).toBe(false);
      expect(d.errorMessage).toMatch(/already used/i);
    });

    it('Different user can still use same coupon (tenant isolation)', async () => {
      const { json } = await publicPost('/influencers/coupon/validate', {
        code: PUUL_CODE,
        userId: adminUserId,
      });
      const d = (json?.data ?? {}) as Record<string, unknown>;
      expect(d.valid).toBe(true);
    });

    it('No userId passes validation even when one user is at limit', async () => {
      const { json } = await publicPost('/influencers/coupon/validate', { code: PUUL_CODE });
      const d = (json?.data ?? {}) as Record<string, unknown>;
      expect(d.valid).toBe(true);
    });

    it('Global usageLimit check still works independently', async () => {
      // Temporarily set global limit=1, usageCount=1
      await dbQuery(
        `UPDATE influencer_coupon_codes SET "usageLimit" = 1, "usageCount" = 1 WHERE id = $1`,
        [puulCouponId],
      );
      const { json } = await publicPost('/influencers/coupon/validate', { code: PUUL_CODE });
      const d = (json?.data ?? {}) as Record<string, unknown>;
      expect(d.valid).toBe(false);
      expect(d.errorMessage).toMatch(/usage limit reached/i);
      // Restore
      await dbQuery(
        `UPDATE influencer_coupon_codes SET "usageLimit" = NULL, "usageCount" = 1 WHERE id = $1`,
        [puulCouponId],
      );
    });
  });

  // ─── Platform coupon per-user limit ──────────────────────────────────────────

  describe('Platform coupon per-user limit', () => {
    beforeAll(async () => {
      await deleteUsageRecords(platformCouponId);
    });

    it('Platform coupon valid with no prior usage for user', async () => {
      const { json } = await publicPost('/influencers/coupon/validate', {
        code: PLAT_PUUL_CODE,
        userId: parentUserId,
      });
      const d = (json?.data ?? {}) as Record<string, unknown>;
      expect(d.valid).toBe(true);
      expect(d.couponType).toBe('platform');
    });

    it('Platform coupon rejects after 2 usages for same user (perUserUsageLimit=2)', async () => {
      await insertUsageRecord(platformCouponId, parentUserId, `00000000-0000-0002-0000-${String(Date.now()).slice(-12)}`);
      await insertUsageRecord(platformCouponId, parentUserId, `00000000-0000-0003-0000-${String(Date.now()).slice(-12)}`);

      const { json } = await publicPost('/influencers/coupon/validate', {
        code: PLAT_PUUL_CODE,
        userId: parentUserId,
      });
      const d = (json?.data ?? {}) as Record<string, unknown>;
      expect(d.valid).toBe(false);
      expect(d.errorMessage).toMatch(/already used/i);
    });

    it('Different user can still use platform coupon after another is at limit', async () => {
      const { json } = await publicPost('/influencers/coupon/validate', {
        code: PLAT_PUUL_CODE,
        userId: adminUserId,
      });
      const d = (json?.data ?? {}) as Record<string, unknown>;
      expect(d.valid).toBe(true);
    });
  });

  // ─── Reversal restores usage ──────────────────────────────────────────────────

  describe('Reversal removes usage record (cancelled order re-enables coupon)', () => {
    let cancelOrderId: string;
    const CANCEL_ORDER_NUM = `ORD-PUUL-CANCEL-${Date.now()}`;

    beforeAll(async () => {
      await deleteUsageRecords(puulCouponId);

      cancelOrderId = `00000000-0000-0010-0000-${String(Date.now()).slice(-12)}`;

      // Clean up any leftover order/commission with the same id (from prior runs)
      await dbQuery(
        `DELETE FROM influencer_commissions WHERE "orderId" = $1`,
        [cancelOrderId],
      );
      await dbQuery(`DELETE FROM orders WHERE id = $1`, [cancelOrderId]);

      // Insert a real order record (needed for admin status update endpoint)
      await dbQuery(
        `INSERT INTO orders (id, "userId", status, "orderType", "orderNumber", "totalAmount", "subtotalAmount", "shippingAmount", "discountAmount", "couponCode", "couponCodeId", "influencerId", "isSandbox", "isDeleted", "createdAt", "updatedAt")
         VALUES ($1, $2, 'paid', 'digital', $3, 900.00, 1000.00, 0.00, 100.00, $4, $5, $6, true, false, NOW(), NOW())`,
        [cancelOrderId, parentUserId, CANCEL_ORDER_NUM, PUUL_CODE, puulCouponId, influencerId],
      );
      // Insert commission
      await dbQuery(
        `INSERT INTO influencer_commissions (id, "influencerId", "couponCodeId", "orderId", "orderNumber", "userId", "subtotalAmount", "orderTotal", "discountAmount", "commissionableAmount", "commissionRate", "commissionAmount", status, "earnedAt", "paidAt", "payoutId", "isDeleted", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 1000, 900, 100, 900, 10, 90, 'approved', NOW(), NULL, NULL, false, NOW(), NOW())`,
        [influencerId, puulCouponId, cancelOrderId, CANCEL_ORDER_NUM, parentUserId],
      );
      // Insert usage record
      await insertUsageRecord(puulCouponId, parentUserId, cancelOrderId);
    }, 10000);

    it('User is at limit before reversal', async () => {
      const { json } = await publicPost('/influencers/coupon/validate', {
        code: PUUL_CODE,
        userId: parentUserId,
      });
      const d = (json?.data ?? {}) as Record<string, unknown>;
      expect(d.valid).toBe(false);
      expect(d.errorMessage).toMatch(/already used/i);
    });

    it('Cancelling order removes usage record (via admin status update)', async () => {
      const { status } = await apiFetch(
        `/admin/v2/orders/${cancelOrderId}/status`,
        adminToken,
        'PATCH',
        { status: 'cancelled', note: 'PUUL reversal test' },
      );
      expect(status).toBe(200);

      // Usage record should be gone
      const rows = await dbQuery(
        `SELECT id FROM coupon_usage_records WHERE "couponCodeId" = $1 AND "orderId" = $2`,
        [puulCouponId, cancelOrderId],
      );
      expect(rows.length).toBe(0);
    });

    it('User can use coupon again after reversal', async () => {
      const { json } = await publicPost('/influencers/coupon/validate', {
        code: PUUL_CODE,
        userId: parentUserId,
      });
      const d = (json?.data ?? {}) as Record<string, unknown>;
      expect(d.valid).toBe(true);
    });

    it('Commission status is cancelled after reversal', async () => {
      const rows = await dbQuery(
        `SELECT status FROM influencer_commissions WHERE "orderId" = $1 AND "isDeleted" = false`,
        [cancelOrderId],
      );
      expect(rows[0]?.status).toBe('cancelled');
    });
  });

  // ─── DB: unique constraint on orderId ────────────────────────────────────────

  describe('Database integrity', () => {
    it('Unique constraint prevents duplicate usage record for same orderId', async () => {
      await deleteUsageRecords(puulCouponId, parentUserId);
      await insertUsageRecord(puulCouponId, parentUserId, ORDER_SIM_2);
      await expect(
        insertUsageRecord(puulCouponId, parentUserId, ORDER_SIM_2),
      ).resolves.not.toThrow();
      // ON CONFLICT DO NOTHING means no duplicate, no error
      const rows = await dbQuery(
        `SELECT COUNT(*) as cnt FROM coupon_usage_records WHERE "orderId" = $1`,
        [ORDER_SIM_2],
      );
      expect(Number(rows[0]?.cnt)).toBe(1);
    });

    it('coupon_usage_records table exists with correct schema', async () => {
      const rows = await dbQuery(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'coupon_usage_records' ORDER BY column_name`,
      );
      const cols = rows.map((r: { column_name: string }) => r.column_name);
      expect(cols).toContain('couponCodeId');
      expect(cols).toContain('userId');
      expect(cols).toContain('orderId');
      expect(cols).toContain('createdAt');
    });

    it('perUserUsageLimit column exists on influencer_coupon_codes', async () => {
      const rows = await dbQuery(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'influencer_coupon_codes' AND column_name = 'perUserUsageLimit'`,
      );
      expect(rows.length).toBe(1);
    });
  });

  // ─── Cleanup ──────────────────────────────────────────────────────────────────

  afterAll(async () => {
    if (puulCouponId) {
      await deleteUsageRecords(puulCouponId);
      await apiFetch(
        `/admin/influencers/${influencerId}/coupons/${puulCouponId}`,
        adminToken,
        'PATCH',
        { isActive: false },
      );
    }
    if (platformCouponId) {
      await deleteUsageRecords(platformCouponId);
    }
  });
});
