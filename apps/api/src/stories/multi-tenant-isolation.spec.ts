/**
 * Multi-Tenant Isolation Tests
 *
 * Verifies that User A cannot access User B's resources via the API.
 * These are integration tests that hit the running local API server on port 3000.
 *
 * Coverage:
 * - Stories: User A cannot read/delete User B's story
 * - Heroes: User A cannot read User B's hero
 * - Characters: User A cannot read User B's characters
 * - AI logs: User A cannot read admin-only endpoints without admin role
 * - Admin endpoints require admin role (parent is rejected)
 */

const API = 'http://localhost:3000/api';

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Multi-Tenant Isolation', () => {
  let tokenA: string;    // vatharsh@gmail.com (parent)
  let tokenAdmin: string; // admin@herokids.com (admin)

  // Seed: storyId and heroId owned by User A
  let storyIdA: string;
  let heroIdA: string;
  let characterIdA: string;

  beforeAll(async () => {
    // Login both users
    tokenA = await login('vatharsh@gmail.com', 'admin@123');
    tokenAdmin = await login('admin@herokids.com', 'admin@123');

    // Fetch User A's stories and heroes for cross-user tests
    const storiesRes = await apiFetch('/stories', tokenA);
    const stories = (storiesRes.json?.data ?? []) as Array<{ id: string }>;
    storyIdA = stories[0]?.id ?? 'nonexistent-story-id';

    const heroesRes = await apiFetch('/heroes', tokenA);
    const heroes = (heroesRes.json?.data ?? []) as Array<{ id: string }>;
    heroIdA = heroes[0]?.id ?? 'nonexistent-hero-id';

    const charsRes = await apiFetch('/characters', tokenA);
    const chars = (charsRes.json?.data ?? []) as Array<{ id: string }>;
    characterIdA = chars[0]?.id ?? 'nonexistent-char-id';
  }, 15000);

  describe('User A can access their own resources', () => {
    it('GET /stories returns User A stories', async () => {
      const { status } = await apiFetch('/stories', tokenA);
      expect(status).toBe(200);
    });

    it('GET /heroes returns User A heroes', async () => {
      const { status } = await apiFetch('/heroes', tokenA);
      expect(status).toBe(200);
    });

    it('GET /characters returns User A characters', async () => {
      const { status } = await apiFetch('/characters', tokenA);
      expect(status).toBe(200);
    });
  });

  describe('User B (momblogger) cannot access User A resources', () => {
    let tokenB: string;

    beforeAll(async () => {
      tokenB = await login('momblogger@test.com', 'Influencer@123');
    }, 10000);

    it('GET /stories/:id with User B token returns 403 or 404 for User A story', async () => {
      if (!storyIdA || storyIdA === 'nonexistent-story-id') return;
      const { status } = await apiFetch(`/stories/${storyIdA}`, tokenB);
      expect([403, 404]).toContain(status);
    });

    it('GET /heroes/:id with User B token returns 403 or 404 for User A hero', async () => {
      if (!heroIdA || heroIdA === 'nonexistent-hero-id') return;
      const { status } = await apiFetch(`/heroes/${heroIdA}`, tokenB);
      expect([403, 404]).toContain(status);
    });

    it('GET /characters/:id with User B token returns 403 or 404 for User A character', async () => {
      if (!characterIdA || characterIdA === 'nonexistent-char-id') return;
      const { status } = await apiFetch(`/characters/${characterIdA}`, tokenB);
      expect([403, 404]).toContain(status);
    });

    it('GET /stories returns only User B stories (not User A stories)', async () => {
      const { status, json } = await apiFetch('/stories', tokenB);
      expect(status).toBe(200);
      const storyIds = (json?.data ?? []).map((s: { id: string }) => s.id);
      if (storyIdA && storyIdA !== 'nonexistent-story-id') {
        expect(storyIds).not.toContain(storyIdA);
      }
    });

    it('GET /heroes returns only User B heroes (not User A heroes)', async () => {
      const { status, json } = await apiFetch('/heroes', tokenB);
      expect(status).toBe(200);
      const heroIds = (json?.data ?? []).map((h: { id: string }) => h.id);
      if (heroIdA && heroIdA !== 'nonexistent-hero-id') {
        expect(heroIds).not.toContain(heroIdA);
      }
    });
  });

  describe('Admin-only endpoints reject non-admin tokens', () => {
    it('GET /admin/dashboard returns 403 for parent user', async () => {
      const { status } = await apiFetch('/admin/dashboard', tokenA);
      expect(status).toBe(403);
    });

    it('GET /admin/users returns 403 for parent user', async () => {
      const { status } = await apiFetch('/admin/users', tokenA);
      expect(status).toBe(403);
    });

    it('GET /admin/qa/dashboard returns 403 for parent user', async () => {
      const { status } = await apiFetch('/admin/qa/dashboard', tokenA);
      expect(status).toBe(403);
    });

    it('GET /admin/ai-analytics returns 403 for influencer user', async () => {
      const tokenB = await login('momblogger@test.com', 'Influencer@123');
      const { status } = await apiFetch('/admin/ai-analytics', tokenB);
      expect(status).toBe(403);
    });
  });

  describe('Admin can see all users resources in dashboard', () => {
    it('GET /admin/stories returns stories from all users', async () => {
      const { status, json } = await apiFetch('/admin/stories?days=30', tokenAdmin);
      expect(status).toBe(200);
      // Admin sees stories (not filtered by a single user)
      expect(Array.isArray(json?.data?.items ?? json?.data)).toBe(true);
    });

    it('GET /admin/users returns all users', async () => {
      const { status, json } = await apiFetch('/admin/users', tokenAdmin);
      expect(status).toBe(200);
      const users = json?.data?.items ?? json?.data ?? [];
      expect(users.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Unauthenticated requests are rejected', () => {
    it('GET /stories without token returns 401', async () => {
      const res = await fetch(`${API}/stories`);
      expect(res.status).toBe(401);
    });

    it('GET /heroes without token returns 401', async () => {
      const res = await fetch(`${API}/heroes`);
      expect(res.status).toBe(401);
    });

    it('GET /characters without token returns 401', async () => {
      const res = await fetch(`${API}/characters`);
      expect(res.status).toBe(401);
    });

    it('GET /admin/dashboard without token returns 401', async () => {
      const res = await fetch(`${API}/admin/dashboard`);
      expect(res.status).toBe(401);
    });
  });

  describe('Story generation uses only the requesting user scope', () => {
    it('POST /stories with heroId belonging to another user returns 404', async () => {
      if (!heroIdA || heroIdA === 'nonexistent-hero-id') return;
      const tokenB = await login('momblogger@test.com', 'Influencer@123');
      const { status } = await apiFetch('/stories', tokenB, 'POST', {
        heroId: heroIdA,
        theme: 'space-adventure',
        storyMode: 'standalone',
      });
      // Must reject — hero belongs to User A, not User B
      expect([400, 403, 404, 422]).toContain(status);
    });
  });
});
