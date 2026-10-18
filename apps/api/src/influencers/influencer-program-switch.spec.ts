/**
 * Influencer Programme Switch Tests (integration — requires the local API on :3000)
 *
 * Verifies that turning ENABLE_INFLUENCER_PROGRAM off in admin settings:
 * - blocks influencer login with a clear "paused" message
 * - blocks the influencer portal API for influencers who are already logged in
 * - rejects influencer coupon codes, while platform coupons keep working
 * - leaves the admin influencer tools and parent login untouched
 * and that turning it back on restores everything.
 */

const API = 'http://localhost:3000/api';
const SETTING_KEY = 'ENABLE_INFLUENCER_PROGRAM';

async function rawLogin(email: string, password: string) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return { status: res.status, json: (await res.json().catch(() => null)) as Record<string, unknown> };
}

async function login(email: string, password: string): Promise<string> {
  const { status, json } = await rawLogin(email, password);
  if (status !== 200 && status !== 201) throw new Error(`Login failed for ${email}: ${status}`);
  return (json.data as { accessToken: string }).accessToken;
}

async function apiFetch(path: string, token: string, method = 'GET', body?: object) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: (await res.json().catch(() => null)) as Record<string, unknown> };
}

async function validateCoupon(code: string) {
  const res = await fetch(`${API}/influencers/coupon/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  const json = (await res.json()) as { data: { valid: boolean; errorMessage?: string } };
  return json.data;
}

describe('Influencer programme switch', () => {
  const stamp = Date.now();
  const INFLUENCER_EMAIL = `qa_switch_${stamp}@test.com`;
  const INFLUENCER_PASSWORD = 'Influencer@123';
  const INFLUENCER_CODE = `QASWITCH${stamp}`;
  const PLATFORM_CODE = `QAPLATSWITCH${stamp}`;

  let adminToken: string;
  let influencerId: string;
  let influencerToken: string;
  let platformCouponId: string;
  let originalValue: unknown;

  const setProgramme = async (enabled: boolean) => {
    const { status } = await apiFetch(`/admin/settings/${SETTING_KEY}`, adminToken, 'PATCH', { value: enabled });
    expect(status).toBe(200);
  };

  beforeAll(async () => {
    adminToken = await login('admin@herokids.com', 'admin@123');

    const settings = await apiFetch('/admin/settings', adminToken);
    const rows = (settings.json.data ?? []) as Array<{ key: string; value: unknown }>;
    originalValue = rows.find((row) => row.key === SETTING_KEY)?.value;

    // Set up while the programme is on, exactly as an admin would before launch.
    await setProgramme(true);

    const inf = await apiFetch('/admin/influencers', adminToken, 'POST', {
      name: 'QA Switch Influencer',
      email: INFLUENCER_EMAIL,
      phone: '9000000099',
      platform: 'instagram',
      socialHandle: '@qa_switch',
      status: 'active',
    });
    influencerId = (inf.json.data as { id: string }).id;
    await apiFetch(`/admin/influencers/${influencerId}/login`, adminToken, 'POST', {
      email: INFLUENCER_EMAIL,
      password: INFLUENCER_PASSWORD,
    });
    await apiFetch(`/admin/influencers/${influencerId}/coupons`, adminToken, 'POST', {
      code: INFLUENCER_CODE,
      discountType: 'percentage',
      discountValue: 10,
      isActive: true,
    });
    const platform = await apiFetch('/admin/coupons/platform', adminToken, 'POST', {
      code: PLATFORM_CODE,
      discountType: 'percentage',
      discountValue: 5,
      isActive: true,
    });
    const platformCoupon = (platform.json?.id ? platform.json : platform.json?.data) as { id: string };
    platformCouponId = platformCoupon.id;

    influencerToken = await login(INFLUENCER_EMAIL, INFLUENCER_PASSWORD);
  }, 20000);

  describe('when the programme is OFF', () => {
    beforeAll(async () => {
      await setProgramme(false);
    });

    it('exposes the flag as false publicly (drives the paused portal screen)', async () => {
      const res = await fetch(`${API}/platform-settings`);
      const json = (await res.json()) as { data: Array<{ key: string; value: string }> };
      expect(json.data.find((s) => s.key === SETTING_KEY)?.value).toBe('false');
    });

    it('blocks influencer login with a paused message', async () => {
      const { status, json } = await rawLogin(INFLUENCER_EMAIL, INFLUENCER_PASSWORD);
      expect(status).toBe(401);
      expect(json.message).toBe('The influencer programme is currently paused');
    });

    it('blocks the portal API for an influencer who is already logged in', async () => {
      for (const path of ['/influencer/me', '/influencer/dashboard-summary', '/influencer/orders', '/influencer/payouts']) {
        const { status } = await apiFetch(path, influencerToken);
        expect(status).toBe(403);
      }
    });

    it('rejects influencer coupon codes', async () => {
      const result = await validateCoupon(INFLUENCER_CODE);
      expect(result.valid).toBe(false);
      expect(result.errorMessage).toBe('This coupon is no longer available.');
    });

    it('keeps platform coupons working', async () => {
      expect((await validateCoupon(PLATFORM_CODE)).valid).toBe(true);
    });

    it('keeps admin influencer tools available', async () => {
      const { status } = await apiFetch(`/admin/influencers/${influencerId}`, adminToken);
      expect(status).toBe(200);
    });

    it('does not affect parent login', async () => {
      const { status } = await rawLogin('vatharsh@gmail.com', 'admin@123');
      expect(status).toBeLessThan(300);
    });
  });

  describe('when the programme is turned back ON', () => {
    beforeAll(async () => {
      await setProgramme(true);
    });

    it('allows influencer login again', async () => {
      const { status } = await rawLogin(INFLUENCER_EMAIL, INFLUENCER_PASSWORD);
      expect(status).toBeLessThan(300);
    });

    it('re-opens the portal API', async () => {
      const { status } = await apiFetch('/influencer/me', influencerToken);
      expect(status).toBe(200);
    });

    it('accepts influencer coupon codes again', async () => {
      expect((await validateCoupon(INFLUENCER_CODE)).valid).toBe(true);
    });
  });

  afterAll(async () => {
    if (!adminToken) return;
    if (influencerId) await apiFetch(`/admin/influencers/${influencerId}`, adminToken, 'DELETE');
    if (platformCouponId) await apiFetch(`/admin/coupons/${platformCouponId}`, adminToken, 'PATCH', { isActive: false });
    if (originalValue !== undefined) {
      await apiFetch(`/admin/settings/${SETTING_KEY}`, adminToken, 'PATCH', { value: originalValue });
    }
  });
});
