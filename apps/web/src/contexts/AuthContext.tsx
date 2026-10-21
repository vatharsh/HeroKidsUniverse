"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import {
  ApiError,
  type User,
  authApi,
  clearTokens,
  getAccessToken,
  setTokens,
} from "@/lib/api";

// ── Types ────────────────────────────────────────────────────────────────────

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (
    name: string,
    email: string,
    password: string,
    referralCode?: string,
  ) => Promise<User>;
  logout: () => Promise<void>;
  /** Re-reads the signed-in user (e.g. after verifying their email). */
  refreshUser: () => Promise<User | null>;
}

/** Pages a parent can still open before verifying their email. */
const OPEN_BEFORE_VERIFICATION = ["/verify-email", "/login", "/register", "/forgot-password", "/terms", "/privacy", "/contact"];

// ── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // On mount: restore session from stored access token
  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }
    authApi
      .me()
      .then(setUser)
      .catch(() => clearTokens())
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<User> => {
    const tokens = await authApi.login({ email, password });
    setTokens(tokens.accessToken, tokens.refreshToken);
    const me = await authApi.me();
    setUser(me);
    return me;
  }, []);

  const register = useCallback(
    async (name: string, email: string, password: string, referralCode?: string) => {
      // Only called after the parent ticks the consent box on the sign-up form.
      const tokens = await authApi.register({ name, email, password, referralCode, acceptTerms: true });
      setTokens(tokens.accessToken, tokens.refreshToken);
      const me = await authApi.me();
      setUser(me);
      return me;
    },
    [],
  );

  const refreshUser = useCallback(async () => {
    if (!getAccessToken()) return null;
    const me = await authApi.me();
    setUser(me);
    return me;
  }, []);

  // A parent who hasn't verified their email is sent to the code screen from anywhere in the app.
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    if (!user?.emailVerificationRequired || !pathname || pathname === "/") return;
    if (OPEN_BEFORE_VERIFICATION.some((p) => pathname.startsWith(p))) return;
    router.replace(`/verify-email?next=${encodeURIComponent(pathname)}`);
  }, [user, pathname, router]);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore — clear locally regardless
    }
    clearTokens();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

// Re-export for convenience
export { ApiError };
