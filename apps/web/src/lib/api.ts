const BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

// ── Token storage ────────────────────────────────────────────────────────────

const ACCESS_KEY = "hvu_access";
const REFRESH_KEY = "hvu_refresh";

export function getAccessToken() {
  return typeof window !== "undefined" ? localStorage.getItem(ACCESS_KEY) : null;
}
export function getRefreshToken() {
  return typeof window !== "undefined" ? localStorage.getItem(REFRESH_KEY) : null;
}
export function setTokens(access: string, refresh: string) {
  localStorage.setItem(ACCESS_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
}
export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

// ── Error class ──────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: { message: string | string[]; error?: string },
  ) {
    const msg = Array.isArray(body.message) ? body.message.join(", ") : body.message;
    super(msg);
  }
}

// ── Core fetch wrapper ───────────────────────────────────────────────────────

async function request<T>(
  path: string,
  options: RequestInit = {},
  _isRetry = false,
): Promise<T> {
  const token = getAccessToken();

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  // Token expired — try silent refresh once
  if (res.status === 401 && !_isRetry) {
    const refresh = getRefreshToken();
    if (refresh) {
      const refreshRes = await fetch(`${BASE}/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${refresh}`,
        },
      });
      if (refreshRes.ok) {
        const { data } = await refreshRes.json();
        setTokens(data.accessToken, data.refreshToken);
        return request<T>(path, options, true);
      }
    }
    clearTokens();
    throw new ApiError(401, { message: "Session expired. Please log in again." });
  }

  const body = await res.json();
  if (!res.ok) throw new ApiError(res.status, body);

  // Unwrap TransformInterceptor envelope: { success, data, timestamp }
  return (body as { data: T }).data;
}

// ── Typed API surface ────────────────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  plan: string;
  credits: number;
  characterSlotsTotal: number;
  characterSlotsUsed: number;
  avatarRefreshTokens: number;
  isPremium: boolean;
  referralCode: string;
  createdAt: string;
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

export const authApi = {
  register: (payload: {
    name: string;
    email: string;
    password: string;
    referralCode?: string;
  }) => request<Tokens>("/auth/register", { method: "POST", body: JSON.stringify(payload) }),

  login: (payload: { email: string; password: string }) =>
    request<Tokens>("/auth/login", { method: "POST", body: JSON.stringify(payload) }),

  me: () => request<User>("/auth/me"),

  logout: () => request<void>("/auth/logout", { method: "POST" }),
};

export const heroesApi = {
  list: () => request<unknown[]>("/heroes"),
  create: (payload: unknown) =>
    request<unknown>("/heroes", { method: "POST", body: JSON.stringify(payload) }),
};

export const storiesApi = {
  list: () => request<unknown[]>("/stories"),
  get: (id: string) => request<unknown>(`/stories/${id}`),
  create: (payload: unknown) =>
    request<unknown>("/stories", { method: "POST", body: JSON.stringify(payload) }),
};
