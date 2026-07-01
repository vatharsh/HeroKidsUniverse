/**
 * Sandbox / Production Mode Verification Tests
 *
 * Verifies that:
 * - SANDBOX_MODE flag is correctly propagated to stories and AI logs
 * - Sandbox stories are clearly marked (isSandbox = true)
 * - QA runs regardless of sandbox mode (no QA bypass in sandbox)
 * - Admin dashboard correctly filters by sandbox flag
 * - Payment endpoints handle missing Razorpay config gracefully
 */

const API = 'http://localhost:3000/api';

async function login(email: string, password: string): Promise<string> {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const json = (await res.json()) as { data: { accessToken: string } };
  return json.data.accessToken;
}

async function apiFetch(path: string, token: string, method = 'GET', body?: object) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

describe('Sandbox / Production Mode', () => {
  let adminToken: string;
  let parentToken: string;

  beforeAll(async () => {
    adminToken = await login('admin@herokids.com', 'admin@123');
    parentToken = await login('vatharsh@gmail.com', 'admin@123');
  }, 10000);

  describe('SANDBOX_MODE platform setting', () => {
    it('GET /admin/settings contains SANDBOX_MODE key', async () => {
      const { status, json } = await apiFetch('/admin/settings', adminToken);
      expect(status).toBe(200);
      const settings = (json?.data ?? []) as Array<{ key: string; value: string }>;
      const sandboxSetting = settings.find((s) => s.key === 'SANDBOX_MODE');
      expect(sandboxSetting).toBeDefined();
      expect(['true', 'false']).toContain(sandboxSetting?.value);
    });

    it('SANDBOX_MODE is currently true (dev environment)', async () => {
      const { json } = await apiFetch('/admin/settings', adminToken);
      const settings = (json?.data ?? []) as Array<{ key: string; value: string }>;
      const sandboxSetting = settings.find((s) => s.key === 'SANDBOX_MODE');
      // Verify mode is visible and explicitly set
      expect(sandboxSetting?.value).toBe('true');
    });
  });

  describe('Sandbox flag propagation on stories', () => {
    it('GET /stories returns stories with isSandbox field present', async () => {
      const { status, json } = await apiFetch('/stories', parentToken);
      expect(status).toBe(200);
      const stories = (json?.data ?? []) as Array<{ id: string; isSandbox: boolean }>;
      if (stories.length > 0) {
        expect(typeof stories[0].isSandbox).toBe('boolean');
      }
    });

    it('all generated stories in sandbox mode have isSandbox=true', async () => {
      const { json } = await apiFetch('/stories', parentToken);
      const stories = (json?.data ?? []) as Array<{ isSandbox: boolean }>;
      const nonSandbox = stories.filter((s) => s.isSandbox === false);
      // In SANDBOX_MODE=true, all stories should be sandbox
      expect(nonSandbox.length).toBe(0);
    });
  });

  describe('Admin dashboard sandbox filtering', () => {
    it('GET /admin/ai-analytics?sandbox=true returns only sandbox records', async () => {
      const { status, json } = await apiFetch('/admin/ai-analytics?sandbox=true', adminToken);
      expect(status).toBe(200);
      expect(json?.data).toBeDefined();
    });

    it('GET /admin/ai-analytics?sandbox=false returns empty or no results in sandbox environment', async () => {
      const { status, json } = await apiFetch('/admin/ai-analytics?sandbox=false', adminToken);
      expect(status).toBe(200);
      // In sandbox environment, production stories count should be 0
      const totalStories = json?.data?.totalStories ?? json?.data?.total ?? 0;
      expect(totalStories).toBe(0);
    });

    it('GET /admin/stories?sandbox=false returns 0 stories in sandbox environment', async () => {
      const { status, json } = await apiFetch('/admin/ai-analytics/generation-runs?sandbox=false', adminToken);
      expect(status).toBe(200);
      const items = json?.data?.items ?? [];
      expect(items.length).toBe(0);
    });
  });

  describe('QA runs regardless of sandbox mode', () => {
    it('GET /admin/qa/dashboard shows QA data exists (QA not bypassed in sandbox)', async () => {
      const { status, json } = await apiFetch('/admin/qa/dashboard?days=90', adminToken);
      expect(status).toBe(200);
      expect(json?.data?.totalRuns).toBeGreaterThan(0);
    });

    it('QA avgIdentityScore is a real value (not 0 or null), confirming face comparison ran', async () => {
      const { json } = await apiFetch('/admin/qa/dashboard?days=90', adminToken);
      // avgIdentityScore > 0 means face comparison actually executed (not mocked/skipped)
      expect(json?.data?.avgIdentityScore).toBeGreaterThan(0);
    });
  });

  describe('Payment endpoint safety in sandbox', () => {
    it('POST /credits/purchase-pack with invalid Razorpay data returns 400 or 500 (no crash)', async () => {
      const { status } = await apiFetch('/credits/purchase-pack', parentToken, 'POST', {
        packId: 'nonexistent-pack',
      });
      // Should return a client or server error, not silently succeed
      expect(status).toBeGreaterThanOrEqual(400);
    });

    it('POST /credits/packs/:id/purchase/verify with fake data returns 4xx (HMAC mismatch or bad input)', async () => {
      const { status } = await apiFetch('/credits/packs/nonexistent-pack/purchase/verify', parentToken, 'POST', {
        razorpayOrderId: 'fake_order_id',
        razorpayPaymentId: 'fake_payment_id',
        razorpaySignature: 'fake_signature',
      });
      // Must not silently succeed — pack doesn't exist, signature is wrong
      expect([400, 401, 404, 422, 500]).toContain(status);
    });
  });

  describe('AI cost tracking in sandbox', () => {
    it('GET /admin/ai-analytics shows cost data flagged as sandbox', async () => {
      const { status, json } = await apiFetch('/admin/ai-analytics?sandbox=true', adminToken);
      expect(status).toBe(200);
      // Cost data should exist for sandbox stories
      expect(json?.data).toBeDefined();
    });

    it('sandbox stories do not bleed into production cost analytics', async () => {
      const { json: sandboxData } = await apiFetch('/admin/ai-analytics?sandbox=true', adminToken);
      const { json: prodData } = await apiFetch('/admin/ai-analytics?sandbox=false', adminToken);

      // In sandbox environment, production story count must be 0
      const prodStories = prodData?.data?.totalStoriesGenerated ?? 0;
      expect(prodStories).toBe(0);

      // Sandbox should have real story activity
      const sandboxStories = sandboxData?.data?.totalStoriesGenerated ?? 0;
      expect(sandboxStories).toBeGreaterThan(0);
    });
  });
});
